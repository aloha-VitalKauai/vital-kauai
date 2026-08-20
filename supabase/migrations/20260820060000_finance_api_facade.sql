-- Financials V2 — PR 3C: the `finance_api` façade.
--
-- WHY
--
-- PostgREST can only reach an EXPOSED schema. Exposing `finance` itself would
-- publish every table in it — including `agreements`, `agreement_amounts`,
-- `payment_links` and `checkout_sessions`, none of which PR 3 uses — as REST
-- collections, and would make future tables reachable the moment they are
-- created. `finance` stays private; this schema is the only thing exposed, and it
-- contains exactly what PR 3 calls and nothing else.
--
-- SECURITY INVOKER, DELIBERATELY
--
-- Every wrapper runs as the CALLER. It therefore adds no privilege of its own:
-- reaching `finance.x` still requires the caller to hold USAGE on `finance` and
-- EXECUTE on `finance.x`. The existing grant split does the authorising, exactly
-- as before:
--
--   role            USAGE finance   approve_dry_run   claim/write
--   anon                  no              no              no
--   authenticated         yes             YES             no
--   service_role          yes             no              YES
--
-- So `finance_api.approve_dry_run` is callable by a founder session and NOT by
-- the service role, and the machine functions are the reverse — enforced by
-- Postgres, not by this file. A SECURITY DEFINER façade would have erased that
-- distinction and made every wrapper callable by anyone holding EXECUTE on the
-- wrapper.
--
-- NO TABLE-WRITING SURFACE
--
-- The two inserts PR 3 performs are wrapped as functions, so no updatable view
-- exists and PostgREST publishes no writable collection. The three views are
-- read-only projections and carry `security_invoker = true`, so the RLS policies
-- on the underlying tables are evaluated as the querying user — without it a view
-- runs as its owner and would silently bypass `founder_reads_runs`.

create schema if not exists finance_api;

comment on schema finance_api is
  'Financials V2 read/call facade. The ONLY finance-related schema exposed to PostgREST; finance itself stays private. All members are SECURITY INVOKER so authorization remains with the underlying finance grants and RLS.';

-- anon is deliberately absent: no USAGE, so nothing here is reachable anonymously
-- even once the schema is exposed.
grant usage on schema finance_api to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Read projections (security_invoker: RLS applies as the caller)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view finance_api.reconciliation_runs
with (security_invoker = true) as
  select id, livemode, dry_run, status, window_start, window_end, window_exhausted,
         implementation_version, resumed_from_run_id, started_at, heartbeat_at,
         finished_at, objects_scanned, objects_matched, exceptions_created,
         exceptions_reopened, api_calls, retries, error,
         would_create_count, would_reopen_count, prospective_by_kind, report_samples,
         report_version, report_completed_at,
         approved_by, approved_at, approval_note, authorized_by_run_id
    from finance.reconciliation_runs;

create or replace view finance_api.reconciliation_exceptions
with (security_invoker = true) as
  select id, kind, agreement_id, ledger_entry_id, provider_object_id, livemode,
         amount_cents, currency, detail, dedup_key, first_detected_at,
         last_detected_at, occurrence_count, first_run_id, last_run_id,
         consecutive_failure_runs, quarantined_at, quarantine_reason,
         released_at, released_by, release_note,
         resolution_status, resolved_at, resolved_by, resolution_note
    from finance.reconciliation_exceptions;

create or replace view finance_api.ledger_entries
with (security_invoker = true) as
  select id, agreement_id, entry_type, amount_cents, currency, source,
         external_method, provider_object_id, provider_payment_intent_id,
         parent_entry_id, occurred_at, recorded_at, recorded_by, recorded_by_system,
         reason, livemode
    from finance.ledger_entries;

-- The founder dashboard reads runs and exceptions under its own session; RLS
-- (`founder_reads_runs` / `founder_reads_exceptions`, both `USING (is_founder())`)
-- is what admits the rows. `ledger_entries` is read only by the reconciliation
-- job, so it is not granted to `authenticated` here.
grant select on finance_api.reconciliation_runs       to authenticated, service_role;
grant select on finance_api.reconciliation_exceptions to authenticated, service_role;
grant select on finance_api.ledger_entries            to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Founder-authorised call
-- ─────────────────────────────────────────────────────────────────────────────

