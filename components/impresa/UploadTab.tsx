// @ts-nocheck
"use client";

import { BATCH_SIZE } from "@/lib/constants";

export function UploadTab({
  imp,
  activeCantiere,
  activeImpresa,
  dragOver,
  setDragOver,
  handleFiles,
  fileRef,
  updateImpresa,
}) {
  return (
    <>
      <div className="impresa-upload">
        <div className="impresa-section-head">
          <span className="impresa-section-title">Carica documenti</span>
          <span className="impresa-section-meta">
            Batch da {BATCH_SIZE} file
          </span>
        </div>

        <div className="impresa-upload-body">
          <div
            className={`impresa-upload-drop ${dragOver ? "impresa-upload-drop-active" : ""}`}
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
              className="impresa-upload-input"
              onChange={e =>
                handleFiles(activeCantiere, activeImpresa, e.target.files)
              }
            />
            <div className="impresa-upload-drop-icon">📂</div>
            <p className="impresa-upload-drop-title">Trascina qui i documenti</p>
            <p className="impresa-upload-drop-sub">oppure clicca per selezionare</p>
            <p className="impresa-upload-drop-hint">PDF · JPEG · PNG</p>
          </div>

          {(imp.extracting || imp.extractLog?.length > 0) && (
            <div className="impresa-upload-log">
              <div className="impresa-upload-log-title">Log elaborazione</div>
              {imp.extractLog?.map((l, i) => (
                <div
                  key={i}
                  className={`impresa-upload-log-line ${
                    l.includes("✅") ||
                    l.includes("👷") ||
                    l.includes("📋") ||
                    l.includes("📎")
                      ? "impresa-upload-log-ok"
                      : l.includes("❌")
                        ? "impresa-upload-log-err"
                        : ""
                  }`}
                >
                  {l}
                </div>
              ))}
              {imp.extracting && (
                <div className="impresa-upload-log-loading">
                  <span className="impresa-upload-spinner" />
                  In corso…
                </div>
              )}
            </div>
          )}

          {imp.uploadedFiles?.length > 0 && (
            <div className="impresa-upload-files">
              <div className="impresa-upload-files-head">
                <span className="impresa-upload-files-title">
                  File caricati ({imp.uploadedFiles.length})
                </span>
                {!imp.extracting && (
                  <button
                    type="button"
                    className="impresa-upload-clear"
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
                )}
              </div>
              <div className="impresa-upload-files-list">
                {imp.uploadedFiles.map((f, i) => (
                  <div key={i} className="impresa-upload-file-row">
                    <span className="impresa-upload-file-icon">
                      {f.type === "application/pdf" ? "PDF" : "IMG"}
                    </span>
                    <div className="impresa-upload-file-meta">
                      <div className="impresa-upload-file-name">{f.name}</div>
                      <div className="impresa-upload-file-size">
                        {(f.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!imp.uploadedFiles?.length && !imp.extractLog?.length && (
            <div className="impresa-upload-help">
              <strong>Come funziona:</strong> carica tutti i PDF e immagini ricevuti.
              Vengono elaborati in batch: maestranze e check-list estratti
              automaticamente con scadenze generate automaticamente. Usa poi{" "}
              <strong>Esporta</strong> per scaricare la scheda maestranze.
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .impresa-upload-body {
          padding: 20px 22px 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .impresa-upload-drop {
          border: 2px dashed #cbd5e1;
          border-radius: 20px;
          background: #fafbfc;
          padding: 40px 24px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .impresa-upload-drop:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .impresa-upload-drop-active {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .impresa-upload-input {
          display: none;
        }

        .impresa-upload-drop-icon {
          font-size: 36px;
          margin-bottom: 10px;
        }

        .impresa-upload-drop-title {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }

        .impresa-upload-drop-sub {
          margin: 6px 0 0;
          font-size: 13px;
          color: #64748b;
        }

        .impresa-upload-drop-hint {
          margin: 12px 0 0;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 700;
        }

        .impresa-upload-log {
          border-radius: 16px;
          background: #0f172a;
          padding: 16px 18px;
          max-height: 260px;
          overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
        }

        .impresa-upload-log-title {
          font-family: system-ui, sans-serif;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 10px;
        }

        .impresa-upload-log-line {
          line-height: 1.55;
          color: #cbd5e1;
        }

        .impresa-upload-log-ok {
          color: #6ee7b7;
        }

        .impresa-upload-log-err {
          color: #fca5a5;
        }

        .impresa-upload-log-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          color: #94a3b8;
          font-family: system-ui, sans-serif;
        }

        .impresa-upload-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 999px;
          animation: impresa-spin 0.8s linear infinite;
        }

        @keyframes impresa-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .impresa-upload-files {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
        }

        .impresa-upload-files-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: #fafbfc;
          border-bottom: 1px solid #f1f5f9;
        }

        .impresa-upload-files-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }

        .impresa-upload-clear {
          border: 0;
          background: none;
          color: #dc2626;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .impresa-upload-files-list {
          max-height: 220px;
          overflow-y: auto;
        }

        .impresa-upload-file-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid #f8fafc;
        }

        .impresa-upload-file-row:last-child {
          border-bottom: none;
        }

        .impresa-upload-file-icon {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 800;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 4px 6px;
        }

        .impresa-upload-file-meta {
          min-width: 0;
          flex: 1;
        }

        .impresa-upload-file-name {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .impresa-upload-file-size {
          margin-top: 2px;
          font-size: 11px;
          color: #94a3b8;
        }

        .impresa-upload-help {
          border-radius: 14px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.6;
          color: #1e40af;
        }
      `}</style>
    </>
  );
}
