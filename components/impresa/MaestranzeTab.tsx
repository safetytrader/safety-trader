// @ts-nocheck
"use client";

import { useState } from "react";
import { replaceMaestranzeImpresa } from "@/lib/db";
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

function ImpresaFormInput({ label, value, onChange, hint }) {
  return (
    <div className="impresa-field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} />
      {hint ? <p className="impresa-field-hint">{hint}</p> : null}
    </div>
  );
}

export function MaestranzaFormFields({ form, setForm }) {
  return (
    <>
      <ImpresaFormInput
        label="Nominativo"
        value={form.nome}
        onChange={v => setForm(p => ({ ...p, nome: v }))}
      />
      <ImpresaFormInput
        label="Qualifica"
        value={form.qualifica}
        onChange={v => setForm(p => ({ ...p, qualifica: v }))}
      />
      <label className="impresa-check-row">
        <input
          type="checkbox"
          checked={isBoolChecked(form.dpi)}
          onChange={e => setForm(p => ({ ...p, dpi: e.target.checked }))}
        />
        DPI
      </label>
      <ImpresaFormInput
        label="Idoneità"
        value={form.idoneita}
        onChange={v => setForm(p => ({ ...p, idoneita: v }))}
      />
      <label className="impresa-check-row">
        <input
          type="checkbox"
          checked={isBoolChecked(form.formazioneBase)}
          onChange={e => setForm(p => ({ ...p, formazioneBase: e.target.checked }))}
        />
        F.Base
      </label>
      <ImpresaFormInput
        label="F.Spec"
        value={form.formazioneSpec}
        onChange={v => setForm(p => ({ ...p, formazioneSpec: v }))}
      />
      <ImpresaFormInput
        label="UNILAV"
        value={form.unilav}
        onChange={v => setForm(p => ({ ...p, unilav: v }))}
        hint="IND oppure data"
      />
      <p className="impresa-form-section">Abilitazioni / attestati opzionali</p>
      <ImpresaFormInput
        label="Preposto"
        value={form.preposto}
        onChange={v => setForm(p => ({ ...p, preposto: v }))}
      />
      <ImpresaFormInput
        label="Antinc."
        value={form.antincendio}
        onChange={v => setForm(p => ({ ...p, antincendio: v }))}
      />
      <ImpresaFormInput
        label="P.S."
        value={form.ps}
        onChange={v => setForm(p => ({ ...p, ps: v }))}
      />
      <ImpresaFormInput
        label="Ponteggi"
        value={form.ponteggiatori}
        onChange={v => setForm(p => ({ ...p, ponteggiatori: v }))}
      />
      <ImpresaFormInput
        label="MMT"
        value={form.mdt}
        onChange={v => setForm(p => ({ ...p, mdt: v }))}
      />
      <ImpresaFormInput
        label="PLE"
        value={form.ple}
        onChange={v => setForm(p => ({ ...p, ple: v }))}
      />
      <ImpresaFormInput
        label="Gru"
        value={form.gruista}
        onChange={v => setForm(p => ({ ...p, gruista: v }))}
      />
      <ImpresaFormInput
        label="Spazi Confinati"
        value={form.confinati}
        onChange={v => setForm(p => ({ ...p, confinati: v }))}
      />
    </>
  );
}

function renderBoolCell(v) {
  return isBoolChecked(v) ? (
    <span className="impresa-maestranze-ok">✓</span>
  ) : (
    <span className="impresa-maestranze-dash">—</span>
  );
}

function renderUnilavCell(val, dc) {
  if (!hasVal(val)) return <span className="impresa-maestranze-dash">—</span>;
  if (String(val).trim().toUpperCase() === "IND") return <span>{val}</span>;
  return dc(val);
}

