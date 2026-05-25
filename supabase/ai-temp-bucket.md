# Bucket `ai-temp` (analisi AI temporanea)

Creare in Supabase Storage un bucket **privato** `ai-temp`.

Path consigliato: `{userId}/{impresaId}/{timestamp}_{nomefile}.pdf`

Policy Storage (esempio, da adattare al progetto):

- **INSERT**: utente autenticato, path sotto `(auth.uid()::text)/`
- **SELECT**: stesso prefisso
- **DELETE**: stesso prefisso

I file non vanno nella tabella `documents` e vengono rimossi dalla route dopo l'analisi.
