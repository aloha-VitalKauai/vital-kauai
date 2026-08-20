-- D-078 freeze — REVERSAL.
--
-- NOT a rollback step. Read this before running it.
--
-- The D-078 rollback procedure is explicitly fix-forward: never roll back to a
-- pre-guard build, never re-enable LEGACY_PAYMENTS_ENABLED in production. This
-- script exists for one narrow case — a founder-authorised operation that must
-- legitimately write a retired table, for example a data-correction exercise
-- that cannot be done in the finance schema.
--
-- It is a separate file, not part of any migration, precisely so that lifting
-- the freeze is a conscious act that someone has to go and find.
--
-- If you are here during an incident: the freeze is almost certainly not your
-- problem. The retired tables are at zero rows and nothing in the product
-- writes them. Lifting the freeze will not restore payment functionality —
-- that is governed by the application guards, and re-enabling those is
-- prohibited.
--
-- RE-FREEZE IMMEDIATELY AFTERWARDS by re-running the migration
-- supabase/migrations/*_freeze_retired_finance_tables.sql, then re-run
-- VERIFY_freeze_retired_finance_tables.sql to confirm the freeze is back.

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'donations',
    'financial_commitments',
    'payment_tokens',
    'payment_allocations'
  ]
  loop
    execute format('drop trigger if exists trg_freeze_%I_rows     on public.%I', t, t);
    execute format('drop trigger if exists trg_freeze_%I_truncate on public.%I', t, t);
  end loop;
end $$;

-- Restore only what the freeze removed. SELECT was never revoked.
grant insert, update, delete on public.donations             to authenticated, service_role;
grant insert, update, delete on public.financial_commitments to authenticated, service_role;
grant insert, update, delete on public.payment_tokens        to authenticated, service_role;
grant insert, update, delete on public.payment_allocations   to authenticated, service_role;

-- NOTE: `anon` and TRUNCATE are deliberately NOT restored. The pre-freeze state
-- granted both, but neither is defensible for a retired finance table, and
-- restoring them would widen access under cover of an "unfreeze".

commit;

-- Confirm what is now true.
select c.relname                              as table_name,
       count(*) filter (where not tg.tgisinternal
                          and tg.tgname like 'trg_freeze_%') as freeze_triggers_remaining
from pg_class c
left join pg_trigger tg on tg.tgrelid = c.oid
where c.relname in ('donations','financial_commitments','payment_tokens','payment_allocations')
group by c.relname
order by c.relname;
