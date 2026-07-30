# Financials V2 — Legacy System Audit

**Date:** 2026-07-29 · **Method:** five parallel read-only auditors plus targeted verification greps · **Changes made:** none.

This document records what the legacy financial system *is*, and separates evidence by how strongly it is established. It is the "why" behind [ARCHITECTURE.md](ARCHITECTURE.md). It is reference material — the legacy system is never extended.

---

## 0. Evidence classes

Findings are labelled by provenance, because they do not carry equal weight.

| Class | Meaning |
|---|---|
| **[VERIFIED]** | Confirmed by direct command output during the audit. Highest confidence. |
| **[MAIN]** | Read from code as it exists on `origin/main` — deployed behaviour. |
| **[DIRTY]** | Observed only in the uncommitted working tree of `claude/audit-fixes`. **Not deployed.** May never ship. |
| **[INFERRED]** | Reconstructed from usage because the defining DDL is absent from version control. Treat as a hypothesis to confirm against the live database. |

**The audit was performed against the working tree of `claude/audit-fixes`**, which carried 32 modified files, roughly 12 untracked files, and 7 unpushed commits. Where a finding could differ between that tree and `main`, it is marked `[DIRTY]`.

---

## 1. Verified legacy behaviour

Established by direct command output.

**[VERIFIED] The core ledger schema is absent from version control.** A grep for `CREATE TABLE` against `supabase/migrations/` matching `donations`, `financial_commitments`, `payment_allocations`, `payment_tokens`, `payout_commitments`, or `expense_entries` returns nothing. Their DDL, constraints and RLS exist only in the live Supabase project. A fresh `supabase db reset` would fail, because later migrations `ALTER` and view over tables that do not exist.

**[VERIFIED] Two displayed views have no definition in the repository.** Of four views read by application code, only `financials_overview` and `private_ceremony_summary` are defined in migrations. `cohort_margin_summary` and `member_financial_overview` are queried and typed but never created in tracked SQL, so their money computations cannot be traced from the repository.

**[VERIFIED] Branch state at audit time.** `claude/audit-fixes` was 7 commits ahead of `origin`, with 32 modified and roughly 12 untracked files. Several modified files touch financial routes.

**[VERIFIED] A GitHub personal access token is embedded in plaintext in the git remote URL.** This is a repository-security issue, independent of Financials V2. *The Stripe credentials encountered during the audit were not live credentials; the live Stripe account is not implicated.*

**[VERIFIED] `member_profiles.id` equals `auth.users.id`; `members.id` does not.** Two migrations exist solely to repair foreign keys written against the wrong assumption — `20260509000000_repoint_ceremony_progress_fks.sql` and `20260509010000_repoint_followup_tasks_member_fk.sql`. The second names the trigger: a manual admin seed where `members.id != auth.users.id`. The true link is `members.profile_id = auth.uid()`, and it is nullable.

---

## 2. Deployed behaviour on `main`

**[MAIN] Five financial terms, none with a single definition.**

- *Contribution / Booked / Pledged* resolves through a three-step fallback ladder: `financial_commitments.expected_amount_cents`, then `members.program_price * 100`, then zero. The label differs per screen, and `billing_config`'s "Contribution" is an unrelated concept.
- *Collected* is ledger-derived but filtered two different ways: per-journey sums **all** donation kinds, while the global revenue KPI sums only `initial_membership` and `journey_contribution`. An `additional_gift` therefore raises a member's collected figure without raising global revenue.
- *Remaining / Outstanding* is computed on at least four different bases across surfaces — journey-scoped donation sums on one screen, per-commitment allocation sums on another.
- *Payment status* exists as two disjoint stored vocabularies with no mapping: `financial_commitments.status` and `bookings.payment_status`. A member can be `paid` in one and `unpaid` in the other.
- *Stripe-confirmed versus founder-recorded* is distinguishable only by `metadata` convention. Offline and synthetic-adjustment rows both display as "via portal".

**[MAIN] Three routes silently rewrite the agreed amount.** `adjust-outstanding` and `adjust-booked` both write `expected_amount_cents`, as does a direct client edit — three paths, three rule sets, no record of the prior value.

**[MAIN] `adjust-collected` inserts synthetic donations.** It writes a real `donations` row of `target − current`, permitted to be negative, with no `payment_allocations` row. This moves the donation-summed figures shown on the private-ceremony tab and member detail, but not the allocation-summed figures used by the pay page and the payment-link email — so the number a founder edits and the number a member is asked to pay can silently disagree.

**[MAIN] The Stripe webhook has no event-ID idempotency.** Deduplication relies entirely on donation-row status guards. A replayed `charge.refunded` still flips an already-`completed` row to `refunded`.

**[MAIN] The webhook is the sole writer of terminal state, with no reconciliation.** If delivery fails, the card is charged and the donation stays `pending` permanently.

**[MAIN] Every checkout attempt inserts a pending donation**, so abandoned checkouts leave permanent orphan rows. No idempotency key is sent to Stripe on session creation.

**[MAIN] Payment tokens are multi-use until success.** `consumed_at` is stamped only by the webhook, never at page load, so one token can open unlimited checkout sessions. The public pay route has no per-user authorization and no rate limiting.

**[MAIN] Allocation is subject to a race.** Capacity is summed and then inserted with no lock or unique constraint, so two concurrent completed webhooks can both read the same prior total and over-allocate.

**[MAIN] Security for the money ledger lives entirely in application code.** Every `/api/payments/*` route uses a service-role client, which bypasses RLS. The one in-repo money-adjacent policy set inlines founder UUIDs across three policies and reaches members through an email join.

