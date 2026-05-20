// @ts-nocheck
"use client";

import { BATCH_SIZE } from "@/lib/constants";

export function UploadTab({ imp, activeCantiere, activeImpresa, dragOver, setDragOver, handleFiles, fileRef, updateImpresa }) {
  return (
    <div className="space-y-4">
      <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(activeCantiere, activeImpresa, e.dataTransfer.files); }} onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => handleFiles(activeCantiere, activeImpresa, e.target.files)} />
        <div className="text-4xl mb-3">📂</div><p className="font-semibold text-slate-700">Trascina qui i documenti</p><p className="text-slate-400 text-sm mt-1">oppure clicca per selezionare</p><p className="text-slate-300 text-xs mt-3">PDF · JPEG · PNG — batch da {BATCH_SIZE} file</p>
      </div>
      {(imp.extracting || imp.extractLog?.length > 0) && <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto"><div className="text-slate-400 mb-2 font-sans font-semibold uppercase tracking-wider text-xs">Log</div>{imp.extractLog?.map((l, i) => <div key={i} className={`leading-5 ${l.includes("✅") || l.includes("👷") || l.includes("📋") || l.includes("📎") ? "text-emerald-400" : l.includes("❌") ? "text-red-400" : "text-slate-300"}`}>{l}</div>)}{imp.extracting && <div className="flex items-center gap-2 text-slate-400 mt-1"><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />In corso…</div>}</div>}
      {imp.uploadedFiles?.length > 0 && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">File caricati ({imp.uploadedFiles.length})</span>{!imp.extracting && <button onClick={() => updateImpresa(activeCantiere, activeImpresa, { uploadedFiles: [], checks: {}, allegati: {}, allegatiScadenze: {}, maestranze: [], extractLog: [], note: "", analyzed: false, aiSummary: "" })} className="text-xs text-red-400 hover:underline">Cancella tutto</button>}</div><div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">{imp.uploadedFiles.map((f, i) => <div key={i} className="px-5 py-2 flex items-center gap-3"><span>{f.type === "application/pdf" ? "📄" : "🖼️"}</span><div className="flex-1 min-w-0"><div className="text-sm text-slate-700 truncate">{f.name}</div><div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div></div></div>)}</div></div>}
      {!imp.uploadedFiles?.length && !imp.extractLog?.length && <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700"><strong>Come funziona:</strong> carica tutti i PDF e immagini ricevuti. Vengono elaborati in batch: maestranze e check-list estratti automaticamente con scadenze generate automaticamente. Usa poi <strong>Esporta</strong> per scaricare la scheda maestranze.</div>}
    </div>
  );
}
