import type { IssueWithChangelog, SprintContext, StatusChange } from "../types/jira";
import type { AgileMetricsConfig, MetricsRow } from "../types/metrics";
import {
  buildAltenMemberAliasMap,
  resolveAltenMemberName,
  toAltenMemberRefs,
  type AltenMemberRef,
} from "./altenAssignees";
import { computeStatusDurations, extractStatusChanges } from "./statusTime";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function roundDays(ms: number): number {
  return Math.round((ms / MS_PER_DAY) * 100) / 100;
}

export function findFirstTransitionAt(statusChanges: StatusChange[], statusName: string): Date | null {
  const match = statusChanges.find((change) => change.to === statusName);
  return match?.at ?? null;
}

export function computeLeadTime({
  created,
  resolutiondate,
  endAt = new Date(),
}: {
  created: string;
  resolutiondate?: string | null;
  endAt?: Date;
}): number | null {
  if (!created) {
    return null;
  }

  const start = new Date(created);
  const end = resolutiondate ? new Date(resolutiondate) : new Date(endAt);
  const elapsed = end.getTime() - start.getTime();

  if (elapsed < 0) {
    return null;
  }

  return roundDays(elapsed);
}

export function computeCycleTime({
  statusChanges,
  startStatus,
  resolutiondate,
  endAt = new Date(),
}: {
  statusChanges: StatusChange[];
  startStatus: string;
  resolutiondate?: string | null;
  endAt?: Date;
}): number | null {
  const cycleStart = findFirstTransitionAt(statusChanges, startStatus);
  if (!cycleStart) {
    return null;
  }

  const end = resolutiondate ? new Date(resolutiondate) : new Date(endAt);
  const elapsed = end.getTime() - cycleStart.getTime();

  if (elapsed < 0) {
    return null;
  }

  return roundDays(elapsed);
}

export function getTimeInStatus(statusDurations: Map<string, number>, statusName: string): number {
  return statusDurations.get(statusName) ?? 0;
}

export function extractAltenAssignees(
  changelog: IssueWithChangelog["changelog"],
  teamMembers: AltenMemberRef[] | string[],
  currentAssignee: string,
): string[] | null {
  const aliasMap = buildAltenMemberAliasMap(toAltenMemberRefs(teamMembers));
  const assigned = new Set<string>();

  const addIfMember = (label?: string | null) => {
    const name = resolveAltenMemberName(label, aliasMap);
    if (name) {
      assigned.add(name);
    }
  };

  addIfMember(currentAssignee);

  for (const history of changelog ?? []) {
    for (const item of history.items ?? []) {
      if (item.field !== "assignee") {
        continue;
      }
      addIfMember(item.toString);
      addIfMember(item.fromString);
    }
  }

  if (assigned.size === 0) {
    return null;
  }

  return [...assigned].sort((a, b) => a.localeCompare(b));
}

function parseSprintNames(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function sortSprintNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const numA = Number.parseInt(a.match(/Sprint\s+(\d+)/i)?.[1] ?? "0", 10);
    const numB = Number.parseInt(b.match(/Sprint\s+(\d+)/i)?.[1] ?? "0", 10);
    if (numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}

export function extractSprintHistory(
  changelog: IssueWithChangelog["changelog"],
  currentSprint: string | null,
): string[] | null {
  const sprints = new Set<string>();

  for (const name of parseSprintNames(currentSprint)) {
    sprints.add(name);
  }

  for (const history of changelog ?? []) {
    for (const item of history.items ?? []) {
      if (item.field !== "Sprint") {
        continue;
      }
      for (const name of parseSprintNames(item.fromString)) {
        sprints.add(name);
      }
      for (const name of parseSprintNames(item.toString)) {
        sprints.add(name);
      }
    }
  }

  if (sprints.size === 0) {
    return null;
  }

  return sortSprintNames([...sprints]);
}

export function extractFirstSprint(
  changelog: IssueWithChangelog["changelog"],
  currentSprint: string | null,
): string | null {
  const sorted = [...(changelog ?? [])].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );

  for (const history of sorted) {
    for (const item of history.items ?? []) {
      if (item.field !== "Sprint") {
        continue;
      }
      const from = parseSprintNames(item.fromString);
      const to = parseSprintNames(item.toString);
      const added = to.filter((name) => !from.includes(name));
      if (added.length > 0) {
        return sortSprintNames(added)[0];
      }
    }
  }

  const current = parseSprintNames(currentSprint);
  return current.length > 0 ? sortSprintNames(current)[0] : null;
}

