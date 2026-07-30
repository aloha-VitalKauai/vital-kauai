-- Financials V2 PR 1 — the eight partial unique indexes (ARCHITECTURE §15).
-- PostgreSQL has no `UNIQUE ... WHERE` table constraint, so every partial rule
-- is an index. Non-partial uniqueness stays a table constraint (see §15).

-- 1. L8 — one ledger entry per Stripe object per mode
create unique index ledger_entries_provider_object_uq
  on finance.ledger_entries (provider_object_id, livemode)
  where provider_object_id is not null;

-- 2. L8b — one stripe_payment per PaymentIntent per mode
create unique index ledger_entries_payment_intent_uq
  on finance.ledger_entries (provider_payment_intent_id, livemode)
  where entry_type = 'stripe_payment';

-- 3. L9 — import idempotency; one legacy row may yield a payment and its refund
create unique index ledger_entries_legacy_donation_uq
  on finance.ledger_entries (legacy_donation_id, entry_type)
  where legacy_donation_id is not null;

-- 4. exactly one initial lifecycle event per agreement
create unique index agreement_lifecycle_initial_uq
  on finance.agreement_lifecycle_events (agreement_id)
  where from_status is null;

-- 5. at most one live Checkout Session per agreement per mode
create unique index checkout_sessions_live_uq
  on finance.checkout_sessions (agreement_id, livemode)
  where status in ('creating', 'open');

-- 6. one open exception per mismatch identity per mode
create unique index reconciliation_exceptions_open_uq
  on finance.reconciliation_exceptions (dedup_key, livemode)
  where resolution_status = 'open';

-- 7. single-flight reconciliation, per mode
create unique index reconciliation_runs_single_flight_uq
  on finance.reconciliation_runs (livemode)
  where status = 'running';

-- 8. lineage is a chain, not a tree
create unique index reconciliation_runs_resume_uq
  on finance.reconciliation_runs (resumed_from_run_id)
  where resumed_from_run_id is not null;

-- Supporting (non-unique) indexes for the canonical views' join paths.
create index ledger_entries_agreement_idx on finance.ledger_entries (agreement_id);
create index ledger_entries_parent_idx    on finance.ledger_entries (parent_entry_id)
  where parent_entry_id is not null;
create index agreement_amounts_lookup_idx on finance.agreement_amounts (agreement_id, effective_at desc, seq desc);
create index lifecycle_lookup_idx         on finance.agreement_lifecycle_events (agreement_id, occurred_at desc, seq desc);
create index agreements_member_idx        on finance.agreements (member_id);
create index agreements_journey_idx       on finance.agreements (journey_id) where journey_id is not null;
