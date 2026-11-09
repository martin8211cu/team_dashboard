import PDFDocument from "pdfkit";

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^>\s?/, "")
    .trim();
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return [];
  }
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((cell) => stripInlineMarkdown(cell));
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function drawMarkdownTableFallback(doc: PdfDoc, rows: string[][]): void {
  doc.moveDown(0.2);
  for (const [rowIndex, row] of rows.entries()) {
    const line = row.map((cell) => cell.trim()).filter(Boolean).join(" · ");
    if (!line) {
      continue;
    }
    doc
      .font(rowIndex === 0 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor("#000000")
      .text(line, { paragraphGap: 2 });
  }
  doc.moveDown(0.35);
}

function drawMarkdownTable(doc: PdfDoc, rows: string[][]): void {
  if (rows.length === 0) {
    return;
  }

  const colCount = Math.max(...rows.map((row) => row.length));
  if (colCount === 0) {
    return;
  }

  const normalized = rows.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) {
      cells.push("");
    }
    return cells.slice(0, colCount);
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const wide = colCount >= 7;
  const fontSize = wide ? 7 : 9;
  const padding = wide ? 3 : 6;
  // Keep the first column (usually names) readable on dense score tables.
  const firstColWidth = wide ? Math.min(120, Math.floor(pageWidth * 0.22)) : null;
  const columnStyles = Array.from({ length: colCount }, (_, index) =>
    index === 0 && firstColWidth != null ? { width: firstColWidth } : "*",
  );

  const data = normalized.map((row, rowIndex) =>
    row.map((text) => ({
      text,
      font: {
        src: rowIndex === 0 ? "Helvetica-Bold" : "Helvetica",
        size: fontSize,
      },
      type: rowIndex === 0 ? ("TH" as const) : ("TD" as const),
    })),
  );

  doc.moveDown(0.2);
  try {
    doc.table({
      maxWidth: pageWidth,
      columnStyles,
      defaultStyle: {
        border: true,
        borderColor: "#cbd5e1",
        padding,
        align: { x: "left", y: "center" },
      },
      rowStyles: (rowIndex: number) =>
        rowIndex === 0
          ? { backgroundColor: "#f1f5f9" }
          : { backgroundColor: rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff" },
      data,
    });
    doc.moveDown(0.35);
  } catch {
    // PDFKit table can throw on extreme layouts; keep report downloadable.
    drawMarkdownTableFallback(doc, normalized);
  }
}

/** Render markdown-ish text to a PDF buffer with real tables for pipe syntax. */
export async function markdownToPdfBuffer(markdown: string, title?: string): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: title ? { Title: title } : undefined,
  });

  const chunks: Uint8Array[] = [];
  doc.on("data", (chunk: Uint8Array) => {
    chunks.push(chunk);
  });

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inCode = false;
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.replace(/\t/g, "  ");

    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      i += 1;
      continue;
    }

    if (inCode) {
      doc.font("Courier").fontSize(9).text(line, { paragraphGap: 2 });
      i += 1;
      continue;
    }

    // Collect consecutive markdown table rows
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow((lines[i] ?? "").replace(/\t/g, "  "))) {
        tableLines.push((lines[i] ?? "").replace(/\t/g, "  "));
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !isTableSeparator(row))
        .map((row) => splitTableRow(row))
        .filter((row) => row.length > 0);
      drawMarkdownTable(doc, rows);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      doc.moveDown(0.4);
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(16).text(stripInlineMarkdown(line.slice(2)), {
        paragraphGap: 8,
      });
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      doc.moveDown(0.35);
      doc.font("Helvetica-Bold").fontSize(12).text(stripInlineMarkdown(line.slice(3)), {
        paragraphGap: 6,
      });
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      doc.moveDown(0.25);
      doc.font("Helvetica-Bold").fontSize(11).text(stripInlineMarkdown(line.slice(4)), {
        paragraphGap: 4,
      });
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      doc.moveDown(0.35);
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line.trim())) {
      const bullet = stripInlineMarkdown(line.trim().replace(/^[-*•]\s+/, ""));
      doc.font("Helvetica").fontSize(10).text(`• ${bullet}`, {
        paragraphGap: 2,
        indent: 8,
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line.trim())) {
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#475569").text(stripInlineMarkdown(line), {
        paragraphGap: 4,
        indent: 10,
      });
      doc.fillColor("#000000");
      i += 1;
      continue;
    }

    doc.font("Helvetica").fontSize(10).fillColor("#000000").text(stripInlineMarkdown(line), {
      paragraphGap: 4,
      align: "left",
    });
    i += 1;
  }

  doc.end();
  return done;
}
