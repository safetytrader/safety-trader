// @ts-nocheck
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  getCantieriApp,
  replaceMaestranzeImpresa,
  uploadDocumentForImpresa,
  insertDocumentAnalysis,
  updateDocumentStatoAnalisi,
  upsertChecklistImpresa,
  upsertAllegatiImpresa,
} from "@/lib/db";
import {
  applyAiUpdates,
  AI_STATUS,
  detectDocumentType,
  formatAppliedSummary,
  formatSkippedSummary,
} from "@/lib/documentAnalysis";
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
import { DashboardPage } from "@/components/pages/DashboardPage";
import { CantierePage } from "@/components/pages/CantierePage";
import { ImpresaPage } from "@/components/pages/ImpresaPage";
import { emptyMaestranza, MaestranzaFormFields } from "@/components/impresa/MaestranzeTab";

// ── MAIN APP ──────────────────────────────────────────────────────────────────
function isMissingAuthSessionMessage(message) {
  const msg = (message ?? "").toLowerCase();
  return msg.includes("auth session missing") || msg.includes("session missing");
}

function headerUserFromAuth(authUser) {
  if (!authUser) {
    return {
      nome: "",
      cognome: "",
      ruolo: "",
      email: "",
      initials: "ST",
      displayName: "",
      displaySub: "",
    };
  }
  const m = authUser.user_metadata || {};
  const nome = String(m.nome ?? "").trim();
  const cognome = String(m.cognome ?? "").trim();
  const societa = String(m.societa ?? "").trim();
  const email = String(authUser.email ?? "").trim();
  const fullName = [nome, cognome].filter(Boolean).join(" ");
  const displayName = fullName || email || "Utente";
  const displaySub = societa || "";

  let initials = "U";
  if (nome && cognome) initials = `${nome[0]}${cognome[0]}`.toUpperCase();
  else if (nome && nome.length >= 2) initials = nome.slice(0, 2).toUpperCase();
  else if (nome) initials = `${nome[0]}${(cognome[0] || nome[0])}`.toUpperCase();
  else if (cognome && cognome.length >= 2) initials = cognome.slice(0, 2).toUpperCase();
  else if (email) initials = `${email[0]}${email[1] || ""}`.toUpperCase();

  return {
    nome: nome || email.split("@")[0] || "Utente",
    cognome: cognome || "",
    ruolo: displaySub,
    email,
    initials,
    displayName,
    displaySub,
  };
}

