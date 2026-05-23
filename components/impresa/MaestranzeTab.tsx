// @ts-nocheck
"use client";

import { useState } from "react";
import { replaceMaestranzeImpresa } from "@/lib/db";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { calcScadenza } from "@/lib/utils";

const OPTIONAL_COLS = [
  { key: "preposto", label: "Preposto", scadType: "preposto" },
  { key: "antincendio", label: "Antinc.", scadType: "antincendio" },
  { key: "ps", label: "P.S.", scadType: "ps" },
  { key: "ponteggiatori", label: "Ponteggi", scadType: "ponteggi" },
  { key: "mdt", label: "MMT", scadType: "mdt" },
  { key: "ple", label: "PLE", scadType: "ple" },
  { key: "gruista", label: "Gru", scadType: "gruista" },
  { key: "confinati", label: "Spazi Confinati", scadType: "confinati" },
];

export const emptyMaestranza = () => ({
  nome: "",
  qualifica: "",
  dpi: false,
  idoneita: "",
  formazioneBase: false,
  formazioneSpec: "",
  unilav: "",
  preposto: "",
  antincendio: "",
  ps: "",
  ponteggiatori: "",
  mdt: "",
  ple: "",
  gruista: "",
  confinati: "",
});

const hasVal = v => v != null && String(v).trim() !== "";

export const isBoolChecked = v =>
  v === true || v === "true" || v === "✓" || v === "si" || v === "Sì";

const DEADLINE_PILL_BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 52,
  padding: "4px 8px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
  lineHeight: 1.2,
};

