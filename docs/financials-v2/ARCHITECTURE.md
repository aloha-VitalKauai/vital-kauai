# Financials V2 — Architecture

**Status:** Approved with revisions (2026-07-29). Revision 2 incorporates adversarial-review findings F-1…F-29.
**Companion documents:** [PRODUCT_SPEC.md](PRODUCT_SPEC.md) · [PR_PLAN.md](PR_PLAN.md) · [DECISIONS.md](DECISIONS.md) · [HANDOFF.md](HANDOFF.md)

---

## 0. Governing decisions

These are settled. Any change requires a new entry in `DECISIONS.md`.

1. **V2 lives in a tracked `finance` schema.** Every object is created by a migration in `supabase/migrations/`. Nothing exists in the database that is absent from version control.
2. **No V2 database object references a legacy financial table.** No foreign key, no view, no function spans both. **No V2 write path touches legacy.** One narrow, named exception exists for read-only comparison surfaces during migration — see §0a.
3. **Legacy financial code is reference material only.** It is read to understand history, never extended.
4. **Recorded financial facts are append-only.** The three fact tables — `ledger_entries`, `agreement_amounts`, `agreement_lifecycle_events` — accept no `UPDATE` and no `DELETE`. Errors are corrected by attributed reversal.
5. **Calculations exist in canonical views.** No derived money value is ever stored in a table.
6. **Real history is preserved without preserving the legacy model.** Facts migrate; structure does not.

## 0a. The comparison carve-out

Shadow verification requires putting V2 and legacy figures side by side, which is impossible if nothing may read legacy. The rule is therefore scoped precisely:

| Layer | Rule |
|---|---|
| **Schema** | No `finance` object may reference a legacy table. Absolute, no exception. |
| **Write paths** | No V2 code path may write a legacy table. Absolute, no exception. |
| **Read paths** | Legacy reads are permitted **only** in these named surfaces: the PR 2 import and variance report, the PR 4 founder shadow/diff page, the PR 7 founder flag-off read path, and the PR 8 member flag-off read path. |

All four are read-only and temporary, and every one is removed or retired at PR 9. The first three are founder-scoped. The fourth is not: PR 8's member surface must render *something* when its flag is off, and that something is the existing legacy figure. This is the pre-existing legacy display continuing to work behind a flag, not a new legacy dependency — consistent with the rule that legacy routes remain until the new path is proven. Any legacy read outside these four is a defect. Any other legacy read is a defect. `finance.ledger_entries.legacy_donation_id` remains an **unconstrained** `uuid` carrying no foreign key, so V2 retains no structural dependency and legacy rows may be frozen or archived without affecting V2 integrity.

---

## 1. Object inventory — exactly eight tables

| # | Table | Purpose | Mutability |
|---|---|---|---|
| 1 | `finance.agreements` | Identity of a financial agreement. No amount, no status. | Insert-only |
| 2 | `finance.agreement_amounts` | Append-only amendment history of the agreed Contribution. | **Append-only fact** |
| 3 | `finance.agreement_lifecycle_events` | Append-only operational lifecycle transitions. | **Append-only fact** |
| 4 | `finance.ledger_entries` | Canonical record of money movements and their attributed corrections. Sole source of Received. | **Append-only fact** |
| 5 | `finance.stripe_events` | Webhook ingestion, idempotency, processing state. | Insert + processing-state update + retention nulling |
| 6 | `finance.checkout_sessions` | Checkout attempts. An attempt is not a payment. | Insert + status update |
| 7 | `finance.payment_links` | Hashed, expiring, revocable, single-use pay links. | Insert + one-shot consumption/revocation |
| 8 | `finance.reconciliation_exceptions` | Money that cannot be attributed, and provider/ledger mismatches. | Insert + resolution update |

Tables 2–4 are the **append-only fact tables**; §0.4 applies to them and only them. Tables 5–8 are protocol and operational machinery carrying no financial truth, and they require bounded updates by design.

### Enum inventory

PR 1 creates exactly ten enum types:

| Enum | Values | Defined in |
|---|---|---|
| `finance.agreement_purpose` | `journey_contribution`, `membership`, `additional_gift`, `other` | §4 |
| `finance.agreement_lifecycle` | `draft`, `active`, `fulfilled`, `canceled`, `waived` | §6 |
| `finance.ledger_entry_type` | `stripe_payment`, `external_payment`, `refund`, `reversal` | §7 |
| `finance.ledger_source` | `stripe`, `external` | §7 |
| `finance.external_method` | `check`, `cash`, `wire`, `zelle`, `venmo`, `other` | §7 |
| `finance.payment_state` | `unpaid`, `partial`, `paid`, `overpaid`, `refunded`, `not_applicable` | §8 |
| `finance.event_processing_status` | `received`, `processing`, `processed`, `failed`, `ignored` | §10 |
| `finance.exception_kind` | see §10 | §10 |
| `finance.exception_resolution` | `open`, `resolved`, `dismissed` | §10 |
| `finance.checkout_status` | `open`, `completed`, `expired`, `canceled` | §11 |

