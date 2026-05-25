// @ts-nocheck
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { POS_CHECKLIST_EXCLUDED_IDS, isFieldEmpty } from "@/lib/documentAnalysis";
import { extractPdfPagesFromBuffer } from "@/lib/pdfPagesServer";

export const POS_SCANNED_WARNING =
  "Riferimenti pagina non rilevabili: PDF scansionato o testo non estraibile.";

export const POS_EXTRACTION_TECHNICAL_WARNING =
  "Errore tecnico durante l'estrazione dei riferimenti pagina.";

const MIN_SCANNED_TEXT_CHARS = 300;

/** Voci che possono coprire più pagine consecutive (es. a3 → pag. 7-8). */
const POS_RANGE_ITEM_IDS = new Set(["a3"]);

export const POS_SECTION_PATTERNS: Record<string, RegExp[]> = {
  a1: [
    /dati identificativi impresa affidataria/,
    /\bdati impresa\b/,
    /\bragione sociale\b/,
  ],
  a2: [
    /specifiche attivita e singole lavorazioni svolte in cantiere/,
    /attivita svolte in cantiere/,
    /lavorazioni svolte in cantiere/,
  ],
  a3: [
    /addetto al primo soccorso/,
    /addetto al servizio antincendio/,
    /rappresentante lavoratori per la sicurezza/,
    /\brls\b/,
    /\brlst\b/,
  ],
  a4: [/medico competente/, /sorveglianza sanitaria/],
  a5: [
    /responsabile servizio pp/,
    /responsabile del servizio di prevenzione/,
    /\brspp\b/,
  ],
  a6: [/direttore tecnico cantiere/, /capocantiere/, /preposto/],
  a7: [
    /numero e relative qualifiche dei lavoratori/,
    /lavoratori dipendenti/,
    /elenco lavoratori/,
  ],
  b1: [
    /specifiche mansioni inerenti la sicurezza/,
    /mansioni inerenti la sicurezza/,
  ],
  c1: [
    /specifiche attivita e singole lavorazioni svolte in cantiere/,
    /attivita svolte in cantiere/,
    /cronoprogramma/,
  ],
  d1: [
    /ponteggio metallico fisso/,
    /ponteggi/,
    /trabattello/,
    /opere provvisionali/,
  ],
  d2: [
    /elenco delle opere provvisionali macchine e impianti utilizzati in cantiere/,
    /macchine:/,
    /attrezzature:/,
    /\bimpianti\b/,
  ],
  e1: [
    /sostanze pericolose/,
    /schede di sicurezza/,
    /\bsds\b/,
    /prodotti chimici/,
  ],
  f1: [/valutazione rumore/, /\brumore\b/, /esposizione sonora/],
  f2: [/valutazione vibrazioni/, /\bvibrazioni\b/],
  g1: [
    /misure preventive/,
    /misure protettive/,
    /misure integrative/,
    /\bpsc\b/,
  ],
  h1: [
    /procedure complementari/,
    /procedure di dettaglio/,
    /richieste dal psc/,
  ],
  i1: [
    /dispositivi di protezione individuale/,
    /elenco dpi/,
    /\bdpi\b/,
  ],
};

export const POS_REFERENCE_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(POS_SECTION_PATTERNS).map(([id, patterns]) => [
    id,
    patterns.map(p => p.source),
  ])
);

export type PdfPageEntry = { page: number; text: string };

export function normalizePageText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, " ")
    .replace(/[^\w\s:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Unifica extractedPages / pageTexts / pageText / pages dal body JSON. */
export function normalizePagesFromPayload(input: unknown): PdfPageEntry[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map(entry => {
        const row = entry as Record<string, unknown>;
        const page = Number(row.page ?? row.pageNumber ?? row.page_number);
        const text = String(row.text ?? row.content ?? "").trim();
        return { page, text };
      })
      .filter(p => Number.isFinite(p.page) && p.page > 0);
  }

  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>)
      .map(([key, value]) => ({
        page: Number(key),
        text: String(value ?? "").trim(),
      }))
      .filter(p => Number.isFinite(p.page) && p.page > 0);
  }

  return [];
}

