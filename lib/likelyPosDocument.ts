// @ts-nocheck

function normalizeSample(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function fileNameLooksLikePos(fileName = "") {
  const name = normalizeSample(fileName);
  return /\bpos\b|piano\s+operativo/.test(name);
}

export function extractedTextLooksLikePos(text = "") {
  const sample = normalizeSample(String(text).slice(0, 12000));
  if (!sample) return false;

  return (
    /piano\s+operativo\s+di\s+sicurezza/.test(sample) ||
    /\bpos\b/.test(sample) ||
    /allegato\s+xv/.test(sample) ||
    /d\.?\s*lgs\.?\s*81/.test(sample) ||
    /impresa\s+affidataria/.test(sample) ||
    /lavorazioni\s+svolte\s+in\s+cantiere/.test(sample)
  );
}

export function isPdfFile(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return mime === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf");
}

/** Indizio pre-upload: il PDF potrebbe essere un POS. */
export function likelyPosDocument(file, extractedText = "") {
  if (!file || !isPdfFile(file)) return false;
  return fileNameLooksLikePos(file.name) || extractedTextLooksLikePos(extractedText);
}

export function shouldUploadPosTempForAnalysis(plan, file, extractedText = "") {
  if (!file || !isPdfFile(file)) return false;
  if (plan?.mode === "TEMP_STORAGE") return true;
  if (plan?.mode === "JSON_TEXT" && likelyPosDocument(file, extractedText)) return true;
  return false;
}
