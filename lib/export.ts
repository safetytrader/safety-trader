// @ts-nocheck
import { CHECKLIST_ITEMS, ALLEGATI_CONFIG } from "@/lib/constants";
import { calcScadenza, isExpired, isExpiringSoon, calcStatus } from "@/lib/utils";

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeExportSlug(value) {
  return (
    String(value || "senza-nome")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "senza-nome"
  );
}

export function buildExportFilename(cantiere, imp, ext) {
  const date = new Date().toISOString().slice(0, 10);
  return `safety-trader_${sanitizeExportSlug(cantiere?.nome)}_${sanitizeExportSlug(imp?.nome)}_${date}.${ext}`;
}

function profileFromUser(user) {
  if (!user) {
    return { nomeCognome: null, societa: null, sede: null, email: null };
  }
  const m = user.user_metadata || {};
  const nome = String(m.nome ?? "").trim();
  const cognome = String(m.cognome ?? "").trim();
  const nomeCognome = [nome, cognome].filter(Boolean).join(" ") || null;
  const societa = String(m.societa ?? "").trim() || null;
  const via = String(m.sede_via ?? "").trim();
  const cap = String(m.sede_cap ?? "").trim();
  const citta = String(m.sede_citta ?? "").trim();
  let sede = null;
  if (via && cap && citta) sede = `${via}, ${cap} ${citta}`;
  else if (via && citta) sede = `${via}, ${citta}`;
  else if (via) sede = via;
  const email = String(user.email ?? "").trim() || null;
  return { nomeCognome, societa, sede, email };
}

function ruoloFromCantiere(cantiere) {
  const ruolo = String(cantiere?.ruolo ?? cantiere?.cse ?? "").trim();
  return ruolo || null;
}

function hasProfileData(profile, ruolo) {
  return !!(profile.nomeCognome || profile.societa || profile.sede || profile.email || ruolo);
}

function buildProfileHtmlBlock(profile, ruolo) {
  if (!hasProfileData(profile, ruolo)) return "";
  const lines = ['<div class="prof">', "<strong>Professionista / Società:</strong><br/>"];
  if (profile.nomeCognome) lines.push(`${escHtml(profile.nomeCognome)}<br/>`);
  if (profile.societa) lines.push(`${escHtml(profile.societa)}<br/>`);
  if (profile.sede) lines.push(`Sede: ${escHtml(profile.sede)}<br/>`);
  if (profile.email) lines.push(`Email: ${escHtml(profile.email)}<br/>`);
  if (ruolo) lines.push(`Ruolo: ${escHtml(ruolo)}`);
  lines.push("</div>");
  return lines.join("");
}

function buildProfileCsvRows(profile, ruolo) {
  if (!hasProfileData(profile, ruolo)) {
    return [
      ["Safety Trader — D.Lgs. 81/2008"],
      ["Report documentale sicurezza"],
      [""],
    ];
  }
  const rows = [
    ["Safety Trader — D.Lgs. 81/2008"],
    ["Report documentale sicurezza"],
    ["Professionista / Società", ""],
  ];
  if (profile.nomeCognome) rows.push([profile.nomeCognome, ""]);
  if (profile.societa) rows.push([profile.societa, ""]);
  if (profile.sede) rows.push(["Sede", profile.sede]);
  if (profile.email) rows.push(["Email", profile.email]);
  if (ruolo) rows.push(["Ruolo", ruolo]);
  rows.push([""]);
  return rows;
}

function checklistStatusLabel(checks) {
  const st = calcStatus(checks || {});
  if (st === "idoneo") return "Completa";
  if (st === "parziale") return "Parziale";
  return "Da completare";
}

function scadenzaStyle(value) {
  if (!value || value === "—") return "";
  if (isExpired(value)) return "color:#991b1b;font-weight:600";
  if (isExpiringSoon(value)) return "color:#92400e;font-weight:600";
  return "color:#065f46;font-weight:600";
}

