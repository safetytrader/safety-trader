// @ts-nocheck
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from "@/lib/storage";
import {
  CHECKLIST_ITEMS,
  ALLEGATI_CONFIG,
  ALLEGATI,
  BATCH_SIZE,
  STATUS_COLORS,
  BADGE,
  FORMATION_SCADENZA,
  FORMATION_RULES,
  ALLEGATI_PROMPT,
  DOC_RULES,
} from "@/lib/constants";
import {
  calcStatus,
  normalizeName,
  nameSimilarity,
  mergeWorker,
  deduplicateWorkers,
  calcScadenza,
  parseDate,
  isExpired,
  isExpiringSoon,
  mergeChecks,
  mergeAllegati,
  mkImpresa,
} from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportMenu } from "@/components/export/ExportMenu";

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState({ id: 1, nome: "Demo", cognome: "User", ruolo: "CSE", email: "" });
  const [page, setPage] = useState("dashboard");
  const [cantieri, setCantieri] = useState([]);
  useEffect(() => {
    setCantieri(loadFromStorage(STORAGE_KEYS.cantieri, []));
  }, []);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.cantieri, cantieri);
  }, [cantieri]);
  const [activeCantiere, setActiveCantiere] = useState(null);
  const [activeImpresa, setActiveImpresa] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [showNewCantiere, setShowNewCantiere] = useState(false);
  const [newCantiere, setNewCantiere] = useState({ nome: "", indirizzo: "", cse: "", dataInizio: "" });
  const [showNewImpresa, setShowNewImpresa] = useState(false);
  const [newImpresa, setNewImpresa] = useState({ nome: "", attivita: "" });
  const [showAddMaestra, setShowAddMaestra] = useState(false);
  const [newMaestranza, setNewMaestranza] = useState({
    nome: "", qualifica: "", idoneita: "", formazioneBase: "", formazioneSpec: "", aggiornamento: "",
    preposto: "", ponteggiatori: "", antincendio: "", ps: "", confinati: "", mdt: "", ple: "", gruista: "", unilav: ""
  });
  const [dragOver, setDragOver] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const fileRef = useRef();

  const updateImpresa = useCallback(
    (cid, iid, patch) =>
      setCantieri(prev =>
        prev.map(c =>
          c.id !== cid ? c : { ...c, imprese: c.imprese.map(i => (i.id !== iid ? i : { ...i, ...patch })) }
        )
      ),
    []
  );

  if (!user) return null;

  const getCantiere = id => cantieri.find(c => c.id === id);
  const getImpresa = (cid, iid) => getCantiere(cid)?.imprese.find(i => i.id === iid);

  const dc = (v, t) => {
    if (!v || v === "—") return <span className="text-slate-300">—</span>;
    if (v === "✓") return <span className="text-emerald-600 font-semibold">✓</span>;
    const exp = isExpired(v);
    const soon = isExpiringSoon(v);
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${exp ? "bg-red-100 text-red-700" : soon ? "bg-amber-100 text-amber-700" : "text-slate-700"}`}>
        {v}
      </span>
    );
  };

  const f2b = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  const xJSON = str => {
    let s = str.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const st = s.indexOf("{");
    if (st === -1) throw new Error("Nessun JSON");
    let d = 0, en = -1;
    for (let i = st; i < s.length; i++) {
      if (s[i] === "{") d++;
      else if (s[i] === "}") {
        d--;
        if (d === 0) {
          en = i;
          break;
        }
      }
    }
    if (en === -1) {
      s = s.slice(st).replace(/,\s*$/, "");
      const op = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
      const ob = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
      for (let i = 0; i < op; i++) s += "]";
      for (let i = 0; i < ob; i++) s += "}";
    } else {
      s = s.slice(st, en + 1);
    }
    return JSON.parse(s);
  };

  const batchPrompt = (files, existing, bi, bt) => `CSE esperto D.Lgs. 81/2008. Batch ${bi + 1}/${bt}.\n${FORMATION_RULES}\n${DOC_RULES}\n1. MAESTRANZE (Title Case; già presenti: ${existing || "nessuno"}): nome,qualifica,idoneita,formazioneBase,formazioneSpec,aggiornamento,preposto,ponteggiatori,antincendio,ps,confinati,mdt,ple,gruista,unilav\n2. CHECK-LIST (si/no/na): a1-a7,b1,c1,d1-d2,e1,f1-f2,g1-g2,h1,i1,l1-l4\n3. ALLEGATI presenti (chiavi esatte): ${ALLEGATI.slice(0, 8).join(", ")}\nSOLO JSON: {"maestranze":[],"checks":{},"allegati":[],"scadenzaAllegati":{},"note":""}`;

  const callBatch = async (files, existing, bi, bt) => {
    const blocks = [];
    for (const f of files) {
      const b64 = await f2b(f._file || f);
      if (f.type === "application/pdf")
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
      else if (f.type?.startsWith("image/"))
        blocks.push({ type: "image", source: { type: "base64", media_type: f.type, data: b64 } });
    }
    blocks.push({ type: "text", text: batchPrompt(files, existing, bi, bt) });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: blocks }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return xJSON(data.content?.map(b => b.text || "").join("") || "");
  };

  const extractAll = async (cid, iid, newFiles) => {
    const imp = getImpresa(cid, iid);
    updateImpresa(cid, iid, { extracting: true, extractLog: ["🚀 Avvio..."] });
    const af = newFiles.map(f => ({ name: f.name, size: f.size, type: f.type, _file: f }));
    const batches = [];
    for (let i = 0; i < af.length; i += BATCH_SIZE) batches.push(af.slice(i, i + BATCH_SIZE));
    let am = [...(imp?.maestranze || [])], ac = { ...(imp?.checks || {}) }, aa = { ...(imp?.allegati || {}) }, as = { ...(imp?.allegatiScadenze || {}) };
    let tN = 0, tM = 0, notes = [];
    const log = [`📦 ${af.length} file → ${batches.length} batch`];
    updateImpresa(cid, iid, { extractLog: [...log], extracting: true });

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      log.push(`📂 Batch ${b + 1}/${batches.length}: ${batch.map(f => f.name).join(", ")}`);
      updateImpresa(cid, iid, { extractLog: [...log], extracting: true });
      try {
        const p = await callBatch(batch, am.map(m => m.nome).join(", "), b, batches.length);
        
        // Deduplicazione intelligente
        const before = am.length;
        am = deduplicateWorkers(am, p.maestranze || []);
        const added = am.length - before;
        const merged = (p.maestranze || []).length - added;
        tN += added;
        tM += merged;

        // Auto-calcolo scadenze
        am = am.map(m => ({
          ...m,
          aggiornamento: m.aggiornamento && m.aggiornamento !== "—" ? calcScadenza(m.aggiornamento, "aggiornamento") : m.aggiornamento,
          formazioneSpec: m.formazioneSpec && m.formazioneSpec !== "—" ? calcScadenza(m.formazioneSpec, "formazioneSpec") : m.formazioneSpec,
          preposto: m.preposto && m.preposto !== "—" ? calcScadenza(m.preposto, "preposto") : m.preposto,
        }));

        ac = mergeChecks(ac, p.checks || {});
        const bA = {};
        for (const a of (p.allegati || [])) bA[a] = true;
        aa = mergeAllegati(aa, bA);
        if (p.scadenzaAllegati) as = { ...as, ...p.scadenzaAllegati };
        if (p.note) notes.push(p.note);

        log.push(`  ✅ +${added} lavoratori${merged > 0 ? `, ${merged} uniti` : ""} | ${(p.allegati || []).length} allegati`);
      } catch (err) {
        log.push(`  ❌ Errore: ${err.message}`);
      }
      updateImpresa(cid, iid, { extractLog: [...log], extracting: true });
      if (b < batches.length - 1) await new Promise(r => setTimeout(r, 800));
    }

    log.push(`✅ Fine — 👷 ${tN} nuovi, ${tM} uniti | 📋 ${Object.values(ac).filter(v => v === "si").length}/${CHECKLIST_ITEMS.length} check | 📎 ${Object.keys(aa).filter(k => aa[k]).length}/${ALLEGATI.length} allegati`);
    updateImpresa(cid, iid, { extracting: false, extractLog: log, maestranze: am, checks: ac, allegati: aa, allegatiScadenze: as, note: notes.join(" | ") || imp?.note || "", uploadedFiles: [...(imp?.uploadedFiles || []), ...af] });
  };

  const handleFiles = useCallback((cid, iid, fl) => {
    const a = Array.from(fl).filter(f => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (a.length) extractAll(cid, iid, a);
  }, [cantieri]);

  // ── HEADER ────────────────────────────────────────────────────────────────
  const Hdr = ({ left, right, title, sub }) => (
    <header className="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shadow">
      {left}{left && <div className="w-px h-4 bg-slate-700" />}
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">A</div>
        {title && sub ? <div><div className="font-semibold text-sm">{title}</div><div className="text-xs text-slate-400">{sub}</div></div> : <span className="font-semibold tracking-tight">{title || "Assistente CSE"} <span className="text-slate-400 text-xs font-normal">D.Lgs. 81/2008</span></span>}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-3 ml-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{user.nome[0]}{user.cognome[0]}</div>
          <div className="hidden sm:block leading-tight"><div className="text-xs font-medium">{user.nome} {user.cognome}</div><div className="text-xs text-slate-400">{user.ruolo}</div></div>
        </div>
      </div>
    </header>
  );

  // ══ DASHBOARD ═════════════════════════════════════════════════════════════
  if (page === "dashboard") return (
    <div className="min-h-screen bg-slate-50">
      <Hdr right={<button onClick={() => { setNewCantiere({ nome: "", indirizzo: "", cse: user.ruolo === "CSE" ? `${user.nome} ${user.cognome}` : "", dataInizio: "" }); setShowNewCantiere(true); }} className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition">+ Nuovo cantiere</button>} />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Dashboard Cantieri</h1>
        <p className="text-slate-500 text-sm mb-6">{cantieri.length} cantieri attivi</p>
        {cantieri.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <div className="text-6xl mb-4">🏗️</div>
            <p className="font-semibold text-lg text-slate-600">Nessun cantiere attivo</p>
            <p className="text-sm mt-1 mb-6">Crea il primo cantiere per iniziare la verifica documentale</p>
            <button onClick={() => { setNewCantiere({ nome: "", indirizzo: "", cse: user.ruolo === "CSE" ? `${user.nome} ${user.cognome}` : "", dataInizio: "" }); setShowNewCantiere(true); }} className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition">+ Crea il primo cantiere</button>
          </div>
        ) : (
          <div className="grid gap-4">{cantieri.map(c => {
            const tot = c.imprese.length, idon = c.imprese.filter(i => calcStatus(i.checks) === "idoneo").length;
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={() => { setActiveCantiere(c.id); setPage("cantiere"); }}>
                <div className="flex items-start justify-between"><div><h2 className="font-bold text-slate-800">{c.nome}</h2><p className="text-slate-500 text-sm">{c.indirizzo}</p><p className="text-slate-400 text-xs mt-1">CSE: {c.cse} · Inizio: {c.dataInizio}</p></div><div className="text-right"><div className="text-2xl font-bold text-slate-700">{idon}<span className="text-base text-slate-400">/{tot}</span></div><div className="text-xs text-slate-500">imprese idonee</div></div></div>
                <div className="mt-3 flex gap-1 flex-wrap">{c.imprese.map(i => <div key={i.id} title={i.nome} className={`w-4 h-4 rounded-sm ${STATUS_COLORS[calcStatus(i.checks)]}`} />)}</div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: tot ? `${Math.round(idon / tot * 100)}%` : "0%" }} /></div>
              </div>
            );
          })}</div>
        )}
      </div>
      {showNewCantiere && <Modal title="Nuovo cantiere" onClose={() => setShowNewCantiere(false)}><div className="space-y-3">{[["Nome cantiere", "nome"], ["Indirizzo", "indirizzo"], ["CSE incaricato", "cse"], ["Data inizio", "dataInizio"]].map(([l, k]) => <Field key={k} label={l} value={newCantiere[k]} onChange={v => setNewCantiere(p => ({ ...p, [k]: v }))} />)}<PrimaryButton onClick={() => { setCantieri(p => [...p, { id: Date.now(), ...newCantiere, imprese: [] }]); setShowNewCantiere(false); }}>Crea cantiere</PrimaryButton></div></Modal>}
    </div>
  );

  // ══ CANTIERE ══════════════════════════════════════════════════════════════
  if (page === "cantiere" && activeCantiere) {
    const c = getCantiere(activeCantiere);
    if (!c) return null;
    return (<div className="min-h-screen bg-slate-50">
      <Hdr left={<BackButton onClick={() => setPage("dashboard")} label="Dashboard" />} title={c.nome} sub={c.cse} right={<button onClick={() => setShowNewImpresa(true)} className="bg-blue-500 hover:bg-blue-400 text-white text-sm px-4 py-2 rounded-lg font-medium transition">+ Impresa</button>} />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-3 mb-6">{["idoneo", "parziale", "non idoneo", "da verificare"].map(s => <div key={s} className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm"><div className={`text-2xl font-bold ${s === "idoneo" ? "text-emerald-600" : s === "parziale" ? "text-amber-500" : s === "non idoneo" ? "text-red-500" : "text-slate-400"}`}>{c.imprese.filter(i => calcStatus(i.checks) === s).length}</div><div className="text-xs text-slate-500 capitalize">{s}</div></div>)}</div>
        <div className="space-y-3">{c.imprese.map(imp => {
          const st = calcStatus(imp.checks), done = CHECKLIST_ITEMS.filter(i => i.required && imp.checks[i.id] === "si").length, tot = CHECKLIST_ITEMS.filter(i => i.required).length;
          return (<div key={imp.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition cursor-pointer" onClick={() => { setActiveImpresa(imp.id); setActiveTab("upload"); setPage("impresa"); }}><div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[st]}`} /><div className="flex-1 min-w-0"><div className="font-semibold text-slate-800 text-sm truncate">{imp.nome}</div><div className="text-xs text-slate-500">{imp.attivita}</div></div><div className="flex items-center gap-3">{imp.uploadedFiles?.length > 0 && <span className="text-xs text-slate-400">📎{imp.uploadedFiles.length}</span>}<span className="text-xs text-slate-500">{done}/{tot}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE[st]}`}>{st}</span><span className="text-slate-300">›</span></div></div>);
        })}</div>
        {c.imprese.length === 0 && <EmptyState icon="🏢" title="Nessuna impresa" sub="Aggiungi le imprese esecutrici" />}
      </div>
      {showNewImpresa && <Modal title="Aggiungi impresa" onClose={() => setShowNewImpresa(false)}><div className="space-y-3"><Field label="Ragione sociale" value={newImpresa.nome} onChange={v => setNewImpresa(p => ({ ...p, nome: v }))} /><Field label="Attività svolta" value={newImpresa.attivita} onChange={v => setNewImpresa(p => ({ ...p, attivita: v }))} /><PrimaryButton onClick={() => { setCantieri(prev => prev.map(c => c.id !== activeCantiere ? c : { ...c, imprese: [...c.imprese, { ...mkImpresa(), ...newImpresa }] })); setNewImpresa({ nome: "", attivita: "" }); setShowNewImpresa(false); }}>Aggiungi</PrimaryButton></div></Modal>}
    </div>);
  }

  // ══ IMPRESA ═══════════════════════════════════════════════════════════════
  if (page === "impresa" && activeCantiere && activeImpresa) {
    const c = getCantiere(activeCantiere), imp = getImpresa(activeCantiere, activeImpresa);
    if (!c || !imp) return null;
    const st = calcStatus(imp.checks);
    const TLABELS = { "upload": "📁 Carica", "maestranze": "👥 Maestranze", "check-list": "✅ Check-list", "allegati": "📎 Allegati" };

    return (<div className="min-h-screen bg-slate-50">
      <Hdr left={<BackButton onClick={() => { setShowExport(false); setPage("cantiere"); }} label={c.nome} />} title={imp.nome} sub={imp.attivita}
        right={<div className="flex items-center gap-2"><span className={`text-xs px-2 py-1 rounded-full font-medium ${BADGE[st]}`}>{st}</span><div className="relative"><button onClick={() => setShowExport(v => !v)} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded-lg font-medium transition">⬇ Esporta</button>{showExport && <ExportMenu cantiere={c} imp={imp} onClose={() => setShowExport(false)} />}</div></div>} />
      <div className="bg-white border-b border-slate-100 px-6"><div className="max-w-4xl mx-auto flex overflow-x-auto">{Object.keys(TLABELS).map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition ${activeTab === t ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{TLABELS[t]}</button>)}</div></div>
      <div className="max-w-4xl mx-auto px-6 py-6">

        {activeTab === "upload" && <div className="space-y-4">
          <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(activeCantiere, activeImpresa, e.dataTransfer.files); }} onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={e => handleFiles(activeCantiere, activeImpresa, e.target.files)} />
            <div className="text-4xl mb-3">📂</div><p className="font-semibold text-slate-700">Trascina qui i documenti</p><p className="text-slate-400 text-sm mt-1">oppure clicca per selezionare</p><p className="text-slate-300 text-xs mt-3">PDF · JPEG · PNG — batch da {BATCH_SIZE} file</p>
          </div>
          {(imp.extracting || imp.extractLog?.length > 0) && <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs max-h-64 overflow-y-auto"><div className="text-slate-400 mb-2 font-sans font-semibold uppercase tracking-wider text-xs">Log</div>{imp.extractLog?.map((l, i) => <div key={i} className={`leading-5 ${l.includes("✅") || l.includes("👷") || l.includes("📋") || l.includes("📎") ? "text-emerald-400" : l.includes("❌") ? "text-red-400" : "text-slate-300"}`}>{l}</div>)}{imp.extracting && <div className="flex items-center gap-2 text-slate-400 mt-1"><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />In corso…</div>}</div>}
          {imp.uploadedFiles?.length > 0 && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">File caricati ({imp.uploadedFiles.length})</span>{!imp.extracting && <button onClick={() => updateImpresa(activeCantiere, activeImpresa, { uploadedFiles: [], checks: {}, allegati: {}, allegatiScadenze: {}, maestranze: [], extractLog: [], note: "", analyzed: false, aiSummary: "" })} className="text-xs text-red-400 hover:underline">Cancella tutto</button>}</div><div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">{imp.uploadedFiles.map((f, i) => <div key={i} className="px-5 py-2 flex items-center gap-3"><span>{f.type === "application/pdf" ? "📄" : "🖼️"}</span><div className="flex-1 min-w-0"><div className="text-sm text-slate-700 truncate">{f.name}</div><div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div></div></div>)}</div></div>}
          {!imp.uploadedFiles?.length && !imp.extractLog?.length && <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700"><strong>Come funziona:</strong> carica tutti i PDF e immagini ricevuti. Vengono elaborati in batch: maestranze e check-list estratti automaticamente con scadenze generate automaticamente. Usa poi <strong>Esporta</strong> per scaricare la scheda maestranze.</div>}
        </div>}

        {activeTab === "maestranze" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">Maestranze Autorizzate ({imp.maestranze.length})</span><button onClick={() => setShowAddMaestra(true)} className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-400 transition font-medium">+ Aggiungi</button></div>{imp.maestranze.length === 0 ? <div className="text-center py-12 text-slate-400"><div className="text-3xl mb-2">👷</div><p className="text-sm">Carica i documenti per estrarre le maestranze</p><button onClick={() => setActiveTab("upload")} className="mt-2 text-xs text-blue-500 hover:underline">→ Carica Documenti</button></div> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-500 font-semibold">{["Nominativo", "Qualifica", "Idon.", "F.Base", "F.Spec (Scad.)", "Aggiornam. (Scad.)", "Preposto (Scad.)", "Pontegg.", "Antinc.", "P.S.", ""].map((h, i) => <th key={i} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">{imp.maestranze.map((m, i) => {
          const fSpecScad = m.formazioneSpec ? calcScadenza(m.formazioneSpec, "formazioneSpec") : "—";
          const aggScad = m.aggiornamento ? calcScadenza(m.aggiornamento, "aggiornamento") : "—";
          const prepostoScad = m.preposto ? calcScadenza(m.preposto, "preposto") : "—";
          return (<tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{m.nome}</td><td className="px-3 py-2.5 text-slate-600 max-w-24 truncate">{m.qualifica}</td><td className="px-3 py-2.5 text-center">{dc(m.idoneita)}</td><td className="px-3 py-2.5 text-center">{m.formazioneBase ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{dc(fSpecScad)}</td><td className="px-3 py-2.5 text-center">{dc(aggScad)}</td><td className="px-3 py-2.5 text-center">{dc(prepostoScad)}</td><td className="px-3 py-2.5 text-center">{m.ponteggiatori ? (m.ponteggiatori === "✓" ? <span className="text-emerald-600 font-semibold">✓</span> : m.ponteggiatori) : <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{m.antincendio || <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5 text-center">{m.ps || <span className="text-slate-300">—</span>}</td><td className="px-3 py-2.5"><button onClick={() => updateImpresa(activeCantiere, activeImpresa, { maestranze: imp.maestranze.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-red-400">✕</button></td></tr>);
        })}</tbody></table></div>}<div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500"><span>* F. base non scade (Acc. Stato-Regioni 21/12/2011)</span><span className="flex items-center gap-1"><span className="px-1 bg-red-100 text-red-700 rounded">scaduto</span></span><span className="flex items-center gap-1"><span className="px-1 bg-amber-100 text-amber-700 rounded">entro 60gg</span></span></div></div>}

        {activeTab === "check-list" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-slate-700 text-sm">Check-list POS — Allegato XV D.Lgs. 81/2008</span><span className="text-xs text-slate-400">{CHECKLIST_ITEMS.filter(i => imp.checks[i.id] === "si").length}/{CHECKLIST_ITEMS.length}</span></div>{["a", "b", "c", "d", "e", "f", "g", "h", "i", "l"].map(l => {
          const items = CHECKLIST_ITEMS.filter(i => i.lettera === l);
          if (!items.length) return null;
          return (<div key={l}><div className="px-5 py-2 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">Lettera {l}</div>{items.map(item => <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 border-b border-slate-50"><div className="flex gap-1.5 mt-0.5 flex-shrink-0">{["si", "no", "n.a."].map(v => <button key={v} onClick={() => updateImpresa(activeCantiere, activeImpresa, { checks: { ...imp.checks, [item.id]: v } })} className={`text-xs px-1.5 py-0.5 rounded font-medium border transition ${imp.checks[item.id] === v ? (v === "si" ? "bg-emerald-500 text-white border-emerald-500" : v === "no" ? "bg-red-500 text-white border-red-500" : "bg-slate-400 text-white border-slate-400") : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"}`}>{v.toUpperCase()}</button>)}</div><span className="text-sm text-slate-700 leading-snug">{item.label}{item.required && <span className="ml-1 text-slate-300 text-xs">*</span>}</span></div>)}</div>);
        })}<div className="px-5 py-3 border-t border-slate-100"><label className="text-xs font-medium text-slate-600 block mb-1">Note CSE</label><textarea value={imp.note} onChange={e => updateImpresa(activeCantiere, activeImpresa, { note: e.target.value })} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Carenze, integrazioni richieste…" /></div></div>}

        {activeTab === "allegati" && <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"><div className="px-5 py-3 border-b border-slate-100"><span className="font-semibold text-slate-700 text-sm">Allegati obbligatori</span></div>{ALLEGATI_CONFIG.map(cfg => {
          const presente = !!imp.allegati[cfg.key];
          return (<div key={cfg.key} className="px-5 py-3 border-b border-slate-50 hover:bg-slate-50"><div className="flex items-center gap-3"><button onClick={() => updateImpresa(activeCantiere, activeImpresa, { allegati: { ...imp.allegati, [cfg.key]: !presente } })} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${presente ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-emerald-400"}`}>{presente && <span className="text-xs">✓</span>}</button><span className="text-sm text-slate-700 flex-1">{cfg.key}</span></div></div>);
        })}</div>}

      </div>
      {showAddMaestra && <Modal title="Aggiungi maestranza" onClose={() => setShowAddMaestra(false)}><div className="space-y-3">{[["Nominativo", "nome"], ["Qualifica", "qualifica"], ["Idoneità sanitaria (gg/mm/aa)", "idoneita"], ["Formazione base", "formazioneBase"], ["Formazione specifica (gg/mm/aa)", "formazioneSpec"], ["Aggiornamento (gg/mm/aa)", "aggiornamento"], ["Preposto (gg/mm/aa)", "preposto"]].map(([l, k]) => <Field key={k} label={l} value={newMaestranza[k]} onChange={v => setNewMaestranza(p => ({ ...p, [k]: v }))} />)}<PrimaryButton onClick={() => { updateImpresa(activeCantiere, activeImpresa, { maestranze: [...imp.maestranze, newMaestranza] }); setNewMaestranza({ nome: "", qualifica: "", idoneita: "", formazioneBase: "", formazioneSpec: "", aggiornamento: "", preposto: "", ponteggiatori: "", antincendio: "", ps: "", confinati: "", mdt: "", ple: "", gruista: "", unilav: "" }); setShowAddMaestra(false); }}>Aggiungi</PrimaryButton></div></Modal>}
    </div>);
  }
  return null;
}
