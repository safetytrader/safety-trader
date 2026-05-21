// @ts-nocheck
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { ExportMenu } from "@/components/export/ExportMenu";
import { AllegatiTab } from "@/components/impresa/AllegatiTab";
import { ChecklistTab } from "@/components/impresa/ChecklistTab";
import { MaestranzeTab } from "@/components/impresa/MaestranzeTab";
import { UploadTab } from "@/components/impresa/UploadTab";
import { BADGE, CHECKLIST_ITEMS } from "@/lib/constants";
import { calcStatus } from "@/lib/utils";

const TABS = [
  { id: "check-list", label: "Checklist" },
  { id: "allegati", label: "Allegati" },
  { id: "maestranze", label: "Maestranze" },
  { id: "upload", label: "Documenti" },
];

export function ImpresaPage({
  c,
  imp,
  user,
  activeCantiere,
  activeImpresa,
  activeTab,
  setActiveTab,
  setPage,
  setShowExport,
  showExport,
  setShowAddMaestra,
  updateImpresa,
  handleFiles,
  dragOver,
  setDragOver,
  fileRef,
  dc,
}) {
  const st = calcStatus(imp.checks);
  const checklistDone = CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length;
  const checklistTot = CHECKLIST_ITEMS.length;
  const docsCount = imp.uploadedFiles?.length || 0;

  return (
    <>
      <div className="impresa-page">
        <AppHeader
          user={user}
          left={
            <BackButton
              onClick={() => {
                setShowExport(false);
                setPage("cantiere");
              }}
              label={c.nome}
            />
          }
          title={imp.nome}
          sub={imp.attivita}
          right={
            <div className="impresa-header-actions">
              <span className={`impresa-status-badge ${BADGE[st]}`}>{st}</span>
              <div className="impresa-export-wrap">
                <button
                  type="button"
                  onClick={() => setShowExport(v => !v)}
                  className="impresa-export-btn"
                >
                  Esporta
                </button>
                {showExport && (
                  <ExportMenu cantiere={c} imp={imp} onClose={() => setShowExport(false)} />
                )}
              </div>
            </div>
          }
        />

        <div className="impresa-shell">
          <nav className="impresa-breadcrumb" aria-label="Breadcrumb">
            <button
              type="button"
              className="impresa-crumb-link"
              onClick={() => setPage("dashboard")}
            >
              Dashboard
            </button>
            <span className="impresa-crumb-sep">/</span>
            <button
              type="button"
              className="impresa-crumb-link"
              onClick={() => {
                setShowExport(false);
                setPage("cantiere");
              }}
            >
              {c.nome}
            </button>
            <span className="impresa-crumb-sep">/</span>
            <span className="impresa-crumb-current">{imp.nome}</span>
          </nav>

          <div className="impresa-nav-actions">
            <button
              type="button"
              className="impresa-nav-btn"
              onClick={() => {
                setShowExport(false);
                setPage("cantiere");
              }}
            >
              ← Torna al cantiere
            </button>
            <button
              type="button"
              className="impresa-nav-btn impresa-nav-btn-muted"
              onClick={() => setPage("dashboard")}
            >
              Dashboard
            </button>
          </div>

          <section className="impresa-hero">
            <div className="impresa-hero-main">
              <h1 className="impresa-hero-title">{imp.nome}</h1>
              <p className="impresa-hero-sub">{imp.attivita || "—"}</p>
              {imp.note ? <p className="impresa-hero-note">{imp.note}</p> : null}
              <div className="impresa-chips">
                <span className="impresa-chip">Cantiere: {c.nome}</span>
                <span className="impresa-chip">
                  Checklist {checklistDone}/{checklistTot}
                </span>
                <span className="impresa-chip impresa-chip-blue">
                  {docsCount} document{docsCount === 1 ? "o" : "i"}
                </span>
              </div>
              <p className="impresa-hero-text">
                Gestione documentale, maestranze e scadenze dell&apos;impresa.
              </p>
            </div>
          </section>

          <div className="impresa-tabs" role="tablist" aria-label="Sezioni impresa">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`impresa-tab ${activeTab === t.id ? "impresa-tab-active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="impresa-tab-panel">
            <div className="impresa-tab-card">
              {activeTab === "upload" && (
                <UploadTab
                  imp={imp}
                  activeCantiere={activeCantiere}
                  activeImpresa={activeImpresa}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  handleFiles={handleFiles}
                  fileRef={fileRef}
                  updateImpresa={updateImpresa}
                />
              )}

              {activeTab === "maestranze" && (
                <MaestranzeTab
                  imp={imp}
                  activeCantiere={activeCantiere}
                  activeImpresa={activeImpresa}
                  updateImpresa={updateImpresa}
                  setShowAddMaestra={setShowAddMaestra}
                  setActiveTab={setActiveTab}
                  dc={dc}
                />
              )}

              {activeTab === "check-list" && (
                <ChecklistTab
                  imp={imp}
                  activeCantiere={activeCantiere}
                  activeImpresa={activeImpresa}
                  updateImpresa={updateImpresa}
                />
              )}

              {activeTab === "allegati" && (
                <AllegatiTab
                  imp={imp}
                  activeCantiere={activeCantiere}
                  activeImpresa={activeImpresa}
                  updateImpresa={updateImpresa}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .impresa-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .impresa-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px 32px 40px;
        }

        .impresa-breadcrumb {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .impresa-crumb-link {
          border: 0;
          background: none;
          padding: 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.18s ease;
        }

        .impresa-crumb-link:hover {
          color: #2563eb;
        }

        .impresa-crumb-sep {
          color: #cbd5e1;
          font-weight: 600;
        }

        .impresa-crumb-current {
          color: #0f172a;
          font-weight: 800;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .impresa-nav-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .impresa-nav-btn {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }

        .impresa-nav-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .impresa-nav-btn-muted {
          color: #64748b;
        }

        .impresa-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .impresa-status-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 999px;
          text-transform: capitalize;
        }

        .impresa-export-wrap {
          position: relative;
        }

        .impresa-export-btn {
          border: 1px solid #334155;
          background: #1e293b;
          color: #f8fafc;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease;
        }

        .impresa-export-btn:hover {
          background: #334155;
          border-color: #475569;
        }

        .impresa-hero {
          padding: 26px 28px;
          margin-bottom: 18px;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
        }

        .impresa-hero-title {
          margin: 0;
          font-size: clamp(22px, 2.8vw, 30px);
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #020617;
          line-height: 1.1;
        }

        .impresa-hero-sub {
          margin: 8px 0 0;
          font-size: 14px;
          color: #64748b;
        }

        .impresa-hero-note {
          margin: 10px 0 0;
          font-size: 13px;
          line-height: 1.55;
          color: #94a3b8;
        }

        .impresa-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .impresa-chip {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }

        .impresa-chip-blue {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .impresa-hero-text {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
        }

        .impresa-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
          padding: 6px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .impresa-tab {
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          border-radius: 12px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .impresa-tab:hover {
          color: #0f172a;
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        .impresa-tab-active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
        }

        .impresa-tab-active:hover {
          background: #1d4ed8;
          color: #ffffff;
          border-color: #1d4ed8;
        }

        .impresa-tab-panel {
          min-width: 0;
        }

        .impresa-tab-card {
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 10px 32px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }

        .impresa-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 18px 22px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafbfc;
        }

        .impresa-section-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }

        .impresa-section-meta {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .impresa-btn-primary {
          border: 0;
          border-radius: 12px;
          background: #2563eb;
          color: #ffffff;
          padding: 9px 16px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
          transition: background 0.18s ease;
        }

        .impresa-btn-primary:hover {
          background: #1d4ed8;
        }

        .impresa-btn-secondary {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease;
        }

        .impresa-btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .impresa-btn-secondary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .impresa-btn-danger-outline {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease;
        }

        .impresa-btn-danger-outline:hover {
          background: #fef2f2;
        }

        .impresa-btn-danger-outline:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .impresa-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .impresa-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.52);
          backdrop-filter: blur(4px);
        }

        .impresa-modal {
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
        }

        .impresa-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .impresa-modal-title {
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          color: #020617;
        }

        .impresa-modal-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: #f8fafc;
          color: #64748b;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }

        .impresa-modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .impresa-modal-body {
          padding: 20px 24px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .impresa-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
        }

        .impresa-field input,
        .impresa-field textarea,
        .impresa-field select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: #ffffff;
          padding: 0 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
        }

        .impresa-field input {
          height: 48px;
        }

        .impresa-field textarea {
          padding: 12px 14px;
          resize: vertical;
          min-height: 88px;
        }

        .impresa-field input:focus,
        .impresa-field textarea:focus,
        .impresa-field select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .impresa-btn-full {
          width: 100%;
          margin-top: 8px;
        }

        @media (max-width: 720px) {
          .impresa-shell {
            padding-left: 24px;
            padding-right: 24px;
          }

          .impresa-tabs {
            overflow-x: auto;
            flex-wrap: nowrap;
          }

          .impresa-tab {
            flex-shrink: 0;
          }
        }

        @media (max-width: 560px) {
          .impresa-shell {
            padding-left: 20px;
            padding-right: 20px;
          }

          .impresa-hero {
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
}
