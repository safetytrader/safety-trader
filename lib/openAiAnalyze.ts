const AI_SYSTEM_PROMPT = `Sei un assistente documentale per la sicurezza nei cantieri.
Analizza il documento caricato.
Devi restituire esclusivamente JSON valido secondo lo schema richiesto.
Non inventare dati.
Se un dato non è leggibile o non presente, usa null.
Riconosci il tipo documento tra:
DURC, POS, VISURA, FORMAZIONE_BASE, FORMAZIONE_SPECIFICA, IDONEITA, UNILAV, PREPOSTO, ANTINCENDIO, PRIMO_SOCCORSO, PONTEGGI, MMT, PLE, GRU, SPAZI_CONFINATI, ALTRO.
Estrai date in formato YYYY-MM-DD se possibile.
Per documenti di formazione o idoneità estrai nominativo lavoratore, mansione/corso, data erogazione o scadenza.
Restituisci confidence da 0 a 1.
Non valutare giuridicamente il documento: limita l'output ai dati estraibili.

Schema JSON obbligatorio:
{
  "document_type": "DURC | POS | VISURA | FORMAZIONE_BASE | FORMAZIONE_SPECIFICA | IDONEITA | UNILAV | PREPOSTO | ANTINCENDIO | PRIMO_SOCCORSO | PONTEGGI | MMT | PLE | GRU | SPAZI_CONFINATI | ALTRO",
  "confidence": 0,
  "summary": "",
  "extracted_data": {
    "impresa": null,
    "lavoratore": null,
    "codice_fiscale": null,
    "mansione": null,
    "data_emissione": null,
    "data_erogazione": null,
    "data_scadenza": null,
    "data_fine_contratto": null,
    "ente": null,
    "corso": null
  },
  "updates": {
    "checklist": {},
    "allegati": {},
    "allegatiScadenze": {},
    "maestranze": []
  },
  "warnings": []
}`;

export function mapOpenAiError(error: unknown, hasApiKey: boolean): string {
  if (!hasApiKey) return "Chiave OpenAI non configurata.";

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const msg = raw.toLowerCase();

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

  return raw || "Errore analisi documento";
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

export async function analyzeDocumentWithOpenAI({
  base64,
  mimeType,
  fileName,
}: {
  base64: string;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave OpenAI non configurata.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const safeMime = mimeType || "application/pdf";
  const fileData = `data:${safeMime};base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: fileName || "documento.pdf",
              file_data: fileData,
            },
            {
              type: "input_text",
              text: AI_SYSTEM_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const errObj = data.error as { message?: string; code?: string; type?: string } | undefined;
    const message = errObj?.message || "Errore OpenAI";
    const code = (errObj?.code || errObj?.type || "").toLowerCase();
    if (code.includes("insufficient_quota") || message.toLowerCase().includes("quota")) {
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
