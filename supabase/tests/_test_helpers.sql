-- Test helpers. Installed alongside pgTAP; NOT a migration.

-- throws_real(): like throws_ok(sql, null, null, desc) but FAILS if the error
-- is one of the "wrong reason" classes -- i.e. the statement blew up before it
-- could exercise the constraint under test.
--
-- The prior review demonstrated the hole: rewrite a probe to reference a
-- nonexistent column and it errors 42703, the constraint is never reached, and
-- a bare throws_ok still passes. These classes are always a broken test, never
-- a real rejection:
--   42703 undefined_column   42P01 undefined_table
--   42883 undefined_function 42601 syntax_error
--   42P02 undefined_parameter 42704 undefined_object
create or replace function throws_real(p_sql text, p_desc text)
returns text language plpgsql as $$
declare state text; msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
    if state in ('42703','42P01','42883','42601','42P02','42704') then
      return ok(false, p_desc) || E'\n' ||
             diag('  the statement failed for the WRONG REASON: ' || state || ' ' || msg) || E'\n' ||
             diag('  the constraint under test was never exercised');
    end if;
    return ok(true, p_desc);
  end;
  return ok(false, p_desc) || E'\n' || diag('  no exception was raised');
end $$;

-- throws_state(): pin an exact SQLSTATE.
create or replace function throws_state(p_sql text, p_state text, p_desc text)
returns text language plpgsql as $$
declare state text; msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
    if state = p_state then return ok(true, p_desc); end if;
    return ok(false, p_desc) || E'\n' ||
           diag('  expected SQLSTATE ' || p_state || ' but got ' || state || ': ' || msg);
  end;
  return ok(false, p_desc) || E'\n' || diag('  no exception was raised');
end $$;
