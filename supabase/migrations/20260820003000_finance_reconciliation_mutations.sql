-- Financials V2 — PR 3: reconciliation mutation surface.
--
-- WHY THIS EXISTS
--
-- PR 3 was scoped as "application-layer work only". That was based on the tables
-- already existing, which is not the same as their being writable. For
-- `service_role` — the role every server route runs as — the `finance` schema is
-- deliberately append-only: no table grants UPDATE or DELETE, and
-- `reconciliation_runs` and `reconciliation_exceptions` grant only SELECT.
-- Mutation runs exclusively through SECURITY DEFINER functions, and PR 1 shipped
-- six of them (approve_dry_run, create_agreement, quarantine_object,
-- release_quarantine, resolve_exception, revoke_payment_link). None creates a run,
-- advances a cursor or counters, claims a stripe_events row, or raises an
-- exception.
--
-- So the reconciliation job as specified could not run at all: every write would
-- fail with `permission denied` at runtime rather than at review. This migration
-- closes exactly that gap and nothing more.
--
-- WHY NOT SIMPLY GRANT UPDATE TO service_role
--
-- Because the append-only property is the enforcement. Note that `service_role`
-- already holds BYPASSRLS, so the RLS policies on these tables do not constrain
-- it — the GRANTS are the only thing that does. Granting UPDATE would therefore
-- not be a small relaxation; it would remove the sole remaining control, and let
-- any route rewrite a run's approval evidence, counters or window. The run guards
-- (tg_run_authorization, tg_run_freeze_approved) assume callers cannot do that.
--
-- AUTHORIZATION MODEL
--
-- These functions are owned by `postgres` (BYPASSRLS) and are SECURITY DEFINER,
-- so they can write where the caller cannot. The authorization boundary is
-- therefore the EXECUTE grant, and it is the ONLY boundary — which is why every
-- function below revokes from PUBLIC first and grants solely to `service_role`.
-- `anon` and `authenticated` receive nothing.
--
-- A role check inside the function body is deliberately NOT used: once execution
-- enters a SECURITY DEFINER function, `current_user` is the owner for the whole
-- call tree, so such a check would inspect `postgres` and pass unconditionally.
-- It would read as a safeguard while enforcing nothing. Founder-only operations
-- remain the existing functions, which authorize via `is_founder()` — that works
-- here because it reads JWT claims rather than the effective role.
--
-- Every function pins `search_path`, validates its inputs, and constrains the
-- state transitions it permits.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. stripe_events — claim, complete, sweep
-- ─────────────────────────────────────────────────────────────────────────────

-- Claim a batch of events for processing.
--
-- FOR UPDATE SKIP LOCKED is what makes concurrent workers safe: two workers
-- claiming at once take disjoint batches rather than blocking or double-claiming.
--
-- Re-claim is deliberate. An event left `processing` by a worker that died would
-- otherwise be stranded forever, so a claim older than p_stale_after is taken
-- over. attempt_count increments on every claim, so a poison event that keeps
-- killing its worker is visible rather than silently looping.
create or replace function finance.claim_stripe_events(
  p_livemode    boolean,
  p_limit       integer  default 50,
  p_stale_after interval default interval '15 minutes'
)
returns setof finance.stripe_events
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_livemode is null then
    raise exception 'claim_stripe_events: p_livemode is required'
      using errcode = 'VK400';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'claim_stripe_events: p_limit must be 1..500, got %', p_limit
      using errcode = 'VK400';
  end if;
  -- A short stale window would let a healthy worker's own event be stolen
  -- mid-processing, producing exactly the duplicate work the claim prevents.
  if p_stale_after is null or p_stale_after < interval '1 minute' then
    raise exception 'claim_stripe_events: p_stale_after must be >= 1 minute, got %', p_stale_after
      using errcode = 'VK400';
  end if;

  return query
  with candidate as (
    select e.event_id
      from finance.stripe_events e
     where e.livemode = p_livemode
       and (
            e.processing_status = 'received'
         or (e.processing_status = 'processing' and e.claimed_at < v_now - p_stale_after)
       )
     order by e.received_at
     limit p_limit
     for update skip locked
  )
  update finance.stripe_events e
     set processing_status = 'processing',
         claimed_at        = v_now,
         attempt_count     = e.attempt_count + 1
    from candidate c
   where e.event_id = c.event_id
  returning e.*;
end $$;

