-- Impedisce agli utenti normali di modificare role/status/plan/credito via client
create or replace function public.profiles_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.plan is distinct from old.plan
      or new.api_credit_eur is distinct from old.api_credit_eur
      or new.api_spent_eur is distinct from old.api_spent_eur
    then
      raise exception 'Modifica non consentita su campi account protetti';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_fields on public.profiles;
create trigger profiles_guard_privileged_fields
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_fields();
