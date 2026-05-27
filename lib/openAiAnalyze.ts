// @ts-nocheck

const POS_REFS_SCHEMA = `Schema (fino a 30 elementi in checklist_evidence):
{
  "checklist_evidence": [
    {
      "checklist_id": "a1",
      "found": true,
      "page": 3,
      "excerpt": "testo breve trovato nel documento"
    }
  ],
  "warnings": []
}`;

function buildPosRefsGroupPrompt(checklistItems = [], groupLabel = "") {
  const lines = (checklistItems || [])
    .map(item => `- ${item.id}: [lettera ${item.lettera}] ${item.label}`)
    .join("\n");

  return `Analizza il POS e trova i riferimenti pagina SOLO per le seguenti voci checklist${groupLabel ? ` (${groupLabel})` : ""}.
Per ogni voce elencata restituisci un elemento in checklist_evidence con:
- checklist_id (id esatto)
- found (true se trovi evidenza specifica nel documento, false altrimenti)
- page (numero intero di pagina, solo se found true)
- excerpt (testo breve copiato dal documento, minimo 12 caratteri, specifico per quella voce)

Regole:
- Restituisci SOLO JSON valido, senza testo extra.
- Non inventare pagine.
- Non usare riferimenti generici.
- Non usare la stessa pagina per tutte le voci se l'excerpt non è specifico per ciascuna.
- Molte voci possono stare sulla stessa pagina se gli excerpt sono diversi e specifici.
- Se non trovi evidenza per una voce, usa found: false oppure ometti la voce.

Voci da analizzare:
${lines}

${POS_REFS_SCHEMA}`;
}

