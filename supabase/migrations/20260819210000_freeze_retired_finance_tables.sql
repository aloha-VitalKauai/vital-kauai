-- D-078 follow-up: database-level freeze on the retired legacy finance tables.
--
-- WHY THIS EXISTS
--
-- The application-level shutdown (D-078) guards all 18 known writers. Seven
-- rounds of adversarial review confirmed the guards hold, but every round also
-- confirmed the same structural limitation: the writer inventory is a STATIC
-- analyser, and a static analyser only catches what its patterns match. Reviews
-- defeated earlier versions with computed member access (`db["from"](...)`),
-- arrow-function handlers, re-export aliases and a destructured `.from`. Each
-- was fixed, but the class of problem cannot be closed by more patterns.
--
-- This freeze closes it at the only layer that does not depend on reading
-- source code: Postgres itself. After this, a write to a retired table fails
-- even if it comes from a route nobody inventoried, a dashboard SQL editor
-- session, a future dependency, or a service_role client that bypasses RLS.
--
-- WHAT IS FROZEN
--
--   public.donations
--   public.financial_commitments
--   public.payment_tokens
--   public.payment_allocations
--
-- All four are at ZERO rows and are superseded by the `finance` schema
-- (Financials V2). Nothing in the product is expected to write them again.
--
-- READS ARE UNAFFECTED. SELECT grants are deliberately left in place: the
-- founder dashboard still reads these tables, and a freeze that broke reads
-- would be a regression, not a safeguard.
--
-- TWO INDEPENDENT MECHANISMS
--
--   1. REVOKE of INSERT/UPDATE/DELETE/TRUNCATE from anon, authenticated and
--      service_role. This stops the ordinary API paths.
--   2. A trigger that RAISEs on every write. This is the load-bearing one:
--      grants do not constrain the table OWNER, and `service_role` is widely
--      used by server code, so privilege alone is not sufficient. The trigger
--      fires regardless of role.
--
-- Mechanism 2 is why this is a freeze rather than a permission tweak.
--
-- HOW TO UNFREEZE (deliberately simple, deliberately explicit)
--
--   See supabase/verify/UNFREEZE_retired_finance_tables.sql. Reversing this is
--   a conscious, reviewable act — which is the point. It is not something a
--   code change can do by accident.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The refusal
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_legacy_finance_frozen()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'D-078: %.% is frozen. Legacy finance tables are retired and accept no writes (attempted %).',
      tg_table_schema, tg_table_name, tg_op
    using
      errcode = 'VK078',
      hint    = 'Financials V2 owns finance data; use the finance schema. To lift this deliberately, see supabase/verify/UNFREEZE_retired_finance_tables.sql.';
end;
$$;

comment on function public.tg_legacy_finance_frozen() is
  'D-078: raises on any write to a retired legacy finance table. Fires for every role, including service_role and the table owner, so it holds where RLS and grants do not.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Attach to each retired table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Row-level trigger covers INSERT/UPDATE/DELETE. TRUNCATE is not a row-level
-- event, so it needs its own statement-level trigger — without it, TRUNCATE
-- would sail straight past the freeze.
--
-- ENABLE ALWAYS makes the triggers fire even when session_replication_role is
-- set to 'replica', which is how bulk-load and replication tooling routinely
-- suppresses ordinary triggers.

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
    execute format('drop trigger if exists trg_freeze_%I_rows on public.%I', t, t);
    execute format(
      'create trigger trg_freeze_%I_rows
         before insert or update or delete on public.%I
         for each row execute function public.tg_legacy_finance_frozen()', t, t);
    execute format('alter table public.%I enable always trigger trg_freeze_%I_rows', t, t);

    execute format('drop trigger if exists trg_freeze_%I_truncate on public.%I', t, t);
    execute format(
      'create trigger trg_freeze_%I_truncate
         before truncate on public.%I
         for each statement execute function public.tg_legacy_finance_frozen()', t, t);
    execute format('alter table public.%I enable always trigger trg_freeze_%I_truncate', t, t);

    -- Statement-level INSERT/UPDATE/DELETE.
    --
    -- Necessary, not belt-and-braces. A FOR EACH ROW trigger fires once per
    -- AFFECTED row, so against an empty table an UPDATE or DELETE affects zero
    -- rows, fires nothing, and reports success. Verification caught exactly that:
    -- 7 of 16 write attempts were silent no-ops rather than refusals.
    --
    -- The freeze was still effective (INSERT is blocked, so rows can never
    -- appear, so UPDATE/DELETE stay no-ops) but that is a chain of reasoning
    -- rather than an outright refusal. These make it unconditional: the ATTEMPT
    -- is refused regardless of row count.
    execute format('drop trigger if exists trg_freeze_%I_stmt on public.%I', t, t);
    execute format(
      'create trigger trg_freeze_%I_stmt
         before insert or update or delete on public.%I
         for each statement execute function public.tg_legacy_finance_frozen()', t, t);
    execute format('alter table public.%I enable always trigger trg_freeze_%I_stmt', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Remove the write privileges as well
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Defence in depth. The trigger is what actually enforces the freeze; this
-- makes the intent visible in the privilege model and stops the API roles
-- before they ever reach the trigger. SELECT is intentionally untouched.

revoke insert, update, delete, truncate on public.donations             from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.financial_commitments from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.payment_tokens        from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.payment_allocations   from anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Prove it took effect, in the same transaction that applied it
-- ─────────────────────────────────────────────────────────────────────────────
--
-- If any assertion below fails the whole migration rolls back, so the freeze is
-- never left half-applied. This checks structure; supabase/verify/ checks
-- behaviour by attempting real writes.

do $$
declare
  n_row_triggers  int;
  n_trunc_triggers int;
  n_stmt_triggers int;
  n_write_grants  int;
begin
  select count(*) into n_row_triggers
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where not tg.tgisinternal
     and tg.tgname like 'trg_freeze_%_rows'
     and c.relname in ('donations','financial_commitments','payment_tokens','payment_allocations');

  select count(*) into n_trunc_triggers
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where not tg.tgisinternal
     and tg.tgname like 'trg_freeze_%_truncate'
     and c.relname in ('donations','financial_commitments','payment_tokens','payment_allocations');

  select count(*) into n_stmt_triggers
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where not tg.tgisinternal
     and tg.tgname like 'trg_freeze_%_stmt'
     and c.relname in ('donations','financial_commitments','payment_tokens','payment_allocations');

  select count(*) into n_write_grants
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('donations','financial_commitments','payment_tokens','payment_allocations')
     and grantee in ('anon','authenticated','service_role')
     and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');

  if n_row_triggers <> 4 then
    raise exception 'freeze incomplete: expected 4 row triggers, found %', n_row_triggers;
  end if;
  if n_trunc_triggers <> 4 then
    raise exception 'freeze incomplete: expected 4 truncate triggers, found %', n_trunc_triggers;
  end if;
  if n_stmt_triggers <> 4 then
    raise exception 'freeze incomplete: expected 4 statement triggers, found %', n_stmt_triggers;
  end if;
  if n_write_grants <> 0 then
    raise exception 'freeze incomplete: % write grants remain on retired tables', n_write_grants;
  end if;
end $$;
