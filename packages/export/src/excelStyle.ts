import type ExcelJS from "exceljs";

export function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

const STATUS_COLORS: Record<string, string> = {
  "In Development": "FFFCE4CC",
  "Ready for Test": "FFD9EAD3",
  "Waiting Feedback": "FFFCE5CD",
  "Peer Review": "FFEAD1DC",
  "To Do": "FFD9E2F3",
  "In Progress": "FFFFF2CC",
};

export function applyStatusColor(row: ExcelJS.Row, status: string): void {
  const color = STATUS_COLORS[status];
  if (!color) {
    return;
  }

  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  });
}

export function setHyperlinkKey(cell: ExcelJS.Cell, key: string, url: string): void {
  cell.value = { text: key, hyperlink: url };
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
}

export function applySheetChrome(sheet: ExcelJS.Worksheet, columnCount: number): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}
