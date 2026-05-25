import {
  appendImpresaMismatchWarning,
  applyAiUpdates,
  buildFastFinalUpdates,
  buildNominaSkippedChanges,
  parseAiJsonResponse,
  resolveDocumentTypeWithPriority,
} from "@/lib/documentAnalysis";
import { extractPosPageReferences } from "@/lib/posPageReferences";
import {
  assertUserOwnsTempPath,
  downloadAiTempFile,
  removeAiTempFile,
  TEMP_DOWNLOAD_FAILED_MSG,
} from "@/lib/aiTempStorage";
import { MAX_DIRECT_FILE_BYTES } from "@/lib/analyzePayloadLimits";
import {
  insertDocumentAnalysisServer,
  loadImpresaStateForAi,
  persistImpresaStateAfterAi,
} from "@/lib/db";
import {
  analyzeDocumentTextWithOpenAI,
  analyzeDocumentWithOpenAI,
  mapOpenAiError,
} from "@/lib/openAiAnalyze";
import {
  buildDocumentHints,
  cleanDocumentText,
  extractPdfText,
  isImageMime,
  isPdfMimeOrName,
  isTextSufficient,
} from "@/lib/pdfText";
import { createSupabaseServer, getBearerToken } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type AnalysisMode = "TEXT_FAST" | "FILE_FALLBACK";
type RouteMode = "JSON_TEXT" | "TEMP_STORAGE_FILE" | "FILE_SMALL";

const OPENAI_USER_ERROR = "Analisi AI non disponibile. Riprova tra poco.";

function jsonError(message: string, status: number, details: string | null = null) {
  return Response.json({ ok: false, error: message, details }, { status });
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value == null) return "";
  return String(value).trim();
}

function mergeAppliedChanges(
  target: Record<string, Record<string, unknown>> = {},
  source: Record<string, Record<string, unknown>> = {}
) {
  const out: Record<string, Record<string, unknown>> = { ...target };
  for (const [section, values] of Object.entries(source || {})) {
    if (!values || typeof values !== "object") continue;
    out[section] = { ...(out[section] || {}), ...values };
  }
  return out;
}

function mergeSkippedChanges(
  target: Record<string, Record<string, unknown>> = {},
  source: Record<string, Record<string, unknown>> = {}
) {
  const out: Record<string, Record<string, unknown>> = { ...target };
  for (const [section, values] of Object.entries(source || {})) {
    if (!values || typeof values !== "object") continue;
    out[section] = { ...(out[section] || {}), ...values };
  }
  return out;
}

function isPosDocumentType(documentType: string) {
  return String(documentType || "").trim().toUpperCase() === "POS";
}

async function runOpenAiOnBuffer(options: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ analysisMode: AnalysisMode; rawAiResponse: string }> {
  const { buffer, mimeType, fileName } = options;
  let analysisMode: AnalysisMode = "FILE_FALLBACK";
  let rawAiResponse = "";

  if (isPdfMimeOrName(mimeType, fileName) && !isImageMime(mimeType)) {
    console.time("pdf-text-extraction");
    const extractedRaw = await extractPdfText(buffer);
    const cleanedText = cleanDocumentText(extractedRaw);
    console.timeEnd("pdf-text-extraction");

    if (isTextSufficient(cleanedText)) {
      analysisMode = "TEXT_FAST";
      const hints = buildDocumentHints(fileName, cleanedText);

      console.time("[AI] openai");
      rawAiResponse = await analyzeDocumentTextWithOpenAI({
        fileName,
        documentText: cleanedText,
        hints,
      });
      console.timeEnd("[AI] openai");
    }
  }

  if (analysisMode === "FILE_FALLBACK") {
    const hints = buildDocumentHints(fileName, "");

    console.time("[AI] openai");
    rawAiResponse = await analyzeDocumentWithOpenAI({
      base64: buffer.toString("base64"),
      mimeType,
      fileName,
      hints,
    });
    console.timeEnd("[AI] openai");
  }

  return { analysisMode, rawAiResponse };
}

export async function GET() {
  console.log("[AI] request method", "GET");
  console.log("[AI] content-type", null);
  return jsonError("Metodo non consentito. Usa POST.", 405);
}

