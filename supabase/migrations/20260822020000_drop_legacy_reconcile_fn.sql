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
do $guard$
declare bad int;
begin
  select count(*) into bad
  from pg_depend d
  join pg_proc p on p.oid = d.refobjid
  join pg_class c on c.oid = d.objid
  where p.proname = 'fn_reconcile_financial_state';
  if bad > 0 then
    raise exception 'PR9: % database objects still depend on fn_reconcile_financial_state', bad;
  end if;

  select count(*) into bad
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where p.proname = 'fn_reconcile_financial_state';
  if bad > 0 then
    raise exception 'PR9: % triggers still call fn_reconcile_financial_state', bad;
  end if;
end $guard$;

revoke all on function public.fn_reconcile_financial_state() from public, anon, authenticated, service_role;
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

  select count(*) into bad
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and t.tgname ilike '%freeze%' and not t.tgisinternal;
  if bad <> 12 then
    raise exception 'PR9 assert: % freeze triggers present, expected 12', bad;
  end if;

  -- Every freeze trigger must still be armed. 'D' is disabled; anything else
  -- ('O' origin, 'A' always) fires.
  select count(*) into bad
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and t.tgname ilike '%freeze%'
    and not t.tgisinternal and t.tgenabled = 'D';
  if bad > 0 then
    raise exception 'PR9 assert: % freeze triggers are disabled', bad;
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
