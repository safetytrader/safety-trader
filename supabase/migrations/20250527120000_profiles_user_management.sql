-- Profili utente: ruolo, approvazione, piano e credito API
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nome text default '',
  cognome text default '',
  societa text default '',
  sede_via text default '',
  sede_cap text default '',
  sede_citta text default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  plan text not null default 'free' check (plan in ('free', 'trial', 'paid')),
  api_credit_eur numeric(12, 2) not null default 0 check (api_credit_eur >= 0),
  api_spent_eur numeric(12, 2) not null default 0 check (api_spent_eur >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_plan_idx on public.profiles (plan);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    nome,
    cognome,
    societa,
    sede_via,
    sede_cap,
    sede_citta,
    role,
    status,
    plan,
    api_credit_eur,
    api_spent_eur
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'cognome', ''),
    coalesce(new.raw_user_meta_data ->> 'societa', ''),
    coalesce(new.raw_user_meta_data ->> 'sede_via', ''),
    coalesce(new.raw_user_meta_data ->> 'sede_cap', ''),
    coalesce(new.raw_user_meta_data ->> 'sede_citta', ''),
    'user',
    'pending',
    'free',
    0,
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Utenti già registrati: approvati con piano free (compatibilità)
insert into public.profiles (
  id,
  email,
  nome,
  cognome,
  societa,
  sede_via,
  sede_cap,
  sede_citta,
  role,
  status,
  plan,
  api_credit_eur,
  api_spent_eur
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'nome', ''),
  coalesce(u.raw_user_meta_data ->> 'cognome', ''),
  coalesce(u.raw_user_meta_data ->> 'societa', ''),
  coalesce(u.raw_user_meta_data ->> 'sede_via', ''),
  coalesce(u.raw_user_meta_data ->> 'sede_cap', ''),
  coalesce(u.raw_user_meta_data ->> 'sede_citta', ''),
  'user',
  'approved',
  'free',
  0,
  0
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (
    public.is_admin()
    or (
      auth.uid() = id
      and role = (select p.role from public.profiles p where p.id = auth.uid())
      and status = (select p.status from public.profiles p where p.id = auth.uid())
      and plan = (select p.plan from public.profiles p where p.id = auth.uid())
      and api_credit_eur = (select p.api_credit_eur from public.profiles p where p.id = auth.uid())
      and api_spent_eur = (select p.api_spent_eur from public.profiles p where p.id = auth.uid())
    )
  );

-- Imposta manualmente il primo admin, es.:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
