-- Test helpers. Installed alongside pgTAP; NOT a migration.
--
-- throws_real() HAS BEEN REMOVED. It was a denylist: it accepted ANY error that
-- was not in a small "wrong reason" set, so a rejection could pass for a reason
-- nobody had stated. Requirement 121 was passing on an unrelated 23514.
--
-- denied() replaces it and cannot express an unspecified expectation:
--   * p_state   -- the exact SQLSTATE. No wildcards, no defaults.
--   * p_ident   -- a constraint/guard identifier or message fragment that must
--                  appear in (constraint_name || message_text). A generic
--                  P0001, or an unrelated 23505/23514/42501/42703, fails unless
--                  it is EXACTLY what was asked for.
--   * state-unchanged -- a digest of every row in every finance table is taken
--                  before and after. A denied write that mutated anything fails,
--                  even if it raised the right error afterwards.
-- Null or empty p_state/p_ident raise, so a site cannot be silently waived.

create or replace function finance_state_digest()
returns text language plpgsql stable as $$
declare t text; acc text := ''; part text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='r' order by 1 loop
    execute 'select coalesce(md5(string_agg(x.t, ''|'' order by x.t)), ''empty'') from '
            || '(select md5(q.*::text) as t from finance.' || quote_ident(t) || ' q) x'
      into part;
    acc := acc || t || '=' || part || ';';
  end loop;
  return acc;
end $$;

create or replace function finance_norm_msg(p text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(lower(coalesce(p,'')),
             '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '#', 'g'),
           '[0-9]{4}-[0-9]{2}-[0-9]{2}[^ ]*|[0-9]+', '#', 'g')
$$;

create or replace function denied(p_sql text, p_state text, p_ident text, p_desc text)
returns text language plpgsql as $$
declare state text; msg text; cons text; before_d text; after_d text;
begin
  if p_state is null or btrim(p_state) = '' then
    raise exception 'denied(): p_state is required -- an unspecified SQLSTATE is not a test (%)', p_desc;
  end if;
  if p_ident is null or btrim(p_ident) = '' then
    raise exception 'denied(): p_ident is required -- an unidentified guard is not a test (%)', p_desc;
  end if;
  -- LOW-4 (post-approval): normalization masks digits/uuids/dates to '#', so a
  -- purely numeric or uuid ident would normalize to '#' and match nearly any
  -- message. An ident must keep alphabetic substance after normalization.
  if finance_norm_msg(p_ident) !~ '[a-z]' then
    raise exception 'denied(): p_ident % normalizes to nothing -- it would match nearly any error (%)', quote_literal(p_ident), p_desc;
  end if;
  before_d := finance_state_digest();
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text, cons = constraint_name;
    if state <> p_state then
      return ok(false, p_desc) || E'\n' ||
        diag('  expected SQLSTATE ' || p_state || ' but got ' || state || ': ' || msg);
    end if;
    -- Runtime values (uuids, timestamps, counts) are masked on BOTH sides so the
    -- identifier pins the guard's wording, not the row it happened to fire on.
    if position(finance_norm_msg(p_ident) in
                finance_norm_msg(coalesce(cons,'') || ' ' || coalesce(msg,''))) = 0 then
      return ok(false, p_desc) || E'\n' ||
        diag('  SQLSTATE ' || state || ' matched but the guard did not: expected identifier ' ||
             quote_literal(p_ident)) || E'\n' ||
        diag('  actual constraint=' || coalesce(cons,'<none>') || ' message=' || coalesce(msg,''));
    end if;
    -- KNOWN-EQUIVALENT MUTANT: disabling this comparison is NOT detectable by
    -- any test, and that is documented rather than hidden. The probe runs inside
    -- this block's subtransaction; when the exception is caught, PostgreSQL has
    -- already rolled the probe's writes back, so after_d always equals before_d
    -- here. The state-unchanged guarantee for a denied single statement is
    -- PostgreSQL's, not this check's. It is kept as defence for future
    -- refactors (e.g. if a probe ever ran outside an exception block), and the
    -- suites additionally assert protected values at top level after denials,
    -- outside any subtransaction. sabotage.sh case 24 encodes this equivalence.
    after_d := finance_state_digest();
    if after_d <> before_d then
      return ok(false, p_desc) || E'\n' ||
        diag('  the write was rejected with the right error BUT finance state changed');
    end if;
    return ok(true, p_desc);
  end;
  return ok(false, p_desc) || E'\n' || diag('  no exception was raised; the write was ALLOWED');
end $$;

-- throws_state(): kept for sites that assert only a SQLSTATE with no state to protect.
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
