import type { AiUsageEntry } from "@/lib/aiUsageContext";

export type AiPricingTier = {
  inputPer1M: number;
  outputPer1M: number;
  minEstimateEur?: number;
};

/** Prezzi EUR per 1M token (configurabili). */
export const AI_PRICING: Record<string, AiPricingTier> = {
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6, minEstimateEur: 0.002 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, minEstimateEur: 0.001 },
  "gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 1.0, minEstimateEur: 0.002 },
};

export const AI_PRICING_FALLBACK: AiPricingTier = {
  inputPer1M: 0.5,
  outputPer1M: 2.0,
  minEstimateEur: 0.003,
};

export function resolveAiPricing(model: string): { tier: AiPricingTier; known: boolean } {
  const key = String(model || "").trim().toLowerCase();
  if (AI_PRICING[key]) {
    return { tier: AI_PRICING[key], known: true };
  }
  return { tier: AI_PRICING_FALLBACK, known: false };
}

export function extractUsageFromOpenAIResponse(data: Record<string, unknown>) {
  const usage =
    (data.usage as Record<string, unknown> | undefined) ||
    ((data.response as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined) ||
    {};

  const input = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const output = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const total = Number(usage.total_tokens ?? input + output);

  return {
    input_tokens: Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0,
    output_tokens: Number.isFinite(output) ? Math.max(0, Math.round(output)) : 0,
    total_tokens: Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0,
  };
}

export function calculateAiCostEur({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): { costEur: number; estimated: boolean; pricingKnown: boolean } {
  const { tier, known } = resolveAiPricing(model);
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);

  let cost =
    (input / 1_000_000) * tier.inputPer1M + (output / 1_000_000) * tier.outputPer1M;
  let estimated = false;

  if (cost <= 0) {
    cost = tier.minEstimateEur ?? AI_PRICING_FALLBACK.minEstimateEur ?? 0.002;
    estimated = true;
  }

  return {
    costEur: Math.round(cost * 10000) / 10000,
    estimated,
    pricingKnown: known,
  };
}

export function aggregateAiUsageEntries(entries: AiUsageEntry[]) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    const fallbackModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const { costEur } = calculateAiCostEur({
      model: fallbackModel,
      inputTokens: 0,
      outputTokens: 0,
    });
    return {
      model: fallbackModel,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_eur: costEur,
      estimated: true,
      pricing_warnings: ["usage OpenAI non disponibile: costo stimato applicato"],
    };
  }

  let input_tokens = 0;
  let output_tokens = 0;
  let total_tokens = 0;
  let cost_eur = 0;
  const pricing_warnings: string[] = [];
  let estimated = false;
  const modelWeights: Record<string, number> = {};

  for (const entry of list) {
    input_tokens += entry.input_tokens;
    output_tokens += entry.output_tokens;
    total_tokens += entry.total_tokens;
    modelWeights[entry.model] = (modelWeights[entry.model] || 0) + entry.total_tokens;

    const priced = calculateAiCostEur({
      model: entry.model,
      inputTokens: entry.input_tokens,
      outputTokens: entry.output_tokens,
    });
    cost_eur += priced.costEur;
    if (priced.estimated) estimated = true;
    if (!priced.pricingKnown) {
      pricing_warnings.push(`modello non in mappa prezzi: ${entry.model}`);
    }
  }

  const model =
    Object.entries(modelWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

  return {
    model,
    input_tokens,
    output_tokens,
    total_tokens,
    cost_eur: Math.round(cost_eur * 10000) / 10000,
    estimated,
    pricing_warnings,
  };
}
