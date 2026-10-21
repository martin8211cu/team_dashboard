import ExcelJS from "exceljs";
import type { MappedIssue, MetricsRow } from "@team-dashboard/shared";
import { addMetricsSheet } from "./sprintMetricsWorkbook";
import { addTasksSheet } from "./sprintTasksWorkbook";

export async function buildSprintCombinedWorkbook(input: {
  sprintNumber: number;
  metrics?: MetricsRow[];
  tasks?: MappedIssue[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Dashboard Export";
  workbook.created = new Date();

  if (input.metrics !== undefined) {
    addMetricsSheet(workbook, `Sprint ${input.sprintNumber}`, input.metrics);
  }

  if (input.tasks !== undefined) {
    addTasksSheet(workbook, "Tareas", input.tasks);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
