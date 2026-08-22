-- PR 9 (D-086): drop the retired public reconciliation function.
--
-- `public.fn_reconcile_financial_state()` recomputed legacy commitment and
-- donation state. Its inputs are frozen and empty, its cron route is gone, and
-- a production catalog check confirmed zero consumers: no trigger, no view, no
-- function and no application caller. It is dropped rather than left dormant so
-- that no future caller can reach the retired model through it.
--
-- Nothing else is touched. The four frozen tables, their twelve VK078 triggers,
-- their revoked grants, the historical migrations and every ledger entry remain
-- exactly as they are — they are forensic evidence, not dead weight.

begin;

-- Re-prove zero consumers INSIDE the transaction. The earlier read-only check
-- is evidence about a moment; this is a condition of the change itself.
--
-- Two classes of consumer are easy to miss and are both covered here:
--   • A VIEW that calls the function is recorded in pg_depend with
--     classid = pg_rewrite and objid = the RULE's oid, not the relation's, so
--     joining objid against pg_class silently finds nothing. The dependency is
--     therefore counted by refclassid/refobjid on the FUNCTION side instead.
--   • A function BODY that calls it is never recorded in pg_depend at all —
--     PostgreSQL does not parse plpgsql or dynamic SQL for dependencies. Only
--     a source scan can see those, so prosrc is searched directly.
do $guard$
declare bad int; who text;
begin
  select count(*) into bad
  from pg_depend d
  join pg_proc p on p.oid = d.refobjid
  where d.refclassid = 'pg_proc'::regclass
    and p.proname = 'fn_reconcile_financial_state'
    and d.deptype <> 'i';
  if bad > 0 then
    raise exception 'PR9: % database objects still depend on fn_reconcile_financial_state', bad;
  end if;

  select count(*), coalesce(string_agg(n.nspname || '.' || p2.proname, ', '), '')
    into bad, who
  from pg_proc p2 join pg_namespace n on n.oid = p2.pronamespace
  where p2.proname <> 'fn_reconcile_financial_state'
    and p2.prosrc ilike '%fn_reconcile_financial_state%';
  if bad > 0 then
    raise exception 'PR9: % function bodies still call fn_reconcile_financial_state: %', bad, who;
  end if;

  select count(*) into bad
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where p.proname = 'fn_reconcile_financial_state';
  if bad > 0 then
    raise exception 'PR9: % triggers still call fn_reconcile_financial_state', bad;
  end if;
end $guard$;

-- Guarded: `drop ... if exists` is deliberately idempotent, and an unguarded
-- REVOKE would raise 42883 and abort the whole transaction on any environment
-- where the function was never created.
do $revoke$
begin
  if to_regprocedure('public.fn_reconcile_financial_state()') is not null then
    execute 'revoke all on function public.fn_reconcile_financial_state() from public, anon, authenticated, service_role';
  end if;
end $revoke$;

drop function if exists public.fn_reconcile_financial_state();

do $assert$
declare bad int;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_reconcile_financial_state'
  ) then
    raise exception 'PR9 assert: fn_reconcile_financial_state survived the drop';
  end if;

  -- The freeze is untouched: four tables, still empty, twelve triggers, no
  -- write grant to any API role.
  select (select count(*) from public.donations)
       + (select count(*) from public.financial_commitments)
       + (select count(*) from public.payment_tokens)
       + (select count(*) from public.payment_allocations)
    into bad;
  if bad <> 0 then
    raise exception 'PR9 assert: retired tables hold % rows', bad;
  end if;

  -- Scoped to the four retired tables: counting every '%freeze%' trigger in
  -- `public` would break the moment an unrelated table gains one.
  select count(*) into bad
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal and t.tgname ilike '%freeze%'
    and c.relname in ('donations','financial_commitments','payment_tokens','payment_allocations');
  if bad <> 12 then
    raise exception 'PR9 assert: % freeze triggers on retired tables, expected 12', bad;
  end if;

  -- Every freeze trigger must fire for ORDINARY writes on the primary. Only
  -- 'O' (origin) and 'A' (always) do. 'D' is disabled and 'R' is replica-only —
  -- a trigger flipped to 'R' looks enabled but leaves the table writable here,
  -- so testing for 'D' alone would accept an effectively unfrozen table.
  select count(*) into bad
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and t.tgname ilike '%freeze%'
    and not t.tgisinternal and t.tgenabled not in ('O', 'A');
  if bad > 0 then
    raise exception 'PR9 assert: % freeze triggers do not fire on the primary', bad;
  end if;

  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('donations','financial_commitments','payment_tokens','payment_allocations')
    and grantee in ('authenticated','anon','service_role')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if bad > 0 then
    raise exception 'PR9 assert: % write grants remain on retired tables', bad;
  end if;

  raise notice 'PR9 RETIREMENT MIGRATION ASSERTIONS PASSED';
end $assert$;

commit;