const AI_SYSTEM_PROMPT = `Analisi documentale veloce per sicurezza cantieri.
Restituisci SOLO JSON valido, senza testo extra.
Non inventare dati: se assente usa null.
Date in YYYY-MM-DD.
confidence tra 0 e 1.
summary massimo 200 caratteri.
warnings massimo 5 elementi.
Nessun riferimento pagina, excerpt, checklist_evidence o updates.

document_type: DURC | POS | VISURA | FORMAZIONE_BASE | FORMAZIONE_SPECIFICA | FORMAZIONE_BASE_SPECIFICA | IDONEITA | UNILAV | PREPOSTO | ANTINCENDIO | PRIMO_SOCCORSO | PONTEGGI | MMT | PLE | GRU | SPAZI_CONFINATI | NOMINA_PRIMO_SOCCORSO | NOMINA_ANTINCENDIO | NOMINA_PREPOSTO | NOMINA_RLS | NOMINA_RSPP | NOMINA_ASPP | NOMINA_GENERICA_SICUREZZA | ALTRO

Estrai solo campi pertinenti al tipo:
- DURC: impresa, codice_fiscale_impresa, data_emissione, data_scadenza, ente
- POS: solo classificazione POS + impresa se presente (non estrarre sezioni dettagliate)
- VISURA: impresa, codice_fiscale_impresa, data_emissione, data_scadenza se reale
- UNILAV: lavoratore, codice_fiscale_lavoratore, mansione o qualifica lavorativa, tipo_comunicazione (assunzione/proroga/trasformazione/cessazione), tipo_contratto, data_inizio_rapporto, data_fine_contratto, data_proroga, data_scadenza (per proroga: data_proroga e/o data_scadenza)
- IDONEITA: lavoratore, mansione, data_emissione, data_scadenza
- PREPOSTO (priorità su formazione lavoratori): lavoratore, codice_fiscale_lavoratore, corso, data_erogazione, data_inizio, data_fine, data_scadenza se espressa, durata_ore
- ANTINCENDIO (priorità su formazione lavoratori): lavoratore, codice_fiscale_lavoratore, corso, data_erogazione, data_inizio, data_fine, data_scadenza se espressa, durata_ore, rischio/livello (basso/medio/alto/elevato)
- GRU (priorità su formazione lavoratori): lavoratore, codice_fiscale_lavoratore, corso, attrezzatura, data_erogazione, data_inizio, data_fine, data_scadenza se espressa, durata_ore
- FORMAZIONE_* (solo attestati lavoratori, NON preposto/antincendio/gru): lavoratore, codice_fiscale_lavoratore, corso, durata_ore, rischio (basso/medio/alto/non indicato), data_erogazione, data_inizio, data_fine, data_scadenza (solo se espressa nel documento), soggetto_formatore, tipo_formazione (generale/specifica/generale_specifica)

Classificazione NOMINA/DESIGNAZIONE (priorità massima su attestati formativi):
Se il documento è lettera di nomina/designazione/incarico SENZA attestato di frequenza/formazione/aggiornamento (senza durata ore, programma didattico, verifica finale, soggetto formatore, attestato di corso):
- designazione/nomina addetto primo soccorso → NOMINA_PRIMO_SOCCORSO (NON PRIMO_SOCCORSO)
- nomina/designazione addetto antincendio → NOMINA_ANTINCENDIO (NON ANTINCENDIO)
- nomina/designazione preposto → NOMINA_PREPOSTO (NON PREPOSTO)
- nomina RLS → NOMINA_RLS; nomina RSPP → NOMINA_RSPP; nomina ASPP → NOMINA_ASPP
- altra nomina sicurezza → NOMINA_GENERICA_SICUREZZA
Una nomina/designazione NON aggiorna scadenze formative.

Classificazione PREPOSTO (solo attestato formativo):
Se attestato/corso di formazione preposto (frequenza, durata ore, aggiornamento) → document_type PREPOSTO (NON nomina).

Classificazione ANTINCENDIO (solo attestato formativo):
Se attestato/corso antincendio con elementi di formazione (frequenza, durata ore, livello, programma) → ANTINCENDIO (NON nomina/designazione).

Classificazione GRU (priorità su FORMAZIONE_*, solo attestato formativo):
Se titolo/corso contiene gru, gru a torre, gru mobile, conduzione di gru, addetto alla conduzione di gru, operatore gru, abilitazione gru, attrezzatura gru, art. 73 attrezzature → document_type GRU (NON formazione base/specifica lavoratori).

Classificazione formazione lavoratori:
- FORMAZIONE_BASE: solo formazione generale/modulo generale/corso generale lavoratori, tipicamente 4 ore, SENZA formazione specifica o rischio specifico nel titolo.
- FORMAZIONE_SPECIFICA: solo formazione specifica/modulo specifico/rischio basso-medio-alto, NON attestato unico completo generale+specifica.
- FORMAZIONE_BASE_SPECIFICA: attestato unico completo lavoratori (generale+specifica insieme), es. corso lavoratori rischio alto 16 ore, rischio medio 12 ore, rischio basso 8 ore, formazione lavoratori completa, contiene sia modulo generale sia specifico.
Se l'attestato riporta un corso lavoratori completo di durata 8, 12 o 16 ore, oppure rischio basso/medio/alto complessivo, considera il documento come formazione generale + specifica e restituisci document_type FORMAZIONE_BASE_SPECIFICA.
Se il tipo di formazione non è chiaro, usa ALTRO e aggiungi warning.

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
    "qualifica": null,
    "data_emissione": null,
    "data_erogazione": null,
    "data_scadenza": null,
    "data_fine_contratto": null,
    "ente": null,
    "corso": null,
    "tipo_contratto": null,
    "tipo_comunicazione": null,
    "data_inizio_rapporto": null,
    "data_proroga": null,
    "data_inizio": null,
    "data_fine": null,
    "durata_ore": null,
    "rischio": null,
    "soggetto_formatore": null,
    "tipo_formazione": null,
    "attrezzatura": null
  },
  "warnings": []
}`;

const MAX_OUTPUT_TOKENS = 600;
const MAX_OUTPUT_TOKENS_POS_REFS_GROUP = 1800;
const MAX_OUTPUT_TOKENS_IDONEITA_VISION = 500;

