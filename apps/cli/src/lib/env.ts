import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JiraClient, resolveTeamSettings, type TeamConfig } from "@team-dashboard/shared";
import { getActiveMemberNamesFromDb } from "./membersDb";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const envCandidates = [
  process.env.DOTENV_PATH,
  join(rootDir, ".env"),
].filter(Boolean) as string[];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

export function createClientFromEnv(): JiraClient {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Missing Jira credentials. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in .env at the project root",
    );
  }

  if (apiToken === "your_atlassian_api_token") {
    throw new Error("Update JIRA_API_TOKEN with your Atlassian API token");
  }

  return new JiraClient({ baseUrl, email, apiToken });
}

export async function getTeamConfig(): Promise<TeamConfig> {
  const settings = resolveTeamSettings();
  const members = await getActiveMemberNamesFromDb();

  if (members.length === 0) {
    throw new Error("No active team members in DB. Add members via the dashboard /members page");
  }

  return { ...settings, members };
}

export const CLI_ROOT = rootDir;
