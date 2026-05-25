// @ts-nocheck
/** Estrazione PDF lato server (pdf-parse). Le altre utilità sono in documentTextUtils. */

export {
  MIN_USEFUL_TEXT_CHARS,
  MAX_AI_TEXT_CHARS,
  isTextSufficient,
  cleanDocumentText,
  buildDocumentHints,
  isPdfMimeOrName,
  isImageMime,
} from "@/lib/documentTextUtils";

/** Estrae testo da PDF (buffer). Restituisce stringa vuota se non disponibile. */
export async function extractPdfText(buffer) {
  if (!buffer?.length) return "";

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return String(result?.text || "");
  } catch (err) {
    console.warn("pdf-text-extraction: estrazione fallita", err?.message || err);
    return "";
  }
}
