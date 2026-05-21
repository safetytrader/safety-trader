// @ts-nocheck
"use client";

import { useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import {
  buildSchediMaestanze,
  buildCSV,
  buildExportFilename,
  openReportPdfPrint,
} from "@/lib/export";

const EXPORT_OPTIONS = [
  {
    id: "report",
    icon: "📋",
    title: "Report HTML documentale",
    description:
      "Riepilogo HTML con Cantiere, Impresa, Checklist, Allegati, Maestranze e scadenze.",
    run: ({ cantiere, imp, user }) => buildSchediMaestanze(cantiere, imp, user),
    filename: (cantiere, imp) => buildExportFilename(cantiere, imp, "html"),
    mime: "text/html;charset=utf-8",
    requiresMaestranze: false,
  },
  {
    id: "csv",
    icon: "📊",
    title: "Esporta elenco CSV",
    description: "Elenco Maestranze in formato tabellare, apribile con Excel.",
    run: ({ cantiere, imp, user }) => "\uFEFF" + buildCSV(cantiere, imp, user),
    filename: (cantiere, imp) => buildExportFilename(cantiere, imp, "csv"),
    mime: "text/csv;charset=utf-8",
    requiresMaestranze: true,
  },
  {
    id: "pdf",
    icon: "📄",
    title: "Report PDF documentale",
    description: "Genera un report riepilogativo completo dell'impresa.",
    action: "print",
    run: ({ cantiere, imp, user }) => openReportPdfPrint(cantiere, imp, user),
    requiresMaestranze: false,
  },
];

export function ExportMenu({ cantiere, imp, onClose }) {
  const [notice, setNotice] = useState("");

  const download = (content, name, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    onClose();
  };

  const handleExport = async option => {
    if (option.requiresMaestranze && !(imp.maestranze?.length > 0)) {
      setNotice(
        "Nessuna maestranza da esportare. Aggiungi le maestranze nella tab dedicata prima di generare il CSV."
      );
      return;
    }
    setNotice("");
    let user = null;
    try {
      user = await getCurrentUser();
    } catch {
      user = null;
    }
    if (option.action === "print") {
      try {
        option.run({ cantiere, imp, user });
        onClose();
      } catch (err) {
        setNotice(
          err instanceof Error
            ? err.message
            : "Impossibile aprire la finestra di stampa PDF."
        );
      }
      return;
    }
    const content = option.run({ cantiere, imp, user });
    download(content, option.filename(cantiere, imp), option.mime);
  };

  return (
    <div
      className="export-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="export-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="export-modal-title"
        aria-modal="true"
      >
        <button
          type="button"
          className="export-close"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ✕
        </button>

        <div className="export-modal-mark" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M8 4h12v20H8V4z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M11 9h6M11 13h6M11 17h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h2 id="export-modal-title" className="export-modal-title">
          Esporta report
        </h2>
        <p className="export-modal-sub">
          Genera un report riepilogativo completo dell&apos;Impresa.
        </p>

        <div className="export-context">
          <div className="export-context-row">
            <span className="export-context-label">Cantiere</span>
            <span className="export-context-value">{cantiere.nome}</span>
          </div>
          <div className="export-context-row">
            <span className="export-context-label">Impresa</span>
            <span className="export-context-value">{imp.nome}</span>
          </div>
          {imp.attivita ? (
            <div className="export-context-row">
              <span className="export-context-label">Attività</span>
              <span className="export-context-value export-context-muted">
                {imp.attivita}
              </span>
            </div>
          ) : null}
        </div>

        {notice ? (
          <p className="export-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="export-options">
          {EXPORT_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              className="export-option"
              onClick={() => handleExport(option)}
            >
              <span className="export-option-icon" aria-hidden>
                {option.icon}
              </span>
              <span className="export-option-text">
                <span className="export-option-title">{option.title}</span>
                <span className="export-option-desc">{option.description}</span>
              </span>
              <span className="export-option-arrow" aria-hidden>
                ↓
              </span>
            </button>
          ))}
        </div>

        <p className="export-footnote">
          I report includono i dati attualmente salvati per questa impresa.
        </p>
      </div>

      <style jsx>{`
        .export-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.52);
          backdrop-filter: blur(3px);
        }

        .export-modal {
          position: relative;
          width: 100%;
          max-width: 480px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
          box-sizing: border-box;
        }

        .export-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          color: #64748b;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .export-close:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .export-modal-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          margin-bottom: 14px;
          border-radius: 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #2563eb;
        }

        .export-modal-title {
          margin: 0 0 6px;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #020617;
        }

        .export-modal-sub {
          margin: 0 0 18px;
          font-size: 14px;
          line-height: 1.55;
          color: #64748b;
        }

        .export-context {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .export-context-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .export-context-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .export-context-value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.4;
        }

        .export-context-muted {
          font-weight: 600;
          color: #475569;
        }

        .export-notice {
          margin: 0 0 14px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #fed7aa;
          background: #fff7ed;
          font-size: 13px;
          line-height: 1.5;
          color: #9a3412;
        }

        .export-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .export-option {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .export-option:hover {
          background: #f8fafc;
          border-color: #bfdbfe;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
        }

        .export-option-icon {
          flex-shrink: 0;
          font-size: 22px;
          line-height: 1;
        }

        .export-option-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .export-option-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }

        .export-option-desc {
          font-size: 12px;
          line-height: 1.45;
          color: #64748b;
        }

        .export-option-arrow {
          flex-shrink: 0;
          font-size: 16px;
          font-weight: 700;
          color: #2563eb;
        }

        .export-footnote {
          margin: 16px 0 0;
          font-size: 11px;
          line-height: 1.5;
          color: #94a3b8;
          text-align: center;
        }

        @media (max-width: 520px) {
          .export-overlay {
            padding: 12px;
            align-items: flex-end;
          }

          .export-modal {
            max-height: 92vh;
            border-bottom-left-radius: 20px;
            border-bottom-right-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
