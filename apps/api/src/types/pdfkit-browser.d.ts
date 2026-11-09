declare module "*pdfkit.browser.mjs" {
  import type PDFKit from "pdfkit";

  export function registerStdFonts(
    ...fonts: Array<Record<string, unknown>>
  ): void;

  const PDFDocument: typeof PDFKit;
  export default PDFDocument;
  export { PDFDocument };
}

declare module "pdfkit/standard-fonts/*" {
  const font: Record<string, unknown>;
  export default font;
}
