-- Riferimenti pagina checklist (Allegato XV)
alter table public.checklist_impresa
  add column if not exists check_refs jsonb default '{}'::jsonb;
