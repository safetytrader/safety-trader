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

export function buildExportPdfFilename(cantiere, imp) {
  const date = new Date().toISOString().slice(0, 10);
  return `safety-trader_report_${sanitizeExportSlug(cantiere?.nome)}_${sanitizeExportSlug(imp?.nome)}_${date}`;
}

const MAESTRANZE_OPTIONAL_COLS = [
  { key: "preposto", label: "Preposto", scadType: "preposto" },
  { key: "antincendio", label: "Antinc.", scadType: "antincendio" },
  { key: "ps", label: "P.S.", scadType: "ps" },
  { key: "ponteggiatori", label: "Ponteggi", scadType: "ponteggi" },
  { key: "mdt", label: "MMT", scadType: "mdt" },
  { key: "ple", label: "PLE", scadType: "ple" },
  { key: "gruista", label: "Gru", scadType: "gruista" },
  { key: "confinati", label: "Spazi Confinati", scadType: "confinati" },
];

function isBoolChecked(v) {
  return v === true || v === "true" || v === "✓" || v === "si" || v === "Sì";
}

function checklistDisplay(val) {
  if (val == null || val === "") return "N.A.";
  const v = String(val).toLowerCase().trim();
  if (v === "si" || v === "sì") return "SI";
  if (v === "no") return "NO";
  if (v === "n.a." || v === "na" || v === "n/a") return "N.A.";
  return String(val).toUpperCase();
}

function formatMaestranzaCell(val, scadType) {
  if (val == null || String(val).trim() === "") return "—";
  if (scadType) {
    const disp = calcScadenza(val, scadType);
    return disp === "✓" ? "✓" : disp;
  }
  if (isBoolChecked(val)) return "Sì";
  return String(val);
}

function profileDetailFromUser(user) {
  const profile = profileFromUser(user);
  if (!user) return { ...profile, via: null, cap: null, citta: null };
  const m = user.user_metadata || {};
  return {
    ...profile,
    via: String(m.sede_via ?? "").trim() || null,
    cap: String(m.sede_cap ?? "").trim() || null,
    citta: String(m.sede_citta ?? "").trim() || null,
  };
}

function checklistPillHtml(rawVal) {
  const label = checklistDisplay(rawVal);
  let cls = "badge badge-slate";
  if (label === "SI") cls = "badge badge-green";
  else if (label === "NO") cls = "badge badge-red";
  else if (label === "N.A.") cls = "badge badge-blue";
  else if (label.includes("PARZ")) cls = "badge badge-amber";
  return `<span class="${cls}">${escHtml(label)}</span>`;
}

function scadenzaBadgeHtml(value) {
  if (!value || value === "—") return '<span class="badge badge-muted">—</span>';
  const text = String(value);
  if (isExpired(text)) return `<span class="badge badge-red">${escHtml(text)}</span>`;
  if (isExpiringSoon(text)) return `<span class="badge badge-amber">${escHtml(text)}</span>`;
  return `<span class="badge badge-green">${escHtml(text)}</span>`;
}

function allegatoStatoBadge(presente) {
  if (presente) return '<span class="badge badge-green">Presente</span>';
  return '<span class="badge badge-red">Non presente</span>';
}

function pdfFieldItem(label, value) {
  const v = value != null && String(value).trim() !== "" ? String(value) : null;
  if (!v) return "";
  return `<div class="field"><span class="field-label">${escHtml(label)}</span><span class="field-value">${escHtml(v)}</span></div>`;
}

function pdfSintesiItem(label, value) {
  if (value == null || String(value).trim() === "") return "";
  return `<div class="sintesi-item"><span class="sintesi-label">${escHtml(label)}</span><span class="sintesi-value">${escHtml(String(value))}</span></div>`;
}

function countChecklistStats(checks) {
  let si = 0;
  let na = 0;
  let no = 0;
  let other = 0;
  for (const item of CHECKLIST_ITEMS) {
    const raw = checks[item.id];
    const d = checklistDisplay(raw);
    if (d === "SI") si++;
    else if (d === "N.A.") na++;
    else if (d === "NO") no++;
    else other++;
  }
  return { total: CHECKLIST_ITEMS.length, si, na, no, other };
}

