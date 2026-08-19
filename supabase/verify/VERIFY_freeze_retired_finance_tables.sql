-- D-078 freeze — BEHAVIOURAL verification.
--
-- The migration asserts its own structure (triggers exist, grants gone). This
-- script asserts BEHAVIOUR: it attempts a real write of every kind against every
-- frozen table and requires each one to fail with the expected error.
--
-- That distinction matters here more than usual. The whole D-078 exercise began
-- with tests that inspected source instead of running it, and seven review
-- rounds kept finding gaps that only real execution exposed. A freeze that is
-- "present" but not "effective" would be the same mistake in a new place.
--
-- SAFE TO RUN AGAINST PRODUCTION. Every write is wrapped in a savepoint and
-- rolled back, and every write is EXPECTED to fail. If the freeze is working,
-- this script changes nothing. If a write unexpectedly SUCCEEDS, the script
-- rolls it back and then raises.
--
-- Run:  psql "$DATABASE_URL" -f supabase/verify/VERIFY_freeze_retired_finance_tables.sql
--   or paste into the Supabase SQL editor.

do $$
declare
  t            text;
  tables       text[] := array['donations','financial_commitments','payment_tokens','payment_allocations'];
  ops          text[] := array['INSERT','UPDATE','DELETE','TRUNCATE'];
  op           text;
  col          text;
  stmt         text;
  passed       int := 0;
  failed       int := 0;
  failures     text := '';
  n_rows       bigint;
  got_sqlstate text;
begin
  raise notice '=== D-078 freeze verification ===';

  -- ── 1. every frozen table must still be readable ──────────────────────────
  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n_rows;
    raise notice 'READ  %-24s OK (% rows)', t, n_rows;
    passed := passed + 1;
    if n_rows <> 0 then
      failed := failed + 1;
      failures := failures || format(E'\n  %s holds %s rows; expected 0', t, n_rows);
    end if;
  end loop;

  -- ── 2. every write must be refused ────────────────────────────────────────
  foreach t in array tables loop

    -- payment_tokens is keyed on `token`, not `id`. Hardcoding `id` raised
    -- 42703 (undefined_column) and was misread as a failure, so pick a column
    -- that actually exists on each table.
    select column_name into col from information_schema.columns
     where table_schema='public' and table_name=t order by ordinal_position limit 1;

    foreach op in array ops loop

      -- TRUNCATE must be CASCADE. donations and financial_commitments are
      -- FK-referenced (1 and 2 inbound FKs), so a plain TRUNCATE raises 0A000
      -- from the FK check BEFORE the freeze trigger is reached — a real refusal,
      -- but it never exercises the trigger. CASCADE clears that objection so the
      -- freeze itself is what has to refuse.
      stmt := case op
        when 'INSERT'   then format('insert into public.%I default values', t)
        when 'UPDATE'   then format('update public.%I set %I = %I', t, col, col)
        when 'DELETE'   then format('delete from public.%I', t)
        when 'TRUNCATE' then format('truncate public.%I cascade', t)
      end;

      begin
        -- Savepoint so an unexpectedly-successful write cannot persist.
        begin
          execute stmt;

          -- Reaching here means the freeze did NOT stop it.
          failed := failed + 1;
          failures := failures || format(E'\n  %s on %s SUCCEEDED — freeze is not effective', op, t);
          raise notice 'WRITE %-6s %-24s *** NOT BLOCKED ***', op, t;
          raise exception using errcode = 'VK999';  -- force rollback of this savepoint

        exception
          when sqlstate 'VK999' then
            null;                                   -- our own rollback signal
          when others then
            got_sqlstate := sqlstate;
            if got_sqlstate = 'VK078' then
              raise notice 'WRITE %-6s %-24s blocked (VK078)', op, t;
              passed := passed + 1;
            elsif got_sqlstate in ('42501','0A000') then
              -- Refused before the trigger was reached. 42501 = privilege,
              -- 0A000 = FK check on TRUNCATE. Both are genuine refusals.
              raise notice 'WRITE %-6s %-24s blocked (%)', op, t, got_sqlstate;
              passed := passed + 1;
            else
              failed := failed + 1;
              failures := failures || format(E'\n  %s on %s failed with unexpected sqlstate %s', op, t, got_sqlstate);
              raise notice 'WRITE %-6s %-24s UNEXPECTED sqlstate %', op, t, got_sqlstate;
            end if;
        end;
      end;

    end loop;
  end loop;

  -- ── 3. structure still in place ───────────────────────────────────────────
  if (select count(*) from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
       where not tg.tgisinternal and tg.tgname like 'trg_freeze_%'
         and c.relname = any(tables)) <> 8 then
    failed := failed + 1;
    failures := failures || E'\n  expected 8 freeze triggers (4 row + 4 truncate)';
  else
    passed := passed + 1;
  end if;

  if (select count(*) from information_schema.role_table_grants
       where table_schema='public' and table_name = any(tables)
         and grantee in ('anon','authenticated','service_role')
         and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')) <> 0 then
    failed := failed + 1;
    failures := failures || E'\n  write grants still present on a retired table';
  else
    passed := passed + 1;
  end if;

  raise notice '=== passed: %  failed: % ===', passed, failed;

  if failed > 0 then
    raise exception 'D-078 freeze verification FAILED:%', failures;
  end if;

  raise notice 'D-078 freeze verification PASSED — 4 tables readable and at zero, 16 write attempts all refused.';
end $$;
