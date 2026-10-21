import {
  buildAltenMemberRefs,
  buildEpicsJql,
  buildJql,
  buildSprintJql,
  computeStatusDurations,
  extractStatusChanges,
  filterMetricsByMembers,
  filterTasksByMembers,
  mapIssueWithAltenAssignees,
  type EpicStatusRow,
  type MappedIssue,
} from "@team-dashboard/shared";
import {
  buildSprintCombinedWorkbook,
  buildSprintMetricsWorkbook,
  buildSprintTasksCompareWorkbook,
  buildSprintTasksWorkbook,
  buildTasksStatusWorkbook,
  sprintFilename,
  sprintMetricsFilename,
  sprintTasksCompareFilename,
  sprintTasksFilename,
  tasksStatusFilename,
} from "@team-dashboard/export";
import { getActiveMemberNames, listMembers } from "../db/members";
import { getMetricsSnapshot } from "../db/sprintMetrics";
import { getSnapshot } from "../db/sprintTasks";
import { createJiraClientFromEnv } from "../lib/jiraClient";
import { resolveAssigneesForJql } from "./memberJiraService";
import { getTeamConfig } from "./teamConfigService";

export type ExportFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

function parseTeamOnly(raw: string | undefined): boolean {
  return raw !== "false";
}

function xlsxFile(buffer: Buffer, filename: string): ExportFile {
  return {
    buffer,
    filename,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export async function exportSprint(sprintNumber: number, teamOnly = true): Promise<ExportFile> {
  const metricsSnapshot = await getMetricsSnapshot(sprintNumber);
  const tasksSnapshot = await getSnapshot(sprintNumber);

  if (!metricsSnapshot && !tasksSnapshot) {
    throw new Error(`No snapshots for sprint ${sprintNumber}`);
  }

  const memberNames = await getActiveMemberNames();
  let metrics = metricsSnapshot?.metrics;
  let tasks = tasksSnapshot?.tasks;

  if (teamOnly) {
    if (metrics) {
      metrics = filterMetricsByMembers(metrics, memberNames);
    }
    if (tasks) {
      tasks = filterTasksByMembers(tasks, memberNames);
    }
  }

  const buffer = await buildSprintCombinedWorkbook({
    sprintNumber,
    metrics: metricsSnapshot ? metrics : undefined,
    tasks: tasksSnapshot ? tasks : undefined,
  });

  return xlsxFile(buffer, sprintFilename(sprintNumber, teamOnly));
}

export async function exportSprintMetrics(
  sprintNumber: number,
  teamOnly = true,
): Promise<ExportFile> {
  const snapshot = await getMetricsSnapshot(sprintNumber);
  if (!snapshot) {
    throw new Error(`No metrics snapshot for sprint ${sprintNumber}`);
  }

  let rows = snapshot.metrics;
  if (teamOnly) {
    rows = filterMetricsByMembers(rows, await getActiveMemberNames());
  }

  const buffer = await buildSprintMetricsWorkbook(sprintNumber, rows);
  return xlsxFile(buffer, sprintMetricsFilename(sprintNumber, teamOnly));
}

export async function exportSprintTasks(
  sprintNumber: number,
  teamOnly = true,
): Promise<ExportFile> {
  const snapshot = await getSnapshot(sprintNumber);
  if (!snapshot) {
    throw new Error(`No task snapshot for sprint ${sprintNumber}`);
  }

  let tasks = snapshot.tasks;
  if (teamOnly) {
    tasks = filterTasksByMembers(tasks, await getActiveMemberNames());
  }

  const buffer = await buildSprintTasksWorkbook(sprintNumber, tasks);
  return xlsxFile(buffer, sprintTasksFilename(sprintNumber, teamOnly));
}

export async function exportSprintTasksCompare(
  sprintNumbers: number[],
  teamOnly = true,
): Promise<ExportFile> {
  const unique = [...new Set(sprintNumbers)].sort((a, b) => b - a);
  const memberNames = await getActiveMemberNames();
  const sprints: { sprintNumber: number; tasks: MappedIssue[] }[] = [];
  const missing: number[] = [];

  for (const sprintNumber of unique) {
    const snapshot = await getSnapshot(sprintNumber);
    if (!snapshot) {
      missing.push(sprintNumber);
      continue;
    }

    let tasks = snapshot.tasks;
    if (teamOnly) {
      tasks = filterTasksByMembers(tasks, memberNames);
    }

    sprints.push({ sprintNumber, tasks });
  }

  if (missing.length > 0) {
    throw new Error(`Missing task snapshots for sprints: ${missing.join(", ")}`);
  }

  const buffer = await buildSprintTasksCompareWorkbook(sprints);
  return xlsxFile(buffer, sprintTasksCompareFilename(unique, teamOnly));
}

function buildEpicRows(
  epics: Awaited<ReturnType<ReturnType<typeof createJiraClientFromEnv>["getEpicsWithStatusTimes"]>>,
): EpicStatusRow[] {
  return epics.map((epic) => ({
    key: epic.key,
    url: epic.url,
    summary: epic.summary,
    statusDurations: computeStatusDurations({
      created: epic.created,
      currentStatus: epic.status,
      statusChanges: extractStatusChanges(epic.changelog),
      endAt: epic.resolutiondate ? new Date(epic.resolutiondate) : new Date(),
    }),
  }));
}

export async function exportTasksStatus(): Promise<ExportFile & { epicsCsv?: string }> {
  const config = await getTeamConfig();
  const client = createJiraClientFromEnv();
  const assignees = await resolveAssigneesForJql();
  const memberRefs = buildAltenMemberRefs(await listMembers({ activeOnly: true }), assignees);

  const jql = buildJql(config.project, assignees);
  const sprintJql = buildSprintJql(config.project, assignees);
  const epicsJql = buildEpicsJql(config.project, {
    summaryContains: config.epicsSummaryContains,
  });

  const [teamIssues, sprintIssues, epics] = await Promise.all([
    client.getIssuesWithChangelog(jql),
    client.getIssuesWithChangelog(sprintJql),
    client.getEpicsWithStatusTimes(epicsJql),
  ]);

  const tasks = teamIssues.map(({ issue, raw }) =>
    mapIssueWithAltenAssignees(raw, issue.changelog, memberRefs, client.baseUrl),
  );
  const sprintTasks = sprintIssues.map(({ issue, raw }) =>
    mapIssueWithAltenAssignees(raw, issue.changelog, memberRefs, client.baseUrl),
  );

  const epicRows = buildEpicRows(epics);
  const { workbook, epicsCsv } = await buildTasksStatusWorkbook({
    tasks,
    sprintTasks,
    epicRows,
  });

  return {
    ...xlsxFile(workbook, tasksStatusFilename()),
    epicsCsv,
  };
}

export { parseTeamOnly };
