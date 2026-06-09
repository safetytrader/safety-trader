export type AiUsageEntry = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

let activeEntries: AiUsageEntry[] | null = null;

/** Avvia raccolta usage OpenAI per una richiesta /api/analyze-documents. */
export function beginAiUsageCollection() {
  activeEntries = [];
}

export function recordOpenAiUsage(entry: AiUsageEntry) {
  if (!activeEntries) return;
  activeEntries.push({
    model: String(entry.model || "").trim() || "unknown",
    input_tokens: Math.max(0, Number(entry.input_tokens) || 0),
    output_tokens: Math.max(0, Number(entry.output_tokens) || 0),
    total_tokens: Math.max(0, Number(entry.total_tokens) || 0),
  });
}

export function takeAiUsageCollection(): AiUsageEntry[] {
  const entries = activeEntries ? [...activeEntries] : [];
  activeEntries = null;
  return entries;
}

export function clearAiUsageCollection() {
  activeEntries = null;
}
