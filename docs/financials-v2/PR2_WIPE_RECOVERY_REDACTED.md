# PR 2 closeout — redacted recovery record for the founder-authorised wipe

Safe to commit. Contains **no member identifiers, no email addresses, no payment
tokens, no Stripe object identifiers**. It carries only what is needed to recreate
the two genuine participants' financial records by hand.

The unredacted archive is held locally, outside version control, at
`~/Downloads/vital-kauai-financial-wipe-archive-2026-08-13T15-30-39HST.md`,
mode `600`. Its SHA-256 is recorded in the founder's own records and in the
session transcript; it is deliberately not repeated here so this file cannot be
used to verify a leaked copy. `.gitignore` blocks any path matching
`*wipe-archive*`, and `lib/payments/legacy-shutdown.test.ts` fails the build if
such a file is ever tracked.

## What was removed

Executed 2026-08-14T01:30:39Z UTC (2026-08-13 15:30 HST), production project
Vital-Kauaʻi-prod, on explicit founder authorisation. See **D-077**.

| Table | Rows deleted |
|---|---|
| `public.donations` | 20 |
| `public.financial_commitments` | 14 |
| `public.payment_tokens` | 3 |
| `public.payment_allocations` | 0 |

Preserved: `public.bookings` (11 rows, operational booking status, `$0` paid on
every row), all 17 member records, and the entire `finance` schema, which remained
at zero state throughout and was never referenced by any deleted row.

## Why this was safe

- Every donation carrying a Stripe session used a **test-mode** session
  identifier. Zero live-mode identifiers existed. Checkout Session ids are the
  only Stripe object type that encodes mode, so this is conclusive.
- **No donation ever completed.** All sessioned rows were `status = "pending"`.
- The two rows without any provider identifier were tagged in their own metadata
  as a pre-launch manual backfill, and both were already refunded.
- All donation rows belonged to the founder's own account, the organisation's own
  account, or one internal staff member. No external participant held one.
- Square columns existed on two tables but were never populated.

## Recreating the two genuine participants

Neither person had received any money. Both records were forward-looking only.

**Participant A — "Brodie"**
- One `financial_commitments` row
- kind `journey_contribution`, status `draft`
- `expected_amount_cents` **0**
- created 2026-06-25
- associated with one journey (identifier held only in the local archive)

**Participant B — "Chris"**
- One `financial_commitments` row
- kind `journey_contribution`, status `draft`
- `expected_amount_cents` **750000** ($7,500.00)
- created 2026-05-29
- associated with one journey (identifier held only in the local archive)
- Also one `bookings` row, **preserved and not deleted**: `booking_status`
  `invited`, `amount_due_cents` 700000 ($7,000.00), `amount_paid_cents` 0

Note the two figures disagree: the commitment expected $7,500 while the surviving
booking records $7,000 due. That discrepancy predates the wipe and should be
resolved by the founder before either figure is re-entered as authoritative.

## Supersedes

This record supersedes decision **P2-D1** ("no deletion, ever, of legacy financial
rows"). See `DECISIONS.md` **D-077** for the superseding decision and its full
rationale, and **D-078** for the related legacy Stripe shutdown.
