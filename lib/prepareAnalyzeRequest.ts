import { MAX_DIRECT_FILE_BYTES, MAX_EXTRACTED_TEXT_CHARS, MIN_CLIENT_TEXT_CHARS } from "@/lib/analyzePayloadLimits";
import { extractPdfPagesFromFile, extractPdfTextFromFile } from "@/lib/clientPdfText";
import { cleanDocumentText, isTextSufficient } from "@/lib/documentTextUtils";

export type AnalyzePlan =
  | {
      mode: "JSON_TEXT";
      body: Record<string, unknown>;
    }
  | {
      mode: "TEMP_STORAGE";
    }
  | {
      mode: "FILE_SMALL";
    };

function isPdf(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

function isImage(file: File) {
  return String(file.type || "").startsWith("image/");
}

function baseMeta(file: File, ids: { impresaId: string; cantiereId: string; impresaNome: string }) {
  return {
    impresaId: ids.impresaId,
    cantiereId: ids.cantiereId,
    impresaNome: ids.impresaNome,
    fileName: file.name || "documento.pdf",
    fileType: file.type || "application/pdf",
    fileSize: file.size,
  };
}

/**
 * Sceglie TEXT_FAST (JSON), upload temporaneo ai-temp, o multipart per file piccoli.
 */
export async function planAnalyzeRequest(
  file: File,
  ids: { impresaId: string; cantiereId: string; impresaNome: string }
): Promise<AnalyzePlan> {
  if (!file) {
    throw new Error("File mancante.");
  }

  if (isPdf(file)) {
    let rawText = "";
    let pageTexts: { page: number; text: string }[] = [];
    try {
      pageTexts = await extractPdfPagesFromFile(file);
      rawText = pageTexts.length
        ? pageTexts.map(p => `--- PAGINA ${p.page} ---\n${p.text}`).join("\n\n")
        : await extractPdfTextFromFile(file);
    } catch (err) {
      console.warn("planAnalyzeRequest: estrazione PDF client fallita", err);
    }

    const extractedText = cleanDocumentText(rawText, MAX_EXTRACTED_TEXT_CHARS);
    if (isTextSufficient(extractedText, MIN_CLIENT_TEXT_CHARS)) {
      const body: Record<string, unknown> = {
        ...baseMeta(file, ids),
        extractedText,
      };
      if (pageTexts.length) {
        body.pageTexts = pageTexts.map(p => ({
          page: p.page,
          text: p.text,
        }));
        body.extractedPages = body.pageTexts;
      }
      return {
        mode: "JSON_TEXT",
        body,
      };
    }

    if (file.size <= MAX_DIRECT_FILE_BYTES) {
      return { mode: "FILE_SMALL" };
    }

    return { mode: "TEMP_STORAGE" };
  }

  if (isImage(file)) {
    if (file.size <= MAX_DIRECT_FILE_BYTES) {
      return { mode: "FILE_SMALL" };
    }
    return { mode: "TEMP_STORAGE" };
  }

  throw new Error("Seleziona un file PDF o un'immagine.");
}

export function buildAnalyzeFetchPayload(
  plan: AnalyzePlan,
  file: File,
  ids: { impresaId: string; cantiereId: string; impresaNome: string },
  authHeaders: Record<string, string>,
  temporaryStoragePath?: string
) {
  if (plan.mode === "JSON_TEXT") {
    const body = { ...plan.body };
    if (temporaryStoragePath) {
      body.temporaryStoragePath = temporaryStoragePath;
    }
    return {
      mode: "JSON_TEXT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    };
  }

  if (plan.mode === "TEMP_STORAGE") {
    if (!temporaryStoragePath) {
      throw new Error("Percorso temporaneo mancante.");
    }
    return {
      mode: "TEMP_STORAGE",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        ...baseMeta(file, ids),
        temporaryStoragePath,
      }),
    };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("impresaId", ids.impresaId);
  formData.append("cantiereId", ids.cantiereId);
  formData.append("impresaNome", ids.impresaNome);

  return {
    mode: "FILE_SMALL",
    headers: { ...authHeaders },
    body: formData,
  };
}
