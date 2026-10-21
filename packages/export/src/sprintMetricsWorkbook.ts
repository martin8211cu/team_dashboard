import ExcelJS from "exceljs";
import type { MetricsRow } from "@team-dashboard/shared";
import { applySheetChrome, setHyperlinkKey, styleHeaderRow } from "./excelStyle";

const METRICS_COLUMNS = [
  { header: "Issue Type", key: "issueType", width: 14 },
  { header: "Issue key", key: "issueKey", width: 14 },
  { header: "Issue id", key: "issueId", width: 12 },
  { header: "Summary", key: "summary", width: 50 },
  { header: "Assignee", key: "assignee", width: 28 },
  { header: "ALTEN assignees", key: "altenAssignees", width: 40 },
  { header: "Status", key: "status", width: 18 },
  { header: "Resolution", key: "resolution", width: 14 },
  { header: "Created", key: "created", width: 22 },
  { header: "Updated", key: "updated", width: 22 },
  { header: "Sprints", key: "sprints", width: 36 },
  { header: "Active Sprint", key: "activeSprint", width: 18 },
  { header: "Sprint start", key: "sprintStart", width: 22 },
  { header: "Sprint end", key: "sprintEnd", width: 22 },
  { header: "Created in sprint", key: "createdInSprint", width: 16 },
  { header: "First sprint", key: "firstSprint", width: 18 },
  { header: "Added in Active Sprint", key: "addedInActiveSprint", width: 22 },
  { header: "Custom field (Story Points)", key: "storyPoints", width: 22 },
  { header: "Resolved", key: "resolved", width: 22 },
  { header: "Lead time (d)", key: "leadTimeDays", width: 14 },
  { header: "To Do at", key: "cycleStartAt", width: 22 },
  { header: "Cycle time (d)", key: "cycleTimeDays", width: 14 },
  { header: "Blocked time (d)", key: "blockedTimeDays", width: 16 },
  { header: "Refinement (d)", key: "refinementDays", width: 14 },
] as const;

export function addMetricsSheet(workbook: ExcelJS.Workbook, sheetName: string, rows: MetricsRow[]): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = METRICS_COLUMNS.map((column) => ({ ...column }));
  styleHeaderRow(sheet);

  for (const row of rows) {
    const excelRow = sheet.addRow({
      issueType: row.type,
      issueKey: row.key,
      issueId: row.issueId,
      summary: row.summary,
      assignee: row.assignee,
      altenAssignees: row.altenAssignees,
      status: row.status,
      resolution: row.resolution ?? "",
      created: row.created,
      updated: row.updated ?? "",
      sprints: row.sprints,
      activeSprint: row.activeSprint ?? "",
      sprintStart: row.sprintStart ?? "",
      sprintEnd: row.sprintEnd ?? "",
      createdInSprint: row.createdInSprint ?? "",
      firstSprint: row.firstSprint ?? "",
      addedInActiveSprint: row.addedInActiveSprint ?? "",
      storyPoints: row.storyPoints ?? "",
      resolved: row.resolved ?? "",
      leadTimeDays: row.leadTimeDays ?? "",
      cycleStartAt: row.cycleStartAt ?? "",
      cycleTimeDays: row.cycleTimeDays ?? "",
      blockedTimeDays: row.blockedTimeDays ?? "",
      refinementDays: row.refinementDays ?? "",
    });

    setHyperlinkKey(excelRow.getCell("issueKey"), row.key, row.url);
  }

  applySheetChrome(sheet, METRICS_COLUMNS.length);
}

export async function buildSprintMetricsWorkbook(
  sprintNumber: number,
  rows: MetricsRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Team Dashboard Sprint Metrics";
  workbook.created = new Date();
  addMetricsSheet(workbook, `Sprint ${sprintNumber}`, rows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
