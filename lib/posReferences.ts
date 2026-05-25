// @ts-nocheck
import { getPosChecklistItemsForReferences } from "@/lib/documentAnalysis";
import { extractPdfPages } from "@/lib/pdfPagesServer";

export const POS_SCANNED_WARNING =
  "Riferimenti pagina non rilevabili: PDF scansionato o testo non estraibile.";

export const POS_REFERENCE_KEYWORDS: Record<string, string[]> = {
  a1: [
    "dati identificativi",
    "ragione sociale",
    "datore di lavoro",
    "sede legale",
    "telefono",
    "impresa",
  ],
  a2: [
    "attività",
    "lavorazioni",
    "lavorazioni svolte",
    "subappalti",
    "descrizione lavori",
  ],
  a3: [
    "addetti primo soccorso",
    "addetti antincendio",
    "rls",
    "rlst",
    "emergenze",
  ],
  a4: ["medico competente", "sorveglianza sanitaria"],
  a5: ["rspp", "responsabile del servizio di prevenzione"],
  a6: ["preposto", "capocantiere", "direttore tecnico di cantiere", "dtc"],
  a7: ["elenco lavoratori", "nominativo lavoratori", "qualifica", "mansione"],
  b1: ["mansioni", "figure nominate", "compiti sicurezza"],
  c1: [
    "modalità organizzative",
    "turni",
    "organizzazione del cantiere",
    "descrizione attività",
  ],
  d1: ["ponteggi", "trabattelli", "opere provvisionali"],
  d2: ["macchine", "impianti", "attrezzature", "mezzi d'opera"],
  e1: ["sostanze pericolose", "schede di sicurezza", "sds", "prodotti chimici"],
  f1: ["rumore", "valutazione rumore", "esposizione sonora"],
  f2: ["vibrazioni", "valutazione vibrazioni"],
  g1: ["misure preventive", "misure protettive", "misure integrative", "psc"],
  h1: ["procedure complementari", "procedure di dettaglio", "richieste dal psc"],
  i1: ["dpi", "dispositivi di protezione individuale", "elenco dpi"],
};

/** Parole singole troppo generiche: non bastano da sole. */
const GENERIC_KEYWORDS = new Set([
  "attivita",
  "attività",
  "impresa",
  "sicurezza",
  "documento",
  "cantiere",
  "lavoro",
  "lavoratori",
  "descrizione",
  "organizzazione",
  "misure",
  "elenco",
  "emergenze",
  "qualifica",
  "mansione",
  "telefono",
]);

const MIN_PAGE_SCORE = 2;
const MIN_TOTAL_TEXT_CHARS = 150;

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countUsefulChars(pages = []) {
  return pages.reduce(
    (sum, p) => sum + normalizeText(p.text).replace(/\s/g, "").length,
    0
  );
}

function scorePageForItem(pageText, keywords, label) {
  const norm = normalizeText(pageText);
  if (!norm) return { score: 0, matched: [] };

  let score = 0;
  const matched = [];

  for (const rawKw of keywords) {
    const kw = normalizeText(rawKw);
    if (!kw || kw.length < 2) continue;
    if (!norm.includes(kw)) continue;

    matched.push(rawKw);
    score += kw.includes(" ") ? 2 : 1;
  }

  const labelWords = normalizeText(label)
    .split(" ")
    .filter(w => w.length > 5);
  let labelHits = 0;
  for (const word of labelWords) {
    if (norm.includes(word)) labelHits += 1;
  }
  if (labelHits >= 2) score += 3;

  return { score, matched };
}

function isWeakMatch(score, matched) {
  if (score < MIN_PAGE_SCORE) return true;

  const normalizedMatched = matched.map(k => normalizeText(k));
  const hasPhrase = normalizedMatched.some(k => k.includes(" "));
  const hasSpecific = normalizedMatched.some(
    k => !GENERIC_KEYWORDS.has(k) && (k.length >= 5 || hasPhrase)
  );

  if (hasSpecific || hasPhrase || score >= 3) return false;

  const onlyGeneric = normalizedMatched.every(k => GENERIC_KEYWORDS.has(k));
  return onlyGeneric;
}

export function findDeterministicCheckRefs(pages = [], checklistItems = []) {
  const checkRefs = {};

  for (const item of checklistItems) {
    const keywords = POS_REFERENCE_KEYWORDS[item.id];
    if (!keywords?.length) continue;

    let bestPage = null;
    let bestScore = 0;
    let bestMatched = [];

    for (const pageEntry of pages) {
      const { score, matched } = scorePageForItem(
        pageEntry.text,
        keywords,
        item.label
      );
      if (score > bestScore) {
        bestScore = score;
        bestPage = pageEntry.page;
        bestMatched = matched;
      }
    }

    if (bestPage == null || isWeakMatch(bestScore, bestMatched)) continue;
    checkRefs[item.id] = `pag. ${bestPage}`;
  }

  return checkRefs;
}

export type DeterministicPosRefsResult = {
  checkRefs: Record<string, string>;
  warnings: string[];
  referencesFound: number;
  referencesFoundRaw: number;
  failed: boolean;
  source: "deterministic" | "page_text" | "unavailable";
  noText: boolean;
};

export async function extractDeterministicPosReferences(options: {
  buffer?: Buffer | null;
  pageTexts?: { page: number; text: string }[];
  posChecks?: Record<string, string>;
}): Promise<DeterministicPosRefsResult> {
  let pages = [];

  if (options.buffer?.length) {
    try {
      pages = await extractPdfPages(options.buffer);
    } catch (err) {
      console.warn("[POS refs] extractPdfPages failed", err);
      pages = [];
    }
  } else if (options.pageTexts?.length) {
    pages = options.pageTexts
      .map(p => ({
        page: Number(p.page),
        text: String(p.text || "").trim(),
      }))
      .filter(p => Number.isFinite(p.page) && p.page > 0);
  }

  console.log("[POS refs] pages extracted", pages.length);

  const items = getPosChecklistItemsForReferences(options.posChecks || {});
  console.log("[POS refs] checklist items", items.length);

  const usefulChars = countUsefulChars(pages);
  const noText = !pages.length || usefulChars < MIN_TOTAL_TEXT_CHARS;

  console.log("[POS refs] scanned or no text", noText);

  if (noText) {
    console.log("[POS refs] refs found deterministic", 0);
    console.log("[POS refs] refs applied", 0);
    return {
      checkRefs: {},
      warnings: [POS_SCANNED_WARNING],
      referencesFound: 0,
      referencesFoundRaw: 0,
      failed: false,
      source: "unavailable",
      noText: true,
    };
  }

  const checkRefs = findDeterministicCheckRefs(pages, items);
  const foundCount = Object.keys(checkRefs).length;

  console.log("[POS refs] refs found deterministic", foundCount);
  console.log("[POS refs] refs applied", foundCount);

  return {
    checkRefs,
    warnings: [],
    referencesFound: foundCount,
    referencesFoundRaw: foundCount,
    failed: false,
    source: options.buffer?.length ? "deterministic" : "page_text",
    noText: false,
  };
}
