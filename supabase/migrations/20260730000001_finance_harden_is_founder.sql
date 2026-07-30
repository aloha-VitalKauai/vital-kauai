-- Financials V2 PR 1 — harden public.is_founder()
--
-- ARCHITECTURE §2 / D-044. Executed BEFORE any finance policy depends on it.
-- §9 requires a fixed search_path on every SECURITY DEFINER function V2 relies
-- on; exempting the one function every founder policy calls would make that
-- rule decorative.
--
-- The body already schema-qualifies public.user_roles and auth.uid(), so
-- search_path cannot redirect those relations. The residual concerns are
-- unqualified operator resolution inside a SECURITY DEFINER context, and the
-- absence of protection against a future edit adding an unqualified reference.

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_founder'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    raise exception
      'public.is_founder() not found: Financials V2 requires it (ARCHITECTURE §2)';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_founder'
      and p.prosecdef
      and pg_get_function_result(p.oid) = 'boolean'
  ) then
    raise exception
      'public.is_founder() must be SECURITY DEFINER returning boolean';
  end if;
end $$;

alter function public.is_founder() set search_path = pg_catalog, public;
