-- Financials V2 PR 1 — RLS, grants and default privileges (ARCHITECTURE §9, §15).
-- A custom schema is unreachable until granted explicitly, so every grant is stated.

-- Explicitly transactional: a failure anywhere below leaves the database
-- exactly as it was. Migration 0001 in particular MUST be atomic -- its
-- verification block is worthless if the ALTER has already autocommitted.
begin;

revoke all on schema finance from public;
grant usage on schema finance to authenticated, service_role;

-- Finding 5. `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM
-- PUBLIC` is a NO-OP here: verified on PostgreSQL 17.10 that a function created
-- afterwards -- in the same session or a new one, with or without FOR ROLE --
-- still carries `=X/owner`, i.e. PUBLIC retains EXECUTE. Revoke-only default
-- privileges store no pg_default_acl row at all.
--
-- What actually works, and is used instead:
--   1. this GRANT, which does store a default ACL row for service_role;
--   2. an explicit REVOKE over existing functions at the end of this file;
--   3. a catalog assertion in the test suite that FAILS if any finance function
--      is PUBLIC-executable, so a future migration cannot reintroduce it
--      silently.
-- Every finance function additionally revokes from PUBLIC individually.
alter default privileges in schema finance grant execute on functions to service_role;
alter default privileges in schema finance revoke all on tables from public;

-- ENABLE and FORCE on all nine tables.
alter table finance.agreements                enable row level security;
alter table finance.agreements                force  row level security;
alter table finance.agreement_amounts         enable row level security;
alter table finance.agreement_amounts         force  row level security;
alter table finance.agreement_lifecycle_events enable row level security;
alter table finance.agreement_lifecycle_events force row level security;
alter table finance.ledger_entries            enable row level security;
alter table finance.ledger_entries            force  row level security;
alter table finance.stripe_events             enable row level security;
alter table finance.stripe_events             force  row level security;
alter table finance.checkout_sessions         enable row level security;
alter table finance.checkout_sessions         force  row level security;
alter table finance.payment_links             enable row level security;
alter table finance.payment_links             force  row level security;
alter table finance.reconciliation_exceptions enable row level security;
alter table finance.reconciliation_exceptions force  row level security;
alter table finance.reconciliation_runs       enable row level security;
alter table finance.reconciliation_runs       force  row level security;

-- ----------------------------------------------------------------- policies
-- Members read their own; founders read all. Members have no INSERT/UPDATE/
-- DELETE policy on any table. No hardcoded founder UUIDs anywhere.

create policy member_reads_own_agreements on finance.agreements
  for select to authenticated using (member_id = finance.current_member_id());
create policy founder_reads_agreements on finance.agreements
  for select to authenticated using (public.is_founder());

create policy member_reads_own_amounts on finance.agreement_amounts
  for select to authenticated using (exists (
    select 1 from finance.agreements a
    where a.id = agreement_id and a.member_id = finance.current_member_id()));
create policy founder_reads_amounts on finance.agreement_amounts
  for select to authenticated using (public.is_founder());

-- Lifecycle is operational state: founder-only.
create policy founder_reads_lifecycle on finance.agreement_lifecycle_events
  for select to authenticated using (public.is_founder());

-- livemode = true is part of the member predicate: test-mode money must be
-- invisible on every member path, not merely filtered by the canonical view.
create policy member_reads_own_ledger on finance.ledger_entries
  for select to authenticated using (livemode = true and exists (
    select 1 from finance.agreements a
    where a.id = agreement_id and a.member_id = finance.current_member_id()));
create policy founder_reads_ledger on finance.ledger_entries
  for select to authenticated using (public.is_founder());

create policy founder_reads_stripe_events on finance.stripe_events
  for select to authenticated using (public.is_founder());

create policy member_reads_own_sessions on finance.checkout_sessions
  for select to authenticated using (livemode = true and exists (
    select 1 from finance.agreements a
    where a.id = agreement_id and a.member_id = finance.current_member_id()));
create policy founder_reads_sessions on finance.checkout_sessions
  for select to authenticated using (public.is_founder());

-- The raw token is the member's only handle; the row is never read by them.
create policy founder_reads_links on finance.payment_links
  for select to authenticated using (public.is_founder());

create policy founder_reads_exceptions on finance.reconciliation_exceptions
  for select to authenticated using (public.is_founder());

create policy founder_reads_runs on finance.reconciliation_runs
  for select to authenticated using (public.is_founder());

-- service_role policies: FORCE RLS applies to the table owner too, so
-- service_role needs explicit policies alongside its grants.
create policy service_all_agreements on finance.agreements
  for all to service_role using (true) with check (true);
