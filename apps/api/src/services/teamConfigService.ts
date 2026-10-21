import {
  loadDefaultTeamSettings,
  loadTeamSettings,
  resolveAgileMetrics,
  type TeamConfig,
  type TeamSettings,
} from "@team-dashboard/shared";
import { getActiveMemberNames } from "../db/members";

function loadBaseSettings(): TeamSettings {
  const configPath = process.env.TEAM_CONFIG_PATH;
  return configPath ? loadTeamSettings(configPath) : loadDefaultTeamSettings();
}

export async function getTeamConfig(): Promise<TeamConfig> {
  const settings = loadBaseSettings();
  const members = await getActiveMemberNames();

  if (members.length === 0) {
    throw new Error("No active team members. Add members via /members");
  }

  return { ...settings, members };
}

export async function getTeamSettings() {
  const settings = loadBaseSettings();
  const memberCount = (await getActiveMemberNames()).length;

  return {
    project: settings.project,
    epicsSummaryContains: settings.epicsSummaryContains,
    boardId: settings.boardId,
    agileMetrics: resolveAgileMetrics(settings),
    memberCount,
  };
}
