import ExcelJS from "exceljs";
import {
  buildStatusColumnOrder,
  DEFAULT_STATUS_COLUMNS,
  parseAltenAssignees,
  type EpicStatusRow,
  type MappedIssue,
} from "@team-dashboard/shared";
import { applySheetChrome, setHyperlinkKey, styleHeaderRow } from "./excelStyle";
import { addTasksSheet } from "./sprintTasksWorkbook";

function buildSummaryRows(tasks: MappedIssue[]) {
  const byAssignee = new Map<
    string,
    {
      assignee: string;
      totalTasks: number;
      totalTimeRemainingHours: number;
      statusCounts: Map<string, number>;
    }
  >();

  for (const task of tasks) {
    const members = parseAltenAssignees(task.altenAssignees);
    if (members.length === 0) {
      continue;
    }

    for (const assignee of members) {
      if (!byAssignee.has(assignee)) {
        byAssignee.set(assignee, {
          assignee,
          totalTasks: 0,
          totalTimeRemainingHours: 0,
          statusCounts: new Map(),
        });
      }

      const entry = byAssignee.get(assignee)!;
      entry.totalTasks += 1;
      entry.totalTimeRemainingHours += task.timeRemainingHours ?? 0;
      entry.statusCounts.set(task.status, (entry.statusCounts.get(task.status) ?? 0) + 1);
    }
  }

  return [...byAssignee.values()]
    .sort((a, b) => a.assignee.localeCompare(b.assignee))
    .map((entry) => ({
      assignee: entry.assignee,
      totalTasks: entry.totalTasks,
      totalTimeRemainingHours: Math.round(entry.totalTimeRemainingHours * 10) / 10,
      statusBreakdown: [...entry.statusCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `${status}: ${count}`)
        .join(", "),
    }));
}

function addEpicsSheet(workbook: ExcelJS.Workbook, epicRows: EpicStatusRow[], statusColumns: string[]) {
  const sheet = workbook.addWorksheet("Epics - time in status");
  const columns = [
    { header: "Epic", key: "epic", width: 14 },
    { header: "Title", key: "title", width: 60 },
    ...statusColumns.map((status) => ({
      header: status,
      key: status,
      width: Math.max(14, status.length + 2),
    })),
  ];

  sheet.columns = columns;
  styleHeaderRow(sheet);

  for (const row of epicRows) {
    const values: Record<string, string | number> = { epic: row.key, title: row.summary };
    for (const status of statusColumns) {
      values[status] = row.statusDurations.get(status) ?? "";
    }

    const excelRow = sheet.addRow(values);
    setHyperlinkKey(excelRow.getCell("epic"), row.key, row.url);
  }

  applySheetChrome(sheet, columns.length);
}

export function buildEpicsCsv(epicRows: EpicStatusRow[], statusColumns: string[]): string {
  const escapeCsv = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = ["Epic", "Title", ...statusColumns];
  const lines = [header.join(",")];

  for (const row of epicRows) {
    const values = [
      row.key,
      row.summary,
      ...statusColumns.map((status) => {
        const duration = row.statusDurations.get(status);
        return duration == null ? "" : duration.toFixed(2);
      }),
    ];
    lines.push(values.map(escapeCsv).join(","));
  }

  return `${lines.join("\n")}\n`;
}

export type TasksStatusExportResult = {
  workbook: Buffer;
  epicsCsv?: string;
};

export async function buildTasksStatusWorkbook(input: {
  tasks: MappedIssue[];
  sprintTasks: MappedIssue[];
  epicRows: EpicStatusRow[];
}): Promise<TasksStatusExportResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Dashboard Export";
  workbook.created = new Date();

  addTasksSheet(workbook, "Tasks", input.tasks);
  addTasksSheet(workbook, "Sprint actual", input.sprintTasks);

  let epicsCsv: string | undefined;
  if (input.epicRows.length > 0) {
    const statusColumns = buildStatusColumnOrder(input.epicRows, [...DEFAULT_STATUS_COLUMNS]);
    addEpicsSheet(workbook, input.epicRows, statusColumns);
    epicsCsv = buildEpicsCsv(input.epicRows, statusColumns);
  }

  const summarySheet = workbook.addWorksheet("Resumen por persona");
  summarySheet.columns = [
    { header: "Assignee", key: "assignee", width: 28 },
    { header: "# tareas", key: "totalTasks", width: 12 },
    { header: "Time Remaining total (h)", key: "totalTimeRemainingHours", width: 24 },
    { header: "Desglose por status", key: "statusBreakdown", width: 60 },
  ];
  styleHeaderRow(summarySheet);

  for (const row of buildSummaryRows(input.tasks)) {
    summarySheet.addRow(row);
  }

  applySheetChrome(summarySheet, 4);

  return {
    workbook: Buffer.from(await workbook.xlsx.writeBuffer()),
    epicsCsv,
  };
}
