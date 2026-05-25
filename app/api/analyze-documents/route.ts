import {
  appendImpresaMismatchWarning,
  applyAiUpdates,
  buildFastFinalUpdates,
  buildNominaSkippedChanges,
  isNominaDocumentType,
  parseAiJsonResponse,
  resolveDocumentTypeWithPriority,
} from "@/lib/documentAnalysis";
import {
  DIRECT_FILE_TOO_LARGE_MSG,
  MAX_DIRECT_FILE_BYTES,
} from "@/lib/analyzePayloadLimits";
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
type RouteMode = "JSON_TEXT" | "FILE_SMALL";

function jsonError(message: string, status: number, details: string | null = null) {
  return Response.json({ ok: false, error: message, details }, { status });
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value == null) return "";
  return String(value).trim();
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
    let buffer: Buffer | null = null;

    if (contentType.includes("application/json")) {
      routeMode = "JSON_TEXT";
      const body = (await request.json()) as Record<string, unknown>;
      impresaId = String(body.impresaId || "").trim();
      cantiereId = String(body.cantiereId || "").trim();
      impresaNome = String(body.impresaNome || "").trim();
      fileName = String(body.fileName || "documento.pdf").trim() || "documento.pdf";
      mimeType = String(body.fileType || "application/pdf").trim() || "application/pdf";
      fileSize = Number(body.fileSize) || 0;
      clientExtractedText = cleanDocumentText(String(body.extractedText || ""));

      if (!impresaId) {
        return jsonError("Impresa non valida. Ricarica la pagina e riprova.", 400);
      }
      if (!cantiereId) {
        return jsonError("Cantiere non valido. Ricarica la pagina e riprova.", 400);
      }
      if (!isTextSufficient(clientExtractedText)) {
        return jsonError(
          "Testo estratto insufficiente per l'analisi. Usa un PDF testuale o un file più piccolo.",
          400
        );
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
        return jsonError(DIRECT_FILE_TOO_LARGE_MSG, 413);
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (!buffer.length) {
        return jsonError("Documento non leggibile dall'AI.", 422);
      }
    }

    console.log("[AI] mode", routeMode);
    console.log("[AI] fileSize", fileSize);

    const supabase = createSupabaseServer(accessToken);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Sessione non valida. Effettua di nuovo l'accesso.", 401);
    }

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

    const applied = built.isNomina
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

    console.time("[AI] db");
    await persistImpresaStateAfterAi(supabase, impresaId, {
      checks: applied.checks,
      checkRefs: preservedCheckRefs,
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
      state: {
        checks: applied.checks,
        checkRefs: preservedCheckRefs,
        allegati: applied.allegati,
        allegatiScadenze: applied.allegatiScadenze,
        maestranze: applied.maestranze,
      },
    });
  } catch (error: unknown) {
    const message = mapOpenAiError(error, hasApiKey);
    const status =
      message === "Chiave OpenAI non configurata." ||
      message === "Quota OpenAI insufficiente o non disponibile."
        ? 500
        : 422;

    return jsonError(message, status, error instanceof Error ? error.message : null);
  } finally {
    console.timeEnd("[AI] total");
  }
}
