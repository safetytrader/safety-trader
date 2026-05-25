// @ts-nocheck
import { getPosChecklistItemsForReferences } from "@/lib/documentAnalysis";
import { extractPdfPagesFromBuffer } from "@/lib/pdfPagesServer";

export const POS_SCANNED_WARNING =
  "Riferimenti pagina non rilevabili: PDF scansionato o testo non estraibile.";

export const POS_EXTRACTION_TECHNICAL_WARNING =
  "Errore tecnico durante l'estrazione dei riferimenti pagina.";

const SCORE_STRONG_TITLE = 10;
const SCORE_PHRASE = 6;
const SCORE_ACRONYM = 5;
const SCORE_GENERIC = 1;
const PAGE_ONE_PENALTY = 8;
const MIN_ACCEPT_SCORE = 6;
const MIN_SCANNED_TEXT_CHARS = 300;
const MAX_SAME_PAGE_WITHOUT_SPECIFIC = 5;

/** @deprecated Derivato da POS_ITEM_RULES; non usare per matching. */
export const POS_REFERENCE_KEYWORDS: Record<string, string[]> = {};

const GENERIC_ONLY_TERMS = new Set([
  "impresa",
  "sicurezza",
  "cantiere",
  "lavori",
  "attivita",
  "attività",
  "lavoratori",
  "documento",
  "pos",
  "piano operativo",
  "lavoro",
  "descrizione",
  "organizzazione",
  "misure",
  "elenco",
  "emergenze",
  "qualifica",
  "mansione",
  "telefono",
  "macchine",
  "impianti",
  "attrezzature",
  "ponteggi",
]);

/** Titoli forti, frasi e acronimi per voce checklist POS. */
const POS_ITEM_RULES: Record<
  string,
  { strongTitles: string[]; phrases: string[]; acronyms: string[]; generic?: string[] }
> = {
  a1: {
    strongTitles: [
      "DATI IDENTIFICATIVI IMPRESA AFFIDATARIA",
      "DATI IMPRESA",
      "Ragione sociale",
    ],
    phrases: ["dati identificativi impresa", "impresa affidataria", "sede legale"],
    acronyms: [],
    generic: ["impresa", "datore di lavoro"],
  },
  a2: {
    strongTitles: [
      "SPECIFICHE ATTIVITÀ E SINGOLE LAVORAZIONI SVOLTE IN CANTIERE",
      "SPECIFICHE ATTIVITA E SINGOLE LAVORAZIONI SVOLTE IN CANTIERE",
      "Attività svolte in cantiere",
      "Lavorazioni svolte in cantiere",
    ],
    phrases: [
      "specifiche attività e singole lavorazioni",
      "lavorazioni svolte in cantiere",
      "attività e lavorazioni",
    ],
    acronyms: [],
    generic: ["attività", "lavorazioni", "subappalti"],
  },
  a3: {
    strongTitles: [
      "Addetto al primo soccorso",
      "Addetto al servizio antincendio",
      "Rappresentante Lavoratori per la sicurezza",
      "addetti primo soccorso e antincendio",
    ],
    phrases: ["addetti primo soccorso", "addetti antincendio", "primo soccorso"],
    acronyms: ["RLS", "RLST"],
    generic: ["emergenze", "antincendio"],
  },
  a4: {
    strongTitles: ["Medico Competente", "Sorveglianza sanitaria"],
    phrases: ["medico competente", "sorveglianza sanitaria"],
    acronyms: [],
    generic: [],
  },
  a5: {
    strongTitles: [
      "Responsabile servizio PP",
      "Responsabile del Servizio di Prevenzione e Protezione",
    ],
    phrases: ["responsabile del servizio di prevenzione", "responsabile servizio"],
    acronyms: ["RSPP"],
    generic: [],
  },
  a6: {
    strongTitles: [
      "Direttore Tecnico Cantiere",
      "Capocantiere",
      "Preposto",
    ],
    phrases: [
      "direttore tecnico di cantiere",
      "direttore tecnico cantiere",
      "capocantiere",
      "preposto",
    ],
    acronyms: ["DTC"],
    generic: [],
  },
  a7: {
    strongTitles: [
      "Numero e relative qualifiche dei lavoratori",
      "Lavoratori dipendenti",
      "Elenco lavoratori",
      "numero e qualifiche lavoratori",
    ],
    phrases: [
      "numero e qualifiche",
      "qualifiche dei lavoratori",
      "nominativo lavoratori",
    ],
    acronyms: [],
    generic: ["lavoratori", "qualifica"],
  },
  b1: {
    strongTitles: [
      "Specifiche mansioni inerenti la sicurezza",
      "Mansioni inerenti la sicurezza",
    ],
    phrases: ["mansioni inerenti la sicurezza", "mansioni sicurezza"],
    acronyms: [],
    generic: ["mansioni", "compiti sicurezza"],
  },
  c1: {
    strongTitles: [
      "Specifiche attività e singole lavorazioni svolte in cantiere",
      "Attività svolte in cantiere",
      "Cronoprogramma",
    ],
    phrases: [
      "modalità organizzative",
      "organizzazione del cantiere",
      "cronoprogramma",
    ],
    acronyms: [],
    generic: ["turni", "descrizione attività"],
  },
  d1: {
    strongTitles: [
      "ponteggio metallico fisso",
      "ponteggi",
      "trabattello",
      "opere provvisionali",
    ],
    phrases: ["ponteggi", "trabattelli", "opere provvisionali"],
    acronyms: [],
    generic: ["elenco opere provvisionali"],
  },
  d2: {
    strongTitles: [
      "ELENCO delle Opere Provvisionali, Macchine e Impianti utilizzati in cantiere",
      "Opere Provvisionali, Macchine e Impianti",
      "macchine e impianti",
    ],
    phrases: [
      "elenco opere provvisionali macchine",
      "macchine e impianti utilizzati",
      "mezzi d'opera",
    ],
    acronyms: [],
    generic: ["macchine", "impianti", "attrezzature"],
  },
  e1: {
    strongTitles: [],
    phrases: ["sostanze pericolose", "schede di sicurezza", "prodotti chimici"],
    acronyms: ["SDS"],
    generic: [],
  },
  f1: {
    strongTitles: [],
    phrases: ["valutazione rumore", "esposizione sonora"],
    acronyms: [],
    generic: ["rumore"],
  },
  f2: {
    strongTitles: [],
    phrases: ["valutazione vibrazioni"],
    acronyms: [],
    generic: ["vibrazioni"],
  },
  g1: {
    strongTitles: [],
    phrases: [
      "misure preventive",
      "misure protettive",
      "misure integrative",
    ],
    acronyms: ["PSC"],
    generic: ["misure"],
  },
  h1: {
    strongTitles: [],
    phrases: [
      "procedure complementari",
      "procedure di dettaglio",
      "richieste dal psc",
    ],
    acronyms: [],
    generic: [],
  },
  i1: {
    strongTitles: ["elenco DPI", "dispositivi di protezione individuale"],
    phrases: ["dispositivi di protezione individuale", "elenco dpi"],
    acronyms: ["DPI"],
    generic: [],
  },
};