### View inventory

PR 1 creates exactly five views: `v_agreement_lifecycle` (§6), `v_agreement_balances` and `v_agreement_balances_test` (§8), `v_member_financials` and `v_journey_financials` (§8).

---

## 2. Cross-schema references

### Permitted

| Reference | Target | Enforcement |
|---|---|---|
| Member identity | `public.members(id)` | FK, `ON DELETE RESTRICT` |
| Journey identity | canonical journey record | FK, `ON DELETE RESTRICT` |
| Actor / recorder | `auth.users(id)` | FK, `ON DELETE RESTRICT` |

`ON DELETE RESTRICT` throughout: a financial fact must never be silently orphaned or cascaded away.

### Forbidden

No `finance` object may reference `public.donations`, `public.financial_commitments`, `public.payment_allocations`, or `public.bookings` money columns.

### Member identity — resolved (D-015)

The repository settles this. **`member_profiles.id` equals `auth.users.id`; `members.id` does not.** The equality of `members.id` and `auth.uid()` is a coincidence of the normal provisioning path, and it is known-false in production for at least one manually seeded row. Two migrations exist solely to repair foreign keys written against the wrong assumption — `20260509000000_repoint_ceremony_progress_fks.sql` and `20260509010000_repoint_followup_tasks_member_fk.sql`. The true link is `members.profile_id = auth.uid()`, and it is **nullable**: a member row can exist with no portal account.

Financial agreements are founder-managed operational records that must be able to exist **before** a member has a portal account. V2 therefore takes the operational branch:

- `finance.agreements.member_id` references **`public.members(id)`**.
- The authenticated member resolves through **`members.profile_id = auth.uid()`**, expressed once in `finance.current_member_id()`, which returns a `members.id`.
- Member RLS policies compare against `finance.current_member_id()`.

**Two anti-patterns are forbidden outright.** Never write `member_id = auth.uid()` on a column that references `members(id)` — that is precisely the defect the two repoint migrations fixed, and `journey_email_log` still carries it. Never resolve a member by email join.

### Narrow verification required in PR 1

The design decision above is settled and does not block. One implementation detail does: `finance.current_member_id()` must be single-valued, which requires `members.profile_id` to be unique. The base schema is not in version control, so PR 1 must confirm against the live database, before creating the function:

1. Does `members.profile_id` carry a unique constraint or index? If not, PR 1 adds one after verifying no duplicates exist.
2. How many rows have `profile_id IS NULL`, and how many have `id <> profile_id`? These are the members for whom any `auth.uid()`-based assumption silently fails.

The answers are recorded in `DECISIONS.md`. No foreign key or policy is written before they are.

---

## 3. Currency — USD only

- `currency` is `text NOT NULL DEFAULT 'usd'` with `CHECK (currency = 'usd')` on both `agreements` and `ledger_entries`. Equality between them is therefore structural.
- All amounts are integer cents. No floating point anywhere in the financial path.

**Excluded from V2:** multi-currency agreements, FX conversion, cross-currency aggregates. Expansion requires relaxing the check, adding a composite FK from `ledger_entries(agreement_id, currency)` to a unique key on `agreements(id, currency)`, and partitioning every aggregate by currency — a future change needing its own decision entry.

---

## 4. Agreements

```
finance.agreements
  id                uuid PK default gen_random_uuid()
  member_id         uuid NOT NULL   -> canonical member identity (RESTRICT)
  journey_id        uuid NULL       -> canonical journey identity (RESTRICT)
  purpose           finance.agreement_purpose NOT NULL
  currency          text NOT NULL default 'usd' CHECK (currency = 'usd')
  created_at        timestamptz NOT NULL default now()
  created_by        uuid NOT NULL   -> auth.users(id) (RESTRICT)

  UNIQUE (member_id, journey_id, purpose)   -- NULLS NOT DISTINCT
```

The row is immutable after insert, carries no amount (§5) and no status (§6).

