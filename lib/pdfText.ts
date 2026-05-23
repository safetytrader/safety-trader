// @ts-nocheck

export const MIN_USEFUL_TEXT_CHARS = 300;
export const MAX_AI_TEXT_CHARS = 12000;

function normalizeForMatch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Estrae testo da PDF (buffer). Restituisce stringa vuota se non disponibile. */
export async function extractPdfText(buffer) {
  if (!buffer?.length) return "";

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return String(result?.text || "");
  } catch (err) {
    console.warn("pdf-text-extraction: estrazione fallita", err?.message || err);
    return "";
  }
}

function countUsefulChars(text) {
  return String(text || "").replace(/\s+/g, "").length;
}

export function isTextSufficient(text, minChars = MIN_USEFUL_TEXT_CHARS) {
  return countUsefulChars(text) >= minChars;
}

/** Pulisce e limita il testo prima dell'invio all'AI. */
export function cleanDocumentText(rawText, maxChars = MAX_AI_TEXT_CHARS) {
  let text = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";

  const lines = text.split("\n");
  const counts = new Map();
  for (const line of lines) {
    const key = line.trim();
    if (key.length < 4) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const repeated = new Set(
    [...counts.entries()].filter(([, n]) => n >= 4).map(([line]) => line)
  );

  if (repeated.size) {
    text = lines
      .filter(line => !repeated.has(line.trim()))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n[...testo troncato...]`;
  }

  return text;
}

/** Indizi non vincolanti da nome file e prime righe di testo. */
export function buildDocumentHints(fileName = "", text = "") {
  const sample = normalizeForMatch(`${fileName}\n${String(text).slice(0, 2500)}`);
  const hints = [];

  if (/durc|regolarita\s+contributiva|documento\s+unico/.test(sample)) {
    hints.push("DURC");
  }
  if (/pos|piano\s+operativo\s+di\s+sicurezza|piano\s+operativo/.test(sample)) {
    hints.push("POS");
  }
  if (/visura|camerale|cciaa|camera\s+di\s+commercio/.test(sample)) {
    hints.push("VISURA");
  }
  if (/unilav/.test(sample)) {
    hints.push("UNILAV");
  }
  if (/idoneit|giudizio\s+di\s+idoneita|idoneita\s+sanitaria/.test(sample)) {
    hints.push("IDONEITA");
  }
  if (
    /rischio\s+(alto|medio|basso)|lavoratori.*\b(8|12|16)\s*ore|formazione\s+lavoratori\s+complet|modulo\s+generale.*modulo\s+specifico|generale\s+e\s+specifica/.test(
      sample
    )
  ) {
    hints.push("FORMAZIONE_BASE_SPECIFICA");
  } else if (/formazione\s+specifica|modulo\s+specifico|rischio\s+specifico/.test(sample)) {
    hints.push("FORMAZIONE_SPECIFICA");
  } else if (/formazione\s+generale|modulo\s+generale|\b4\s*ore\b/.test(sample)) {
    hints.push("FORMAZIONE_BASE");
  } else if (/formazione|attestato|corso/.test(sample)) {
    hints.push("FORMAZIONE_BASE");
  }
  if (/preposto/.test(sample)) {
    hints.push("PREPOSTO");
  }
  if (/antincendio/.test(sample)) {
    hints.push("ANTINCENDIO");
  }
  if (/primo\s+soccorso|pronto\s+soccorso/.test(sample)) {
    hints.push("PRIMO_SOCCORSO");
  }
  if (/pontegg/.test(sample)) {
    hints.push("PONTEGGI");
  }
  if (/\bmmt\b|\bmdt\b/.test(sample)) {
    hints.push("MMT");
  }
  if (/\bple\b/.test(sample)) {
    hints.push("PLE");
  }
  if (/\bgru\b|gruista/.test(sample)) {
    hints.push("GRU");
  }
  if (/spazi\s+confinat|confinat/.test(sample)) {
    hints.push("SPAZI_CONFINATI");
  }

  return [...new Set(hints)];
}

export function isPdfMimeOrName(mimeType, fileName) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

export function isImageMime(mimeType) {
  return String(mimeType || "").toLowerCase().startsWith("image/");
}
