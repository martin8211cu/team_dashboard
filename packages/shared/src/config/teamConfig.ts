import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TeamSettings } from "../types/config";
import { DEFAULT_AGILE_METRICS } from "../types/config";
import type { AgileMetricsConfig } from "../types/metrics";

const SHARED_CONFIG_DIR = dirname(fileURLToPath(import.meta.url));
/** packages/shared/src/config → monorepo root */
const MONOREPO_ROOT = join(SHARED_CONFIG_DIR, "../../../..");

export function parseTeamSettings(raw: unknown): TeamSettings {
  const config = raw as TeamSettings;

  if (!config.project) {
    throw new Error("Invalid team config: expected project");
  }

  return config;
}

/**
 * Resolve TEAM_CONFIG_PATH whether the process cwd is the monorepo root or apps/api.
 */
export function resolveTeamConfigPath(configPath: string): string {
  if (isAbsolute(configPath)) {
    return configPath;
  }

  const fromCwd = resolve(process.cwd(), configPath);
  if (existsSync(fromCwd)) {
    return fromCwd;
  }

  const fromRoot = resolve(MONOREPO_ROOT, configPath);
  if (existsSync(fromRoot)) {
    return fromRoot;
  }

  return fromCwd;
}

export function loadTeamSettings(configPath: string): TeamSettings {
  const resolved = resolveTeamConfigPath(configPath);
  const raw = readFileSync(resolved, "utf8");
  return parseTeamSettings(JSON.parse(raw));
}

export function loadDefaultTeamSettings(): TeamSettings {
  const configPath = join(SHARED_CONFIG_DIR, "../../config/teams/example.json");
  return loadTeamSettings(configPath);
}

function readOptionalInt(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

/** Team settings from env when `TEAM_PROJECT` is set; otherwise null. */
export function loadTeamSettingsFromEnv(): TeamSettings | null {
  const project = process.env.TEAM_PROJECT?.trim();
  if (!project) {
    return null;
  }

  const settings: TeamSettings = { project };

  const minSprintNumber = readOptionalInt("TEAM_MIN_SPRINT_NUMBER");
  if (minSprintNumber != null) {
    settings.minSprintNumber = minSprintNumber;
  }

  const epicsSummaryContains = process.env.TEAM_EPICS_SUMMARY_CONTAINS?.trim();
  if (epicsSummaryContains) {
    settings.epicsSummaryContains = epicsSummaryContains;
  }

  const boardId = readOptionalInt("TEAM_BOARD_ID");
  if (boardId != null) {
    settings.boardId = boardId;
  }

  const agileMetrics: Partial<AgileMetricsConfig> = {};
  const cycleStartStatus = process.env.TEAM_CYCLE_START_STATUS?.trim();
  if (cycleStartStatus) {
    agileMetrics.cycleStartStatus = cycleStartStatus;
  }
  const blockedStatus = process.env.TEAM_BLOCKED_STATUS?.trim();
  if (blockedStatus) {
    agileMetrics.blockedStatus = blockedStatus;
  }
  const refinementStatus = process.env.TEAM_REFINEMENT_STATUS?.trim();
  if (refinementStatus) {
    agileMetrics.refinementStatus = refinementStatus;
  }
  if (Object.keys(agileMetrics).length > 0) {
    settings.agileMetrics = agileMetrics;
  }

  return settings;
}

/** Env (`TEAM_PROJECT`) → file (`TEAM_CONFIG_PATH`) → bundled example.json */
export function resolveTeamSettings(): TeamSettings {
  const fromEnv = loadTeamSettingsFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  const configPath = process.env.TEAM_CONFIG_PATH?.trim();
  if (configPath) {
    return loadTeamSettings(configPath);
  }
  return loadDefaultTeamSettings();
}

export function resolveAgileMetrics(settings: TeamSettings): AgileMetricsConfig {
  return {
    ...DEFAULT_AGILE_METRICS,
    ...settings.agileMetrics,
  };
}
