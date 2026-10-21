import { JIRA_SEARCH_FIELDS } from "./fields";
import { mapIssue, formatSprint } from "./mappers";
import { buildSprintName, parseSprintNumber } from "./jql";
import type {
  EpicWithChangelog,
  IssueWithChangelog,
  IssueWithChangelogAndRaw,
  JiraChangelogHistory,
  JiraRawIssue,
  MappedIssue,
  SprintContext,
  SprintListItem,
} from "../types/jira";
import type { JiraUser } from "../types/jiraUser";

export type JiraClientOptions = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

function buildAuthHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${encoded}`;
}

export class JiraClient {
  readonly baseUrl: string;
  private readonly authHeader: string;

  constructor({ baseUrl, email, apiToken }: JiraClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = buildAuthHeader(email, apiToken);
  }

  async searchIssues(jql: string, { maxResults = 100 }: { maxResults?: number } = {}): Promise<MappedIssue[]> {
    const issues = await this.searchIssuesRaw(jql, { maxResults });
    return issues.map((issue) => mapIssue(issue, this.baseUrl));
  }

  async getIssueChangelog(issueKey: string): Promise<JiraChangelogHistory[]> {
    const histories: JiraChangelogHistory[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const url = new URL(`${this.baseUrl}/rest/api/3/issue/${issueKey}/changelog`);
      url.searchParams.set("startAt", String(startAt));
      url.searchParams.set("maxResults", String(maxResults));

      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira changelog error ${response.status} for ${issueKey}: ${errorText}`);
      }

      const data = (await response.json()) as {
        values?: JiraChangelogHistory[];
        isLast?: boolean;
        total?: number;
      };

      histories.push(...(data.values ?? []));

      if (data.isLast || histories.length >= (data.total ?? histories.length)) {
        break;
      }

      startAt += maxResults;
    }

    return histories;
  }

  async getEpicsWithStatusTimes(jql: string): Promise<EpicWithChangelog[]> {
    const issues = await this.searchIssuesRaw(jql);
    const epics: EpicWithChangelog[] = [];

    for (const issue of issues) {
      const fields = issue.fields ?? {};
      const changelog = await this.getIssueChangelog(issue.key);
      epics.push({
        key: issue.key,
        url: `${this.baseUrl}/browse/${issue.key}`,
        summary: String(fields.summary ?? ""),
        status: (fields.status as { name?: string } | undefined)?.name ?? "",
        created: String(fields.created ?? ""),
        resolutiondate: (fields.resolutiondate as string | null) ?? null,
        changelog,
      });
    }

    return epics;
  }

  async getIssuesWithChangelog(
    jql: string,
    {
      concurrency = 5,
      onProgress,
      onSearchComplete,
    }: {
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
      onSearchComplete?: (total: number) => void;
    } = {},
  ): Promise<IssueWithChangelogAndRaw[]> {
    const issues = await this.searchIssuesRaw(jql);
    onSearchComplete?.(issues.length);

    const results: IssueWithChangelogAndRaw[] = new Array(issues.length);
    let completed = 0;

    const fetchOne = async (issue: JiraRawIssue, index: number) => {
      const fields = issue.fields ?? {};
      const changelog = await this.getIssueChangelog(issue.key);

      results[index] = {
        raw: issue,
        issue: {
          id: issue.id,
          key: issue.key,
          url: `${this.baseUrl}/browse/${issue.key}`,
          summary: String(fields.summary ?? ""),
          type: (fields.issuetype as { name?: string } | undefined)?.name ?? "",
          status: (fields.status as { name?: string } | undefined)?.name ?? "",
          assignee: (fields.assignee as { displayName?: string } | undefined)?.displayName ?? "Unassigned",
          resolution: (fields.resolution as { name?: string } | undefined)?.name ?? "",
          created: String(fields.created ?? ""),
          updated: String(fields.updated ?? ""),
          storyPoints: (fields.customfield_10016 as number | null) ?? null,
          sprint: formatSprint(fields.customfield_10020),
          resolutiondate: (fields.resolutiondate as string | null) ?? null,
          changelog,
        },
      };

      completed += 1;
      onProgress?.(completed, issues.length);
    };

    for (let i = 0; i < issues.length; i += concurrency) {
      const batch = issues.slice(i, i + concurrency);
      await Promise.all(batch.map((issue, batchIndex) => fetchOne(issue, i + batchIndex)));
    }

    return results;
  }

  async resolveBoardId(project: string, boardIdFromConfig?: number): Promise<number> {
    if (boardIdFromConfig) {
      return boardIdFromConfig;
    }

    const url = new URL(`${this.baseUrl}/rest/agile/1.0/board`);
    url.searchParams.set("projectKeyOrId", project);

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira board lookup error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { values?: { id?: number }[] };
    const board = (data.values ?? [])[0];

    if (!board?.id) {
      throw new Error(
        `No agile board found for project ${project}. Set boardId in team config`,
      );
    }

    return board.id;
  }

  async listSprints(
    project: string,
    { boardId, state = "active,closed,future" }: { boardId?: number; state?: string } = {},
  ): Promise<SprintListItem[]> {
    const resolvedBoardId = await this.resolveBoardId(project, boardId);
    const prefix = `${project} Sprint `;
    const rawSprints: {
      id: number;
      name: string;
      state: string;
      startDate?: string;
      endDate?: string;
      completeDate?: string;
    }[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const url = new URL(`${this.baseUrl}/rest/agile/1.0/board/${resolvedBoardId}/sprint`);
      url.searchParams.set("state", state);
      url.searchParams.set("startAt", String(startAt));
      url.searchParams.set("maxResults", String(maxResults));

      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira sprint lookup error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        values?: {
          id: number;
          name: string;
          state: string;
          startDate?: string;
          endDate?: string;
          completeDate?: string;
        }[];
        isLast?: boolean;
      };

      const page = data.values ?? [];
      rawSprints.push(...page.filter((sprint) => sprint.name.startsWith(prefix)));

      if (data.isLast || page.length === 0) {
        break;
      }

      startAt += page.length;
    }

    const sprints = rawSprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      number: parseSprintNumber(sprint.name, project),
      state: sprint.state,
      startDate: sprint.startDate ?? null,
      endDate: sprint.endDate ?? null,
      completeDate: sprint.completeDate ?? null,
    }));

    return sortSprintList(sprints);
  }

  async getSprintMetadata(
    project: string,
    sprintNumber: number | string,
    { boardId }: { boardId?: number } = {},
  ): Promise<SprintContext> {
    const sprintName = buildSprintName(project, sprintNumber);
    const resolvedBoardId = await this.resolveBoardId(project, boardId);
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const url = new URL(`${this.baseUrl}/rest/agile/1.0/board/${resolvedBoardId}/sprint`);
      url.searchParams.set("state", "active,closed,future");
      url.searchParams.set("startAt", String(startAt));
      url.searchParams.set("maxResults", String(maxResults));

      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira sprint lookup error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        values?: {
          name: string;
          startDate?: string;
          endDate?: string;
          completeDate?: string;
        }[];
        isLast?: boolean;
      };

      const match = (data.values ?? []).find((sprint) => sprint.name === sprintName);
      if (match) {
        return {
          name: match.name,
          startDate: match.startDate ?? null,
          endDate: match.endDate ?? null,
          completeDate: match.completeDate ?? null,
        };
      }

      if (data.isLast || (data.values ?? []).length === 0) {
        break;
      }

      startAt += (data.values ?? []).length;
    }

    throw new Error(`Sprint not found: ${sprintName}`);
  }

  async searchIssuesRaw(
    jql: string,
    { maxResults = 100 }: { maxResults?: number } = {},
  ): Promise<JiraRawIssue[]> {
    const issues: JiraRawIssue[] = [];
    let nextPageToken: string | undefined;

    do {
      const body: Record<string, unknown> = {
        jql,
        maxResults,
        fields: JIRA_SEARCH_FIELDS,
      };

      if (nextPageToken) {
        body.nextPageToken = nextPageToken;
      }

      const response = await fetch(`${this.baseUrl}/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        issues?: JiraRawIssue[];
        nextPageToken?: string;
      };

      issues.push(...(data.issues ?? []));
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return issues;
  }

  async searchUsers(query: string, { maxResults = 20 }: { maxResults?: number } = {}): Promise<JiraUser[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    const url = new URL(`${this.baseUrl}/rest/api/3/user/search`);
    url.searchParams.set("query", trimmed);
    url.searchParams.set("maxResults", String(maxResults));

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira user search error ${response.status}: ${errorText}`);
    }

    const users = (await response.json()) as {
      accountId?: string;
      displayName?: string;
      emailAddress?: string;
      active?: boolean;
    }[];

    return users
      .filter((u) => u.accountId)
      .map((u) => ({
        accountId: u.accountId!,
        displayName: u.displayName ?? u.accountId!,
        emailAddress: u.emailAddress ?? null,
        active: u.active ?? true,
      }));
  }

  async findUserByEmail(email: string): Promise<{ accountId: string; displayName: string } | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.searchUsers(email, { maxResults: 10 });

    const match =
      users.find((u) => u.emailAddress?.toLowerCase() === normalized) ?? users[0] ?? null;

    if (!match) {
      return null;
    }

    return {
      accountId: match.accountId,
      displayName: match.displayName,
    };
  }
}

const SPRINT_STATE_ORDER: Record<string, number> = {
  active: 0,
  closed: 1,
  future: 2,
};

function sortSprintList(sprints: SprintListItem[]): SprintListItem[] {
  return [...sprints].sort((a, b) => {
    const stateDiff =
      (SPRINT_STATE_ORDER[a.state] ?? 1) - (SPRINT_STATE_ORDER[b.state] ?? 1);
    if (stateDiff !== 0) {
      return stateDiff;
    }

    if (a.state === "closed" && b.state === "closed") {
      const dateA = a.completeDate ?? a.endDate ?? "";
      const dateB = b.completeDate ?? b.endDate ?? "";
      const dateDiff = dateB.localeCompare(dateA);
      if (dateDiff !== 0) {
        return dateDiff;
      }
    }

    if (a.number != null && b.number != null) {
      return b.number - a.number;
    }

    return a.name.localeCompare(b.name);
  });
}
