// @ts-nocheck
import {
  MAX_POS_REF_TEXT_CHARS,
  POS_REF_GROUP_SIZE,
} from "@/lib/analyzePayloadLimits";
import {
  buildCheckRefsFromEvidencePos,
  buildPosReferenceItemGroups,
  getPosChecklistItemsForReferences,
  parsePosReferencesJsonResponse,
} from "@/lib/documentAnalysis";
import { buildPosReferenceDocumentText } from "@/lib/documentTextUtils";
import {
  analyzePosPageReferencesGroupTextWithOpenAI,
  analyzePosPageReferencesGroupWithOpenAI,
} from "@/lib/openAiAnalyze";

export const POS_REFS_NO_PAGE_INFO_WARNING =
  "Riferimenti pagina non disponibili.";

export const POS_REFS_FAILED_WARNING =
  "Checklist aggiornata. Riferimenti pagina non rilevati.";

export const POS_REFS_TEMP_DOWNLOAD_WARNING =
  "Checklist aggiornata. Impossibile scaricare il PDF temporaneo per i riferimenti pagina.";

export type PosReferencesSource = "extracted_pages" | "temp_pdf" | "unavailable";

export type PosPageReferencesResult = {
  checkRefs: Record<string, string>;
  warnings: string[];
  referencesFoundRaw: number;
  referencesFound: number;
  failed: boolean;
  source: PosReferencesSource;
};

type PageTextEntry = { page: number; text: string };

function countRawEvidence(evidence: Record<string, unknown>[] = []) {
  let n = 0;
  for (const entry of evidence || []) {
    if (entry?.found === false) continue;
    if (entry?.checklist_id && entry?.page != null && entry?.excerpt) n += 1;
  }
  return n;
}

function buildGroupLabel(items = [], index = 0) {
  const letters = [...new Set(items.map(i => i.lettera).filter(Boolean))];
  if (letters.length === 1) return `lettera ${letters[0].toUpperCase()}`;
  if (letters.length) return `lettere ${letters.join("/").toUpperCase()}`;
  return `gruppo ${index + 1}`;
}

function resolvePosReferencesSource(
  buffer,
  pageTexts = [],
  hasTemporaryStoragePath = false
) {
  const pages = Array.isArray(pageTexts) ? pageTexts : [];
  const refDocumentText = buildPosReferenceDocumentText({
    pageTexts: pages,
    maxChars: MAX_POS_REF_TEXT_CHARS,
  });

  if (pages.length && refDocumentText) {
    return {
      source: "extracted_pages",
      useFile: false,
      pages: pages.length,
      refDocumentText,
    };
  }

  if (buffer?.length) {
    return {
      source: "temp_pdf",
      useFile: true,
      pages: 0,
      refDocumentText: "",
    };
  }

  if (hasTemporaryStoragePath) {
    return {
      source: "unavailable",
      useFile: false,
      pages: 0,
      refDocumentText: "",
      tempDownloadMissing: true,
    };
  }

  return {
    source: "unavailable",
    useFile: false,
    pages: 0,
    refDocumentText: "",
    tempDownloadMissing: false,
  };
}