-- Callable by `authenticated` only. `finance.approve_dry_run` is SECURITY
-- DEFINER and checks `is_founder()` against `auth.uid()`, so a non-founder is
-- refused inside Postgres regardless of anything the caller claims. The service
-- role is NOT granted EXECUTE on the inner function, so this wrapper cannot be
-- used to approve from a machine context.
create or replace function finance_api.approve_dry_run(p_run_id uuid, p_note text)
returns void
language sql
security invoker
set search_path = pg_catalog, public, finance
as $$ select finance.approve_dry_run(p_run_id, p_note); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Machine calls (service_role holds EXECUTE on the inner functions)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.start_reconciliation_run(
  p_livemode boolean, p_implementation_version text,
  p_window_start timestamptz, p_window_end timestamptz, p_dry_run boolean,
  p_cursor jsonb default '{}'::jsonb, p_resumed_from_run_id uuid default null,
  p_authorized_by_run_id uuid default null
) returns uuid
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.start_reconciliation_run(p_livemode, p_implementation_version,
       p_window_start, p_window_end, p_dry_run, p_cursor, p_resumed_from_run_id,
       p_authorized_by_run_id); $$;

create or replace function finance_api.advance_reconciliation_run(
  p_run_id uuid, p_cursor jsonb default null,
  p_objects_scanned integer default 0, p_objects_matched integer default 0,
  p_api_calls integer default 0, p_retries integer default 0,
  p_exceptions_created integer default 0, p_exceptions_reopened integer default 0
) returns void
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.advance_reconciliation_run(p_run_id, p_cursor, p_objects_scanned,
       p_objects_matched, p_api_calls, p_retries, p_exceptions_created,
       p_exceptions_reopened); $$;

create or replace function finance_api.finish_reconciliation_run(
  p_run_id uuid, p_status text, p_window_exhausted boolean default false,
  p_error text default null, p_cursor jsonb default null
) returns void
language sql security invoker set search_path = pg_catalog, public, finance
-- `p_status` is text here and cast inward: the enum type lives in the private
-- schema, and publishing it would force PostgREST to resolve `finance.run_status`.
-- The cast fails loudly on an unknown value, so nothing is loosened.
as $$ select finance.finish_reconciliation_run(p_run_id, p_status::finance.run_status,
       p_window_exhausted, p_error, p_cursor); $$;

create or replace function finance_api.record_dry_run_report(
  p_run_id uuid, p_would_create_count integer, p_would_reopen_count integer,
  p_prospective_by_kind jsonb, p_report_samples jsonb, p_report_version text
) returns void
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.record_dry_run_report(p_run_id, p_would_create_count,
       p_would_reopen_count, p_prospective_by_kind, p_report_samples,
       p_report_version); $$;

create or replace function finance_api.raise_reconciliation_exception(
  p_kind text, p_livemode boolean, p_detail jsonb,
  p_run_id uuid default null, p_provider_object_id text default null,
  p_ledger_entry_id uuid default null, p_agreement_id uuid default null,
  p_legacy_donation_id uuid default null, p_amount_cents bigint default null,
  p_currency text default null
) returns uuid
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.raise_reconciliation_exception(p_kind::finance.exception_kind,
       p_livemode, p_detail, p_run_id, p_provider_object_id, p_ledger_entry_id,
       p_agreement_id, p_legacy_donation_id, p_amount_cents, p_currency); $$;

-- Explicit column list rather than `setof finance.stripe_events`: returning the
-- private composite type would require PostgREST to resolve it, defeating the
-- point of keeping `finance` unexposed.
create or replace function finance_api.claim_stripe_events(
  p_livemode boolean, p_limit integer default 50,
  p_stale_after interval default interval '15 minutes'
) returns table (
  event_id text, event_type text, object_id text, livemode boolean,
  attempt_count integer, payload jsonb
)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select e.event_id, e.event_type, e.object_id, e.livemode, e.attempt_count, e.payload
        from finance.claim_stripe_events(p_livemode, p_limit, p_stale_after) e; $$;