function isChecklistSi(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "si";
}

/**
 * Voci POS da referenziare: stato finale "si" e checkRefs vuoto.
 * Indipendente da applied_changes / skipped_changes.
 */
export function buildPosItemsToReference(
  finalChecks: Record<string, string> = {},
  finalCheckRefs: Record<string, string> = {}
) {
  return CHECKLIST_ITEMS.filter(item => {
    if (POS_CHECKLIST_EXCLUDED_IDS.includes(item.id)) return false;
    if (!isChecklistSi(finalChecks[item.id])) return false;
    if (!isFieldEmpty(finalCheckRefs[item.id])) return false;
    return true;
  }).map(item => ({
    id: item.id,
    label: item.label,
    lettera: item.lettera,
  }));
}

function patternLabel(pattern: RegExp | string) {
  return typeof pattern === "string" ? pattern : pattern.source;
}

function pageMatchesPattern(normText: string, pattern: RegExp | string) {
  if (!normText) return false;
  if (pattern instanceof RegExp) {
    return pattern.test(normText);
  }
  const needle = normalizePageText(pattern);
  return needle.length > 0 && normText.includes(needle);
}

export type PagePatternMatch = {
  page: number | null;
  pattern: string | null;
};

export function findPageByPatterns(
  pages: PdfPageEntry[],
  patterns: (RegExp | string)[]
): PagePatternMatch {
  if (!patterns?.length) return { page: null, pattern: null };

  const sorted = [...pages].sort((a, b) => a.page - b.page);

  for (const pattern of patterns) {
    for (const entry of sorted) {
      if (entry.page <= 1) continue;
      const norm = normalizePageText(entry.text);
      if (pageMatchesPattern(norm, pattern)) {
        return { page: entry.page, pattern: patternLabel(pattern) };
      }
    }
  }

  return { page: null, pattern: null };
}

export type PageRangePatternMatch = {
  ref: string | null;
  pattern: string | null;
  pages: number[];
};

export function findPageRangeByPatterns(
  pages: PdfPageEntry[],
  patterns: (RegExp | string)[]
): PageRangePatternMatch {
  if (!patterns?.length) {
    return { ref: null, pattern: null, pages: [] };
  }

  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const hits: { page: number; pattern: string }[] = [];

  for (const entry of sorted) {
    if (entry.page <= 1) continue;
    const norm = normalizePageText(entry.text);
    for (const pattern of patterns) {
      if (pageMatchesPattern(norm, pattern)) {
        hits.push({ page: entry.page, pattern: patternLabel(pattern) });
        break;
      }
    }
  }

  if (!hits.length) {
    return { ref: null, pattern: null, pages: [] };
  }

  const uniquePages = [...new Set(hits.map(h => h.page))].sort((a, b) => a - b);
  const min = uniquePages[0];
  const max = uniquePages[uniquePages.length - 1];

  if (uniquePages.length >= 2 && max - min === 1) {
    return {
      ref: `pag. ${min}-${max}`,
      pattern: hits.map(h => h.pattern).join(" | "),
      pages: uniquePages,
    };
  }

  const first = hits[0];
  return {
    ref: `pag. ${first.page}`,
    pattern: first.pattern,
    pages: [first.page],
  };
}

function countUsefulChars(pages: PdfPageEntry[] = []) {
  return pages.reduce(
    (sum, p) => sum + normalizePageText(p.text).replace(/\s/g, "").length,
    0
  );
}

