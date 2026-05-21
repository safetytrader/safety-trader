/**
 * Tipi base allineati allo stato attuale dell’app (mkImpresa, estrazione batch,
 * checklist, allegati, cantieri in memoria / localStorage).
 * Non collegati ancora ai componenti.
 */

/** File caricato in tab upload; in memoria può includere il riferimento al `File` originale. */
export type UploadedFile = {
  id?: string | null;
  name: string;
  size: number;
  type: string;
  storagePath?: string;
  categoria?: string | null;
  statoAnalisi?: string;
  /** Presente solo in sessione, prima del salvataggio JSON su localStorage */
  _file?: File;
};

/**
 * Valore checklist: dall’UI (“n.a.”) o da `mergeChecks` / JSON estrazione (“na”).
 */
export type ChecklistValue = "si" | "no" | "na" | "n.a.";

/** Mappa id voce checklist (es. a1, b1, …) → valore */
export type ChecksMap = Partial<Record<string, ChecklistValue>>;

/**
 * Presenza allegati per chiave documento (stesse stringhe di `ALLEGATI` / `ALLEGATI_CONFIG`).
 * L’UI può impostare esplicitamente `false` togliendo il flag.
 */
export type AllegatiMap = Record<string, boolean>;

/** Singolo lavoratore in scheda maestranze */
export type Maestranza = {
  nome: string;
  qualifica?: string;
  dpi?: boolean;
  idoneita?: string;
  /** Spesso stringa vuota o valore truthy per “presente” in UI */
  formazioneBase?: string | boolean;
  formazioneSpec?: string;
  aggiornamento?: string;
  preposto?: string;
  ponteggiatori?: string;
  antincendio?: string;
  ps?: string;
  confinati?: string | boolean;
  mdt?: string | boolean;
  ple?: string | boolean;
  gruista?: string | boolean;
  unilav?: string;
};

/** Impresa esecutrice collegata a un cantiere */
export type Impresa = {
  id: number;
  nome: string;
  attivita: string;
  checks: ChecksMap;
  allegati: AllegatiMap;
  /** Da `scadenzaAllegati` nel JSON di estrazione, unito con spread */
  allegatiScadenze: Record<string, string>;
  note: string;
  maestranze: Maestranza[];
  analyzing: boolean;
  analyzed: boolean;
  aiSummary: string;
  uploadedFiles: UploadedFile[];
  extracting: boolean;
  extractLog: string[];
  corsiSpeciali: {
    confinati: boolean;
    mdt: boolean;
    ple: boolean;
    gruista: boolean;
  };
};

/** Cantiere con elenco imprese */
export type Cantiere = {
  id: number;
  nome: string;
  indirizzo: string;
  cse: string;
  dataInizio: string;
  imprese: Impresa[];
};
