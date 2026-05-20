// @ts-nocheck
"use client";

import { useState } from "react";
import { replaceMaestranzeImpresa } from "@/lib/db";
import { calcScadenza } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

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
  nome: "", qualifica: "", dpi: false, idoneita: "", formazioneBase: false, formazioneSpec: "", unilav: "",
  preposto: "", antincendio: "", ps: "", ponteggiatori: "", mdt: "", ple: "", gruista: "", confinati: "",
});

const hasVal = v => v != null && String(v).trim() !== "";

export const isBoolChecked = v =>
  v === true || v === "true" || v === "✓" || v === "si" || v === "Sì";

export function MaestranzaFormFields({ form, setForm }) {
  return (
    <>
      <Field label="Nominativo" value={form.nome} onChange={v => setForm(p => ({ ...p, nome: v }))} />
      <Field label="Qualifica" value={form.qualifica} onChange={v => setForm(p => ({ ...p, qualifica: v }))} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isBoolChecked(form.dpi)} onChange={e => setForm(p => ({ ...p, dpi: e.target.checked }))} className="accent-blue-500" />
        DPI
      </label>
      <Field label="Idoneità" value={form.idoneita} onChange={v => setForm(p => ({ ...p, idoneita: v }))} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isBoolChecked(form.formazioneBase)} onChange={e => setForm(p => ({ ...p, formazioneBase: e.target.checked }))} className="accent-blue-500" />
        F.Base
      </label>
      <Field label="F.Spec" value={form.formazioneSpec} onChange={v => setForm(p => ({ ...p, formazioneSpec: v }))} />
      <div>
        <Field label="UNILAV" value={form.unilav} onChange={v => setForm(p => ({ ...p, unilav: v }))} />
        <p className="text-xs text-slate-400 mt-0.5">IND oppure data</p>
      </div>
      <p className="text-xs font-semibold text-slate-500 pt-2 border-t border-slate-100">Abilitazioni / attestati opzionali</p>
      <Field label="Preposto" value={form.preposto} onChange={v => setForm(p => ({ ...p, preposto: v }))} />
      <Field label="Antinc." value={form.antincendio} onChange={v => setForm(p => ({ ...p, antincendio: v }))} />
      <Field label="P.S." value={form.ps} onChange={v => setForm(p => ({ ...p, ps: v }))} />
      <Field label="Ponteggi" value={form.ponteggiatori} onChange={v => setForm(p => ({ ...p, ponteggiatori: v }))} />
      <Field label="MMT" value={form.mdt} onChange={v => setForm(p => ({ ...p, mdt: v }))} />
      <Field label="PLE" value={form.ple} onChange={v => setForm(p => ({ ...p, ple: v }))} />
      <Field label="Gru" value={form.gruista} onChange={v => setForm(p => ({ ...p, gruista: v }))} />
      <Field label="Spazi Confinati" value={form.confinati} onChange={v => setForm(p => ({ ...p, confinati: v }))} />
    </>
  );
}

function renderBoolCell(v) {
  return isBoolChecked(v) ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-slate-300">—</span>;
}

function renderUnilavCell(val, dc) {
  if (!hasVal(val)) return <span className="text-slate-300">—</span>;
  if (String(val).trim().toUpperCase() === "IND") return <span>{val}</span>;
  return dc(val);
}

function renderDateCell(val, scadType, dc) {
  if (!hasVal(val)) return <span className="text-slate-300">—</span>;
  const disp = scadType ? calcScadenza(val, scadType) : val;
  if (disp === "✓") return <span className="text-slate-300">—</span>;
  return dc(disp);
}