**Uniqueness and grouping.** One agreement exists per `(member_id, journey_id, purpose)`. `NULLS NOT DISTINCT` ensures member-level agreements (`journey_id IS NULL`) collapse correctly rather than permitting unlimited duplicates. This is also the grouping rule the PR 2 import uses to assign every legacy donation to an agreement.

**Creation.** Agreements are created by `finance.create_agreement()`, a `SECURITY DEFINER` function that inserts the agreement **and its initial lifecycle event** in one transaction (§6). No agreement can exist without a lifecycle.

### Contribution applicability

`journey_contribution` and `membership` have a meaningful agreed amount. `additional_gift` and `other` do not — a gift is money offered, not money owed. For those purposes Remaining is not a meaningful concept, and §8 returns `NULL` remaining columns and `payment_state = 'not_applicable'`. Their money still counts toward Received.

---

## 5. Contribution — `finance.agreement_amounts`

```
finance.agreement_amounts
  id                uuid PK default gen_random_uuid()
  seq               bigint NOT NULL GENERATED ALWAYS AS IDENTITY
  agreement_id      uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  amount_cents      bigint NOT NULL CHECK (amount_cents >= 0)
  effective_at      timestamptz NOT NULL
  reason            text NOT NULL CHECK (length(btrim(reason)) > 0)
  actor_id          uuid NOT NULL -> auth.users(id) (RESTRICT)
  created_at        timestamptz NOT NULL default now()
```

Currency is not repeated here; it belongs to the agreement.

### Deterministic resolution

```sql
WHERE effective_at <= now()
ORDER BY effective_at DESC, seq DESC
LIMIT 1
```

`seq` is a **monotonic identity column**, not a timestamp. Two amendments inserted in the same transaction share `created_at` (which is transaction start time) and would otherwise tie, leaving a random `uuid` to decide the winner. `seq` makes the ordering both **total** and genuinely **last-recorded-wins**. An agreement with no qualifying amendment has a Contribution of `0`.

### Rules

| Question | V2 answer |
|---|---|
| Future-dated amendments allowed? | **No.** A trigger rejects `effective_at > now()`, with **no tolerance window** — a tolerance would accept amendments the view then hides until wall-clock catches up. |
| How are equal `effective_at` ordered? | By `seq DESC`. The last recorded amendment wins, deterministically. |
| Multiple active amendments? | **No.** Exactly one is current, guaranteed by the total ordering. |
| `reason` and actor required? | Yes, both `NOT NULL`; `reason` must be non-blank. |
| Negative amounts? | No, `CHECK (amount_cents >= 0)`. |

The view retains the `effective_at <= now()` filter as defence in depth.

---

## 6. Lifecycle — `finance.agreement_lifecycle_events`

Lifecycle is **operational, not financial**. It never appears in any Received, Remaining, or payment-state calculation.

```
finance.agreement_lifecycle_events
  id                uuid PK default gen_random_uuid()
  seq               bigint NOT NULL GENERATED ALWAYS AS IDENTITY
  agreement_id      uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  from_status       finance.agreement_lifecycle NULL   -- NULL only for the initial event
  to_status         finance.agreement_lifecycle NOT NULL
  reason            text NOT NULL CHECK (length(btrim(reason)) > 0)
  actor_id          uuid NOT NULL -> auth.users(id) (RESTRICT)
  occurred_at       timestamptz NOT NULL default now()
  created_at        timestamptz NOT NULL default now()

  UNIQUE (agreement_id) WHERE from_status IS NULL   -- exactly one initial event
```

- Current lifecycle = latest event by `occurred_at DESC, seq DESC` — total, for the same reason as §5. This lookup is expressed exactly once, in **`finance.v_agreement_lifecycle`** (one row per agreement, exposing the current status and the actor, reason and timestamp of the transition that set it). Nothing else re-derives it.
- Every agreement has an initial event created atomically with it (§4), so current lifecycle is **never NULL**.
- The transition trigger takes `SELECT … FOR UPDATE` **on the agreement row** before validating, serialising concurrent transitions. Without the lock, two concurrent transitions from `active` would both validate and both commit.
- Invalid transitions are rejected. Terminal states (`canceled`, `waived`) accept no outbound transition.
- No `lifecycle_status` column exists on `finance.agreements`.

---

## 7. The ledger — `finance.ledger_entries`

