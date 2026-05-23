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

// Normalizzazione nome per deduplicazione
export function normalizeName(name) {
  return name
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
  if (n1 === n2) return 1;
  
  const set1 = new Set(n1.split(" "));
  const set2 = new Set(n2.split(" "));
  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;
  
  return union === 0 ? 0 : intersection / union;
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

// Parse data
export function parseDate(ds) {
  if (!ds || ds === "✓") return null;
  const p = ds.split("/");
  if (p.length !== 3) return null;
  return new Date(`${p[2].length === 2 ? `20${p[2]}` : p[2]}-${p[1]}-${p[0]}`);
}

export function isExpired(ds) {
  const d = parseDate(ds);
  return d ? d < new Date() : false;
}

export function isExpiringSoon(ds) {
  const d = parseDate(ds);
  if (!d) return false;
  const diff = (d - new Date()) / 86400000;
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
