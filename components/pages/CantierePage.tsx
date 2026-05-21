// @ts-nocheck

"use client";

import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CHECKLIST_ITEMS, STATUS_COLORS, BADGE } from "@/lib/constants";
import { calcStatus } from "@/lib/utils";
import { createImpresa, updateImpresaDb, deleteImpresaDb } from "@/lib/db";
import { mkImpresa } from "@/lib/utils";

const EMPTY_IMPRESA_FORM = { nome: "", attivita: "" };

function CantiereField({ label, value, onChange }) {
  return (
    <div className="cantiere-field">
      <label className="cantiere-label">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="cantiere-input"
      />
    </div>
  );
}

function ImpresaFormModal({ mode, form, setForm, onClose, onSubmit }) {
  const title = mode === "create" ? "Aggiungi impresa" : "Modifica impresa";
  const primaryLabel = mode === "create" ? "Aggiungi impresa" : "Salva modifiche";

  return (
    <div className="cantiere-modal-overlay" onClick={onClose}>
      <div
        className="cantiere-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cantiere-impresa-modal-title"
        aria-modal="true"
      >
        <div className="cantiere-modal-head">
          <div className="cantiere-modal-head-text">
            <h2 id="cantiere-impresa-modal-title" className="cantiere-modal-title">
              {title}
            </h2>
            <p className="cantiere-modal-sub">
              Inserisci i dati principali dell&apos;impresa presente in cantiere.
            </p>
          </div>
          <button
            type="button"
            className="cantiere-modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className="cantiere-modal-body">
          <p className="cantiere-modal-section-title">Dati impresa</p>
          <div className="cantiere-modal-fields">
            <CantiereField
              label="Ragione sociale"
              value={form.nome}
              onChange={v => setForm(p => ({ ...p, nome: v }))}
            />
            <CantiereField
              label="Attività svolta"
              value={form.attivita}
              onChange={v => setForm(p => ({ ...p, attivita: v }))}
            />
          </div>
        </div>

        <div className="cantiere-modal-foot">
          <button type="button" className="cantiere-modal-btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="cantiere-modal-btn-primary" onClick={onSubmit}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CantierePage({
  c,
  setCantieri,
  user,
  authUser,
  onLogout,
  setPage,
  newImpresa,
  setNewImpresa,
  showNewImpresa,
  setShowNewImpresa,
  setActiveImpresa,
  setActiveTab,
}) {
  const [deleteImpresaTarget, setDeleteImpresaTarget] = useState(null);
  const [editImpresa, setEditImpresa] = useState(null);
  const [editForm, setEditForm] = useState({ nome: "", attivita: "" });

  const totImprese = c.imprese.length;

  const openEdit = (imp, e) => {
    e.stopPropagation();
    setEditImpresa(imp);
    setEditForm({ nome: imp.nome, attivita: imp.attivita });
  };

  const requestDeleteImpresa = (imp, e) => {
    e.stopPropagation();
    setDeleteImpresaTarget(imp);
  };

  const confirmDeleteImpresa = async () => {
    if (!deleteImpresaTarget) return;
    const imp = deleteImpresaTarget;
    try {
      await deleteImpresaDb(imp.id);
      setCantieri(p =>
        p.map(cant =>
          cant.id !== c.id
            ? cant
            : { ...cant, imprese: cant.imprese.filter(i => i.id !== imp.id) }
        )
      );
    } catch (err) {
      console.error("Errore eliminazione impresa:", err?.message || err);
      setCantieri(p =>
        p.map(cant =>
          cant.id !== c.id
            ? cant
            : { ...cant, imprese: cant.imprese.filter(i => i.id !== imp.id) }
        )
      );
    }
    setDeleteImpresaTarget(null);
  };

  const handleSaveEdit = async () => {
    if (!editImpresa) return;
    try {
      const updated = await updateImpresaDb(
        editImpresa.id,
        { ...editForm, note: editImpresa.note ?? "" },
        editImpresa
      );
      setCantieri(p =>
        p.map(cant =>
          cant.id !== c.id
            ? cant
            : { ...cant, imprese: cant.imprese.map(i => (i.id === updated.id ? updated : i)) }
        )
      );
      setEditImpresa(null);
    } catch (err) {
      console.error("Errore aggiornamento impresa:", err?.message || err);
      setCantieri(p =>
        p.map(cant =>
          cant.id !== c.id
            ? cant
            : {
                ...cant,
                imprese: cant.imprese.map(i =>
                  i.id === editImpresa.id ? { ...i, ...editForm } : i
                ),
              }
        )
      );
      setEditImpresa(null);
    }
  };

  const openImpresa = imp => {
    setActiveImpresa(imp.id);
    setActiveTab("upload");
    setPage("impresa");
  };

  const handleOpenNewImpresa = () => {
    setEditImpresa(null);
    setNewImpresa(EMPTY_IMPRESA_FORM);
    if (typeof setShowNewImpresa === "function") {
      setShowNewImpresa(true);
    }
  };

  const handleCloseNewImpresa = () => {
    if (typeof setShowNewImpresa === "function") {
      setShowNewImpresa(false);
    }
  };

  const handleCreateImpresa = async () => {
    try {
      const created = await createImpresa(c.id, newImpresa);
      setCantieri(prev =>
        prev.map(cant =>
          cant.id !== c.id ? cant : { ...cant, imprese: [...cant.imprese, created] }
        )
      );
      setNewImpresa(EMPTY_IMPRESA_FORM);
      handleCloseNewImpresa();
    } catch (err) {
      console.error("Errore creazione impresa:", err?.message || err);
      setCantieri(prev =>
        prev.map(cant =>
          cant.id !== c.id
            ? cant
            : { ...cant, imprese: [...cant.imprese, { ...mkImpresa(), ...newImpresa }] }
        )
      );
      setNewImpresa(EMPTY_IMPRESA_FORM);
      handleCloseNewImpresa();
    }
  };

  const isNewImpresaOpen = showNewImpresa === true;

  const statusKeys = ["idoneo", "parziale", "non idoneo", "da verificare"];

  return (
    <>
      <div className="cantiere-page">
        <AppHeader
          user={user}
          authUser={authUser}
          onLogout={onLogout}
          breadcrumb={
            <span className="app-header-crumb">
              <button
                type="button"
                className="app-header-crumb-link"
                onClick={() => setPage("dashboard")}
              >
                Dashboard
              </button>
              <span className="app-header-crumb-sep">/</span>
              <span className="app-header-crumb-current">{c.nome}</span>
            </span>
          }
        />

        <div className="cantiere-shell">
          <button
            type="button"
            className="cantiere-back"
            onClick={() => setPage("dashboard")}
          >
            ← Torna alla dashboard
          </button>

          <section className="cantiere-hero">
            <div className="cantiere-hero-main">
              <h1 className="cantiere-hero-title">{c.nome}</h1>
              <p className="cantiere-hero-address">{c.indirizzo || "—"}</p>
              <div className="cantiere-chips">
                <span className="cantiere-chip">Ruolo: {c.cse || "—"}</span>
                <span className="cantiere-chip">Inizio: {c.dataInizio || "—"}</span>
                <span className="cantiere-chip cantiere-chip-blue">
                  {totImprese} impres{totImprese === 1 ? "a" : "e"}
                </span>
              </div>
              <p className="cantiere-hero-text">
                Gestione imprese, documenti e scadenze del cantiere.
              </p>
            </div>
            <button
              type="button"
              className="cantiere-btn-primary cantiere-btn-new"
              onClick={handleOpenNewImpresa}
            >
              + Nuova impresa
            </button>
          </section>

          <section className="cantiere-stats">
            {statusKeys.map(s => {
              const count = c.imprese.filter(i => calcStatus(i.checks) === s).length;
              return (
                <div key={s} className={`cantiere-stat cantiere-stat-${s.replace(/\s/g, "-")}`}>
                  <span className="cantiere-stat-value">{count}</span>
                  <span className="cantiere-stat-label">{s}</span>
                </div>
              );
            })}
          </section>

          {totImprese === 0 ? (
            <section className="cantiere-empty">
              <div className="cantiere-empty-mark">+</div>
              <h2 className="cantiere-empty-title">Nessuna impresa presente</h2>
              <p className="cantiere-empty-text">
                Aggiungi la prima impresa per iniziare la verifica documentale.
              </p>
              <button
                type="button"
                className="cantiere-btn-primary"
                onClick={handleOpenNewImpresa}
              >
                + Nuova impresa
              </button>
            </section>
          ) : (
            <section className="cantiere-grid">
              {c.imprese.map(imp => {
                const st = calcStatus(imp.checks);
                const done = CHECKLIST_ITEMS.filter(
                  i => i.required && imp.checks[i.id] === "si"
                ).length;
                const tot = CHECKLIST_ITEMS.filter(i => i.required).length;
                const docs = imp.uploadedFiles?.length || 0;

                return (
                  <article key={imp.id} className="cantiere-card">
                    <div className="cantiere-card-head">
                      <span className={`cantiere-status-dot ${STATUS_COLORS[st]}`} />
                      <span className={`cantiere-status-badge ${BADGE[st]}`}>{st}</span>
                    </div>

                    <h2 className="cantiere-card-title">{imp.nome}</h2>
                    <p className="cantiere-card-activity">{imp.attivita || "—"}</p>

                    {imp.note ? (
                      <p className="cantiere-card-note">{imp.note}</p>
                    ) : null}

                    <div className="cantiere-card-meta">
                      {docs > 0 && (
                        <span className="cantiere-meta-item">📎 {docs} documenti</span>
                      )}
                      <span className="cantiere-meta-item">
                        Check-list {done}/{tot}
                      </span>
                    </div>

                    <div
                      className="cantiere-actions"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="cantiere-btn-open"
                        onClick={() => openImpresa(imp)}
                      >
                        Apri
                      </button>
                      <button
                        type="button"
                        className="cantiere-btn-neutral"
                        onClick={e => openEdit(imp, e)}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        className="cantiere-btn-danger"
                        onClick={e => requestDeleteImpresa(imp, e)}
                      >
                        Elimina
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteImpresaTarget}
        title="Eliminare l'impresa?"
        message="L'eliminazione rimuoverà l'impresa, checklist, allegati, maestranze e documenti collegati. L'operazione non può essere annullata."
        confirmLabel="Elimina impresa"
        cancelLabel="Annulla"
        variant="danger"
        onConfirm={confirmDeleteImpresa}
        onCancel={() => setDeleteImpresaTarget(null)}
      />

      {isNewImpresaOpen ? (
        <ImpresaFormModal
          mode="create"
          form={newImpresa || EMPTY_IMPRESA_FORM}
          setForm={setNewImpresa}
          onClose={handleCloseNewImpresa}
          onSubmit={handleCreateImpresa}
        />
      ) : null}

      {editImpresa ? (
        <ImpresaFormModal
          mode="edit"
          form={editForm}
          setForm={setEditForm}
          onClose={() => setEditImpresa(null)}
          onSubmit={handleSaveEdit}
        />
      ) : null}

      <style jsx>{`
        .cantiere-page {
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .cantiere-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px 32px 40px;
        }

        .cantiere-back {
          display: inline-flex;
          align-items: center;
          margin-bottom: 20px;
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

        .cantiere-back:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .cantiere-hero {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 30px;
          margin-bottom: 18px;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
        }

        .cantiere-hero-main {
          max-width: 680px;
        }

        .cantiere-hero-title {
          margin: 0;
          font-size: clamp(24px, 3vw, 32px);
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #020617;
          line-height: 1.08;
        }

        .cantiere-hero-address {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.55;
          color: #64748b;
        }

        .cantiere-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .cantiere-chip {
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

        .cantiere-chip-blue {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .cantiere-hero-text {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
        }

        .cantiere-btn-primary {
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

        .cantiere-btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);
        }

        .cantiere-btn-new {
          flex-shrink: 0;
        }

        .cantiere-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .cantiere-stat {
          padding: 16px 14px;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          text-align: center;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
        }

        .cantiere-stat-value {
          display: block;
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .cantiere-stat-label {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: capitalize;
        }

        .cantiere-stat-idoneo .cantiere-stat-value {
          color: #059669;
        }

        .cantiere-stat-parziale .cantiere-stat-value {
          color: #d97706;
        }

        .cantiere-stat-non-idoneo .cantiere-stat-value {
          color: #dc2626;
        }

        .cantiere-stat-da-verificare .cantiere-stat-value {
          color: #94a3b8;
        }

        .cantiere-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .cantiere-card {
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

        .cantiere-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
        }

        .cantiere-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .cantiere-status-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .cantiere-status-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 999px;
          text-transform: capitalize;
        }

        .cantiere-card-title {
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #020617;
          line-height: 1.25;
        }

        .cantiere-card-activity {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #64748b;
        }

        .cantiere-card-note {
          margin: 10px 0 0;
          font-size: 12px;
          line-height: 1.5;
          color: #94a3b8;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cantiere-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .cantiere-meta-item {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          padding: 5px 8px;
          border-radius: 8px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
        }

        .cantiere-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
          padding-top: 18px;
        }

        .cantiere-btn-open,
        .cantiere-btn-neutral,
        .cantiere-btn-danger {
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }

        .cantiere-btn-open {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
        }

        .cantiere-btn-open:hover {
          background: #1d4ed8;
        }

        .cantiere-btn-neutral {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
        }

        .cantiere-btn-neutral:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .cantiere-btn-danger {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
        }

        .cantiere-btn-danger:hover {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .cantiere-empty {
          max-width: 520px;
          margin: 32px auto 0;
          padding: 48px 36px;
          text-align: center;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }

        .cantiere-empty-mark {
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

        .cantiere-empty-title {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          color: #020617;
        }

        .cantiere-empty-text {
          margin: 10px 0 24px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748b;
        }

        :global(.cantiere-modal-overlay) {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(6px);
        }

        :global(.cantiere-modal) {
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow:
            0 25px 50px -12px rgba(15, 23, 42, 0.25),
            0 12px 24px rgba(15, 23, 42, 0.08);
        }

        :global(.cantiere-modal-head) {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 24px 20px;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
        }

        :global(.cantiere-modal-head-text) {
          min-width: 0;
        }

        :global(.cantiere-modal-title) {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        :global(.cantiere-modal-sub) {
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.45;
          color: #64748b;
        }

        :global(.cantiere-modal-close) {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          color: #64748b;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        :global(.cantiere-modal-close:hover) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        :global(.cantiere-modal-body) {
          padding: 20px 24px 24px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        :global(.cantiere-modal-section-title) {
          margin: 0 0 14px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.02em;
        }

        :global(.cantiere-modal-fields) {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        :global(.cantiere-modal-foot) {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px 20px;
          border-top: 1px solid #e2e8f0;
          background: #fafbfc;
          flex-shrink: 0;
        }

        :global(.cantiere-modal-btn-primary),
        :global(.cantiere-modal-btn-secondary) {
          height: 46px;
          padding: 0 18px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(.cantiere-modal-btn-primary) {
          border: 1px solid #1d4ed8;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
        }

        :global(.cantiere-modal-btn-primary:hover) {
          background: #1d4ed8;
          border-color: #1e40af;
        }

        :global(.cantiere-modal-btn-secondary) {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
        }

        :global(.cantiere-modal-btn-secondary:hover) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        :global(.cantiere-field) {
          display: flex;
          flex-direction: column;
        }

        :global(.cantiere-label) {
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        :global(.cantiere-input) {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #ffffff;
          padding: 0 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        :global(.cantiere-input:focus) {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .cantiere-btn-full {
          width: 100%;
          margin-top: 6px;
        }

        @media (max-width: 1024px) {
          .cantiere-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .cantiere-shell {
            padding-left: 24px;
            padding-right: 24px;
          }

          .cantiere-hero {
            padding: 22px;
          }

          .cantiere-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cantiere-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .cantiere-shell {
            padding-left: 20px;
            padding-right: 20px;
          }

          .cantiere-hero {
            flex-direction: column;
            align-items: stretch;
          }

          .cantiere-btn-new {
            width: 100%;
          }

          .cantiere-actions {
            flex-direction: column;
          }

          .cantiere-btn-open,
          .cantiere-btn-neutral,
          .cantiere-btn-danger {
            width: 100%;
          }

          :global(.cantiere-modal-foot) {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          :global(.cantiere-modal-btn-primary),
          :global(.cantiere-modal-btn-secondary) {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
