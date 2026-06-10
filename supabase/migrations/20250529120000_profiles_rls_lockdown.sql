-- Rimuove trigger e policy update client su profiles (update sensibili solo via API service role)

drop trigger if exists profiles_guard_privileged_fields on public.profiles;
drop function if exists public.profiles_guard_privileged_fields();

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
