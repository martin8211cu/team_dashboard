/**
 * Production API is `bun build --compile`d into a single binary. The default
 * pdfkit Node entry registers standard fonts via dynamic `#standard-fonts/*`
 * requires that are not present next to the binary, which breaks PDF downloads
 * in Docker (502). The browser build + static font imports are bundled instead.
 *
 * Path is `apps/api/node_modules/pdfkit` (local install or Dockerfile symlink).
 */
import PDFDocument, {
  registerStdFonts,
} from "../../node_modules/pdfkit/js/pdfkit.browser.mjs";
import Courier from "pdfkit/standard-fonts/Courier";
import Helvetica from "pdfkit/standard-fonts/Helvetica";
import HelveticaBold from "pdfkit/standard-fonts/HelveticaBold";
import HelveticaOblique from "pdfkit/standard-fonts/HelveticaOblique";

registerStdFonts(Helvetica, HelveticaBold, HelveticaOblique, Courier);

export default PDFDocument;
export type PdfDoc = InstanceType<typeof PDFDocument>;
