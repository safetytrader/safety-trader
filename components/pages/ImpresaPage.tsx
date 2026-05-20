// @ts-nocheck
"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { ExportMenu } from "@/components/export/ExportMenu";
import { AllegatiTab } from "@/components/impresa/AllegatiTab";
import { ChecklistTab } from "@/components/impresa/ChecklistTab";
import { MaestranzeTab } from "@/components/impresa/MaestranzeTab";
import { UploadTab } from "@/components/impresa/UploadTab";
import { BADGE } from "@/lib/constants";
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

        {activeTab === "upload" && <UploadTab
          imp={imp}
          activeCantiere={activeCantiere}
          activeImpresa={activeImpresa}
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleFiles={handleFiles}
          fileRef={fileRef}
          updateImpresa={updateImpresa}
        />}

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
