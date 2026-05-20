// @ts-nocheck
import { buildSchediMaestanze, buildCSV } from "@/lib/export";

export function ExportMenu({ cantiere, imp, onClose }) {
  const dl = (content, name, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    onClose();
  };

  return (
    <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-slate-100 z-50 w-56">
      <p className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Esporta</p>
      <button
        onClick={() => dl(buildSchediMaestanze(cantiere, imp), `maestranze_${imp.nome.replace(/\s+/g, "_")}.html`, "text/html;charset=utf-8")}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left"
      >
        <span>👥</span>
        <div>
          <p className="text-sm font-medium text-slate-700">Scheda Maestranze</p>
          <p className="text-xs text-slate-400">Con scadenze formazione</p>
        </div>
      </button>
      <button
        onClick={() => dl("\uFEFF" + buildCSV(imp), `maestranze_${imp.nome.replace(/\s+/g, "_")}.csv`, "text/csv;charset=utf-8")}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-t border-slate-50"
      >
        <span>📊</span>
        <div>
          <p className="text-sm font-medium text-slate-700">Excel / CSV</p>
          <p className="text-xs text-slate-400">Apri con Excel</p>
        </div>
      </button>
    </div>
  );
}
