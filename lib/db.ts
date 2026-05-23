// @ts-nocheck
import { supabase } from "@/lib/supabaseClient";

function rowToImpresaApp(row) {
  return {
    id: row.id,
    nome: row.nome ?? "",
    attivita: row.attivita ?? "",
    checks: {},
    checkRefs: {},
    allegati: {},
    allegatiScadenze: {},
    note: row.note ?? "",
    maestranze: [],
    uploadedFiles: [],
    extracting: false,
    extractLog: [],
  };
}

function rowToCantiereApp(row, imprese = []) {
  return {
    id: row.id,
    nome: row.nome ?? "",
    indirizzo: row.indirizzo ?? "",
    cse: row.cse ?? "",
    dataInizio: row.data_inizio ?? "",
    imprese,
  };
}

function normalizeChecks(checks) {
  if (!checks) return {};
  if (typeof checks === "string") {
    try {
      const parsed = JSON.parse(checks);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof checks === "object" && !Array.isArray(checks) ? checks : {};
}

function normalizeJsonMap(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeCheckRefs(value) {
  return normalizeJsonMap(value);
}

export async function getChecklistByImpresa(impresaId) {
  if (impresaId == null || impresaId === "") return null;

  const { data, error } = await supabase
    .from("checklist_impresa")
    .select("impresa_id, checks, check_refs, note, updated_at")
    .eq("impresa_id", impresaId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    ...row,
    checks: normalizeChecks(row.checks),
    checkRefs: normalizeCheckRefs(row.check_refs),
  };
}

export async function upsertChecklistImpresa(impresaId, checks, note, checkRefs) {
  if (impresaId == null || impresaId === "") {
    throw new Error("impresa_id mancante");
  }

  const normalizedChecks = normalizeChecks(checks);
  const normalizedCheckRefs = normalizeCheckRefs(checkRefs);
  const payload = {
    impresa_id: impresaId,
    checks: normalizedChecks,
    check_refs: normalizedCheckRefs,
    note: note ?? "",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("checklist_impresa")
    .upsert(
      {
        impresa_id: impresaId,
        checks: normalizedChecks,
        check_refs: normalizedCheckRefs,
        note: note ?? "",
        updated_at: payload.updated_at,
      },
      { onConflict: "impresa_id" }
    );

  if (!error) return;

  const { data: existingRows, error: selectError } = await supabase
    .from("checklist_impresa")
    .select("impresa_id")
    .eq("impresa_id", impresaId)
    .limit(1);

  if (selectError) {
    throw new Error(selectError.message || error.message);
  }

  if (existingRows?.length) {
    const { error: updateError } = await supabase
      .from("checklist_impresa")
      .update({
        checks: normalizedChecks,
        check_refs: normalizedCheckRefs,
        note: note ?? "",
        updated_at: payload.updated_at,
      })
      .eq("impresa_id", impresaId);

    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await supabase.from("checklist_impresa").insert(payload);
  if (insertError) throw new Error(insertError.message);
}

export async function getAllegatiByImpresa(impresaId) {
  if (impresaId == null || impresaId === "") return null;

  const { data, error } = await supabase
    .from("allegati_impresa")
    .select("impresa_id, allegati, allegati_scadenze, updated_at")
    .eq("impresa_id", impresaId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    ...row,
    allegati: normalizeJsonMap(row.allegati),
    allegatiScadenze: normalizeJsonMap(row.allegati_scadenze),
  };
}

export async function upsertAllegatiImpresa(impresaId, allegati, allegatiScadenze) {
  if (impresaId == null || impresaId === "") {
    throw new Error("impresa_id mancante");
  }

  const normalizedAllegati = normalizeJsonMap(allegati);
  const normalizedScadenze = normalizeJsonMap(allegatiScadenze);
  const payload = {
    impresa_id: impresaId,
    allegati: normalizedAllegati,
    allegati_scadenze: normalizedScadenze,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("allegati_impresa")
    .upsert(
      {
        impresa_id: impresaId,
        allegati: normalizedAllegati,
        allegati_scadenze: normalizedScadenze,
        updated_at: payload.updated_at,
      },
      { onConflict: "impresa_id" }
    );

  if (!error) return;

  const { data: existingRows, error: selectError } = await supabase
    .from("allegati_impresa")
    .select("impresa_id")
    .eq("impresa_id", impresaId)
    .limit(1);

  if (selectError) {
    throw new Error(selectError.message || error.message);
  }

  if (existingRows?.length) {
    const { error: updateError } = await supabase
      .from("allegati_impresa")
      .update({
        allegati: normalizedAllegati,
        allegati_scadenze: normalizedScadenze,
        updated_at: payload.updated_at,
      })
      .eq("impresa_id", impresaId);

    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await supabase.from("allegati_impresa").insert(payload);
  if (insertError) throw new Error(insertError.message);
}

function rowToMaestranzaApp(row) {
  const fb = row.formazione_base;
  return {
    nome: row.nome ?? "",
    qualifica: row.qualifica ?? "",
    dpi: row.dpi === true || row.dpi === "true",
    idoneita: row.idoneita ?? "",
    formazioneBase: fb === true || fb === "true" || fb === "✓" || (fb != null && String(fb).trim() !== ""),
    formazioneSpec: row.formazione_spec ?? "",
    preposto: row.preposto ?? "",
    ponteggiatori: row.ponteggiatori ?? "",
    antincendio: row.antincendio ?? "",
    ps: row.ps ?? "",
    confinati: row.confinati ?? "",
    mdt: row.mdt ?? "",
    ple: row.ple ?? "",
    gruista: row.gruista ?? "",
    unilav: row.unilav ?? "",
  };
}

function maestranzaToDb(maestranza, impresaId) {
  const fb = maestranza.formazioneBase;
  return {
    impresa_id: impresaId,
    nome: maestranza.nome ?? "",
    qualifica: maestranza.qualifica ?? "",
    dpi: maestranza.dpi === true || maestranza.dpi === "true",
    idoneita: maestranza.idoneita ?? "",
    formazione_base: fb === true || fb === "true" || fb === "✓" ? "✓" : fb ? String(fb) : "",
    formazione_spec: maestranza.formazioneSpec ?? "",
    preposto: maestranza.preposto ?? "",
    ponteggiatori: maestranza.ponteggiatori ?? "",
    antincendio: maestranza.antincendio ?? "",
    ps: maestranza.ps ?? "",
    confinati: maestranza.confinati ?? "",
    mdt: maestranza.mdt ?? "",
    ple: maestranza.ple ?? "",
    gruista: maestranza.gruista ?? "",
    unilav: maestranza.unilav ?? "",
  };
}

export async function getMaestranzeByImpresa(impresaId) {
  if (impresaId == null || impresaId === "") return [];

  const { data, error } = await supabase
    .from("maestranze")
    .select(
      "nome, qualifica, dpi, idoneita, formazione_base, formazione_spec, preposto, ponteggiatori, antincendio, ps, confinati, mdt, ple, gruista, unilav"
    )
    .eq("impresa_id", impresaId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(rowToMaestranzaApp);
}

export async function replaceMaestranzeImpresa(impresaId, maestranze) {
  if (impresaId == null || impresaId === "") {
    throw new Error("impresa_id mancante");
  }

  const { error: deleteError } = await supabase
    .from("maestranze")
    .delete()
    .eq("impresa_id", impresaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const list = maestranze ?? [];
  if (!list.length) return;

  const rows = list.map(m => maestranzaToDb(m, impresaId));
  const { error: insertError } = await supabase.from("maestranze").insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

function rowToDocumentApp(row) {
  return {
    id: row.id ?? null,
    name: row.nome_file ?? "",
    size: row.dimensione ?? 0,
    type: row.tipo_file ?? "",
    storagePath: row.storage_path ?? "",
    categoria: row.categoria ?? null,
    statoAnalisi: row.stato_analisi ?? "",
  };
}

export async function getDocumentsByImpresa(impresaId) {
  if (impresaId == null || impresaId === "") return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, nome_file, tipo_file, categoria, storage_path, dimensione, stato_analisi")
    .eq("impresa_id", impresaId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(rowToDocumentApp);
}

export async function uploadDocumentForImpresa(impresaId, file) {
  if (impresaId == null || impresaId === "") {
    throw new Error("impresa_id mancante");
  }

  const storagePath = `${impresaId}/${Date.now()}-${file.name}`;

  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (storageError) {
    throw new Error(storageError.message);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      impresa_id: impresaId,
      nome_file: file.name,
      tipo_file: file.type,
      categoria: null,
      storage_path: storagePath,
      dimensione: file.size,
      stato_analisi: "da_analizzare",
    })
    .select("id, nome_file, tipo_file, categoria, storage_path, dimensione, stato_analisi")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToDocumentApp(data);
}

export async function updateDocumentStatoAnalisi(documentId, statoAnalisi) {
  if (documentId == null || documentId === "") return;

  const { error } = await supabase
    .from("documents")
    .update({ stato_analisi: statoAnalisi })
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertDocumentAnalysis(row) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Utente non autenticato");
  }

  const payload = {
    document_id: row.document_id ?? null,
    impresa_id: row.impresa_id ?? null,
    cantiere_id: row.cantiere_id ?? null,
    user_id: user.id,
    status: row.status ?? "completed",
    document_type: row.document_type ?? null,
    confidence: row.confidence ?? null,
    summary: row.summary ?? null,
    extracted_data: row.extracted_data ?? {},
    applied_changes: row.applied_changes ?? {},
    skipped_changes: row.skipped_changes ?? {},
    warnings: row.warnings ?? [],
    error_message: row.error_message ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("document_analysis")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function loadImpresaStateForAi(supabaseClient, impresaId) {
  let checks = {};
  let checkRefs = {};
  let note = "";
  let allegati = {};
  let allegatiScadenze = {};
  let maestranze = [];

  const { data: checklistRows, error: checklistError } = await supabaseClient
    .from("checklist_impresa")
    .select("checks, check_refs, note")
    .eq("impresa_id", impresaId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (checklistError) throw new Error(checklistError.message || "Errore caricamento checklist");
  if (checklistRows?.[0]) {
    checks = normalizeChecks(checklistRows[0].checks);
    checkRefs = normalizeCheckRefs(checklistRows[0].check_refs);
    note = checklistRows[0].note ?? "";
  }

  const { data: allegatiRows, error: allegatiError } = await supabaseClient
    .from("allegati_impresa")
    .select("allegati, allegati_scadenze")
    .eq("impresa_id", impresaId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (allegatiError) throw new Error(allegatiError.message || "Errore caricamento allegati");
  if (allegatiRows?.[0]) {
    allegati = normalizeJsonMap(allegatiRows[0].allegati);
    allegatiScadenze = normalizeJsonMap(allegatiRows[0].allegati_scadenze);
  }

  const { data: maestranzeRows, error: maestranzeError } = await supabaseClient
    .from("maestranze")
    .select(
      "nome, qualifica, dpi, idoneita, formazione_base, formazione_spec, preposto, ponteggiatori, antincendio, ps, confinati, mdt, ple, gruista, unilav"
    )
    .eq("impresa_id", impresaId)
    .order("created_at", { ascending: true });

  if (maestranzeError) throw new Error(maestranzeError.message || "Errore caricamento maestranze");
  maestranze = (maestranzeRows ?? []).map(rowToMaestranzaApp);

  return { checks, checkRefs, note, allegati, allegatiScadenze, maestranze };
}

async function upsertChecklistWithClient(supabaseClient, impresaId, checks, note, checkRefs) {
  const normalizedChecks = normalizeChecks(checks);
  const normalizedCheckRefs = normalizeCheckRefs(checkRefs);
  const updatedAt = new Date().toISOString();
  const { error } = await supabaseClient.from("checklist_impresa").upsert(
    {
      impresa_id: impresaId,
      checks: normalizedChecks,
      check_refs: normalizedCheckRefs,
      note: note ?? "",
      updated_at: updatedAt,
    },
    { onConflict: "impresa_id" }
  );

  if (!error) return;

  const { data: existingRows, error: selectError } = await supabaseClient
    .from("checklist_impresa")
    .select("impresa_id")
    .eq("impresa_id", impresaId)
    .limit(1);

  if (selectError) {
    throw new Error(selectError.message || error.message || "Errore salvataggio checklist");
  }

  if (existingRows?.length) {
    const { error: updateError } = await supabaseClient
      .from("checklist_impresa")
      .update({
        checks: normalizedChecks,
        check_refs: normalizedCheckRefs,
        note: note ?? "",
        updated_at: updatedAt,
      })
      .eq("impresa_id", impresaId);
    if (updateError) {
      throw new Error(updateError.message || "Errore aggiornamento checklist");
    }
    return;
  }

  const { error: insertError } = await supabaseClient.from("checklist_impresa").insert({
    impresa_id: impresaId,
    checks: normalizedChecks,
    check_refs: normalizedCheckRefs,
    note: note ?? "",
    updated_at: updatedAt,
  });
  if (insertError) {
    throw new Error(insertError.message || "Errore inserimento checklist");
  }
}

async function upsertAllegatiWithClient(supabaseClient, impresaId, allegati, allegatiScadenze) {
  const normalizedAllegati = normalizeJsonMap(allegati);
  const normalizedScadenze = normalizeJsonMap(allegatiScadenze);
  const updatedAt = new Date().toISOString();
  const { error } = await supabaseClient.from("allegati_impresa").upsert(
    {
      impresa_id: impresaId,
      allegati: normalizedAllegati,
      allegati_scadenze: normalizedScadenze,
      updated_at: updatedAt,
    },
    { onConflict: "impresa_id" }
  );

  if (!error) return;

  const { data: existingRows, error: selectError } = await supabaseClient
    .from("allegati_impresa")
    .select("impresa_id")
    .eq("impresa_id", impresaId)
    .limit(1);

  if (selectError) throw new Error(selectError.message || error.message);

  if (existingRows?.length) {
    const { error: updateError } = await supabaseClient
      .from("allegati_impresa")
      .update({
        allegati: normalizedAllegati,
        allegati_scadenze: normalizedScadenze,
        updated_at: updatedAt,
      })
      .eq("impresa_id", impresaId);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await supabaseClient.from("allegati_impresa").insert({
    impresa_id: impresaId,
    allegati: normalizedAllegati,
    allegati_scadenze: normalizedScadenze,
    updated_at: updatedAt,
  });
  if (insertError) throw new Error(insertError.message);
}

async function replaceMaestranzeWithClient(supabaseClient, impresaId, maestranze) {
  const { error: deleteError } = await supabaseClient
    .from("maestranze")
    .delete()
    .eq("impresa_id", impresaId);

  if (deleteError) throw new Error(deleteError.message);

  const list = maestranze ?? [];
  if (!list.length) return;

  const rows = list.map(m => maestranzaToDb(m, impresaId));
  const { error: insertError } = await supabaseClient.from("maestranze").insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function persistImpresaStateAfterAi(
  supabaseClient,
  impresaId,
  { checks, checkRefs, note, allegati, allegatiScadenze, maestranze }
) {
  await upsertChecklistWithClient(supabaseClient, impresaId, checks, note, checkRefs);
  await upsertAllegatiWithClient(supabaseClient, impresaId, allegati, allegatiScadenze);
  await replaceMaestranzeWithClient(supabaseClient, impresaId, maestranze);
}

export async function insertDocumentAnalysisServer(supabaseClient, userId, row) {
  const payload = {
    document_id: null,
    impresa_id: row.impresa_id ?? null,
    cantiere_id: row.cantiere_id ?? null,
    user_id: userId,
    status: row.status ?? "completed",
    document_type: row.document_type ?? null,
    confidence: row.confidence ?? null,
    summary: row.summary ?? null,
    extracted_data: row.extracted_data ?? {},
    applied_changes: row.applied_changes ?? {},
    skipped_changes: row.skipped_changes ?? {},
    warnings: row.warnings ?? [],
    error_message: row.error_message ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("document_analysis").insert(payload);
  if (error) throw new Error(error.message || "Errore salvataggio analisi documento");
}

async function impresaWithChecklist(row) {
  const imp = rowToImpresaApp(row);
  try {
    const checklist = await getChecklistByImpresa(row.id);
    if (checklist) {
      imp.checks = checklist.checks;
      imp.checkRefs = checklist.checkRefs ?? {};
      imp.note = checklist.note ?? "";
    }
  } catch (err) {
    console.error("Errore caricamento checklist Supabase:", err?.message || err);
  }
  try {
    const allegatiRow = await getAllegatiByImpresa(row.id);
    if (allegatiRow) {
      imp.allegati = allegatiRow.allegati;
      imp.allegatiScadenze = allegatiRow.allegatiScadenze;
    }
  } catch (err) {
    console.error("Errore caricamento allegati Supabase:", err?.message || err);
  }
  try {
    imp.maestranze = await getMaestranzeByImpresa(row.id);
  } catch (err) {
    console.error("Errore caricamento maestranze Supabase:", err?.message || err);
  }
  try {
    imp.uploadedFiles = await getDocumentsByImpresa(row.id);
  } catch (err) {
    console.error("Errore caricamento documenti Supabase:", err?.message || err);
  }
  return imp;
}

export async function getImpreseByCantiere(cantiereId) {
  const { data, error } = await supabase
    .from("imprese")
    .select("id, nome, attivita, note")
    .eq("cantiere_id", cantiereId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all((data ?? []).map(impresaWithChecklist));
}

export async function createImpresa(cantiereId, impresa) {
  const { data, error } = await supabase
    .from("imprese")
    .insert({
      cantiere_id: cantiereId,
      nome: impresa.nome,
      attivita: impresa.attivita ?? "",
      note: impresa.note ?? "",
    })
    .select("id, nome, attivita, note")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToImpresaApp(data);
}

export async function updateImpresaDb(impresaId, dati, existingImpresa = null) {
  const { data, error } = await supabase
    .from("imprese")
    .update({
      nome: dati.nome,
      attivita: dati.attivita ?? "",
      note: dati.note ?? "",
    })
    .eq("id", impresaId)
    .select("id, nome, attivita, note")
    .single();

  if (error) {
    console.error("Errore aggiornamento impresa:", error.message);
    throw new Error(error.message);
  }

  const updated = await impresaWithChecklist(data);
  if (!existingImpresa) {
    return updated;
  }

  return {
    ...updated,
    extracting: existingImpresa.extracting,
    extractLog: existingImpresa.extractLog,
  };
}

export async function deleteImpresaDb(impresaId) {
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("impresa_id", impresaId);

  if (docsError) {
    console.error("Errore recupero documenti per eliminazione impresa:", docsError.message);
  } else {
    const paths = (docs ?? []).map(d => d.storage_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("documents").remove(paths);
      if (storageError) {
        console.error("Errore cancellazione file Storage (impresa):", storageError.message);
      }
    }
  }

  const { error } = await supabase.from("imprese").delete().eq("id", impresaId);

  if (error) {
    console.error("Errore eliminazione impresa:", error.message);
    throw new Error(error.message);
  }
}

function isMissingAuthSession(error) {
  if (!error) return false;
  if (error.name === "AuthSessionMissingError") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("auth session missing") || msg.includes("session missing");
}

export async function getCantieriApp() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    if (isMissingAuthSession(authError)) return [];
    console.error("Errore caricamento cantieri (auth):", authError.message);
    throw new Error(authError.message);
  }

  const user = authData?.user;
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from("cantieri")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore caricamento cantieri:", error.message);
    throw new Error(error.message);
  }

  const cantieri = data ?? [];
  const withImprese = await Promise.all(
    cantieri.map(async row => {
      const imprese = await getImpreseByCantiere(row.id);
      return rowToCantiereApp(row, imprese);
    })
  );

  return withImprese;
}

export async function createCantiere(cantiere) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Errore creazione cantiere (auth):", authError.message);
    throw new Error(authError.message);
  }

  const user = authData?.user;
  if (!user?.id) {
    console.error("Creazione cantiere: utente non loggato");
    throw new Error("Utente non autenticato");
  }

  const { data, error } = await supabase
    .from("cantieri")
    .insert({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo ?? "",
      cse: cantiere.cse ?? "",
      data_inizio: cantiere.dataInizio ?? "",
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Errore creazione cantiere:", error.message);
    throw new Error(error.message);
  }

  if (!data?.id) {
    console.error("Errore creazione cantiere: risposta Supabase senza id");
    throw new Error("Cantiere non creato");
  }

  return rowToCantiereApp(data, []);
}

export async function updateCantiere(cantiereId, dati) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Errore aggiornamento cantiere (auth):", authError.message);
    throw new Error(authError.message);
  }

  const user = authData?.user;
  if (!user?.id) {
    console.error("Aggiornamento cantiere: utente non loggato");
    throw new Error("Utente non autenticato");
  }

  const { data, error } = await supabase
    .from("cantieri")
    .update({
      nome: dati.nome,
      indirizzo: dati.indirizzo ?? "",
      cse: dati.cse ?? "",
      data_inizio: dati.dataInizio ?? "",
    })
    .eq("id", cantiereId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("Errore aggiornamento cantiere:", error.message);
    throw new Error(error.message);
  }

  if (!data?.id) {
    console.error("Errore aggiornamento cantiere: risposta Supabase senza id");
    throw new Error("Cantiere non aggiornato");
  }

  const imprese = await getImpreseByCantiere(cantiereId);
  return rowToCantiereApp(data, imprese);
}

export async function deleteCantiere(cantiereId) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Errore eliminazione cantiere (auth):", authError.message);
    throw new Error(authError.message);
  }

  const user = authData?.user;
  if (!user?.id) {
    console.error("Eliminazione cantiere: utente non loggato");
    throw new Error("Utente non autenticato");
  }

  const { data: imprese, error: impreseError } = await supabase
    .from("imprese")
    .select("id")
    .eq("cantiere_id", cantiereId);

  if (impreseError) {
    console.error("Errore recupero imprese per eliminazione cantiere:", impreseError.message);
  } else {
    const impresaIds = (imprese ?? []).map(i => i.id).filter(id => id != null && id !== "");
    if (impresaIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("storage_path")
        .in("impresa_id", impresaIds);

      if (docsError) {
        console.error("Errore recupero documenti per eliminazione cantiere:", docsError.message);
      } else {
        const paths = (docs ?? []).map(d => d.storage_path).filter(Boolean);
        if (paths.length > 0) {
          const { error: storageError } = await supabase.storage.from("documents").remove(paths);
          if (storageError) {
            console.error("Errore cancellazione file Storage (cantiere):", storageError.message);
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from("cantieri")
    .delete()
    .eq("id", cantiereId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Errore eliminazione cantiere:", error.message);
    throw new Error(error.message);
  }
}

export async function getCantieri() {
  const { data, error } = await supabase
    .from("cantieri")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createCantiereTest() {
  const { data, error } = await supabase
    .from("cantieri")
    .insert({
      nome: "Cantiere test da Next.js",
      indirizzo: "Via di prova",
      cse: "Test CSE",
      data_inizio: new Date().toLocaleDateString("it-IT"),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}