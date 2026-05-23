// @ts-nocheck
"use client";

import { CHECKLIST_ITEMS } from "@/lib/constants";
import { upsertChecklistImpresa } from "@/lib/db";
import { calcStatus } from "@/lib/utils";

const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"];

function statusDisplay(calcKey) {
  if (calcKey === "idoneo") {
    return { label: "Completa", className: "checklist-status-badge checklist-status-complete" };
  }
  if (calcKey === "parziale") {
    return { label: "Parziale", className: "checklist-status-badge checklist-status-partial" };
  }
  return { label: "Da completare", className: "checklist-status-badge checklist-status-pending" };
}

function rowStatusBadge(value) {
  if (value === "si") {
    return { label: "Conforme", className: "checklist-row-badge checklist-row-badge-ok" };
  }
  if (value === "no") {
    return { label: "Non conforme", className: "checklist-row-badge checklist-row-badge-miss" };
  }
  if (value === "n.a.") {
    return { label: "N/A", className: "checklist-row-badge checklist-row-badge-na" };
  }
  return { label: "Da verificare", className: "checklist-row-badge checklist-row-badge-pending" };
}

export function ChecklistTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncChecklist = async (checks, note, checkRefs) => {
    try {
      await upsertChecklistImpresa(
        activeImpresa,
        checks,
        note,
        checkRefs ?? imp.checkRefs ?? {}
      );
    } catch (err) {
      console.error("Errore salvataggio checklist Supabase:", err?.message || err);
    }
  };

  const done = CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length;
  const st = calcStatus(imp.checks || {});
  const status = statusDisplay(st);

  return (
    <>
      <div className="checklist-root">
        <div className="checklist-stack">
          <header className="checklist-header checklist-panel-card">
            <div className="checklist-header-left">
              <span className="checklist-eyebadge">Verifica documentale</span>
              <h2 className="checklist-title">Checklist dell&apos;impresa</h2>
              <p className="checklist-subtitle">
                Controlla la completezza della documentazione aziendale, delle maestranze
                e delle attrezzature.
              </p>
            </div>
            <div className="checklist-header-right">
              <span className={status.className}>{status.label}</span>
              <p className="checklist-header-meta">
                {done}/{CHECKLIST_ITEMS.length} voci conformi · POS Allegato XV D.Lgs. 81/2008
              </p>
            </div>
          </header>

          {CHECKLIST_ITEMS.length === 0 ? (
            <section className="checklist-empty-card checklist-panel-card">
              <div className="checklist-empty-icon">✓</div>
              <h3 className="checklist-empty-title">Nessun elemento checklist</h3>
              <p className="checklist-empty-text">
                Non sono presenti elementi da verificare per questa impresa.
              </p>
            </section>
          ) : (
            <div className="checklist-panel-card checklist-main-card">
              <div className="checklist-main-head">
                <span className="checklist-main-title">Checklist POS</span>
                <span className="checklist-main-meta">
                  {done}/{CHECKLIST_ITEMS.length} conformi
                </span>
              </div>

              <div className="checklist-col-headers" aria-hidden="true">
                <span className="checklist-col-headers-voce">Voce</span>
                <span className="checklist-col-headers-pag">Rif. pag.</span>
                <span className="checklist-col-headers-stato">Stato</span>
              </div>

              <div className="checklist-groups">
                {LETTERS.map(l => {
                  const items = CHECKLIST_ITEMS.filter(i => i.lettera === l);
                  if (!items.length) return null;
                  return (
                    <section key={l} className="checklist-group">
                      <div className="checklist-group-head">Lettera {l.toUpperCase()}</div>
                      {items.map(item => {
                        const current = imp.checks[item.id];
                        const pageRef = imp.checkRefs?.[item.id] ?? "";
                        const badge = rowStatusBadge(current);
                        return (
                          <div key={item.id} className="checklist-row">
                            <div className="checklist-row-main">
                              <div className="checklist-opts" role="group" aria-label={item.label}>
                                {["si", "no", "n.a."].map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => {
                                      const nuoviChecks = {
                                        ...(imp.checks || {}),
                                        [item.id]: v,
                                      };
                                      updateImpresa(activeCantiere, activeImpresa, {
                                        checks: nuoviChecks,
                                      });
                                      syncChecklist(
                                        nuoviChecks,
                                        imp.note ?? "",
                                        imp.checkRefs || {}
                                      );
                                    }}
                                    className={`checklist-opt ${
                                      current === v
                                        ? `checklist-opt-${v.replace(".", "")}`
                                        : ""
                                    }`}
                                  >
                                    {v.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                              <div className="checklist-row-text">
                                <span className="checklist-label">
                                  {item.label}
                                  {item.required ? (
                                    <span className="checklist-req" title="Obbligatorio">
                                      *
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            </div>
                            <input
                              type="text"
                              className="checklist-page-ref"
                              value={pageRef}
                              placeholder="pag. 3"
                              aria-label={`Riferimento pagina per ${item.label}`}
                              onChange={e => {
                                const value = e.target.value.trim();
                                const nuoviRefs = { ...(imp.checkRefs || {}) };
                                if (!value) delete nuoviRefs[item.id];
                                else nuoviRefs[item.id] = value;
                                updateImpresa(activeCantiere, activeImpresa, {
                                  checkRefs: nuoviRefs,
                                });
                                syncChecklist(imp.checks || {}, imp.note ?? "", nuoviRefs);
                              }}
                            />
                            <span className={badge.className}>{badge.label}</span>
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>

              <div className="checklist-notes">
                <label className="checklist-notes-label" htmlFor="checklist-note-cse">
                  Note
                </label>
                <textarea
                  id="checklist-note-cse"
                  value={imp.note}
                  onChange={e => {
                    const nuovaNota = e.target.value;
                    updateImpresa(activeCantiere, activeImpresa, { note: nuovaNota });
                    syncChecklist(imp.checks || {}, nuovaNota, imp.checkRefs || {});
                  }}
                  rows={3}
                  className="checklist-textarea"
                  placeholder="Carenze, integrazioni richieste…"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .checklist-root {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .checklist-stack {
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

        .checklist-panel-card {
          width: 100%;
          max-width: 100%;
          margin-left: 0;
          margin-right: 0;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
        }

        .checklist-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin: 0;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .checklist-header-left {
          flex: 1 1 280px;
          min-width: 0;
        }

        .checklist-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 8px;
          flex: 0 1 auto;
        }

        .checklist-eyebadge {
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

        .checklist-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.2;
          color: #020617;
        }

        .checklist-subtitle {
          margin: 0;
          max-width: 52ch;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .checklist-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .checklist-status-complete {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .checklist-status-partial {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .checklist-status-pending {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .checklist-header-meta {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-align: right;
        }

        .checklist-empty-card {
          text-align: center;
          padding: 48px 32px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .checklist-empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .checklist-empty-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #020617;
        }

        .checklist-empty-text {
          margin: 10px auto 0;
          max-width: 420px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748b;
        }

        .checklist-main-card {
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .checklist-main-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 16px 22px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .checklist-col-headers {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 22px 4px;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
        }

        .checklist-col-headers-voce {
          flex: 1;
          min-width: 0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .checklist-col-headers-pag {
          flex-shrink: 0;
          width: 88px;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
        }

        .checklist-col-headers-stato {
          flex-shrink: 0;
          width: 108px;
          text-align: right;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .checklist-main-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
        }

        .checklist-main-meta {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }

        .checklist-groups {
          display: flex;
          flex-direction: column;
        }

        .checklist-group {
          border-bottom: 1px solid #f1f5f9;
        }

        .checklist-group:last-child {
          border-bottom: none;
        }

        .checklist-group-head {
          padding: 12px 22px;
          background: #f8fafc;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
          border-bottom: 1px solid #f1f5f9;
        }

        .checklist-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 22px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s ease;
        }

        .checklist-row:hover {
          background: #fafbfc;
        }

        .checklist-group .checklist-row:last-child {
          border-bottom: none;
        }

        .checklist-row-main {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .checklist-opts {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .checklist-opt {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #94a3b8;
          border-radius: 10px;
          padding: 7px 10px;
          min-width: 36px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .checklist-opt:hover {
          border-color: #cbd5e1;
          color: #64748b;
          background: #f8fafc;
        }

        .checklist-opt-si {
          background: #10b981;
          border-color: #10b981;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .checklist-opt-si:hover {
          background: #059669;
          border-color: #059669;
          color: #ffffff;
        }

        .checklist-opt-no {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
        }

        .checklist-opt-no:hover {
          background: #dc2626;
          border-color: #dc2626;
          color: #ffffff;
        }

        .checklist-opt-na {
          background: #94a3b8;
          border-color: #94a3b8;
          color: #ffffff;
        }

        .checklist-opt-na:hover {
          background: #64748b;
          border-color: #64748b;
          color: #ffffff;
        }

        .checklist-row-text {
          flex: 1;
          min-width: 0;
        }

        .checklist-label {
          display: block;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 600;
          color: #0f172a;
        }

        .checklist-req {
          margin-left: 4px;
          color: #f87171;
          font-size: 12px;
          font-weight: 800;
        }

        .checklist-row-badge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          margin-top: 2px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .checklist-row-badge-ok {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .checklist-row-badge-miss {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .checklist-row-badge-na {
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .checklist-row-badge-pending {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .checklist-page-ref {
          flex-shrink: 0;
          width: 88px;
          height: 34px;
          box-sizing: border-box;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #0f172a;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .checklist-page-ref::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .checklist-page-ref:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .checklist-notes {
          padding: 20px 22px 24px;
          border-top: 1px solid #e2e8f0;
          background: #fafbfc;
        }

        .checklist-notes-label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
        }

        .checklist-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: #ffffff;
          padding: 12px 14px;
          font-size: 14px;
          color: #0f172a;
          resize: vertical;
          min-height: 88px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .checklist-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        @media (max-width: 720px) {
          .checklist-header {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .checklist-header-right {
            align-items: flex-start;
          }

          .checklist-header-meta {
            text-align: left;
          }

          .checklist-row {
            flex-wrap: wrap;
            align-items: flex-start;
          }

          .checklist-page-ref {
            width: 100%;
            max-width: 140px;
          }

          .checklist-row-badge {
            align-self: flex-start;
          }

          .checklist-row-main {
            flex-direction: column;
            gap: 12px;
          }

          .checklist-opts {
            width: 100%;
          }

          .checklist-opt {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}
