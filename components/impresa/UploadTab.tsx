// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/lib/supabaseClient";
import {
  formatAppliedSummary,
  formatSkippedSummary,
} from "@/lib/documentAnalysis";
import { prepareAnalyzeRequest } from "@/lib/prepareAnalyzeRequest";

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

function pickAnalyzeFile(fileList) {
  const files = Array.from(fileList || []);
  return files.find(f => f.type === "application/pdf" || f.type?.startsWith("image/")) || null;
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

export function UploadTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [resultModal, setResultModal] = useState(null);

  const runAnalysis = async file => {
    if (!file || analyzing) return;

    setAnalyzing(true);
    setErrorMessage("");
    setPendingFile(file);
    setResultModal(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const payload = await prepareAnalyzeRequest(
        file,
        {
          impresaId: String(activeImpresa),
          cantiereId: String(activeCantiere),
          impresaNome: imp.nome || "",
        },
        authHeaders
      );

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
          allegati: data.state.allegati,
          allegatiScadenze: data.state.allegatiScadenze,
          maestranze: data.state.maestranze,
        });
      }

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
      });
    } catch (err) {
      const message = err?.message || "Analisi AI non disponibile. Riprova tra poco.";
      setErrorMessage(message);
      setResultModal({
        error: true,
        summary: message,
        document_type: null,
        extracted_data: null,
        applied_lines: [],
        skipped_lines: [],
        warnings: [],
      });
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSelectedFiles = fileList => {
    const file = pickAnalyzeFile(fileList);
    if (!file) {
      setErrorMessage("Seleziona un file PDF o un'immagine.");
      return;
    }
    runAnalysis(file);
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
            </div>
          </header>

          <div className="upload-panel-card upload-main-card">
            <div
              className={`upload-dropzone ${dragOver ? "upload-dropzone-active" : ""} ${
                analyzing ? "upload-dropzone-busy" : ""
              }`}
              onDragOver={e => {
                e.preventDefault();
                if (!analyzing) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                if (!analyzing) handleSelectedFiles(e.dataTransfer.files);
              }}
              onClick={() => {
                if (!analyzing) fileRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if ((e.key === "Enter" || e.key === " ") && !analyzing) {
                  fileRef.current?.click();
                }
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="upload-input"
                disabled={analyzing}
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
                disabled={analyzing}
                onClick={e => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                Seleziona file
              </button>
            </div>

            {analyzing ? (
              <div className="upload-status-card" role="status">
                <span className="upload-spinner" />
                <span className="upload-status-text">Analisi in corso…</span>
                <span className="upload-status-hint">
                  Sto leggendo il documento e aggiornando i dati disponibili.
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
                {getVisibleExtractedEntries(resultModal.extracted_data).length > 0 ? (
                  <div>
                    <p className="upload-ai-modal-section">Dati estratti principali</p>
                    <ul className="upload-ai-modal-list">
                      {getVisibleExtractedEntries(resultModal.extracted_data).map(([k, v]) => (
                        <li key={k}>
                          {formatExtractedLabel(k)}: {String(v)}
                        </li>
                      ))}
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
