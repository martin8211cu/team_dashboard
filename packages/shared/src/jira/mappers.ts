import { extractAltenAssignees } from "../metrics/agileMetrics";
import { formatAltenAssignees, type AltenMemberRef } from "../metrics/altenAssignees";
import { JIRA_FIELD_IDS } from "./fields";
import type { JiraChangelogHistory, JiraRawIssue, MappedIssue } from "../types/jira";

function secondsToHours(seconds: unknown): number | null {
  if (seconds == null || typeof seconds !== "number" || Number.isNaN(seconds)) {
    return null;
  }
  return Math.round((seconds / 3600) * 10) / 10;
}

export function formatSprint(sprintField: unknown): string | null {
  if (!sprintField) {
    return null;
  }

  if (Array.isArray(sprintField)) {
    return sprintField
      .map((entry) => {
        if (typeof entry === "string") {
          const match = entry.match(/name=([^,\]]+)/);
          return match ? match[1] : entry;
        }
        if (entry && typeof entry === "object" && "name" in entry) {
          return String((entry as { name?: string }).name ?? "");
        }
        return null;
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof sprintField === "string") {
    const match = sprintField.match(/name=([^,\]]+)/);
    return match ? match[1] : sprintField;
  }

  if (typeof sprintField === "object" && sprintField !== null && "name" in sprintField) {
    return String((sprintField as { name?: string }).name ?? null);
  }

  return null;
}

function formatParent(fields: Record<string, unknown>): string | null {
  const parent = fields.parent as { key?: string; fields?: { summary?: string } } | undefined;
  if (!parent) {
    return null;
  }

  const summary = parent.fields?.summary;
  return summary ? `${parent.key}: ${summary}` : (parent.key ?? null);
}

function fieldString(fields: Record<string, unknown>, key: string): string {
  const value = fields[key] as { name?: string } | undefined;
  return value?.name ?? "";
}

export function mapIssue(issue: JiraRawIssue, baseUrl: string): MappedIssue {
  const fields = (issue.fields ?? {}) as Record<string, unknown>;
  const assigneeField = fields.assignee as { displayName?: string } | undefined;

  return {
    key: issue.key,
    url: `${baseUrl.replace(/\/$/, "")}/browse/${issue.key}`,
    summary: String(fields.summary ?? ""),
    type: fieldString(fields, "issuetype"),
    status: fieldString(fields, "status"),
    assignee: assigneeField?.displayName ?? "Unassigned",
    parent: formatParent(fields),
    priority: fieldString(fields, "priority"),
    storyPoints: (fields[JIRA_FIELD_IDS.storyPoints] as number | null) ?? null,
    originalEstimateHours: secondsToHours(fields.timeoriginalestimate),
    timeSpentHours: secondsToHours(fields.timespent),
    timeRemainingHours: secondsToHours(fields.timeestimate),
    updated: String(fields.updated ?? ""),
    created: String(fields.created ?? ""),
    resolutiondate: (fields.resolutiondate as string | null) ?? null,
    sprint: formatSprint(fields[JIRA_FIELD_IDS.sprint]),
    altenAssignees: null,
  };
}

export function mapIssueWithAltenAssignees(
  issue: JiraRawIssue,
  changelog: JiraChangelogHistory[] | undefined,
  teamMembers: AltenMemberRef[] | string[],
  baseUrl: string,
): MappedIssue {
  const mapped = mapIssue(issue, baseUrl);
  const altenAssignees = extractAltenAssignees(changelog ?? [], teamMembers, mapped.assignee);
  return {
    ...mapped,
    altenAssignees: formatAltenAssignees(altenAssignees),
  };
}
