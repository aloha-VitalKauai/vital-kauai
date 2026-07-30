-- LOCAL TEST HARNESS ONLY — NOT a migration, never applied to any Supabase project.
-- Recreates the platform objects Supabase provides (roles, auth schema, auth.uid())
-- and the pre-existing application objects the finance migrations reference.
-- Mirrors production shape only as far as the finance schema depends on it.

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase sets request.jwt.claim.sub; tests set it directly.
create or replace function auth.uid() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text
);

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid null references public.member_profiles(id) on delete set null,
  email      text unique
);
create unique index if not exists uq_members_profile_id
  on public.members (profile_id) where profile_id is not null;

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  name text
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null,
  primary key (user_id, role)
);

-- The pre-existing production definition, verbatim and deliberately WITHOUT a
-- pinned search_path, so migration 0001 has something real to harden.
create or replace function public.is_founder() returns boolean
  language sql stable security definer as $function$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'founder'
  );
$function$;

grant usage on schema public to authenticated, service_role;
grant select on public.members, public.journeys, public.user_roles, public.member_profiles
  to authenticated, service_role;
grant execute on function public.is_founder() to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