for (const [id, rules] of Object.entries(POS_ITEM_RULES)) {
  POS_REFERENCE_KEYWORDS[id] = [
    ...rules.strongTitles,
    ...rules.phrases,
    ...rules.acronyms,
    ...(rules.generic || []),
  ];
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(normPage, rawTerm, kind) {
  const term = normalizeText(rawTerm);
  if (!term || term.length < 2) return false;

  if (kind === "acronym" && term.length <= 5) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    return re.test(normPage);
  }

  return normPage.includes(term);
}

function buildExcerpt(pageText, matchedTerms) {
  const raw = String(pageText || "");
  if (!raw.trim() || !matchedTerms.length) return "";

  const priority = ["strong", "phrase", "acronym", "generic"];
  const best = [...matchedTerms].sort(
    (a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind)
  )[0];

  const needle = String(best.term || "");
  const idx = raw.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) {
    return raw.replace(/\s+/g, " ").trim().slice(0, 180);
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(raw.length, idx + needle.length + 120);
  return raw.slice(start, end).replace(/\s+/g, " ").trim();
}

function isGenericExcerpt(excerpt) {
  const norm = normalizeText(excerpt);
  if (!norm || norm.length < 8) return true;

  const words = norm.split(" ").filter(w => w.length > 2);
  if (!words.length) return true;

  const genericHits = words.filter(w => GENERIC_ONLY_TERMS.has(w)).length;
  return genericHits >= Math.max(2, Math.ceil(words.length * 0.7));
}

function countUsefulChars(pages = []) {
  return pages.reduce(
    (sum, p) => sum + normalizeText(p.text).replace(/\s/g, "").length,
    0
  );
}

