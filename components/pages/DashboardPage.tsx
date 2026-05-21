// @ts-nocheck

"use client";



import { useState } from "react";

import Link from "next/link";

import { AppHeader } from "@/components/layout/AppHeader";

import { STATUS_COLORS } from "@/lib/constants";

import { calcStatus } from "@/lib/utils";

import { updateCantiere, deleteCantiere } from "@/lib/db";

import { Modal } from "@/components/ui/Modal";

import { Field } from "@/components/ui/Field";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

const RUOLI_CANTIERE = ["CSE", "Impresa", "RSPP"];

function RuoloField({ value, onChange, extraValue }) {
  const opts = extraValue && !RUOLI_CANTIERE.includes(extraValue) ? [extraValue, ...RUOLI_CANTIERE] : RUOLI_CANTIERE;
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">Ruolo</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
        <option value="">Seleziona ruolo</option>
        {opts.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}

export function DashboardPage({ cantieri, setCantieri, user, setNewCantiere, setShowNewCantiere, setActiveCantiere, setPage, authEmail, onLogout }) {

  const [editCantiere, setEditCantiere] = useState(null);

  const [editForm, setEditForm] = useState({ nome: "", indirizzo: "", cse: "", dataInizio: "" });



  const openEdit = (c, e) => {

    e.stopPropagation();

    setEditCantiere(c);

    setEditForm({ nome: c.nome, indirizzo: c.indirizzo, cse: c.cse, dataInizio: c.dataInizio });

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

      setCantieri(p => p.map(c => (c.id === editCantiere.id ? { ...c, ...editForm } : c)));

      setEditCantiere(null);

    }

  };



  return (

    <div className="min-h-screen bg-slate-50">

      <AppHeader user={user} right={<><button onClick={() => { setNewCantiere({ nome: "", indirizzo: "", cse: "CSE", dataInizio: "" }); setShowNewCantiere(true); }} className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition">+ Nuovo cantiere</button>{authEmail && onLogout && <button onClick={onLogout} className="text-slate-300 hover:text-white text-xs px-3 py-2 rounded-lg border border-slate-600 hover:border-slate-500 transition" title={authEmail}>Logout</button>}</>} />

      <div className="max-w-5xl mx-auto px-6 py-8">

        <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard Cantieri</h1>

        <p className="text-slate-500 text-sm mb-6">{cantieri.length} cantieri attivi</p>

        {cantieri.length === 0 ? (

          <div className="text-center py-24 text-slate-400">

            <div className="text-6xl mb-4">🏗️</div>

            <p className="font-semibold text-lg text-slate-600">Nessun cantiere attivo</p>

            <p className="text-sm mt-1 mb-6">Crea il primo cantiere per iniziare la verifica documentale</p>

            <button onClick={() => { setNewCantiere({ nome: "", indirizzo: "", cse: "CSE", dataInizio: "" }); setShowNewCantiere(true); }} className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition">+ Crea il primo cantiere</button>

          </div>

        ) : (

          <div className="grid gap-4">{cantieri.map(c => {

            const tot = c.imprese.length, idon = c.imprese.filter(i => calcStatus(i.checks) === "idoneo").length;

            return (

              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={() => { setActiveCantiere(c.id); setPage("cantiere"); }}>

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0"><h2 className="font-bold text-slate-800">{c.nome}</h2><p className="text-slate-500 text-sm">{c.indirizzo}</p><p className="text-slate-400 text-xs mt-1">Ruolo: {c.cse} · Inizio: {c.dataInizio}</p></div>

                  <div className="flex flex-col items-end gap-2 shrink-0">

                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>

                      <button type="button" onClick={e => openEdit(c, e)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition">Modifica</button>

                      <button type="button" onClick={e => handleDelete(c, e)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition">Elimina</button>

                    </div>

                    <div className="text-right"><div className="text-2xl font-bold text-slate-700">{idon}<span className="text-base text-slate-400">/{tot}</span></div><div className="text-xs text-slate-500">imprese idonee</div></div>

                  </div>

                </div>

                <div className="mt-3 flex gap-1 flex-wrap">{c.imprese.map(i => <div key={i.id} title={i.nome} className={`w-4 h-4 rounded-sm ${STATUS_COLORS[calcStatus(i.checks)]}`} />)}</div>

                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: tot ? `${Math.round(idon / tot * 100)}%` : "0%" }} /></div>

              </div>

            );

          })}</div>

        )}

        <footer className="mt-12 pb-4 text-center">
          <Link
            href="/privacy"
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Privacy e note legali
          </Link>
        </footer>

      </div>

      {editCantiere && (

        <Modal title="Modifica cantiere" onClose={() => setEditCantiere(null)}>

          <div className="space-y-3">

            <Field label="Nome cantiere" value={editForm.nome} onChange={v => setEditForm(p => ({ ...p, nome: v }))} />
            <Field label="Indirizzo" value={editForm.indirizzo} onChange={v => setEditForm(p => ({ ...p, indirizzo: v }))} />
            <RuoloField value={editForm.cse} extraValue={editCantiere.cse} onChange={v => setEditForm(p => ({ ...p, cse: v }))} />
            <Field label="Data inizio" value={editForm.dataInizio} onChange={v => setEditForm(p => ({ ...p, dataInizio: v }))} />

            <PrimaryButton onClick={handleSaveEdit}>Salva modifiche</PrimaryButton>

          </div>

        </Modal>

      )}

    </div>

  );

}

