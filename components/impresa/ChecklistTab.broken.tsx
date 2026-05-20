// @ts-nocheck
"use client";

import { CHECKLIST_ITEMS } from "@/lib/constants";
import { upsertChecklistImpresa } from "@/lib/db";

export function ChecklistTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncChecklist = (checks, note) => {
    upsertChecklistImpresa(activeImpresa, checks, note).catch(() => {});
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">Check-list POS — Allegato XV D.Lgs. 81/2008</span><span className="text-xs text-slate-400">{CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length}/{CHECKLIST_ITEMS.length}</span></div>{["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"].map(l => {
      const items = CHECKLIST_ITEMS.filter(i => i.lettera === l);
      if (!items.length) return null;
      return (<div key={l}><div className="px-5 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">Lettera {l}</div>{items.map(item => <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 border-b border-slate-50"><div className="flex gap-1.5 mt-0.5 flex-shrink-0">{["si", "no", "n.a."].map(v => <button key={v} onClick={() => { const checks = { ...imp.checks, [item.id]: v }; updateImpresa(activeCantiere, activeImpresa, { checks }); syncChecklist(checks, imp.note); }} className={`text-xs px-1.5 py-0.5 rounded font-medium border transition ${imp.checks[item.id] === v ? (v === "si" ? "bg-emerald-500 text-white border-emerald-500" : v === "no" ? "bg-red-500 text-white border-red-500" : "bg-slate-400 text-white border-slate-400") : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"}`}>{v.toUpperCase()}</button>)}</div><span className="text-sm text-slate-700 leading-snug">{item.label}{item.required && <span className="ml-1 text-slate-300 text-xs">*</span>}</span></div>)}</div>);
    })}<div className="px-5 py-3 border-t border-slate-100"><label className="text-xs font-medium text-slate-600 block mb-1">Note CSE</label><textarea value={imp.note} onChange={e => { const note = e.target.value; updateImpresa(activeCantiere, activeImpresa, { note }); syncChecklist(imp.checks, note); }} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Carenze, integrazioni richieste…" /></div></div>
  );
}
