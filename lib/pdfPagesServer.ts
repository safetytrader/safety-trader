// @ts-nocheck
/** Estrazione testo PDF pagina-per-pagina lato server (Node / Vercel). */

import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

export type PdfPageEntry = { page: number; text: string };

const MAX_PAGES = 320;
function toUint8Array(input: Buffer | Uint8Array | ArrayBuffer): Uint8Array {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (input instanceof Uint8Array && !Buffer.isBuffer(input)) {
    return input;
  }
  if (Buffer.isBuffer(input)) {
    return Uint8Array.from(input);
  }
  return new Uint8Array(input);
}

function getStandardFontDataUrl() {
  try {
    const nodeRequire = getNodeRequire();
    const distPath = path.dirname(nodeRequire.resolve("pdfjs-dist/package.json"));
    return pathToFileURL(path.join(distPath, "standard_fonts/")).href;
  } catch (err) {
    console.warn("[POS refs] standard_fonts path not resolved", err?.message);
    return undefined;
  }
}

function getNodeRequire() {
  try {
    return createRequire(import.meta.url);
  } catch {
    return createRequire(path.join(process.cwd(), "package.json"));
  }
}

async function loadPdfJs() {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return await import("pdfjs-dist");
  }
}

async function extractWithPdfJs(uint8: Uint8Array): Promise<PdfPageEntry[]> {
  const pdfjs = await loadPdfJs();
  const getDocument = pdfjs.getDocument || pdfjs.default?.getDocument;
  if (typeof getDocument !== "function") {
    throw new Error("pdfjs getDocument non disponibile");
  }

  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }

  const standardFontDataUrl = getStandardFontDataUrl();

  const loadingTask = getDocument({
    data: uint8,
    useSystemFonts: true,
    standardFontDataUrl,
    disableFontFace: false,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  const numPages = doc.numPages || 0;
  const maxPages = Math.min(numPages, MAX_PAGES);
  const pages: PdfPageEntry[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = pageTextFromContent(content);
    pages.push({ page: pageNum, text });
  }

  if (typeof doc.cleanup === "function") {
    try {
      await doc.cleanup();
    } catch {
      /* ignore */
    }
  }

  return pages;
}

/** Fallback: pdf-parse + separatore form-feed tra pagine. */
async function extractWithPdfParse(uint8: Uint8Array): Promise<PdfPageEntry[]> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(Buffer.from(uint8));
  const fullText = String(result?.text || "").replace(/\r\n/g, "\n");

  const chunks = fullText.split(/\f/g).map(s => s.trim()).filter(Boolean);

  if (chunks.length > 1) {
    return chunks.slice(0, MAX_PAGES).map((text, index) => ({
      page: index + 1,
      text: text.replace(/\s+/g, " ").trim(),
    }));
  }

  if (fullText.trim()) {
    return [{ page: 1, text: fullText.replace(/\s+/g, " ").trim() }];
  }

  throw new Error("pdf-parse: testo vuoto");
}

function pageTextFromContent(content) {
  const items = content?.items || [];
  const parts = [];

  for (const item of items) {
    if (item && typeof item.str === "string" && item.str.trim()) {
      parts.push(item.str);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Estrae testo per ogni pagina dal PDF (buffer / Uint8Array / ArrayBuffer).
 * @throws Error se l'estrazione tecnica fallisce
 */
export async function extractPdfPagesFromBuffer(
  bufferOrUint8Array: Buffer | Uint8Array | ArrayBuffer
): Promise<PdfPageEntry[]> {
  const uint8 = toUint8Array(bufferOrUint8Array);
  if (!uint8.length) {
    throw new Error("PDF vuoto o buffer non valido");
  }

  console.log("[POS refs] extractPdfPages start");

  try {
    const pages = await extractWithPdfJs(uint8);
    console.log("[POS refs] extract engine", "pdfjs");
    return pages;
  } catch (pdfjsErr) {
    console.error("[POS refs] PDF text extraction failed (pdfjs)", pdfjsErr);
    try {
      const pages = await extractWithPdfParse(uint8);
      console.log("[POS refs] extract engine", "pdf-parse-fallback");
      return pages;
    } catch (parseErr) {
      console.error("[POS refs] extraction error", parseErr);
      const msg =
        parseErr?.message || pdfjsErr?.message || "estrazione non riuscita";
      throw new Error(`Errore estrazione testo PDF: ${msg}`);
    }
  }
}

/** Alias per compatibilità. */
export async function extractPdfPages(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<PdfPageEntry[]> {
  return extractPdfPagesFromBuffer(buffer);
}