export default function App() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [cantieri, setCantieri] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const headerUser = useMemo(() => headerUserFromAuth(authUser), [authUser]);

  const loadCantieriForUser = useCallback(async auth => {
    if (!auth) {
      setCantieri([]);
      return;
    }
    try {
      const data = await getCantieriApp();
      setCantieri(data ?? []);
    } catch (err) {
      const message = err?.message || String(err);
      if (isMissingAuthSessionMessage(message)) {
        setCantieri([]);
      } else {
        console.error("Errore caricamento cantieri:", message);
        setCantieri(loadFromStorage(STORAGE_KEYS.cantieri, []));
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const auth = session?.user ?? null;
      setAuthUser(auth);
      await loadCantieriForUser(auth);
      setAuthChecked(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const auth = session?.user ?? null;
      setAuthUser(auth);
      loadCantieriForUser(auth);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [loadCantieriForUser]);

  useEffect(() => {
    if (authChecked && !authUser) {
      router.replace("/login");
    }
  }, [authChecked, authUser, router]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Errore logout:", err?.message || err);
    }
    setAuthUser(null);
    setCantieri([]);
    router.push("/login");
  }, [router]);
  
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
  const [newMaestranza, setNewMaestranza] = useState(emptyMaestranza());
  const [dragOver, setDragOver] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [aiAnalysisModal, setAiAnalysisModal] = useState(null);
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

  const extractAll = async (cid, iid, newFiles, uploadedFilesOverride) => {
    const imp = getImpresa(cid, iid);
    updateImpresa(cid, iid, { extracting: true, extractLog: ["🚀 Avvio..."] });
    const af = newFiles.map(f => ({ ...f, name: f.name, size: f.size, type: f.type, _file: f._file || f }));
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
    const uploadedFilesFinal = uploadedFilesOverride != null ? uploadedFilesOverride : [...(imp?.uploadedFiles || []), ...af];
    updateImpresa(cid, iid, { extracting: false, extractLog: log, maestranze: am, checks: ac, allegati: aa, allegatiScadenze: as, note: notes.join(" | ") || imp?.note || "", uploadedFiles: uploadedFilesFinal });
  };

  const handleFiles = useCallback(async (cid, iid, fl) => {
    const a = Array.from(fl).filter(f => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (!a.length) return;

    let filesForExtract = a.map(f => ({ name: f.name, size: f.size, type: f.type, _file: f }));

    let uploadedFilesOverride = null;
    try {
      const uploaded = await Promise.all(a.map(file => uploadDocumentForImpresa(iid, file)));
      filesForExtract = uploaded.map((doc, i) => ({ ...doc, _file: a[i] }));
      const imp = getImpresa(cid, iid);
      uploadedFilesOverride = [...(imp?.uploadedFiles || []), ...filesForExtract];
      updateImpresa(cid, iid, { uploadedFiles: uploadedFilesOverride });
    } catch (err) {
      console.error("Errore upload documenti Supabase:", err?.message || err);
    }

    extractAll(cid, iid, filesForExtract, uploadedFilesOverride);
  }, [cantieri]);

  const handleAnalyzeDocument = useCallback(
    async (cid, iid, fileIndex) => {
      const imp = getImpresa(cid, iid);
      if (!imp?.uploadedFiles?.[fileIndex]) return;

      const file = imp.uploadedFiles[fileIndex];
      const files = [...imp.uploadedFiles];
      files[fileIndex] = { ...file, statoAnalisi: AI_STATUS.IN_CORSO };
      updateImpresa(cid, iid, { uploadedFiles: files });

      if (file.id) {
        updateDocumentStatoAnalisi(file.id, AI_STATUS.IN_CORSO).catch(err =>
          console.error("Errore aggiornamento stato documento:", err?.message || err)
        );
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/api/analyze-documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            document_id: file.id ?? null,
            storage_path: file.storagePath ?? null,
            impresa_id: iid,
            cantiere_id: cid,
            file_name: file.name,
            file_type: file.type,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Analisi non riuscita");
        }

        const applied = applyAiUpdates(
          {
            checks: imp.checks || {},
            allegati: imp.allegati || {},
            allegatiScadenze: imp.allegatiScadenze || {},
            maestranze: imp.maestranze || [],
          },
          data.updates || {}
        );

        const filesOk = [...(getImpresa(cid, iid)?.uploadedFiles || files)];
        filesOk[fileIndex] = { ...filesOk[fileIndex], statoAnalisi: AI_STATUS.ANALIZZATO };
        updateImpresa(cid, iid, {
          uploadedFiles: filesOk,
          checks: applied.checks,
          allegati: applied.allegati,
          allegatiScadenze: applied.allegatiScadenze,
          maestranze: applied.maestranze,
        });

        if (file.id) {
          updateDocumentStatoAnalisi(file.id, AI_STATUS.ANALIZZATO).catch(err =>
            console.error("Errore aggiornamento stato documento:", err?.message || err)
          );
        }

        upsertChecklistImpresa(iid, applied.checks, imp.note || "").catch(err =>
          console.error("Errore salvataggio checklist:", err?.message || err)
        );
        upsertAllegatiImpresa(iid, applied.allegati, applied.allegatiScadenze).catch(err =>
          console.error("Errore salvataggio allegati:", err?.message || err)
        );
        replaceMaestranzeImpresa(iid, applied.maestranze).catch(err =>
          console.error("Errore salvataggio maestranze:", err?.message || err)
        );

        insertDocumentAnalysis({
          document_id: file.id ?? null,
          impresa_id: iid,
          cantiere_id: cid,
          status: "completed",
          document_type: data.document_type,
          confidence: data.confidence,
          summary: data.summary,
          extracted_data: data.extracted_data,
          applied_changes: applied.applied_changes,
          skipped_changes: applied.skipped_changes,
          warnings: data.warnings,
        }).catch(err => console.error("Errore salvataggio analisi:", err?.message || err));

        setAiAnalysisModal({
          document_type: data.document_type,
          summary: data.summary,
          extracted_data: data.extracted_data,
          applied_lines: formatAppliedSummary(applied.applied_changes),
          skipped_lines: formatSkippedSummary(applied.skipped_changes),
          warnings: data.warnings || [],
        });
      } catch (err) {
        const filesErr = [...(getImpresa(cid, iid)?.uploadedFiles || files)];
        filesErr[fileIndex] = { ...filesErr[fileIndex], statoAnalisi: AI_STATUS.ERRORE };
        updateImpresa(cid, iid, { uploadedFiles: filesErr });

        if (file.id) {
          updateDocumentStatoAnalisi(file.id, AI_STATUS.ERRORE).catch(e =>
            console.error("Errore aggiornamento stato documento:", e?.message || e)
          );
        }

        insertDocumentAnalysis({
          document_id: file.id ?? null,
          impresa_id: iid,
          cantiere_id: cid,
          status: "failed",
          document_type: detectDocumentType(file.name),
          error_message: err?.message || "Errore analisi",
        }).catch(e => console.error("Errore salvataggio analisi:", e?.message || e));

        setAiAnalysisModal({
          error: true,
          document_type: detectDocumentType(file.name),
          summary: err?.message || "Errore analisi",
          applied_lines: [],
          skipped_lines: [],
          warnings: [],
        });
      }
    },
    [cantieri, updateImpresa]
  );

  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 14,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Caricamento…
      </div>
    );
  }

  if (!authUser) return null;

  // ══ DASHBOARD ═════════════════════════════════════════════════════════════
  if (page === "dashboard") return (
    <>
      <DashboardPage
        cantieri={cantieri}
        setCantieri={setCantieri}
        user={headerUser}
        newCantiere={newCantiere}
        setNewCantiere={setNewCantiere}
        showNewCantiere={showNewCantiere}
        setShowNewCantiere={setShowNewCantiere}
        setActiveCantiere={setActiveCantiere}
        setPage={setPage}
        authUser={authUser}
        onLogout={authUser ? handleLogout : null}
      />
    </>
  );

  // ══ CANTIERE ══════════════════════════════════════════════════════════════
  if (page === "cantiere" && activeCantiere) {
    const c = getCantiere(activeCantiere);
    if (!c) return null;
    return (
      <>
        <CantierePage
          c={c}
          setCantieri={setCantieri}
          user={headerUser}
          authUser={authUser}
          onLogout={authUser ? handleLogout : null}
          setPage={setPage}
          newImpresa={newImpresa}
          setNewImpresa={setNewImpresa}
          showNewImpresa={showNewImpresa}
          setShowNewImpresa={setShowNewImpresa}
          setActiveImpresa={setActiveImpresa}
          setActiveTab={setActiveTab}
        />
      </>
    );
  }

  // ══ IMPRESA ═══════════════════════════════════════════════════════════════
  if (page === "impresa" && activeCantiere && activeImpresa) {
    const c = getCantiere(activeCantiere), imp = getImpresa(activeCantiere, activeImpresa);
    if (!c || !imp) return null;
    return (
      <>
        <ImpresaPage
          c={c}
          imp={imp}
          user={headerUser}
          authUser={authUser}
          onLogout={authUser ? handleLogout : null}
          activeCantiere={activeCantiere}
          activeImpresa={activeImpresa}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setPage={setPage}
          setShowExport={setShowExport}
          showExport={showExport}
          setShowAddMaestra={setShowAddMaestra}
          updateImpresa={updateImpresa}
          handleFiles={handleFiles}
          handleAnalyzeDocument={handleAnalyzeDocument}
          aiAnalysisModal={aiAnalysisModal}
          setAiAnalysisModal={setAiAnalysisModal}
          dragOver={dragOver}
          setDragOver={setDragOver}
          fileRef={fileRef}
          dc={dc}
        />
        {showAddMaestra && <Modal title="Aggiungi maestranza" onClose={() => setShowAddMaestra(false)}><div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1"><MaestranzaFormFields form={newMaestranza} setForm={setNewMaestranza} /><PrimaryButton onClick={() => { const nuovaListaMaestranze = [...imp.maestranze, newMaestranza]; updateImpresa(activeCantiere, activeImpresa, { maestranze: nuovaListaMaestranze }); replaceMaestranzeImpresa(activeImpresa, nuovaListaMaestranze).catch(err => console.error("Errore salvataggio maestranze Supabase:", err?.message || err)); setNewMaestranza(emptyMaestranza()); setShowAddMaestra(false); }}>Aggiungi</PrimaryButton></div></Modal>}
      </>
    );
  }
  return null;
}
