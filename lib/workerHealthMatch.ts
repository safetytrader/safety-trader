// @ts-nocheck
import {
  charSimilarity,
  nameSimilarity,
  normalizeCodiceFiscale,
  normalizeWorkerName,
} from "@/lib/utils";

const HEALTH_MATCH_THRESHOLD = 0.68;
const HEALTH_MATCH_GAP = 0.08;
const HEALTH_DUPLICATE_BLOCK_THRESHOLD = 0.62;

function invertWorkerName(name) {
  const parts = normalizeWorkerName(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return normalizeWorkerName(name);
  return [...parts].reverse().join(" ");
}

function surnameOcrScore(s1, s2) {
  const a = String(s1 || "").toUpperCase();
  const b = String(s2 || "").toUpperCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  return charSimilarity(a, b);
}

function scoreHealthName(extractedName, existingName, fileName = "") {
  const a = normalizeWorkerName(extractedName);
  const b = normalizeWorkerName(existingName);
  if (!a || !b) return { score: 0, reason: "nome vuoto" };
  if (a === b) return { score: 1, reason: "nome esatto" };

  const scores = [
    { score: nameSimilarity(a, b), reason: "similarita nominativo" },
    { score: nameSimilarity(invertWorkerName(a), b), reason: "nome invertito" },
    { score: nameSimilarity(a, invertWorkerName(b)), reason: "esistente invertito" },
  ];

  const aParts = a.split(/\s+/).filter(Boolean);
  const bParts = b.split(/\s+/).filter(Boolean);
  if (aParts[0] && bParts[0]) {
    const surnameScore = surnameOcrScore(aParts[0], bParts[0]);
    const firstScore =
      aParts[1] && bParts[1] ? surnameOcrScore(aParts[1], bParts[1]) : 1;
    scores.push({
      score: surnameScore * 0.55 + firstScore * 0.45,
      reason: "ocr cognome/nome",
    });
  }

  const fileNorm = String(fileName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (fileNorm && aParts.some(p => p.length >= 3 && fileNorm.includes(p.toLowerCase()))) {
    scores.push({
      score: Math.min(1, Math.max(...scores.map(s => s.score)) + 0.04),
      reason: "indizio filename",
    });
  }

  return scores.reduce((best, cur) => (cur.score > best.score ? cur : best), scores[0]);
}

/**
 * Trova maestranza esistente per certificato idoneità (CF, nome, fuzzy OCR).
 */
export function findExistingWorkerForHealthCertificate(
  extractedWorker = {},
  existingWorkers = [],
  fileName = ""
) {
  const extractedName = normalizeWorkerName(extractedWorker.nome || "");
  const cf = normalizeCodiceFiscale(extractedWorker.codiceFiscale || "");

  const candidates = (existingWorkers || []).map((worker, index) => {
    const existingName = normalizeWorkerName(worker.nome || "");
    const { score, reason } = scoreHealthName(extractedName, existingName, fileName);
    return {
      index,
      existingName: worker.nome || existingName,
      score,
      reason,
    };
  });

  candidates.sort((a, b) => b.score - a.score);

  const debug = {
    extractedWorker: extractedWorker.nome || "",
    normalizedExtractedWorker: extractedName,
    candidates: candidates.slice(0, 8).map(c => ({
      existingName: c.existingName,
      score: Number(c.score.toFixed(3)),
      reason: c.reason,
    })),
    selectedWorker: null,
    createdNewWorker: false,
  };

  if (cf) {
    const cfIndex = (existingWorkers || []).findIndex(
      w => normalizeCodiceFiscale(w.codiceFiscale || "") === cf
    );
    if (cfIndex >= 0) {
      debug.selectedWorker = existingWorkers[cfIndex].nome;
      return {
        index: cfIndex,
        ambiguous: false,
        allowCreate: false,
        bestScore: 1,
        debug,
      };
    }
  }

  const strong = candidates.filter(c => c.score >= HEALTH_MATCH_THRESHOLD);
  if (strong.length === 1) {
    debug.selectedWorker = existingWorkers[strong[0].index]?.nome || strong[0].existingName;
    return {
      index: strong[0].index,
      ambiguous: false,
      allowCreate: false,
      bestScore: strong[0].score,
      debug,
    };
  }

  if (strong.length > 1) {
    const top = strong[0].score;
    const second = strong[1].score;
    if (top - second >= HEALTH_MATCH_GAP) {
      debug.selectedWorker = existingWorkers[strong[0].index]?.nome || strong[0].existingName;
      return {
        index: strong[0].index,
        ambiguous: false,
        allowCreate: false,
        bestScore: top,
        debug,
      };
    }
    return {
      index: -1,
      ambiguous: true,
      allowCreate: false,
      bestScore: top,
      debug,
    };
  }

  const best = candidates[0];
  const bestScore = best?.score || 0;
  if (bestScore >= HEALTH_DUPLICATE_BLOCK_THRESHOLD) {
    return {
      index: -1,
      ambiguous: true,
      allowCreate: false,
      bestScore,
      debug,
    };
  }

  const tokenCount = extractedName.split(/\s+/).filter(Boolean).length;
  const allowCreate = tokenCount >= 2;
  if (allowCreate) debug.createdNewWorker = true;

  return {
    index: -1,
    ambiguous: false,
    allowCreate,
    bestScore,
    debug,
  };
}