function countMaestranzeCritical(maestranze) {
  let n = 0;
  for (const m of maestranze) {
    if (m.idoneita && m.idoneita !== "—" && isExpired(String(m.idoneita))) n++;
    if (m.formazioneSpec) {
      const d = calcScadenza(m.formazioneSpec, "formazioneSpec");
      if (d !== "✓" && isExpired(d)) n++;
    }
    for (const col of MAESTRANZE_OPTIONAL_COLS) {
      if (!m[col.key]) continue;
      const d = calcScadenza(m[col.key], col.scadType);
      if (d !== "✓" && isExpired(d)) n++;
    }
  }
  return n;
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
    ? `<h2>Note</h2><p style="font-size:11px;line-height:1.6;color:#475569;white-space:pre-wrap">${escHtml(imp.note)}</p>`
    : `<h2>Note</h2><p style="font-size:11px;color:#94a3b8">Nessuna nota inserita.</p>`;

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

// ── EXPORT PDF (stampa HTML → Salva come PDF) ─────────────────────────────────
export function buildReportPdfDocument(cantiere, imp, user) {
  const oggi = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const profile = profileDetailFromUser(user);
  const ruolo = ruoloFromCantiere(cantiere);
  const checks = imp.checks || {};
  const docTitle = buildExportPdfFilename(cantiere, imp);

  const checklistStats = countChecklistStats(checks);
  const checklistStatus = checklistStatusLabel(checks);

  const checklistRows = CHECKLIST_ITEMS.map(item =>
    `<tr>
      <td class="col-voce">${escHtml(item.label)}</td>
      <td class="center col-stato">${checklistPillHtml(checks[item.id])}</td>
    </tr>`
  ).join("");

  const checklistNote = imp.note
    ? `<p class="meta"><strong>Note:</strong> ${escHtml(imp.note)}</p>`
    : "";

  const allegatiPresent = ALLEGATI_CONFIG.filter(cfg => !!imp.allegati?.[cfg.key]).length;
  const allegatiMissing = ALLEGATI_CONFIG.length - allegatiPresent;

  const allegatiRows = ALLEGATI_CONFIG.map(cfg => {
    const presente = !!imp.allegati?.[cfg.key];
    const scadenza = imp.allegatiScadenze?.[cfg.key] || "—";
    return `<tr>
      <td class="col-voce">${escHtml(cfg.key)}</td>
      <td class="center col-stato">${allegatoStatoBadge(presente)}</td>
      <td class="center col-scad">${scadenzaBadgeHtml(scadenza)}</td>
    </tr>`;
  }).join("");

  const maestranze = (imp.maestranze || []).slice().sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "")
  );
  const visibleOptional = MAESTRANZE_OPTIONAL_COLS.filter(col =>
    maestranze.some(m => m[col.key] != null && String(m[col.key]).trim() !== "")
  );

  const maeHead = [
    "Nominativo",
    "Qualifica",
    "DPI",
    "Idoneità",
    "F.Base",
    "F.Spec",
    "UNILAV",
    ...visibleOptional.map(c => c.label),
  ]
    .map(h => `<th>${escHtml(h)}</th>`)
    .join("");

  const maeRows = maestranze
    .map(m => {
      const cells = [
        escHtml(m.nome || "—"),
        escHtml(m.qualifica || "—"),
        isBoolChecked(m.dpi) ? "Sì" : "No",
        escHtml(formatMaestranzaCell(m.idoneita)),
        isBoolChecked(m.formazioneBase) ? "Sì" : "No",
        escHtml(formatMaestranzaCell(m.formazioneSpec, "formazioneSpec")),
        escHtml(
          String(m.unilav || "").trim().toUpperCase() === "IND"
            ? "IND"
            : formatMaestranzaCell(m.unilav)
        ),
        ...visibleOptional.map(col =>
          escHtml(formatMaestranzaCell(m[col.key], col.scadType))
        ),
      ];
      return `<tr>${cells.map((c, i) => `<td${i === 0 ? ' class="col-nome"' : ""}>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  const maeColspan = 7 + visibleOptional.length;
  const maeCritical = countMaestranzeCritical(maestranze);

  const kvRow = (label, value) => {
    const v = value != null && String(value).trim() !== "" ? String(value) : null;
    if (!v) return "";
    return `<tr><th>${escHtml(label)}</th><td>${escHtml(v)}</td></tr>`;
  };

  const profileKvRows = [
    kvRow("Nome Cognome", profile.nomeCognome),
    kvRow("Società", profile.societa),
    kvRow(
      "Sede",
      profile.via || profile.cap || profile.citta
        ? [profile.via, profile.cap, profile.citta].filter(Boolean).join(", ")
        : profile.sede
    ),
    kvRow("Email", profile.email),
    kvRow("Ruolo", ruolo),
  ]
    .filter(Boolean)
    .join("");

  const cantiereKvRows = [
    kvRow("Nome cantiere", cantiere?.nome),
    kvRow("Indirizzo", cantiere?.indirizzo),
    kvRow("Data inizio", cantiere?.dataInizio),
    kvRow("Ruolo", ruolo || cantiere?.cse),
  ]
    .filter(Boolean)
    .join("");

  const impresaKvRows = [
    kvRow("Ragione sociale", imp.nome),
    kvRow("Attività svolta", imp.attivita),
    imp.note ? kvRow("Note", imp.note) : "",
  ]
    .filter(Boolean)
    .join("");

  const quadroSintetico = `<table class="tbl sintesi-tbl">
    <caption>Quadro sintetico</caption>
    <tbody>
      <tr>
        <th>Stato checklist</th>
        <td>${escHtml(checklistStatus)}</td>
        <th>Allegati</th>
        <td>${allegatiPresent} presenti · ${allegatiMissing} mancanti</td>
      </tr>
      <tr>
        <th>Maestranze registrate</th>
        <td>${maestranze.length}</td>
        <th>Ruolo</th>
        <td>${escHtml(ruolo || "—")}</td>
      </tr>
    </tbody>
  </table>`;

  const reportHeader = `<div class="hdr">
    <span class="hdr-l">Safety Trader · D.Lgs. 81/2008</span>
    <span class="hdr-c">Report documentale sicurezza</span>
    <span class="hdr-r">${escHtml(oggi)}</span>
  </div>`;

  const maestranzeBlock =
    maestranze.length === 0
      ? '<p class="empty-line">Maestranze: nessuna maestranza registrata.</p>'
      : `<h3 class="blk">Maestranze</h3>
         <p class="meta">${maestranze.length} registrate${maeCritical > 0 ? ` · ${maeCritical} scadenze critiche` : ""}</p>
         <table class="tbl mae-tbl">
           <thead><tr>${maeHead}</tr></thead>
           <tbody>${maeRows}</tbody>
         </table>`;

  const checklistMeta = `${checklistStats.total} voci · ${checklistStats.si} complete · ${checklistStats.na} n.a. · ${checklistStats.no + checklistStats.other} mancanti`;
  const allegatiMeta = `${allegatiPresent} presenti · ${allegatiMissing} non presenti`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(docTitle)}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #111827;
      background: #fff;
    }
    .doc { width: 100%; }
    .page-break {
      page-break-before: always;
      break-before: page;
      height: 0;
      margin: 0;
      padding: 0;
    }
    .hdr {
      display: table;
      width: 100%;
      table-layout: fixed;
      margin: 0 0 8px;
      padding: 0 0 5px;
      border-bottom: 1px solid #d1d5db;
      font-size: 8.5px;
      line-height: 1.2;
    }
    .hdr-l, .hdr-c, .hdr-r { display: table-cell; vertical-align: middle; }
    .hdr-l { font-weight: 700; color: #1e40af; width: 32%; }
    .hdr-c { text-align: center; font-weight: 700; color: #374151; }
    .hdr-r { text-align: right; color: #6b7280; width: 28%; }
    .titolo { margin: 0 0 10px; padding: 0 0 6px; border-bottom: 1px solid #111827; }
    .titolo h1 { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.2; }
    .titolo .sub { margin: 3px 0 0; font-size: 10px; color: #4b5563; }
    .titolo-p2 { margin: 0 0 8px; }
    .titolo-p2 h1 { margin: 0; font-size: 14px; font-weight: 700; }
    .titolo-p2 .sub { margin: 2px 0 0; font-size: 9.5px; color: #6b7280; }
    .blk {
      margin: 8px 0 4px;
      font-size: 11px;
      font-weight: 700;
      color: #111827;
    }
    .meta { margin: 0 0 4px; font-size: 9px; color: #4b5563; }
    .tbl {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 8px;
      font-size: 10px;
    }
    .tbl caption {
      caption-side: top;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #111827;
      padding: 0 0 4px;
    }
    .tbl th, .tbl td {
      border: 1px solid #d1d5db;
      padding: 4px 6px;
      vertical-align: top;
      text-align: left;
    }
    .tbl thead th {
      background: #1e3a5f;
      color: #fff;
      font-weight: 600;
      font-size: 9.5px;
      padding: 5px 6px;
      border-color: #1e3a5f;
    }
    .tbl tbody tr:nth-child(even) td { background: #f9fafb; }
    .kv-tbl th {
      width: 28%;
      background: #f3f4f6;
      font-weight: 600;
      font-size: 9.5px;
      color: #374151;
    }
    .kv-tbl td { font-weight: 600; color: #111827; }
    .sintesi-tbl th {
      width: 22%;
      background: #f3f4f6;
      font-weight: 600;
      font-size: 9px;
      color: #4b5563;
    }
    .sintesi-tbl td { font-weight: 700; font-size: 10px; }
    .col-stato { width: 70px; text-align: center; }
    .col-scad { width: 82px; text-align: center; }
    .center { text-align: center; }
    .mae-tbl { font-size: 9px; table-layout: auto; }
    .mae-tbl th, .mae-tbl td { padding: 3px 5px; white-space: nowrap; }
    .mae-tbl .col-nome { white-space: normal; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: 600;
      line-height: 1.25;
      border: 1px solid transparent;
    }
    .badge-green { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge-red { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .badge-amber { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
    .badge-blue { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .badge-slate { background: #f3f4f6; color: #4b5563; border-color: #e5e7eb; }
    .badge-muted { background: #f9fafb; color: #9ca3af; border-color: #e5e7eb; }
    .nota-finale {
      margin: 10px 0 0;
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      font-size: 9.5px;
      color: #4b5563;
      line-height: 1.4;
    }
    .empty-line {
      margin: 6px 0 0;
      padding: 0;
      font-size: 9.5px;
      color: #6b7280;
      line-height: 1.3;
      max-height: 20px;
    }
    .ftr {
      margin: 8px 0 0;
      padding: 6px 0 0;
      border-top: 1px solid #e5e7eb;
      font-size: 8.5px;
      color: #6b7280;
      text-align: center;
      line-height: 1.4;
    }
    .ftr strong {
      display: block;
      font-size: 9px;
      color: #374151;
      margin-bottom: 2px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; break-before: page; }
      .tbl thead { display: table-header-group; }
    }
    @media screen {
      body { padding: 12mm 10mm; }
      .page-break { margin: 20px 0; border-top: 1px dashed #d1d5db; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <div class="p1">
      ${reportHeader}
      <div class="titolo">
        <h1>Report documentale sicurezza</h1>
        <p class="sub">Riepilogo documentale impresa in cantiere</p>
      </div>

      ${quadroSintetico}

      <h3 class="blk">Professionista / Società</h3>
      <table class="tbl kv-tbl">
        <tbody>${profileKvRows || "<tr><th>—</th><td>Dati profilo non disponibili</td></tr>"}</tbody>
      </table>

      <h3 class="blk">Cantiere</h3>
      <table class="tbl kv-tbl"><tbody>${cantiereKvRows}</tbody></table>

      <h3 class="blk">Impresa</h3>
      <table class="tbl kv-tbl"><tbody>${impresaKvRows}</tbody></table>

      <p class="nota-finale">Il presente report riepiloga lo stato documentale dell'impresa rispetto agli elementi registrati nella piattaforma Safety Trader.</p>
    </div>

    <div class="page-break" aria-hidden="true"></div>

    <div class="p2">
      ${reportHeader}
      <div class="titolo titolo-p2">
        <h1>Dettaglio documentale</h1>
        <p class="sub">${escHtml(cantiere?.nome || "—")} · ${escHtml(imp.nome || "—")}</p>
      </div>

      <h3 class="blk">Checklist</h3>
      <p class="meta">${checklistMeta}</p>
      <table class="tbl">
        <thead><tr><th>Voce</th><th class="col-stato">Stato</th></tr></thead>
        <tbody>${checklistRows}</tbody>
      </table>
      ${checklistNote}

      <h3 class="blk">Allegati</h3>
      <p class="meta">${allegatiMeta}</p>
      <table class="tbl">
        <thead><tr><th>Documento</th><th class="col-stato">Stato</th><th class="col-scad">Scadenza</th></tr></thead>
        <tbody>${allegatiRows}</tbody>
      </table>

      ${maestranzeBlock}

      <div class="ftr">
        <strong>Documento generato da Safety Trader</strong>
        Il report costituisce supporto operativo e non sostituisce le verifiche professionali e gli obblighi previsti dal D.Lgs. 81/2008.
      </div>
    </div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 500);
    });
  </script>
</body>
</html>`;
}

export function openReportPdfPrint(cantiere, imp, user) {
  const html = buildReportPdfDocument(cantiere, imp, user);
  const title = buildExportPdfFilename(cantiere, imp);
  const win = window.open("", "_blank", "width=820,height=1160");
  if (!win) {
    throw new Error(
      "Impossibile aprire la finestra di stampa. Consenti i popup per questo sito."
    );
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.document.title = title;
    win.resizeTo(820, 1160);
  } catch {
    /* ignore */
  }
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
