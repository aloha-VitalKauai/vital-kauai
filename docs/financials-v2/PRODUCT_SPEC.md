# Financials V2 — Product Specification

**Status:** Approved with revisions (2026-07-29).
**Companion documents:** [ARCHITECTURE.md](ARCHITECTURE.md) · [PR_PLAN.md](PR_PLAN.md) · [DECISIONS.md](DECISIONS.md) · [HANDOFF.md](HANDOFF.md)

---

## 1. Purpose

Vital Kauai must be able to answer, for any member, at any moment, with one unambiguous answer:

- What did this person agree to contribute?
- How much have they actually paid?
- How much is genuinely outstanding?
- Where did each payment come from, and who recorded it?

The current system cannot answer these reliably. The same label means different things on different screens, agreed amounts are silently rewritten, and founder accounting adjustments are indistinguishable from real card payments. Financials V2 exists to make each of these questions have exactly one correct answer, derived from an append-only record of what actually happened.

## 2. Definitions — one meaning each

These five terms have exactly one definition across the entire product. No screen, route, email, or report may define them differently.

| Term | Definition | Source |
|---|---|---|
| **Contribution** | What the member agreed to contribute. Founder-entered. | Latest effective row in `finance.agreement_amounts` |
| **Received** | **Attributed** money that actually moved, net of refunds and reversals. | `SUM` of all `finance.ledger_entries` for the agreement where `livemode = true` |
| **Remaining** | Contribution minus Received. Retained signed; negative means overpaid. | Calculated in `finance.v_agreement_balances` |
| **Payable Remaining** | Remaining, floored at zero. The only figure that may reach a charge request. | Calculated in `finance.v_agreement_balances` |
| **Payment state** | `unpaid`, `partial`, `paid`, `overpaid`, `refunded`, or `not_applicable`. | Calculated in `finance.v_agreement_balances` |

**"Attributed" is load-bearing.** Money that cannot be tied to an agreement never enters the ledger; it goes to the reconciliation exceptions queue. Received therefore means *attributed* money that moved, and the exceptions queue is where anything else is visible and actionable.

**Received on member-facing surfaces means `net_received_cents`** — the net figure, after refunds and reversals. The gross figure exists in the balance view for founder reconciliation and never appears on a member screen, so "what you have paid" has one meaning wherever a member sees it. A member who paid and was fully refunded sees Received of `$0`, a payment history showing both movements, and the state `refunded`.

**`not_applicable`** covers gifts and other unowed money, where Remaining has no meaning. Those agreements contribute to Received and are excluded from Remaining totals.

Two further distinctions are first-class, not metadata conventions:

- **Stripe-confirmed vs founder-recorded.** Every ledger entry declares its `source` (`stripe` or `external`) and, for external money, its `external_method` and the founder who recorded it.
- **Financial state vs operational state.** Agreement lifecycle (`draft`, `active`, `fulfilled`, `canceled`, `waived`) is operational and **never** affects Received, Remaining, or payment state.

## 3. Functional requirements

### Founder

- Create an agreement for a member, optionally scoped to a journey.
- Set and amend the Contribution. Every amendment records an actor and a reason, and the prior value is preserved permanently.
- Record an external payment (check, cash, wire, Zelle, Venmo, other), with attribution.
- Correct a mistaken entry by issuing an attributed reversal, then recording the correct entry. Nothing is ever edited or deleted.
- Issue, email, and revoke single-use payment links.
- View per-member and per-journey financial positions, all derived from one definition.
- Review and resolve reconciliation exceptions.

### Member

- See their Contribution, what they have paid, and what remains.
- Pay the payable remaining amount by card.
- See a truthful payment history distinguishing card payments from payments recorded on their behalf.

### System