```
finance.ledger_entries
  id                          uuid PK default gen_random_uuid()
  agreement_id                uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  entry_type                  finance.ledger_entry_type NOT NULL
  amount_cents                bigint NOT NULL CHECK (amount_cents <> 0)   -- signed
  currency                    text NOT NULL default 'usd' CHECK (currency = 'usd')
  source                      finance.ledger_source NOT NULL
  external_method             finance.external_method NULL
  provider_object_id          text NULL      -- Stripe charge / refund object
  provider_payment_intent_id  text NULL
  parent_entry_id             uuid NULL -> finance.ledger_entries(id) (RESTRICT)
  occurred_at                 timestamptz NOT NULL
  recorded_at                 timestamptz NOT NULL default now()
  recorded_by                 uuid NULL -> auth.users(id) (RESTRICT)
  reason                      text NULL
  legacy_donation_id          uuid NULL      -- import traceability, no FK by design
  livemode                    boolean NOT NULL
```

**No generic correction type.** A mistaken entry is fixed by an attributed `reversal` linked to it, then the correct replacement entry. The original is never updated or deleted.

### Legal parent matrix

| Entry type | Permitted parent | Parent must have |
|---|---|---|
| `stripe_payment` | none (`parent_entry_id` NULL) | — |
| `external_payment` | none (`parent_entry_id` NULL) | — |
| `refund` | `stripe_payment` or `external_payment` only | no reversal child |
| `reversal` | `stripe_payment`, `external_payment`, or `refund` | **no *unreversed* children** |

A refund may never target a refund or a reversal, so "settled amount" is always evaluated against a positive parent.

**An entry is *reversed* when a `reversal` row targets it, and *unreversed* otherwise.** A reversal's parent must have no unreversed children. This is deliberately not "no children at all": since the ledger is append-only, reversing a refund does not remove the refund row, so a no-children rule would leave the parent payment permanently un-reversible and make the documented unwind path impossible.

The unwind of a partially refunded payment therefore works as follows:

| Step | Entry | Net |
|---|---|---|
| 1 | `stripe_payment` `+10000` | `10000` |
| 2 | `refund` `−3000` (parent: step 1) | `7000` |
| 3 | Attempt to reverse step 1 → **rejected**: step 1 has an unreversed child | `7000` |
| 4 | `reversal` `+3000` (parent: step 2) — step 2 is now reversed | `10000` |
| 5 | `reversal` `−10000` (parent: step 1) — step 1 now has no unreversed children | `0` |

The rule also makes double reversal impossible: a reversed entry has a reversal child which is itself unreversed, so a second reversal is rejected.

A reversal of a **refund** is permitted — it is the correction path for a refund recorded in error — and produces a positive-signed `reversal` row. This is why `reversed_cents` (§8) is a signed sum and may be positive. Reversing a refund restores **the parent payment's** refund headroom under L7, because L7 counts only unreversed refunds.

### Invariants

| # | Rule | Mechanism |
|---|---|---|
| L1 | `stripe_payment` → `amount_cents > 0`, `source = 'stripe'`, **`provider_payment_intent_id` NOT NULL**, `parent_entry_id` NULL | table `CHECK` |
| L2 | `external_payment` → `amount_cents > 0`, `source = 'external'`, `external_method` NOT NULL, `recorded_by` NOT NULL, `parent_entry_id` NULL | table `CHECK` |
| L3 | `refund` → `amount_cents < 0`, `parent_entry_id` NOT NULL | table `CHECK` |
| L4 | `reversal` → `parent_entry_id` NOT NULL and `amount_cents = -parent.amount_cents` | constraint trigger |
| L5 | `parent_entry_id <> id` | table `CHECK` |
| L6 | Parent must share the same `agreement_id`; parent `entry_type` must satisfy the legal parent matrix; **a reversal's parent must have no *unreversed* children**. Trigger takes `SELECT … FOR UPDATE` on the parent before checking. | constraint trigger |
| L7 | Cumulative **unreversed** refunds against one parent may not exceed the parent's **settled amount**, defined as `parent.amount_cents` (its original positive value). Trigger takes `SELECT … FOR UPDATE` on the parent. | constraint trigger |
| L8 | `UNIQUE (provider_object_id, livemode)` where `provider_object_id IS NOT NULL` | partial unique index |
| L8b | `UNIQUE (provider_payment_intent_id, livemode)` where `entry_type = 'stripe_payment'` | partial unique index |
| L9 | `UNIQUE (legacy_donation_id, entry_type)` where `legacy_donation_id IS NOT NULL` | partial unique index |
| L10 | `currency` matches the agreement | structural under USD-only (§3) |
| L11 | Where an originating event or session exists, ledger `livemode` must match it. External payments and imported historic money are `livemode = true`. | constraint trigger |

**L6's "no unreversed children" rule** prevents the double-subtraction defect: reversing a payment that still carries a live refund would subtract the full original while the refund had already subtracted part of it, driving Received to `−3000` — money the ledger would claim left Vital Kauaʻi that never existed. The step table above shows the correct unwind: reverse the refunds first, then the payment.

