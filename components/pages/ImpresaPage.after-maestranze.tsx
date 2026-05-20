// @ts-nocheck
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { ExportMenu } from "@/components/export/ExportMenu";
import { AllegatiTab } from "@/components/impresa/AllegatiTab";
import { ChecklistTab } from "@/components/impresa/ChecklistTab";
import { MaestranzeTab } from "@/components/impresa/MaestranzeTab";
import { BATCH_SIZE, BADGE } from "@/lib/constants";
import { calcStatus } from "@/lib/utils";

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

        {activeTab === "maestranze" && <MaestranzeTab
          imp={imp}
          activeCantiere={activeCantiere}
          activeImpresa={activeImpresa}
          updateImpresa={updateImpresa}
          setShowAddMaestra={setShowAddMaestra}
          setActiveTab={setActiveTab}
          dc={dc}
        />}

        {activeTab === "check-list" && <ChecklistTab
          imp={imp}
          activeCantiere={activeCantiere}
          activeImpresa={activeImpresa}
          updateImpresa={updateImpresa}
        />}

        {activeTab === "allegati" && <AllegatiTab
          imp={imp}
          activeCantiere={activeCantiere}
          activeImpresa={activeImpresa}
          updateImpresa={updateImpresa}
        />}

      </div>
    </div>
  );
}