- Ingest Stripe webhooks exactly once, and remain correct under duplicate delivery, out-of-order delivery, concurrent processing, and replay after failure.
- Reconcile the ledger against Stripe on a schedule. Reconciliation may ingest provider payments and refunds it has verified and attributed — the same rule as the webhook path, reached by polling rather than push. It may **never** issue a reversal or resolve an exception; those are founder judgements (ARCHITECTURE §10a).
- Never present a stale financial figure — every displayed number is computed at read time.
- Never send a negative amount to a payment provider.

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| **Integrity** | The three fact tables — `finance.ledger_entries`, `finance.agreement_amounts`, `finance.agreement_lifecycle_events` — are append-only. No `UPDATE` or `DELETE` path exists against them for members, founders, or application roles. Protocol and operational tables (`stripe_events`, `checkout_sessions`, `payment_links`, `reconciliation_exceptions`) carry no financial truth and require bounded updates by design. |
| **Auditability** | Every financial fact carries who, when, and why. Every amendment and lifecycle transition is attributed. |
| **Determinism** | Contribution and payment state resolve through total orderings — never ambiguous, never dependent on row insertion order alone. |
| **Reproducibility** | The entire schema is created from tracked migrations. A fresh database reset produces a working system. |
| **Re-entrancy** | Every scheduled job is safe to interrupt, resume and rerun. A rerun over an already-processed window creates nothing new. |
| **Isolation** | Member A cannot read Member B's financial data. Proven by automated test, not assumed. |
| **Precision** | Integer cents only. No floating-point arithmetic in any financial path. |

## 5. Data handling and privacy

Stripe webhook payloads are **sanitized before storage**.

**Retained:** provider object identifiers, payment intent identifiers, amount, currency, status, `livemode`, and event timestamps.

**Stripped:** cardholder name, billing and shipping addresses, raw customer email and phone, and any payment-method detail beyond the provider reference.

**Access:** founder role and verified server infrastructure only; members cannot read `finance.stripe_events`.

**Retention:** sanitized payloads are retained for **24 months**, after which the row keeps its identifiers, timing, and processing state while the payload body is nulled. `finance.stripe_events.payload` is therefore nullable, and the retention job ships in **PR 3** alongside the reconciliation job. Ledger entries are retained indefinitely as financial records.

## 6. Migration of history

Real financial history is preserved; the legacy model is not.

**Imported:** legacy `donations` rows evidencing money that actually moved — Stripe-confirmed payments with a provider reference, and founder-recorded offline payments with attribution. **Historic refunds are imported too**, in a second pass once their parent payments exist. Omitting them would overstate Received for every historically refunded member and would contaminate the variance report with deltas indistinguishable from adjustment deltas. Each imported row carries `legacy_donation_id` for traceability.

**Not imported:** synthetic rows created by the legacy `adjust-collected` route. These are accounting adjustments, not money. Importing them would populate a real-money ledger with figures no payment corresponds to.

**Consequence, stated plainly:** wherever a legacy adjustment was applied, V2 will show a different figure than today's dashboard. This is the intended outcome — the difference is the finding. PR 2 produces a per-member variance report itemising every delta for founder adjudication. Genuine discrepancies are resolved by explicit, attributed ledger entries, visible permanently.

## 7. Success criteria

V2 is complete when:

1. Every money figure shown to a founder or member derives from `finance.v_agreement_balances`.
2. No V2 code path writes a legacy financial table, and no V2 database object references one. The only legacy reads are the four named, read-only surfaces in `ARCHITECTURE.md` §0a, all of which are retired at PR 9.
3. The shadow comparison has been reviewed and every variance is explained or resolved.
4. All PR 1 acceptance tests pass on a fresh database.
5. Legacy financial tables are frozen reference data and legacy financial display is retired.

## 8. Out of scope for V2

- Multi-currency agreements, FX conversion, cross-currency totals.
- Scheduled or future-dated Contribution amendments.
- Payment plans, instalment schedules, and automatic recurring billing.
- Invoice or receipt document generation. Stripe issues its own receipts.
- Payment-provider abstraction. V2 targets Stripe; the dormant Square scaffolding is not carried forward.
- Reconciliation of every legacy field. Facts migrate; structure does not.

Anything on this list requires a `DECISIONS.md` entry and explicit approval before work begins.
