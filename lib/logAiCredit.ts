import { createClient } from "@supabase/supabase-js";

type LogAiCreditParams = {
  userId: string | null;
  cantiereId?: string | null;
  impresaId?: string | null;
  documentoId?: string | null;
  action?: string;
  provider?: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  costEur?: number;
  creditBefore?: number | null;
  creditAfter?: number | null;
  status?: "success" | "error";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logAiCredit({
  userId,
  cantiereId = null,
  impresaId = null,
  documentoId = null,
  action = "analisi_documento",
  provider = "openai",
  model = null,
  inputTokens = 0,
  outputTokens = 0,
  costEur = 0,
  creditBefore = null,
  creditAfter = null,
  status = "success",
  errorMessage = null,
  metadata = {},
}: LogAiCreditParams) {
  const { error } = await supabaseAdmin.from("ai_credit_logs").insert({
    user_id: userId,
    cantiere_id: cantiereId,
    impresa_id: impresaId,
    documento_id: documentoId,
    action,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_eur: costEur,
    credit_before: creditBefore,
    credit_after: creditAfter,
    status,
    error_message: errorMessage,
    metadata,
  });

  if (error) {
    console.error("Errore salvataggio log credito AI:", error);
  }
}