export function stripErroneousBulkPageOneRefs(checkRefs = {}) {
  const out = { ...checkRefs };
  let discarded = 0;

  for (const [key, value] of Object.entries(checkRefs || {})) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "pag. 1" || normalized === "pag.1") {
      delete out[key];
      discarded += 1;
    }
  }

  if (discarded) {
    console.log("[POS refs] page 1 refs discarded", discarded);
  }

  return out;
}

export type PosRefMatchDebug = {
  id: string;
  label: string;
  found: boolean;
  page: string | number | null;
  matchedPattern: string | null;
};

export function findDeterministicCheckRefs(
  pages: PdfPageEntry[] = [],
  checklistItems: { id: string; label?: string }[] = []
) {
  const checkRefs: Record<string, string> = {};
  const matches: PosRefMatchDebug[] = [];

  for (const item of checklistItems) {
    const patterns = POS_SECTION_PATTERNS[item.id];
    if (!patterns?.length) continue;

    let matchedPageOrRange: string | number | null = null;
    let matchedPattern: string | null = null;

    if (POS_RANGE_ITEM_IDS.has(item.id)) {
      const rangeResult = findPageRangeByPatterns(pages, patterns);
      matchedPageOrRange = rangeResult.ref;
      matchedPattern = rangeResult.pattern;
    } else {
      const pageResult = findPageByPatterns(pages, patterns);
      matchedPageOrRange = pageResult.page;
      matchedPattern = pageResult.pattern;
    }

    const accepted =
      matchedPageOrRange != null &&
      matchedPattern != null &&
      !(typeof matchedPageOrRange === "number" && matchedPageOrRange <= 1);

    console.log("[POS refs exact] match", item.id, matchedPageOrRange, matchedPattern);

    matches.push({
      id: item.id,
      label: item.label || item.id,
      found: accepted,
      page: matchedPageOrRange,
      matchedPattern,
    });

    if (!accepted) continue;

    checkRefs[item.id] =
      typeof matchedPageOrRange === "number"
        ? `pag. ${matchedPageOrRange}`
        : String(matchedPageOrRange);
  }

  console.log("[POS refs exact] applied", Object.keys(checkRefs).length);

  return { checkRefs, matches };
}

export function applyPosPageReferences(
  currentCheckRefs: Record<string, string> = {},
  incomingCheckRefs: Record<string, string> = {}
) {
  const checkRefs = { ...(currentCheckRefs || {}) };
  const applied: Record<string, string> = {};

  for (const [key, value] of Object.entries(incomingCheckRefs || {})) {
    const ref = String(value || "").trim();
    if (!ref || /^pag\.\s*1$/i.test(ref)) continue;
    if (!isFieldEmpty(checkRefs[key])) continue;
    checkRefs[key] = ref;
    applied[key] = ref;
  }

  return {
    checkRefs,
    applied,
    count: Object.keys(applied).length,
  };
}

export type DeterministicPosRefsResult = {
  checkRefs: Record<string, string>;
  warnings: string[];
  referencesFound: number;
  referencesFoundRaw: number;
  failed: boolean;
  source: "deterministic" | "page_text" | "unavailable";
  noText: boolean;
  extractionFailed: boolean;
  debug_pos_refs: {
    pagesCount: number;
    totalChars: number;
    itemsToReference: string[];
    matches: PosRefMatchDebug[];
  };
};

