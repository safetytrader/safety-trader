import { aggregateAiUsageEntries } from "@/lib/aiPricing";
import type { AiUsageEntry } from "@/lib/aiUsageContext";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AiUsageResponse = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_eur: number;
  credit_before: number;
  credit_after: number;
};

/** Scala credito e registra log — solo lato server (service role). */
export async function consumeAiCreditAfterAnalysis({
  userId,
  documentName,
  documentType,
  usageEntries,
}: {
  userId: string;
  documentName: string;
  documentType: string;
  usageEntries: AiUsageEntry[];
}): Promise<AiUsageResponse | null> {
  if (!userId) return null;

  const usage = aggregateAiUsageEntries(usageEntries);
  if (usage.pricing_warnings?.length) {
    console.warn("[AI credit]", usage.pricing_warnings.join("; "));
  }

  const admin = createSupabaseAdmin();
  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("api_credit_eur, api_spent_eur")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    console.error("[AI credit] lettura profilo fallita", readError.message);
    return null;
  }

  const creditBefore = Number(profile?.api_credit_eur ?? 0);
  const spentBefore = Number(profile?.api_spent_eur ?? 0);
  const costEur = Number(usage.cost_eur || 0);
  const creditAfter = Math.max(0, creditBefore - costEur);
  const spentAfter = spentBefore + costEur;

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      api_credit_eur: creditAfter,
      api_spent_eur: spentAfter,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[AI credit] aggiornamento profilo fallito", updateError.message);
    return null;
  }

  const { error: logError } = await admin.from("ai_usage_logs").insert({
    user_id: userId,
    document_name: documentName || null,
    document_type: documentType || null,
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    cost_eur: costEur,
  });

  if (logError) {
    console.error("[AI credit] inserimento log fallito", logError.message);
  }

  return {
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    cost_eur: costEur,
    credit_before: creditBefore,
    credit_after: creditAfter,
  };
}