**L1 requires only the payment-intent id.** Requiring a charge-object id too would make a class of legacy Stripe payments unimportable, and the workarounds are worse: relabelling as `external_payment` would falsely mark Stripe money as founder-recorded, and synthesising an object id would corrupt L8. Instead, a Stripe payment imported without a charge object is inserted with `provider_object_id` NULL, protected by L8b, and raises a `missing_provider_object` exception (§10) for PR 3 to backfill.

### Attribution

`agreement_id` is `NOT NULL`. No `member_id` or `journey_id` is stored — both derive through the agreement, so they cannot drift. Money without a resolvable agreement goes to `finance.reconciliation_exceptions` (§10), never to the ledger.

### Import policy

- **Payments** — legacy rows evidencing money that moved: Stripe-confirmed with a provider reference (`stripe_payment`), and founder-recorded offline with attribution (`external_payment`).
- **Refunds** — historic refunds **are imported**, in a second pass after their parents exist, since L3 requires `parent_entry_id`. A refund whose parent is not importable raises an `orphan_refund` exception rather than being silently dropped. Omitting refunds would overstate Received for every historically refunded member and contaminate the variance report with deltas indistinguishable from adjustment deltas.
- **Not imported** — synthetic `adjust-collected` rows. They are accounting adjustments, not money.
- Every imported row carries `legacy_donation_id`, `livemode = true`, and a `reason` naming the import batch.

---

## 8. Canonical views

### `finance.v_agreement_balances`

One row per agreement. **The only place financial formulas exist.**

**Zero-row rule.** Every aggregate is wrapped in `COALESCE(…, 0)`. SQL `SUM` over zero rows returns `NULL`, not `0`; without coalescing, a newly created agreement would yield `NULL` for every column, fall through every `CASE` branch to `partial`, and feed a `NULL` amount into checkout. Only ledger rows with `livemode = true` are included (see below).

| Column | Definition |
|---|---|
| `contribution_cents` | `COALESCE(latest effective amendment, 0)` |
| `gross_received_cents` | `COALESCE(SUM(amount_cents) FILTER (WHERE entry_type IN ('stripe_payment','external_payment')), 0)` |
| `refunded_cents` | `COALESCE(ABS(SUM(amount_cents) FILTER (WHERE entry_type = 'refund')), 0)` |
| `reversed_cents` | `COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'reversal'), 0)` — signed; positive when a refund was reversed |
| `net_received_cents` | `COALESCE(SUM(amount_cents), 0)` across all entries |
| `contribution_applies` | `purpose IN ('journey_contribution','membership')` |
| `remaining_cents` | `contribution_cents - net_received_cents`, or `NULL` when `contribution_applies` is false |
| `payable_remaining_cents` | `GREATEST(remaining_cents, 0)`, or `NULL` when `contribution_applies` is false |
| `payment_state` | see below |

`remaining_cents` is retained **signed**. A negative value truthfully identifies overpayment and must not be clamped away. `payable_remaining_cents` is the only figure permitted to reach a charge request; **a negative or NULL amount is never sent to Stripe.**

**Live-mode filter.** Canonical balances include only `livemode = true` entries. Test-mode money is retained in the ledger for engineering but never appears in a member or founder figure. A separate `finance.v_agreement_balances_test` mirrors the definition for `livemode = false` and is founder-only.

### `payment_state`

```sql
CASE
  WHEN NOT contribution_applies                       THEN 'not_applicable'
  WHEN gross_received_cents = 0                       THEN 'unpaid'
  WHEN net_received_cents <= 0 AND refunded_cents > 0 THEN 'refunded'
  WHEN net_received_cents <= 0                        THEN 'unpaid'
  WHEN net_received_cents  > contribution_cents       THEN 'overpaid'
  WHEN net_received_cents  = contribution_cents       THEN 'paid'
  ELSE                                                     'partial'
END
```

Evaluated in order; deterministic and total.

- **`not_applicable`** — gifts and other unowed money, where Remaining has no meaning (§4). Without this branch a $500 gift against a zero Contribution reports `overpaid` with `−$500` remaining, which then drags down member and journey totals.
- **The two `unpaid` branches** are the distinction the legacy model could not express. Money received then fully **refunded** is `refunded`; money recorded in error then **reversed** is `unpaid`, because no money ever moved. Keying `refunded` on `refunded_cents > 0` rather than on `net <= 0` alone is what prevents a reversed founder mistake from telling a member their money was refunded.
- **`paid`** is `=`, not `>=` — the `overpaid` branch above already claims everything greater, and writing `=` keeps the intent legible.