create policy service_all_amounts on finance.agreement_amounts
  for all to service_role using (true) with check (true);
create policy service_all_lifecycle on finance.agreement_lifecycle_events
  for all to service_role using (true) with check (true);
create policy service_all_ledger on finance.ledger_entries
  for all to service_role using (true) with check (true);
create policy service_all_stripe_events on finance.stripe_events
  for all to service_role using (true) with check (true);
create policy service_all_sessions on finance.checkout_sessions
  for all to service_role using (true) with check (true);
create policy service_all_links on finance.payment_links
  for all to service_role using (true) with check (true);
create policy service_all_exceptions on finance.reconciliation_exceptions
  for all to service_role using (true) with check (true);
create policy service_all_runs on finance.reconciliation_runs
  for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------ grants
-- authenticated: SELECT only, everywhere. Every write is a function call.
grant select on finance.agreements, finance.agreement_amounts,
                finance.agreement_lifecycle_events, finance.ledger_entries,
                finance.stripe_events, finance.checkout_sessions,
                finance.payment_links, finance.reconciliation_exceptions,
                finance.reconciliation_runs
  to authenticated;

grant select on finance.v_agreement_lifecycle, finance.v_agreement_balances,
                finance.v_agreement_balances_test, finance.v_member_financials,
                finance.v_journey_financials
  to authenticated, service_role;

-- service_role: SELECT everywhere; INSERT and bounded, column-scoped UPDATE.
-- NO UPDATE or DELETE on the three append-only fact tables — and the
-- append-only trigger raises regardless of role in any case.
grant select on all tables in schema finance to service_role;

grant insert on finance.agreements, finance.agreement_amounts,
                finance.agreement_lifecycle_events, finance.ledger_entries,
                finance.stripe_events
  to service_role;

-- Column-scoped INSERT. payment_links and checkout_sessions carry
-- founder-gated or terminal transitions, so creation is a protected transition
-- on them too: the revocation and completion columns are excluded, and a
-- BEFORE INSERT trigger enforces the same rule independently of privileges.
grant insert (agreement_id, token_hash, expires_at, created_by)
  on finance.payment_links to service_role;

grant insert (agreement_id, idempotency_key, payment_link_id, amount_cents,
              currency, livemode, expires_at)
  on finance.checkout_sessions to service_role;

grant update (processing_status, claimed_at, attempt_count, processed_at,
              processing_error, payload)
  on finance.stripe_events to service_role;

grant update (status, stripe_session_id, completed_at)
  on finance.checkout_sessions to service_role;

grant update (status, claimed_at, consumed_at, consumed_by_session_id, attempt_count)
  on finance.payment_links to service_role;
-- Revocation is a founder act performed through finance.revoke_payment_link();
-- no role holds a direct UPDATE on revoked_at/revoked_by (finding 4).

-- Column-scoped INSERT: the nine protected lifecycle columns are excluded, so
-- resolution_status takes its 'open' default (D-068). The BEFORE INSERT trigger
-- enforces the same rule independently of privileges and is load-bearing.
grant insert (kind, agreement_id, ledger_entry_id, provider_object_id,
              legacy_donation_id, livemode, amount_cents, currency, detail,
              first_detected_at, last_detected_at, occurrence_count,
              first_run_id, last_run_id, consecutive_failure_runs)
  on finance.reconciliation_exceptions to service_role;

grant update (last_detected_at, occurrence_count, detail, last_run_id,
              consecutive_failure_runs)
  on finance.reconciliation_exceptions to service_role;

-- Column-scoped INSERT: approval and report columns excluded. A report is
-- produced by an UPDATE during the run, not asserted at creation.
grant insert (livemode, implementation_version, window_start, window_end,
              cursor, resumed_from_run_id, dry_run, authorized_by_run_id)
  on finance.reconciliation_runs to service_role;

grant update (status, cursor, window_exhausted, heartbeat_at, finished_at, error,
              objects_scanned, objects_matched, exceptions_created,
              exceptions_reopened, api_calls, retries, would_create_count,
              would_reopen_count, prospective_by_kind, report_samples,
              report_version, report_completed_at)
  on finance.reconciliation_runs to service_role;

-- anon and PUBLIC hold nothing.
revoke all on all tables in schema finance from anon;
revoke all on all functions in schema finance from anon;

-- Finding 5, part 2: strip PUBLIC EXECUTE from every function this PR created.
-- This DOES work for existing objects; default privileges do not.
revoke execute on all functions in schema finance from public;

commit;
