// @ts-nocheck
import { analyzeIdoneitaCertificateVisionWithOpenAI } from "@/lib/openAiAnalyze";
import { normalizeDate, parseIdoneitaPeriodYears } from "@/lib/documentAnalysis";

const IDONEITA_PERIODICITY_WARNING =
  "Periodicità visita non rilevabile dal documento.";

export function parseIdoneitaVisionJson(text) {
  let s = String(text || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const st = s.indexOf("{");
  if (st === -1) return null;
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
  if (end < 0) return null;
  try {
    return JSON.parse(s.slice(st, end + 1));
  } catch {
    return null;
  }
}

function normalizePeriodYears(value) {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 5) return n;
  if (Number.isFinite(n) && n > 0 && n <= 10) return Math.round(n);
  return null;
}

/**
 * Applica il risultato vision/OCR mirato su extracted_data (solo campi idoneità).
 */
export function mergeIdoneitaVisionIntoExtracted(extracted = {}, vision = {}) {
  if (!extracted || typeof extracted !== "object") return extracted;
  if (!vision || typeof vision !== "object") return extracted;

  const visit =
    normalizeDate(vision.data_visita) ||
    normalizeDate(extracted.data_visita) ||
    normalizeDate(extracted.data_giudizio) ||
    normalizeDate(extracted.data_emissione);
  if (visit) {
    extracted.data_visita = visit;
    if (!extracted.data_giudizio) extracted.data_giudizio = visit;
  }

  const years = normalizePeriodYears(vision.periodicita_nuova_visita_anni);
  if (years) {
    extracted.periodicita_nuova_visita_anni = years;
    extracted.periodicita_nuova_visita = `${years} anno${years === 1 ? "" : "i"}`;
    if (vision.periodicita_evidence) {
      extracted.periodicita_evidence = String(vision.periodicita_evidence).slice(0, 500);
    }
  }

  const calc = normalizeDate(vision.data_scadenza_calcolata);
  if (calc) {
    extracted.data_scadenza = calc;
  }

  if (vision.giudizio && !extracted.giudizio) {
    extracted.giudizio = vision.giudizio;
  }

  return extracted;
}

/**
 * Vision mirata su PDF/immagine certificato idoneità (checkbox periodicità).
 */
export async function runIdoneitaVisionFallback({
  buffer,
  mimeType,
}) {
  if (!buffer?.length) {
    return {
      visionFallbackUsed: false,
      visionPeriodicitaYears: null,
      visionEvidence: null,
      visionConfidence: null,
      visionError: "buffer non disponibile",
    };
  }

  const safeMime = String(mimeType || "application/pdf").toLowerCase();
  const base64 = Buffer.isBuffer(buffer) ? buffer.toString("base64") : Buffer.from(buffer).toString("base64");

  try {
    const raw = await analyzeIdoneitaCertificateVisionWithOpenAI({
      base64,
      mimeType: safeMime.startsWith("image/") ? safeMime : "application/pdf",
    });
    const parsed = parseIdoneitaVisionJson(raw) || {};
    return {
      visionFallbackUsed: true,
      visionPeriodicitaYears: normalizePeriodYears(parsed.periodicita_nuova_visita_anni),
      visionEvidence: parsed.periodicita_evidence || null,
      visionConfidence:
        typeof parsed.confidence === "number" ? parsed.confidence : null,
      visionParsed: parsed,
      visionRaw: raw,
      visionError: null,
    };
  } catch (err) {
    return {
      visionFallbackUsed: true,
      visionPeriodicitaYears: null,
      visionEvidence: null,
      visionConfidence: null,
      visionParsed: null,
      visionRaw: null,
      visionError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function enrichIdoneitaPeriodicityFromDocumentText(extracted = {}, textBlobs: string[] = []) {
  if (parseIdoneitaPeriodYears(extracted)) {
    return { enriched: false, periodicitaYearsFromText: parseIdoneitaPeriodYears(extracted) };
  }

  const blob = (textBlobs || []).filter(Boolean).join("\n").slice(0, 80000);
  if (!blob.trim()) {
    return { enriched: false, periodicitaYearsFromText: null };
  }

  const merged = { ...extracted, note: blob };
  const years = parseIdoneitaPeriodYears(merged);
  if (!years) {
    return { enriched: false, periodicitaYearsFromText: null };
  }

  extracted.periodicita_nuova_visita_anni = years;
  extracted.periodicita_nuova_visita = `${years} anno${years === 1 ? "" : "i"}`;
  return { enriched: true, periodicitaYearsFromText: years };
}

export async function enrichIdoneitaExtractedForMapping({
  extracted = {},
  textBlobs = [] as string[],
  visionBuffer = null as Buffer | null,
  mimeType = "application/pdf",
}: {
  extracted?: Record<string, unknown>;
  textBlobs?: string[];
  visionBuffer?: Buffer | null;
  mimeType?: string;
}) {
  const periodicitaRawFromText =
    extracted.periodicita_nuova_visita ||
    extracted.periodicita ||
    extracted.nuova_visita ||
    null;

  const textEnrich = enrichIdoneitaPeriodicityFromDocumentText(extracted, textBlobs);
  let periodicitaYearsFromText = parseIdoneitaPeriodYears(extracted);
  let visionFallbackUsed = false;
  let visionPeriodicitaYears = null;
  let visionEvidence = null;
  let visionError = null;

  if (!periodicitaYearsFromText && visionBuffer?.length) {
    const vision = await runIdoneitaVisionFallback({
      buffer: visionBuffer,
      mimeType,
    });
    visionFallbackUsed = vision.visionFallbackUsed;
    visionPeriodicitaYears = vision.visionPeriodicitaYears;
    visionEvidence = vision.visionEvidence;
    visionError = vision.visionError;
    if (vision.visionParsed) {
      mergeIdoneitaVisionIntoExtracted(extracted, vision.visionParsed);
      periodicitaYearsFromText = parseIdoneitaPeriodYears(extracted);
    }
  }

  return {
    periodicitaRawFromText,
    periodicitaYearsFromText,
    visionFallbackUsed,
    visionPeriodicitaYears,
    visionEvidence,
    visionError,
    textEnriched: textEnrich.enriched,
    periodicityWarning:
      !parseIdoneitaPeriodYears(extracted) &&
      (normalizeDate(extracted.data_visita) ||
        normalizeDate(extracted.data_giudizio) ||
        normalizeDate(extracted.data_emissione))
        ? IDONEITA_PERIODICITY_WARNING
        : null,
  };
}

export { IDONEITA_PERIODICITY_WARNING };
