/**
 * Extracts raw text from an uploaded CV file (project doc §9 — CV Processing
 * Pipeline: File Validation -> Text Extraction -> Document Parsing).
 * Supported formats: PDF and DOCX. Scanned/image-only documents are flagged
 * rather than guessed at — OCR support is a later phase (project doc §9).
 */

/**
 * Identifies the format from the file's own bytes.
 *
 * Needed because the filename isn't always available or meaningful. On the
 * upload paths we have the real `file.name`, but when re-processing an existing
 * application the only handle is its stored DropAphi URL — and those are
 * extensionless (e.g. https://dropaphi.xyz/api/files/fil_j74x3xk7ezpg), so
 * deriving a name from the URL yields something like "fil_j74x3xk7ezpg" and
 * every extension check fails.
 */
function sniffFormat(buffer: Buffer): "pdf" | "docx" | null {
  // PDFs begin with "%PDF-".
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "pdf";
  }
  // DOCX is an OOXML file in a ZIP container: "PK" followed by a record type.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    return "docx";
  }
  return null;
}

export async function extractCvText(buffer: Buffer, filename: string): Promise<string> {
  const lower = (filename || "").toLowerCase();

  // Trust an explicit extension when there is one, then fall back to the bytes.
  const format = lower.endsWith(".pdf")
    ? "pdf"
    : lower.endsWith(".docx")
      ? "docx"
      : sniffFormat(buffer);

  if (format === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    if (!result.text || result.text.trim().length < 20) {
      throw new Error(
        "This PDF appears to be scanned or image-based. OCR support is planned for a later phase."
      );
    }
    return result.text;
  }

  if (format === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
}
