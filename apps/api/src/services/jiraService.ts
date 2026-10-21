import {
  buildAltenMemberRefs,
  buildEpicsJql,
  buildMetricsRow,
  buildSprintJqlByNumber,
  buildStatusColumnOrder,
  computeStatusDurations,
  epicRowToValues,
  extractStatusChanges,
  mapIssueWithAltenAssignees,
  filterSprintsFromMin,
  resolveAgileMetrics,
  type EpicStatusRow,
  type SprintLoadResponse,
  type SprintMetricsCompareResponse,
  type SprintMetricsResponse,
  type SprintTasksCompareResponse,
  type SprintTasksResponse,
} from "@team-dashboard/shared";
import { listMembers } from "../db/members";
import {
  getMetricsSnapshot,
  hasMetricsSnapshot,
  listMetricsSnapshotMeta,
  saveMetricsSnapshot,
  type SprintMetricsSnapshot,
} from "../db/sprintMetrics";
import {
  getSnapshot,
  hasSnapshot,
  listSnapshotMeta,
  saveSnapshot,
  type SprintTaskSnapshot,
} from "../db/sprintTasks";
import { createJiraClientFromEnv } from "../lib/jiraClient";
import { createLogger } from "../lib/logger";

const log = createLogger("jira");
import { resolveAssigneesForJql } from "./memberJiraService";
import { getTeamConfig, getTeamSettings } from "./teamConfigService";
import type { SprintListItem } from "@team-dashboard/shared";

function metricsSnapshotToResponse(
  snapshot: SprintMetricsSnapshot,
  cached: boolean,
): SprintMetricsResponse {
  return {
    sprintNumber: snapshot.sprintNumber,
    sprintName: snapshot.sprintName,
    sprintState: snapshot.sprintState,
    fetchedAt: snapshot.fetchedAt,
    cached,
    sprint: snapshot.sprint,
    metrics: snapshot.metrics,
  };
}

function snapshotToResponse(snapshot: SprintTaskSnapshot, cached: boolean): SprintTasksResponse {
  return {
    sprintNumber: snapshot.sprintNumber,
    sprintName: snapshot.sprintName,
    sprintState: snapshot.sprintState,
    fetchedAt: snapshot.fetchedAt,
    cached,
    tasks: snapshot.tasks,
  };
}

function sprintLoadToResponse(
  metrics: SprintMetricsSnapshot,
  tasks: SprintTaskSnapshot,
  cached: boolean,
): SprintLoadResponse {
  return {
    sprintNumber: metrics.sprintNumber,
    sprintName: metrics.sprintName,
    sprintState: metrics.sprintState,
    fetchedAt: metrics.fetchedAt,
    cached,
    metrics: metricsSnapshotToResponse(metrics, cached),
    tasks: snapshotToResponse(tasks, cached),
  };
}

function isFrozenSprintState(state: string): boolean {
  return state === "closed" || state === "future";
}

export type LoadSprintOptions = {
  changelogConcurrency?: number;
};

export class JiraService {
  async getConfig() {
    const settings = await getTeamSettings();
    const config = await getTeamConfig();
    return {
      project: settings.project,
      members: config.members,
      agileMetrics: settings.agileMetrics,
    };
  }

  async listSprints(): Promise<SprintListItem[]> {
    const config = await getTeamConfig();
    const client = createJiraClientFromEnv();
    const allSprints = await client.listSprints(config.project, { boardId: config.boardId });
    const sprints = filterSprintsFromMin(allSprints, config.minSprintNumber);
    const taskMeta = await listSnapshotMeta();
    const metricsMeta = await listMetricsSnapshotMeta();
    const tasksBySprint = new Map(taskMeta.map((meta) => [meta.sprintNumber, meta]));
    const metricsBySprint = new Map(metricsMeta.map((meta) => [meta.sprintNumber, meta]));

    return sprints.map((sprint) => {
      if (sprint.number == null) {
        return sprint;
      }
      const tasks = tasksBySprint.get(sprint.number);
      const metrics = metricsBySprint.get(sprint.number);
      return {
        ...sprint,
        taskSnapshot: tasks
          ? {
              sprintNumber: tasks.sprintNumber,
              fetchedAt: tasks.fetchedAt,
              taskCount: tasks.taskCount,
            }
          : undefined,
        metricsSnapshot: metrics
          ? {
              sprintNumber: metrics.sprintNumber,
              fetchedAt: metrics.fetchedAt,
              metricsCount: metrics.metricsCount,
            }
          : undefined,
      };
    });
  }

  private async findSprintByNumber(sprintNumber: number): Promise<SprintListItem> {
    const sprints = await this.listSprints();
    const sprint = sprints.find((item) => item.number === sprintNumber);
    if (!sprint) {
      throw new Error(`Sprint not found: ${sprintNumber}`);
    }
    return sprint;
  }

