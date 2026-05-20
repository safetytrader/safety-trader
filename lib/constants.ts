// ── COSTANTI ──────────────────────────────────────────────────────────────────
export const CHECKLIST_ITEMS = [
  { id:"a1", lettera:"a", label:"Dati identificativi impresa (ragione sociale, DL, sede, tel)", required:true },
  { id:"a2", lettera:"a", label:"Attività e lavorazioni svolte in cantiere (incl. subappalti)", required:true },
  { id:"a3", lettera:"a", label:"Nominativi addetti PS, antincendio, RLS/RLST", required:true },
  { id:"a4", lettera:"a", label:"Nominativo medico competente (ove previsto)", required:false },
  { id:"a5", lettera:"a", label:"Nominativo RSPP", required:true },
  { id:"a6", lettera:"a", label:"Nominativo DTC e capocantiere/preposto", required:true },
  { id:"a7", lettera:"a", label:"Elenco lavoratori con qualifiche (dipendenti e autonomi)", required:true },
  { id:"b1", lettera:"b", label:"Mansioni sicurezza di ogni figura nominata", required:true },
  { id:"c1", lettera:"c", label:"Descrizione attività, modalità organizzative e turni", required:true },
  { id:"d1", lettera:"d", label:"Elenco ponteggi, trabattelli, opere provvisionali", required:false },
  { id:"d2", lettera:"d", label:"Elenco macchine e impianti", required:true },
  { id:"e1", lettera:"e", label:"Elenco sostanze pericolose e schede di sicurezza", required:false },
  { id:"f1", lettera:"f", label:"Valutazione del rumore", required:true },
  { id:"f2", lettera:"f", label:"Valutazione delle vibrazioni", required:true },
  { id:"g1", lettera:"g", label:"Misure preventive/protettive integrative al PSC", required:true },
  { id:"g2", lettera:"g", label:"Pi.M.U.S. (se presenti ponteggi)", required:false },
  { id:"h1", lettera:"h", label:"Procedure complementari richieste dal PSC", required:false },
  { id:"i1", lettera:"i", label:"Elenco DPI forniti ai lavoratori", required:true },
  { id:"l1", lettera:"l", label:"Formazione di base (tutti i lavoratori)", required:true },
  { id:"l2", lettera:"l", label:"Formazione dirigenti e preposti", required:true },
  { id:"l3", lettera:"l", label:"Formazione/addestramento rischi specifici e DPI 3ª cat.", required:true },
  { id:"l4", lettera:"l", label:"Attestati primo soccorso e antincendio", required:true },
];

export const ALLEGATI_CONFIG = [
  { key:"C.I. legale rappresentante", sinonimi:"carta identità, documento identità, CI, passaporto" },
  { key:"D.U.R.C.", sinonimi:"DURC, documento unico regolarità contributiva", scadenza:true, scadenzaNote:"Validità 120 giorni dalla data di emissione" },
  { key:"Visura Camerale (CC.I.AA.)", sinonimi:"visura camerale, visura CCIAA, camera di commercio", scadenza:true, scadenzaNote:"Deve essere emessa entro 6 mesi dalla data di verifica" },
  { key:"D.V.R. (integrale)", sinonimi:"DVR, documento valutazione rischi" },
  { key:"Dichiarazione art. 14 D.Lgs. 81/08", sinonimi:"dichiarazione art 14, dichiarazione assenza provvedimenti sospensione" },
  { key:"D.O.M.A.", sinonimi:"DOMA, dichiarazione organico medio annuo, organico aziendale" },
  { key:"Nomina medico competente", sinonimi:"nomina medico, medico competente, MC" },
  { key:"Nomina RSPP e formazione", sinonimi:"RSPP, responsabile servizio prevenzione protezione" },
  { key:"Nomina addetti Antincendio", sinonimi:"addetti antincendio, nomina antincendio, addetti emergenza" },
  { key:"Nomina addetti Primo Soccorso", sinonimi:"addetti primo soccorso, nomina primo soccorso" },
  { key:"Elenco attrezzature e conformità", sinonimi:"elenco attrezzature, dichiarazioni conformità CE, marcatura CE" },
  { key:"Idoneità sanitaria personale", sinonimi:"idoneità sanitaria, visita medica, certificato idoneità" },
  { key:"Verbali consegna DPI", sinonimi:"DPI, consegna DPI, verbale consegna dispositivi protezione" },
  { key:"UNILAV", sinonimi:"UNILAV, comunicazione assunzione, contratto lavoro" },
  { key:"Nomina RLS e formazione", sinonimi:"RLS, rappresentante lavoratori sicurezza, RLST" },
];

export const ALLEGATI = ALLEGATI_CONFIG.map(a=>a.key);
export const BATCH_SIZE = 8;
export const STATUS_COLORS = { idoneo:"bg-emerald-500", parziale:"bg-amber-400", "non idoneo":"bg-red-500", "da verificare":"bg-slate-400" };
export const BADGE = { idoneo:"bg-emerald-100 text-emerald-700 border border-emerald-300", parziale:"bg-amber-100 text-amber-700 border border-amber-300", "non idoneo":"bg-red-100 text-red-700 border border-red-300", "da verificare":"bg-slate-100 text-slate-500 border border-slate-300" };

// ── REGOLE FORMAZIONE STATO-REGIONI (21/12/2011) ──────────────────────────────────
export const FORMATION_SCADENZA = {
  formazioneBase: null, // Non scade mai
  formazioneSpec: 5, // 5 anni
  aggiornamento: 5, // 5 anni
  preposto: 5, // 5 anni
  ponteggiatori: 5, // Ponteggi: scadenza da data erogazione
  ponteggi: 5,
  antincendio: (gruppo) => {
    if(gruppo==="A") return 3; // Basso rischio
    if(gruppo==="B") return 5; // Medio rischio
    if(gruppo==="C") return 5; // Alto rischio
    return 3;
  },
  ps: (gruppo) => {
    if(gruppo==="A") return 3; // Gruppo A
    return 5; // Gruppo B/C
  },
  confinati: 5,
  mdt: 5,
  ple: 5,
  gruista: 5,
};

export const FORMATION_RULES = `ACCORDO STATO-REGIONI 21/12/2011:
- Formazione BASE: NON HA SCADENZA
- Formazione SPECIFICA: aggiornamento ogni 5 anni
- Preposto: 8h, aggiornamento ogni 5 anni
- Primo soccorso: Gruppo A ogni 3 anni, B/C ogni 5 anni
- Antincendio: basso ogni 5 anni, medio ogni 3, alto ogni 2
- Idoneità sanitaria: scadenza da medico competente`;

export const ALLEGATI_PROMPT = ALLEGATI_CONFIG.map(a=>`"${a.key}" (anche: ${a.sinonimi})`).join("\n");
export const DOC_RULES = `RICONOSCIMENTO DOCUMENTI:
- Pi.M.U.S. / piano montaggio ponteggi → g2=si
- DVR / valutazione rischi → documenta g1
- D.O.M.A. = dichiarazione organico medio annuo (NON registro macchine)
- Dichiarazione art.14 = assenza provvedimenti sospensione
- Attestati/certificati formazione → campi maestranza`;