create or replace function finance_api.complete_stripe_event(
  p_event_id text, p_status text, p_error text default null
) returns void
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.complete_stripe_event(p_event_id,
       p_status::finance.event_processing_status, p_error); $$;

create or replace function finance_api.sweep_stale_event_claims(
  p_livemode boolean, p_stale_after interval default interval '15 minutes'
) returns integer
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.sweep_stale_event_claims(p_livemode, p_stale_after); $$;

create or replace function finance_api.abandon_stale_runs(
  p_stale_after interval default interval '15 minutes'
) returns integer
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.abandon_stale_runs(p_stale_after); $$;

create or replace function finance_api.purge_expired_event_payloads(
  p_before timestamptz, p_limit integer default 5000
) returns integer
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.purge_expired_event_payloads(p_before, p_limit); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The two writes, as functions rather than writable views
-- ─────────────────────────────────────────────────────────────────────────────

-- Ingestion. Returns a STATUS rather than relying on the caller to parse an error
-- message for a constraint name (D-081). Two different unique violations are
-- possible and they mean opposite things:
--
--   stripe_events_pkey                     -> the same event delivered twice.
--                                             Already recorded; the delivery
--                                             succeeded.
--   stripe_events_terminal_at_most_once_uq -> a DIFFERENT event for the same
--                                             object. Answering "duplicate" would
--                                             acknowledge an event that was never
--                                             stored, and Stripe would stop
--                                             retrying — the hazard §10 names.
--
-- Deciding this in SQL, from the constraint diagnostic, is strictly more robust
-- than string-matching a PostgREST error payload.
create or replace function finance_api.record_stripe_event(
  p_event_id text, p_event_type text, p_object_id text,
  p_livemode boolean, p_payload jsonb
) returns text
language plpgsql
security invoker
set search_path = pg_catalog, public, finance
as $fn$
declare v_constraint text;
begin
  insert into finance.stripe_events (event_id, event_type, object_id, livemode, payload)
  values (p_event_id, p_event_type, p_object_id, p_livemode, p_payload);
  return 'recorded';
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'stripe_events_pkey' then
      return 'duplicate';
    elsif v_constraint = 'stripe_events_terminal_at_most_once_uq' then
      return 'at_most_once_conflict';
    end if;
    -- An unrecognised unique violation is NOT assumed benign; treating it as a
    -- duplicate would reintroduce the silent discard by another route.
    return 'at_most_once_conflict';
end $fn$;

