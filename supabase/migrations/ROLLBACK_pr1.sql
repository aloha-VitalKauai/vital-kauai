-- Financials V2 PR 1 — rollback. NOT a migration; run manually.
-- Restores the exact pre-PR-1 state.
--
-- DROP SCHEMA finance CASCADE alone is INSUFFICIENT: it leaves
-- public.is_founder().proconfig set, so the database would not be returned to
-- its starting state. Both statements are required, in this order.

drop schema if exists finance cascade;

-- Reverts the hardening applied by 20260730000001.
alter function public.is_founder() reset search_path;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'finance') then
    raise exception 'rollback incomplete: finance schema still exists';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='is_founder' and p.proconfig is not null
  ) then
    raise exception 'rollback incomplete: is_founder still carries a pinned search_path';
  end if;
  raise notice 'PR 1 rollback verified: finance dropped, is_founder search_path reset';
end $$;
