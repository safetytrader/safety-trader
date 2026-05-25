import { MAX_PDF_PAGES_CLIENT } from "@/lib/analyzePayloadLimits";

function isPdfFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

export type PdfPageText = { page: number; text: string };

/** Estrae testo per pagina da PDF nel browser. */
export async function extractPdfPagesFromFile(file: File): Promise<PdfPageText[]> {
  if (!isPdfFile(file)) return [];

  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const maxPages = Math.min(doc.numPages, MAX_PDF_PAGES_CLIENT);
  const pages: PdfPageText[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map(item => ("str" in item ? String(item.str) : ""))
      .join(" ");
    if (line.trim()) {
      pages.push({ page: pageNum, text: line.trim() });
    }
  }

  return pages;
}

/** Estrae testo da PDF nel browser (pdfjs-dist) con marcatori pagina. */
export async function extractPdfTextFromFile(file: File): Promise<string> {
  const pages = await extractPdfPagesFromFile(file);
  if (!pages.length) return "";
  return pages.map(p => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n");
}