export function isCreatedInSprint(
  created: string,
  sprintStart: string | null | undefined,
  sprintEnd: string | null | undefined,
  completeDate: string | null | undefined,
): "Yes" | "No" | null {
  if (!created || !sprintStart) {
    return null;
  }

  const createdAt = new Date(created);
  const start = new Date(sprintStart);
  const end = sprintEnd
    ? new Date(sprintEnd)
    : completeDate
      ? new Date(completeDate)
      : new Date();

  return createdAt >= start && createdAt <= end ? "Yes" : "No";
}

export function isAddedInActiveSprint(
  firstSprint: string | null,
  activeSprintName: string | null,
): "Yes" | "No" | null {
  if (!firstSprint || !activeSprintName) {
    return null;
  }

  return firstSprint === activeSprintName ? "Yes" : "No";
}

export function buildMetricsRow(
  issue: IssueWithChangelog,
  agileMetrics: AgileMetricsConfig,
  teamMembers: AltenMemberRef[] | string[] = [],
  sprintContext: Partial<SprintContext> = {},
  endAt: Date = new Date(),
): MetricsRow {
  const statusChanges = extractStatusChanges(issue.changelog ?? []);
  const end = issue.resolutiondate ? new Date(issue.resolutiondate) : new Date(endAt);
  const statusDurations = computeStatusDurations({
    created: issue.created,
    currentStatus: issue.status,
    statusChanges,
    endAt: end,
  });

  const cycleStartStatus = agileMetrics.cycleStartStatus;
  const blockedStatus = agileMetrics.blockedStatus;
  const refinementStatus = agileMetrics.refinementStatus;

  const cycleStartAt = findFirstTransitionAt(statusChanges, cycleStartStatus);
  const altenAssignees = extractAltenAssignees(issue.changelog, teamMembers, issue.assignee);
  const sprints = extractSprintHistory(issue.changelog, issue.sprint);
  const firstSprint = extractFirstSprint(issue.changelog, issue.sprint);
  const activeSprint = sprintContext.name ?? null;

  return {
    issueId: issue.id,
    key: issue.key,
    url: issue.url,
    summary: issue.summary,
    type: issue.type,
    status: issue.status,
    assignee: issue.assignee,
    altenAssignees: altenAssignees ? altenAssignees.join(", ") : null,
    resolution: issue.resolution ?? "",
    created: issue.created,
    updated: issue.updated ?? "",
    storyPoints: issue.storyPoints ?? null,
    sprints: sprints ? sprints.join(", ") : null,
    activeSprint,
    sprintStart: sprintContext.startDate ?? null,
    sprintEnd: sprintContext.endDate ?? null,
    createdInSprint: isCreatedInSprint(
      issue.created,
      sprintContext.startDate,
      sprintContext.endDate,
      sprintContext.completeDate,
    ),
    firstSprint,
    addedInActiveSprint: isAddedInActiveSprint(firstSprint, activeSprint),
    resolved: issue.resolutiondate,
    leadTimeDays: computeLeadTime({
      created: issue.created,
      resolutiondate: issue.resolutiondate,
      endAt,
    }),
    cycleStartAt: cycleStartAt ? cycleStartAt.toISOString() : null,
    cycleTimeDays: computeCycleTime({
      statusChanges,
      startStatus: cycleStartStatus,
      resolutiondate: issue.resolutiondate,
      endAt,
    }),
    blockedTimeDays: getTimeInStatus(statusDurations, blockedStatus),
    refinementDays: getTimeInStatus(statusDurations, refinementStatus),
  };
}
