-- Log consumo analisi AI per utente
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_name text,
  document_type text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_eur numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs (user_id);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_usage_logs_select_own" on public.ai_usage_logs;
create policy "ai_usage_logs_select_own"
  on public.ai_usage_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "ai_usage_logs_select_admin" on public.ai_usage_logs;
create policy "ai_usage_logs_select_admin"
  on public.ai_usage_logs
  for select
  using (public.is_admin());

-- Inserimenti solo lato server (service role)
