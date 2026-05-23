// @ts-nocheck
import { ALLEGATI_CONFIG, CHECKLIST_ITEMS, FORMATION_SCADENZA } from "@/lib/constants";
import {
  deduplicateWorkers,
  isFormationLikeQualifica,
  nameSimilarity,
  normalizeWorkerName,
} from "@/lib/utils";

/** Chiavi allegati nel DB app (testo completo) */
export const ALLEGATI_KEY_MAP = {
  durc: "D.U.R.C.",
  visura: "Visura Camerale (CC.I.AA.)",
  pos: null,
};

/** Checklist non aggiornata automaticamente da documento POS */
export const POS_CHECKLIST_EXCLUDED_IDS = ["g2", "l1", "l2", "l3", "l4"];

const CHECKLIST_ID_SET = new Set(CHECKLIST_ITEMS.map(item => item.id));

const MIN_CHECKLIST_EXCERPT_LENGTH = 12;

function safeLower(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

export const POS_CHECKLIST_MIN_CONFIDENCE = 0.65;

export const POS_LOW_CONFIDENCE_WARNING =
  "Documento riconosciuto come POS con bassa confidenza: aggiornamenti non applicati automaticamente.";

function applyPosChecklistMapping(updates, confidence = 0) {
  const warnings = [];
  if (confidence < POS_CHECKLIST_MIN_CONFIDENCE) {
    warnings.push(POS_LOW_CONFIDENCE_WARNING);
    return warnings;
  }

  for (const item of CHECKLIST_ITEMS) {
    if (POS_CHECKLIST_EXCLUDED_IDS.includes(item.id)) continue;
    updates.checklist[item.id] = "si";
  }

  if (resolveAllegatoKey("pos")) {
    updates.allegati.pos = true;
  }

  return warnings;
}

export const AI_STATUS = {
  DA_ANALIZZARE: "da_analizzare",
  IN_CORSO: "analisi_in_corso",
  ANALIZZATO: "analizzato",
  ERRORE: "errore_analisi",
};

export const AI_STATUS_LABELS = {
  [AI_STATUS.DA_ANALIZZARE]: "Da analizzare",
  [AI_STATUS.IN_CORSO]: "Analisi in corso",
  [AI_STATUS.ANALIZZATO]: "Analizzato",
  [AI_STATUS.ERRORE]: "Errore analisi",
  caricato: "Da analizzare",
};

export function aiStatusLabel(stato) {
  const key = safeLower(stato);
  return AI_STATUS_LABELS[key] || AI_STATUS_LABELS[AI_STATUS.DA_ANALIZZARE];
}

export function normalizeAiStatus(stato) {
  const key = safeLower(stato);
  if (key === "pending" || key === "caricato" || !key) return AI_STATUS.DA_ANALIZZARE;
  if (key === "analisi_in_corso" || key === "in_corso") return AI_STATUS.IN_CORSO;
  if (key === "analizzato") return AI_STATUS.ANALIZZATO;
  if (key === "errore" || key === "errore_analisi") return AI_STATUS.ERRORE;
  return key;
}

export function isFieldEmpty(value) {
  if (value == null) return true;
  if (typeof value === "boolean") return value === false;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" || t === "—";
  }
  return false;
}

export function isChecklistEmpty(value) {
  if (value == null) return true;
  const t = String(value).trim().toLowerCase();
  return t === "" || t === "n.a." || t === "na" || t === "n/a";
}

export const IMPRESA_MISMATCH_WARNING =
  "L'impresa rilevata nel documento non coincide con l'impresa selezionata.";

const IMPRESA_STOPWORDS = new Set([
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "delle",
  "e",
  "il",
  "la",
  "le",
  "lo",
  "gli",
  "un",
  "una",
  "srl",
  "srls",
  "spa",
  "sas",
  "snc",
  "ss",
]);

function normalizeImpresaName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/[,;'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function impresaTokens(name) {
  const normalized = normalizeImpresaName(name);
  return normalized
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ""))
    .filter(t => t.length >= 2 && !IMPRESA_STOPWORDS.has(t));
}

/** Confronto tollerante tra impresa selezionata e nome estratto dal documento */
export function impresaNamesReasonablyMatch(selectedName, extractedName) {
  const selected = String(selectedName || "").trim();
  const extracted = String(extractedName || "").trim();
  if (!extracted) return true;
  if (!selected) return true;

  const a = normalizeImpresaName(selected);
  const b = normalizeImpresaName(extracted);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokA = impresaTokens(selected);
  const tokB = impresaTokens(extracted);
  if (!tokA.length || !tokB.length) return true;

  const setB = new Set(tokB);
  const common = tokA.filter(t => setB.has(t)).length;
  const smaller = Math.min(tokA.length, tokB.length);
  return common / smaller >= 0.6;
}

export function appendImpresaMismatchWarning(warnings, extractedImpresa, selectedImpresa) {
  const list = Array.isArray(warnings) ? [...warnings] : [];
  const extracted = String(extractedImpresa || "").trim();
  if (!extracted) return list;
  if (impresaNamesReasonablyMatch(selectedImpresa, extracted)) return list;
  if (!list.includes(IMPRESA_MISMATCH_WARNING)) list.push(IMPRESA_MISMATCH_WARNING);
  return list;
}

/** Converte YYYY-MM-DD in dd/mm/yy per l'app */
export function formatIsoDateToApp(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
}

