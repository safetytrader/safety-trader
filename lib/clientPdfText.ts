import { MAX_PDF_PAGES_CLIENT } from "@/lib/analyzePayloadLimits";

function isPdfFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

/** Estrae testo da PDF nel browser (pdfjs-dist). */
export async function extractPdfTextFromFile(file: File): Promise<string> {
  if (!isPdfFile(file)) return "";

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
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map(item => ("str" in item ? String(item.str) : ""))
      .join(" ");
    if (line.trim()) {
      parts.push(`--- PAGINA ${pageNum} ---\n${line.trim()}`);
    }
  }

  return parts.join("\n\n");
}