**[MAIN] Square is scaffolded end to end but switched off.** `PAYMENT_PROVIDER` is unset, so the provider resolves to Stripe; the Square link route returns 400 and the Square webhook returns 500 unconfigured. Square and Stripe share the same `donations` and `bookings` tables through additive `square_*` columns. The dormant Square webhook contains a self-heal path that inserts a donation with a hardcoded placeholder `member_id` of all zeroes — a latent data-integrity hazard if ever enabled.

**[MAIN] Unit drift.** `members.program_price` is stored in dollars while every other money figure is in cents, and one operations screen divides it by 1000 for display. Three different currency formatters render the same value differently across surfaces.

---

## 3. Dirty-branch-only findings

**[DIRTY] Not deployed and possibly never shipping.** At audit time the following financial files were modified in the working tree but uncommitted: `create-journey-session`, `email-link`, `generate-link`, `pay/[token]`, `square/create-payment-link`, `donations/create-session`, `donations/create-gift-session`.

Any behaviour observed in those files during the audit describes the working tree, **not production**. Financials V2 draws no design conclusion from them. They remain the founder's to resolve independently — see `HANDOFF.md` risk R-2.

---

## 4. Inferred, requiring live confirmation

**[INFERRED] The shape of every core money table.** `donations`, `financial_commitments`, `payment_allocations`, `payment_tokens`, `payout_commitments`, `expense_entries` and `billing_config` were reconstructed from query usage. Column types, defaults, constraints and RLS are unconfirmed.

**[INFERRED] Whether RLS is enabled at all on those tables.** It cannot be determined from the repository.

**[VERIFIED — resolved 2026-07-29] `members.profile_id` uniqueness and population.** Confirmed read-only against `Vital-Kauai-prod`: `uq_members_profile_id` already exists (`UNIQUE (profile_id) WHERE profile_id IS NOT NULL`); 0 duplicate groups; 0 rows with `profile_id IS NULL`; **2 of 17 rows with `id <> profile_id`**; PostgreSQL 17.6. See D-038. This was the last item blocking PR 1's identity work.

**[VERIFIED] `public.is_founder()` is `SECURITY DEFINER` with no `SET search_path`.** Live definition confirmed 2026-07-29: `SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'founder')`. Suitable for V2's purpose, but the missing `search_path` is a privilege-escalation shape that V2 inherits — see `HANDOFF.md` risk R-5.

**[INFERRED] The definitions of `cohort_margin_summary` and `member_financial_overview`.**

Because so much of the legacy system is unreadable from the repository, **shadow comparison in PRs 3 and 4 carries more evidentiary weight than code reading.** Behaviour is settled by observed figures, not by inference.

---

## 5. V2 design decisions this audit drove

| Audit finding | V2 response |
|---|---|
| Schema un-versioned | Every object created from tracked migrations; fresh-reset test in PR 1 |
| Derived values stored and drifting | No derived value stored; formulas live only in `v_agreement_balances` |
| Agreed amount mutated in place by three paths | Append-only `agreement_amounts` with actor and reason |
| Provenance by `metadata` convention | First-class `entry_type`, `source`, `external_method` |
| Synthetic adjustments indistinguishable from money | No generic correction type; corrections are attributed reversals |
| Two disjoint status vocabularies | One computed `payment_state`; lifecycle kept structurally separate |
| No event idempotency | `stripe_events.event_id` primary key plus independent ledger uniqueness on the Stripe object |
| Webhook as sole writer | Reconciliation job enumerating provider objects, plus an exceptions queue |
| Orphan pending rows | Checkout attempts modelled separately from the ledger |
| Multi-use tokens | Atomic consumption at session creation |
| Allocation race | Ledger invariants with row locking |
| Security in app code only | RLS forced on all nine tables, versioned `is_founder()`, no hardcoded UUIDs |
| Email-based member join | `finance.current_member_id()` via `members.profile_id`; email join forbidden |
| Dollars-versus-cents drift | Integer cents throughout, no floating point |

---

## 6. Legacy facts that may be imported

Only evidence that **money actually moved**:

- Completed donations carrying a Stripe provider reference → `stripe_payment`. Where a charge-object id is absent but a payment-intent id is present, the entry imports with `provider_object_id` NULL and raises a `missing_provider_object` exception for backfill. It is **never** relabelled as external, which would falsely mark Stripe money as founder-recorded.
- Completed donations flagged `metadata.offline` with founder attribution → `external_payment`.
- **Historic refunds**, imported in a second pass after their parents exist. A refund whose parent is not importable raises an `orphan_refund` exception rather than being dropped.

Every imported row carries `legacy_donation_id`, `livemode = true`, and a reason naming the import batch. Import is idempotent under the `(legacy_donation_id, entry_type)` unique index.

---

## 7. Legacy fields and adjustments that stay excluded

**Excluded permanently:**

- **Synthetic `adjust-collected` rows** — accounting adjustments, not money. Importing them would populate a real-money ledger with figures no payment corresponds to. This is the single largest source of expected variance at import, and each delta is itemised in the PR 2 report for adjudication.
- **`members.program_price`** — the legacy fallback rung, in dollars. V2 Contribution comes from `agreement_amounts` only.
- **`bookings.amount_due_cents`, `bookings.amount_paid_cents`, `bookings.payment_status`** — denormalized values maintained by hand and by a webhook that never went live.
- **`financial_commitments.status`** — replaced by computed `payment_state` plus separately modelled lifecycle.
- **`payment_allocations`** — the second, divergent "collected" store. V2 has one ledger, so allocation-versus-donation divergence cannot recur.
- **All `square_*` columns**, on both `donations` and `bookings` — a provider that never went live.
- **`donations.kind` as a revenue filter** — the mechanism by which per-journey and global "collected" disagreed.

**Not carried forward:** the `bookings` payment model, the Square integration, and payment-provider abstraction generally. V2 targets Stripe.
