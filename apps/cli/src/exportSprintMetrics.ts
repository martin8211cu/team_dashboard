import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSprintMetricsWorkbook } from "@team-dashboard/export";
import {
  buildAltenMemberRefs,
  buildMetricsRow,
  buildSprintJqlByNumber,
  resolveAgileMetrics,
} from "@team-dashboard/shared";
import { CLI_ROOT, createClientFromEnv, getTeamConfig } from "./lib/env";
import { getActiveMembersFromDb } from "./lib/membersDb";

const USAGE = `Usage: bun run export:sprint -- <sprintNumber> [all] [--all] [--output path]

Examples:
  bun run export:sprint -- 74
  bun run export:sprint -- 74 --all
`;

function parseArgs(argv: string[]) {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const sprintNumber = positional[0];

  if (!sprintNumber || !/^\d+$/.test(sprintNumber)) {
    console.error(USAGE);
    throw new Error("Sprint number is required (e.g. 74)");
  }

  const includeAll =
    argv.includes("--all") || positional.slice(1).some((arg) => arg.toLowerCase() === "all");
  const outputIndex = argv.indexOf("--output");
  const today = new Date().toISOString().slice(0, 10);
  const suffix = includeAll ? "-all" : "";
  const defaultOutput = join(
    CLI_ROOT,
    "output",
    `sprint-${sprintNumber}-metrics${suffix}-${today}.xlsx`,
  );
  const outputPath =
    outputIndex !== -1 && argv[outputIndex + 1] ? argv[outputIndex + 1] : defaultOutput;

  return { sprintNumber, outputPath, includeAll };
}

async function main() {
  const args = process.argv.slice(2);
  const { sprintNumber, outputPath, includeAll } = parseArgs(args);
  const config = await getTeamConfig();
  const memberRefs = buildAltenMemberRefs(await getActiveMembersFromDb());
  const agileMetrics = resolveAgileMetrics(config);
  const client = createClientFromEnv();
  const jql = buildSprintJqlByNumber(
    config.project,
    config.members.map((name) => ({ name })),
    sprintNumber,
    { allTickets: includeAll },
  );

  console.log(`Fetching sprint ${sprintNumber} from ${process.env.JIRA_BASE_URL}...`);
  console.log(`Scope: ${includeAll ? "all sprint tickets" : "team assignees only"}`);

  const sprintContext = await client.getSprintMetadata(config.project, sprintNumber, {
    boardId: config.boardId,
  });

  const issues = await client.getIssuesWithChangelog(jql, {
    onSearchComplete: (count) => console.log(`Jira search returned ${count} issues`),
    onProgress: (done, total) => {
      process.stdout.write(`\rFetching changelog (${done}/${total})...`);
    },
  });
  process.stdout.write("\n");

  const rows = issues.map(({ issue }) =>
    buildMetricsRow(issue, agileMetrics, memberRefs, sprintContext),
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = await buildSprintMetricsWorkbook(Number(sprintNumber), rows);
  await Bun.write(outputPath, buffer);
  console.log(`Exported ${rows.length} issues to ${outputPath}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