### Reachable-state table

| `contribution_applies` | `gross` | `net` vs `contribution` | `refunded_cents` | State |
|---|---|---|---|---|
| false | any | any | any | `not_applicable` |
| true | 0 | — | 0 | `unpaid` |
| true | > 0 | `net ≤ 0` | > 0 | `refunded` |
| true | > 0 | `net ≤ 0` | 0 | `unpaid` (fully reversed) |
| true | > 0 | `0 < net < contribution` | any | `partial` |
| true | > 0 | `net = contribution` | any | `paid` |
| true | > 0 | `net > contribution` | any | `overpaid` |

### Aggregate views

`finance.v_member_financials` and `finance.v_journey_financials` **aggregate from `v_agreement_balances`** and never recompute a formula. They sum Received across all agreements including `not_applicable` ones, and sum Remaining across `contribution_applies` agreements only — so gift money counts as received without distorting what is owed.

---

## 9. Security — RLS, privileges, views, functions

PR 1 ships all of the following.

### Schema and privileges
- `CREATE SCHEMA finance`; explicit `GRANT USAGE` to `authenticated` only.
- `REVOKE ALL ON SCHEMA finance FROM PUBLIC, anon`.
- Explicit `ALTER DEFAULT PRIVILEGES` so future objects are not silently readable.
- Explicit per-role table grants. No blanket `GRANT ALL`.

### Row-level security
- `ENABLE` **and** `FORCE ROW LEVEL SECURITY` on all eight tables.
- Member `SELECT` policies resolve identity through `finance.current_member_id()` — never an email join.
- Founder policies use a versioned `finance.is_founder()`. **No hardcoded founder UUIDs.**
- **No client `UPDATE` or `DELETE` policies on the three append-only fact tables.** Enforced by absent policy *and* by a trigger raising on `UPDATE`/`DELETE`, so it holds even for roles bypassing RLS.
- Members have no `INSERT` policy on any financial fact.

### Functions
- All `SECURITY DEFINER` functions declare `SET search_path = pg_catalog, public, finance`.
- `EXECUTE` revoked from `PUBLIC`, granted per role explicitly.
- Founder writes occur through a small set of approved functions.

### Views
- `security_invoker = true` on every member-facing view.
- `security_barrier = true` where a view forms a security boundary.

### Authorization model
Service-role access is confined to **verified server infrastructure** — webhook ingestion and reconciliation jobs. It is **not** the authorization model for founder routes, which authenticate the user and rely on RLS plus approved functions.

---

## 10. Stripe events and reconciliation exceptions

```
finance.stripe_events
  event_id          text PRIMARY KEY
  event_type        text NOT NULL
  object_id         text NOT NULL
  livemode          boolean NOT NULL
  processing_status finance.event_processing_status NOT NULL default 'received'
  claimed_at        timestamptz NULL
  attempt_count     integer NOT NULL default 0
  received_at       timestamptz NOT NULL default now()
  processed_at      timestamptz NULL
  processing_error  text NULL
  payload           jsonb NULL      -- sanitized; nulled after retention window
```

`payload` is nullable so the retention policy (`PRODUCT_SPEC` §5) can execute against the schema.

### Defences

| Threat | Defence |
|---|---|
| Same event ID delivered repeatedly | `event_id` primary key. On conflict, **branch on `processing_status`** — see below. |
| Separate events for the same object | Partial unique index on `(event_type, object_id, livemode)` for terminal at-most-once types only (e.g. `checkout.session.completed`). Not applied to repeatable types such as `charge.refunded`, where two genuine partial refunds share one charge object. |
| Repeatable events double-counting | Enforced at the ledger by **L8** on the refund object itself — independent of event deduplication. |
| Concurrent processing | Claim via `UPDATE … SET processing_status='processing', claimed_at=now() WHERE processing_status IN ('received','failed') RETURNING`. Only the claiming worker proceeds. |
| Failure then replay | On PK conflict: `processed`/`ignored` ⇒ acknowledge and stop; `received`/`failed` ⇒ re-claim and process; `processing` with `claimed_at` older than the staleness window ⇒ re-claim. A sweeper re-queues stale claims. **Unconditionally acknowledging on conflict would strand any event that crashed mid-processing**, since Stripe's redelivery would hit the PK and stop forever. |

Ledger invariants make reprocessing safe in every branch.

### Refund processing

