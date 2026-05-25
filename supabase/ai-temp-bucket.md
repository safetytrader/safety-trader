# Bucket `ai-temp` (analisi AI temporanea)

## 1. Crea il bucket

In Supabase Dashboard → **Storage** → **New bucket**:

- Name: `ai-temp` (esatto, con trattino)
- Public: **off** (privato)

## 2. Policy Storage (SQL Editor)

Esegui nel SQL Editor di Supabase (adatta se hai già policy sul bucket):

```sql
-- INSERT: upload solo nel proprio prefisso userId/
CREATE POLICY "ai_temp_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: download solo dal proprio prefisso
CREATE POLICY "ai_temp_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: rimozione solo dal proprio prefisso
CREATE POLICY "ai_temp_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

Path atteso dall'app: `{userId}/{impresaId}/{timestamp}_{nomefile}.pdf`

## 3. Errori comuni

| Messaggio Supabase | Causa |
|--------------------|--------|
| Bucket not found | Bucket non creato o nome diverso da `ai-temp` |
| new row violates row-level security policy | Policy mancanti o path senza prefisso `auth.uid()` |
| unauthorized / JWT expired | Sessione scaduta → rifare login |
| Payload too large | File oltre limite bucket (aumentare in bucket settings) |

I file **non** vanno nella tabella `documents` e vengono rimossi dalla route API dopo l'analisi.
