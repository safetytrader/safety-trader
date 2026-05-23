// @ts-nocheck
import { ALLEGATI_CONFIG, CHECKLIST_ITEMS } from "@/lib/constants";
import { deduplicateWorkers, nameSimilarity } from "@/lib/utils";

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
    data_emissione: raw.data_emissione ?? null,
    data_erogazione: raw.data_erogazione ?? null,
    data_scadenza: raw.data_scadenza ?? null,
    data_fine_contratto: raw.data_fine_contratto ?? null,
    ente: raw.ente ?? null,
    corso: raw.corso ?? null,
    tipo_contratto: raw.tipo_contratto ?? null,
  };
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

function workerFromExtracted(extracted, fields = {}) {
  const nome = (extracted.lavoratore || "").trim();
  if (!nome) return null;
  const w = { nome, ...fields };
  const mansione = (extracted.mansione || extracted.corso || "").trim();
  if (mansione) w.qualifica = mansione;
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

  const scadenza = formatIsoDateToApp(extracted.data_scadenza);
  const erogazione = formatIsoDateToApp(extracted.data_erogazione || extracted.data_emissione);
  const fineContratto = formatIsoDateToApp(extracted.data_fine_contratto);
  const confidence = typeof meta.confidence === "number" ? meta.confidence : 0;

  switch (type) {
    case "DURC":
      updates.checklist.durc = "si";
      updates.allegati.durc = true;
      if (scadenza) updates.allegatiScadenze.durc = scadenza;
      break;
    case "POS":
      mappingWarnings.push(...applyPosChecklistMapping(updates, confidence));
      break;
    case "VISURA":
      updates.checklist.visura = "si";
      updates.allegati.visura = true;
      if (scadenza) updates.allegatiScadenze.visura = scadenza;
      break;
    case "FORMAZIONE_BASE": {
      const w = workerFromExtracted(extracted, { formazioneBase: true });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "FORMAZIONE_SPECIFICA": {
      const w = workerFromExtracted(extracted, { formazioneSpec: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "IDONEITA": {
      const idoneita = scadenza || formatIsoDateToApp(extracted.data_emissione);
      const w = workerFromExtracted(extracted, idoneita ? { idoneita } : {});
      if (w) updates.maestranze.push(w);
      break;
    }
    case "UNILAV": {
      const unilav = fineContratto || (extracted.data_fine_contratto == null ? "IND" : null);
      const w = workerFromExtracted(extracted, unilav ? { unilav } : { unilav: "IND" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PREPOSTO": {
      const w = workerFromExtracted(extracted, { preposto: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "ANTINCENDIO": {
      const w = workerFromExtracted(extracted, { antincendio: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PRIMO_SOCCORSO": {
      const w = workerFromExtracted(extracted, { ps: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PONTEGGI": {
      const w = workerFromExtracted(extracted, { ponteggiatori: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "MMT": {
      const w = workerFromExtracted(extracted, { mdt: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "PLE": {
      const w = workerFromExtracted(extracted, { ple: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "GRU": {
      const w = workerFromExtracted(extracted, { gruista: erogazione || "✓" });
      if (w) updates.maestranze.push(w);
      break;
    }
    case "SPAZI_CONFINATI": {
      const w = workerFromExtracted(extracted, { confinati: erogazione || "✓" });
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
export function buildFastFinalUpdates(aiPayload) {
  const { updates, mappingWarnings } = mapExtractedToUpdates(
    aiPayload.document_type,
    aiPayload.extracted_data || {},
    { confidence: aiPayload.confidence ?? 0 }
  );

  return {
    updates: {
      checklist: updates.checklist,
      allegati: updates.allegati,
      allegatiScadenze: updates.allegatiScadenze,
      maestranze: updates.maestranze,
      checkRefs: {},
    },
    mappingWarnings,
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
  if (n.includes("formazione") && (n.includes("specif") || n.includes("rischio"))) return "FORMAZIONE_SPECIFICA";
  if (n.includes("formazione") || n.includes("81-08") || n.includes("8108")) return "FORMAZIONE_BASE";
  if (n.includes("preposto")) return "PREPOSTO";
  if (n.includes("antincendio")) return "ANTINCENDIO";
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
        formazioneSpec: oggi,
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

function recordApplied(applied, section, key, value) {
  if (!applied[section]) applied[section] = {};
  applied[section][key] = value;
}

function recordSkipped(skipped, section, key, existing, proposed) {
  if (!skipped[section]) skipped[section] = {};
  skipped[section][key] = { existing, proposed };
}

/**
 * Applica aggiornamenti AI senza sovrascrivere campi già compilati.
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
    if (isFieldEmpty(allegatiScadenze[key])) {
      allegatiScadenze[key] = value;
      recordApplied(applied_changes, "allegatiScadenze", key, value);
    } else {
      recordSkipped(skipped_changes, "allegatiScadenze", key, allegatiScadenze[key], value);
    }
  }

  for (const incoming of updates.maestranze || []) {
    if (!incoming?.nome?.trim()) continue;
    const idx = maestranze.findIndex(m => nameSimilarity(m.nome, incoming.nome) >= 0.75);
    if (idx >= 0) {
      const existing = { ...maestranze[idx] };
      const merged = { ...existing };
      const workerApplied = {};
      const workerSkipped = {};
      for (const [field, value] of Object.entries(incoming)) {
        if (field === "nome") continue;
        if (isFieldEmpty(value)) continue;
        if (field === "qualifica" && !isFieldEmpty(existing.qualifica)) {
          workerSkipped[field] = { existing: existing.qualifica, proposed: value };
          continue;
        }
        if (isFieldEmpty(existing[field])) {
          merged[field] = value;
          workerApplied[field] = value;
        } else {
          workerSkipped[field] = { existing: existing[field], proposed: value };
        }
      }
      const mansione = (incoming.qualifica || "").trim();
      if (mansione && isFieldEmpty(existing.qualifica) && isFieldEmpty(merged.qualifica)) {
        merged.qualifica = mansione;
        workerApplied.qualifica = mansione;
      }
      maestranze[idx] = merged;
      if (Object.keys(workerApplied).length) {
        if (!applied_changes.maestranze) applied_changes.maestranze = [];
        applied_changes.maestranze.push({ nome: existing.nome, fields: workerApplied });
      }
      if (Object.keys(workerSkipped).length) {
        if (!skipped_changes.maestranze) skipped_changes.maestranze = [];
        skipped_changes.maestranze.push({ nome: existing.nome, fields: workerSkipped });
      }
    } else {
      const nuova = { ...incoming };
      const mansione = (incoming.qualifica || "").trim();
      if (mansione && isFieldEmpty(nuova.qualifica)) nuova.qualifica = mansione;
      maestranze.push(nuova);
      if (!applied_changes.maestranze) applied_changes.maestranze = [];
      applied_changes.maestranze.push({ nome: nuova.nome, created: true, fields: { ...nuova } });
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

export function formatAppliedSummary(applied_changes = {}) {
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

export function formatSkippedSummary(skipped_changes = {}) {
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