function parsePageFromRef(value) {
  const m = String(value || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Rimuove riferimenti errati precedenti (molte voci tutte a pag. 1). */
export function stripErroneousBulkPageOneRefs(checkRefs = {}) {
  const entries = Object.entries(checkRefs || {});
  const pageOneKeys = entries
    .filter(([, v]) => parsePageFromRef(v) === 1)
    .map(([k]) => k);

  if (pageOneKeys.length <= MAX_SAME_PAGE_WITHOUT_SPECIFIC) {
    return { ...checkRefs };
  }

  const out = { ...checkRefs };
  for (const key of pageOneKeys) {
    delete out[key];
  }
  console.log("[POS refs] page 1 refs discarded", pageOneKeys.length);
  return out;
}

function scorePageForItemRules(pageText, pageNum, rules) {
  const norm = normalizeText(pageText);
  if (!norm) {
    return {
      score: 0,
      matchedTerms: [],
      hasStrongTitle: false,
      hasPhrase: false,
      hasAcronym: false,
      onlyGeneric: true,
      excerpt: "",
    };
  }

  let score = 0;
  const matchedTerms = [];
  let hasStrongTitle = false;
  let hasPhrase = false;
  let hasAcronym = false;
  let genericHits = 0;

  for (const title of rules.strongTitles || []) {
    if (includesTerm(norm, title, "strong")) {
      score += SCORE_STRONG_TITLE;
      hasStrongTitle = true;
      matchedTerms.push({ kind: "strong", term: title });
    }
  }

  for (const phrase of rules.phrases || []) {
    if (includesTerm(norm, phrase, "phrase")) {
      score += SCORE_PHRASE;
      hasPhrase = true;
      matchedTerms.push({ kind: "phrase", term: phrase });
    }
  }

  for (const acronym of rules.acronyms || []) {
    if (includesTerm(norm, acronym, "acronym")) {
      score += SCORE_ACRONYM;
      hasAcronym = true;
      matchedTerms.push({ kind: "acronym", term: acronym });
    }
  }

  for (const generic of rules.generic || []) {
    if (includesTerm(norm, generic, "generic")) {
      score += SCORE_GENERIC;
      genericHits += 1;
      matchedTerms.push({ kind: "generic", term: generic });
    }
  }

  const onlyGeneric =
    !hasStrongTitle &&
    !hasPhrase &&
    !hasAcronym &&
    matchedTerms.length > 0 &&
    matchedTerms.every(m => m.kind === "generic");

  if (pageNum === 1) {
    score -= PAGE_ONE_PENALTY;
  }

  const excerpt = buildExcerpt(pageText, matchedTerms);

  return {
    score,
    matchedTerms,
    hasStrongTitle,
    hasPhrase,
    hasAcronym,
    onlyGeneric,
    genericHits,
    excerpt,
  };
}

function isAcceptableMatch(result, pageNum) {
  const {
    score,
    hasStrongTitle,
    hasPhrase,
    hasAcronym,
    onlyGeneric,
    matchedTerms,
    excerpt,
  } = result;

  if (!matchedTerms.length || onlyGeneric) return false;

  if (pageNum === 1) {
    if (!hasStrongTitle && !hasPhrase) return false;
    if (score < MIN_ACCEPT_SCORE) return false;
  }

  if (hasStrongTitle || hasPhrase) {
    return score >= MIN_ACCEPT_SCORE;
  }

  if (hasAcronym && score >= SCORE_ACRONYM && !onlyGeneric) {
    return true;
  }

  if (score >= MIN_ACCEPT_SCORE && (hasAcronym || hasPhrase || hasStrongTitle)) {
    return !isGenericExcerpt(excerpt);
  }

  return false;
}

type PosRefCandidate = {
  page: number;
  score: number;
  matchedTerms: { kind: string; term: string }[];
  excerpt: string;
  accepted: boolean;
  hasStrongTitle: boolean;
  hasPhrase: boolean;
};

function finalizeCandidates(candidates: Record<string, PosRefCandidate>) {
  const byPage = new Map();

  for (const [itemId, c] of Object.entries(candidates)) {
    if (!c.accepted) continue;
    const list = byPage.get(c.page) || [];
    list.push(itemId);
    byPage.set(c.page, list);
  }

  for (const [page, itemIds] of byPage.entries()) {
    if (itemIds.length <= MAX_SAME_PAGE_WITHOUT_SPECIFIC) continue;

    if (page === 1) {
      for (const id of itemIds) {
        candidates[id].accepted = false;
      }
      console.log(
        "[POS refs] discarded duplicate page 1 cluster",
        itemIds.length
      );
      continue;
    }

    const allGeneric = itemIds.every(id =>
      isGenericExcerpt(candidates[id].excerpt)
    );
    if (allGeneric) {
      for (const id of itemIds) {
        if (!candidates[id].hasStrongTitle && !candidates[id].hasPhrase) {
          candidates[id].accepted = false;
        }
      }
    }
  }

  const checkRefs = {};
  let discardedPageOneCount = 0;

  for (const [itemId, c] of Object.entries(candidates)) {
    if (!c.accepted) {
      if (c.page === 1) discardedPageOneCount += 1;
      continue;
    }
    checkRefs[itemId] = `pag. ${c.page}`;
  }

  return { checkRefs, discardedPageOneCount };
}

export function findDeterministicCheckRefs(pages = [], checklistItems = []) {
  const candidates = {};

  for (const item of checklistItems) {
    const rules = POS_ITEM_RULES[item.id];
    if (!rules) continue;

    let bestPage = null;
    let bestScore = 0;
    let bestResult = null;

    for (const pageEntry of pages) {
      const result = scorePageForItemRules(
        pageEntry.text,
        pageEntry.page,
        rules
      );

      if (result.score > bestScore) {
        bestScore = result.score;
        bestPage = pageEntry.page;
        bestResult = result;
      }
    }

    const accepted =
      bestPage != null &&
      bestResult != null &&
      isAcceptableMatch(bestResult, bestPage);

    const matchedTerms = (bestResult?.matchedTerms || []).map(m => m.term);

    console.log("[POS refs]", item.id, {
      bestPage,
      score: bestScore,
      matchedTerms,
      accepted,
    });

    candidates[item.id] = {
      page: bestPage,
      score: bestScore,
      matchedTerms: bestResult?.matchedTerms || [],
      excerpt: bestResult?.excerpt || "",
      accepted,
      hasStrongTitle: Boolean(bestResult?.hasStrongTitle),
      hasPhrase: Boolean(bestResult?.hasPhrase),
    };
  }

  const { checkRefs, discardedPageOneCount } = finalizeCandidates(candidates);
  console.log("[POS refs] refs applied", Object.keys(checkRefs).length);
  if (discardedPageOneCount) {
    console.log("[POS refs] page 1 refs discarded", discardedPageOneCount);
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
  extractionFailed: boolean;
};

export async function extractDeterministicPosReferences(options: {
  buffer?: Buffer | null;
  pageTexts?: { page: number; text: string }[];
  posChecks?: Record<string, string>;
  temporaryStoragePath?: string;
  existingCheckRefs?: Record<string, string>;
}): Promise<DeterministicPosRefsResult> {
  if (options.temporaryStoragePath) {
    console.log("[POS refs] temp path", options.temporaryStoragePath);
  }
  if (options.buffer?.length) {
    console.log("[POS refs] downloaded file bytes", options.buffer.length);
  }

  const items = getPosChecklistItemsForReferences(options.posChecks || {});
  console.log("[POS refs] checklist items", items.length);

  let pages = [];
  let extractionFailed = false;

  if (options.buffer?.length) {
    try {
      pages = await extractPdfPagesFromBuffer(options.buffer);
    } catch (err) {
      extractionFailed = true;
      console.error("[POS refs] extraction error", err);
      console.log("[POS refs] refs found deterministic", 0);
      console.log("[POS refs] refs applied", 0);
      return {
        checkRefs: {},
        warnings: [
          `${POS_EXTRACTION_TECHNICAL_WARNING} ${err?.message ? `(${String(err.message).slice(0, 120)})` : ""}`.trim(),
        ],
        referencesFound: 0,
        referencesFoundRaw: 0,
        failed: true,
        source: "unavailable",
        noText: false,
        extractionFailed: true,
      };
    }
  } else if (options.pageTexts?.length) {
    pages = options.pageTexts
      .map(p => ({
        page: Number(p.page),
        text: String(p.text || "").trim(),
      }))
      .filter(p => Number.isFinite(p.page) && p.page > 0);
    console.log("[POS refs] using client extractedPages", pages.length);
  }

  const totalChars = countUsefulChars(pages);
  console.log("[POS refs] pages extracted", pages.length);
  console.log("[POS refs] total text chars", totalChars);
  console.log("[POS refs] sample page 1", pages[0]?.text?.slice(0, 300) || "");

  const noText = pages.length > 0 && totalChars < MIN_SCANNED_TEXT_CHARS;

  console.log("[POS refs] scanned or no text", noText);

  if (!pages.length && !options.buffer?.length && !options.pageTexts?.length) {
    return {
      checkRefs: {},
      warnings: [POS_EXTRACTION_TECHNICAL_WARNING],
      referencesFound: 0,
      referencesFoundRaw: 0,
      failed: true,
      source: "unavailable",
      noText: false,
      extractionFailed: true,
    };
  }

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
      extractionFailed: false,
    };
  }

  const rawCandidates = items.length;
  const checkRefs = findDeterministicCheckRefs(pages, items);
  const foundCount = Object.keys(checkRefs).length;

  console.log("[POS refs] refs found deterministic", foundCount);

  return {
    checkRefs,
    warnings: [],
    referencesFound: foundCount,
    referencesFoundRaw: rawCandidates,
    failed: false,
    source: options.buffer?.length ? "deterministic" : "page_text",
    noText: false,
    extractionFailed: false,
  };
}