export async function extractDeterministicPosReferences(options: {
  buffer?: Buffer | null;
  pageTexts?: PdfPageEntry[];
  posChecks?: Record<string, string>;
  posCheckRefs?: Record<string, string>;
  temporaryStoragePath?: string;
}): Promise<DeterministicPosRefsResult> {
  const emptyDebug = {
    pagesCount: 0,
    totalChars: 0,
    itemsToReference: [] as string[],
    matches: [] as PosRefMatchDebug[],
  };

  if (options.temporaryStoragePath) {
    console.log("[POS refs] temp path", options.temporaryStoragePath);
  }
  if (options.buffer?.length) {
    console.log("[POS refs] downloaded file bytes", options.buffer.length);
  }

  const finalChecks = options.posChecks || {};
  const finalCheckRefs = options.posCheckRefs || {};
  const itemsToReference = buildPosItemsToReference(finalChecks, finalCheckRefs);

  console.log(
    "[POS refs exact] itemsToReference",
    itemsToReference.map(i => i.id)
  );

  const clientPages = normalizePagesFromPayload(options.pageTexts);
  let pages: PdfPageEntry[] = [];
  let source: "deterministic" | "page_text" | "unavailable" = "unavailable";
  let extractionFailed = false;

  if (clientPages.length) {
    pages = clientPages;
    source = "page_text";
    console.log("[POS refs] using client page payload", pages.length);
  } else if (options.buffer?.length) {
    try {
      pages = await extractPdfPagesFromBuffer(options.buffer);
      source = "deterministic";
    } catch (err) {
      extractionFailed = true;
      console.error("[POS refs] extraction error", err);
      console.log("[POS refs exact] applied", 0);
      return {
        checkRefs: {},
        warnings: [
          `${POS_EXTRACTION_TECHNICAL_WARNING} ${err?.message ? `(${String(err.message).slice(0, 120)})` : ""}`.trim(),
        ],
        referencesFound: 0,
        referencesFoundRaw: itemsToReference.length,
        failed: true,
        source: "unavailable",
        noText: false,
        extractionFailed: true,
        debug_pos_refs: {
          ...emptyDebug,
          itemsToReference: itemsToReference.map(i => i.id),
        },
      };
    }
  }

  const totalChars = countUsefulChars(pages);
  console.log("[POS refs exact] pagesCount", pages.length);
  console.log("[POS refs exact] totalChars", totalChars);
  console.log("[POS refs] sample page 1", pages[0]?.text?.slice(0, 300) || "");

  const noText = pages.length > 0 && totalChars < MIN_SCANNED_TEXT_CHARS;
  console.log("[POS refs] scanned or no text", noText);

  if (!pages.length) {
    return {
      checkRefs: {},
      warnings: [POS_EXTRACTION_TECHNICAL_WARNING],
      referencesFound: 0,
      referencesFoundRaw: itemsToReference.length,
      failed: true,
      source: "unavailable",
      noText: false,
      extractionFailed: true,
      debug_pos_refs: {
        pagesCount: 0,
        totalChars: 0,
        itemsToReference: itemsToReference.map(i => i.id),
        matches: [],
      },
    };
  }

  if (noText) {
    console.log("[POS refs exact] applied", 0);
    return {
      checkRefs: {},
      warnings: [POS_SCANNED_WARNING],
      referencesFound: 0,
      referencesFoundRaw: itemsToReference.length,
      failed: false,
      source,
      noText: true,
      extractionFailed: false,
      debug_pos_refs: {
        pagesCount: pages.length,
        totalChars,
        itemsToReference: itemsToReference.map(i => i.id),
        matches: [],
      },
    };
  }

  if (!itemsToReference.length) {
    console.log("[POS refs exact] applied", 0);
    return {
      checkRefs: {},
      warnings: [],
      referencesFound: 0,
      referencesFoundRaw: 0,
      failed: false,
      source,
      noText: false,
      extractionFailed: false,
      debug_pos_refs: {
        pagesCount: pages.length,
        totalChars,
        itemsToReference: [],
        matches: [],
      },
    };
  }

  const { checkRefs, matches } = findDeterministicCheckRefs(pages, itemsToReference);
  const foundCount = Object.keys(checkRefs).length;

  return {
    checkRefs,
    warnings: [],
    referencesFound: foundCount,
    referencesFoundRaw: itemsToReference.length,
    failed: false,
    source,
    noText: false,
    extractionFailed: false,
    debug_pos_refs: {
      pagesCount: pages.length,
      totalChars,
      itemsToReference: itemsToReference.map(i => i.id),
      matches,
    },
  };
}
