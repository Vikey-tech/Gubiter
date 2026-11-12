-- Schema snapshot of hosted migration create_auth_profiles.
-- The standalone migrations/000001_initial.sql is not for Supabase.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null default '' check (char_length(display_name) <= 80),
 bio text not null default '' check (char_length(bio) <= 500),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, bio), update (username, display_name, bio) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
