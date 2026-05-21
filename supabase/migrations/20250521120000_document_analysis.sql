-- Tabella storico analisi AI documenti
create table if not exists public.document_analysis (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  impresa_id uuid,
  cantiere_id uuid,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'completed',
  document_type text,
  confidence numeric,
  summary text,
  extracted_data jsonb default '{}'::jsonb,
  applied_changes jsonb default '{}'::jsonb,
  skipped_changes jsonb default '{}'::jsonb,
  warnings jsonb default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_analysis_user_id_idx on public.document_analysis (user_id);
create index if not exists document_analysis_document_id_idx on public.document_analysis (document_id);
create index if not exists document_analysis_impresa_id_idx on public.document_analysis (impresa_id);

alter table public.document_analysis enable row level security;

drop policy if exists "document_analysis_select_own" on public.document_analysis;
create policy "document_analysis_select_own"
  on public.document_analysis
  for select
  using (auth.uid() = user_id);

drop policy if exists "document_analysis_insert_own" on public.document_analysis;
create policy "document_analysis_insert_own"
  on public.document_analysis
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "document_analysis_update_own" on public.document_analysis;
create policy "document_analysis_update_own"
  on public.document_analysis
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Aggiorna stato analisi sui documenti (se la colonna esiste già)
comment on column public.documents.stato_analisi is 'da_analizzare | analisi_in_corso | analizzato | errore_analisi | caricato';
