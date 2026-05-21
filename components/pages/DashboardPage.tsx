// @ts-nocheck

"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { STATUS_COLORS } from "@/lib/constants";
import { calcStatus } from "@/lib/utils";
import { updateCantiere, deleteCantiere } from "@/lib/db";

const RUOLI_CANTIERE = ["CSE", "Impresa", "RSPP"];

function RuoloField({ value, onChange, extraValue }) {
  const opts =
    extraValue && !RUOLI_CANTIERE.includes(extraValue)
      ? [extraValue, ...RUOLI_CANTIERE]
      : RUOLI_CANTIERE;
  return (
    <div className="dash-field">
      <label className="dash-label">Ruolo</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="dash-input dash-select"
      >
        <option value="">Seleziona ruolo</option>
        {opts.map(r => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

function DashField({ label, value, onChange }) {
  return (
    <div className="dash-field">
      <label className="dash-label">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="dash-input"
      />
    </div>
  );
}

function openNewCantiereForm(setNewCantiere, setShowNewCantiere) {
  setNewCantiere({ nome: "", indirizzo: "", cse: "CSE", dataInizio: "" });
  setShowNewCantiere(true);
}

function countDocumenti(cantieri) {
  return cantieri.reduce(
    (sum, c) =>
      sum +
      (c.imprese || []).reduce(
        (s, imp) => s + (imp.uploadedFiles?.length || 0),
        0
      ),
    0
  );
}

export function DashboardPage({
  cantieri,
  setCantieri,
  user,
  setNewCantiere,
  setShowNewCantiere,
  setActiveCantiere,
  setPage,
  authUser,
  onLogout,
}) {
  const [editCantiere, setEditCantiere] = useState(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    indirizzo: "",
    cse: "",
    dataInizio: "",
  });

  const impreseTotali = cantieri.reduce((s, c) => s + (c.imprese?.length || 0), 0);
  const documentiTotali = countDocumenti(cantieri);

  const openEdit = (c, e) => {
    e.stopPropagation();
    setEditCantiere(c);
    setEditForm({
      nome: c.nome,
      indirizzo: c.indirizzo,
      cse: c.cse,
      dataInizio: c.dataInizio,
    });
  };

  const handleDelete = async (c, e) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminare il cantiere "${c.nome}"?`)) return;
    try {
      await deleteCantiere(c.id);
      setCantieri(p => p.filter(x => x.id !== c.id));
    } catch (err) {
      console.error("Errore eliminazione cantiere:", err?.message || err);
      setCantieri(p => p.filter(x => x.id !== c.id));
    }
  };

  const handleSaveEdit = async () => {
    if (!editCantiere) return;
    try {
      const updated = await updateCantiere(editCantiere.id, editForm);
      setCantieri(p => p.map(c => (c.id === updated.id ? updated : c)));
      setEditCantiere(null);
    } catch (err) {
      console.error("Errore aggiornamento cantiere:", err?.message || err);
      setCantieri(p =>
        p.map(c => (c.id === editCantiere.id ? { ...c, ...editForm } : c))
      );
      setEditCantiere(null);
    }
  };

  const openCantiere = id => {
    setActiveCantiere(id);
    setPage("cantiere");
  };

  return (
    <>
      <div className="dash-page">
        <AppHeader
          user={user}
          authUser={authUser}
          onLogout={onLogout}
          breadcrumb={
            <span className="app-header-crumb">
              <span className="app-header-crumb-current">Dashboard</span>
            </span>
          }
        />

        <div className="dash-shell">
          <section className="dash-hero">
            <div className="dash-hero-main">
              <span className="dash-badge">
                Controllo documentale Sicurezza sul Lavoro
              </span>
              <h1 className="dash-hero-title">Dashboard cantieri</h1>
              <p className="dash-hero-text">
                Gestisci cantieri, imprese, documenti e scadenze operative.
              </p>
            </div>
            <button
              type="button"
              className="dash-btn-primary dash-btn-new"
              onClick={() => openNewCantiereForm(setNewCantiere, setShowNewCantiere)}
            >
              + Nuovo cantiere
            </button>
          </section>

          <section className="dash-metrics">
            <div className="dash-metric">
              <span className="dash-metric-value">{cantieri.length}</span>
              <span className="dash-metric-label">Cantieri attivi</span>
            </div>
            <div className="dash-metric">
              <span className="dash-metric-value">{impreseTotali}</span>
              <span className="dash-metric-label">Imprese totali</span>
            </div>
            <div className="dash-metric">
              <span className="dash-metric-value">{documentiTotali}</span>
              <span className="dash-metric-label">Documenti caricati</span>
            </div>
          </section>

          {cantieri.length === 0 ? (
            <section className="dash-empty">
              <div className="dash-empty-mark">+</div>
              <h2 className="dash-empty-title">Nessun cantiere presente</h2>
              <p className="dash-empty-text">
                Crea il primo cantiere per iniziare a gestire imprese, documenti e
                scadenze.
              </p>
              <button
                type="button"
                className="dash-btn-primary"
                onClick={() => openNewCantiereForm(setNewCantiere, setShowNewCantiere)}
              >
                + Nuovo cantiere
              </button>
            </section>
          ) : (
            <section className="dash-grid">
              {cantieri.map(c => {
                const tot = c.imprese.length;
                const idon = c.imprese.filter(
                  i => calcStatus(i.checks) === "idoneo"
                ).length;
                const pct = tot ? Math.round((idon / tot) * 100) : 0;

                return (
                  <article key={c.id} className="dash-card">
                    <h2 className="dash-card-title">{c.nome}</h2>
                    <p className="dash-card-address">{c.indirizzo || "—"}</p>

                    <div className="dash-chips">
                      <span className="dash-chip">Ruolo: {c.cse || "—"}</span>
                      <span className="dash-chip">Inizio: {c.dataInizio || "—"}</span>
                      <span className="dash-chip dash-chip-blue">
                        {tot} impres{tot === 1 ? "a" : "e"}
                      </span>
                    </div>

                    {tot > 0 && (
                      <div className="dash-progress-wrap">
                        <div className="dash-progress-head">
                          <span>Imprese idonee</span>
                          <strong>
                            {idon}/{tot} ({pct}%)
                          </strong>
                        </div>
                        <div className="dash-progress-track">
                          <div
                            className="dash-progress-bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="dash-status-dots">
                          {c.imprese.map(i => (
                            <span
                              key={i.id}
                              title={i.nome}
                              className={`dash-dot ${STATUS_COLORS[calcStatus(i.checks)]}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className="dash-actions"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="dash-btn-open"
                        onClick={() => openCantiere(c.id)}
                      >
                        Apri
                      </button>
                      <button
                        type="button"
                        className="dash-btn-neutral"
                        onClick={e => openEdit(c, e)}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="dash-btn-danger"
                        onClick={e => handleDelete(c, e)}
                      >
                        Elimina
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <footer className="dash-footer">
            <Link href="/privacy">Privacy e note legali</Link>
          </footer>
        </div>
      </div>

      {editCantiere && (
        <div className="dash-modal-overlay" onClick={() => setEditCantiere(null)}>
          <div
            className="dash-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="dash-modal-title"
          >
            <div className="dash-modal-head">
              <h2 id="dash-modal-title" className="dash-modal-title">
                Modifica cantiere
              </h2>
              <button
                type="button"
                className="dash-modal-close"
                onClick={() => setEditCantiere(null)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="dash-modal-body">
              <DashField
                label="Nome cantiere"
                value={editForm.nome}
                onChange={v => setEditForm(p => ({ ...p, nome: v }))}
              />
              <DashField
                label="Indirizzo"
                value={editForm.indirizzo}
                onChange={v => setEditForm(p => ({ ...p, indirizzo: v }))}
              />
              <RuoloField
                value={editForm.cse}
                extraValue={editCantiere.cse}
                onChange={v => setEditForm(p => ({ ...p, cse: v }))}
              />
              <DashField
                label="Data inizio"
                value={editForm.dataInizio}
                onChange={v => setEditForm(p => ({ ...p, dataInizio: v }))}
              />
              <button
                type="button"
                className="dash-btn-primary dash-btn-full"
                onClick={handleSaveEdit}
              >
                Salva modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dash-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .dash-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 32px 40px;
        }

        .dash-hero {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 30px;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
          margin-bottom: 20px;
        }

        .dash-hero-main {
          max-width: 640px;
        }

        .dash-badge {
          display: inline-flex;
          align-items: center;
          margin-bottom: 12px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .dash-hero-title {
          margin: 0;
          font-size: clamp(26px, 3vw, 34px);
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #020617;
          line-height: 1.05;
        }

        .dash-hero-text {
          margin: 10px 0 0;
          font-size: 15px;
          line-height: 1.65;
          color: #475569;
        }

        .dash-btn-primary {
          border: 0;
          border-radius: 16px;
          background: #2563eb;
          color: #ffffff;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
          transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }

        .dash-btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);
        }

        .dash-btn-new {
          flex-shrink: 0;
        }

        .dash-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        .dash-metric {
          padding: 18px 20px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
        }

        .dash-metric-value {
          display: block;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #0f172a;
          line-height: 1;
        }

        .dash-metric-label {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dash-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .dash-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }

        .dash-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
        }

        .dash-card-title {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #020617;
          line-height: 1.2;
        }

        .dash-card-address {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #64748b;
        }

        .dash-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .dash-chip {
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

        .dash-chip-blue {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .dash-progress-wrap {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
        }

        .dash-progress-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .dash-progress-head strong {
          color: #0f172a;
          font-weight: 800;
        }

        .dash-progress-track {
          margin-top: 8px;
          height: 6px;
          border-radius: 999px;
          background: #f1f5f9;
          overflow: hidden;
        }

        .dash-progress-bar {
          height: 100%;
          border-radius: 999px;
          background: #2563eb;
          transition: width 0.25s ease;
        }

        .dash-status-dots {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 10px;
        }

        .dash-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .dash-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
          padding-top: 18px;
        }

        .dash-btn-open,
        .dash-btn-neutral,
        .dash-btn-danger {
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }

        .dash-btn-open {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
        }

        .dash-btn-open:hover {
          background: #1d4ed8;
        }

        .dash-btn-neutral {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
        }

        .dash-btn-neutral:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .dash-btn-danger {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
        }

        .dash-btn-danger:hover {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .dash-empty {
          max-width: 520px;
          margin: 40px auto 0;
          padding: 48px 36px;
          text-align: center;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }

        .dash-empty-mark {
          width: 56px;
          height: 56px;
          margin: 0 auto 18px;
          border-radius: 18px;
          background: #0f172a;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 300;
          line-height: 1;
        }

        .dash-empty-title {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #020617;
        }

        .dash-empty-text {
          margin: 10px 0 24px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748b;
        }

        .dash-footer {
          margin-top: 36px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }

        .dash-footer :global(a) {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-decoration: none;
          transition: color 0.18s ease;
        }

        .dash-footer :global(a:hover) {
          color: #2563eb;
        }

        .dash-modal-overlay {
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

        .dash-modal {
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
        }

        .dash-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 22px 26px;
          border-bottom: 1px solid #f1f5f9;
        }

        .dash-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          color: #020617;
        }

        .dash-modal-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: #f8fafc;
          color: #64748b;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
        }

        .dash-modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .dash-modal-body {
          padding: 22px 26px 26px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dash-field {
          display: flex;
          flex-direction: column;
        }

        .dash-label {
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .dash-input,
        .dash-select {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: #ffffff;
          padding: 0 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .dash-input:focus,
        .dash-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .dash-btn-full {
          width: 100%;
          margin-top: 6px;
        }

        @media (max-width: 1024px) {
          .dash-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .dash-shell {
            padding-left: 24px;
            padding-right: 24px;
          }

          .dash-shell {
            padding-top: 22px;
          }

          .dash-hero {
            padding: 22px;
          }

          .dash-metrics {
            grid-template-columns: 1fr;
          }

          .dash-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 560px) {
          .dash-shell {
            padding-left: 20px;
            padding-right: 20px;
          }

          .dash-hero {
            flex-direction: column;
            align-items: stretch;
          }

          .dash-btn-new {
            width: 100%;
          }

          .dash-actions {
            flex-direction: column;
          }

          .dash-btn-open,
          .dash-btn-neutral,
          .dash-btn-danger {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
