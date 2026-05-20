// @ts-nocheck
"use client";

import { ALLEGATI_CONFIG } from "@/lib/constants";
import { upsertAllegatiImpresa } from "@/lib/db";

export function AllegatiTab({ imp, activeCantiere, activeImpresa, updateImpresa }) {
  const syncAllegati = async (allegati, allegatiScadenze) => {
    try {
      await upsertAllegatiImpresa(activeImpresa, allegati, allegatiScadenze);
    } catch (err) {
      console.error("Errore salvataggio allegati Supabase:", err?.message || err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100"><span className="font-semibold text-slate-700 text-sm">Allegati obbligatori</span></div>{ALLEGATI_CONFIG.map(cfg => {
      const presente = !!imp.allegati[cfg.key];
      return (<div key={cfg.key} className="px-5 py-3 border-b border-slate-50 hover:bg-slate-50"><div className="flex items-center gap-3"><button onClick={() => { const nuoviAllegati = { ...(imp.allegati || {}), [cfg.key]: !presente }; updateImpresa(activeCantiere, activeImpresa, { allegati: nuoviAllegati }); syncAllegati(nuoviAllegati, imp.allegatiScadenze || {}); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${presente ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`}>{presente && <span className="text-xs">✓</span>}</button><span className="text-sm text-slate-700 flex-1">{cfg.key}</span></div></div>);
    })}</div>
  );
}
