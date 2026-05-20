import fs from "fs";
const p = new URL("./components/CseDocCheckApp.tsx", import.meta.url);
const file = fs.readFileSync(p, "utf8");
const lines = file.split(/\r?\n/);
const start = lines.findIndex((l) => l.includes("__REMOVE_START__"));
const modal = lines.findIndex((l) => l.trim().startsWith("{showAddMaestra && <Modal title=\"Aggiungi maestranza\""));
if (start < 0 || modal < 0) {
  console.error("start", start, "modal", modal);
  process.exit(1);
}
const out = [...lines.slice(0, start), ...lines.slice(modal)].join("\n");
fs.writeFileSync(p, out);
console.log("fixed", lines.length, "->", out.split(/\r?\n/).length);
