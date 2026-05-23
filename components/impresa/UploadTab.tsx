// @ts-nocheck
"use client";

import { Modal } from "@/components/ui/Modal";
import { BATCH_SIZE } from "@/lib/constants";
import { AI_STATUS, aiStatusLabel, normalizeAiStatus } from "@/lib/documentAnalysis";

function formatFileType(type) {
  if (!type) return "—";
  if (type === "application/pdf") return "PDF";
  if (type.startsWith("image/")) return type.replace("image/", "").toUpperCase() || "IMG";
  return type.split("/").pop()?.toUpperCase() || type;
}

function formatFileSize(size) {
  if (size == null || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const EXTRACTED_FIELD_LABELS = {
  impresa: "Impresa",
  lavoratore: "Lavoratore",
  codice_fiscale: "Codice fiscale",
  mansione: "Mansione",
  data_emissione: "Data emissione",
  data_erogazione: "Data erogazione",
  data_scadenza: "Data scadenza",
  data_fine_contratto: "Data fine contratto",
  ente: "Ente",
  corso: "Corso",
};

function isExtractedValueVisible(value) {
  if (value == null || value === undefined) return false;
  if (typeof value === "string") {
    const t = value.trim();
    return t !== "" && t !== "—" && t.toLowerCase() !== "null";
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

function fileStatusBadge(f) {
  const stato = normalizeAiStatus(f.statoAnalisi);
  const label = aiStatusLabel(stato);

  if (stato === AI_STATUS.IN_CORSO) {
    return { label, className: "upload-pill upload-pill-analyzing" };
  }
  if (stato === AI_STATUS.ANALIZZATO) {
    return { label, className: "upload-pill upload-pill-done" };
  }
  if (stato === AI_STATUS.ERRORE) {
    return { label, className: "upload-pill upload-pill-error" };
  }
  return { label, className: "upload-pill upload-pill-pending" };
}

export function UploadTab({
  imp,
  activeCantiere,
  activeImpresa,
  dragOver,
  setDragOver,
  handleFiles,
  handleAnalyzeDocument,
  aiAnalysisModal,
  setAiAnalysisModal,
  fileRef,
  updateImpresa,
}) {
  const fileCount = imp.uploadedFiles?.length || 0;
  const countLabel = fileCount === 1 ? "1 documento" : `${fileCount} documenti`;
  const hasFiles = fileCount > 0;

  return (
    <>
      <div className="upload-root">
        <div className="upload-stack">
          <header className="upload-header upload-panel-card">
            <div className="upload-header-left">
              <span className="upload-eyebadge">Archivio documentale</span>
              <h2 className="upload-title">Documenti caricati</h2>
              <p className="upload-subtitle">
                Carica e conserva documenti dell&apos;impresa, POS, allegati, attestati e
                file di verifica.
              </p>
            </div>
            <div className="upload-header-right">
              <span className="upload-count-badge">{countLabel}</span>
              <p className="upload-header-meta">Batch da {BATCH_SIZE} file</p>
            </div>
          </header>

          <div className="upload-panel-card upload-main-card">
            <div
              className={`upload-dropzone ${dragOver ? "upload-dropzone-active" : ""}`}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(activeCantiere, activeImpresa, e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="upload-input"
                onChange={e =>
                  handleFiles(activeCantiere, activeImpresa, e.target.files)
                }
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
                Trascina qui i documenti oppure seleziona file
              </p>
              <p className="upload-drop-sub">
                PDF, immagini e documenti tecnici dell&apos;impresa
              </p>
              <button
                type="button"
                className="upload-btn upload-btn-primary"
                onClick={e => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                Seleziona file
              </button>
            </div>

            {(imp.extracting || imp.extractLog?.length > 0) && (
              <div className="upload-log-card">
                <div className="upload-log-title">Log elaborazione</div>
                <div className="upload-log-body">
                  {imp.extractLog?.map((l, i) => (
                    <div
                      key={i}
                      className={`upload-log-line ${
                        l.includes("✅") ||
                        l.includes("👷") ||
                        l.includes("📋") ||
                        l.includes("📎")
                          ? "upload-log-line-ok"
                          : l.includes("❌")
                            ? "upload-log-line-err"
                            : ""
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                  {imp.extracting && (
                    <div className="upload-log-loading">
                      <span className="upload-spinner" />
                      In corso…
                    </div>
                  )}
                </div>
              </div>
            )}

            {!hasFiles && !imp.extractLog?.length ? (
              <section className="upload-empty">
                <div className="upload-empty-icon">📄</div>
                <h3 className="upload-empty-title">Nessun documento caricato</h3>
                <p className="upload-empty-text">
                  Carica il primo documento per iniziare l&apos;archiviazione documentale
                  dell&apos;impresa.
                </p>
              </section>
            ) : null}

            {hasFiles ? (
              <div className="upload-files-card">
                <div className="upload-files-head">
                  <span className="upload-files-title">
                    Documenti in archivio ({fileCount})
                  </span>
                  {!imp.extracting ? (
                    <button
                      type="button"
                      className="upload-btn upload-btn-danger"
                      onClick={() =>
                        updateImpresa(activeCantiere, activeImpresa, {
                          uploadedFiles: [],
                          checks: {},
                          allegati: {},
                          allegatiScadenze: {},
                          maestranze: [],
                          extractLog: [],
                          note: "",
                          analyzed: false,
                          aiSummary: "",
                        })
                      }
                    >
                      Cancella tutto
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="upload-btn upload-btn-danger"
                      disabled
                    >
                      Cancella tutto
                    </button>
                  )}
                </div>
                <div className="upload-files-list">
                  {imp.uploadedFiles.map((f, i) => {
                    const status = fileStatusBadge(f);
                    const analyzing =
                      normalizeAiStatus(f.statoAnalisi) === AI_STATUS.IN_CORSO;
                    return (
                      <div key={f.id || i} className="upload-file-row">
                        <span className="upload-file-type-badge">
                          {formatFileType(f.type)}
                        </span>
                        <div className="upload-file-meta">
                          <div className="upload-file-name" title={f.name}>
                            {f.name}
                          </div>
                          <div className="upload-file-details">
                            <span>{formatFileSize(f.size)}</span>
                            <span className="upload-file-dot">·</span>
                            <span>{formatFileType(f.type)}</span>
                            {f.categoria ? (
                              <>
                                <span className="upload-file-dot">·</span>
                                <span className="upload-file-category">
                                  {f.categoria}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="upload-file-actions">
                          <span className={status.className}>{status.label}</span>
                          <button
                            type="button"
                            className="upload-btn upload-btn-ai"
                            disabled={
                              analyzing ||
                              imp.extracting ||
                              (!f.id && !f.storagePath)
                            }
                            title={
                              !f.id && !f.storagePath
                                ? "Documento non ancora salvato nello Storage"
                                : undefined
                            }
                            onClick={() =>
                              handleAnalyzeDocument(activeCantiere, activeImpresa, i)
                            }
                          >
                            {analyzing ? "Analisi…" : "Analizza con AI"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {aiAnalysisModal ? (
        <Modal
          title={aiAnalysisModal.error ? "Errore analisi" : "Analisi completata"}
          onClose={() => setAiAnalysisModal(null)}
        >
          <div className="upload-ai-modal">
            {aiAnalysisModal.error ? (
              <p className="upload-ai-modal-error">{aiAnalysisModal.summary}</p>
            ) : (
              <>
            <p>
              <strong>Tipo documento riconosciuto:</strong>{" "}
              {aiAnalysisModal.document_type || "—"}
            </p>
            {aiAnalysisModal.summary ? (
              <p className="upload-ai-modal-muted">{aiAnalysisModal.summary}</p>
            ) : null}
            {getVisibleExtractedEntries(aiAnalysisModal.extracted_data).length > 0 ? (
              <div>
                <p className="upload-ai-modal-section">Dati estratti principali</p>
                <ul className="upload-ai-modal-list">
                  {getVisibleExtractedEntries(aiAnalysisModal.extracted_data).map(([k, v]) => (
                    <li key={k}>
                      {formatExtractedLabel(k)}: {String(v)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiAnalysisModal.applied_lines?.length > 0 ? (
              <div>
                <p className="upload-ai-modal-section">Aggiornamenti applicati</p>
                <ul className="upload-ai-modal-list">
                  {aiAnalysisModal.applied_lines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiAnalysisModal.skipped_lines?.length > 0 ? (
              <div>
                <p className="upload-ai-modal-section">
                  Dati non aggiornati (già presenti)
                </p>
                <ul className="upload-ai-modal-list upload-ai-modal-list-muted">
                  {aiAnalysisModal.skipped_lines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiAnalysisModal.warnings?.length > 0 ? (
              <ul className="upload-ai-modal-list upload-ai-modal-list-muted">
                {aiAnalysisModal.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            ) : null}
              </>
            )}
            <button
              type="button"
              className="upload-btn upload-btn-primary upload-ai-modal-close"
              onClick={() => setAiAnalysisModal(null)}
            >
              Chiudi
            </button>
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
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          min-width: 0;
        }

        .upload-panel-card {
          width: 100%;
          max-width: 100%;
          margin-left: 0;
          margin-right: 0;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
        }

        .upload-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin: 0;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .upload-header-left {
          flex: 1 1 280px;
          min-width: 0;
        }

        .upload-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 8px;
          flex: 0 1 auto;
        }

        .upload-eyebadge {
          display: inline-flex;
          align-items: center;
          margin-bottom: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .upload-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.2;
          color: #020617;
        }

        .upload-subtitle {
          margin: 0;
          max-width: 52ch;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .upload-count-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .upload-header-meta {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-align: right;
        }

        .upload-main-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
          overflow: hidden;
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

        .upload-dropzone:hover {
          border-color: #94a3b8;
          background: #f1f5f9;
        }

        .upload-dropzone-active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
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
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
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
          line-height: 1.5;
          color: #64748b;
        }

        .upload-btn {
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease,
            box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .upload-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
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

        .upload-btn-danger {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
        }

        .upload-btn-danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .upload-ai-notice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .upload-ai-notice-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #eff6ff;
          color: #3b82f6;
          font-size: 14px;
          font-weight: 700;
        }

        .upload-ai-notice-title {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        .upload-ai-notice-text {
          margin: 0;
          font-size: 12px;
          line-height: 1.55;
          color: #64748b;
        }

        .upload-log-card {
          border-radius: 16px;
          background: #0f172a;
          padding: 16px 18px;
          max-height: 260px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .upload-log-title {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 10px;
          flex-shrink: 0;
        }

        .upload-log-body {
          overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .upload-log-line {
          line-height: 1.55;
          color: #cbd5e1;
        }

        .upload-log-line-ok {
          color: #6ee7b7;
        }

        .upload-log-line-err {
          color: #fca5a5;
        }

        .upload-log-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          color: #94a3b8;
          font-family: system-ui, sans-serif;
        }

        .upload-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 999px;
          animation: upload-spin 0.8s linear infinite;
        }

        @keyframes upload-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .upload-empty {
          text-align: center;
          padding: 28px 20px;
          border-radius: 16px;
          border: 1px dashed #e2e8f0;
          background: #fafbfc;
        }

        .upload-empty-icon {
          font-size: 32px;
          margin-bottom: 10px;
          opacity: 0.7;
        }

        .upload-empty-title {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: #020617;
        }

        .upload-empty-text {
          margin: 8px auto 0;
          max-width: 420px;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .upload-files-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
          background: #ffffff;
        }

        .upload-files-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px 18px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .upload-files-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }

        .upload-files-list {
          max-height: 320px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .upload-file-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s ease;
        }

        .upload-file-row:hover {
          background: #fafbfc;
        }

        .upload-file-row:last-child {
          border-bottom: none;
        }

        .upload-file-type-badge {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 800;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 5px 8px;
          min-width: 40px;
          text-align: center;
        }

        .upload-file-meta {
          min-width: 0;
          flex: 1;
        }

        .upload-file-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upload-file-details {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
        }

        .upload-file-dot {
          color: #cbd5e1;
        }

        .upload-file-category {
          color: #64748b;
        }

        .upload-pill {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .upload-pill-uploaded {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .upload-pill-pending {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .upload-pill-analyzing {
          background: #f5f3ff;
          color: #6d28d9;
          border: 1px solid #ddd6fe;
        }

        .upload-pill-done {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .upload-pill-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .upload-file-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }

        .upload-btn-ai {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          white-space: nowrap;
        }

        .upload-btn-ai:hover:not(:disabled) {
          background: #dbeafe;
          border-color: #93c5fd;
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
          line-height: 1.5;
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
          color: #334155;
        }

        .upload-ai-modal-list-muted {
          color: #64748b;
        }

        .upload-ai-modal-close {
          align-self: flex-start;
          margin-top: 4px;
        }

        @media (max-width: 720px) {
          .upload-header {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .upload-header-right {
            align-items: flex-start;
          }

          .upload-header-meta {
            text-align: left;
          }

          .upload-main-card {
            padding: 16px;
          }

          .upload-file-row {
            flex-wrap: wrap;
            align-items: flex-start;
          }

          .upload-file-actions {
            width: 100%;
            align-items: stretch;
          }

          .upload-pill {
            width: 100%;
            justify-content: center;
          }

          .upload-btn-ai {
            width: 100%;
          }

          .upload-files-head {
            flex-direction: column;
            align-items: stretch;
          }

          .upload-files-head .upload-btn-danger {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
