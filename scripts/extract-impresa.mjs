import fs from "fs";
import path from "path";

const appPath = path.join("components", "CseDocCheckApp.tsx");
const lines = fs.readFileSync(appPath, "utf8").split("\n");

// 1-based 258-291: header through inner content close (exclude modal 292)
const inner = lines.slice(257, 291);
inner[0] = inner[0].replace(/^\s*return \(\<div/, "    <div");

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
`;

const footer = `
    </div>
  );
}
`;

fs.writeFileSync(
  path.join("components", "pages", "ImpresaPage.tsx"),
  header + inner.join("\n") + footer
);
console.log("OK");
