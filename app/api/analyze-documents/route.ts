import {
  appendImpresaMismatchWarning,
  buildFinalUpdates,
  parseAiJsonResponse,
} from "@/lib/documentAnalysis";
import { analyzeDocumentWithOpenAI, mapOpenAiError } from "@/lib/openAiAnalyze";
import { createSupabaseServer, getBearerToken } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type AnalyzeBody = {
  document_id?: string;
  storage_path?: string;
  impresa_id?: string;
  cantiere_id?: string;
  file_name?: string;
  file_type?: string;
  impresa_nome?: string;
};

async function loadDocumentFile(
  accessToken: string | null,
  body: AnalyzeBody
): Promise<{ base64: string; mimeType: string; fileName: string }> {
  if (!accessToken) {
    throw new Error("Sessione non valida. Effettua di nuovo l'accesso.");
  }

  const supabase = createSupabaseServer(accessToken);
  let storagePath = body.storage_path || null;
  let mimeType = body.file_type || "application/pdf";
  let fileName = body.file_name || "documento.pdf";

  if (body.document_id) {
    const { data: row, error } = await supabase
      .from("documents")
      .select("storage_path, tipo_file, nome_file, impresa_id")
      .eq("id", body.document_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!row?.storage_path) {
      throw new Error("Documento non trovato nello Storage.");
    }

    if (body.impresa_id && row.impresa_id && String(row.impresa_id) !== String(body.impresa_id)) {
      throw new Error("Documento non associato a questa impresa.");
    }

    storagePath = row.storage_path;
    mimeType = row.tipo_file || mimeType;
    fileName = row.nome_file || fileName;
  }

  if (!storagePath) {
    throw new Error("Riferimento documento mancante. Ricarica il file e riprova.");
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("documents")
    .download(storagePath);

  if (downloadError || !blob) {
    throw new Error("Impossibile scaricare il documento dallo Storage.");
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Documento non leggibile dall'AI.");
  }

  return {
    base64: buffer.toString("base64"),
    mimeType: mimeType || blob.type || "application/pdf",
    fileName,
  };
}

export async function POST(request: Request) {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  try {
    if (!hasApiKey) {
      return Response.json(
        { ok: false, error: "Chiave OpenAI non configurata." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as AnalyzeBody;
    const accessToken = getBearerToken(request);

    const { base64, mimeType, fileName } = await loadDocumentFile(accessToken, body);

    const rawText = await analyzeDocumentWithOpenAI({
      base64,
      mimeType,
      fileName,
    });

    const aiPayload = parseAiJsonResponse(rawText);
    const updates = buildFinalUpdates(aiPayload);
    const warnings = appendImpresaMismatchWarning(
      aiPayload.warnings,
      aiPayload.extracted_data?.impresa,
      body.impresa_nome
    );

    return Response.json({
      ok: true,
      document_type: aiPayload.document_type,
      confidence: aiPayload.confidence,
      summary: aiPayload.summary,
      extracted_data: aiPayload.extracted_data,
      updates,
      warnings,
    });
  } catch (error: unknown) {
    const message = mapOpenAiError(error, hasApiKey);
    const status =
      message === "Chiave OpenAI non configurata." ||
      message === "Quota OpenAI insufficiente o non disponibile."
        ? 500
        : 422;

    return Response.json({ ok: false, error: message }, { status });
  }
}
