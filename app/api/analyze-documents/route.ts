import {
  appendImpresaMismatchWarning,
  applyAiUpdates,
  buildFastFinalUpdates,
  parseAiJsonResponse,
} from "@/lib/documentAnalysis";
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

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value == null) return "";
  return String(value).trim();
}

export async function POST(request: Request) {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  console.time("ai-analysis-total");

  try {
    if (!hasApiKey) {
      return jsonError("Chiave OpenAI non configurata.", 500);
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return jsonError("Sessione non valida. Effettua di nuovo l'accesso.", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const impresaId = getFormString(formData, "impresaId");
    const cantiereId = getFormString(formData, "cantiereId");
    const impresaNome = getFormString(formData, "impresaNome");

    if (!file || !(file instanceof File)) {
      return jsonError("File mancante. Seleziona un documento da analizzare.", 400);
    }
    if (!impresaId) {
      return jsonError("Impresa non valida. Ricarica la pagina e riprova.", 400);
    }
    if (!cantiereId) {
      return jsonError("Cantiere non valido. Ricarica la pagina e riprova.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return jsonError("Documento non leggibile dall'AI.", 422);
    }

    const mimeType = file.type || "application/pdf";
    const fileName = file.name || "documento.pdf";

    const supabase = createSupabaseServer(accessToken);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Sessione non valida. Effettua di nuovo l'accesso.", 401);
    }

    let analysisMode: "TEXT_FAST" | "FILE_FALLBACK" = "FILE_FALLBACK";
    let rawAiResponse = "";

    if (isPdfMimeOrName(mimeType, fileName) && !isImageMime(mimeType)) {
      console.time("pdf-text-extraction");
      const extractedRaw = await extractPdfText(buffer);
      const cleanedText = cleanDocumentText(extractedRaw);
      console.timeEnd("pdf-text-extraction");

      if (isTextSufficient(cleanedText)) {
        analysisMode = "TEXT_FAST";
        const hints = buildDocumentHints(fileName, cleanedText);

        console.time("openai-call");
        rawAiResponse = await analyzeDocumentTextWithOpenAI({
          fileName,
          documentText: cleanedText,
          hints,
        });
        console.timeEnd("openai-call");
      }
    }

    if (analysisMode === "FILE_FALLBACK") {
      const hints = buildDocumentHints(fileName, "");

      console.time("openai-call");
      rawAiResponse = await analyzeDocumentWithOpenAI({
        base64: buffer.toString("base64"),
        mimeType,
        fileName,
        hints,
      });
      console.timeEnd("openai-call");
    }

    console.log("mode-used", analysisMode);

    const aiPayload = parseAiJsonResponse(rawAiResponse);
    const { updates, mappingWarnings } = buildFastFinalUpdates(aiPayload);
    const warnings = appendImpresaMismatchWarning(
      [...(aiPayload.warnings || []), ...(mappingWarnings || [])],
      aiPayload.extracted_data?.impresa,
      impresaNome
    );

    const current = await loadImpresaStateForAi(supabase, impresaId);
    const preservedCheckRefs = current.checkRefs || {};

    const applied = applyAiUpdates(
      {
        checks: current.checks,
        checkRefs: preservedCheckRefs,
        allegati: current.allegati,
        allegatiScadenze: current.allegatiScadenze,
        maestranze: current.maestranze,
      },
      updates
    );

    console.time("db-update");
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
      document_type: aiPayload.document_type,
      confidence: aiPayload.confidence,
      summary: aiPayload.summary,
      extracted_data: {
        ...(aiPayload.extracted_data || {}),
        analysis_mode: analysisMode,
      },
      applied_changes: applied.applied_changes,
      skipped_changes: applied.skipped_changes,
      warnings,
    });
    console.timeEnd("db-update");

    return Response.json({
      ok: true,
      document_type: aiPayload.document_type,
      confidence: aiPayload.confidence,
      summary: aiPayload.summary,
      extracted_data: aiPayload.extracted_data,
      applied_changes: applied.applied_changes,
      skipped_changes: applied.skipped_changes,
      warnings,
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

    return jsonError(message, status);
  } finally {
    console.timeEnd("ai-analysis-total");
  }
}
