# PR 9 — Retirement audit (evidence inventory)

Audit run against `origin/main` at **`85f7b82`**, 2026-08-22. This document is
the input D-086 requires; it did not exist when PR 9 was commissioned, so it was
produced by scanning the repository and the production database directly.

## 1. Application surfaces reading retired tables

~30 call sites across 14 files, all now removed or replaced:

| Surface | Retired objects read | Disposition |
| --- | --- | --- |
| 14 legacy route handlers under `/api/payments`, `/api/donations`, `/api/square` | all four retired tables | **deleted** |
| `app/pay/[token]/page.tsx` | `payment_tokens`, `financial_commitments`, `payment_allocations`, `donations` | **replaced** with a no-lookup retirement notice |
| `app/dashboard/[id]/page.tsx` | `financial_commitments`, `donations`, `payment_allocations`, `payment_tokens`, `private_ceremony_summary` | **replaced** with founder-safe V2 projections |
| `app/dashboard/page.tsx`, `app/dashboard/ops/page.tsx` | `financials_overview` | **replaced** with `finance_api.founder_financial_overview` |
| `MemberFinancialSection`, `DonateClient`, `JourneyPaymentCard`, `DonationCard`, `CohortAndPrivateTabs`, `PrivateCeremoniesTable`, `CohortMarginsTable`, `FinancialKpiRow`, `FinancialRecordsCard` | various | **deleted** (import proof: only self- or mutually-referential) |

## 2. Provider and scheduler scaffolding

- `lib/payment-provider.ts`, `lib/square/client.ts` — **deleted**
- `lib/payments/legacy-enabled.ts`, `legacy-enabled-client.ts` — **deleted**
- `PAYMENT_PROVIDER`, `SQUARE_*`, `LEGACY_PAYMENTS_ENABLED` — **removed from `.env.example`**
- `/api/cron/reconcile` + its `vercel.json` schedule — **deleted**; the three V2/journey crons remain

## 3. Database findings (production, read-only)

| Check | Result |
| --- | --- |
| Retired table rows | `donations=0 financial_commitments=0 payment_tokens=0 payment_allocations=0` |
| Freeze triggers | **12**, all `tgenabled='A'` (ALWAYS — fires even in replica) |
| Write grants to API roles on retired tables | **0** |
| `fn_reconcile_financial_state` | exists; **zero** dependent objects, **zero** triggers, zero application callers |
| Retired derived views | all three still present in the database (unread by application code after PR 9) |
| `expense_entries` / `payout_commitments` | `0` / `0` rows |

The three retired views are intentionally left in place: they are inert without
callers, and dropping them is outside the one bounded migration D-086 permits.

## 4. False positives found and cleared

- `lib/integration-content/pre-ceremony-weeks.ts` matched the provider scan on a
  stale comment about `PAYMENT_PROVIDER=square`. Comment corrected; no code.
- `app/api/finance/stripe-webhook/route.ts` and `lib/finance/stripe-events.ts`
  matched the flag scan **in doc comments only**, describing their deliberate
  independence from the legacy gate. Reworded.
- `supabase/tests/legacy-loader.mjs` is the TypeScript loader for the entire
  test suite, not a legacy-financial artefact despite its name. **Retained**; its
  stub list was pruned of the two now-deleted modules.

## 5. Deliberate deviation from the build spec

§10a and directive step 8 require removing `app/api/expenses`,
`app/api/payouts` and `mark-paid`. Founder-authorized deviation: these are
**retained** until PR 11 delivers append-only expenses with voids. Removing them
now would leave no way to record an expense or payout at all. Both tables are
empty, so no data is at risk. No hard-delete control was added, per D-086.

One legacy expense row (`$1,000`, `medicine/alek/price`, created 2026-04-27) was
removed by direct SQL on founder authorization before PR 9; its full contents are
recorded for recoverability.
