// @ts-nocheck
"use client";

import { ALLEGATI_CONFIG } from "@/lib/constants";
import { upsertAllegatiImpresa } from "@/lib/db";

export function AllegatiTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncAllegati = async (allegati, allegatiScadenze) => {
    try {
      await upsertAllegatiImpresa(activeImpresa, allegati, allegatiScadenze);
    } catch (err) {
      console.error("Errore salvataggio allegati Supabase:", err?.message || err);
    }
  };

  const presenti = ALLEGATI_CONFIG.filter(cfg => !!imp.allegati[cfg.key]).length;

  return (
    <>
      <div className="impresa-allegati">
        <div className="impresa-section-head">
          <span className="impresa-section-title">Allegati obbligatori</span>
          <span className="impresa-section-meta">
            {presenti}/{ALLEGATI_CONFIG.length} presenti
          </span>
        </div>

        <div className="impresa-allegati-list">
          {ALLEGATI_CONFIG.map(cfg => {
            const presente = !!imp.allegati[cfg.key];
            const scadenza = imp.allegatiScadenze?.[cfg.key];
            return (
              <div key={cfg.key} className="impresa-allegati-row">
                <button
                  type="button"
                  onClick={() => {
                    const nuoviAllegati = {
                      ...(imp.allegati || {}),
                      [cfg.key]: !presente,
                    };
                    updateImpresa(activeCantiere, activeImpresa, { allegati: nuoviAllegati });
                    syncAllegati(nuoviAllegati, imp.allegatiScadenze || {});
                  }}
                  className={`impresa-allegati-check ${presente ? "impresa-allegati-check-on" : ""}`}
                  aria-pressed={presente}
                >
                  {presente ? "✓" : ""}
                </button>
                <div className="impresa-allegati-info">
                  <span className="impresa-allegati-name">{cfg.key}</span>
                  {scadenza ? (
                    <span className="impresa-allegati-scad">Scadenza: {scadenza}</span>
                  ) : null}
                </div>
                <span
                  className={`impresa-allegati-badge ${
                    presente ? "impresa-allegati-badge-ok" : "impresa-allegati-badge-miss"
                  }`}
                >
                  {presente ? "Presente" : "Mancante"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx global>{`
        .impresa-allegati-list {
          padding: 8px 0;
        }

        .impresa-allegati-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 22px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s ease;
        }

        .impresa-allegati-row:hover {
          background: #fafbfc;
        }

        .impresa-allegati-row:last-child {
          border-bottom: none;
        }

        .impresa-allegati-check {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .impresa-allegati-check:hover {
          border-color: #10b981;
        }

        .impresa-allegati-check-on {
          background: #10b981;
          border-color: #10b981;
        }

        .impresa-allegati-info {
          flex: 1;
          min-width: 0;
        }

        .impresa-allegati-name {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .impresa-allegati-scad {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #64748b;
        }

        .impresa-allegati-badge {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .impresa-allegati-badge-ok {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .impresa-allegati-badge-miss {
          background: #f8fafc;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
}