// ── EXPORT HTML REPORT ────────────────────────────────────────────────────────
export function buildSchediMaestanze(cantiere, imp, user) {
  const oggi = new Date().toLocaleDateString("it-IT");
  const profile = profileFromUser(user);
  const ruolo = ruoloFromCantiere(cantiere);
  const profileHtml = buildProfileHtmlBlock(profile, ruolo);
  const checks = imp.checks || {};
  const checklistLabel = checklistStatusLabel(checks);
  const checklistDone = CHECKLIST_ITEMS.filter(i => checks[i.id] === "si").length;

  const checklistRows = CHECKLIST_ITEMS.map(item => {
    const val = checks[item.id] ? String(checks[item.id]).toUpperCase() : "—";
    return `<tr>
      <td style="padding:6px 8px;font-size:10px">${escHtml(item.label)}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:center;font-weight:600">${escHtml(val)}</td>
    </tr>`;
  }).join("");

  const allegatiRows = ALLEGATI_CONFIG.map(cfg => {
    const presente = !!imp.allegati?.[cfg.key];
    const scadenza = imp.allegatiScadenze?.[cfg.key] || "—";
    return `<tr>
      <td style="padding:6px 8px;font-size:10px">${escHtml(cfg.key)}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:center">${presente ? "Presente" : "Mancante"}</td>
      <td style="padding:6px 8px;font-size:10px;text-align:center;${scadenzaStyle(scadenza)}">${escHtml(scadenza)}</td>
    </tr>`;
  }).join("");

  const mae = (imp.maestranze || [])
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
    .map(m => {
      const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
      const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
      const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
      const idoScad = m.idoneita ? m.idoneita : "—";

      return `<tr>
        <td style="padding:6px 8px;font-size:10px;font-weight:600">${escHtml(m.nome)}</td>
        <td style="padding:6px 8px;font-size:10px">${escHtml(m.qualifica || "—")}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${escHtml(idoScad)}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${m.formazioneBase ? "✓" : "—"}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${scadenzaStyle(fSpecScad)}">${escHtml(fSpecScad)}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${scadenzaStyle(aggScad)}">${escHtml(aggScad)}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center;${scadenzaStyle(prepostoScad)}">${escHtml(prepostoScad)}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${escHtml(m.ponteggiatori ? (m.ponteggiatori === "✓" ? "✓" : m.ponteggiatori) : "—")}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${escHtml(m.antincendio || "—")}</td>
        <td style="padding:6px 8px;font-size:10px;text-align:center">${escHtml(m.ps || "—")}</td>
      </tr>`;
    })
    .join("");

  const noteBlock = imp.note
    ? `<h2>Note CSE</h2><p style="font-size:11px;line-height:1.6;color:#475569;white-space:pre-wrap">${escHtml(imp.note)}</p>`
    : `<h2>Note CSE</h2><p style="font-size:11px;color:#94a3b8">Nessuna nota inserita.</p>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Report documentale — ${escHtml(imp.nome)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 30px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; margin-bottom: 6px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #020617; }
    .prof { font-size: 11px; color: #475569; margin-bottom: 14px; line-height: 1.7; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
    .prof strong { color: #334155; }
    .meta { font-size: 11px; color: #64748b; margin-bottom: 22px; line-height: 1.7; }
    .meta strong { color: #334155; }
    h2 { font-size: 12px; font-weight: 700; margin: 18px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a; }
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
  <div class="brand">Safety Trader · D.Lgs. 81/2008</div>
  <h1>Report documentale sicurezza</h1>
  ${profileHtml}
  <div class="meta">
    <strong>Cantiere:</strong> ${escHtml(cantiere.nome)}<br/>
    <strong>Impresa:</strong> ${escHtml(imp.nome)}<br/>
    <strong>Attività:</strong> ${escHtml(imp.attivita || "—")}<br/>
    <strong>Data generazione report:</strong> ${escHtml(oggi)}<br/>
    <strong>Stato checklist:</strong> ${escHtml(checklistLabel)} (${checklistDone}/${CHECKLIST_ITEMS.length} voci conformi)
  </div>

  <h2>Checklist documentale</h2>
  <table>
    <thead>
      <tr>
        <th>Voce</th>
        <th style="text-align:center">Esito</th>
      </tr>
    </thead>
    <tbody>${checklistRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:15px">Nessuna voce checklist</td></tr>'}</tbody>
  </table>

  <h2>Allegati obbligatori</h2>
  <table>
    <thead>
      <tr>
        <th>Documento</th>
        <th style="text-align:center">Stato</th>
        <th style="text-align:center">Scadenza</th>
      </tr>
    </thead>
    <tbody>${allegatiRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:15px">Nessun allegato registrato</td></tr>'}</tbody>
  </table>

  <h2>Scadenziario maestranze</h2>
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

  ${noteBlock}

  <div class="legend">
    <strong>Legenda scadenze:</strong><br/>
    • Formazione base non scade (Accordo Stato-Regioni 21/12/2011)<br/>
    • Formazione specifica: aggiornamento ogni 5 anni<br/>
    • <span class="expired">Scaduto</span> — <span class="warning">Entro 60 giorni</span> — <span class="valid">Valido</span>
  </div>
</body>
</html>`;
}

// ── EXPORT CSV ────────────────────────────────────────────────────────────────
export function buildCSV(cantiere, imp, user) {
  const e = v => `"${String(v || "").replace(/"/g, '""')}"`;
  const oggi = new Date().toLocaleDateString("it-IT");
  const checks = imp.checks || {};
  const checklistLabel = checklistStatusLabel(checks);
  const profile = profileFromUser(user);
  const ruolo = ruoloFromCantiere(cantiere);

  return [
    ...buildProfileCsvRows(profile, ruolo),
    ["Cantiere", cantiere?.nome || ""],
    ["Impresa", imp.nome],
    ["Attività", imp.attivita || ""],
    ["Data generazione report", oggi],
    ["Stato checklist", checklistLabel],
    [""],
    ["MAESTRANZE AUTORIZZATE"],
    ["Nominativo", "Qualifica", "Idon.", "F.Base", "F.Spec (Scad.)", "Aggiornam. (Scad.)", "Preposto (Scad.)", "Pontegg.", "Antinc.", "P.S."],
    ...(imp.maestranze || []).map(m => {
      const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
      const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
      const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
      return [
        m.nome,
        m.qualifica,
        m.idoneita,
        m.formazioneBase ? "✓" : "—",
        fSpecScad,
        aggScad,
        prepostoScad,
        m.ponteggiatori,
        m.antincendio,
        m.ps,
      ];
    }),
    [""],
    ["NOTE:", "Formazione base non scade. F.Spec e Aggiornamento: ogni 5 anni."],
  ]
    .map(r => r.map(e).join(","))
    .join("\n");
}