const IDONEITA_VISION_PROMPT = `Analizza questo certificato di idoneità alla mansione. Devi individuare la data della visita e la periodicità della nuova visita medica. Cerca nella sezione in basso dove compaiono opzioni tipo "tra 1 anni", "tra 3 anni", "tra 5 anni", "altro". Determina quale casella è barrata/selezionata. Non usare il nome file. Non inventare. Se la casella "tra 1 anni" è selezionata, restituisci periodicita_nuova_visita_anni = 1. Calcola data_scadenza_calcolata sommando la periodicità alla data visita.

Restituisci SOLO JSON valido:
{
  "data_visita": "YYYY-MM-DD oppure null",
  "giudizio": "IDONEO / IDONEO CON PRESCRIZIONI / IDONEO CON LIMITAZIONI / INIDONEO / null",
  "periodicita_nuova_visita_anni": 1 | 2 | 3 | 5 | null,
  "periodicita_evidence": "testo o descrizione visiva della casella selezionata",
  "data_scadenza_calcolata": "YYYY-MM-DD oppure null",
  "confidence": 0-1
}`;

function buildHintsLine(hints = []) {
  if (!hints?.length) return "";
  return `Indizi tipo documento (non vincolanti): ${hints.join(", ")}.\n`;
}

async function callOpenAIResponses(content, maxOutputTokens = MAX_OUTPUT_TOKENS) {
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
      max_output_tokens: maxOutputTokens,
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

/** Vision mirata certificato idoneità: periodicità nuova visita (checkbox). */
export async function analyzeIdoneitaCertificateVisionWithOpenAI({
  base64,
  mimeType,
}: {
  base64: string;
  mimeType: string;
}) {
  const safeMime = String(mimeType || "application/pdf").toLowerCase();
  const isImage = safeMime.startsWith("image/");
  const fileData = `data:${safeMime};base64,${base64}`;

  const content = isImage
    ? [
        {
          type: "input_image",
          image_url: fileData,
        },
        {
          type: "input_text",
          text: IDONEITA_VISION_PROMPT,
        },
      ]
    : [
        {
          type: "input_file",
          filename: "certificato-idoneita.pdf",
          file_data: fileData,
        },
        {
          type: "input_text",
          text: IDONEITA_VISION_PROMPT,
        },
      ];

  return callOpenAIResponses(content, MAX_OUTPUT_TOKENS_IDONEITA_VISION);
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

/** Seconda analisi POS: riferimenti pagina per un gruppo di voci (file). */
export async function analyzePosPageReferencesGroupWithOpenAI({
  base64,
  mimeType,
  fileName,
  checklistItems,
  groupLabel,
}: {
  base64: string;
  mimeType: string;
  fileName: string;
  checklistItems: { id: string; label: string; lettera: string }[];
  groupLabel?: string;
}): Promise<string> {
  const safeMime = mimeType || "application/pdf";
  const fileData = `data:${safeMime};base64,${base64}`;
  const prompt = buildPosRefsGroupPrompt(checklistItems, groupLabel);

  return callOpenAIResponses(
    [
      {
        type: "input_file",
        filename: fileName || "documento.pdf",
        file_data: fileData,
      },
      {
        type: "input_text",
        text: prompt,
      },
    ],
    MAX_OUTPUT_TOKENS_POS_REFS_GROUP
  );
}

/** Seconda analisi POS: riferimenti pagina per un gruppo (testo per pagina). */
export async function analyzePosPageReferencesGroupTextWithOpenAI({
  fileName,
  documentText,
  checklistItems,
  groupLabel,
}: {
  fileName: string;
  documentText: string;
  checklistItems: { id: string; label: string; lettera: string }[];
  groupLabel?: string;
}): Promise<string> {
  const prompt = buildPosRefsGroupPrompt(checklistItems, groupLabel);
  const userText = `Nome file: ${fileName || "documento.pdf"}

Testo documento (con marcatori di pagina):
---
${documentText}
---

${prompt}`;

  return callOpenAIResponses(
    [
      {
        type: "input_text",
        text: userText,
      },
    ],
    MAX_OUTPUT_TOKENS_POS_REFS_GROUP
  );
}
