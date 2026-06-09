// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabaseClient";
import {
  formatAppliedSummary,
  formatChangeValueForUi,
  formatSkippedSummary,
} from "@/lib/documentAnalysis";
import { formatEur4 } from "@/lib/userProfile";
import { AI_TEMP_BUCKET, uploadFileToAiTemp } from "@/lib/aiTempStorage";
import { shouldUploadPosTempForAnalysis } from "@/lib/likelyPosDocument";
import {
  buildAnalyzeFetchPayload,
  planAnalyzeRequest,
} from "@/lib/prepareAnalyzeRequest";
import { canUseAiAnalysis, getAiUploadBlockMessage } from "@/lib/aiAccess";

const EXTRACTED_FIELD_LABELS = {
  impresa: "Impresa",
  lavoratore: "Lavoratore",
  codice_fiscale: "Codice fiscale",
  codice_fiscale_impresa: "Codice fiscale impresa",
  codice_fiscale_lavoratore: "Codice fiscale lavoratore",
  mansione: "Mansione",
  data_emissione: "Data emissione",
  data_erogazione: "Data erogazione",
  data_scadenza: "Data scadenza",
  data_fine_contratto: "Data fine contratto",
  ente: "Ente",
  corso: "Corso",
  tipo_contratto: "Tipo contratto",
};

function isExtractedValueVisible(value) {
  if (value == null || value === undefined) return false;
  if (typeof value === "string") {
    const t = value.trim();
    return t !== "" && t !== "—" && String(t).toLowerCase() !== "null";
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return !Number.isNaN(value);
  return true;
}

function normalizeExtractedKey(key) {
  if (key === "data_regozione") return "data_erogazione";
  return key;
}

function getVisibleExtractedEntries(extractedData) {
  if (!extractedData || typeof extractedData !== "object") return [];

  const entries = [];
  const seen = new Set();

  for (const [rawKey, value] of Object.entries(extractedData)) {
    if (!isExtractedValueVisible(value)) continue;
    const key = normalizeExtractedKey(rawKey);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push([key, value]);
  }

  return entries;
}

function formatExtractedLabel(key) {
  const normalized = normalizeExtractedKey(key);
  return EXTRACTED_FIELD_LABELS[normalized] || normalized.replace(/_/g, " ");
}

function pickAnalyzeFiles(fileList) {
  return Array.from(fileList || []).filter(
    f => f.type === "application/pdf" || f.type?.startsWith("image/")
  );
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) {
    return { ok: false, error: "Risposta vuota dal server." };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Risposta non valida dal server." };
  }
}

