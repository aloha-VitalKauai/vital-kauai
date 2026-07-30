-- Financials V2 PR 1 — preflight + harden public.is_founder()
-- ARCHITECTURE §2 / D-044. Runs BEFORE any finance object exists.

-- Finding 11 / ARCHITECTURE §15: assert the server version before the first
-- schema mutation. The document claimed PR 1 does this; it did not.
do $$
declare v int := current_setting('server_version_num')::int;
begin
  if v < 150000 then
    raise exception
      'Financials V2 requires PostgreSQL 15+ (NULLS NOT DISTINCT, security_invoker); found %',
      current_setting('server_version');
  end if;
end $$;

-- Verify the function exists with the shape V2 depends on.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_founder'
      and pg_get_function_identity_arguments(p.oid) = ''
      and p.prosecdef
      and pg_get_function_result(p.oid) = 'boolean'
  ) then
    raise exception
      'public.is_founder() not found as SECURITY DEFINER returning boolean (ARCHITECTURE §2)';
  end if;
end $$;

alter function public.is_founder() set search_path = pg_catalog, public;

-- BLOCKER 1: execute it in the SAME transaction. The real production body is
-- not in version control, so asserting its signature proves nothing about
-- whether the body still RESOLVES under the pinned path. If it contains any
-- unqualified reference outside pg_catalog/public — an `extensions` operator,
-- an `auth` helper — every founder RLS policy in the product would break at
-- once. Calling it here turns that into a failed migration that rolls back,
-- instead of a site-wide outage.
do $$
declare ok boolean;
begin
  begin
    select public.is_founder() into ok;
  exception when others then
    raise exception
      'public.is_founder() no longer resolves under search_path=pg_catalog,public: % (%). Migration rolled back; the function is unchanged.',
      sqlerrm, sqlstate;
  end;
  if ok is null then
    raise exception
      'public.is_founder() returned NULL after hardening; expected boolean. Migration rolled back.';
  end if;
end $$;