export async function extractPosPageReferences(options: {
  fileName: string;
  mimeType: string;
  buffer: Buffer | null;
  pageTexts?: PageTextEntry[];
  hasTemporaryStoragePath?: boolean;
  posChecks?: Record<string, string>;
}): Promise<PosPageReferencesResult> {
  const warnings: string[] = [];
  const fileName = options.fileName || "documento.pdf";
  const mimeType = options.mimeType || "application/pdf";
  const buffer = options.buffer;
  const pageTexts = options.pageTexts || [];
  const hasTemporaryStoragePath = Boolean(options.hasTemporaryStoragePath);

  const items = getPosChecklistItemsForReferences(options.posChecks || {});
  console.log("[AI] POS references checklist items", items.length);

  if (!items.length) {
    console.log("[AI] POS references source", "unavailable");
    console.log("[AI] POS references applied", 0);
    return {
      checkRefs: {},
      warnings,
      referencesFoundRaw: 0,
      referencesFound: 0,
      failed: false,
      source: "unavailable",
    };
  }

  const groups = buildPosReferenceItemGroups(items, POS_REF_GROUP_SIZE);
  console.log("[AI] POS reference groups", groups.length);

  const resolved = resolvePosReferencesSource(
    buffer,
    pageTexts,
    hasTemporaryStoragePath
  );
  console.log("[AI] POS references source", resolved.source);
  console.log("[AI] POS references pages available", resolved.pages);

  if (resolved.source === "unavailable") {
    if (resolved.tempDownloadMissing) {
      warnings.push(POS_REFS_TEMP_DOWNLOAD_WARNING);
      console.log("[AI] POS references warning", POS_REFS_TEMP_DOWNLOAD_WARNING);
    } else {
      warnings.push(POS_REFS_NO_PAGE_INFO_WARNING);
      console.log("[AI] POS references warning", POS_REFS_NO_PAGE_INFO_WARNING);
    }
    console.log("[AI] POS references applied", 0);
    return {
      checkRefs: {},
      warnings,
      referencesFoundRaw: 0,
      referencesFound: 0,
      failed: false,
      source: "unavailable",
    };
  }

  const mergedEvidence: Record<string, unknown>[] = [];
  let failedGroups = 0;

  try {
    console.time("[AI] pos-references");

    for (let i = 0; i < groups.length; i += 1) {
      const groupItems = groups[i];
      const groupLabel = buildGroupLabel(groupItems, i);

      try {
        let raw = "";
        if (resolved.useFile) {
          raw = await analyzePosPageReferencesGroupWithOpenAI({
            base64: buffer.toString("base64"),
            mimeType,
            fileName,
            checklistItems: groupItems,
            groupLabel,
          });
        } else {
          raw = await analyzePosPageReferencesGroupTextWithOpenAI({
            fileName,
            documentText: resolved.refDocumentText,
            checklistItems: groupItems,
            groupLabel,
          });
        }

        const parsed = parsePosReferencesJsonResponse(raw);
        if (parsed.warnings?.length) warnings.push(...parsed.warnings);
        mergedEvidence.push(...(parsed.checklist_evidence || []));
      } catch (groupErr) {
        failedGroups += 1;
        console.warn("[AI] pos-references group failed", groupLabel, groupErr);
      }
    }

    const rawCount = countRawEvidence(mergedEvidence);
    const checkRefs = buildCheckRefsFromEvidencePos(mergedEvidence);
    const appliedCount = Object.keys(checkRefs).length;

    console.log("[AI] POS references found raw", rawCount);
    console.log("[AI] POS references applied", appliedCount);

    if (failedGroups > 0 && appliedCount === 0) {
      warnings.push(POS_REFS_FAILED_WARNING);
      console.log("[AI] POS references warning", POS_REFS_FAILED_WARNING);
      return {
        checkRefs: {},
        warnings,
        referencesFoundRaw: rawCount,
        referencesFound: 0,
        failed: true,
        source: resolved.source,
      };
    }

    if (failedGroups > 0 && appliedCount > 0) {
      const partial = `Riferimenti pagina parziali: ${appliedCount} voci su ${items.length}.`;
      warnings.push(partial);
      console.log("[AI] POS references warning", partial);
    }

    return {
      checkRefs,
      warnings,
      referencesFoundRaw: rawCount,
      referencesFound: appliedCount,
      failed: false,
      source: resolved.source,
    };
  } catch (err) {
    console.warn("[AI] pos-references failed", err);
    warnings.push(POS_REFS_FAILED_WARNING);
    console.log("[AI] POS references applied", 0);
    console.log("[AI] POS references warning", String(err?.message || POS_REFS_FAILED_WARNING));
    return {
      checkRefs: {},
      warnings,
      referencesFoundRaw: 0,
      referencesFound: 0,
      failed: true,
      source: resolved.source,
    };
  } finally {
    console.timeEnd("[AI] pos-references");
  }
}
