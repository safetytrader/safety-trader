import { CHECKLIST_ITEMS } from "@/lib/constants";
import { POS_CHECKLIST_EXCLUDED_IDS } from "@/lib/documentAnalysis";

function buildChecklistPromptSection() {
  const lines = CHECKLIST_ITEMS.map(
    item => `- ${item.id}: ${item.label}`
  );
  const excluded = POS_CHECKLIST_EXCLUDED_IDS.join(", ");
  return `Elenco voci checklist (usa SOLO questi checklist_id in checklist_evidence, non inventare id):
${lines.join("\n")}

Per documento POS: per le voci ${excluded} non inserire riferimenti pagina (found=false o ometti la voce).`;
}

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

${buildChecklistPromptSection()}

Per ogni voce checklist trovata nel documento (soprattutto POS), compila checklist_evidence con checklist_id, found, page ed excerpt.
La pagina deve essere il numero di pagina del PDF dove compare il testo citato nell'excerpt.
Per ogni voce checklist, indica il riferimento pagina solo se trovi una sezione o un testo specifico riferibile a quella voce.
L'excerpt deve essere breve ma specifico (testo realmente presente nel documento).
Se non trovi un riferimento specifico: found=false oppure page=null ed excerpt=null.
Non usare una pagina generica per tutte le voci.
Non inventare numeri pagina.
Non compilare riferimenti senza excerpt.
Lascia updates.checkRefs vuoto e references.checklist vuoto: usa checklist_evidence.

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
    "checkRefs": {},
    "allegati": {},
    "allegatiScadenze": {},
    "maestranze": []
  },
  "checklist_evidence": [
    {
      "checklist_id": "a5",
      "found": true,
      "page": 5,
      "excerpt": "Responsabile del Servizio di Prevenzione e Protezione: ..."
    }
  ],
  "references": {
    "checklist": {}
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

  return raw || "Analisi AI non disponibile. Riprova tra poco.";
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
