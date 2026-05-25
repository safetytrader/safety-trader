/** Limite upload diretto verso la route Vercel (body serverless). */
export const MAX_DIRECT_FILE_BYTES = 3 * 1024 * 1024;

/** Testo inviato in JSON (client → route) per analisi veloce. */
export const MAX_EXTRACTED_TEXT_CHARS = 12000;

/** Testo page-based per riferimenti pagina POS (non troncare a 12k). */
export const MAX_POS_REF_TEXT_CHARS = 50000;

/** Voci checklist per gruppo nella seconda analisi POS. */
export const POS_REF_GROUP_SIZE = 6;

export const MIN_CLIENT_TEXT_CHARS = 300;

export const MAX_PDF_PAGES_CLIENT = 60;

export const LARGE_OR_NON_TEXTUAL_MSG =
  "Il documento è troppo grande o non testuale. Per analizzarlo, usa una versione PDF testuale o riduci il file.";

export const DIRECT_FILE_TOO_LARGE_MSG =
  "Documento troppo grande per l'analisi diretta. Usa un PDF testuale o riduci la dimensione del file.";