export function UploadTab({ imp, activeCantiere, activeImpresa, updateImpresa, userProfile, onAiUsageComplete }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusPhase, setStatusPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [batchQueue, setBatchQueue] = useState([]);
  const [resultModal, setResultModal] = useState(null);

  const aiBlockMessage = getAiUploadBlockMessage(userProfile);
  const aiEnabled = canUseAiAnalysis(userProfile);

  const runAnalysis = async (file, options = {}) => {
    const { silentResult = false } = options;
    if (!file || analyzing) return;

    if (!aiEnabled) {
      const blockMsg =
        aiBlockMessage || "Il tuo piano non include analisi AI.";
      if (!silentResult) setErrorMessage(blockMsg);
      return { ok: false, error: blockMsg };
    }

    setAnalyzing(true);
    setStatusPhase("analyzing");
    setErrorMessage("");
    setPendingFile(file);
    setResultModal(null);

    let uploadedTempPath = null;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const ids = {
        impresaId: String(activeImpresa),
        cantiereId: String(activeCantiere),
        impresaNome: imp.nome || "",
      };

      const plan = await planAnalyzeRequest(file, ids);
      let temporaryStoragePath;

      const extractedTextHint =
        plan.mode === "JSON_TEXT" ? String(plan.body?.extractedText || "") : "";
      const needsTempUpload = shouldUploadPosTempForAnalysis(
        plan,
        file,
        extractedTextHint
      );

      if (needsTempUpload) {
        setStatusPhase("preparing");
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Utente non autenticato. Effettua nuovamente il login."
          );
        }

        uploadedTempPath = await uploadFileToAiTemp(file, user.id, ids.impresaId);
        temporaryStoragePath = uploadedTempPath;
        setStatusPhase("analyzing");
      }

      const payload = buildAnalyzeFetchPayload(
        plan,
        file,
        ids,
        authHeaders,
        temporaryStoragePath
      );

      setStatusPhase("analyzing");

      const res = await fetch("/api/analyze-documents", {
        method: "POST",
        headers: payload.headers,
        body: payload.body,
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Analisi non riuscita.");
      }

      if (data.state) {
        updateImpresa(activeCantiere, activeImpresa, {
          checks: data.state.checks,
          checkRefs: data.state.checkRefs,
          allegati: data.state.allegati,
          allegatiScadenze: data.state.allegatiScadenze,
          maestranze: data.state.maestranze,
        });
      }

      const isPos =
        String(data.document_type || "").toUpperCase() === "POS";

      if (!silentResult) {
        setResultModal({
          error: false,
          document_type: data.document_type,
          summary: data.summary,
          extracted_data: data.extracted_data,
          applied_lines: formatAppliedSummary(data.applied_changes, {
            isNomina: data.is_nomina,
          }),
          skipped_lines: formatSkippedSummary(data.skipped_changes, {
            isNomina: data.is_nomina,
          }),
          warnings: data.warnings || [],
          analysis_ui: data.analysis_ui || null,
          is_nomina: Boolean(data.is_nomina),
          is_pos: isPos,
          pos_refs_status: data.pos_refs_status,
          pos_refs_source: data.pos_refs_source,
          pos_refs_no_text: Boolean(data.pos_refs_no_text),
          pos_refs_extraction_failed: Boolean(data.pos_refs_extraction_failed),
          pos_references_found: data.pos_references_found ?? 0,
          ai_usage: data.ai_usage || null,
        });
      }

      if (data.ai_usage && typeof onAiUsageComplete === "function") {
        onAiUsageComplete(data.ai_usage);
      }

      return { ok: true };
    } catch (err) {
      if (uploadedTempPath) {
        try {
          await supabase.storage.from(AI_TEMP_BUCKET).remove([uploadedTempPath]);
        } catch (cleanupErr) {
          console.warn("UploadTab: cleanup temp file failed", cleanupErr);
        }
      }

      const message = err?.message || "Analisi AI non disponibile. Riprova tra poco.";
      setErrorMessage(message);
      if (!silentResult) {
        setResultModal({
          error: true,
          summary: message,
          document_type: null,
          extracted_data: null,
          applied_lines: [],
          skipped_lines: [],
          warnings: [],
        });
      }
      return { ok: false, error: message };
    } finally {
      setAnalyzing(false);
      setStatusPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runBatchAnalysis = async files => {
    if (!files.length || analyzing) return;

    const queue = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      name: file.name,
      status: "In attesa",
      error: "",
    }));
    setBatchQueue(queue);
    setResultModal(null);
    setErrorMessage("");

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setBatchQueue(prev =>
        prev.map((q, idx) => (idx === i ? { ...q, status: "Analisi in corso" } : q))
      );
      const result = await runAnalysis(file, { silentResult: true });
      if (result?.ok) {
        completed += 1;
        setBatchQueue(prev =>
          prev.map((q, idx) => (idx === i ? { ...q, status: "Completato", error: "" } : q))
        );
      } else {
        failed += 1;
        setBatchQueue(prev =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: "Errore", error: result?.error || "Analisi non riuscita" }
              : q
          )
        );
      }
    }

    setResultModal({
      error: failed > 0,
      summary: `${files.length} file analizzati, ${completed} completati, ${failed} con errore`,
      document_type: null,
      extracted_data: null,
      applied_lines: [],
      skipped_lines: [],
      warnings: [],
      batch: true,
    });
  };

  const handleSelectedFiles = fileList => {
    if (!aiEnabled) {
      setErrorMessage(
        aiBlockMessage || "Il tuo piano non include analisi AI."
      );
      return;
    }
    const files = pickAnalyzeFiles(fileList);
    if (!files.length) {
      setErrorMessage("Seleziona un file PDF o un'immagine.");
      return;
    }
    if (files.length === 1) {
      runAnalysis(files[0]);
      return;
    }
    runBatchAnalysis(files);
  };

  const handleRetry = () => {
    if (pendingFile) {
      runAnalysis(pendingFile);
      return;
    }
    setErrorMessage("Seleziona di nuovo il documento da analizzare.");
    setResultModal(null);
    fileRef.current?.click();
  };

  return (
    <>
      <div className="upload-root">
        <div className="upload-stack">
          <header className="upload-header upload-panel-card">
            <div className="upload-header-left">
              <span className="upload-eyebadge">Analisi AI</span>
              <h2 className="upload-title">Analisi documentale AI</h2>
              <p className="upload-subtitle">
                Carica un documento per analizzarlo automaticamente e compilare
                checklist, allegati e maestranze.
              </p>
              {aiBlockMessage ? (
                <p className="upload-plan-block" role="status">
                  {aiBlockMessage}
                </p>
              ) : null}
            </div>
          </header>

          <div className="upload-panel-card upload-main-card">
            <div
              className={`upload-dropzone ${dragOver ? "upload-dropzone-active" : ""} ${
                analyzing ? "upload-dropzone-busy" : ""
              } ${!aiEnabled ? "upload-dropzone-disabled" : ""}`}
              onDragOver={e => {
                e.preventDefault();
                if (!analyzing && aiEnabled) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (!analyzing && aiEnabled) handleSelectedFiles(e.dataTransfer.files);
              }}
              onClick={() => {
                if (!analyzing && aiEnabled) fileRef.current?.click();
              }}
              role="button"
              tabIndex={aiEnabled ? 0 : -1}
              aria-disabled={!aiEnabled}
              onKeyDown={e => {
                if ((e.key === "Enter" || e.key === " ") && !analyzing && aiEnabled) {
                  fileRef.current?.click();
                }
              }}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="upload-input"
                disabled={analyzing || !aiEnabled}
                onChange={e => handleSelectedFiles(e.target.files)}
              />
              <div className="upload-drop-mark" aria-hidden>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect
                    x="6"
                    y="10"
                    width="28"
                    height="22"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M20 16v10M15 21h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="upload-drop-title">
                Trascina qui un documento oppure seleziona file
              </p>
              <p className="upload-drop-sub">
                PDF, immagini e documenti tecnici dell&apos;impresa
              </p>
              <button
                type="button"
                className="upload-btn upload-btn-primary"
                disabled={analyzing || !aiEnabled}
                onClick={e => {
                  e.stopPropagation();
                  if (aiEnabled) fileRef.current?.click();
                }}
              >
                {aiEnabled ? "Seleziona file" : "Analisi AI disabilitata"}
              </button>
            </div>

            {analyzing ? (
              <div className="upload-status-card" role="status">
                <span className="upload-spinner" />
                <span className="upload-status-text">
                  {statusPhase === "preparing"
                    ? "Preparazione documento…"
                    : "Analisi in corso…"}
                </span>
                <span className="upload-status-hint">
                  {statusPhase === "preparing"
                    ? "Caricamento temporaneo per l'analisi AI (non viene archiviato)."
                    : "Sto leggendo il documento e aggiornando i dati disponibili."}
                </span>
              </div>
            ) : null}

            {errorMessage && !analyzing && !resultModal ? (
              <div className="upload-error-inline">
                <p>{errorMessage}</p>
                <button type="button" className="upload-btn upload-btn-secondary" onClick={handleRetry}>
                  Riprova
                </button>
              </div>
            ) : null}

            {batchQueue.length > 0 ? (
              <div className="upload-status-card">
                <span className="upload-status-text">Coda analisi</span>
                <ul className="upload-ai-modal-list upload-ai-modal-list-muted">
                  {batchQueue.map(item => (
                    <li key={item.id}>
                      {item.name}: {item.status}
                      {item.error ? ` (${item.error})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {resultModal ? (
        <Modal
          title={resultModal.error ? "Errore analisi" : "Analisi completata"}
          onClose={() => setResultModal(null)}
        >
          <div className="upload-ai-modal">
            {resultModal.error ? (
              <>
                <p className="upload-ai-modal-error">{resultModal.summary}</p>
                <button type="button" className="upload-btn upload-btn-primary" onClick={handleRetry}>
                  Riprova
                </button>
              </>
            ) : (
              <>
                <p>
                  <strong>Tipo documento riconosciuto:</strong>{" "}
                  {resultModal.document_type || "—"}
                </p>
                {resultModal.is_pos ? (
                  <div className="upload-ai-modal-pos">
                    <p>
                      <strong>Checklist aggiornata</strong>
                    </p>
                    <p className="upload-ai-modal-muted">
                      {resultModal.pos_references_found > 0
                        ? `Riferimenti pagina rilevati: ${resultModal.pos_references_found}`
                        : resultModal.pos_refs_extraction_failed
                          ? "Errore tecnico durante l'estrazione dei riferimenti pagina."
                          : resultModal.pos_refs_no_text
                            ? "Riferimenti pagina non rilevabili: PDF scansionato o testo non estraibile."
                            : "Nessun riferimento pagina trovato con ricerca automatica nel documento."}
                    </p>
                  </div>
                ) : null}
                {resultModal.analysis_ui ? (
                  <div className="upload-ai-modal-nomina">
                    <p>
                      <strong>{resultModal.analysis_ui.title}</strong>
                    </p>
                    <p className="upload-ai-modal-muted">{resultModal.analysis_ui.body}</p>
                    <p className="upload-ai-modal-section">
                      {resultModal.analysis_ui.appliedSummary}
                    </p>
                  </div>
                ) : null}
                {resultModal.summary ? (
                  <p className="upload-ai-modal-muted">{resultModal.summary}</p>
                ) : null}
                {resultModal.ai_usage ? (
                  <div className="upload-ai-modal-credit">
                    <p>
                      <strong>Costo analisi:</strong> €
                      {formatEur4(resultModal.ai_usage.cost_eur)}
                    </p>
                    <p>
                      <strong>Credito residuo:</strong> €
                      {formatEur4(resultModal.ai_usage.credit_after)}
                    </p>
                  </div>
                ) : null}
                {getVisibleExtractedEntries(resultModal.extracted_data).length > 0 ? (
                  <div>
                    <p className="upload-ai-modal-section">Dati estratti principali</p>
                    <ul className="upload-ai-modal-list">
                      {getVisibleExtractedEntries(resultModal.extracted_data).map(([k, v]) => {
                        const label = formatChangeValueForUi(v);
                        if (label == null) return null;
                        return (
                          <li key={k}>
                            {formatExtractedLabel(k)}: {label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {!resultModal.is_nomina && resultModal.applied_lines?.length > 0 ? (
                  <div>
                    <p className="upload-ai-modal-section">Aggiornamenti applicati</p>
                    <ul className="upload-ai-modal-list">
                      {resultModal.applied_lines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!resultModal.is_nomina && resultModal.skipped_lines?.length > 0 ? (
                  <div>
                    <p className="upload-ai-modal-section">
                      Dati non aggiornati (già presenti)
                    </p>
                    <ul className="upload-ai-modal-list upload-ai-modal-list-muted">
                      {resultModal.skipped_lines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {resultModal.warnings?.length > 0 ? (
                  <ul className="upload-ai-modal-list upload-ai-modal-list-muted">
                    {resultModal.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  className="upload-btn upload-btn-primary upload-ai-modal-close"
                  onClick={() => setResultModal(null)}
                >
                  Chiudi
                </button>
              </>
            )}
          </div>
        </Modal>
      ) : null}

      <style jsx>{`
        .upload-root {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .upload-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }

        .upload-panel-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .upload-header {
          padding: 24px;
        }

        .upload-eyebadge {
          display: inline-flex;
          margin-bottom: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .upload-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #020617;
        }

        .upload-subtitle {
          margin: 0;
          max-width: 56ch;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .upload-main-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .upload-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 20px;
          background: #f8fafc;
          padding: 36px 24px 28px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .upload-dropzone:hover:not(.upload-dropzone-busy) {
          border-color: #94a3b8;
          background: #f1f5f9;
        }

        .upload-dropzone-active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .upload-dropzone-busy {
          cursor: wait;
          opacity: 0.85;
        }

        .upload-dropzone-disabled {
          opacity: 0.55;
          cursor: not-allowed;
          pointer-events: none;
        }

        .upload-plan-block {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 600;
        }

        .upload-input {
          display: none;
        }

        .upload-drop-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          margin: 0 auto 14px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #2563eb;
        }

        .upload-drop-title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .upload-drop-sub {
          margin: 8px 0 18px;
          font-size: 13px;
          color: #64748b;
        }

        .upload-btn {
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        }

        .upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-btn-primary {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
        }

        .upload-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .upload-btn-secondary {
          border: 1px solid #dbe3ef;
          background: #ffffff;
          color: #334155;
        }

        .upload-status-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid #ddd6fe;
          background: #f5f3ff;
        }

        .upload-status-text {
          font-size: 14px;
          font-weight: 700;
          color: #5b21b6;
        }

        .upload-status-hint {
          font-size: 12px;
          font-weight: 600;
          color: #7c3aed;
        }

        .upload-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid #7c3aed;
          border-top-color: transparent;
          border-radius: 999px;
          animation: upload-spin 0.8s linear infinite;
        }

        @keyframes upload-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .upload-error-inline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
          font-weight: 600;
        }

        .upload-ai-modal {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 14px;
          line-height: 1.5;
          color: #334155;
        }

        .upload-ai-modal-muted {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .upload-ai-modal-credit {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          font-size: 13px;
          color: #1e3a8a;
        }

        .upload-ai-modal-credit p {
          margin: 0 0 4px;
        }

        .upload-ai-modal-credit p:last-child {
          margin-bottom: 0;
        }

        .upload-ai-modal-error {
          margin: 0;
          color: #b91c1c;
          font-size: 14px;
          font-weight: 600;
        }

        .upload-ai-modal-section {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }

        .upload-ai-modal-list {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
        }

        .upload-ai-modal-list-muted {
          color: #64748b;
        }

        .upload-ai-modal-close {
          align-self: flex-start;
          margin-top: 4px;
        }
      `}</style>
    </>
  );
}
