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

export function resolveAgileMetrics(settings: TeamSettings): AgileMetricsConfig {
  return {
    ...DEFAULT_AGILE_METRICS,
    ...settings.agileMetrics,
  };
}