Refunds are the hardest case in the system: one charge can carry several genuine partial refunds, Stripe emits charge-level events rather than refund-level ones, and the same event may arrive more than once. The rules are therefore explicit.

1. **`event_id` prevents replay of the same Stripe event.** The primary key on `finance.stripe_events.event_id` makes a redelivered event a no-op, subject to the processing-status branch above.

2. **Ledger uniqueness on the Stripe Refund ID prevents double counting across *different* events.** Event-level deduplication is not sufficient: two distinct events can legitimately reference the same refund. **L8** — `UNIQUE (provider_object_id, livemode)` — is keyed on the **Stripe Refund object id** (`re_…`) for refund entries, so a given refund can produce exactly one ledger entry no matter how many events mention it.

3. **A charge-level event never becomes a refund ledger entry itself.** `charge.refunded` describes a charge, not a refund. Writing a ledger entry keyed on the charge id would collide with the payment entry and would double-count on the second partial refund. Charge-level events are **containers**; only Refund objects become `refund` entries.

4. **Handling `charge.refunded` means enumerating the underlying Refund objects.** Processing reads `charge.refunds.data`, and for each Refund object inserts one `refund` entry keyed on that refund's own id, with `parent_entry_id` resolved to the ledger entry carrying the charge's PaymentIntent (L8b). Refunds already present are skipped by L8 rather than by an application-level check.

5. **Partial refunds accumulate and cannot exceed the settled payment.** Each Refund object is its own entry; **L7** caps cumulative unreversed refunds at the parent's original `amount_cents`, serialised by `SELECT … FOR UPDATE` on the parent so concurrent refund events cannot jointly overshoot.

6. **Reconciliation trusts objects, not delivery.** The PR 3 job enumerates Stripe **PaymentIntent, Charge and Refund objects** over a window and diffs them against the ledger. It never assumes an event arrived. A refund present at Stripe with no corresponding ledger entry raises `provider_without_ledger`; a ledger entry with no provider object raises `ledger_without_provider`. Reconciliation raises exceptions and never silently self-corrects.

### Payload handling

`payload` is **sanitized before storage** — identifiers, amounts, currency, status and timestamps retained; cardholder details, addresses, and raw customer contact stripped. Retained-field list, retention window and access are recorded in `PRODUCT_SPEC` §5. Unrestricted Stripe payloads are not stored.

### `finance.reconciliation_exceptions`

```
finance.reconciliation_exceptions
  id                  uuid PK default gen_random_uuid()
  kind                finance.exception_kind NOT NULL
  agreement_id        uuid NULL -> finance.agreements(id) (RESTRICT)
  ledger_entry_id     uuid NULL -> finance.ledger_entries(id) (RESTRICT)
  provider_object_id  text NULL
  legacy_donation_id  uuid NULL
  livemode            boolean NOT NULL
  amount_cents        bigint NULL
  currency            text NULL CHECK (currency IS NULL OR currency = 'usd')
  detail              jsonb NOT NULL default '{}'::jsonb
  detected_at         timestamptz NOT NULL default now()
  resolution_status   finance.exception_resolution NOT NULL default 'open'
  resolved_at         timestamptz NULL
  resolved_by         uuid NULL -> auth.users(id) (RESTRICT)
  resolution_note     text NULL

  CHECK (resolution_status = 'open'
         OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
```

`finance.exception_kind` values: `unattributable_payment`, `provider_without_ledger`, `ledger_without_provider`, `amount_mismatch`, `currency_violation`, `missing_provider_object`, `orphan_refund`.

---

## 11. Checkout sessions

```
finance.checkout_sessions
  id                 uuid PK default gen_random_uuid()
  agreement_id       uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  stripe_session_id  text NOT NULL UNIQUE
  idempotency_key    text NOT NULL UNIQUE
  amount_cents       bigint NOT NULL CHECK (amount_cents > 0)
  currency           text NOT NULL default 'usd' CHECK (currency = 'usd')
  livemode           boolean NOT NULL
  status             finance.checkout_status NOT NULL default 'open'
  expires_at         timestamptz NOT NULL
  created_at         timestamptz NOT NULL default now()
  completed_at       timestamptz NULL
```

- **A checkout attempt is not a payment.** No ledger entry exists until Stripe confirms, eliminating the legacy orphan-pending-row problem.
- **The idempotency key is sent to Stripe** on `checkout.sessions.create`, not merely recorded locally.
- **The amount is recalculated server-side** from `payable_remaining_cents` immediately before creation. No client amount is trusted.
- **Zero-amount guard.** When `payable_remaining_cents` is `0` or `NULL` (a paid, overpaid, or `not_applicable` agreement), session creation is **refused before any insert**, with a defined message — nothing is owed. The `CHECK (amount_cents > 0)` is the backstop, not the guard. Because nothing is created, no payment link is consumed (§12).
- Session metadata carries `financial_version = 'v2'` and `agreement_id` (§13).

