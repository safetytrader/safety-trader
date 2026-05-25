// @ts-nocheck
/** Estrazione testo PDF pagina-per-pagina lato server (Node / Vercel). */

export type PdfPageEntry = { page: number; text: string };

const MAX_PAGES = 120;

export async function extractPdfPages(buffer: Buffer | Uint8Array): Promise<PdfPageEntry[]> {
  if (!buffer?.length) return [];

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const maxPages = Math.min(doc.numPages, MAX_PAGES);
  const pages: PdfPageEntry[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({ page: pageNum, text });
  }

  return pages;
}
