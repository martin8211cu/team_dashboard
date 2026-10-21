import { JiraClient } from "@team-dashboard/shared";

export function createJiraClientFromEnv(): JiraClient {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Missing Jira credentials. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in .env",
    );
  }

  if (apiToken === "your_atlassian_api_token") {
    throw new Error("Update JIRA_API_TOKEN in .env with your Atlassian API token");
  }

  return new JiraClient({ baseUrl, email, apiToken });
}

export function isJiraConfigured(): boolean {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  return Boolean(
    baseUrl &&
      email &&
      apiToken &&
      apiToken !== "your_atlassian_api_token",
  );
}
