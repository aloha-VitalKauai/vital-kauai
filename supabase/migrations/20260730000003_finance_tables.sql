-- Financials V2 PR 1 — the nine tables (ARCHITECTURE §1, §4-§12).
-- Cross-schema references are limited to stable identity objects: public.members,
-- public.journeys, auth.users. No finance object references a legacy financial table.

-- 1. agreements ------------------------------------------------------------
create table finance.agreements (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete restrict,
  journey_id  uuid null     references public.journeys(id) on delete restrict,
  purpose     finance.agreement_purpose not null,
  currency    text not null default 'usd' check (currency = 'usd'),
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id) on delete restrict,
  constraint agreements_member_journey_purpose_key
    unique nulls not distinct (member_id, journey_id, purpose)
);

-- 2. agreement_amounts (append-only fact) ----------------------------------
create table finance.agreement_amounts (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint not null generated always as identity,
  agreement_id  uuid not null references finance.agreements(id) on delete restrict,
  amount_cents  bigint not null check (amount_cents >= 0),
  effective_at  timestamptz not null,
  reason        text not null check (length(btrim(reason)) > 0),
  actor_id      uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now()
);

-- 3. agreement_lifecycle_events (append-only fact) -------------------------
create table finance.agreement_lifecycle_events (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint not null generated always as identity,
  agreement_id  uuid not null references finance.agreements(id) on delete restrict,
  from_status   finance.agreement_lifecycle null,
  to_status     finance.agreement_lifecycle not null,
  reason        text not null check (length(btrim(reason)) > 0),
  actor_id      uuid not null references auth.users(id) on delete restrict,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- 5. stripe_events ---------------------------------------------------------
-- Created before ledger_entries: ledger_entries.origin_stripe_event_id
-- references it (L11's join path).
create table finance.stripe_events (
  event_id          text primary key,
  event_type        text not null,
  object_id         text not null,
  livemode          boolean not null,
  processing_status finance.event_processing_status not null default 'received',
  claimed_at        timestamptz null,
  attempt_count     integer not null default 0 check (attempt_count >= 0),
  received_at       timestamptz not null default now(),
  processed_at      timestamptz null,
  processing_error  text null,
  payload           jsonb null
);

-- 4. ledger_entries (append-only fact) -------------------------------------
create table finance.ledger_entries (
  id                          uuid primary key default gen_random_uuid(),
  agreement_id                uuid not null references finance.agreements(id) on delete restrict,
  entry_type                  finance.ledger_entry_type not null,
  amount_cents                bigint not null check (amount_cents <> 0),
  currency                    text not null default 'usd' check (currency = 'usd'),
  source                      finance.ledger_source not null,
  external_method             finance.external_method null,
  provider_object_id          text null,
  provider_payment_intent_id  text null,
  parent_entry_id             uuid null references finance.ledger_entries(id) on delete restrict,
  occurred_at                 timestamptz not null,
  recorded_at                 timestamptz not null default now(),
  recorded_by                 uuid null references auth.users(id) on delete restrict,
  recorded_by_system          finance.system_actor null,
  reason                      text null,
  legacy_donation_id          uuid null,
  origin_stripe_event_id      text null references finance.stripe_events(event_id) on delete restrict,
  livemode                    boolean not null,

  -- L5: an entry cannot be its own parent
  constraint ledger_l5_not_self_parent check (parent_entry_id is distinct from id),

  -- exactly one attribution may be present
  constraint ledger_single_attribution
    check (num_nonnulls(recorded_by, recorded_by_system) <= 1),

  -- L1
  constraint ledger_l1_stripe_payment check (
    entry_type <> 'stripe_payment' or (
      amount_cents > 0 and source = 'stripe'
      and provider_payment_intent_id is not null
      and parent_entry_id is null)),

  -- L2 (attribution deferred to L12)
  constraint ledger_l2_external_payment check (
    entry_type <> 'external_payment' or (
      amount_cents > 0 and source = 'external'
      and external_method is not null
      and parent_entry_id is null)),

  -- L3
  constraint ledger_l3_refund check (
    entry_type <> 'refund' or (
      amount_cents < 0
      and parent_entry_id is not null
      and (source <> 'stripe'   or provider_object_id is not null)
      and (source <> 'external' or external_method is not null))),

  -- L12: external money and every reversal require a reason and one attribution
  constraint ledger_l12_attribution check (
    (source <> 'external' and entry_type <> 'reversal')
    or (reason is not null and length(btrim(reason)) > 0
        and num_nonnulls(recorded_by, recorded_by_system) = 1)),

  -- L13: provenance may not contradict source
  constraint ledger_l13_provenance check (
    (source <> 'stripe'   or external_method is null)
    and (source <> 'external' or (provider_object_id is null
                                  and provider_payment_intent_id is null)))
);

-- 6. checkout_sessions -----------------------------------------------------
create table finance.checkout_sessions (
  id                uuid primary key default gen_random_uuid(),
  agreement_id      uuid not null references finance.agreements(id) on delete restrict,
  stripe_session_id text null unique,
  idempotency_key   text not null unique,
  payment_link_id   uuid null,
  amount_cents      bigint not null check (amount_cents > 0),
  currency          text not null default 'usd' check (currency = 'usd'),
  livemode          boolean not null,
  status            finance.checkout_status not null default 'creating',
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz null,
  constraint checkout_session_id_present
    check (status = 'creating' or stripe_session_id is not null)
);

-- 7. payment_links ---------------------------------------------------------
create table finance.payment_links (
  id                     uuid primary key default gen_random_uuid(),
  agreement_id           uuid not null references finance.agreements(id) on delete restrict,
  token_hash             text not null unique,
  status                 finance.link_status not null default 'active',
  expires_at             timestamptz not null,
  claimed_at             timestamptz null,
  consumed_at            timestamptz null,
  consumed_by_session_id uuid null references finance.checkout_sessions(id) on delete restrict,
  revoked_at             timestamptz null,
  revoked_by             uuid null references auth.users(id) on delete restrict,
  attempt_count          integer not null default 0 check (attempt_count >= 0),
  created_at             timestamptz not null default now(),
  created_by             uuid not null references auth.users(id) on delete restrict,
  constraint link_creating_claimed
    check (status <> 'creating' or claimed_at is not null),
  constraint link_consumed_complete
    check (status <> 'consumed' or (consumed_at is not null and consumed_by_session_id is not null)),
  constraint link_revoked_complete
    check (status <> 'revoked' or (revoked_at is not null and revoked_by is not null))
);

alter table finance.checkout_sessions
  add constraint checkout_sessions_payment_link_id_fkey
  foreign key (payment_link_id) references finance.payment_links(id) on delete restrict;

-- 9. reconciliation_runs ---------------------------------------------------
-- Created before reconciliation_exceptions: the exceptions table references it.
create table finance.reconciliation_runs (
  id                     uuid primary key default gen_random_uuid(),
  livemode               boolean not null,
  implementation_version text not null,
  window_start           timestamptz not null,
  window_end             timestamptz not null,
  window_exhausted       boolean not null default false,
  cursor                 jsonb not null default '{}'::jsonb,
  status                 finance.run_status not null default 'running',
  resumed_from_run_id    uuid null references finance.reconciliation_runs(id) on delete restrict,
  started_at             timestamptz not null default now(),
  heartbeat_at           timestamptz not null default now(),
  finished_at            timestamptz null,
  objects_scanned        integer not null default 0,
  objects_matched        integer not null default 0,
  exceptions_created     integer not null default 0,
  exceptions_reopened    integer not null default 0,
  api_calls              integer not null default 0,
  retries                integer not null default 0,
  error                  text null,
  dry_run                boolean not null default false,
  would_create_count     integer null check (would_create_count >= 0),
  would_reopen_count     integer null check (would_reopen_count >= 0),
  prospective_by_kind    jsonb null,
  report_samples         jsonb null,
  report_version         text null,
  report_completed_at    timestamptz null,
  approved_by            uuid null references auth.users(id) on delete restrict,
  approved_at            timestamptz null,
  approval_note          text null,
  authorized_by_run_id   uuid null references finance.reconciliation_runs(id) on delete restrict,

  constraint run_window_ordered      check (window_end > window_start),
  constraint run_finished_at_consistent
    check ((status = 'running') = (finished_at is null)),
  -- biconditional (B-56/D-055): only completed may carry true, and completed
  -- may not carry false.
  constraint run_completed_iff_exhausted
    check ((status = 'completed') = window_exhausted),
  constraint run_no_self_resume      check (resumed_from_run_id is distinct from id),
  constraint run_no_self_authorize   check (authorized_by_run_id is distinct from id),
  constraint run_approval_pair       check ((approved_by is null) = (approved_at is null)),
  constraint run_approval_note_pair  check ((approved_at is null) = (approval_note is null)),
  constraint run_approval_note_nonblank
    check (approval_note is null or length(btrim(approval_note)) > 0),
  constraint run_writing_cites_authorization
    check (dry_run or authorized_by_run_id is not null),
  constraint run_dry_has_no_authorization
    check (not dry_run or authorized_by_run_id is null),
  constraint run_dry_writes_nothing
    check (not dry_run or (exceptions_created = 0 and exceptions_reopened = 0)),
  constraint run_report_only_on_dry_run
    check (dry_run or (would_create_count is null and would_reopen_count is null
                       and prospective_by_kind is null and report_samples is null
                       and report_version is null and report_completed_at is null)),
  constraint run_report_complete
    check (report_completed_at is null
           or (would_create_count is not null and would_reopen_count is not null
               and prospective_by_kind is not null and report_version is not null)),
  constraint run_no_approval_without_report
    check (approved_at is null or report_completed_at is not null)
);

-- 8. reconciliation_exceptions --------------------------------------------
create table finance.reconciliation_exceptions (
  id                  uuid primary key default gen_random_uuid(),
  kind                finance.exception_kind not null,
  agreement_id        uuid null references finance.agreements(id) on delete restrict,
  ledger_entry_id     uuid null references finance.ledger_entries(id) on delete restrict,
  provider_object_id  text null,
  legacy_donation_id  uuid null,
  livemode            boolean not null,
  amount_cents        bigint null,
  currency            text null check (currency is null or currency = 'usd'),
  detail              jsonb not null default '{}'::jsonb,
  -- Generated, not writer-supplied: a writer able to choose dedup_key defeats
  -- deduplication entirely. Every enum label is spelled out because
  -- enum-to-text is only STABLE, so `kind::text` will not compile here.
  dedup_key text not null generated always as (
    (case kind
       when 'unattributable_payment'::finance.exception_kind then 'unattributable_payment'
       when 'provider_without_ledger'::finance.exception_kind then 'provider_without_ledger'
       when 'ledger_without_provider'::finance.exception_kind then 'ledger_without_provider'
       when 'amount_mismatch'::finance.exception_kind then 'amount_mismatch'
       when 'currency_violation'::finance.exception_kind then 'currency_violation'
       when 'missing_provider_object'::finance.exception_kind then 'missing_provider_object'
       when 'orphan_refund'::finance.exception_kind then 'orphan_refund'
       when 'refund_status_regression'::finance.exception_kind then 'refund_status_regression'
       when 'stranded_checkout_attempt'::finance.exception_kind then 'stranded_checkout_attempt'
       when 'stale_session_expiry_failed'::finance.exception_kind then 'stale_session_expiry_failed'
       when 'reconciliation_run_failed'::finance.exception_kind then 'reconciliation_run_failed'
       when 'provider_object_processing_failed'::finance.exception_kind then 'provider_object_processing_failed'
     end) || ':' ||
    coalesce(provider_object_id, '')    || ':' ||
    coalesce(ledger_entry_id::text, '') || ':' ||
    coalesce(agreement_id::text, '')    || ':' ||
    coalesce(legacy_donation_id::text, '')
  ) stored,
  first_detected_at        timestamptz not null default now(),
  last_detected_at         timestamptz not null default now(),
  occurrence_count         integer not null default 1 check (occurrence_count >= 1),
  first_run_id             uuid null references finance.reconciliation_runs(id) on delete restrict,
  last_run_id              uuid null references finance.reconciliation_runs(id) on delete restrict,
  consecutive_failure_runs integer not null default 0 check (consecutive_failure_runs >= 0),
  quarantined_at           timestamptz null,
  quarantine_reason        text null,
  released_at              timestamptz null,
  released_by              uuid null references auth.users(id) on delete restrict,
  release_note             text null,
  resolution_status        finance.exception_resolution not null default 'open',
  resolved_at              timestamptz null,
  resolved_by              uuid null references auth.users(id) on delete restrict,
  resolution_note          text null,

  constraint exc_no_partial_attribution
    check ((resolved_at is null) = (resolved_by is null)),
  constraint exc_open_iff_unresolved
    check ((resolution_status = 'open') = (resolved_at is null)),
  constraint exc_note_iff_closed
    check ((resolution_status = 'open') = (resolution_note is null)),
  constraint exc_note_nonblank
    check (resolution_note is null or length(btrim(resolution_note)) > 0),
  constraint exc_detected_ordered
    check (last_detected_at >= first_detected_at),
  constraint exc_quarantine_pair
    check ((quarantined_at is null) = (quarantine_reason is null)),
  constraint exc_release_pair
    check ((released_at is null) = (released_by is null)),
  constraint exc_release_requires_quarantine
    check (released_at is null or quarantined_at is not null),
  -- B-58/B-63: rejects equality after a release while permitting the untouched
  -- state. `IS DISTINCT FROM` would be false when both are NULL and would have
  -- rejected every ordinary insert.
  constraint exc_monotonic_backstop
    check (released_at is null or released_at <> quarantined_at),
  constraint exc_processing_failure_shape check (
    kind <> 'provider_object_processing_failed' or (
      provider_object_id is not null
      and detail ? 'object_type'
      and detail ->> 'object_type' in ('payment_intent','charge','refund','checkout_session')
      and detail ? 'error_class'
      and detail ->> 'error_class' in ('malformed_object','object_not_found','object_scoped_bad_request')))
);
