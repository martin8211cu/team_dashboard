import { createLogger } from "../lib/logger";
import { hasMetricsSnapshot } from "../db/sprintMetrics";
import { hasSnapshot } from "../db/sprintTasks";
import {
  assertNotCancelled,
  cancellableSleep,
  SyncCancelledError,
} from "../lib/syncCancel";
import { type JiraService, type LoadSprintOptions } from "./jiraService";

const log = createLogger("worker:sprint-sync");

export type SprintSyncConfig = {
  sprintDelayMs: number;
  changelogConcurrency: number;
  maxClosedPerRun?: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

export type SprintSyncFailure = {
  sprintNumber: number;
  error: string;
};

export type SprintSyncSuccess = {
  sprintNumber: number;
  cached: boolean;
  taskCount: number;
  metricsCount: number;
};

export type SprintSyncReport = {
  startedAt: string;
  finishedAt: string;
  activeUpdated: number[];
  closedCompleted: number[];
  succeeded: SprintSyncSuccess[];
  failed: SprintSyncFailure[];
  skippedClosed: number[];
};

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit/i.test(message);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    label: string;
    signal?: AbortSignal;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    assertNotCancelled(options.signal);

    try {
      return await fn();
    } catch (error) {
      if (error instanceof SyncCancelledError) {
        throw error;
      }

      lastError = error;
      const retryable = isRateLimitError(error);
      const isLastAttempt = attempt === options.maxRetries;

      if (!retryable || isLastAttempt) {
        throw error;
      }

      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      log.warn(
        `${options.label} rate limited (attempt ${attempt}/${options.maxRetries}), retrying in ${delayMs / 1000}s...`,
      );
      await cancellableSleep(delayMs, options.signal);
    }
  }

  throw lastError;
}

async function hasFullSnapshot(sprintNumber: number): Promise<boolean> {
  return (await hasSnapshot(sprintNumber)) && (await hasMetricsSnapshot(sprintNumber));
}

export class SprintSyncService {
  constructor(private readonly jira: JiraService) {}

  async buildQueue(config: Pick<SprintSyncConfig, "maxClosedPerRun">): Promise<{
    active: number[];
    closedMissing: number[];
    skippedClosed: number[];
  }> {
    const sprints = await this.jira.listSprints();

    const active = sprints
      .filter((sprint) => sprint.state === "active" && sprint.number != null)
      .map((sprint) => sprint.number!)
      .sort((a, b) => a - b);

    const closedCandidates = sprints.filter(
      (sprint) => sprint.state === "closed" && sprint.number != null,
    );
    const closedMissingAll: number[] = [];
    for (const sprint of closedCandidates) {
      if (!(await hasFullSnapshot(sprint.number!))) {
        closedMissingAll.push(sprint.number!);
      }
    }
    closedMissingAll.sort((a, b) => a - b);

    const maxClosed = config.maxClosedPerRun;
    const closedMissing =
      maxClosed != null && maxClosed > 0
        ? closedMissingAll.slice(0, maxClosed)
        : closedMissingAll;
    const skippedClosed =
      maxClosed != null && maxClosed > 0 ? closedMissingAll.slice(maxClosed) : [];

    return { active, closedMissing, skippedClosed };
  }

  async runDailySync(
    config: SprintSyncConfig,
    options: { signal?: AbortSignal } = {},
  ): Promise<SprintSyncReport> {
    const { signal } = options;
    const startedAt = new Date().toISOString();
    const { active, closedMissing, skippedClosed } = await this.buildQueue(config);
    const queue = [...active, ...closedMissing];

    log.info(
      `started — active: [${active.join(", ")}], closed missing: [${closedMissing.join(", ")}]`,
    );
    if (skippedClosed.length > 0) {
      log.info(
        `skipping ${skippedClosed.length} closed sprint(s) this run (SYNC_MAX_CLOSED_PER_RUN=${config.maxClosedPerRun})`,
      );
    }

    const loadOptions: LoadSprintOptions = {
      changelogConcurrency: config.changelogConcurrency,
    };

    const succeeded: SprintSyncSuccess[] = [];
    const failed: SprintSyncFailure[] = [];
    const activeUpdated: number[] = [];
    const closedCompleted: number[] = [];

    try {
      for (let index = 0; index < queue.length; index++) {
        assertNotCancelled(signal);

        const sprintNumber = queue[index]!;
        const position = index + 1;
        log.info(`loading sprint ${sprintNumber} (${position}/${queue.length})...`);

        try {
          const result = await withRetry(
            () => this.jira.loadSprint(sprintNumber, loadOptions),
            {
              maxRetries: config.maxRetries,
              baseDelayMs: config.retryBaseDelayMs,
              label: `sprint ${sprintNumber}`,
              signal,
            },
          );

        succeeded.push({
          sprintNumber,
          cached: result.cached,
          taskCount: result.tasks.tasks.length,
          metricsCount: result.metrics.metrics.length,
        });

        if (active.includes(sprintNumber)) {
          activeUpdated.push(sprintNumber);
        } else {
          closedCompleted.push(sprintNumber);
        }

        log.info(
          `sprint ${sprintNumber} ok — ${result.tasks.tasks.length} tasks, ${result.metrics.metrics.length} metrics${result.cached ? " (cached)" : ""}`,
        );
        } catch (error) {
          if (error instanceof SyncCancelledError) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String(error);
          failed.push({ sprintNumber, error: message });
          log.error(`sprint ${sprintNumber} failed — ${message}`);
        }

        const hasMore = index < queue.length - 1;
        if (hasMore && config.sprintDelayMs > 0) {
          log.info(`waiting ${config.sprintDelayMs / 1000}s before next sprint...`);
          await cancellableSleep(config.sprintDelayMs, signal);
        }
      }
    } catch (error) {
      if (error instanceof SyncCancelledError) {
        log.info(`cancelled — ok: ${succeeded.length}, failed: ${failed.length}`);
      } else {
        throw error;
      }
    }

    const finishedAt = new Date().toISOString();
    if (!signal?.aborted) {
      log.info(`finished — ok: ${succeeded.length}, failed: ${failed.length}`);
    }

    return {
      startedAt,
      finishedAt,
      activeUpdated,
      closedCompleted,
      succeeded,
      failed,
      skippedClosed,
    };
  }
}