const DEADLINE_BADGE_STYLE = {
  empty: { background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" },
  ind: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
  expired: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  warning: { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
  valid: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
};

function startOfDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY (2000+YY) */
export function parseDeadlineDate(value) {
  if (value == null || value === "") return null;
  const t = String(value).trim();
  if (!t || t === "—" || t === "✓") return null;
  if (t.toUpperCase() === "IND") return null;

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const slash = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10);
    let year = parseInt(slash[3], 10);
    if (slash[3].length === 2) year = 2000 + year;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function getDeadlineStatus(value) {
  if (value == null || value === undefined) return "empty";
  const text = String(value).trim();
  if (!text || text === "—" || text === "✓") return "empty";
  if (text.toUpperCase() === "IND") return "ind";

  const parsed = parseDeadlineDate(value);
  if (!parsed) return "empty";

  const today = startOfDay(new Date());
  const exp = startOfDay(parsed);
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "expired";
  if (diffDays < 60) return "warning";
  return "valid";
}

function DeadlineBadge({ status, children }) {
  const tone = DEADLINE_BADGE_STYLE[status] || DEADLINE_BADGE_STYLE.empty;
  return (
    <span style={{ ...DEADLINE_PILL_BASE, ...tone }} role="status">
      {children}
    </span>
  );
}

export function renderDeadlineCell(value) {
  const status = getDeadlineStatus(value);

  if (status === "empty") {
    return <DeadlineBadge status="empty">—</DeadlineBadge>;
  }

  const label = String(value).trim();
  return <DeadlineBadge status={status}>{label}</DeadlineBadge>;
}

function renderTrainingDeadlineCell(val, scadType) {
  if (!hasVal(val)) return renderDeadlineCell("");
  if (!scadType) return renderDeadlineCell(val);
  const disp = calcScadenza(val, scadType);
  if (disp === "✓") return renderDeadlineCell("");
  return renderDeadlineCell(disp);
}

function renderBoolBadge(v) {
  if (isBoolChecked(v)) {
    return <span className="maestranze-bool maestranze-bool-yes">✓ Sì</span>;
  }
  return <span className="maestranze-bool maestranze-bool-no">No</span>;
}

function MaestranzeFormField({ label, value, onChange, hint }) {
  return (
    <div className="maestranze-field">
      <label className="maestranze-label">{label}</label>
      <input
        className="maestranze-input"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {hint ? <p className="maestranze-field-hint">{hint}</p> : null}
    </div>
  );
}

function MaestranzeCheckField({ label, checked, onChange }) {
  return (
    <label className={`maestranze-check-field${checked ? " maestranze-check-field-on" : ""}`}>
      <input
        type="checkbox"
        className="maestranze-check-input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="maestranze-check-label">{label}</span>
    </label>
  );
}

function MaestranzaFormModal({ mode, form, setForm, onClose, onSubmit }) {
  const title = mode === "create" ? "Aggiungi maestranza" : "Modifica maestranza";
  const primaryLabel = mode === "create" ? "Aggiungi maestranza" : "Salva modifiche";

  return (
    <div className="maestranze-modal-overlay" onClick={onClose}>
      <div
        className="maestranze-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="maestranze-modal-title"
        aria-modal="true"
      >
        <div className="maestranze-modal-head">
          <div className="maestranze-modal-head-text">
            <h2 id="maestranze-modal-title" className="maestranze-modal-title">
              {title}
            </h2>
            <p className="maestranze-modal-sub">
              Inserisci dati anagrafici, formazione, idoneità e abilitazioni operative.
            </p>
          </div>
          <button
            type="button"
            className="maestranze-modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className="maestranze-modal-body">
          <MaestranzaFormFields form={form} setForm={setForm} />
        </div>

        <div className="maestranze-modal-foot">
          <button type="button" className="maestranze-modal-btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="maestranze-modal-btn-primary" onClick={onSubmit}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MaestranzaFormFields({ form, setForm }) {
  return (
    <>
      <div className="maestranze-form-section">
        <h3 className="maestranze-form-section-title">Dati principali</h3>
        <div className="maestranze-form-grid">
          <MaestranzeFormField
            label="Nominativo"
            value={form.nome}
            onChange={v => setForm(p => ({ ...p, nome: v }))}
          />
          <MaestranzeFormField
            label="Qualifica"
            value={form.qualifica}
            onChange={v => setForm(p => ({ ...p, qualifica: v }))}
          />
          <MaestranzeFormField
            label="UNILAV"
            value={form.unilav}
            onChange={v => setForm(p => ({ ...p, unilav: v }))}
            hint="IND oppure data"
          />
        </div>
      </div>

      <div className="maestranze-form-section">
        <h3 className="maestranze-form-section-title">Idoneità e formazione</h3>
        <div className="maestranze-form-grid">
          <MaestranzeCheckField
            label="DPI"
            checked={isBoolChecked(form.dpi)}
            onChange={v => setForm(p => ({ ...p, dpi: v }))}
          />
          <MaestranzeFormField
            label="Idoneità"
            value={form.idoneita}
            onChange={v => setForm(p => ({ ...p, idoneita: v }))}
          />
          <MaestranzeCheckField
            label="F.Base"
            checked={isBoolChecked(form.formazioneBase)}
            onChange={v => setForm(p => ({ ...p, formazioneBase: v }))}
          />
          <MaestranzeFormField
            label="F.Spec"
            value={form.formazioneSpec}
            onChange={v => setForm(p => ({ ...p, formazioneSpec: v }))}
          />
        </div>
      </div>

      <div className="maestranze-form-section maestranze-form-section-last">
        <h3 className="maestranze-form-section-title">Abilitazioni opzionali</h3>
        <div className="maestranze-form-grid">
          <MaestranzeFormField
            label="Preposto"
            value={form.preposto}
            onChange={v => setForm(p => ({ ...p, preposto: v }))}
          />
          <MaestranzeFormField
            label="Antinc."
            value={form.antincendio}
            onChange={v => setForm(p => ({ ...p, antincendio: v }))}
          />
          <MaestranzeFormField
            label="P.S."
            value={form.ps}
            onChange={v => setForm(p => ({ ...p, ps: v }))}
          />
          <MaestranzeFormField
            label="Ponteggi"
            value={form.ponteggiatori}
            onChange={v => setForm(p => ({ ...p, ponteggiatori: v }))}
          />
          <MaestranzeFormField
            label="MMT"
            value={form.mdt}
            onChange={v => setForm(p => ({ ...p, mdt: v }))}
          />
          <MaestranzeFormField
            label="PLE"
            value={form.ple}
            onChange={v => setForm(p => ({ ...p, ple: v }))}
          />
          <MaestranzeFormField
            label="Gru"
            value={form.gruista}
            onChange={v => setForm(p => ({ ...p, gruista: v }))}
          />
          <MaestranzeFormField
            label="Spazi Confinati"
            value={form.confinati}
            onChange={v => setForm(p => ({ ...p, confinati: v }))}
          />
        </div>
      </div>
    </>
  );
}

export function MaestranzeTab({
  imp,
  activeCantiere,
  activeImpresa,
  updateImpresa,
  setShowAddMaestra,
  setActiveTab,
  dc,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyMaestranza());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyMaestranza());

  const visibleOptional = OPTIONAL_COLS.filter(col =>
    imp.maestranze.some(m => hasVal(m[col.key]))
  );

  const persistMaestranze = nuovaLista => {
    updateImpresa(activeCantiere, activeImpresa, { maestranze: nuovaLista });
    replaceMaestranzeImpresa(activeImpresa, nuovaLista).catch(err =>
      console.error("Errore salvataggio maestranze Supabase:", err?.message || err)
    );
  };

  const removeAtIndex = i => {
    const nuovaLista = imp.maestranze.filter((_, j) => j !== i);
    persistMaestranze(nuovaLista);
    if (selectedIndex === i) setSelectedIndex(null);
    else if (selectedIndex !== null && selectedIndex > i)
      setSelectedIndex(selectedIndex - 1);
  };

  const handleOpenAdd = () => {
    setShowEditModal(false);
    setAddForm(emptyMaestranza());
    setShowAddModal(true);
  };

  const handleCloseAdd = () => {
    setShowAddModal(false);
  };

  const handleAdd = () => {
    const nuovaLista = [...imp.maestranze, addForm];
    persistMaestranze(nuovaLista);
    setAddForm(emptyMaestranza());
    setShowAddModal(false);
  };

  const openEdit = () => {
    if (selectedIndex === null) return;
    setShowAddModal(false);
    setEditForm({ ...emptyMaestranza(), ...imp.maestranze[selectedIndex] });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (selectedIndex === null) return;
    const nuovaLista = imp.maestranze.map((m, j) =>
      j === selectedIndex ? { ...editForm } : m
    );
    persistMaestranze(nuovaLista);
    setShowEditModal(false);
  };

  const requestDeleteSelected = () => {
    if (selectedIndex === null) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSelected = () => {
    if (selectedIndex === null) return;
    removeAtIndex(selectedIndex);
    setDeleteConfirmOpen(false);
  };

  const mandatoryHeaders = [
    "Nominativo",
    "Qualifica",
    "DPI",
    "Idoneità",
    "F.Base",
    "F.Spec",
    "UNILAV",
  ];

  return (
    <>
      <div className="maestranze-root">
        <div className="maestranze-stack">
        <header className="maestranze-header maestranze-panel-card">
          <div className="maestranze-header-left">
            <span className="maestranze-eyebadge">Gestione maestranze</span>
            <h2 className="maestranze-title">Maestranze dell&apos;impresa</h2>
            <p className="maestranze-subtitle">
              Monitora idoneità sanitaria, DPI, formazione, UNILAV e abilitazioni
              operative delle maestranze.
            </p>
          </div>
          <div className="maestranze-header-right">
            <span className="maestranze-count-badge">
              {imp.maestranze.length === 1
                ? "1 maestranza"
                : `${imp.maestranze.length} maestranze`}
            </span>
            <div className="maestranze-toolbar">
              <button
                type="button"
                className="maestranze-btn maestranze-btn-primary"
                onClick={handleOpenAdd}
              >
                + Aggiungi maestranza
              </button>
              <button
                type="button"
                disabled={selectedIndex === null}
                onClick={openEdit}
                className="maestranze-btn maestranze-btn-neutral"
              >
                Modifica
              </button>
              <button
                type="button"
                disabled={selectedIndex === null}
                onClick={requestDeleteSelected}
                className="maestranze-btn maestranze-btn-danger"
              >
                Elimina
              </button>
            </div>
          </div>
        </header>

        {imp.maestranze.length === 0 ? (
          <section className="maestranze-empty-card">
            <div className="maestranze-empty-icon">👷</div>
            <h3 className="maestranze-empty-title">Nessuna maestranza presente</h3>
            <p className="maestranze-empty-text">
              Aggiungi la prima maestranza per monitorare idoneità, formazione e
              scadenze.
            </p>
            <button
              type="button"
              className="maestranze-btn maestranze-btn-primary"
              onClick={handleOpenAdd}
            >
              + Aggiungi maestranza
            </button>
            <button
              type="button"
              className="maestranze-empty-link"
              onClick={() => setActiveTab("upload")}
            >
              oppure carica documenti nella tab Documenti
            </button>
          </section>
        ) : (
          <div className="maestranze-stack-body">
            <div className="maestranze-legend-bar" aria-label="Legenda scadenze">
              <span className="maestranze-legend-item">
                <DeadlineBadge status="valid">OK</DeadlineBadge>
                Valido
              </span>
              <span className="maestranze-legend-item">
                <DeadlineBadge status="warning">60g</DeadlineBadge>
                In scadenza
              </span>
              <span className="maestranze-legend-item">
                <DeadlineBadge status="expired">!</DeadlineBadge>
                Scaduto
              </span>
              <span className="maestranze-legend-item">
                <DeadlineBadge status="empty">—</DeadlineBadge>
                Dato assente
              </span>
              <span className="maestranze-legend-note">
                * F. base non scade (Acc. Stato-Regioni 21/12/2011)
              </span>
            </div>

            <div className="maestranze-table-card maestranze-panel-card">
              <div className="maestranze-table-scroll">
                <table className="maestranze-table">
                  <thead>
                    <tr>
                      <th className="maestranze-th maestranze-th-sel" scope="col" />
                      {mandatoryHeaders.map(h => (
                        <th key={h} className="maestranze-th" scope="col">
                          {h}
                        </th>
                      ))}
                      {visibleOptional.map(col => (
                        <th key={col.key} className="maestranze-th" scope="col">
                          {col.label}
                        </th>
                      ))}
                      <th className="maestranze-th maestranze-th-act" scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {imp.maestranze.map((m, i) => {
                      const selected = selectedIndex === i;
                      return (
                        <tr
                          key={i}
                          className={selected ? "maestranze-tr-selected" : ""}
                          onClick={() => setSelectedIndex(i)}
                        >
                          <td
                            className="maestranze-td maestranze-td-sel"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="radio"
                              name="sel-maestranza"
                              checked={selected}
                              onChange={() => setSelectedIndex(i)}
                              className="maestranze-radio"
                            />
                          </td>
                          <td className="maestranze-td maestranze-td-name">
                            {m.nome || "—"}
                          </td>
                          <td className="maestranze-td maestranze-td-qual">
                            {m.qualifica || "—"}
                          </td>
                          <td className="maestranze-td maestranze-td-center">
                            {renderBoolBadge(m.dpi)}
                          </td>
                          <td className="maestranze-td maestranze-td-center">
                            {renderDeadlineCell(m.idoneita)}
                          </td>
                          <td className="maestranze-td maestranze-td-center">
                            {renderBoolBadge(m.formazioneBase)}
                          </td>
                          <td className="maestranze-td maestranze-td-center">
                            {renderTrainingDeadlineCell(m.formazioneSpec, "formazioneSpec")}
                          </td>
                          <td className="maestranze-td maestranze-td-center">
                            {renderDeadlineCell(m.unilav)}
                          </td>
                          {visibleOptional.map(col => (
                            <td
                              key={col.key}
                              className="maestranze-td maestranze-td-center"
                            >
                              {renderTrainingDeadlineCell(m[col.key], col.scadType)}
                            </td>
                          ))}
                          <td
                            className="maestranze-td maestranze-td-act"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="maestranze-row-remove"
                              onClick={() => removeAtIndex(i)}
                              aria-label="Rimuovi riga"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminare la maestranza?"
        message="La maestranza selezionata verrà rimossa dall'elenco. L'operazione non può essere annullata."
        confirmLabel="Elimina maestranza"
        cancelLabel="Annulla"
        variant="danger"
        onConfirm={confirmDeleteSelected}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {showAddModal ? (
        <MaestranzaFormModal
          mode="create"
          form={addForm}
          setForm={setAddForm}
          onClose={handleCloseAdd}
          onSubmit={handleAdd}
        />
      ) : null}

      {showEditModal ? (
        <MaestranzaFormModal
          mode="edit"
          form={editForm}
          setForm={setEditForm}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleSaveEdit}
        />
      ) : null}

      <style jsx>{`
        .maestranze-root {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .maestranze-stack {
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

        .maestranze-stack-body {
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

        .maestranze-panel-card {
          width: 100%;
          max-width: 100%;
          margin-left: 0;
          margin-right: 0;
          box-sizing: border-box;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
        }

        .maestranze-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin: 0;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .maestranze-header-left {
          flex: 1 1 280px;
          min-width: 0;
        }

        .maestranze-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 14px;
          flex: 0 1 auto;
        }

        .maestranze-eyebadge {
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

        .maestranze-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.2;
          color: #020617;
        }

        .maestranze-count-badge {
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

        .maestranze-subtitle {
          margin: 0;
          max-width: 52ch;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .maestranze-header .maestranze-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
        }

        .maestranze-header .maestranze-btn {
          padding: 9px 14px;
          font-size: 12px;
        }

        .maestranze-btn {
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease,
            box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .maestranze-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .maestranze-btn-primary {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
        }

        .maestranze-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .maestranze-btn-neutral {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
        }

        .maestranze-btn-neutral:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .maestranze-btn-danger {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
        }

        .maestranze-btn-danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .maestranze-btn-full {
          width: 100%;
          margin-top: 8px;
        }

        .maestranze-legend-bar {
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

        .maestranze-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
        }

        .maestranze-legend-sample {
          min-width: 32px;
          justify-content: center;
        }

        .maestranze-legend-note {
          margin-left: auto;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 600;
        }

        .maestranze-table-card {
          margin: 0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .maestranze-table-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          max-width: 100%;
        }

        .maestranze-table {
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .maestranze-th {
          padding: 14px 16px;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .maestranze-th-sel {
          width: 44px;
          text-align: center;
        }

        .maestranze-th-act {
          width: 48px;
          text-align: center;
        }

        .maestranze-td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
          vertical-align: middle;
          line-height: 1.4;
        }

        .maestranze-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .maestranze-table tbody tr:hover {
          background: #fafbfc;
        }

        .maestranze-tr-selected {
          background: #eff6ff !important;
        }

        .maestranze-tr-selected:hover {
          background: #eff6ff !important;
        }

        .maestranze-td-sel {
          text-align: center;
        }

        .maestranze-td-center {
          text-align: center;
        }

        .maestranze-td-name {
          font-weight: 800;
          color: #0f172a;
          white-space: nowrap;
          min-width: 140px;
        }

        .maestranze-td-qual {
          color: #64748b;
          min-width: 120px;
          max-width: 200px;
        }

        .maestranze-radio {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .maestranze-row-remove {
          border: 0;
          background: #f8fafc;
          color: #94a3b8;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .maestranze-row-remove:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .maestranze-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .maestranze-pill-valid {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .maestranze-pill-soon {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .maestranze-pill-expired {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .maestranze-pill-empty {
          background: #f8fafc;
          color: #cbd5e1;
          border: 1px solid #f1f5f9;
        }

        .maestranze-pill-neutral {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .maestranze-bool {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
        }

        .maestranze-bool-yes {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .maestranze-bool-no {
          background: #f8fafc;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }

        .maestranze-empty-card {
          width: 100%;
          max-width: 100%;
          margin: 0;
          box-sizing: border-box;
          text-align: center;
          padding: 52px 32px;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
        }

        .maestranze-empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
        }

        .maestranze-empty-title {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          color: #020617;
        }

        .maestranze-empty-text {
          margin: 10px auto 22px;
          max-width: 400px;
          font-size: 14px;
          line-height: 1.65;
          color: #64748b;
        }

        .maestranze-empty-link {
          display: block;
          margin: 14px auto 0;
          border: 0;
          background: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }

        .maestranze-empty-link:hover {
          color: #2563eb;
        }

        :global(.maestranze-modal-overlay) {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(6px);
        }

        :global(.maestranze-modal) {
          width: 100%;
          max-width: 780px;
          max-height: calc(100vh - 64px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow:
            0 25px 50px -12px rgba(15, 23, 42, 0.25),
            0 12px 24px rgba(15, 23, 42, 0.08);
        }

        :global(.maestranze-modal-head) {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 24px 20px;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
        }

        :global(.maestranze-modal-head-text) {
          min-width: 0;
        }

        :global(.maestranze-modal-title) {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        :global(.maestranze-modal-sub) {
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.45;
          color: #64748b;
        }

        :global(.maestranze-modal-close) {
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

        :global(.maestranze-modal-close:hover) {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        :global(.maestranze-modal-body) {
          padding: 20px 24px 24px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
        }

        :global(.maestranze-modal-foot) {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px 20px;
          border-top: 1px solid #e2e8f0;
          background: #fafbfc;
          flex-shrink: 0;
        }

        :global(.maestranze-modal-btn-primary),
        :global(.maestranze-modal-btn-secondary) {
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

        :global(.maestranze-modal-btn-primary) {
          border: 1px solid #1d4ed8;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
        }

        :global(.maestranze-modal-btn-primary:hover) {
          background: #1d4ed8;
          border-color: #1e40af;
        }

        :global(.maestranze-modal-btn-secondary) {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
        }

        :global(.maestranze-modal-btn-secondary:hover) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        :global(.maestranze-form-section) {
          margin-bottom: 22px;
        }

        :global(.maestranze-form-section-last) {
          margin-bottom: 0;
        }

        :global(.maestranze-form-section-title) {
          margin: 0 0 14px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.02em;
        }

        :global(.maestranze-form-grid) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        :global(.maestranze-field) {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        :global(.maestranze-label) {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        :global(.maestranze-input) {
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

        :global(.maestranze-input:focus) {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        :global(.maestranze-field-hint) {
          margin: 6px 0 0;
          font-size: 12px;
          color: #94a3b8;
        }

        :global(.maestranze-check-field) {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(.maestranze-check-field-on) {
          border-color: #93c5fd;
          background: #eff6ff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        :global(.maestranze-check-input) {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          accent-color: #2563eb;
          cursor: pointer;
        }

        :global(.maestranze-check-label) {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        @media (max-width: 720px) {
          .maestranze-header {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .maestranze-header-right {
            align-items: stretch;
          }

          .maestranze-count-badge {
            align-self: flex-start;
          }

          .maestranze-header .maestranze-toolbar {
            flex-direction: column;
            justify-content: stretch;
          }

          .maestranze-header .maestranze-toolbar .maestranze-btn {
            width: 100%;
          }

          .maestranze-legend-note {
            margin-left: 0;
            width: 100%;
          }

          :global(.maestranze-form-grid) {
            grid-template-columns: 1fr;
          }

          :global(.maestranze-modal-foot) {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          :global(.maestranze-modal-btn-primary),
          :global(.maestranze-modal-btn-secondary) {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
