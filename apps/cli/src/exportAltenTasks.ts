import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildTasksStatusWorkbook, tasksStatusFilename } from "@team-dashboard/export";
import {
  buildAltenMemberRefs,
  buildEpicsJql,
  buildJql,
  buildSprintJql,
  computeStatusDurations,
  extractStatusChanges,
  mapIssueWithAltenAssignees,
  type EpicStatusRow,
  type MappedIssue,
} from "@team-dashboard/shared";
import { CLI_ROOT, createClientFromEnv, getTeamConfig } from "./lib/env";
import { getActiveMembersFromDb } from "./lib/membersDb";

function parseArgs(argv: string[]) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex !== -1 && argv[outputIndex + 1]) {
    return { outputPath: argv[outputIndex + 1], useMock: argv.includes("--mock") };
  }

  return {
    outputPath: join(CLI_ROOT, "output", tasksStatusFilename()),
    useMock: argv.includes("--mock"),
  };
}

function buildEpicRows(
  epics: Awaited<ReturnType<ReturnType<typeof createClientFromEnv>["getEpicsWithStatusTimes"]>>,
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

function mockTasks(): MappedIssue[] {
  return [
    {
      key: "DEMO-101",
      url: "https://example.atlassian.net/browse/DEMO-101",
      summary: "Settings modal is missing a Save button",
      type: "Sub-task",
      status: "Waiting Feedback",
      assignee: "Alex Rivera",
      parent: "DEMO-90: Settings enhancements",
      priority: "High",
      storyPoints: null,
      originalEstimateHours: null,
      timeSpentHours: null,
      timeRemainingHours: 4,
      updated: "2026-07-24T15:21:22.780-0400",
      created: "2026-06-01T12:00:00.000-0400",
      resolutiondate: null,
      sprint: null,
      altenAssignees: "Alex Rivera",
    },
    {
      key: "DEMO-102",
      url: "https://example.atlassian.net/browse/DEMO-102",
      summary: "[Bug] Dropdown options are clipped on small screens",
      type: "Sub-task",
      status: "Ready for Test",
      assignee: "Sam Chen",
      parent: "DEMO-80: Platform use case",
      priority: "High",
      storyPoints: 3,
      originalEstimateHours: 8,
      timeSpentHours: 6.5,
      timeRemainingHours: 1.5,
      updated: "2026-06-18T03:15:02.965-0400",
      created: "2026-06-01T12:00:00.000-0400",
      resolutiondate: null,
      sprint: "DEMO Sprint 12",
      altenAssignees: "Sam Chen",
    },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const { outputPath, useMock } = parseArgs(args);
  const config = await getTeamConfig();

  let tasks: MappedIssue[];
  let sprintTasks: MappedIssue[];
  let epicRows: EpicStatusRow[];

  if (useMock) {
    tasks = mockTasks();
    sprintTasks = mockTasks().filter((task) => task.sprint);
    epicRows = [];
    console.log("Using mock data (--mock)");
  } else {
    const client = createClientFromEnv();
    const assignees = config.members.map((name) => ({ name }));
    const jql = buildJql(config.project, assignees);
    const sprintJql = buildSprintJql(config.project, assignees);
    const epicsJql = buildEpicsJql(config.project, {
      summaryContains: config.epicsSummaryContains,
    });

    console.log(`Fetching issues from ${process.env.JIRA_BASE_URL}...`);
    const teamIssues = await client.getIssuesWithChangelog(jql, {
      onSearchComplete: (count) => console.log(`Team issues: ${count}`),
      onProgress: (done, total) => {
        process.stdout.write(`\rTeam changelog (${done}/${total})...`);
      },
    });
    process.stdout.write("\n");

    const sprintIssues = await client.getIssuesWithChangelog(sprintJql, {
      onSearchComplete: (count) => console.log(`Sprint issues: ${count}`),
      onProgress: (done, total) => {
        process.stdout.write(`\rSprint changelog (${done}/${total})...`);
      },
    });
    process.stdout.write("\n");

    const memberRefs = buildAltenMemberRefs(await getActiveMembersFromDb());

    tasks = teamIssues.map(({ issue, raw }) =>
      mapIssueWithAltenAssignees(raw, issue.changelog, memberRefs, client.baseUrl),
    );
    sprintTasks = sprintIssues.map(({ issue, raw }) =>
      mapIssueWithAltenAssignees(raw, issue.changelog, memberRefs, client.baseUrl),
    );

    console.log("Fetching epics and changelog for time-in-status...");
    const epics = await client.getEpicsWithStatusTimes(epicsJql);
    epicRows = buildEpicRows(epics);
    console.log(`Epics loaded: ${epicRows.length}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const { workbook, epicsCsv } = await buildTasksStatusWorkbook({ tasks, sprintTasks, epicRows });
  await Bun.write(outputPath, workbook);

  if (epicsCsv) {
    writeFileSync(join(dirname(outputPath), "epics-time-in-status.csv"), epicsCsv, "utf8");
  }

  console.log(
    `Exported ${tasks.length} tasks, ${sprintTasks.length} sprint tasks, ${epicRows.length} epics to ${outputPath}`,
  );
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
