import {
  appendImpresaMismatchWarning,
  applyAiUpdates,
  buildFastFinalUpdates,
  buildNominaSkippedChanges,
  calculateHealthExpiry,
  parseAiJsonResponse,
  resolveDocumentTypeWithPriority,
} from "@/lib/documentAnalysis";
import {
  applyPosPageReferences,
  extractDeterministicPosReferences,
  normalizePagesFromPayload,
  stripErroneousBulkPageOneRefs,
} from "@/lib/posReferences";
import {
  assertUserOwnsTempPath,
  downloadAiTempFile,
  formatTempDownloadError,
  removeAiTempFile,
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
    let refsBuffer: Buffer | null = null;
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

      const pagePayload =
        body.extractedPages ?? body.pageTexts ?? body.pageText ?? body.pages;

      if (hasExtractedText) {
        routeMode = "JSON_TEXT";
        clientExtractedText = cleanDocumentText(String(body.extractedText || ""));
        clientPageTexts = normalizePagesFromPayload(pagePayload);
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
        refsBuffer = await downloadAiTempFile(supabase, tempPathToDelete);
        console.log("[POS refs] temp path", tempPathToDelete);
      } catch (pathErr) {
        const msg =
          pathErr instanceof Error && pathErr.message.includes("non valido")
            ? pathErr.message
            : formatTempDownloadError(pathErr instanceof Error ? pathErr.message : undefined);
        if (routeMode === "TEMP_STORAGE_FILE") {
          return jsonError(formatTempDownloadError(msg), 403);
        }
        console.warn("[AI] temp pdf load failed (TEXT_FAST continues)", msg);
      }
    }

    console.log("[AI] has temporaryStoragePath", Boolean(jsonTemporaryStoragePath));
    console.log("[AI] has extractedPages", Boolean(clientPageTexts?.length));
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
    } else if (routeMode === "TEMP_STORAGE_FILE" && refsBuffer) {
      buffer = refsBuffer;
      const result = await runOpenAiOnBuffer({ buffer, mimeType, fileName });
      analysisMode = result.analysisMode;
      rawAiResponse = result.rawAiResponse;
    } else if (buffer) {
      const result = await runOpenAiOnBuffer({ buffer, mimeType, fileName });
      analysisMode = result.analysisMode;
      rawAiResponse = result.rawAiResponse;
    } else {
      return jsonError(formatTempDownloadError("buffer non disponibile"), 422);
    }

    console.log("[AI] analysisMode", analysisMode);

    const aiPayload = parseAiJsonResponse(rawAiResponse);
    const built = buildFastFinalUpdates(aiPayload, { fileName });
    const documentType =
      built.documentType ||
      resolveDocumentTypeWithPriority(aiPayload, fileName) ||
      aiPayload.document_type;

    console.log("[AI] document type", documentType);
    const warnings = appendImpresaMismatchWarning(
      [...(aiPayload.warnings || []), ...(built.mappingWarnings || [])],
      aiPayload.extracted_data?.impresa,
      impresaNome
    );

    const current = await loadImpresaStateForAi(supabase, impresaId);
    const preservedCheckRefs = current.checkRefs || {};
    let debugWorkerMatch = null;
    let debugIdoneita: Record<string, unknown> | null = null;

    let applied = built.isNomina
      ? {
          checks: current.checks,
          checkRefs: preservedCheckRefs,
          allegati: current.allegati,
          allegatiScadenze: current.allegatiScadenze,
          maestranze: current.maestranze,
          applied_changes: {},
          skipped_changes: buildNominaSkippedChanges(documentType),
          warnings: [],
          debug_worker_match: null,
        }
      : applyAiUpdates(
          {
            checks: current.checks,
            checkRefs: preservedCheckRefs,
            allegati: current.allegati,
            allegatiScadenze: current.allegatiScadenze,
            maestranze: current.maestranze,
          },
          built.updates,
          { fileName, documentType }
        );
    debugWorkerMatch = applied.debug_worker_match || null;
    if (Array.isArray(applied.warnings) && applied.warnings.length) {
      warnings.push(...applied.warnings);
    }

    if (String(documentType || "").toUpperCase() === "IDONEITA") {
      const idDetails = calculateHealthExpiry(aiPayload.extracted_data || {}, []);
      const appliedChangesAny = (applied as any).applied_changes || {};
      const skippedChangesAny = (applied as any).skipped_changes || {};
      const appliedWorkers = Array.isArray(appliedChangesAny?.maestranze)
        ? appliedChangesAny.maestranze
        : [];
      const skippedWorkers = Array.isArray(skippedChangesAny?.maestranze)
        ? skippedChangesAny.maestranze
        : [];
      const idApplied = appliedWorkers.some(
        (entry: any) => entry?.fields && Object.prototype.hasOwnProperty.call(entry.fields, "idoneita")
      );
      const skippedIdReason =
        skippedWorkers
          .map((w: any) => w?.fields?.idoneita?.reason || w?.reason || null)
          .find(Boolean) || idDetails.reasonIfNotApplied || null;

      debugIdoneita = {
        documentType,
        extractedWorker: aiPayload.extracted_data?.lavoratore || "",
        matchedWorker: debugWorkerMatch?.selectedWorker || null,
        dataVisitaRaw: idDetails.dataVisitaRaw,
        dataVisitaParsed: idDetails.dataVisitaParsed,
        periodicitaRaw: idDetails.periodicitaRaw,
        periodicitaYears: idDetails.periodicitaYears,
        dataScadenzaRaw: idDetails.dataScadenzaRaw,
        calculatedExpiry: idDetails.calculatedExpiry,
        fieldUsedForIdoneita: "idoneita",
        updatePayload: (built.updates?.maestranze || []).map((w: any) => ({
          nome: w?.nome,
          idoneita: w?.idoneita,
          qualifica: w?.qualifica,
        })),
        appliedToField: idApplied,
        reasonIfNotApplied: idApplied ? null : skippedIdReason,
      };
    }

    if (!built.isNomina && built.blockedReason) {
      applied = {
        ...applied,
        debug_worker_match: applied.debug_worker_match ?? null,
        skipped_changes: mergeSkippedChanges(applied.skipped_changes, {
          document: {
            reason: built.blockedReason,
            existing: "nessun aggiornamento",
            proposed: documentType,
          },
        }),
      };
    }

    let posReferencesFound = 0;
    let posReferencesSkipped = 0;
    let posRefsSource:
      | "deterministic"
      | "page_text"
      | "unavailable"
      | "not_applicable" = "not_applicable";
    let posRefsNoText = false;
    let posRefsExtractionFailed = false;
    let posRefsStatus: "not_applicable" | "found" | "unavailable" | "failed" =
      "not_applicable";
    let debugPosRefs: Record<string, unknown> | null = null;

    if (!built.isNomina && isPosDocumentType(documentType)) {
      applied = {
        ...applied,
        checkRefs: stripErroneousBulkPageOneRefs(applied.checkRefs),
      };

      if (!refsBuffer?.length && !clientPageTexts?.length && jsonTemporaryStoragePath) {
        console.warn(
          "[POS refs] temporaryStoragePath presente ma PDF non scaricato e senza extractedPages"
        );
      }

      const posRefs = await extractDeterministicPosReferences({
        buffer: refsBuffer,
        pageTexts: clientPageTexts,
        posChecks: applied.checks,
        posCheckRefs: applied.checkRefs,
        temporaryStoragePath: jsonTemporaryStoragePath || undefined,
      });

      debugPosRefs = posRefs.debug_pos_refs;
      posRefsSource = posRefs.source;
      posRefsNoText = posRefs.noText;
      posRefsExtractionFailed = posRefs.extractionFailed;
      console.log("[AI] POS references source", posRefsSource);
      console.log("[AI] POS references applied", posRefs.referencesFound);

      warnings.push(...posRefs.warnings);
      posReferencesSkipped = Math.max(
        0,
        posRefs.referencesFoundRaw - posRefs.referencesFound
      );

      let refAppliedCount = 0;
      if (Object.keys(posRefs.checkRefs).length) {
        const posMerge = applyPosPageReferences(
          applied.checkRefs,
          posRefs.checkRefs
        );
        refAppliedCount = posMerge.count;
        const posAppliedChanges: Record<string, Record<string, unknown>> = {};
        for (const [key, value] of Object.entries(posMerge.applied)) {
          if (!posAppliedChanges.checkRefs) posAppliedChanges.checkRefs = {};
          posAppliedChanges.checkRefs[key] = value;
        }
        applied = {
          ...applied,
          checkRefs: posMerge.checkRefs,
          applied_changes: mergeAppliedChanges(
            applied.applied_changes,
            posAppliedChanges
          ),
        };
      }

      posReferencesFound = refAppliedCount;

      if (posRefs.extractionFailed) {
        posRefsStatus = "failed";
      } else if (posRefs.noText) {
        posRefsStatus = "unavailable";
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
      pos_references_count: posReferencesFound,
      pos_refs_status: posRefsStatus,
      pos_refs_source: posRefsSource,
      pos_refs_no_text: posRefsNoText,
      pos_refs_extraction_failed: posRefsExtractionFailed,
      debug_pos_refs: debugPosRefs,
      debug_worker_match:
        String(documentType || "").toUpperCase() === "IDONEITA"
          ? debugWorkerMatch
          : null,
      debug_idoneita:
        String(documentType || "").toUpperCase() === "IDONEITA"
          ? debugIdoneita
          : null,
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
