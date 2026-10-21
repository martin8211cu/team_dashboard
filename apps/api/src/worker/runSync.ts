import { isJiraConfigured } from "../lib/jiraClient";
import { createLogger } from "../lib/logger";
import { jiraService } from "../services/jiraService";
import { SprintSyncService } from "../services/sprintSyncService";
import { loadWorkerConfig } from "./config";

const log = createLogger("worker:sprint-sync");

let syncInFlight = false;
let activeAbortController: AbortController | null = null;

const SYNC_IDLE_POLL_MS = 100;

function readShutdownTimeoutMs(): number {
  const raw = process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS;
  if (raw == null || raw.trim() === "") {
    return 30_000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30_000;
}

export function isSyncInFlight(): boolean {
  return syncInFlight;
}

export function requestSyncAbort(): void {
  activeAbortController?.abort();
}

export async function waitForSyncIdle(timeoutMs = readShutdownTimeoutMs()): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (syncInFlight && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SYNC_IDLE_POLL_MS));
  }

  return !syncInFlight;
}

export async function runDailySyncSafely(): Promise<void> {
  if (syncInFlight) {
    log.warn("skipped — previous run still in progress");
    return;
  }

  if (!isJiraConfigured()) {
    log.error("skipped — Jira credentials not configured");
    return;
  }

  syncInFlight = true;
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  try {
    const config = loadWorkerConfig();
    const service = new SprintSyncService(jiraService);
    await service.runDailySync(config.sync, { signal });
  } finally {
    activeAbortController = null;
    syncInFlight = false;
  }
}