export function parseAiJsonResponse(text) {
  let s = String(text || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const st = s.indexOf("{");
  if (st === -1) throw new Error("Documento non leggibile dall'AI.");
  let depth = 0;
  let end = -1;
  for (let i = st; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    s = s.slice(st).replace(/,\s*$/, "");
    const ob = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
    for (let i = 0; i < ob; i++) s += "}";
  } else {
    s = s.slice(st, end + 1);
  }
  const parsed = JSON.parse(s);
  return normalizeAiPayload(parsed);
}

const GENERIC_EXCERPT_PATTERNS = [
  /^piano\s+operativo/i,
  /^pos\b/i,
  /^sicurezza\b/i,
  /^documento\b/i,
  /^allegato\b/i,
  /^sezione\b/i,
  /^vedi\b/i,
  /^pag\.\s*\d+\s*$/i,
  /^n\.?\s*a\.?$/i,
  /^non\s+specificato/i,
  /^presente\b/i,
  /^si\b$/i,
  /^ok\b$/i,
  /^conforme\b/i,
  /^riferimento\b/i,
];

function parsePageNumber(page) {
  if (page == null || page === "") return null;
  const raw = String(page).trim().replace(/^pag\.?\s*/i, "");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isGenericExcerpt(excerpt) {
  const t = String(excerpt ?? "").trim();
  if (t.length < MIN_CHECKLIST_EXCERPT_LENGTH) return true;
  const lower = safeLower(t);
  return GENERIC_EXCERPT_PATTERNS.some(pattern => pattern.test(lower));
}

function isKnownChecklistId(id) {
  return CHECKLIST_ID_SET.has(String(id ?? "").trim());
}

function isEvidenceFound(entry) {
  if (entry?.found === false) return false;
  if (entry?.found === true || entry?.found === "true") return true;
  return false;
}

function normalizeEvidenceEntry(entry) {
  const checklistId = String(entry?.checklist_id ?? entry?.id ?? "").trim();
  if (!isKnownChecklistId(checklistId)) return null;
  if (!isEvidenceFound(entry)) return null;

  const excerpt = String(entry?.excerpt ?? "").trim();
  const page = parsePageNumber(entry?.page);
  if (!page || !excerpt || isGenericExcerpt(excerpt)) return null;

  return {
    key: checklistId,
    page,
    excerpt,
    ref: { page, excerpt },
  };
}

function filterTrustedPageReferences(validated = []) {
  if (!validated.length) return {};

  const byPage = new Map();
  for (const item of validated) {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page).push(item);
  }

  const trusted = [];
  for (const items of byPage.values()) {
    if (items.length >= 2) {
      const uniqueExcerpts = new Set(items.map(item => safeLower(item.excerpt)));
      const allGeneric = items.every(item => isGenericExcerpt(item.excerpt));
      const allSame = uniqueExcerpts.size === 1;
      if (allGeneric || allSame) continue;
    }
    trusted.push(...items);
  }

  const checkRefs = {};
  for (const item of trusted) {
    checkRefs[item.key] = item.formatted;
  }
  return checkRefs;
}

/** Da checklist_evidence AI → checkRefs applicabili. */
export function buildCheckRefsFromEvidence(checklistEvidence = []) {
  const validated = [];

  for (const entry of checklistEvidence || []) {
    const normalized = normalizeEvidenceEntry(entry);
    if (!normalized) continue;
    const formatted = formatCheckRef(normalized.ref);
    if (!formatted) continue;
    validated.push({ ...normalized, formatted });
  }

  return filterTrustedPageReferences(validated);
}

/** Riferimento attendibile solo con pagina valida ed excerpt specifico. */
export function isTrustworthyChecklistReference(ref) {
  if (ref == null) return false;
  if (typeof ref === "string") return false;
  if (typeof ref !== "object") return false;

  const page = parsePageNumber(ref.page);
  const excerpt = String(ref.excerpt ?? "").trim();
  if (!page || !excerpt || isGenericExcerpt(excerpt)) return false;
  return true;
}

export function formatCheckRef(ref) {
  if (!isTrustworthyChecklistReference(ref)) return null;
  const page = parsePageNumber(ref.page);
  return page ? `pag. ${page}` : null;
}

function normalizeAppliedPageRef(value) {
  const fromObject = formatCheckRef(value);
  if (fromObject) return fromObject;
  if (typeof value !== "string") return null;
  const page = parsePageNumber(value);
  return page ? `pag. ${page}` : null;
}

/**
 * Costruisce checkRefs da references.checklist (legacy) con filtro excerpt.
 */
export function buildSanitizedCheckRefs(refMap = {}) {
  const validated = [];

  for (const [key, ref] of Object.entries(refMap || {})) {
    if (key == null || key === "") continue;
    if (!isKnownChecklistId(key) && key !== "durc" && key !== "visura") continue;
    if (!isTrustworthyChecklistReference(ref)) continue;

    const page = parsePageNumber(ref.page);
    const excerpt = String(ref.excerpt ?? "").trim();
    const formatted = formatCheckRef(ref);
    if (!formatted) continue;

    validated.push({
      key: String(key),
      page,
      excerpt,
      formatted,
    });
  }

  return filterTrustedPageReferences(validated);
}

function normalizeExtractedData(raw = {}) {
  const codiceFiscaleImpresa =
    raw.codice_fiscale_impresa ?? raw.codice_fiscale ?? null;
  const codiceFiscaleLavoratore = raw.codice_fiscale_lavoratore ?? null;

  return {
    impresa: raw.impresa ?? null,
    codice_fiscale_impresa: codiceFiscaleImpresa,
    codice_fiscale: codiceFiscaleImpresa ?? codiceFiscaleLavoratore ?? null,
    lavoratore: raw.lavoratore ?? null,
    codice_fiscale_lavoratore: codiceFiscaleLavoratore,
    mansione: raw.mansione ?? null,
    qualifica: raw.qualifica ?? null,
    data_emissione: raw.data_emissione ?? null,
    data_documento: raw.data_documento ?? null,
    data_giudizio: raw.data_giudizio ?? null,
    data_erogazione: raw.data_erogazione ?? null,
    data_scadenza: raw.data_scadenza ?? null,
    data_fine_contratto: raw.data_fine_contratto ?? null,
    data_inizio_rapporto: raw.data_inizio_rapporto ?? null,
    data_proroga: raw.data_proroga ?? null,
    data_inizio: raw.data_inizio ?? null,
    data_fine: raw.data_fine ?? null,
    ente: raw.ente ?? null,
    corso: raw.corso ?? null,
    tipo_contratto: raw.tipo_contratto ?? null,
    tipo_comunicazione: raw.tipo_comunicazione ?? null,
    durata_ore: raw.durata_ore ?? null,
    rischio: raw.rischio ?? null,
    soggetto_formatore: raw.soggetto_formatore ?? null,
    tipo_formazione: raw.tipo_formazione ?? null,
  };
}

function addYearsIsoDate(isoYmd, years) {
  const norm = normalizeIsoDateOnly(isoYmd);
  if (!norm) return null;
  const [y, m, d] = norm.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setFullYear(date.getFullYear() + years);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Scadenza formazione specifica (YYYY-MM-DD): data_scadenza esplicita, altrimenti fine/erogazione + 5 anni. */
export function resolveFormazioneSpecScadenza(extracted = {}, mappingWarnings = []) {
  const explicit = normalizeIsoDateOnly(extracted.data_scadenza);
  if (explicit) return explicit;

  const fromFine = normalizeIsoDateOnly(extracted.data_fine);
  if (fromFine) return addYearsIsoDate(fromFine, 5);

  const fromErogazione = normalizeIsoDateOnly(
    extracted.data_erogazione || extracted.data_emissione
  );
  if (fromErogazione) return addYearsIsoDate(fromErogazione, 5);

  mappingWarnings.push(
    "Formazione: impossibile calcolare scadenza specifica (manca data_scadenza, data_fine e data_erogazione)."
  );
  return null;
}

function pushFormazioneWorker(updates, extracted, fields, mappingWarnings) {
  const w = workerFromExtracted(extracted, fields);
  if (w) {
    updates.maestranze.push(w);
    return;
  }
  const nome = String(extracted.lavoratore || "").trim();
  if (!nome) {
    mappingWarnings.push("Formazione: lavoratore non rilevato; maestranza non creata.");
  }
}

/** Normalizza una data in YYYY-MM-DD se possibile. */
function normalizeIsoDateOnly(value) {
  return normalizeDate(value);
}

/** YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY (2000+YY). */
export function normalizeDate(value) {
  if (value == null || value === "") return null;
  const t = String(value).trim();
  if (!t || t === "—" || t === "✓") return null;
  if (t.toUpperCase() === "IND") return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const slash = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    let year = parseInt(slash[3], 10);
    if (slash[3].length === 2) year = 2000 + year;
    return `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }

  return null;
}

export const EXPIRING_DOCUMENT_RULES = {
  VISURA: { baseDate: "data_emissione", addMonths: 6 },
  FORMAZIONE_SPECIFICA: { baseDate: "data_fine_or_erogazione", addYears: 5 },
  FORMAZIONE_BASE_SPECIFICA: { baseDate: "data_fine_or_erogazione", addYears: 5 },
  // TODO: RSPP/RLS — usare solo data_scadenza esplicita finché non è definita durata configurata
};

const MAESTRANZA_EXPIRING_FIELDS = new Set([
  "idoneita",
  "formazioneSpec",
  "unilav",
  "preposto",
  "antincendio",
  "ps",
  "ponteggiatori",
  "mdt",
  "ple",
  "gruista",
  "confinati",
]);

const MAESTRANZA_BOOLEAN_FIELDS = new Set(["formazioneBase", "dpi"]);

export function shouldUpdateUnilavField(currentValue, newValue) {
  if (isFieldEmpty(newValue)) return false;
  const newUpper = String(newValue).trim().toUpperCase();
  if (isFieldEmpty(currentValue)) return true;
  const curUpper = String(currentValue).trim().toUpperCase();

  if (newUpper === "IND") {
    return curUpper !== "IND";
  }
  if (curUpper === "IND") {
    return false;
  }

  const newIso = normalizeDate(newValue);
  if (!newIso) return false;
  const curIso = normalizeDate(currentValue);
  if (!curIso) return true;
  return newIso > curIso;
}

export function shouldUpdateExpiringField(currentValue, newValue, fieldKey = "") {
  if (isFieldEmpty(newValue)) return false;
  if (fieldKey === "unilav") return shouldUpdateUnilavField(currentValue, newValue);
  if (isFieldEmpty(currentValue)) return true;

  const newIso = normalizeDate(newValue);
  if (!newIso) return false;
  const curIso = normalizeDate(currentValue);
  if (!curIso) return true;
  return newIso > curIso;
}

function addMonthsIsoDate(isoYmd, months) {
  const norm = normalizeDate(isoYmd);
  if (!norm) return null;
  const [y, m, d] = norm.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function toAppDateFromIso(iso) {
  if (!iso) return null;
  return formatIsoDateToApp(iso) || iso;
}

export function resolveVisuraScadenza(extracted = {}) {
  const explicit = normalizeDate(extracted.data_scadenza);
  if (explicit) return explicit;
  const emissione = normalizeDate(
    extracted.data_emissione || extracted.data_documento
  );
  if (emissione) return addMonthsIsoDate(emissione, EXPIRING_DOCUMENT_RULES.VISURA.addMonths);
  return null;
}

export function resolveIdoneitaScadenza(extracted = {}) {
  return (
    normalizeDate(extracted.data_scadenza) ||
    normalizeDate(extracted.data_giudizio) ||
    normalizeDate(extracted.data_emissione)
  );
}

function formationYearsForKey(courseKey) {
  const key = courseKey === "ponteggiatori" ? "ponteggi" : courseKey;
  return FORMATION_SCADENZA[key];
}

/** Scadenza attestato abilitazione (YYYY-MM-DD): data_scadenza, altrimenti fine/erogazione + anni regola. */
export function resolveWorkerCourseFieldValue(extracted = {}, courseKey) {
  const explicit = normalizeDate(extracted.data_scadenza);
  if (explicit) return explicit;

  const yearsRule = formationYearsForKey(courseKey);
  const base = normalizeDate(
    extracted.data_fine || extracted.data_erogazione || extracted.data_emissione
  );
  if (!base) return null;

  if (typeof yearsRule === "number") {
    return addYearsIsoDate(base, yearsRule);
  }
  if (typeof yearsRule === "function") {
    return addYearsIsoDate(base, yearsRule("A"));
  }

  return base;
}

const PREPOSTO_CLASSIFICATION_RE =
  /preposto|preposti|organizzazione\s+(di\s+)?cantiere\s+(per\s+)?preposti|formazione\s+preposto|aggiornamento\s+preposto/;

const ANTINCENDIO_CLASSIFICATION_RE =
  /antincendio|addett[oa]?\s+(alla\s+)?antincendio|prevenzione\s+incendi|lotta\s+antincendio|gestione\s+(delle\s+)?emergenze|emergenze\s+antincendio|rischio\s+(basso|medio|elevato|alto)(\s+antincendio|\s+incendi)?|livello\s+[123](\s+antincendio|\s+incendi)?/;

const NOMINA_DESIGNATION_RE =
  /\b(nomina|designazione|incarico|incaricat[oa]|designat[oa]|conferimento\s+incarico|per\s+accettazione|firma\s+per\s+accettazione|lavoratore\s+incaricat[oa]|addett[oa]\s+designat[oa])\b/;

const TRAINING_ATTESTATION_RE =
  /attestato\s+(di\s+)?(frequenza|formazione|aggiornamento)|attestato\s+corso|corso\s+di\s+(formazione|aggiornamento)|programma\s+didattico|verifica\s+finale|soggetto\s+formatore|partecipazione\s+al\s+corso|svolgimento\s+del\s+corso|esito\s+(positivo\s+)?del\s+corso|frequenza\s+al\s+corso|\bdurata\b.*\bore\b|\b\d{1,3}\s*ore\b/;

export const NOMINA_ANALYSIS_UI = {
  title: "Documento riconosciuto come nomina/designazione",
  body: "Il documento non è un attestato formativo e non aggiorna le scadenze della maestranza.",
  appliedSummary: "Nessun aggiornamento applicato alle scadenze formative.",
};

export const NOMINA_ANALYSIS_WARNINGS = [
  "Documento di nomina/designazione: non è un attestato formativo.",
  "Per aggiornare la scadenza è necessario caricare l'attestato di formazione o aggiornamento.",
];

export function isNominaDocumentType(documentType) {
  return String(documentType || "")
    .toUpperCase()
    .startsWith("NOMINA_");
}

export function buildNominaSkippedChanges(documentType) {
  return {
    document: {
      reason: "documento di nomina/designazione, non attestato formativo",
      document_type: documentType,
      proposed: "nessun aggiornamento scadenze formative",
    },
  };
}

function classificationBlob(payload = {}, fileName = "") {
  const extracted = payload.extracted_data || payload;
  return [
    fileName,
    extracted.corso,
    payload.summary,
    extracted.tipo_formazione,
    extracted.rischio,
    extracted.soggetto_formatore,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasTrainingAttestationSignals(text, extracted = {}) {
  if (TRAINING_ATTESTATION_RE.test(text)) return true;
  if (extracted.durata_ore != null && String(extracted.durata_ore).trim() !== "") {
    return true;
  }
  if (extracted.soggetto_formatore) return true;
  if (extracted.data_inizio && extracted.data_fine) return true;
  const corso = safeLower(extracted.corso || "");
  if (/attestato|corso\s+di|formazione\s+per\s+addett/.test(corso)) return true;
  return false;
}

function hasNominaDesignationSignals(text) {
  return NOMINA_DESIGNATION_RE.test(text);
}

function resolveNominaSubtype(text) {
  if (/primo\s+soccorso|pronto\s+soccorso|\bps\b/.test(text)) {
    return "NOMINA_PRIMO_SOCCORSO";
  }
  if (/antincendio|prevenzione\s+incendi|addett[oa]?\s+antincendio/.test(text)) {
    return "NOMINA_ANTINCENDIO";
  }
  if (/preposto/.test(text)) return "NOMINA_PREPOSTO";
  if (/\brls\b|rappresentante\s+(dei\s+)?lavoratori/.test(text)) return "NOMINA_RLS";
  if (/\baspp\b/.test(text)) return "NOMINA_ASPP";
  if (/\brspp\b/.test(text)) return "NOMINA_RSPP";
  return "NOMINA_GENERICA_SICUREZZA";
}

export function resolveAntincendioExpiryIso(extracted = {}) {
  const explicit = normalizeDate(extracted.data_scadenza);
  if (explicit) return explicit;
  const fine = normalizeDate(extracted.data_fine);
  if (fine) return addYearsIsoDate(fine, 5);
  const erogazione = normalizeDate(
    extracted.data_erogazione || extracted.data_emissione
  );
  if (erogazione) return addYearsIsoDate(erogazione, 5);
  return null;
}

export function resolveDocumentTypeWithPriority(payload = {}, fileName = "") {
  const extracted = payload.extracted_data || {};
  const text = safeLower(
    classificationBlob(payload, fileName)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  const isNomina = hasNominaDesignationSignals(text);
  const isTraining = hasTrainingAttestationSignals(text, extracted);

  if (isNomina && !isTraining) {
    const aiType = String(payload.document_type || "").toUpperCase();
    if (aiType.startsWith("NOMINA_")) return aiType;
    return resolveNominaSubtype(text);
  }

  if (PREPOSTO_CLASSIFICATION_RE.test(text)) return "PREPOSTO";
  if (ANTINCENDIO_CLASSIFICATION_RE.test(text)) return "ANTINCENDIO";

  const type = payload.document_type;
  return type == null || type === "" ? "ALTRO" : String(type);
}

function findMaestranzaIndex(maestranze, worker) {
  const cf = String(worker.codiceFiscale || "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (cf) {
    const byCf = maestranze.findIndex(m => {
      const mcf = String(m.codiceFiscale || "")
        .replace(/\s/g, "")
        .toUpperCase();
      return mcf && mcf === cf;
    });
    if (byCf >= 0) return byCf;
  }
  return maestranze.findIndex(m => nameSimilarity(m.nome, worker.nome) >= 0.75);
}

function shouldUpdateBooleanMaestranzaField(currentValue, newValue) {
  const isOn =
    newValue === true ||
    newValue === "true" ||
    newValue === "✓" ||
    newValue === "si" ||
    newValue === "Sì";
  if (!isOn) return false;
  return !(
    currentValue === true ||
    currentValue === "true" ||
    currentValue === "✓" ||
    currentValue === "si" ||
    currentValue === "Sì"
  );
}

/**
 * Valore campo UNILAV per maestranza: "IND" o data fine/scadenza (YYYY-MM-DD).
 */
export function resolveUnilavFromExtracted(extracted = {}, mappingWarnings = []) {
  const tipoContratto = safeLower(extracted.tipo_contratto || "");
  const tipoComunicazione = safeLower(extracted.tipo_comunicazione || "");

  const dataFine = normalizeIsoDateOnly(extracted.data_fine_contratto);
  const dataScadenza = normalizeIsoDateOnly(extracted.data_scadenza);
  const dataProroga = normalizeIsoDateOnly(extracted.data_proroga);

  const isProroga =
    /proroga/.test(tipoComunicazione) ||
    /proroga/.test(tipoContratto) ||
    /comunicazione\s+obbligatoria\s+di\s+proroga/.test(tipoComunicazione);

  const isIndeterminato = /indeterminat/.test(tipoContratto);
  const isDeterminato = /determinato/.test(tipoContratto) && !isIndeterminato;

  const hasEndDate = Boolean(dataFine || dataScadenza || dataProroga);

  if (hasEndDate) {
    if (isProroga) {
      return dataProroga || dataScadenza || dataFine;
    }
    return dataFine || dataScadenza || dataProroga;
  }

  if (isDeterminato) {
    mappingWarnings.push(
      "UNILAV: rapporto a tempo determinato senza data di fine/scadenza/proroga rilevata."
    );
    return null;
  }

  if (isIndeterminato) {
    return "IND";
  }

  if (!tipoContratto.trim()) {
    mappingWarnings.push("UNILAV: tipo contratto non chiaro; campo UNILAV non aggiornato.");
    return null;
  }

  mappingWarnings.push(
    "UNILAV: impossibile determinare scadenza o indeterminato; campo non aggiornato."
  );
  return null;
}

function normalizeAiPayload(raw) {
  const documentType = raw?.document_type;
  const summary = String(raw?.summary ?? "").trim();

  return {
    document_type:
      documentType == null || documentType === "" ? "ALTRO" : String(documentType),
    confidence: typeof raw?.confidence === "number" ? raw.confidence : 0,
    summary: summary.length > 200 ? summary.slice(0, 200) : summary,
    extracted_data: normalizeExtractedData(raw?.extracted_data || {}),
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.slice(0, 5) : [],
  };
}

function enrichCheckRefsFromReferences(
  updates,
  references = {},
  _documentType = "",
  checklistEvidence = []
) {
  const fromLegacy = buildSanitizedCheckRefs(references?.checklist || {});
  const fromEvidence = buildCheckRefsFromEvidence(checklistEvidence);
  const checkRefs = { ...fromLegacy, ...fromEvidence };
  return { ...updates, checkRefs };
}

function extractWorkerQualifica(extracted = {}) {
  const raw = String(extracted.qualifica || extracted.mansione || "").trim();
  if (!raw || isFormationLikeQualifica(raw)) return null;
  return raw;
}

function workerFromExtracted(extracted, fields = {}, options = {}) {
  const nome = normalizeWorkerName(extracted.lavoratore || "");
  if (!nome) return null;
  const w = { nome, ...fields };
  const cf = String(extracted.codice_fiscale_lavoratore || "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (cf) w.codiceFiscale = cf;
  if (options.withQualifica) {
    const qualifica = extractWorkerQualifica(extracted);
    if (qualifica) w.qualifica = qualifica;
  }
  return w;
}

/**
 * Mapping deterministico da tipo documento + extracted_data → updates
 */
export function mapExtractedToUpdates(documentType, extracted = {}, meta = {}) {
  const type = safeLower(documentType || "ALTRO").toUpperCase();
  const updates = {
    checklist: {},
    checkRefs: {},
    allegati: {},
    allegatiScadenze: {},
    maestranze: [],
  };
  const mappingWarnings = [];

  const scadenzaIso = normalizeDate(extracted.data_scadenza);
  const scadenzaApp = scadenzaIso ? toAppDateFromIso(scadenzaIso) : null;
  const confidence = typeof meta.confidence === "number" ? meta.confidence : 0;

  if (type.startsWith("NOMINA_")) {
    mappingWarnings.push(...NOMINA_ANALYSIS_WARNINGS);
    return { updates, mappingWarnings };
  }

  switch (type) {
    case "DURC":
      updates.checklist.durc = "si";
      updates.allegati.durc = true;
      if (scadenzaApp) updates.allegatiScadenze.durc = scadenzaApp;
      break;
    case "POS":
      mappingWarnings.push(...applyPosChecklistMapping(updates, confidence));
      break;
    case "VISURA": {
      updates.checklist.visura = "si";
      updates.allegati.visura = true;
      const visuraScad = resolveVisuraScadenza(extracted);
      if (visuraScad) updates.allegatiScadenze.visura = toAppDateFromIso(visuraScad);
      break;
    }
    case "FORMAZIONE_BASE": {
      pushFormazioneWorker(
        updates,
        extracted,
        { formazioneBase: true },
        mappingWarnings
      );
      break;
    }
    case "FORMAZIONE_SPECIFICA": {
      const spec = resolveFormazioneSpecScadenza(extracted, mappingWarnings);
      const fields = {};
      if (spec) fields.formazioneSpec = spec;
      pushFormazioneWorker(updates, extracted, fields, mappingWarnings);
      break;
    }
    case "FORMAZIONE_BASE_SPECIFICA": {
      const spec = resolveFormazioneSpecScadenza(extracted, mappingWarnings);
      const fields = { formazioneBase: true };
      if (spec) fields.formazioneSpec = spec;
      pushFormazioneWorker(updates, extracted, fields, mappingWarnings);
      break;
    }
    case "IDONEITA": {
      const idoneitaIso = resolveIdoneitaScadenza(extracted);
      const idoneita = idoneitaIso ? toAppDateFromIso(idoneitaIso) : null;
      const w = workerFromExtracted(extracted, idoneita ? { idoneita } : {}, {
        withQualifica: true,
      });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "UNILAV": {
      const w = workerFromExtracted(extracted, {}, { withQualifica: true });
      if (!w) break;
      const unilav = resolveUnilavFromExtracted(extracted, mappingWarnings);
      if (unilav) w.unilav = unilav;
      updates.maestranze.push(w);
      break;
    }
    case "PREPOSTO": {
      const preposto = resolveWorkerCourseFieldValue(extracted, "preposto");
      const w = workerFromExtracted(extracted, preposto ? { preposto } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "ANTINCENDIO": {
      const antincendio = resolveAntincendioExpiryIso(extracted);
      const w = workerFromExtracted(extracted, antincendio ? { antincendio } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PRIMO_SOCCORSO": {
      const ps = resolveWorkerCourseFieldValue(extracted, "ps");
      const w = workerFromExtracted(extracted, ps ? { ps } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PONTEGGI": {
      const ponteggiatori = resolveWorkerCourseFieldValue(extracted, "ponteggiatori");
      const w = workerFromExtracted(extracted, ponteggiatori ? { ponteggiatori } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "MMT": {
      const mdt = resolveWorkerCourseFieldValue(extracted, "mdt");
      const w = workerFromExtracted(extracted, mdt ? { mdt } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PLE": {
      const ple = resolveWorkerCourseFieldValue(extracted, "ple");
      const w = workerFromExtracted(extracted, ple ? { ple } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "GRU": {
      const gruista = resolveWorkerCourseFieldValue(extracted, "gruista");
      const w = workerFromExtracted(extracted, gruista ? { gruista } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "SPAZI_CONFINATI": {
      const confinati = resolveWorkerCourseFieldValue(extracted, "confinati");
      const w = workerFromExtracted(extracted, confinati ? { confinati } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    default:
      break;
  }

  return { updates, mappingWarnings };
}

export function mergeAiUpdates(aiUpdates = {}, mappedUpdates = {}) {
  const maestranze = [
    ...(Array.isArray(mappedUpdates.maestranze) ? mappedUpdates.maestranze : []),
    ...(Array.isArray(aiUpdates.maestranze) ? aiUpdates.maestranze : []),
  ];

  return {
    checklist: { ...mappedUpdates.checklist, ...aiUpdates.checklist },
    checkRefs: { ...(mappedUpdates.checkRefs || {}) },
    allegati: { ...mappedUpdates.allegati, ...aiUpdates.allegati },
    allegatiScadenze: { ...mappedUpdates.allegatiScadenze, ...aiUpdates.allegatiScadenze },
    maestranze: deduplicateWorkers([], maestranze),
  };
}

/** Analisi standard veloce: solo mapping lato codice, senza riferimenti pagina. */
export function buildFastFinalUpdates(aiPayload, meta = {}) {
  const originalType = aiPayload.document_type;
  const documentType = resolveDocumentTypeWithPriority(aiPayload, meta.fileName || "");
  const mappingWarnings = [];
  const originalUpper = String(originalType || "").toUpperCase();

  if (isNominaDocumentType(documentType)) {
    if (originalUpper && !originalUpper.startsWith("NOMINA_")) {
      mappingWarnings.push(
        `Documento riclassificato come ${documentType} (nomina/designazione, non attestato formativo).`
      );
    }
    mappingWarnings.push(...NOMINA_ANALYSIS_WARNINGS);
    return {
      updates: {
        checklist: {},
        allegati: {},
        allegatiScadenze: {},
        maestranze: [],
        checkRefs: {},
      },
      mappingWarnings,
      isNomina: true,
      documentType,
      analysisUi: NOMINA_ANALYSIS_UI,
    };
  }

  if (documentType === "PREPOSTO" && originalUpper && originalUpper !== "PREPOSTO") {
    mappingWarnings.push(
      "Documento riclassificato come PREPOSTO (priorità su formazione lavoratori)."
    );
  }
  if (
    documentType === "ANTINCENDIO" &&
    originalUpper &&
    originalUpper !== "ANTINCENDIO"
  ) {
    mappingWarnings.push(
      "Documento riclassificato come ANTINCENDIO (priorità su formazione lavoratori)."
    );
  }

  const { updates, mappingWarnings: mapWarnings } = mapExtractedToUpdates(
    documentType,
    aiPayload.extracted_data || {},
    { confidence: aiPayload.confidence ?? 0 }
  );
  mappingWarnings.push(...mapWarnings);

  return {
    updates: {
      checklist: updates.checklist,
      allegati: updates.allegati,
      allegatiScadenze: updates.allegatiScadenze,
      maestranze: updates.maestranze,
      checkRefs: {},
    },
    mappingWarnings,
    isNomina: false,
    documentType,
    analysisUi: null,
  };
}

export function buildFinalUpdates(aiPayload) {
  const { updates: mapped, mappingWarnings } = mapExtractedToUpdates(
    aiPayload.document_type,
    aiPayload.extracted_data || {},
    { confidence: aiPayload.confidence ?? 0 }
  );
  const merged = mergeAiUpdates({}, mapped);
  const updates = enrichCheckRefsFromReferences(
    merged,
    {},
    aiPayload.document_type,
    []
  );
  return {
    updates,
    mappingWarnings,
    references: {},
    checklist_evidence: [],
  };
}

export function detectDocumentType(fileName = "") {
  const n = safeLower(fileName).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("durc")) return "DURC";
  if (n.includes("visura") || n.includes("cciaa") || n.includes("camera")) return "VISURA";
  if (n.includes("pos") || n.includes("piano operativo")) return "POS";
  if (n.includes("unilav")) return "UNILAV";
  if (n.includes("idoneit")) return "IDONEITA";
  if (
    (n.includes("nomina") || n.includes("designazione") || n.includes("incarico")) &&
    !/attestato|corso di|programma didattico|\bore\b/.test(n)
  ) {
    if (/primo soccorso|pronto soccorso/.test(n)) return "NOMINA_PRIMO_SOCCORSO";
    if (/antincendio|prevenzione incendi/.test(n)) return "NOMINA_ANTINCENDIO";
    if (/preposto/.test(n)) return "NOMINA_PREPOSTO";
    if (/\brls\b/.test(n)) return "NOMINA_RLS";
    if (/\brspp\b/.test(n)) return "NOMINA_RSPP";
    if (/\baspp\b/.test(n)) return "NOMINA_ASPP";
    return "NOMINA_GENERICA_SICUREZZA";
  }
  if (
    n.includes("preposto") ||
    n.includes("organizzazione di cantiere per preposti")
  ) {
    return "PREPOSTO";
  }
  if (
    n.includes("antincendio") ||
    n.includes("prevenzione incendi") ||
    n.includes("lotta antincendio")
  ) {
    return "ANTINCENDIO";
  }
  if (
    n.includes("16 ore") ||
    n.includes("12 ore") ||
    n.includes("8 ore") ||
    (n.includes("rischio") && n.includes("lavorator")) ||
    n.includes("generale e specifica") ||
    n.includes("base e specifica")
  ) {
    return "FORMAZIONE_BASE_SPECIFICA";
  }
  if (n.includes("formazione") && (n.includes("specif") || n.includes("rischio"))) {
    return "FORMAZIONE_SPECIFICA";
  }
  if (n.includes("formazione") || n.includes("81-08") || n.includes("8108")) return "FORMAZIONE_BASE";
  if (n.includes("soccorso") || n.includes("primo soccorso") || /\bps\b/.test(n)) return "PRIMO_SOCCORSO";
  if (n.includes("pontegg")) return "PONTEGGI";
  if (n.includes("mmt") || n.includes("mdt")) return "MMT";
  if (n.includes("ple")) return "PLE";
  if (n.includes("gru")) return "GRU";
  if (n.includes("confinat") || n.includes("spazi")) return "SPAZI_CONFINATI";
  return "UNKNOWN";
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function resolveAllegatoKey(key) {
  if (key == null || key === "") return null;
  const keyStr = String(key);
  if (ALLEGATI_KEY_MAP[keyStr]) return ALLEGATI_KEY_MAP[keyStr];
  const found = ALLEGATI_CONFIG.find(a => a.key === keyStr);
  if (found) return found.key;
  const lower = safeLower(keyStr);
  const byAlias = ALLEGATI_CONFIG.find(a => {
    const allegatoKey = a?.key != null ? safeLower(a.key) : "";
    const sinonimi = a?.sinonimi != null ? safeLower(a.sinonimi) : "";
    return allegatoKey === lower || (sinonimi !== "" && sinonimi.includes(lower));
  });
  return byAlias?.key || null;
}

/**
 * Mock controllato: struttura definitiva senza OpenAI.
 */
export function buildMockAnalysis({ fileName, documentType, extractedOverrides = {} }) {
  const type = documentType && documentType !== "UNKNOWN" ? documentType : detectDocumentType(fileName);
  const scadenza = addDays(120);
  const oggi = addDays(0);
  const updates = {
    checklist: {},
    checkRefs: {},
    allegati: {},
    allegatiScadenze: {},
    maestranze: [],
  };
  const extracted_data = {
    file_name: fileName,
    document_type: type,
    ...extractedOverrides,
  };
  const warnings = [];

  switch (type) {
    case "DURC":
      updates.checklist.durc = "si";
      updates.allegati.durc = true;
      updates.allegatiScadenze.durc = scadenza;
      extracted_data.data_scadenza = scadenza;
      break;
    case "POS":
      warnings.push(...applyPosChecklistMapping(updates, 0.88));
      break;
    case "VISURA":
      updates.checklist.visura = "si";
      updates.allegati.visura = true;
      updates.allegatiScadenze.visura = addDays(180);
      extracted_data.data_scadenza = updates.allegatiScadenze.visura;
      break;
    case "FORMAZIONE_BASE":
      updates.maestranze.push({
        nome: extractedOverrides.nome || "Lavoratore Estratto",
        formazioneBase: true,
      });
      break;
    case "FORMAZIONE_SPECIFICA":
      updates.maestranze.push({
        nome: extractedOverrides.nome || "Lavoratore Estratto",
        formazioneSpec: extractedOverrides.formazioneSpec || "2026-01-01",
      });
      break;
    case "FORMAZIONE_BASE_SPECIFICA":
      updates.maestranze.push({
        nome: extractedOverrides.nome || "Lavoratore Estratto",
        formazioneBase: true,
        formazioneSpec: extractedOverrides.formazioneSpec || "2025-10-28",
      });
      break;
    case "IDONEITA":
      updates.maestranze.push({
        nome: extractedOverrides.nome || "Lavoratore Estratto",
        idoneita: scadenza,
      });
      extracted_data.data_scadenza = scadenza;
      break;
    case "UNILAV":
      updates.maestranze.push({
        nome: extractedOverrides.nome || "Lavoratore Estratto",
        unilav: extractedOverrides.unilav || "IND",
      });
      break;
    case "PREPOSTO":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", preposto: oggi });
      break;
    case "ANTINCENDIO":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", antincendio: oggi });
      break;
    case "PRIMO_SOCCORSO":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", ps: oggi });
      break;
    case "PONTEGGI":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", ponteggiatori: oggi });
      break;
    case "MMT":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", mdt: oggi });
      break;
    case "PLE":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", ple: oggi });
      break;
    case "GRU":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", gruista: oggi });
      break;
    case "SPAZI_CONFINATI":
      updates.maestranze.push({ nome: extractedOverrides.nome || "Lavoratore Estratto", confinati: oggi });
      break;
    default:
      warnings.push("Tipo documento non riconosciuto automaticamente; verifica i dati applicati.");
      break;
  }

  return {
    document_type: type,
    confidence: type === "UNKNOWN" ? 0.35 : 0.88,
    summary:
      type === "UNKNOWN"
        ? "Analisi mock completata. Tipo documento non classificato dal nome file."
        : `Analisi mock completata per documento ${type}.`,
    extracted_data,
    updates,
    warnings,
  };
}

function recordApplied(applied, section, key, value, meta = {}) {
  if (!applied[section]) applied[section] = {};
  if (meta.previous !== undefined || meta.reason) {
    applied[section][key] = {
      previous: meta.previous,
      value,
      reason: meta.reason || "aggiornamento",
    };
  } else {
    applied[section][key] = value;
  }
}

function recordSkipped(skipped, section, key, existing, proposed, reason = "") {
  if (!skipped[section]) skipped[section] = {};
  skipped[section][key] = {
    existing,
    proposed,
    ...(reason ? { reason } : {}),
  };
}

function applyMaestranzaField({
  merged,
  existing,
  field,
  value,
  workerApplied,
  workerSkipped,
}) {
  if (field === "nome" || field === "codiceFiscale") return;

  if (MAESTRANZA_BOOLEAN_FIELDS.has(field)) {
    if (!shouldUpdateBooleanMaestranzaField(existing[field], value)) {
      if (!isFieldEmpty(value)) {
        workerSkipped[field] = {
          existing: existing[field],
          proposed: value,
          reason: "valore già presente",
        };
      }
      return;
    }
    merged[field] = true;
    workerApplied[field] = {
      previous: existing[field],
      value: true,
      reason: "flag attivo",
    };
    return;
  }

  if (field === "qualifica") {
    if (isFormationLikeQualifica(value)) {
      workerSkipped[field] = {
        existing: existing.qualifica,
        proposed: value,
        reason: "qualifica non valida da formazione",
      };
      return;
    }
    if (!isFieldEmpty(existing.qualifica)) {
      workerSkipped[field] = {
        existing: existing.qualifica,
        proposed: value,
        reason: "valore esistente più recente",
      };
      return;
    }
    if (isFieldEmpty(value)) return;
    merged.qualifica = value;
    workerApplied.qualifica = {
      previous: existing.qualifica,
      value,
      reason: "campo vuoto",
    };
    return;
  }

  if (!MAESTRANZA_EXPIRING_FIELDS.has(field)) return;

  if (isFieldEmpty(value)) {
    workerSkipped[field] = {
      existing: existing[field],
      proposed: value,
      reason: "dato nuovo non disponibile o non attendibile",
    };
    return;
  }

  if (!shouldUpdateExpiringField(existing[field], value, field)) {
    workerSkipped[field] = {
      existing: existing[field],
      proposed: value,
      reason: isFieldEmpty(existing[field])
        ? "dato nuovo non disponibile o non attendibile"
        : "valore esistente più recente",
    };
    return;
  }

  const previous = merged[field];
  merged[field] = value;
  workerApplied[field] = {
    previous,
    value,
    reason: isFieldEmpty(existing[field]) ? "campo vuoto" : "scadenza più recente",
  };
}

/**
 * Applica aggiornamenti AI: per le scadenze mantiene sempre il dato più recente.
 */
export function applyAiUpdates(current = {}, updates = {}) {
  const checks = { ...(current.checks || {}) };
  const checkRefs = { ...(current.checkRefs || {}) };
  const allegati = { ...(current.allegati || {}) };
  const allegatiScadenze = { ...(current.allegatiScadenze || {}) };
  let maestranze = [...(current.maestranze || [])];

  const applied_changes = {};
  const skipped_changes = {};

  for (const [key, value] of Object.entries(updates.checklist || {})) {
    if (value == null || value === "") continue;
    if (isChecklistEmpty(checks[key])) {
      checks[key] = value;
      recordApplied(applied_changes, "checklist", key, value);
    } else {
      recordSkipped(skipped_changes, "checklist", key, checks[key], value);
    }
  }

  for (const [key, value] of Object.entries(updates.checkRefs || {})) {
    const formatted = normalizeAppliedPageRef(value);
    if (!formatted) continue;
    if (isFieldEmpty(checkRefs[key])) {
      checkRefs[key] = formatted;
      recordApplied(applied_changes, "checkRefs", key, formatted);
    } else {
      recordSkipped(skipped_changes, "checkRefs", key, checkRefs[key], formatted);
    }
  }

  for (const [rawKey, value] of Object.entries(updates.allegati || {})) {
    if (!value) continue;
    const key = resolveAllegatoKey(rawKey) || rawKey;
    if (!key) continue;
    if (isFieldEmpty(allegati[key])) {
      allegati[key] = true;
      recordApplied(applied_changes, "allegati", key, true);
    } else {
      recordSkipped(skipped_changes, "allegati", key, allegati[key], true);
    }
  }

  for (const [rawKey, value] of Object.entries(updates.allegatiScadenze || {})) {
    if (isFieldEmpty(value)) continue;
    const key = resolveAllegatoKey(rawKey) || rawKey;
    if (!key) continue;
    const previous = allegatiScadenze[key];
    if (shouldUpdateExpiringField(previous, value, key)) {
      allegatiScadenze[key] = value;
      recordApplied(applied_changes, "allegatiScadenze", key, value, {
        previous,
        reason: isFieldEmpty(previous) ? "campo vuoto" : "scadenza più recente",
      });
    } else {
      recordSkipped(
        skipped_changes,
        "allegatiScadenze",
        key,
        previous,
        value,
        isFieldEmpty(previous)
          ? "dato nuovo non disponibile o non attendibile"
          : "valore esistente più recente"
      );
    }
  }

  for (const incoming of updates.maestranze || []) {
    if (!incoming?.nome?.trim()) continue;

    const incomingWorker = { ...incoming, nome: normalizeWorkerName(incoming.nome) };
    if (
      incomingWorker.qualifica &&
      isFormationLikeQualifica(incomingWorker.qualifica)
    ) {
      delete incomingWorker.qualifica;
    }

    const idx = findMaestranzaIndex(maestranze, incomingWorker);
    if (idx >= 0) {
      const existing = { ...maestranze[idx] };
      const merged = { ...existing };
      const nomeNorm = normalizeWorkerName(merged.nome);
      if (nomeNorm && merged.nome !== nomeNorm) {
        merged.nome = nomeNorm;
      }
      if (incomingWorker.codiceFiscale && !merged.codiceFiscale) {
        merged.codiceFiscale = incomingWorker.codiceFiscale;
      }
      const workerApplied = {};
      const workerSkipped = {};
      if (nomeNorm && existing.nome !== nomeNorm) {
        workerApplied.nome = {
          previous: existing.nome,
          value: nomeNorm,
          reason: "normalizzazione nominativo",
        };
      }
      for (const [field, value] of Object.entries(incomingWorker)) {
        applyMaestranzaField({
          merged,
          existing,
          field,
          value,
          workerApplied,
          workerSkipped,
        });
      }
      maestranze[idx] = merged;
      if (Object.keys(workerApplied).length) {
        if (!applied_changes.maestranze) applied_changes.maestranze = [];
        applied_changes.maestranze.push({ nome: merged.nome, fields: workerApplied });
      }
      if (Object.keys(workerSkipped).length) {
        if (!skipped_changes.maestranze) skipped_changes.maestranze = [];
        skipped_changes.maestranze.push({ nome: merged.nome, fields: workerSkipped });
      }
    } else {
      const nuova = { ...incomingWorker };
      if (nuova.qualifica && isFormationLikeQualifica(nuova.qualifica)) {
        delete nuova.qualifica;
      }
      maestranze.push(nuova);
      if (!applied_changes.maestranze) applied_changes.maestranze = [];
      applied_changes.maestranze.push({
        nome: nuova.nome,
        created: true,
        fields: { ...nuova },
        reason: "nuova maestranza",
      });
    }
  }

  return {
    checks,
    checkRefs,
    allegati,
    allegatiScadenze,
    maestranze,
    applied_changes,
    skipped_changes,
  };
}

export function formatAppliedSummary(applied_changes = {}, options = {}) {
  if (options.isNomina) {
    return [NOMINA_ANALYSIS_UI.appliedSummary];
  }
  const lines = [];
  for (const [k, v] of Object.entries(applied_changes.checklist || {})) {
    lines.push(`Checklist: ${k} → ${v}`);
  }
  for (const [k, v] of Object.entries(applied_changes.checkRefs || {})) {
    lines.push(`Rif. pag. ${k}: ${v}`);
  }
  for (const [k] of Object.entries(applied_changes.allegati || {})) {
    lines.push(`Allegato presente: ${k}`);
  }
  for (const [k, v] of Object.entries(applied_changes.allegatiScadenze || {})) {
    lines.push(`Scadenza allegato ${k}: ${v}`);
  }
  for (const m of applied_changes.maestranze || []) {
    if (m.created) lines.push(`Nuova maestranza: ${m.nome}`);
    else lines.push(`Maestranza aggiornata: ${m.nome}`);
  }
  return lines;
}

export function formatSkippedSummary(skipped_changes = {}, options = {}) {
  if (options.isNomina && skipped_changes.document) {
    return [
      `Documento: ${skipped_changes.document.reason || "nomina/designazione"}`,
    ];
  }
  const lines = [];
  for (const [k, v] of Object.entries(skipped_changes.checklist || {})) {
    lines.push(`Checklist ${k}: già "${v.existing}"`);
  }
  for (const [k, v] of Object.entries(skipped_changes.checkRefs || {})) {
    lines.push(`Rif. pag. ${k}: già "${v.existing}"`);
  }
  for (const [k, v] of Object.entries(skipped_changes.allegati || {})) {
    lines.push(`Allegato ${k}: già presente`);
  }
  for (const [k, v] of Object.entries(skipped_changes.allegatiScadenze || {})) {
    lines.push(`Scadenza ${k}: già "${v.existing}"`);
  }
  for (const m of skipped_changes.maestranze || []) {
    const fields = Object.keys(m.fields || {}).join(", ");
    lines.push(`Maestranza ${m.nome}: campi già compilati (${fields})`);
  }
  return lines;
}