function renderDateCell(val, scadType, dc) {
  if (!hasVal(val)) return <span className="impresa-maestranze-dash">—</span>;
  const disp = scadType ? calcScadenza(val, scadType) : val;
  if (disp === "✓") return <span className="impresa-maestranze-dash">—</span>;
  return dc(disp);
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

  const openEdit = () => {
    if (selectedIndex === null) return;
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

  const handleDeleteSelected = () => {
    if (selectedIndex === null) return;
    const m = imp.maestranze[selectedIndex];
    if (!window.confirm(`Eliminare la maestranza "${m.nome || "selezionata"}"?`)) return;
    removeAtIndex(selectedIndex);
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
      <div className="impresa-maestranze">
        <div className="impresa-section-head">
          <span className="impresa-section-title">
            Maestranze autorizzate ({imp.maestranze.length})
          </span>
          <div className="impresa-toolbar">
            <button
              type="button"
              disabled={selectedIndex === null}
              onClick={openEdit}
              className="impresa-btn-secondary"
            >
              Modifica selezionata
            </button>
            <button
              type="button"
              disabled={selectedIndex === null}
              onClick={handleDeleteSelected}
              className="impresa-btn-danger-outline"
            >
              Elimina selezionata
            </button>
            <button
              type="button"
              onClick={() => setShowAddMaestra(true)}
              className="impresa-btn-primary"
            >
              + Aggiungi
            </button>
          </div>
        </div>

        {imp.maestranze.length === 0 ? (
          <div className="impresa-maestranze-empty">
            <div className="impresa-maestranze-empty-icon">👷</div>
            <p>Carica i documenti per estrarre le maestranze</p>
            <button
              type="button"
              className="impresa-maestranze-empty-link"
              onClick={() => setActiveTab("upload")}
            >
              → Vai a Documenti
            </button>
          </div>
        ) : (
          <div className="impresa-table-wrap">
            <table className="impresa-table">
              <thead>
                <tr>
                  <th className="impresa-table-col-sel" />
                  {mandatoryHeaders.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                  {visibleOptional.map(col => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th className="impresa-table-col-act" />
                </tr>
              </thead>
              <tbody>
                {imp.maestranze.map((m, i) => {
                  const selected = selectedIndex === i;
                  return (
                    <tr
                      key={i}
                      onClick={() => setSelectedIndex(i)}
                      className={selected ? "impresa-table-row-selected" : ""}
                    >
                      <td
                        className="impresa-table-col-sel"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="radio"
                          name="sel-maestranza"
                          checked={selected}
                          onChange={() => setSelectedIndex(i)}
                        />
                      </td>
                      <td className="impresa-table-name">{m.nome || "—"}</td>
                      <td>{m.qualifica || "—"}</td>
                      <td className="impresa-table-center">{renderBoolCell(m.dpi)}</td>
                      <td className="impresa-table-center">
                        {hasVal(m.idoneita) ? (
                          dc(m.idoneita)
                        ) : (
                          <span className="impresa-maestranze-dash">—</span>
                        )}
                      </td>
                      <td className="impresa-table-center">
                        {renderBoolCell(m.formazioneBase)}
                      </td>
                      <td className="impresa-table-center">
                        {renderDateCell(m.formazioneSpec, "formazioneSpec", dc)}
                      </td>
                      <td className="impresa-table-center">
                        {renderUnilavCell(m.unilav, dc)}
                      </td>
                      {visibleOptional.map(col => (
                        <td key={col.key} className="impresa-table-center">
                          {renderDateCell(m[col.key], col.scadType, dc)}
                        </td>
                      ))}
                      <td
                        className="impresa-table-col-act"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="impresa-table-remove"
                          onClick={() => removeAtIndex(i)}
                          aria-label="Rimuovi"
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
        )}

        <div className="impresa-maestranze-legend">
          <span>* F. base non scade (Acc. Stato-Regioni 21/12/2011)</span>
          <span className="impresa-legend-pill impresa-legend-red">scaduto</span>
          <span className="impresa-legend-pill impresa-legend-amber">entro 60gg</span>
        </div>
      </div>

      {showEditModal && (
        <div className="impresa-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div
            className="impresa-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
          >
            <div className="impresa-modal-head">
              <h2 className="impresa-modal-title">Modifica maestranza</h2>
              <button
                type="button"
                className="impresa-modal-close"
                onClick={() => setShowEditModal(false)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="impresa-modal-body impresa-modal-body-scroll">
              <MaestranzaFormFields form={editForm} setForm={setEditForm} />
              <button
                type="button"
                className="impresa-btn-primary impresa-btn-full"
                onClick={handleSaveEdit}
              >
                Salva modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .impresa-maestranze-empty {
          text-align: center;
          padding: 48px 24px;
          color: #64748b;
        }

        .impresa-maestranze-empty-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .impresa-maestranze-empty p {
          margin: 0;
          font-size: 14px;
        }

        .impresa-maestranze-empty-link {
          margin-top: 12px;
          border: 0;
          background: none;
          color: #2563eb;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
        }

        .impresa-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .impresa-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .impresa-table thead tr {
          background: #f8fafc;
        }

        .impresa-table th {
          padding: 12px 14px;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          white-space: nowrap;
          border-bottom: 1px solid #e2e8f0;
        }

        .impresa-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
          vertical-align: middle;
        }

        .impresa-table tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .impresa-table tbody tr:hover {
          background: #fafbfc;
        }

        .impresa-table-row-selected {
          background: #eff6ff !important;
          box-shadow: inset 0 0 0 1px #bfdbfe;
        }

        .impresa-table-col-sel {
          width: 36px;
          text-align: center;
        }

        .impresa-table-col-act {
          width: 40px;
          text-align: center;
        }

        .impresa-table-name {
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
        }

        .impresa-table-center {
          text-align: center;
        }

        .impresa-maestranze-ok {
          color: #059669;
          font-weight: 800;
        }

        .impresa-maestranze-dash {
          color: #cbd5e1;
        }

        .impresa-table-remove {
          border: 0;
          background: none;
          color: #cbd5e1;
          font-size: 14px;
          cursor: pointer;
          padding: 4px;
        }

        .impresa-table-remove:hover {
          color: #dc2626;
        }

        .impresa-maestranze-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
          align-items: center;
          padding: 14px 22px;
          border-top: 1px solid #f1f5f9;
          background: #fafbfc;
          font-size: 11px;
          color: #64748b;
        }

        .impresa-legend-pill {
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 700;
        }

        .impresa-legend-red {
          background: #fef2f2;
          color: #b91c1c;
        }

        .impresa-legend-amber {
          background: #fffbeb;
          color: #b45309;
        }

        .impresa-check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .impresa-check-row input {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
        }

        .impresa-form-section {
          margin: 8px 0 0;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .impresa-field-hint {
          margin: 4px 0 0;
          font-size: 11px;
          color: #94a3b8;
        }

        .impresa-modal-body-scroll {
          max-height: 65vh;
          overflow-y: auto;
        }
      `}</style>
    </>
  );
}