-- Move a claimed event to a terminal state.
--
-- Only `processing` may be completed, so a result cannot be recorded for an event
-- this worker never claimed — including one already swept back to `received` or
-- re-claimed by another worker, where writing a result would overwrite whatever
-- the current owner is doing.
create or replace function finance.complete_stripe_event(
  p_event_id text,
  p_status   finance.event_processing_status,
  p_error    text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_prev finance.event_processing_status;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'complete_stripe_event: p_event_id is required'
      using errcode = 'VK400';
  end if;
  if p_status is null or p_status not in ('processed', 'failed', 'ignored') then
    raise exception
      'complete_stripe_event: p_status must be processed, failed or ignored, got %', p_status
      using errcode = 'VK400';
  end if;
  -- A failure with no explanation is not diagnosable later, when the payload
  -- alone rarely says why processing stopped.
  if p_status = 'failed' and (p_error is null or length(trim(p_error)) = 0) then
    raise exception 'complete_stripe_event: a failed event requires p_error'
      using errcode = 'VK400';
  end if;

  select processing_status into v_prev
    from finance.stripe_events
   where event_id = p_event_id
   for update;

  if not found then
    raise exception 'complete_stripe_event: event % does not exist', p_event_id
      using errcode = 'VK404';
  end if;
  if v_prev <> 'processing' then
    raise exception
      'complete_stripe_event: event % is %, only a processing event may be completed',
      p_event_id, v_prev
      using errcode = 'VK409';
  end if;

  update finance.stripe_events
     set processing_status = p_status,
         processed_at      = clock_timestamp(),
         processing_error  = case when p_status = 'failed' then p_error else null end,
         claimed_at        = null
   where event_id = p_event_id;
end $$;

-- Return events stranded in `processing` to `received`.
--
-- claim_stripe_events already re-claims stale rows, so this exists for the case
-- where no worker is running at all: without it a crash during a quiet period
-- leaves events invisible to any later `received`-only query.
create or replace function finance.sweep_stale_event_claims(
  p_livemode    boolean,
  p_stale_after interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_swept integer;
begin
  if p_livemode is null then
    raise exception 'sweep_stale_event_claims: p_livemode is required'
      using errcode = 'VK400';
  end if;
  if p_stale_after is null or p_stale_after < interval '1 minute' then
    raise exception 'sweep_stale_event_claims: p_stale_after must be >= 1 minute'
      using errcode = 'VK400';
  end if;

  with stale as (
    select event_id
      from finance.stripe_events
     where livemode = p_livemode
       and processing_status = 'processing'
       and claimed_at < clock_timestamp() - p_stale_after
     for update skip locked
  )
  update finance.stripe_events e
     set processing_status = 'received',
         claimed_at        = null
    from stale s
   where e.event_id = s.event_id;

  get diagnostics v_swept = row_count;
  return v_swept;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. reconciliation_runs — start, advance, finish, abandon
-- ─────────────────────────────────────────────────────────────────────────────

-- Create a run.
--
-- Deliberately thin: tg_run_insert_guard already enforces resume lineage and
-- refuses a pre-approved run, and tg_run_authorization already enforces the
-- dry-run → approval gate for any writing run. Re-checking here would duplicate
-- rules that must stay authoritative in one place.
--
-- What this DOES add is a readable failure for the single-flight index, which
-- otherwise surfaces as a bare 23505 that the caller cannot distinguish from any
-- other unique violation.
create or replace function finance.start_reconciliation_run(
  p_livemode               boolean,
  p_implementation_version text,
  p_window_start           timestamptz,
  p_window_end             timestamptz,
  p_dry_run                boolean,
  p_cursor                 jsonb default '{}'::jsonb,
  p_resumed_from_run_id    uuid  default null,
  p_authorized_by_run_id   uuid  default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_id uuid;
begin
  if p_livemode is null then
    raise exception 'start_reconciliation_run: p_livemode is required' using errcode = 'VK400';
  end if;
  if p_dry_run is null then
    raise exception 'start_reconciliation_run: p_dry_run is required' using errcode = 'VK400';
  end if;
  -- Acceptance 18f0: run creation fails when the build identifier is absent,
  -- rather than substituting a placeholder that would misattribute provenance.
  if p_implementation_version is null or length(trim(p_implementation_version)) = 0 then
    raise exception
      'start_reconciliation_run: p_implementation_version is required and may not be blank'
      using errcode = 'VK400';
  end if;
  if p_window_start is null or p_window_end is null then
    raise exception 'start_reconciliation_run: window bounds are required' using errcode = 'VK400';
  end if;
  if p_window_start >= p_window_end then
    raise exception 'start_reconciliation_run: window_start % must precede window_end %',
      p_window_start, p_window_end
      using errcode = 'VK400';
  end if;
  if p_cursor is null then
    raise exception 'start_reconciliation_run: p_cursor may not be null' using errcode = 'VK400';
  end if;

  begin
    insert into finance.reconciliation_runs (
      livemode, implementation_version, window_start, window_end,
      cursor, status, dry_run, resumed_from_run_id, authorized_by_run_id
    ) values (
      p_livemode, p_implementation_version, p_window_start, p_window_end,
      p_cursor, 'running', p_dry_run, p_resumed_from_run_id, p_authorized_by_run_id
    )
    returning id into v_id;
  exception
    when unique_violation then
      -- Acceptance 4: a second concurrent run for the same livemode is refused,
      -- while test-mode and live-mode runs proceed together.
      raise exception
        'a reconciliation run is already in flight for livemode=% (or this predecessor is already resumed)',
        p_livemode
        using errcode = 'VK409';
  end;

  return v_id;
end $$;

-- Advance a running run: counters, cursor, heartbeat.
--
-- Counters are ADDITIVE (D-049): they count examinations performed by this run,
-- not distinct objects, so a resumed run that re-examines a page increments
-- again. Absolute assignment would let a caller rewrite history and would break
-- the resume semantics acceptance 3 depends on.
--
-- The heartbeat always moves, even when every delta is zero, because a run
-- working slowly through a large page must not look abandoned to the sweeper.
create or replace function finance.advance_reconciliation_run(
  p_run_id             uuid,
  p_cursor             jsonb   default null,
  p_objects_scanned    integer default 0,
  p_objects_matched    integer default 0,
  p_api_calls          integer default 0,
  p_retries            integer default 0,
  p_exceptions_created integer default 0,
  p_exceptions_reopened integer default 0
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_status finance.run_status;
begin
  if p_run_id is null then
    raise exception 'advance_reconciliation_run: p_run_id is required' using errcode = 'VK400';
  end if;
  -- Counters are monotonic. A negative delta could only ever be used to erase
  -- work that was really performed.
  if least(p_objects_scanned, p_objects_matched, p_api_calls,
           p_retries, p_exceptions_created, p_exceptions_reopened) < 0 then
    raise exception 'advance_reconciliation_run: counter deltas may not be negative'
      using errcode = 'VK400';
  end if;

  select status into v_status
    from finance.reconciliation_runs
   where id = p_run_id
   for update;

  if not found then
    raise exception 'advance_reconciliation_run: run % does not exist', p_run_id
      using errcode = 'VK404';
  end if;
  if v_status <> 'running' then
    raise exception 'advance_reconciliation_run: run % is %, only a running run may advance',
      p_run_id, v_status
      using errcode = 'VK409';
  end if;

  update finance.reconciliation_runs
     set cursor             = coalesce(p_cursor, cursor),
         objects_scanned    = objects_scanned    + p_objects_scanned,
         objects_matched    = objects_matched    + p_objects_matched,
         api_calls          = api_calls          + p_api_calls,
         retries            = retries            + p_retries,
         exceptions_created = exceptions_created + p_exceptions_created,
         exceptions_reopened = exceptions_reopened + p_exceptions_reopened,
         heartbeat_at       = clock_timestamp()
   where id = p_run_id;
end $$;

-- Move a running run to a terminal state.
--
-- `completed` is the only status that may claim an exhausted window, because the
-- watermark advances on it (18b). A `partial` run must preserve its cursor and
-- leave the window unexhausted so its successor inherits both.
create or replace function finance.finish_reconciliation_run(
  p_run_id           uuid,
  p_status           finance.run_status,
  p_window_exhausted boolean default false,
  p_error            text    default null,
  p_cursor           jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_status finance.run_status;
begin
  if p_run_id is null then
    raise exception 'finish_reconciliation_run: p_run_id is required' using errcode = 'VK400';
  end if;
  if p_status is null or p_status not in ('completed', 'partial', 'failed', 'abandoned') then
    raise exception
      'finish_reconciliation_run: p_status must be completed, partial, failed or abandoned, got %',
      p_status
      using errcode = 'VK400';
  end if;
  if p_status = 'failed' and (p_error is null or length(trim(p_error)) = 0) then
    raise exception 'finish_reconciliation_run: a failed run requires p_error'
      using errcode = 'VK400';
  end if;
  -- Acceptance 18: a run that hit a ceiling ends `partial` with the window NOT
  -- exhausted. Allowing exhaustion on a non-completed run would advance the
  -- watermark past work that was never done.
  if p_window_exhausted and p_status <> 'completed' then
    raise exception
      'finish_reconciliation_run: only a completed run may report an exhausted window, got %',
      p_status
      using errcode = 'VK400';
  end if;

  select status into v_status
    from finance.reconciliation_runs
   where id = p_run_id
   for update;

  if not found then
    raise exception 'finish_reconciliation_run: run % does not exist', p_run_id
      using errcode = 'VK404';
  end if;
  if v_status <> 'running' then
    raise exception 'finish_reconciliation_run: run % is already %', p_run_id, v_status
      using errcode = 'VK409';
  end if;

  update finance.reconciliation_runs
     set status           = p_status,
         window_exhausted = p_window_exhausted,
         cursor           = coalesce(p_cursor, cursor),
         error            = p_error,
         finished_at      = clock_timestamp(),
         heartbeat_at     = clock_timestamp()
   where id = p_run_id;
end $$;

-- Mark runs whose heartbeat has gone stale as abandoned (acceptance 5).
--
-- Their cursor is left intact so a successor can resume from it; tg_run_insert_guard
-- permits `abandoned` as a resumable predecessor.
create or replace function finance.abandon_stale_runs(
  p_stale_after interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_count integer;
begin
  if p_stale_after is null or p_stale_after < interval '1 minute' then
    raise exception 'abandon_stale_runs: p_stale_after must be >= 1 minute'
      using errcode = 'VK400';
  end if;

  with stale as (
    select id from finance.reconciliation_runs
     where status = 'running'
       and heartbeat_at < clock_timestamp() - p_stale_after
     for update skip locked
  )
  update finance.reconciliation_runs r
     set status      = 'abandoned',
         finished_at = clock_timestamp(),
         error       = coalesce(r.error, 'heartbeat went stale; abandoned by sweeper')
    from stale s
   where r.id = s.id;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. reconciliation_exceptions — raise and streak reset
-- ─────────────────────────────────────────────────────────────────────────────

-- Raise an exception, or record another occurrence of an open one.
--
-- Identity is the generated `dedup_key` scoped by livemode, matching the partial
-- unique index over open rows. Acceptance 13: running twice over the same window
-- creates no second exception — the second raise bumps the occurrence instead.
--
-- Only OPEN rows collide. A resolved exception that recurs is therefore raised
-- afresh rather than silently reopened, which keeps the resolution history
-- meaningful.
create or replace function finance.raise_reconciliation_exception(
  p_kind               finance.exception_kind,
  p_livemode           boolean,
  p_detail             jsonb,
  p_run_id             uuid    default null,
  p_provider_object_id text    default null,
  p_ledger_entry_id    uuid    default null,
  p_agreement_id       uuid    default null,
  p_legacy_donation_id uuid    default null,
  p_amount_cents       bigint  default null,
  p_currency           text    default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_id  uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_kind is null then
    raise exception 'raise_reconciliation_exception: p_kind is required' using errcode = 'VK400';
  end if;
  if p_livemode is null then
    raise exception 'raise_reconciliation_exception: p_livemode is required' using errcode = 'VK400';
  end if;
  -- `detail` is jsonb, not text. An exception with no detail cannot be triaged by
  -- the founder later, and the queue in PR 4 renders exactly this object.
  if p_detail is null or jsonb_typeof(p_detail) <> 'object' or p_detail = '{}'::jsonb then
    raise exception 'raise_reconciliation_exception: p_detail must be a non-empty JSON object'
      using errcode = 'VK400';
  end if;
  -- Every dedup_key component is nullable, so an exception naming no subject at
  -- all would collapse into one shared identity per kind and silently merge
  -- unrelated findings.
  if p_provider_object_id is null and p_ledger_entry_id is null
     and p_agreement_id is null and p_legacy_donation_id is null then
    raise exception
      'raise_reconciliation_exception: at least one subject (provider object, ledger entry, agreement or legacy donation) is required'
      using errcode = 'VK400';
  end if;
  -- D-014: the ledger is USD-only, and so is every figure quoted beside it.
  if p_currency is not null and p_currency <> 'usd' then
    raise exception 'raise_reconciliation_exception: currency must be usd, got %', p_currency
      using errcode = 'VK400';
  end if;
  -- D-061: exc_processing_failure_shape enforces this at the table. Checking it
  -- here turns an opaque 23514 into a message naming the offending field, and
  -- keeps the enumerated vocabularies discoverable from the function itself.
  -- This was found by executing the behaviour, not by reading the DDL.
  if p_kind = 'provider_object_processing_failed' then
    if p_provider_object_id is null then
      raise exception
        'raise_reconciliation_exception: provider_object_processing_failed requires p_provider_object_id'
        using errcode = 'VK400';
    end if;
    if not (p_detail ? 'object_type')
       or (p_detail->>'object_type') not in ('payment_intent','charge','refund','checkout_session') then
      raise exception
        'raise_reconciliation_exception: detail.object_type must be one of payment_intent, charge, refund, checkout_session'
        using errcode = 'VK400';
    end if;
    if not (p_detail ? 'error_class')
       or (p_detail->>'error_class') not in ('malformed_object','object_not_found','object_scoped_bad_request') then
      raise exception
        'raise_reconciliation_exception: detail.error_class must be one of malformed_object, object_not_found, object_scoped_bad_request'
        using errcode = 'VK400';
    end if;
  end if;

  insert into finance.reconciliation_exceptions as ex (
    kind, livemode, detail, provider_object_id, ledger_entry_id,
    agreement_id, legacy_donation_id, amount_cents, currency,
    first_detected_at, last_detected_at, occurrence_count,
    first_run_id, last_run_id, consecutive_failure_runs, resolution_status
  ) values (
    p_kind, p_livemode, p_detail, p_provider_object_id, p_ledger_entry_id,
    p_agreement_id, p_legacy_donation_id, p_amount_cents, p_currency,
    v_now, v_now, 1,
    p_run_id, p_run_id,
    case when p_kind = 'provider_object_processing_failed' then 1 else 0 end,
    'open'
  )
  on conflict (dedup_key, livemode) where resolution_status = 'open'
  do update set
    last_detected_at = v_now,
    occurrence_count = ex.occurrence_count + 1,
    last_run_id      = coalesce(p_run_id, ex.last_run_id),
    -- Acceptance 18j: the streak counts RUNS, not occurrences, so it advances
    -- only when this raise belongs to a different run than the last one.
    consecutive_failure_runs = case
      when p_kind = 'provider_object_processing_failed'
       and p_run_id is not null
       and ex.last_run_id is distinct from p_run_id
      then ex.consecutive_failure_runs + 1
      else ex.consecutive_failure_runs
    end
  returning id into v_id;

  return v_id;
end $$;

-- Reset the failure streak after a successful examination (acceptance 18e/18j).
--
-- Finds the open row and clears the counter WITHOUT resolving it: the object
-- succeeded this time, but the exception remains open until a founder resolves
-- it. Resolution stays finance.resolve_exception()'s job alone.
create or replace function finance.reset_object_failure_streak(
  p_provider_object_id text,
  p_livemode           boolean
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $$
declare
  v_count integer;
begin
  if p_provider_object_id is null or length(trim(p_provider_object_id)) = 0 then
    raise exception 'reset_object_failure_streak: p_provider_object_id is required'
      using errcode = 'VK400';
  end if;
  if p_livemode is null then
    raise exception 'reset_object_failure_streak: p_livemode is required' using errcode = 'VK400';
  end if;

  update finance.reconciliation_exceptions
     set consecutive_failure_runs = 0
   where provider_object_id = p_provider_object_id
     and livemode           = p_livemode
     and resolution_status  = 'open'
     and kind               = 'provider_object_processing_failed'
     and consecutive_failure_runs <> 0
     -- A quarantined object stays quarantined until a founder releases it
     -- (finance.release_quarantine); a later success must not silently undo that.
     and quarantined_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Privileges — the EXECUTE grant IS the authorization boundary
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function finance.claim_stripe_events(boolean, integer, interval)          from public;
revoke all on function finance.complete_stripe_event(text, finance.event_processing_status, text) from public;
revoke all on function finance.sweep_stale_event_claims(boolean, interval)              from public;
revoke all on function finance.start_reconciliation_run(boolean, text, timestamptz, timestamptz, boolean, jsonb, uuid, uuid) from public;
revoke all on function finance.advance_reconciliation_run(uuid, jsonb, integer, integer, integer, integer, integer, integer) from public;
revoke all on function finance.finish_reconciliation_run(uuid, finance.run_status, boolean, text, jsonb) from public;
revoke all on function finance.abandon_stale_runs(interval)                             from public;
revoke all on function finance.raise_reconciliation_exception(finance.exception_kind, boolean, jsonb, uuid, text, uuid, uuid, uuid, bigint, text) from public;
revoke all on function finance.reset_object_failure_streak(text, boolean)               from public;

grant execute on function finance.claim_stripe_events(boolean, integer, interval)          to service_role;
grant execute on function finance.complete_stripe_event(text, finance.event_processing_status, text) to service_role;
grant execute on function finance.sweep_stale_event_claims(boolean, interval)              to service_role;
grant execute on function finance.start_reconciliation_run(boolean, text, timestamptz, timestamptz, boolean, jsonb, uuid, uuid) to service_role;
grant execute on function finance.advance_reconciliation_run(uuid, jsonb, integer, integer, integer, integer, integer, integer) to service_role;
grant execute on function finance.finish_reconciliation_run(uuid, finance.run_status, boolean, text, jsonb) to service_role;
grant execute on function finance.abandon_stale_runs(interval)                             to service_role;
grant execute on function finance.raise_reconciliation_exception(finance.exception_kind, boolean, jsonb, uuid, text, uuid, uuid, uuid, bigint, text) to service_role;
grant execute on function finance.reset_object_failure_streak(text, boolean)               to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Prove it took effect, in the same transaction that applied it
-- ─────────────────────────────────────────────────────────────────────────────

do $chk$
declare
  n_fns        integer;
  n_unpinned   integer;
  n_invoker    integer;
  n_public     integer;
  n_write_grant integer;
begin
  select count(*) into n_fns
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance'
     and p.proname in ('claim_stripe_events','complete_stripe_event','sweep_stale_event_claims',
                       'start_reconciliation_run','advance_reconciliation_run',
                       'finish_reconciliation_run','abandon_stale_runs',
                       'raise_reconciliation_exception','reset_object_failure_streak');
  if n_fns <> 9 then
    raise exception 'expected 9 mutation functions, found %', n_fns;
  end if;

  -- An unpinned search_path on a SECURITY DEFINER function is a privilege
  -- escalation route: the caller chooses which schema's objects the body resolves.
  select count(*) into n_unpinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                      where c like 'search\_path=%');
  if n_unpinned <> 0 then
    raise exception '% SECURITY DEFINER function(s) in finance have no pinned search_path', n_unpinned;
  end if;

  select count(*) into n_invoker
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and not p.prosecdef
     and p.proname in ('claim_stripe_events','complete_stripe_event','sweep_stale_event_claims',
                       'start_reconciliation_run','advance_reconciliation_run',
                       'finish_reconciliation_run','abandon_stale_runs',
                       'raise_reconciliation_exception','reset_object_failure_streak');
  if n_invoker <> 0 then
    raise exception '% mutation function(s) are SECURITY INVOKER and cannot write', n_invoker;
  end if;

  -- PUBLIC holding EXECUTE would make the grant boundary meaningless, since
  -- anon and authenticated both inherit it.
  select count(*) into n_public
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where n.nspname = 'finance'
     and p.proname in ('claim_stripe_events','complete_stripe_event','sweep_stale_event_claims',
                       'start_reconciliation_run','advance_reconciliation_run',
                       'finish_reconciliation_run','abandon_stale_runs',
                       'raise_reconciliation_exception','reset_object_failure_streak')
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE';
  if n_public <> 0 then
    raise exception 'PUBLIC still holds EXECUTE on % mutation function(s)', n_public;
  end if;

  -- The whole point: the append-only model must be unchanged by this migration.
  select count(*) into n_write_grant
    from information_schema.role_table_grants
   where table_schema = 'finance'
     and grantee in ('anon', 'authenticated', 'service_role')
     and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');
  if n_write_grant <> 0 then
    raise exception
      'append-only model violated: % UPDATE/DELETE/TRUNCATE grant(s) exist in finance', n_write_grant;
  end if;
end $chk$;
