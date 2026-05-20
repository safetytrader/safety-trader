import { calcScadenza, isExpired, isExpiringSoon } from "@/lib/utils";

// ── EXPORT HTML SCHEDA MAESTRANZE ─────────────────────────────────────────────
export function buildSchediMaestanze(cantiere, imp) {
  const oggi = new Date().toLocaleDateString("it-IT");
  const mae = imp.maestranze
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
    .map(m => {
      const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
      const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
      const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
      const idoScad = m.idoneita ? m.idoneita : "—";
      
      return `<tr>
        <td style="padding:6px 8px;font-size:10px;font-weight:600">${m.nome}</td>
        <td style="padding:6px 8px;font-size:10px">${m.qualifica || "—"}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${idoScad}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${m.formazioneBase ? "✓" : "—"}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${isExpired(fSpecScad) ? "color:#991b1b;font-weight:600" : isExpiringSoon(fSpecScad) ? "color:#92400e;font-weight:600" : "color:#065f46;font-weight:600"}">${fSpecScad}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${isExpired(aggScad) ? "color:#991b1b;font-weight:600" : isExpiringSoon(aggScad) ? "color:#92400e;font-weight:600" : "color:#065f46;font-weight:600"}">${aggScad}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${isExpired(prepostoScad) ? "color:#991b1b;font-weight:600" : isExpiringSoon(prepostoScad) ? "color:#92400e;font-weight:600" : "color:#065f46;font-weight:600"}">${prepostoScad}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${m.ponteggiatori ? (m.ponteggiatori === "✓" ? "✓" : m.ponteggiatori) : "—"}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${m.antincendio || "—"}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${m.ps || "—"}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Scheda Maestranze — ${imp.nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 30px; }
    h1 { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
    .meta { font-size: 11px; color: #94a3b8; margin-bottom: 20px; }
    h2 { font-size: 12px; font-weight: 700; margin: 15px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f8fafc; padding: 8px; font-size: 10px; text-align: left; color: #64748b; border: 1px solid #e2e8f0; font-weight: 600; }
    td { padding: 6px 8px; font-size: 10px; border: 1px solid #f1f5f9; }
    tr:nth-child(even) { background: #f8fafc; }
    .legend { font-size: 9px; color: #94a3b8; margin-top: 12px; line-height: 1.6; }
    .expired { color: #991b1b; font-weight: 600; }
    .warning { color: #92400e; font-weight: 600; }
    .valid { color: #065f46; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Scheda Maestranze Autorizzate</h1>
  <div class="meta">
    <strong>Impresa:</strong> ${imp.nome} — ${imp.attivita}<br/>
    <strong>Cantiere:</strong> ${cantiere.nome}<br/>
    <strong>Data:</strong> ${oggi}
  </div>
  <h2>Maestranze con Scadenze Formazione</h2>
  <table>
    <thead>
      <tr>
        <th>Nominativo</th>
        <th>Qualifica</th>
        <th>Idoneità</th>
        <th>F. Base</th>
        <th>F. Specifica (Scad.)</th>
        <th>Aggiornamento (Scad.)</th>
        <th>Preposto (Scad.)</th>
        <th>Ponteggiatori</th>
        <th>Antincendio</th>
        <th>P.S.</th>
      </tr>
    </thead>
    <tbody>${mae || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:15px">Nessuna maestranza inserita</td></tr>'}</tbody>
  </table>
  <div class="legend">
    <strong>Note:</strong><br/>
    • Formazione base non scade (Accordo Stato-Regioni 21/12/2011)<br/>
    • Formazione specifica: aggiornamento ogni 5 anni<br/>
    • <span class="expired">Scaduto</span> — <span class="warning">Entro 60 giorni</span> — <span class="valid">Valido</span>
  </div>
</body>
</html>`;
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
export function buildCSV(imp) {
  const e = v => `"${String(v || "").replace(/"/g, '""')}"`;
  return [
    ["SCHEDA MAESTRANZE — Safety Trader"],
    ["Impresa", imp.nome],
    ["Attività", imp.attivita || ""],
    [""],
    ["MAESTRANZE AUTORIZZATE"],
    ["Nominativo", "Qualifica", "Idon.", "F.Base", "F.Spec (Scad.)", "Aggiornam. (Scad.)", "Preposto (Scad.)", "Pontegg.", "Antinc.", "P.S."],
    ...imp.maestranze.map(m => {
      const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
      const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
      const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
      return [m.nome, m.qualifica, m.idoneita, m.formazioneBase ? "✓" : "—", fSpecScad, aggScad, prepostoScad, m.ponteggiatori, m.antincendio, m.ps];
    }),
    [""],
    ["NOTE:", "Formazione base non scade. F.Spec e Aggiornamento: ogni 5 anni."],
  ].map(r => r.map(e).join(",")).join("\n");
}