-- Ledger write. SECURITY INVOKER, so it inserts only because `service_role` holds
-- INSERT on `finance.ledger_entries`; `authenticated` does not and is refused by
-- Postgres. The table's CHECKs (L1, L3, L12, L13) still validate the row.
create or replace function finance_api.record_ledger_entry(
  p_agreement_id uuid, p_entry_type text, p_amount_cents bigint,
  p_provider_object_id text, p_provider_payment_intent_id text,
  p_parent_entry_id uuid, p_occurred_at timestamptz, p_livemode boolean
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, finance
as $fn$
declare v_id uuid;
begin
  insert into finance.ledger_entries (
    agreement_id, entry_type, amount_cents, currency, source,
    provider_object_id, provider_payment_intent_id, parent_entry_id,
    occurred_at, recorded_by_system, livemode
  ) values (
    p_agreement_id, p_entry_type::finance.ledger_entry_type, p_amount_cents,
    'usd', 'stripe',
    p_provider_object_id, p_provider_payment_intent_id, p_parent_entry_id,
    p_occurred_at, 'reconciliation'::finance.system_actor, p_livemode
  ) returning id into v_id;
  return v_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Privileges — PUBLIC holds nothing; each role gets only its own half
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on all functions in schema finance_api from public;

-- Founder-only.
revoke all on function finance_api.approve_dry_run(uuid, text) from public;
grant execute on function finance_api.approve_dry_run(uuid, text) to authenticated;

-- Machine-only. `authenticated` is deliberately not granted; even if it were, the
-- inner functions would refuse, because these wrappers are SECURITY INVOKER.
grant execute on function finance_api.start_reconciliation_run(boolean, text, timestamptz, timestamptz, boolean, jsonb, uuid, uuid) to service_role;
grant execute on function finance_api.advance_reconciliation_run(uuid, jsonb, integer, integer, integer, integer, integer, integer) to service_role;
grant execute on function finance_api.finish_reconciliation_run(uuid, text, boolean, text, jsonb) to service_role;
grant execute on function finance_api.record_dry_run_report(uuid, integer, integer, jsonb, jsonb, text) to service_role;
grant execute on function finance_api.raise_reconciliation_exception(text, boolean, jsonb, uuid, text, uuid, uuid, uuid, bigint, text) to service_role;
grant execute on function finance_api.claim_stripe_events(boolean, integer, interval) to service_role;
grant execute on function finance_api.complete_stripe_event(text, text, text) to service_role;
grant execute on function finance_api.sweep_stale_event_claims(boolean, interval) to service_role;
grant execute on function finance_api.abandon_stale_runs(interval) to service_role;
grant execute on function finance_api.purge_expired_event_payloads(timestamptz, integer) to service_role;
grant execute on function finance_api.record_stripe_event(text, text, text, boolean, jsonb) to service_role;
grant execute on function finance_api.record_ledger_entry(uuid, text, bigint, text, text, uuid, timestamptz, boolean) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Prove the façade's properties in the same transaction that creates it
-- ─────────────────────────────────────────────────────────────────────────────

do $chk$
declare
  n_definer   integer;
  n_unpinned  integer;
  n_anon      integer;
  n_writable  integer;
  n_invoker_v integer;
begin
  -- A SECURITY DEFINER wrapper would erase the grant split that does the
  -- authorising and make every wrapper callable by anyone holding EXECUTE on it.
  select count(*) into n_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance_api' and p.prosecdef;
  if n_definer <> 0 then
    raise exception '% finance_api function(s) are SECURITY DEFINER; all must be INVOKER', n_definer;
  end if;

  select count(*) into n_unpinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance_api'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                      where c like 'search\_path=%');
  if n_unpinned <> 0 then
    raise exception '% finance_api function(s) have no pinned search_path', n_unpinned;
  end if;

  -- anon must reach nothing, even once the schema is exposed.
  if has_schema_privilege('anon', 'finance_api', 'USAGE') then
    raise exception 'anon holds USAGE on finance_api';
  end if;
  select count(*) into n_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where n.nspname = 'finance_api'
     and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if n_anon <> 0 then
    raise exception 'anon or PUBLIC holds EXECUTE on % finance_api function(s)', n_anon;
  end if;

  -- No writable surface for any API role. Scoped to the roles PostgREST actually
  -- authenticates as: the schema OWNER necessarily holds every privilege on its
  -- own views, which `role_table_grants` reports and which cannot be revoked
  -- meaningfully. Checking it unscoped fails on that inherent ownership rather
  -- than on a real exposure.
  select count(*) into n_writable
    from information_schema.role_table_grants
   where table_schema = 'finance_api'
     and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if n_writable <> 0 then
    raise exception 'finance_api exposes % table-write grant(s) to an API role', n_writable;
  end if;

  -- A view without security_invoker runs as its owner and would bypass
  -- founder_reads_runs entirely.
  select count(*) into n_invoker_v
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'finance_api' and c.relkind = 'v'
     and not coalesce((select option_value::boolean
                         from unnest(c.reloptions) o,
                              lateral (select split_part(o, '=', 1) as option_name,
                                              split_part(o, '=', 2) as option_value) x
                        where x.option_name = 'security_invoker'), false);
  if n_invoker_v <> 0 then
    raise exception '% finance_api view(s) are not security_invoker and would bypass RLS', n_invoker_v;
  end if;

  -- The private schema must remain private.
  if has_schema_privilege('anon', 'finance', 'USAGE') then
    raise exception 'anon gained USAGE on the private finance schema';
  end if;
end $chk$;
