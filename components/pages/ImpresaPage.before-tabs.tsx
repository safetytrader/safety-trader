// @ts-nocheck
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { ExportMenu } from "@/components/export/ExportMenu";
import { BATCH_SIZE, CHECKLIST_ITEMS, ALLEGATI_CONFIG, BADGE } from "@/lib/constants";
import { calcStatus, calcScadenza } from "@/lib/utils";

export function ImpresaPage({
  c,
  imp,
  user,
  activeCantiere,
  activeImpresa,
  activeTab,
  setActiveTab,
  setPage,
  setShowExport,
  showExport,
  setShowAddMaestra,
  updateImpresa,
  handleFiles,
  dragOver,
  setDragOver,
  fileRef,
  dc,
}) {
  const st = calcStatus(imp.checks);
  const TLABELS = { "upload": "📁 Carica", "maestranze": "👥 Maestranze", "check-list": "✅ Check-list", "allegati": "📎 Allegati" };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} left={<BackButton onClick={() => { setShowExport(false); setPage("cantiere"); }} label={c.nome} />} title={imp.nome} sub={imp.attivita}
        right={<div className="flex items-center gap-2"><span className={`text-xs px-2 py-1 rounded-full font-medium ${BADGE[st]}`}>{st}</span><div className="relative"><button onClick={() => setShowExport(v => !v)} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">⬇ Esporta</button>{showExport && <ExportMenu cantiere={c} imp={imp} onClose={() => setShowExport(false)} />}</div></div>} />
      <div className="bg-white border-b border-slate-100 px-6"><div className="max-w-4xl mx-auto flex overflow-x-auto">{Object.keys(TLABELS).map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition ${activeTab === t ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{TLABELS[t]}</button>)}</div></div>
      <div className="max-w-4xl mx-auto px-6 py-6">

        {activeTab === "upload" && <div className="space-y-4">
          <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(activeCantiere, activeImpresa, e.dataTransfer.files); }} onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => handleFiles(activeCantiere, activeImpresa, e.target.files)} />
            <div className="text-4xl mb-3">📂</div><p className="font-semibold text-slate-700">Trascina qui i documenti</p><p className="text-slate-400 text-sm mt-1">oppure clicca per selezionare</p><p className="text-slate-300 text-xs mt-3">PDF · JPEG · PNG — batch da {BATCH_SIZE} file</p>
          </div>
          {(imp.extracting || imp.extractLog?.length > 0) && <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto"><div className="text-slate-400 mb-2 font-sans font-semibold uppercase tracking-wider text-xs">Log</div>{imp.extractLog?.map((l, i) => <div key={i} className={`leading-5 ${l.includes("✅") || l.includes("👷") || l.includes("📋") || l.includes("📎") ? "text-emerald-400" : l.includes("❌") ? "text-red-400" : "text-slate-300"}`}>{l}</div>)}{imp.extracting && <div className="flex items-center gap-2 text-slate-400 mt-1"><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />In corso…</div>}</div>}
          {imp.uploadedFiles?.length > 0 && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">File caricati ({imp.uploadedFiles.length})</span>{!imp.extracting && <button onClick={() => updateImpresa(activeCantiere, activeImpresa, { uploadedFiles: [], checks: {}, allegati: {}, allegatiScadenze: {}, maestranze: [], extractLog: [], note: "", analyzed: false, aiSummary: "" })} className="text-xs text-red-400 hover:underline">Cancella tutto</button>}</div><div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">{imp.uploadedFiles.map((f, i) => <div key={i} className="px-5 py-2 flex items-center gap-3"><span>{f.type === "application/pdf" ? "📄" : "🖼️"}</span><div className="flex-1 min-w-0"><div className="text-sm text-slate-700 truncate">{f.name}</div><div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div></div></div>)}</div></div>}
          {!imp.uploadedFiles?.length && !imp.extractLog?.length && <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700"><strong>Come funziona:</strong> carica tutti i PDF e immagini ricevuti. Vengono elaborati in batch: maestranze e check-list estratti automaticamente con scadenze generate automaticamente. Usa poi <strong>Esporta</strong> per scaricare la scheda maestranze.</div>}
        </div>}

        {activeTab === "maestranze" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">Maestranze Autorizzate ({imp.maestranze.length})</span><button onClick={() => setShowAddMaestra(true)} className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-400 transition font-medium">+ Aggiungi</button></div>{imp.maestranze.length === 0 ? <div className="text-center py-12 text-slate-400"><div className="text-3xl mb-2">👷</div><p className="text-sm">Carica i documenti per estrarre le maestranze</p><button onClick={() => setActiveTab("upload")} className="mt-2 text-xs text-blue-500 hover:underline">→ Carica Documenti</button></div> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-500 font-semibold">{["Nominativo", "Qualifica", "Idon.", "F.Base", "F.Spec (Scad.)", "Aggiornam. (Scad.)", "Preposto (Scad.)", "Pontegg.", "Antinc.", "P.S.", ""].map((h, i) => <th key={i} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{imp.maestranze.map((m, i) => {
          const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
          const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
          const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
          return (<tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{m.nome}</td><td className="px-3 py-2.5 text-slate-600 max-w-24 truncate">{m.qualifica}</td><td className="px-3 py-2.5 text-center">{dc(m.idoneita)}</td><td className="px-3 py-2.5 text-center">{m.formazioneBase ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{dc(fSpecScad)}</td><td className="px-3 py-2.5 text-center">{dc(aggScad)}</td><td className="px-3 py-2.5 text-center">{dc(prepostoScad)}</td><td className="px-3 py-2.5 text-center">{m.ponteggiatori ? (m.ponteggiatori === "✓" ? <span className="text-emerald-600 font-semibold">✓</span> : m.ponteggiatori) : <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{m.antincendio || <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{m.ps || <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5"><button onClick={() => updateImpresa(activeCantiere, activeImpresa, { maestranze: imp.maestranze.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-red-400">✕</button></td></tr>);
        })}</tbody></table></div>}<div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500"><span>* F. base non scade (Acc. Stato-Regioni 21/12/2011)</span><span className="flex items-center gap-1"><span className="px-1 bg-red-100 text-red-700 rounded">scaduto</span></span><span className="flex items-center gap-1"><span className="px-1 bg-amber-100 text-amber-700 rounded">entro 60gg</span></span></div></div>}

        {activeTab === "check-list" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">Check-list POS — Allegato XV D.Lgs. 81/2008</span><span className="text-xs text-slate-400">{CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length}/{CHECKLIST_ITEMS.length}</span></div>{["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"].map(l => {
          const items = CHECKLIST_ITEMS.filter(i => i.lettera === l);
          if (!items.length) return null;
          return (<div key={l}><div className="px-5 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">Lettera {l}</div>{items.map(item => <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 border-b border-slate-50"><div className="flex gap-1.5 mt-0.5 flex-shrink-0">{["si", "no", "n.a."].map(v => <button key={v} onClick={() => updateImpresa(activeCantiere, activeImpresa, { checks: { ...imp.checks, [item.id]: v } })} className={`text-xs px-1.5 py-0.5 rounded font-medium border transition ${imp.checks[item.id] === v ? (v === "si" ? "bg-emerald-500 text-white border-emerald-500" : v === "no" ? "bg-red-500 text-white border-red-500" : "bg-slate-400 text-white border-slate-400") : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"}`}>{v.toUpperCase()}</button>)}</div><span className="text-sm text-slate-700 leading-snug">{item.label}{item.required && <span className="ml-1 text-slate-300 text-xs">*</span>}</span></div>)}</div>);
        })}<div className="px-5 py-3 border-t border-slate-100"><label className="text-xs font-medium text-slate-600 block mb-1">Note CSE</label><textarea value={imp.note} onChange={e => updateImpresa(activeCantiere, activeImpresa, { note: e.target.value })} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Carenze, integrazioni richieste…" /></div></div>}

        {activeTab === "allegati" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100"><span className="font-semibold text-slate-700 text-sm">Allegati obbligatori</span></div>{ALLEGATI_CONFIG.map(cfg => {
          const presente = !!imp.allegati[cfg.key];
          return (<div key={cfg.key} className="px-5 py-3 border-b border-slate-50 hover:bg-slate-50"><div className="flex items-center gap-3"><button onClick={() => updateImpresa(activeCantiere, activeImpresa, { allegati: { ...imp.allegati, [cfg.key]: !presente } })} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${presente ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`}>{presente && <span className="text-xs">✓</span>}</button><span className="text-sm text-slate-700 flex-1">{cfg.key}</span></div></div>);
        })}</div>}

      </div>
    </div>
  );
}
