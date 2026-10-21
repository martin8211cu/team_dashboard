import type { SprintSyncConfig } from "../services/sprintSyncService";

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function readOptionalPositiveInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when set`);
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

export type WorkerConfig = {
  port: number;
  cron: string;
  runOnStart: boolean;
  sync: SprintSyncConfig;
};

export function loadWorkerConfig(): WorkerConfig {
  return {
    port: readPositiveInt("WORKER_PORT", 8091),
    cron: process.env.SYNC_CRON ?? "0 3 * * *",
    runOnStart: readBoolean("SYNC_RUN_ON_START", false),
    sync: {
      sprintDelayMs: readPositiveInt("SYNC_SPRINT_DELAY_MS", 60_000),
      changelogConcurrency: readPositiveInt("SYNC_CHANGELOG_CONCURRENCY", 3),
      maxClosedPerRun: readOptionalPositiveInt("SYNC_MAX_CLOSED_PER_RUN"),
      maxRetries: 3,
      retryBaseDelayMs: 30_000,
    },
  };
}
