# PR 10 — preflight and decision record

Run against post-PR-9 `origin/main` at `a409dd6` (then `2076fee` after D-087),
2026-08-23. Required by the D-088 directive before schema work.

## Preflight findings

| Check | Result |
| --- | --- |
| PR 9 retirement gate | clean on `origin/main` |
| Public-support objects | none of the six tables existed — clean slate |
| `/support` route | absent |
| QR tooling | none installed; a QR library is added in 10C |
| Stripe SDK | `stripe@^22.0.2`, pinned `2026-03-25.dahlia` (`STRIPE_V2_API_VERSION`) |
| Webhook entrance | `/api/finance/stripe-webhook` — signed, sole Stripe entrance; reused |
| Worker object families | D-080 20-event subscription; `payment_intent.succeeded` routing extended in 10B by metadata discriminator (`public_support_v1` vs member `v2`) |
| Member baseline | 1 ledger entry (10000¢), 3 agreements, 5 events processed, 0 exceptions |
| `finance` / `finance_api` exposure | both closed to anon pre-10A |

## Reuse decisions

- **Reused unchanged:** signed webhook route, `stripe_events` recording
  (D-081 semantics), worker claim loop, reconciliation run machinery,
  `v2StripeClient` pinning.
- **Extended in 10B:** worker `payment_intent.succeeded` branch gains a
  `financial_version` discriminator; reconciliation matches provider objects
  against member ledger AND public-support entries.
- **New:** the six public-support tables, the public status function, founder
  configuration, Payment Link activation (10B), receipts + QR (10C).

## Founder-settled decisions (recorded, not verified)

- Receiving entity **Vital Kauaʻi Church**; fund **General Support**; no
  public fund selector in v1.
- Tax basis stated by the founder: **church under 508(c)(1)(A)** — held as
  configuration (`legal_entities.tax_exempt_basis`); engineering does not
  verify or independently assert tax status. Legal name, EIN and footer are
  founder-configured at runtime, never in source or chat.
- Staged as **three PRs**: 10A schema/façades/proofs (fail-closed) →
  10B provider + ingestion + reconciliation → 10C public pages, receipts,
  founder controls, QR.

## 10A fail-closed posture

The seeded entity has no legal name and acknowledgments disabled; the seeded
campaign is `draft`; a database trigger (`VK428`) refuses activation until the
founder configures the receipt identity — application code cannot forget the
check because it does not own it. anon's entire `finance_api` surface is one
DEFINER function returning campaign-safe fields, asserted in-transaction.
