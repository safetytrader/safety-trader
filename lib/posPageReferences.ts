import {
  buildCheckRefsFromEvidence,
  parsePosReferencesJsonResponse,
} from "@/lib/documentAnalysis";
import { documentTextHasPageMarkers } from "@/lib/documentTextUtils";
import {
  analyzePosPageReferencesTextWithOpenAI,
  analyzePosPageReferencesWithOpenAI,
} from "@/lib/openAiAnalyze";

export const POS_REFS_NO_PAGE_INFO_WARNING =
  "Riferimenti pagina non disponibili perché il testo estratto non contiene informazioni di pagina.";

export const POS_REFS_FAILED_WARNING =
  "Checklist aggiornata. Riferimenti pagina non rilevati.";

export type PosPageReferencesResult = {
  checkRefs: Record<string, string>;
  warnings: string[];
  referencesFound: number;
  failed: boolean;
};

export async function extractPosPageReferences(options: {
  fileName: string;
  mimeType: string;
  buffer: Buffer | null;
  documentText?: string;
}): Promise<PosPageReferencesResult> {
  const warnings: string[] = [];
  const fileName = options.fileName || "documento.pdf";
  const mimeType = options.mimeType || "application/pdf";
  const buffer = options.buffer;
  const documentText = String(options.documentText || "");

  const canUseFile = Boolean(buffer?.length);

  try {
    console.time("[AI] pos-references");

    if (canUseFile) {
      const raw = await analyzePosPageReferencesWithOpenAI({
        base64: buffer!.toString("base64"),
        mimeType,
        fileName,
      });
      const parsed = parsePosReferencesJsonResponse(raw);
      const checkRefs = buildCheckRefsFromEvidence(parsed.checklist_evidence);
      const count = Object.keys(checkRefs).length;
      console.log("[AI] pos references found", count);
      return {
        checkRefs,
        warnings: [...warnings, ...(parsed.warnings || [])],
        referencesFound: count,
        failed: false,
      };
    }

    if (documentTextHasPageMarkers(documentText)) {
      const raw = await analyzePosPageReferencesTextWithOpenAI({
        fileName,
        documentText,
      });
      const parsed = parsePosReferencesJsonResponse(raw);
      const checkRefs = buildCheckRefsFromEvidence(parsed.checklist_evidence);
      const count = Object.keys(checkRefs).length;
      console.log("[AI] pos references found", count);
      return {
        checkRefs,
        warnings: [...warnings, ...(parsed.warnings || [])],
        referencesFound: count,
        failed: false,
      };
    }

    warnings.push(POS_REFS_NO_PAGE_INFO_WARNING);
    console.log("[AI] pos references found", 0);
    return { checkRefs: {}, warnings, referencesFound: 0, failed: false };
  } catch (err) {
    console.warn("[AI] pos-references failed", err);
    warnings.push(POS_REFS_FAILED_WARNING);
    console.log("[AI] pos references found", 0);
    return { checkRefs: {}, warnings, referencesFound: 0, failed: true };
  } finally {
    console.timeEnd("[AI] pos-references");
  }
}
