// @ts-nocheck

"use client";



import { useState } from "react";

import { AppHeader } from "@/components/layout/AppHeader";

import { BackButton } from "@/components/ui/BackButton";

import { EmptyState } from "@/components/ui/EmptyState";

import { Modal } from "@/components/ui/Modal";

import { Field } from "@/components/ui/Field";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { CHECKLIST_ITEMS, STATUS_COLORS, BADGE } from "@/lib/constants";

import { calcStatus } from "@/lib/utils";

import { updateImpresaDb, deleteImpresaDb } from "@/lib/db";



export function CantierePage({ c, setCantieri, user, setPage, setShowNewImpresa, setActiveImpresa, setActiveTab }) {

  const [editImpresa, setEditImpresa] = useState(null);

  const [editForm, setEditForm] = useState({ nome: "", attivita: "" });



  const openEdit = (imp, e) => {

    e.stopPropagation();

    setEditImpresa(imp);

    setEditForm({ nome: imp.nome, attivita: imp.attivita });

  };



  const handleDelete = async (imp, e) => {

    e.stopPropagation();

    if (!window.confirm(`Eliminare l'impresa "${imp.nome}"?`)) return;

    try {

      await deleteImpresaDb(imp.id);

      setCantieri(p => p.map(cant => (cant.id !== c.id ? cant : { ...cant, imprese: cant.imprese.filter(i => i.id !== imp.id) })));

    } catch (err) {

      console.error("Errore eliminazione impresa:", err?.message || err);

      setCantieri(p => p.map(cant => (cant.id !== c.id ? cant : { ...cant, imprese: cant.imprese.filter(i => i.id !== imp.id) })));

    }

  };



  const handleSaveEdit = async () => {

    if (!editImpresa) return;

    try {

      const updated = await updateImpresaDb(editImpresa.id, { ...editForm, note: editImpresa.note ?? "" }, editImpresa);

      setCantieri(p => p.map(cant => (cant.id !== c.id ? cant : { ...cant, imprese: cant.imprese.map(i => (i.id === updated.id ? updated : i)) })));

      setEditImpresa(null);

    } catch (err) {

      console.error("Errore aggiornamento impresa:", err?.message || err);

      setCantieri(p => p.map(cant => (cant.id !== c.id ? cant : { ...cant, imprese: cant.imprese.map(i => (i.id === editImpresa.id ? { ...i, ...editForm } : i)) })));

      setEditImpresa(null);

    }

  };



  return (

    <div className="min-h-screen bg-slate-50">

      <AppHeader user={user} left={<BackButton onClick={() => setPage("dashboard")} label="Dashboard" />} title={c.nome} sub={c.cse} right={<button onClick={() => setShowNewImpresa(true)} className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition">+ Impresa</button>} />

      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="grid grid-cols-4 gap-3 mb-6">{["idoneo", "parziale", "non idoneo", "da verificare"].map(s => <div key={s} className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm"><div className={`text-2xl font-bold ${s === "idoneo" ? "text-emerald-600" : s === "parziale" ? "text-amber-500" : s === "non idoneo" ? "text-red-500" : "text-slate-400"}`}>{c.imprese.filter(i => calcStatus(i.checks) === s).length}</div><div className="text-xs text-slate-500 capitalize">{s}</div></div>)}</div>

        <div className="space-y-3">{c.imprese.map(imp => {

          const st = calcStatus(imp.checks), done = CHECKLIST_ITEMS.filter(i => i.required && imp.checks[i.id] === "si").length, tot = CHECKLIST_ITEMS.filter(i => i.required).length;

          return (

            <div key={imp.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition cursor-pointer" onClick={() => { setActiveImpresa(imp.id); setActiveTab("upload"); setPage("impresa"); }}>

              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[st]}`} />

              <div className="flex-1 min-w-0"><div className="font-semibold text-slate-800 text-sm truncate">{imp.nome}</div><div className="text-xs text-slate-500">{imp.attivita}</div></div>

              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>

                <button type="button" onClick={e => openEdit(imp, e)} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition">Modifica</button>

                <button type="button" onClick={e => handleDelete(imp, e)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition">Elimina</button>

              </div>

              <div className="flex items-center gap-3">{imp.uploadedFiles?.length > 0 && <span className="text-xs text-slate-400">📎{imp.uploadedFiles.length}</span>}<span className="text-xs text-slate-500">{done}/{tot}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE[st]}`}>{st}</span><span className="text-slate-300">›</span></div>

            </div>

          );

        })}</div>

        {c.imprese.length === 0 && <EmptyState icon="🏢" title="Nessuna impresa" sub="Aggiungi le imprese esecutrici" />}

      </div>

      {editImpresa && (

        <Modal title="Modifica impresa" onClose={() => setEditImpresa(null)}>

          <div className="space-y-3">

            <Field label="Ragione sociale" value={editForm.nome} onChange={v => setEditForm(p => ({ ...p, nome: v }))} />

            <Field label="Attività svolta" value={editForm.attivita} onChange={v => setEditForm(p => ({ ...p, attivita: v }))} />

            <PrimaryButton onClick={handleSaveEdit}>Salva modifiche</PrimaryButton>

          </div>

        </Modal>

      )}

    </div>

  );

}