  private async fetchAndPersistSprintData(
    sprintNumber: number,
    sprint: SprintListItem,
    options: LoadSprintOptions = {},
  ): Promise<{ metrics: SprintMetricsSnapshot; tasks: SprintTaskSnapshot }> {
    const config = await getTeamConfig();
    const assignees = await resolveAssigneesForJql();
    const memberRefs = buildAltenMemberRefs(await listMembers({ activeOnly: true }), assignees);
    const client = createJiraClientFromEnv();
    const agileMetrics = resolveAgileMetrics(config);

    const sprintContext = await client.getSprintMetadata(config.project, sprintNumber, {
      boardId: config.boardId,
    });

    const jql = buildSprintJqlByNumber(config.project, assignees, sprintNumber, {
      allTickets: true,
    });

    const issues = await client.getIssuesWithChangelog(jql, {
      concurrency: options.changelogConcurrency,
      onSearchComplete: (count) =>
        log.info(`sprint ${sprintNumber}: ${count} issues, fetching changelogs...`),
      onProgress: (done, total) => {
        if (done === total || done % 10 === 0) {
          log.debug(`sprint ${sprintNumber}: changelog ${done}/${total}`);
        }
      },
    });

    const metrics = issues.map(({ issue }) =>
      buildMetricsRow(issue, agileMetrics, memberRefs, sprintContext),
    );
    const tasks = issues.map(({ issue, raw }) =>
      mapIssueWithAltenAssignees(raw, issue.changelog, memberRefs, client.baseUrl),
    );

    const metricsSnapshot = await saveMetricsSnapshot({
      sprintNumber,
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintState: sprint.state,
      sprint: sprintContext,
      metrics,
    });

    const tasksSnapshot = await saveSnapshot({
      sprintNumber,
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintState: sprint.state,
      tasks,
    });

    return { metrics: metricsSnapshot, tasks: tasksSnapshot };
  }

  async loadSprint(
    sprintNumber: number,
    options: LoadSprintOptions = {},
  ): Promise<SprintLoadResponse> {
    const sprint = await this.findSprintByNumber(sprintNumber);

    if (
      isFrozenSprintState(sprint.state) &&
      (await hasMetricsSnapshot(sprintNumber)) &&
      (await hasSnapshot(sprintNumber))
    ) {
      const metrics = (await getMetricsSnapshot(sprintNumber))!;
      const tasks = (await getSnapshot(sprintNumber))!;
      return sprintLoadToResponse(metrics, tasks, true);
    }

    log.info(`loading sprint ${sprintNumber} (metrics + tasks)...`);
    const saved = await this.fetchAndPersistSprintData(sprintNumber, sprint, options);
    log.info(
      `sprint ${sprintNumber}: ${saved.metrics.metricsCount} metrics, ${saved.tasks.taskCount} tasks saved`,
    );
    return sprintLoadToResponse(saved.metrics, saved.tasks, false);
  }

  async loadSprintTasks(sprintNumber: number): Promise<SprintTasksResponse> {
    const result = await this.loadSprint(sprintNumber);
    return result.tasks;
  }

  async getSprintTasks(sprintNumber: number): Promise<SprintTasksResponse> {
    const snapshot = await getSnapshot(sprintNumber);
    if (!snapshot) {
      throw new Error(`No task snapshot for sprint ${sprintNumber}`);
    }
    return snapshotToResponse(snapshot, true);
  }

  async compareSprintTasks(sprintNumbers: number[]): Promise<SprintTasksCompareResponse> {
    const unique = [...new Set(sprintNumbers)].sort((a, b) => b - a);
    const sprints: SprintTasksResponse[] = [];
    const missing: number[] = [];

    for (const sprintNumber of unique) {
      const snapshot = await getSnapshot(sprintNumber);
      if (!snapshot) {
        missing.push(sprintNumber);
        continue;
      }
      sprints.push(snapshotToResponse(snapshot, true));
    }

    return { sprints, missing };
  }

  async loadSprintMetrics(sprintNumber: number): Promise<SprintMetricsResponse> {
    const result = await this.loadSprint(sprintNumber);
    return result.metrics;
  }

  async getSprintMetrics(sprintNumber: number): Promise<SprintMetricsResponse> {
    const snapshot = await getMetricsSnapshot(sprintNumber);
    if (!snapshot) {
      throw new Error(`No metrics snapshot for sprint ${sprintNumber}`);
    }
    return metricsSnapshotToResponse(snapshot, true);
  }

  async compareSprintMetrics(sprintNumbers: number[]): Promise<SprintMetricsCompareResponse> {
    const unique = [...new Set(sprintNumbers)].sort((a, b) => a - b);
    const sprints: SprintMetricsResponse[] = [];
    const missing: number[] = [];

    for (const sprintNumber of unique) {
      const snapshot = await getMetricsSnapshot(sprintNumber);
      if (!snapshot) {
        missing.push(sprintNumber);
        continue;
      }
      sprints.push(metricsSnapshotToResponse(snapshot, true));
    }

    return { sprints, missing };
  }

  async getEpicStatusTimes(): Promise<{ columns: string[]; rows: Record<string, string | number>[] }> {
    const config = await getTeamConfig();
    const client = createJiraClientFromEnv();
    const jql = buildEpicsJql(config.project, {
      summaryContains: config.epicsSummaryContains,
    });
    const epics = await client.getEpicsWithStatusTimes(jql);

    const epicRows: EpicStatusRow[] = epics.map((epic) => ({
      key: epic.key,
      url: epic.url,
      summary: epic.summary,
      statusDurations: computeStatusDurations({
        created: epic.created,
        currentStatus: epic.status,
        statusChanges: extractStatusChanges(epic.changelog),
        endAt: epic.resolutiondate ? new Date(epic.resolutiondate) : new Date(),
      }),
    }));

    const columns = buildStatusColumnOrder(epicRows);
    const rows = epicRows.map((row) => epicRowToValues(row, columns));

    return { columns, rows };
  }
}

export const jiraService = new JiraService();
