-- Financials V2 PR 1 — schema and the thirteen enum types (ARCHITECTURE §1).

create schema if not exists finance;

comment on schema finance is
  'Financials V2. Never references or writes a legacy financial table (ARCHITECTURE §0).';

create type finance.agreement_purpose as enum
  ('journey_contribution', 'membership', 'additional_gift', 'other');

create type finance.agreement_lifecycle as enum
  ('draft', 'active', 'fulfilled', 'canceled', 'waived');

create type finance.ledger_entry_type as enum
  ('stripe_payment', 'external_payment', 'refund', 'reversal');

create type finance.ledger_source as enum ('stripe', 'external');

create type finance.external_method as enum
  ('check', 'cash', 'wire', 'zelle', 'venmo', 'other');

create type finance.payment_state as enum
  ('unpaid', 'partial', 'paid', 'overpaid', 'refunded', 'not_applicable');

create type finance.event_processing_status as enum
  ('received', 'processing', 'processed', 'failed', 'ignored');

create type finance.exception_kind as enum (
  'unattributable_payment', 'provider_without_ledger', 'ledger_without_provider',
  'amount_mismatch', 'currency_violation', 'missing_provider_object',
  'orphan_refund', 'refund_status_regression', 'stranded_checkout_attempt',
  'stale_session_expiry_failed', 'reconciliation_run_failed',
  'provider_object_processing_failed');

create type finance.exception_resolution as enum ('open', 'resolved', 'dismissed');

create type finance.checkout_status as enum
  ('creating', 'open', 'completed', 'expired', 'canceled');

create type finance.link_status as enum ('active', 'creating', 'consumed', 'revoked');

create type finance.system_actor as enum
  ('reconciliation', 'legacy_import', 'checkout_sweeper');

-- Five values per D-045 and D-072. `partial` is load-bearing: without it a run
-- stopping at a work ceiling must be recorded `completed`, and since only a
-- completed run advances the watermark the next window would start after
-- everything the bounded run never reached (the B-46 defect).
create type finance.run_status as enum
  ('running', 'partial', 'completed', 'failed', 'abandoned');