export async function POST(request: Request) {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  console.log("[AI] request method", request.method);
  const contentType = request.headers.get("content-type") || "";
  console.log("[AI] content-type", contentType);

  console.time("[AI] total");

  let tempPathToDelete: string | null = null;
  let cleanupSupabase: ReturnType<typeof createSupabaseServer> | null = null;

  try {
    if (!hasApiKey) {
      return jsonError("Chiave OpenAI non configurata.", 500);
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return jsonError("Sessione non valida. Effettua di nuovo l'accesso.", 401);
    }

    let routeMode: RouteMode = "FILE_SMALL";
    let impresaId = "";
    let cantiereId = "";
    let impresaNome = "";
    let fileName = "documento.pdf";
    let mimeType = "application/pdf";
    let fileSize = 0;
    let clientExtractedText = "";
    let clientPageTexts: { page: number; text: string }[] = [];
    let buffer: Buffer | null = null;
    let jsonTemporaryStoragePath = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      impresaId = String(body.impresaId || "").trim();
      cantiereId = String(body.cantiereId || "").trim();
      impresaNome = String(body.impresaNome || "").trim();
      fileName = String(body.fileName || "documento.pdf").trim() || "documento.pdf";
      mimeType = String(body.fileType || "application/pdf").trim() || "application/pdf";
      fileSize = Number(body.fileSize) || 0;
      jsonTemporaryStoragePath = String(body.temporaryStoragePath || "").trim();

      const hasExtractedText =
        body.extractedText != null && String(body.extractedText).trim().length > 0;

      if (!impresaId) {
        return jsonError("Impresa non valida. Ricarica la pagina e riprova.", 400);
      }
      if (!cantiereId) {
        return jsonError("Cantiere non valido. Ricarica la pagina e riprova.", 400);
      }

      const pagePayload = body.pageTexts ?? body.extractedPages;

      if (hasExtractedText) {
        routeMode = "JSON_TEXT";
        clientExtractedText = cleanDocumentText(String(body.extractedText || ""));
        if (Array.isArray(pagePayload)) {
          clientPageTexts = pagePayload
            .map(entry => ({
              page: Number((entry as { page?: number })?.page),
              text: String((entry as { text?: string })?.text || "").trim(),
            }))
            .filter(entry => Number.isFinite(entry.page) && entry.page > 0 && entry.text);
        }
        if (!isTextSufficient(clientExtractedText)) {
          return jsonError(
            "Testo estratto insufficiente per l'analisi. Usa un PDF testuale o un file più piccolo.",
            400
          );
        }
      } else if (jsonTemporaryStoragePath) {
        routeMode = "TEMP_STORAGE_FILE";
      } else {
        return jsonError("Richiesta non valida.", 400);
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      impresaId = getFormString(formData, "impresaId");
      cantiereId = getFormString(formData, "cantiereId");
      impresaNome = getFormString(formData, "impresaNome");

      if (!file || !(file instanceof File)) {
        return jsonError("File mancante. Seleziona un documento da analizzare.", 400);
      }
      if (!impresaId) {
        return jsonError("Impresa non valida. Ricarica la pagina e riprova.", 400);
      }
      if (!cantiereId) {
        return jsonError("Cantiere non valido. Ricarica la pagina e riprova.", 400);
      }

      fileSize = file.size;
      fileName = file.name || "documento.pdf";
      mimeType = file.type || "application/pdf";

      if (fileSize > MAX_DIRECT_FILE_BYTES) {
        console.log("[AI] mode", "FILE_REJECTED");
        console.log("[AI] fileSize", fileSize);
        return jsonError(
          "File troppo grande per l'upload diretto. Ricarica il documento.",
          413
        );
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (!buffer.length) {
        return jsonError("Documento non leggibile dall'AI.", 422);
      }
    }

    const supabase = createSupabaseServer(accessToken);
    cleanupSupabase = supabase;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Sessione non valida. Effettua di nuovo l'accesso.", 401);
    }

    if (jsonTemporaryStoragePath) {
      try {
        tempPathToDelete = assertUserOwnsTempPath(jsonTemporaryStoragePath, user.id);
        buffer = await downloadAiTempFile(supabase, tempPathToDelete);
        console.log("[AI] temp pdf loaded for references", buffer?.length || 0);
      } catch (pathErr) {
        const msg =
          pathErr instanceof Error && pathErr.message.includes("non valido")
            ? pathErr.message
            : TEMP_DOWNLOAD_FAILED_MSG;
        if (routeMode === "TEMP_STORAGE_FILE") {
          return jsonError(msg, 403);
        }
        console.warn("[AI] temp pdf load failed (fast analysis continues)", msg);
      }
    }

    console.log("[AI] mode", routeMode);
    console.log("[AI] fileSize", fileSize);

    let analysisMode: AnalysisMode = "FILE_FALLBACK";
    let rawAiResponse = "";

    if (routeMode === "JSON_TEXT") {
      analysisMode = "TEXT_FAST";
      const hints = buildDocumentHints(fileName, clientExtractedText);

      console.time("[AI] openai");
      rawAiResponse = await analyzeDocumentTextWithOpenAI({
        fileName,
        documentText: clientExtractedText,
        hints,
      });
      console.timeEnd("[AI] openai");
    } else if (buffer) {
      const result = await runOpenAiOnBuffer({ buffer, mimeType, fileName });
      analysisMode = result.analysisMode;
      rawAiResponse = result.rawAiResponse;
    } else {
      return jsonError(TEMP_DOWNLOAD_FAILED_MSG, 422);
    }

    console.log("[AI] analysisMode", analysisMode);

    const aiPayload = parseAiJsonResponse(rawAiResponse);
    const built = buildFastFinalUpdates(aiPayload, { fileName });
    const documentType =
      built.documentType ||
      resolveDocumentTypeWithPriority(aiPayload, fileName) ||
      aiPayload.document_type;
    const warnings = appendImpresaMismatchWarning(
      [...(aiPayload.warnings || []), ...(built.mappingWarnings || [])],
      aiPayload.extracted_data?.impresa,
      impresaNome
    );

    const current = await loadImpresaStateForAi(supabase, impresaId);
    const preservedCheckRefs = current.checkRefs || {};

    let applied = built.isNomina
      ? {
          checks: current.checks,
          checkRefs: preservedCheckRefs,
          allegati: current.allegati,
          allegatiScadenze: current.allegatiScadenze,
          maestranze: current.maestranze,
          applied_changes: {},
          skipped_changes: buildNominaSkippedChanges(documentType),
        }
      : applyAiUpdates(
          {
            checks: current.checks,
            checkRefs: preservedCheckRefs,
            allegati: current.allegati,
            allegatiScadenze: current.allegatiScadenze,
            maestranze: current.maestranze,
          },
          built.updates
        );

    let posReferencesFound = 0;
    let posReferencesSkipped = 0;
    let posRefsStatus: "not_applicable" | "found" | "unavailable" | "failed" =
      "not_applicable";

    if (!built.isNomina && isPosDocumentType(documentType)) {
      const posRefs = await extractPosPageReferences({
        fileName,
        mimeType,
        buffer,
        pageTexts: clientPageTexts,
        posChecks: applied.checks,
      });

      warnings.push(...posRefs.warnings);
      posReferencesSkipped = Math.max(
        0,
        posRefs.referencesFoundRaw - posRefs.referencesFound
      );

      let refAppliedCount = 0;
      if (Object.keys(posRefs.checkRefs).length) {
        const refApplied = applyAiUpdates(
          {
            checks: applied.checks,
            checkRefs: applied.checkRefs,
            allegati: applied.allegati,
            allegatiScadenze: applied.allegatiScadenze,
            maestranze: applied.maestranze,
          },
          { checkRefs: posRefs.checkRefs }
        );
        const refChanges = refApplied.applied_changes as Record<
          string,
          Record<string, unknown>
        >;
        refAppliedCount = Object.keys(refChanges.checkRefs || {}).length;
        applied = {
          ...refApplied,
          applied_changes: mergeAppliedChanges(
            applied.applied_changes,
            refApplied.applied_changes
          ),
          skipped_changes: mergeSkippedChanges(
            applied.skipped_changes,
            refApplied.skipped_changes
          ),
        };
      }

      posReferencesFound = refAppliedCount;

      if (posRefs.failed) {
        posRefsStatus = "failed";
      } else if (posReferencesFound > 0) {
        posRefsStatus = "found";
      } else {
        posRefsStatus = "unavailable";
      }
    }

    console.time("[AI] db");
    await persistImpresaStateAfterAi(supabase, impresaId, {
      checks: applied.checks,
      checkRefs: applied.checkRefs,
      note: current.note,
      allegati: applied.allegati,
      allegatiScadenze: applied.allegatiScadenze,
      maestranze: applied.maestranze,
    });

    await insertDocumentAnalysisServer(supabase, user.id, {
      impresa_id: impresaId,
      cantiere_id: cantiereId,
      status: "completed",
      document_type: documentType,
      confidence: aiPayload.confidence,
      summary: aiPayload.summary,
      extracted_data: {
        ...(aiPayload.extracted_data || {}),
        analysis_mode: analysisMode,
        route_mode: routeMode,
        pos_references_found: posReferencesFound,
        pos_references_skipped: posReferencesSkipped,
      },
      applied_changes: applied.applied_changes,
      skipped_changes: applied.skipped_changes,
      warnings,
    });
    console.timeEnd("[AI] db");

    return Response.json({
      ok: true,
      document_type: documentType,
      confidence: aiPayload.confidence,
      summary: aiPayload.summary,
      extracted_data: aiPayload.extracted_data,
      applied_changes: applied.applied_changes,
      skipped_changes: applied.skipped_changes,
      warnings,
      analysis_ui: built.analysisUi || null,
      is_nomina: Boolean(built.isNomina),
      pos_references_found: posReferencesFound,
      pos_refs_status: posRefsStatus,
      state: {
        checks: applied.checks,
        checkRefs: applied.checkRefs,
        allegati: applied.allegati,
        allegatiScadenze: applied.allegatiScadenze,
        maestranze: applied.maestranze,
      },
    });
  } catch (error: unknown) {
    const mapped = mapOpenAiError(error, hasApiKey);
    const message =
      mapped !== "Chiave OpenAI non configurata." &&
      mapped !== "Quota OpenAI insufficiente o non disponibile."
        ? OPENAI_USER_ERROR
        : mapped;
    const status =
      message === "Chiave OpenAI non configurata." ||
      message === "Quota OpenAI insufficiente o non disponibile."
        ? 500
        : 422;

    return jsonError(message, status, error instanceof Error ? error.message : null);
  } finally {
    if (tempPathToDelete && cleanupSupabase) {
      await removeAiTempFile(cleanupSupabase, tempPathToDelete);
    }
    console.timeEnd("[AI] total");
  }
}
