import type { MetricsRow } from "../types/metrics";
import { accumulateByAltenAssignees } from "./altenAssignees";

export type SummarizeSprintMetricsOptions = {
  countMembers?: string[];
};

const CLOSED_STATUSES = new Set(["Closed", "Done", "Canceled"]);
const COMPLETED_STATUSES = new Set(["Closed", "Done"]);

const WIP_STATUSES = new Set([
  "To Do",
  "In Progress",
  "In Development",
  "Ready for Test",
  "Test In Progress",
  "In Testing",
  "Waiting Feedback",
  "ON HOLD",
  "On Hold",
  "Peer Review",
]);

function isCompleted(row: MetricsRow): boolean {
  return COMPLETED_STATUSES.has(row.status);
}

function pctRatio(part: number, total: number): number | null {
  if (total === 0) {
    return null;
  }
  return Math.round((part / total) * 1000) / 10;
}

function avg(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type SprintMetricsSummary = {
  total: number;
  open: number;
  closed: number;
  avgCycleTime: number | null;
  avgLeadTime: number | null;
  avgBlockedDays: number | null;
  avgRefinementDays: number | null;
  totalBlockedDays: number;
  totalStoryPoints: number;
  velocityStoryPoints: number;
  velocityTickets: number;
  commitmentStoryPointsPct: number | null;
  commitmentTicketsPct: number | null;
  wipCount: number;
  scopeCreepCount: number;
  scopeCreepPct: number | null;
  bugRatePct: number | null;
  bugsCreated: number;
  bugsCarried: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  byAssignee: { assignee: string; count: number }[];
  topLeadTime: { key: string; summary: string; leadTimeDays: number }[];
  leadTimeByStatus: { status: string; avgLeadTime: number }[];
};

export function summarizeSprintMetrics(
  metrics: MetricsRow[],
  options: SummarizeSprintMetricsOptions = {},
): SprintMetricsSummary {
  const { countMembers } = options;
  const cycleTimes = metrics.map((row) => row.cycleTimeDays).filter((value): value is number => value != null);
  const leadTimes = metrics.map((row) => row.leadTimeDays).filter((value): value is number => value != null);
  const blockedTimes = metrics.map((row) => row.blockedTimeDays);
  const refinementTimes = metrics.map((row) => row.refinementDays);

  const statusMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const assigneeMap = new Map<string, number>();
  const leadByStatus = new Map<string, number[]>();

  for (const row of metrics) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
    typeMap.set(row.type, (typeMap.get(row.type) ?? 0) + 1);
    accumulateByAltenAssignees(assigneeMap, row.altenAssignees, countMembers);

    if (row.leadTimeDays != null) {
      const bucket = leadByStatus.get(row.status) ?? [];
      bucket.push(row.leadTimeDays);
      leadByStatus.set(row.status, bucket);
    }
  }

  const completed = metrics.filter(isCompleted);
  const velocityStoryPoints = completed.reduce((sum, row) => sum + (row.storyPoints ?? 0), 0);
  const velocityTickets = completed.length;
  const totalStoryPoints = metrics.reduce((sum, row) => sum + (row.storyPoints ?? 0), 0);
  const bugsCreated = metrics.filter(
    (row) => row.type === "Bug" && row.createdInSprint === "Yes",
  ).length;
  const scopeCreepCount = metrics.filter((row) => row.addedInActiveSprint === "Yes").length;
  const wipCount = metrics.filter(
    (row) => !CLOSED_STATUSES.has(row.status) && WIP_STATUSES.has(row.status),
  ).length;

  const topLeadTime = [...metrics]
    .filter((row) => row.leadTimeDays != null)
    .sort((a, b) => (b.leadTimeDays ?? 0) - (a.leadTimeDays ?? 0))
    .slice(0, 10)
    .map((row) => ({
      key: row.key,
      summary: row.summary,
      leadTimeDays: row.leadTimeDays as number,
    }));

  return {
    total: metrics.length,
    open: metrics.filter((row) => !CLOSED_STATUSES.has(row.status)).length,
    closed: metrics.filter((row) => CLOSED_STATUSES.has(row.status)).length,
    avgCycleTime: avg(cycleTimes),
    avgLeadTime: avg(leadTimes),
    avgBlockedDays: avg(blockedTimes),
    avgRefinementDays: avg(refinementTimes),
    totalBlockedDays: blockedTimes.reduce((sum, value) => sum + value, 0),
    totalStoryPoints,
    velocityStoryPoints,
    velocityTickets,
    commitmentStoryPointsPct: pctRatio(velocityStoryPoints, totalStoryPoints),
    commitmentTicketsPct: pctRatio(velocityTickets, metrics.length),
    wipCount,
    scopeCreepCount,
    scopeCreepPct: pctRatio(scopeCreepCount, metrics.length),
    bugRatePct: pctRatio(bugsCreated, velocityTickets),
    bugsCreated,
    bugsCarried: metrics.filter((row) => row.type === "Bug" && row.createdInSprint === "No").length,
    byStatus: [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byAssignee: [...assigneeMap.entries()]
      .map(([assignee, count]) => ({ assignee, count }))
      .sort((a, b) => b.count - a.count),
    topLeadTime,
    leadTimeByStatus: [...leadByStatus.entries()]
      .map(([status, values]) => ({
        status,
        avgLeadTime: avg(values) ?? 0,
      }))
      .sort((a, b) => b.avgLeadTime - a.avgLeadTime),
  };
}

export type SprintEvolutionPoint = {
  sprintNumber: number;
  sprintName: string;
  avgCycleTime: number | null;
  avgLeadTime: number | null;
  plannedStoryPoints: number;
  doneStoryPoints: number;
  plannedTickets: number;
  doneTickets: number;
  commitmentStoryPointsPct: number | null;
  commitmentTicketsPct: number | null;
  scopeCreepPct: number | null;
  bugRatePct: number | null;
  bugsCreated: number;
};

export function summarizeSprintEvolution(
  sprints: Array<{ sprintNumber: number; sprintName: string; metrics: MetricsRow[] }>,
): SprintEvolutionPoint[] {
  return [...sprints]
    .sort((a, b) => a.sprintNumber - b.sprintNumber)
    .map(({ sprintNumber, sprintName, metrics }) => {
      const summary = summarizeSprintMetrics(metrics);
      return {
        sprintNumber,
        sprintName,
        avgCycleTime: summary.avgCycleTime,
        avgLeadTime: summary.avgLeadTime,
        plannedStoryPoints: summary.totalStoryPoints,
        doneStoryPoints: summary.velocityStoryPoints,
        plannedTickets: summary.total,
        doneTickets: summary.velocityTickets,
        commitmentStoryPointsPct: summary.commitmentStoryPointsPct,
        commitmentTicketsPct: summary.commitmentTicketsPct,
        scopeCreepPct: summary.scopeCreepPct,
        bugRatePct: summary.bugRatePct,
        bugsCreated: summary.bugsCreated,
      };
    });
}