---

## 12. Payment links

```
finance.payment_links
  id, agreement_id, token_hash UNIQUE, expires_at,
  consumed_at, consumed_by_session_id, revoked_at, revoked_by,
  created_at, created_by
```

- Only the **hash** is stored; the raw token exists solely in the emailed URL.
- **Consumption is atomic and occurs when the link successfully creates its Checkout Session** — not on webhook arrival. Legacy stamped `consumed_at` only on webhook success, so one token could open unlimited sessions.
- Concurrency: `UPDATE finance.payment_links SET consumed_at = now(), consumed_by_session_id = $1 WHERE id = $2 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`. Zero rows means another request won, and that request creates no session.
- Session creation and consumption occur in **one transaction**. If Stripe fails, or the zero-amount guard refuses, the transaction rolls back and the link remains usable.

**Retry behaviour.** Consumption is permanent. The member's retry path is the Stripe Checkout Session URL, resumable until `expires_at`. Once the session expires unpaid, the founder issues a new link. A token that reactivates on abandonment cannot be reasoned about concurrently, and reissue is cheap.

---

## 13. Cutover — version-tagged, no dual-write

The same payment is never written into both systems. One payment has exactly one authoritative write path.

| Phase | Behaviour |
|---|---|
| Drain | Sessions created before cutover remain handled by the **legacy** webhook for a defined period. |
| Tagging | Every V2 Checkout Session carries `financial_version = 'v2'` and `agreement_id` in Stripe metadata (from PR 6). |
| Routing | The V2 webhook processes only V2-attributed sessions; the legacy webhook ignores them. Routing is by explicit tag, never inference. |
| Shadow | **PR 2 owns the one-time historic import.** PR 3's reconciliation job owns ongoing provider-vs-ledger comparison. Neither writes to legacy. |
| Cutover | All new sessions and payment writes go to V2 only. |
| Freeze | Legacy financial tables become frozen reference data — retained, readable, never written. |
| Reads | Feature flags switch founder then member reads to V2 only after shadow verification passes. |

**PR 3 before PR 6.** Until session tagging exists, PR 3 ingests **all** Stripe events into `finance.stripe_events` for observation and writes ledger entries only for events it can attribute to a V2 agreement by reconciliation matching. Tag-based routing becomes primary from PR 6. During this window, `provider_without_ledger` exceptions for legacy-tagged charges are the **expected shadow signal**, not errors.

---

## 14. What V2 explicitly does not do

- Multi-currency support (§3).
- Scheduled or future-dated Contribution amendments (§5).
- A generic balance-changing correction entry type (§7).
- Import of synthetic `adjust-collected` adjustments (§7).
- Any legacy write, or any legacy read outside the named comparison surfaces (§0a).
- Payment-provider abstraction. V2 targets Stripe; the dormant Square scaffolding is not carried forward.

---

## 15. Traceability to audit findings

| Audit finding | V2 resolution |
|---|---|
| Core ledger schema un-versioned | All objects from tracked migrations; fresh-reset test in PR 1 |
| No Stripe `event.id` idempotency | `stripe_events.event_id` PK + ledger L8/L8b |
| Webhook sole writer of terminal state | Reconciliation job + exceptions queue (PR 3) |
| Orphan pending donation rows | `checkout_sessions` separate from ledger (§11) |
| Multi-use payment tokens | Atomic consumption at session creation (§12) |
| Allocation race / over-allocation | L6/L7 with row locking (§7) |
| Three routes rewrite `expected_amount_cents` | Append-only `agreement_amounts` (§5) |
| "Collected" defined two ways | Single `net_received_cents` definition (§8) |
| "Remaining" computed four ways | Single `v_agreement_balances`; aggregates reference it (§8) |
| Two disjoint payment-status vocabularies | One computed `payment_state`; lifecycle separate (§6, §8) |
| Provenance in `metadata` only | First-class `entry_type`, `source`, `external_method` (§7) |
| No RLS in repo for money tables | Full RLS, privileges and tests in PR 1 (§9) |
| Hardcoded founder UUIDs | Versioned `finance.is_founder()` (§9) |
| Fragile email-based member join | `finance.current_member_id()`; email join forbidden (§2) |
| `program_price` dollars vs cents drift | Integer cents everywhere; no float (§3) |
