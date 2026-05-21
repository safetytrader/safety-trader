// @ts-nocheck
"use client";

import { CHECKLIST_ITEMS } from "@/lib/constants";
import { upsertChecklistImpresa } from "@/lib/db";

export function ChecklistTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncChecklist = async (checks, note) => {
    try {
      await upsertChecklistImpresa(activeImpresa, checks, note);
    } catch (err) {
      console.error("Errore salvataggio checklist Supabase:", err?.message || err);
    }
  };

  const done = CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length;

  return (
    <>
      <div className="impresa-checklist">
        <div className="impresa-section-head">
          <span className="impresa-section-title">
            Check-list POS — Allegato XV D.Lgs. 81/2008
          </span>
          <span className="impresa-section-meta">
            {done}/{CHECKLIST_ITEMS.length} conformi
          </span>
        </div>

        {["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"].map(l => {
          const items = CHECKLIST_ITEMS.filter(i => i.lettera === l);
          if (!items.length) return null;
          return (
            <div key={l} className="impresa-checklist-group">
              <div className="impresa-checklist-letter">Lettera {l}</div>
              {items.map(item => (
                <div key={item.id} className="impresa-checklist-row">
                  <div className="impresa-checklist-opts">
                    {["si", "no", "n.a."].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const nuoviChecks = { ...(imp.checks || {}), [item.id]: v };
                          updateImpresa(activeCantiere, activeImpresa, { checks: nuoviChecks });
                          syncChecklist(nuoviChecks, imp.note ?? "");
                        }}
                        className={`impresa-checklist-opt ${
                          imp.checks[item.id] === v
                            ? `impresa-checklist-opt-${v.replace(".", "")}`
                            : ""
                        }`}
                      >
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <span className="impresa-checklist-label">
                    {item.label}
                    {item.required && (
                      <span className="impresa-checklist-req">*</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        <div className="impresa-checklist-notes">
          <label className="impresa-checklist-notes-label">Note CSE</label>
          <textarea
            value={imp.note}
            onChange={e => {
              const nuovaNota = e.target.value;
              updateImpresa(activeCantiere, activeImpresa, { note: nuovaNota });
              syncChecklist(imp.checks || {}, nuovaNota);
            }}
            rows={3}
            className="impresa-checklist-textarea"
            placeholder="Carenze, integrazioni richieste…"
          />
        </div>
      </div>

      <style jsx global>{`
        .impresa-checklist-group:last-of-type .impresa-checklist-row:last-child {
          border-bottom: none;
        }

        .impresa-checklist-group {
          border-bottom: 1px solid #f1f5f9;
        }

        .impresa-checklist-letter {
          padding: 12px 22px;
          background: #f8fafc;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }

        .impresa-checklist-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 22px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s ease;
        }

        .impresa-checklist-row:hover {
          background: #fafbfc;
        }

        .impresa-checklist-opts {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .impresa-checklist-opt {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #94a3b8;
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .impresa-checklist-opt:hover {
          border-color: #cbd5e1;
          color: #64748b;
        }

        .impresa-checklist-opt-si {
          background: #10b981;
          border-color: #10b981;
          color: #ffffff;
        }

        .impresa-checklist-opt-no {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
        }

        .impresa-checklist-opt-na {
          background: #94a3b8;
          border-color: #94a3b8;
          color: #ffffff;
        }

        .impresa-checklist-label {
          font-size: 13px;
          line-height: 1.55;
          color: #334155;
        }

        .impresa-checklist-req {
          margin-left: 4px;
          color: #cbd5e1;
          font-size: 11px;
        }

        .impresa-checklist-notes {
          padding: 18px 22px 22px;
          border-top: 1px solid #f1f5f9;
        }

        .impresa-checklist-notes-label {
          display: block;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
        }

        .impresa-checklist-textarea {
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
        }

        .impresa-checklist-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </>
  );
}
