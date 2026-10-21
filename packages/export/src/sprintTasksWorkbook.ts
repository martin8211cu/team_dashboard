import ExcelJS from "exceljs";
import type { MappedIssue } from "@team-dashboard/shared";
import { applySheetChrome, applyStatusColor, setHyperlinkKey, styleHeaderRow } from "./excelStyle";

export const TASK_COLUMNS = [
  { header: "Key", key: "key", width: 14 },
  { header: "Summary", key: "summary", width: 50 },
  { header: "Type", key: "type", width: 14 },
  { header: "Status", key: "status", width: 18 },
  { header: "Assignee", key: "assignee", width: 28 },
  { header: "ALTEN assignees", key: "altenAssignees", width: 40 },
  { header: "Epic / Parent", key: "parent", width: 40 },
  { header: "Priority", key: "priority", width: 12 },
  { header: "Story Points", key: "storyPoints", width: 14 },
  { header: "Original Estimate (h)", key: "originalEstimateHours", width: 20 },
  { header: "Time Spent (h)", key: "timeSpentHours", width: 16 },
  { header: "Time Remaining (h)", key: "timeRemainingHours", width: 18 },
  { header: "Updated", key: "updated", width: 22 },
  { header: "Sprint", key: "sprint", width: 24 },
] as const;

export function addTasksSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  tasks: MappedIssue[],
): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = TASK_COLUMNS.map((column) => ({ ...column }));
  styleHeaderRow(sheet);

  for (const task of tasks) {
    const row = sheet.addRow(task);
    setHyperlinkKey(row.getCell("key"), task.key, task.url);
    applyStatusColor(row, task.status);
  }

  applySheetChrome(sheet, TASK_COLUMNS.length);
}

export async function buildSprintTasksWorkbook(
  sprintNumber: number,
  tasks: MappedIssue[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Dashboard Export";
  workbook.created = new Date();
  addTasksSheet(workbook, `Sprint ${sprintNumber}`, tasks);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildSprintTasksCompareWorkbook(
  sprints: { sprintNumber: number; tasks: MappedIssue[] }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Dashboard Export";
  workbook.created = new Date();

  for (const sprint of sprints) {
    addTasksSheet(workbook, `Sprint ${sprint.sprintNumber}`, sprint.tasks);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
