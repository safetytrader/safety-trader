import {
  DIRECT_FILE_TOO_LARGE_MSG,
  LARGE_OR_NON_TEXTUAL_MSG,
  MAX_DIRECT_FILE_BYTES,
  MAX_EXTRACTED_TEXT_CHARS,
  MIN_CLIENT_TEXT_CHARS,
} from "@/lib/analyzePayloadLimits";
import { extractPdfTextFromFile } from "@/lib/clientPdfText";
import { cleanDocumentText, isTextSufficient } from "@/lib/documentTextUtils";

export type AnalyzeRequestPayload =
  | {
      mode: "JSON_TEXT";
      headers: Record<string, string>;
      body: string;
    }
  | {
      mode: "FILE_SMALL";
      headers: Record<string, string>;
      body: FormData;
    };

function isPdf(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

function isImage(file: File) {
  return String(file.type || "").startsWith("image/");
}

function buildFormBody(
  file: File,
  ids: { impresaId: string; cantiereId: string; impresaNome: string }
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("impresaId", ids.impresaId);
  formData.append("cantiereId", ids.cantiereId);
  formData.append("impresaNome", ids.impresaNome);
  return formData;
}

/**
 * Sceglie POST JSON (solo testo) o POST multipart (file piccolo).
 * Evita invio di PDF grandi alla route Vercel.
 */
export async function prepareAnalyzeRequest(
  file: File,
  ids: { impresaId: string; cantiereId: string; impresaNome: string },
  authHeaders: Record<string, string> = {}
): Promise<AnalyzeRequestPayload> {
  if (!file) {
    throw new Error("File mancante.");
  }

  if (isPdf(file)) {
    let rawText = "";
    try {
      rawText = await extractPdfTextFromFile(file);
    } catch (err) {
      console.warn("prepareAnalyzeRequest: estrazione PDF client fallita", err);
    }

    const extractedText = cleanDocumentText(rawText, MAX_EXTRACTED_TEXT_CHARS);
    if (isTextSufficient(extractedText, MIN_CLIENT_TEXT_CHARS)) {
      return {
        mode: "JSON_TEXT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          impresaId: ids.impresaId,
          cantiereId: ids.cantiereId,
          impresaNome: ids.impresaNome,
          fileName: file.name || "documento.pdf",
          fileType: file.type || "application/pdf",
          fileSize: file.size,
          extractedText,
        }),
      };
    }

    if (file.size > MAX_DIRECT_FILE_BYTES) {
      throw new Error(LARGE_OR_NON_TEXTUAL_MSG);
    }

    return {
      mode: "FILE_SMALL",
      headers: { ...authHeaders },
      body: buildFormBody(file, ids),
    };
  }

  if (isImage(file)) {
    if (file.size > MAX_DIRECT_FILE_BYTES) {
      throw new Error(DIRECT_FILE_TOO_LARGE_MSG);
    }
    return {
      mode: "FILE_SMALL",
      headers: { ...authHeaders },
      body: buildFormBody(file, ids),
    };
  }

  throw new Error("Seleziona un file PDF o un'immagine.");
}