export function MaestranzeTab({ imp, activeCantiere, activeImpresa, updateImpresa, setShowAddMaestra, setActiveTab, dc }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyMaestranza());

  const visibleOptional = OPTIONAL_COLS.filter(col => imp.maestranze.some(m => hasVal(m[col.key])));

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
    else if (selectedIndex !== null && selectedIndex > i) setSelectedIndex(selectedIndex - 1);
  };

  const openEdit = () => {
    if (selectedIndex === null) return;
    setEditForm({ ...emptyMaestranza(), ...imp.maestranze[selectedIndex] });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (selectedIndex === null) return;
    const nuovaLista = imp.maestranze.map((m, j) => (j === selectedIndex ? { ...editForm } : m));
    persistMaestranze(nuovaLista);
    setShowEditModal(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIndex === null) return;
    const m = imp.maestranze[selectedIndex];
    if (!window.confirm(`Eliminare la maestranza "${m.nome || "selezionata"}"?`)) return;
    removeAtIndex(selectedIndex);
  };

  const btnDisabled = "opacity-40 cursor-not-allowed";
  const btnSecondary = "text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-medium";

  const mandatoryHeaders = ["Nominativo", "Qualifica", "DPI", "Idoneità", "F.Base", "F.Spec", "UNILAV"];

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-slate-700 text-sm">Maestranze Autorizzate ({imp.maestranze.length})</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" disabled={selectedIndex === null} onClick={openEdit} className={`${btnSecondary} ${selectedIndex === null ? btnDisabled : ""}`}>Modifica selezionata</button>
          <button type="button" disabled={selectedIndex === null} onClick={handleDeleteSelected} className={`text-xs px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition font-medium ${selectedIndex === null ? btnDisabled : ""}`}>Elimina selezionata</button>
          <button type="button" onClick={() => setShowAddMaestra(true)} className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-400 transition font-medium">+ Aggiungi</button>
        </div>
      </div>
      {imp.maestranze.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">👷</div>
          <p className="text-sm">Carica i documenti per estrarre le maestranze</p>
          <button type="button" onClick={() => setActiveTab("upload")} className="mt-2 text-xs text-blue-500 hover:underline">→ Carica Documenti</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold">
                <th className="px-2 py-2 w-8" />
                {mandatoryHeaders.map(h => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
                {visibleOptional.map(col => (
                  <th key={col.key} className="px-3 py-2 text-left whitespace-nowrap">{col.label}</th>
                ))}
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {imp.maestranze.map((m, i) => {
                const selected = selectedIndex === i;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`cursor-pointer transition ${selected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <input type="radio" name="sel-maestranza" checked={selected} onChange={() => setSelectedIndex(i)} className="accent-blue-500" />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{m.nome || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-24 truncate">{m.qualifica || "—"}</td>
                    <td className="px-3 py-2.5 text-center">{renderBoolCell(m.dpi)}</td>
                    <td className="px-3 py-2.5 text-center">{hasVal(m.idoneita) ? dc(m.idoneita) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center">{renderBoolCell(m.formazioneBase)}</td>
                    <td className="px-3 py-2.5 text-center">{renderDateCell(m.formazioneSpec, "formazioneSpec", dc)}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{renderUnilavCell(m.unilav, dc)}</td>
                    {visibleOptional.map(col => (
                      <td key={col.key} className="px-3 py-2.5 text-center">{renderDateCell(m[col.key], col.scadType, dc)}</td>
                    ))}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => removeAtIndex(i)} className="text-slate-300 hover:text-red-400">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>* F. base non scade (Acc. Stato-Regioni 21/12/2011)</span>
        <span className="flex items-center gap-1"><span className="px-1 bg-red-100 text-red-700 rounded">scaduto</span></span>
        <span className="flex items-center gap-1"><span className="px-1 bg-amber-100 text-amber-700 rounded">entro 60gg</span></span>
      </div>
      {showEditModal && (
        <Modal title="Modifica maestranza" onClose={() => setShowEditModal(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <MaestranzaFormFields form={editForm} setForm={setEditForm} />
            <PrimaryButton onClick={handleSaveEdit}>Salva modifiche</PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
