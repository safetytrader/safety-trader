// @ts-nocheck
"use client";

import { ALLEGATI_CONFIG } from "@/lib/constants";
import { upsertAllegatiImpresa } from "@/lib/db";
import { isExpired, isExpiringSoon } from "@/lib/utils";

function scadenzaPillClass(value) {
  if (!value || value === "—") return "allegati-pill allegati-pill-empty";
  if (isExpired(value)) return "allegati-pill allegati-pill-expired";
  if (isExpiringSoon(value)) return "allegati-pill allegati-pill-soon";
  return "allegati-pill allegati-pill-valid";
}

function ScadenzaPill({ value }) {
  if (!value || String(value).trim() === "") {
    return <span className="allegati-pill allegati-pill-empty">—</span>;
  }
  const text = String(value);
  return <span className={scadenzaPillClass(text)}>{text}</span>;
}

export function AllegatiTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncAllegati = async (allegati, allegatiScadenze) => {
    try {
      await upsertAllegatiImpresa(activeImpresa, allegati, allegatiScadenze);
    } catch (err) {
      console.error("Errore salvataggio allegati Supabase:", err?.message || err);
    }
  };

  const presenti = ALLEGATI_CONFIG.filter(cfg => !!imp.allegati[cfg.key]).length;
  const countLabel =
    presenti === 1 ? "1 allegato" : `${presenti} allegati`;

  return (
    <>
      <div className="allegati-root">
        <div className="allegati-stack">
          <header className="allegati-header allegati-panel-card">
            <div className="allegati-header-left">
              <span className="allegati-eyebadge">Gestione allegati</span>
              <h2 className="allegati-title">Allegati dell&apos;impresa</h2>
              <p className="allegati-subtitle">
                Monitora documenti aziendali, scadenze e integrazioni richieste per
                l&apos;impresa.
              </p>
            </div>
            <div className="allegati-header-right">
              <span className="allegati-count-badge">{countLabel}</span>
              <p className="allegati-header-meta">
                {presenti}/{ALLEGATI_CONFIG.length} tipologie contrassegnate come presenti
              </p>
            </div>
          </header>

          {presenti === 0 ? (
            <section className="allegati-empty-card allegati-panel-card">
              <div className="allegati-empty-icon">📎</div>
              <h3 className="allegati-empty-title">Nessun allegato presente</h3>
              <p className="allegati-empty-text">
                Aggiungi gli allegati richiesti per monitorare documenti, scadenze e
                completezza documentale.
              </p>
              <p className="allegati-empty-hint">
                Segna come presenti i documenti dalla lista sottostante.
              </p>
            </section>
          ) : null}

          <div className="allegati-stack-body">
            {presenti > 0 ? (
              <div className="allegati-legend-bar" aria-label="Legenda scadenze">
                <span className="allegati-legend-item">
                  <span className="allegati-pill allegati-pill-valid allegati-legend-sample">
                    OK
                  </span>
                  Valido
                </span>
                <span className="allegati-legend-item">
                  <span className="allegati-pill allegati-pill-soon allegati-legend-sample">
                    60g
                  </span>
                  In scadenza
                </span>
                <span className="allegati-legend-item">
                  <span className="allegati-pill allegati-pill-expired allegati-legend-sample">
                    !
                  </span>
                  Scaduto
                </span>
                <span className="allegati-legend-item">
                  <span className="allegati-pill allegati-pill-empty allegati-legend-sample">
                    —
                  </span>
                  Dato assente
                </span>
              </div>
            ) : null}

            <div className="allegati-list-card allegati-panel-card">
              <div className="allegati-table-scroll">
                <table className="allegati-table">
                  <thead>
                    <tr>
                      <th className="allegati-th allegati-th-check" scope="col">
                        Pres.
                      </th>
                      <th className="allegati-th" scope="col">
                        Documento
                      </th>
                      <th className="allegati-th allegati-th-center" scope="col">
                        Stato
                      </th>
                      <th className="allegati-th allegati-th-center" scope="col">
                        Scadenza
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALLEGATI_CONFIG.map(cfg => {
                      const presente = !!imp.allegati[cfg.key];
                      const scadenza = imp.allegatiScadenze?.[cfg.key];
                      return (
                        <tr key={cfg.key} className="allegati-tr">
                          <td className="allegati-td allegati-td-check">
                            <button
                              type="button"
                              onClick={() => {
                                const nuoviAllegati = {
                                  ...(imp.allegati || {}),
                                  [cfg.key]: !presente,
                                };
                                updateImpresa(activeCantiere, activeImpresa, {
                                  allegati: nuoviAllegati,
                                });
                                syncAllegati(nuoviAllegati, imp.allegatiScadenze || {});
                              }}
                              className={`allegati-check ${
                                presente ? "allegati-check-on" : ""
                              }`}
                              aria-pressed={presente}
                              aria-label={
                                presente
                                  ? `Segna ${cfg.key} come mancante`
                                  : `Segna ${cfg.key} come presente`
                              }
                            >
                              {presente ? "✓" : ""}
                            </button>
                          </td>
                          <td className="allegati-td">
                            <span className="allegati-doc-name">{cfg.key}</span>
                            {cfg.scadenzaNote ? (
                              <span className="allegati-doc-note">{cfg.scadenzaNote}</span>
                            ) : null}
                          </td>
                          <td className="allegati-td allegati-td-center">
                            <span
                              className={`allegati-status ${
                                presente
                                  ? "allegati-status-ok"
                                  : "allegati-status-miss"
                              }`}
                            >
                              {presente ? "Presente" : "Mancante"}
                            </span>
                          </td>
                          <td className="allegati-td allegati-td-center">
                            <ScadenzaPill value={scadenza} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .allegati-root {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .allegati-stack {
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

        .allegati-stack-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          min-width: 0;
        }

        .allegati-panel-card {
          width: 100%;
          max-width: 100%;
          margin-left: 0;
          margin-right: 0;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
        }

        .allegati-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin: 0;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .allegati-header-left {
          flex: 1 1 280px;
          min-width: 0;
        }

        .allegati-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 8px;
          flex: 0 1 auto;
        }

        .allegati-eyebadge {
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

        .allegati-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.2;
          color: #020617;
        }

        .allegati-subtitle {
          margin: 0;
          max-width: 52ch;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .allegati-count-badge {
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

        .allegati-header-meta {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-align: right;
        }

        .allegati-empty-card {
          text-align: center;
          padding: 40px 32px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .allegati-empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
        }

        .allegati-empty-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #020617;
        }

        .allegati-empty-text {
          margin: 10px auto 8px;
          max-width: 440px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748b;
        }

        .allegati-empty-hint {
          margin: 0 auto;
          max-width: 400px;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
        }

        .allegati-legend-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px 18px;
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 12px 16px;
          box-sizing: border-box;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .allegati-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
        }

        .allegati-legend-sample {
          min-width: 32px;
          justify-content: center;
        }

        .allegati-list-card {
          margin: 0;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .allegati-table-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          max-width: 100%;
        }

        .allegati-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          table-layout: auto;
        }

        .allegati-th {
          padding: 14px 18px;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #475569;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .allegati-th-check {
          width: 56px;
          text-align: center;
        }

        .allegati-th-center {
          text-align: center;
        }

        .allegati-tr {
          transition: background 0.15s ease;
        }

        .allegati-tr:hover {
          background: #f8fafc;
        }

        .allegati-td {
          padding: 16px 18px;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
        }

        .allegati-tr:last-child .allegati-td {
          border-bottom: none;
        }

        .allegati-td-check {
          text-align: center;
          width: 56px;
        }

        .allegati-td-center {
          text-align: center;
        }

        .allegati-check {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border: 2px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .allegati-check:hover {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        .allegati-check-on {
          background: #10b981;
          border-color: #10b981;
        }

        .allegati-doc-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.4;
        }

        .allegati-doc-note {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          line-height: 1.45;
        }

        .allegati-status {
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

        .allegati-status-ok {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .allegati-status-miss {
          background: #f8fafc;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }

        .allegati-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .allegati-pill-valid {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .allegati-pill-soon {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .allegati-pill-expired {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .allegati-pill-empty {
          background: #f8fafc;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }

        @media (max-width: 720px) {
          .allegati-header {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .allegati-header-right {
            align-items: flex-start;
          }

          .allegati-header-meta {
            text-align: left;
          }

          .allegati-count-badge {
            align-self: flex-start;
          }
        }
      `}</style>
    </>
  );
}
