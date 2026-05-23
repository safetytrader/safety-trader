// @ts-nocheck
const AI_SYSTEM_PROMPT = `Analisi documentale veloce per sicurezza cantieri.
Restituisci SOLO JSON valido, senza testo extra.
Non inventare dati: se assente usa null.
Date in YYYY-MM-DD.
confidence tra 0 e 1.
summary massimo 200 caratteri.
warnings massimo 5 elementi.
Nessun riferimento pagina, excerpt, checklist_evidence o updates.

document_type: DURC | POS | VISURA | FORMAZIONE_BASE | FORMAZIONE_SPECIFICA | IDONEITA | UNILAV | PREPOSTO | ANTINCENDIO | PRIMO_SOCCORSO | PONTEGGI | MMT | PLE | GRU | SPAZI_CONFINATI | ALTRO

Estrai solo campi pertinenti al tipo:
- DURC: impresa, codice_fiscale_impresa, data_emissione, data_scadenza, ente
- POS: solo classificazione POS + impresa se presente (non estrarre sezioni dettagliate)
- VISURA: impresa, codice_fiscale_impresa, data_emissione, data_scadenza se reale
- UNILAV: lavoratore, codice_fiscale_lavoratore, tipo_comunicazione (assunzione/proroga/trasformazione/cessazione), tipo_contratto, data_inizio_rapporto, data_fine_contratto, data_proroga, data_scadenza (per proroga: data_proroga e/o data_scadenza)
- IDONEITA: lavoratore, mansione, data_emissione, data_scadenza
- FORMAZIONE_* / attestati: lavoratore, corso, data_erogazione

Schema:
{
  "document_type": "POS",
  "confidence": 0,
  "summary": "",
  "extracted_data": {
    "impresa": null,
    "codice_fiscale_impresa": null,
    "lavoratore": null,
    "codice_fiscale_lavoratore": null,
    "mansione": null,
    "data_emissione": null,
    "data_erogazione": null,
    "data_scadenza": null,
    "data_fine_contratto": null,
    "ente": null,
    "corso": null,
    "tipo_contratto": null,
    "tipo_comunicazione": null,
    "data_inizio_rapporto": null,
    "data_proroga": null
  },
  "warnings": []
}`;

const MAX_OUTPUT_TOKENS = 600;

function buildHintsLine(hints = []) {
  if (!hints?.length) return "";
  return `Indizi tipo documento (non vincolanti): ${hints.join(", ")}.\n`;
}

async function callOpenAIResponses(content) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave OpenAI non configurata.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const errObj = data.error as { message?: string; code?: string; type?: string } | undefined;
    const message = errObj?.message || "Errore OpenAI";
    const code = String(errObj?.code || errObj?.type || "").toLowerCase();
    if (code.includes("insufficient_quota") || String(message ?? "").toLowerCase().includes("quota")) {
      throw new Error("Quota OpenAI insufficiente o non disponibile.");
    }
    throw new Error(message);
  }

  const text = extractOutputText(data);
  if (!text) {
    throw new Error("Documento non leggibile dall'AI.");
  }

  return text;
}

export function mapOpenAiError(error: unknown, hasApiKey: boolean): string {
  if (!hasApiKey) return "Chiave OpenAI non configurata.";

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const msg = String(raw ?? "").toLowerCase();

  if (
    msg.includes("insufficient_quota") ||
    msg.includes("quota") ||
    msg.includes("billing") ||
    msg.includes("exceeded")
  ) {
    return "Quota OpenAI insufficiente o non disponibile.";
  }

  if (
    msg.includes("unsupported") ||
    msg.includes("invalid") ||
    msg.includes("could not parse") ||
    msg.includes("non leggibile") ||
    msg.includes("failed to process")
  ) {
    return "Documento non leggibile dall'AI.";
  }

  if (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch")
  ) {
    return "Analisi AI non disponibile. Riprova tra poco.";
  }

  return "Analisi AI non disponibile. Riprova tra poco.";
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  const output = data.output as { content?: { type?: string; text?: string }[] }[] | undefined;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap(item => item.content || [])
    .map(part => (part.type === "output_text" || part.type === "text" ? part.text : "") || "")
    .join("")
    .trim();
}

/** Modalità TEXT_FAST: solo testo estratto, senza file. */
export async function analyzeDocumentTextWithOpenAI({
  fileName,
  documentText,
  hints = [],
}: {
  fileName: string;
  documentText: string;
  hints?: string[];
}): Promise<string> {
  const userText = `${buildHintsLine(hints)}Nome file: ${fileName || "documento.pdf"}

Testo documento:
---
${documentText}
---

${AI_SYSTEM_PROMPT}`;

  return callOpenAIResponses([
    {
      type: "input_text",
      text: userText,
    },
  ]);
}

/** Modalità FILE_FALLBACK: file completo (PDF/immagine). */
export async function analyzeDocumentWithOpenAI({
  base64,
  mimeType,
  fileName,
  hints = [],
}: {
  base64: string;
  mimeType: string;
  fileName: string;
  hints?: string[];
}): Promise<string> {
  const safeMime = mimeType || "application/pdf";
  const fileData = `data:${safeMime};base64,${base64}`;
  const promptText = `${buildHintsLine(hints)}${AI_SYSTEM_PROMPT}`;

  return callOpenAIResponses([
    {
      type: "input_file",
      filename: fileName || "documento.pdf",
      file_data: fileData,
    },
    {
      type: "input_text",
      text: promptText,
    },
  ]);
}
