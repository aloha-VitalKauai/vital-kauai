-- Extend the existing `donations` payment ledger with Square reference IDs.
--
-- Decision: `donations` stays the per-transaction ledger across providers
-- (Stripe columns are already here). PR 2 wires the Square webhook to
-- INSERT a donation row per Square payment, populating these IDs and
-- updating bookings.amount_paid_cents alongside.
--
-- Additive only — no existing rows or constraints are modified.

alter table public.donations
  add column if not exists square_payment_link_id text,
  add column if not exists square_payment_id      text,
  add column if not exists square_order_id        text,
  add column if not exists square_customer_id     text;

-- Webhook lookup path: incoming Square payment.id → donation row.
-- Partial index keeps it cheap (no row for the pre-existing Stripe history).
create index if not exists donations_square_payment_id_idx
  on public.donations (square_payment_id)
  where square_payment_id is not null;

create index if not exists donations_square_order_id_idx
  on public.donations (square_order_id)
  where square_order_id is not null;
