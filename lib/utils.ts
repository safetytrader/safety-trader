// @ts-nocheck
import { CHECKLIST_ITEMS, FORMATION_SCADENZA } from "@/lib/constants";

// ── UTILITY ───────────────────────────────────────────────────────────────────
export function calcStatus(checks) {
  const req = CHECKLIST_ITEMS.filter(i=>i.required);
  const done = req.filter(i=>checks[i.id]==="si").length;
  if (done===req.length) return "idoneo";
  if (done===0) return "da verificare";
  if (done>=req.length*0.7) return "parziale";
  return "non idoneo";
}

/** Nominativo maestranza: trim, spazi singoli, MAIUSCOLO (mantiene accenti). */
export function normalizeWorkerName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("it-IT");
}

/** Normalizza codice fiscale italiano e corregge OCR O/0 nelle posizioni numeriche. */
export function normalizeCodiceFiscale(value) {
  const raw = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";

  const chars = raw.split("");
  const numericPositions = new Set([6, 7, 9, 10, 12, 13, 14]); // 0-based
  for (let i = 0; i < chars.length; i += 1) {
    if (!numericPositions.has(i)) continue;
    if (chars[i] === "O") chars[i] = "0";
  }

  const normalized = chars.join("").slice(0, 16);
  return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(normalized)
    ? normalized
    : normalized;
}

/** Qualifica derivata da attestato formazione — non va in campo qualifica. */
export function isFormationLikeQualifica(value) {
  const q = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!q) return false;
  return (
    q.includes("formazione") ||
    q.includes("corso") ||
    q.includes("rischio alto") ||
    q.includes("rischio medio") ||
    q.includes("rischio basso") ||
    q.includes("lavoratori rischio")
  );
}

// Normalizzazione nome per deduplicazione
export function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
}

// Calcola similarità tra due nomi (Jaccard similarity)
export function nameSimilarity(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;

  const t1 = n1.split(" ").filter(Boolean);
  const t2 = n2.split(" ").filter(Boolean);
  if (!t1.length || !t2.length) return 0;

  const commonExact = t1.filter(x => t2.includes(x)).length;
  const baseJaccard = commonExact / new Set([...t1, ...t2]).size;

  const tokenCharScore = t1.reduce((acc, a) => {
    const best = t2.reduce((b, c) => Math.max(b, charSimilarity(a, c)), 0);
    return acc + best;
  }, 0) / t1.length;

  return Math.max(baseJaccard, tokenCharScore);
}

function charSimilarity(a, b) {
  const s1 = String(a || "");
  const s2 = String(b || "");
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / Math.max(s1.length, s2.length, 1);
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

// Merge dettagliato di due maestranze con deduplicazione intelligente
export function mergeWorker(existing, incoming) {
  const merged = { ...existing };
  
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "nome") continue; // Usa nome existente
    if (value && value !== "—" && !merged[key]) {
      merged[key] = value;
    }
    // Se incoming ha un valore migliore, sostituisci
    if (value && value !== "—" && !merged[key]) {
      merged[key] = value;
    }
  }
  
  return merged;
}

// Deduplicazione intelligente con threshold 0.75
export function deduplicateWorkers(existing = [], incoming = []) {
  const result = [...existing];
  
  for (const incomingWorker of incoming) {
    const similarIdx = result.findIndex(
      existing => nameSimilarity(existing.nome, incomingWorker.nome) >= 0.75
    );
    
    if (similarIdx >= 0) {
      result[similarIdx] = mergeWorker(result[similarIdx], incomingWorker);
    } else {
      result.push(incomingWorker);
    }
  }
  
  return result;
}

// Calcola data di scadenza dalla data di conseguimento
export function calcScadenza(dataConseguimento, tipoCorso) {
  if (!dataConseguimento || dataConseguimento === "—" || dataConseguimento === "✓") return "✓";
  
  const parts = dataConseguimento.split("/");
  if (parts.length !== 3) return dataConseguimento;
  
  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
  
  if (isNaN(date.getTime())) return dataConseguimento;
  
  let yearsToAdd = FORMATION_SCADENZA[tipoCorso];
  
  // Se è una funzione (es. antincendio, primo soccorso), calcola in base al gruppo
  if (typeof yearsToAdd === "function") {
    yearsToAdd = yearsToAdd("A"); // Default gruppo A
  }
  
  if (!yearsToAdd) return "✓"; // Non scade
  
  const scadenza = new Date(date);
  scadenza.setFullYear(scadenza.getFullYear() + yearsToAdd);
  
  const d = String(scadenza.getDate()).padStart(2, "0");
  const m = String(scadenza.getMonth() + 1).padStart(2, "0");
  const y = String(scadenza.getFullYear()).slice(-2);
  
  return `${d}/${m}/${y}`;
}

function startOfDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** DD/MM/YYYY, DD/MM/YY (→ 20YY), YYYY-MM-DD */
export function parseDate(ds) {
  if (ds == null || ds === "" || ds === "—" || ds === "✓") return null;
  const t = String(ds).trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    const d = new Date(y, m - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const slash = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10);
    let year = parseInt(slash[3], 10);
    if (slash[3].length === 2) year = 2000 + year;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function isExpired(ds) {
  const d = parseDate(ds);
  if (!d) return false;
  const today = startOfDay(new Date());
  return startOfDay(d).getTime() < today.getTime();
}

export function isExpiringSoon(ds) {
  const d = parseDate(ds);
  if (!d) return false;
  const today = startOfDay(new Date());
  const exp = startOfDay(d);
  const diff = Math.round((exp.getTime() - today.getTime()) / 86400000);
  return diff >= 0 && diff < 60;
}

// Merge checks
export const mergeChecks = (a = {}, b = {}) => {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = a[k] === "si" || b[k] === "si" ? "si" : a[k] === "na" || b[k] === "na" ? "na" : a[k] === "no" || b[k] === "no" ? "no" : undefined;
    if (!out[k]) delete out[k];
  }
  return out;
};

export const mergeAllegati = (a = {}, b = {}) => {
  const out = { ...a };
  for (const k of Object.keys(b)) if (b[k]) out[k] = true;
  return out;
};

export const mkImpresa = () => ({
  id: Date.now(),
  nome: "",
  attivita: "",
  checks: {},
  checkRefs: {},
  allegati: {},
  allegatiScadenze: {},
  note: "",
  maestranze: [],
  analyzing: false,
  analyzed: false,
  aiSummary: "",
  uploadedFiles: [],
  extracting: false,
  extractLog: [],
  corsiSpeciali: { confinati: false, mdt: false, ple: false, gruista: false }
});
