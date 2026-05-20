const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const backupPath = path.join(root, "components", "CseDocCheckApp.after-cantiere.tsx");
const appPath = path.join(root, "components", "CseDocCheckApp.tsx");
const impresaPath = path.join(root, "components", "pages", "ImpresaPage.tsx");

const backup = fs.readFileSync(backupPath, "utf8").split("\n");
const bodyStart = backup.findIndex((l) => l.includes('return (<div className="min-h-screen bg-slate-50">'));
if (bodyStart === -1) throw new Error("body start not found in backup");
const modalLine = backup.findIndex((l, i) => i > bodyStart && l.trim().startsWith("{showAddMaestra"));
const bodyLines = backup.slice(bodyStart + 1, modalLine);

const header = `// @ts-nocheck
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
`;

const footer = `
    </div>
  );
}
`;

fs.mkdirSync(path.dirname(impresaPath), { recursive: true });
fs.writeFileSync(impresaPath, header + bodyLines.join("\n") + footer, "utf8");

const app = fs.readFileSync(appPath, "utf8").split("\n");
const dupStart = app.findIndex(
  (l) =>
    l.includes('<AppHeader user={user} left={<BackButton onClick={() => { setShowExport(false); setPage("cantiere"); }}')
);
const impresaClose = app.findIndex(
  (l, i) => i > (dupStart || 0) && l.trim() === "</div>" && app[i + 1]?.trim().startsWith("{showAddMaestra")
);
if (dupStart !== -1 && impresaClose !== -1) {
  const cleaned = [...app.slice(0, dupStart), ...app.slice(impresaClose + 1)];
  fs.writeFileSync(appPath, cleaned.join("\n"), "utf8");
  console.log("Cleaned duplicate JSX from CseDocCheckApp.tsx");
} else {
  console.log("No duplicate block found (dupStart=%s impresaClose=%s)", dupStart, impresaClose);
}
console.log("Wrote", impresaPath, fs.statSync(impresaPath).size, "bytes");
