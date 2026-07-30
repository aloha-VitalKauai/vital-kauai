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

All four are read-only and temporary, and every one is removed or retired at PR 9. The first three are founder-scoped. The fourth is not: PR 8's member surface must render *something* when its flag is off, and that something is the existing legacy figure. This is the pre-existing legacy display continuing to work behind a flag, not a new legacy dependency — consistent with the rule that legacy routes remain until the new path is proven. Any legacy read outside these four is a defect. `finance.ledger_entries.legacy_donation_id` remains an **unconstrained** `uuid` carrying no foreign key, so V2 retains no structural dependency and legacy rows may be frozen or archived without affecting V2 integrity.

---

## 1. Object inventory — exactly nine tables

| # | Table | Purpose | Mutability |
|---|---|---|---|
| 1 | `finance.agreements` | Identity of a financial agreement. No amount, no status. | Insert-only |
| 2 | `finance.agreement_amounts` | Append-only amendment history of the agreed Contribution. | **Append-only fact** |
| 3 | `finance.agreement_lifecycle_events` | Append-only operational lifecycle transitions. | **Append-only fact** |
| 4 | `finance.ledger_entries` | Canonical record of money movements and their attributed corrections. Sole source of Received. | **Append-only fact** |
| 5 | `finance.stripe_events` | Webhook ingestion, idempotency, processing state. | Insert + processing-state update + retention nulling |
| 6 | `finance.checkout_sessions` | Checkout attempts. An attempt is not a payment. | Insert + status update |
| 7 | `finance.payment_links` | Hashed, expiring, revocable, single-use pay links. | Insert + claim / consume / release / revoke transitions (§12) |
| 8 | `finance.reconciliation_exceptions` | Money that cannot be attributed, and provider/ledger mismatches. | Insert + reopen update + resolution update |
| 9 | `finance.reconciliation_runs` | Reconciliation job state: window, cursor, single-flight lock, counters. | Insert + progress update |

Tables 2–4 are the **append-only fact tables**; §0.4 applies to them and only them. Tables 5–9 are protocol and operational machinery carrying no financial truth, and they require bounded updates by design.

**Table 9 exists because PR 1 owns all schema.** Reconciliation needs a durable cursor, a run identity and a single-flight lock; without a table it has nowhere to keep them, and a job that cannot checkpoint cannot resume. Adding it in PR 3 would contradict PR 1's stated completeness and split schema ownership across two PRs, so it is created in PR 1 and first used in PR 3.

### Enum inventory

PR 1 creates exactly thirteen enum types:

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
| `finance.checkout_status` | `creating`, `open`, `completed`, `expired`, `canceled` | §11 |
| `finance.link_status` | `active`, `creating`, `consumed`, `revoked` | §12 |
| `finance.system_actor` | `reconciliation`, `legacy_import`, `checkout_sweeper` | §7 |
| `finance.run_status` | `running`, `completed`, `failed`, `abandoned` | §10a |

### View inventory

PR 1 creates exactly five views: `v_agreement_lifecycle` (§6), `v_agreement_balances` and `v_agreement_balances_test` (§8), `v_member_financials` and `v_journey_financials` (§8).

---

## 2. Cross-schema references

### Permitted

| Reference | Target | Enforcement |
|---|---|---|
| Member identity | `public.members(id)` | FK, `ON DELETE RESTRICT` |
| Journey identity | **`public.journeys(id)`** | FK, `ON DELETE RESTRICT` |
| Actor / recorder | `auth.users(id)` | FK, `ON DELETE RESTRICT` |
| Founder predicate | **`public.is_founder()`** — reused, not redefined | called in RLS policies |

`ON DELETE RESTRICT` throughout: a financial fact must never be silently orphaned or cascaded away. `public.journeys(id)` is confirmed as an existing FK target by `20260505000000_journey_email_templates.sql:30`.

**V2 reuses the existing `public.is_founder()`** rather than defining `finance.is_founder()`. Defining a second founder predicate would create two places for the answer to drift, which is the defect class this project exists to remove.

Its live definition, confirmed read-only on 2026-07-29:

```sql
CREATE OR REPLACE FUNCTION public.is_founder() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = auth.uid() AND role = 'founder');
$function$
```

Suitable for V2's purpose: a `user_roles` lookup keyed on `auth.uid()`, with no hardcoded identifiers.

**PR 1 hardens it. This is a precondition, not a note.**

The function is `SECURITY DEFINER` with **no `SET search_path`** — confirmed live on 2026-07-29: `proconfig` is `NULL`, signature `is_founder() RETURNS boolean`, `STABLE SECURITY DEFINER`.

**A correction to an earlier, wrong explanation of this risk.** A previous revision of this document claimed a caller could "resolve `public.user_roles` to an object they control." That is false: the function body schema-qualifies both `public.user_roles` and `auth.uid()`, so `search_path` cannot redirect either relation. The real concerns are narrower and still worth fixing:

1. **Operator and function resolution.** Unqualified operators — the `=` comparisons in the body — resolve through `search_path`. A schema earlier in the path containing a shadowing operator can change the predicate's meaning inside a `SECURITY DEFINER` context. This is why the Postgres documentation recommends pinning `search_path` on every `SECURITY DEFINER` function regardless of qualification.
2. **Future edits.** The body is schema-qualified *today*. A later change adding one unqualified reference silently removes the protection, with no test to catch it.
3. It is flagged by Supabase's own `function_search_path_mutable` linter.

So the exposure is defence-in-depth, not a live exploit — and it is one statement to close:

```sql
ALTER FUNCTION public.is_founder() SET search_path = pg_catalog, public;
```

**Assigned to PR 1**, which also verifies the live signature before writing any policy that calls it. §9 requires a fixed `search_path` on every `SECURITY DEFINER` function V2 relies on; exempting the one function every founder policy depends on would make that rule decorative. Leaving it to "some other PR" while PR 1 builds an authorization boundary on top of it is the ownerless-risk pattern this project exists to avoid.

*Note for implementers:* the application-layer `verifyFounder()` in `lib/auth/founder-check.ts:4-7` uses a hardcoded `FOUNDER_IDS` array. **V2 does not use that path.** Founder authority in V2 is the database predicate.

### Forbidden

No `finance` object may reference `public.donations`, `public.financial_commitments`, `public.payment_allocations`, or `public.bookings` money columns.

### Member identity — resolved (D-015)

The repository settles this. **`member_profiles.id` equals `auth.users.id`; `members.id` does not.** The equality of `members.id` and `auth.uid()` is a coincidence of the normal provisioning path, and it is known-false in production for at least one manually seeded row. Two migrations exist solely to repair foreign keys written against the wrong assumption — `20260509000000_repoint_ceremony_progress_fks.sql` and `20260509010000_repoint_followup_tasks_member_fk.sql`. The true link is `members.profile_id = auth.uid()`, and it is **nullable**: a member row can exist with no portal account.

Financial agreements are founder-managed operational records that must be able to exist **before** a member has a portal account. V2 therefore takes the operational branch:

- `finance.agreements.member_id` references **`public.members(id)`**.
- The authenticated member resolves through **`members.profile_id = auth.uid()`**, expressed once in `finance.current_member_id()`, which returns a `members.id`.
- Member RLS policies compare against `finance.current_member_id()`.

**Two anti-patterns are forbidden outright.** Never write `member_id = auth.uid()` on a column that references `members(id)` — that is precisely the defect the two repoint migrations fixed, and `journey_email_log` still carries it. Never resolve a member by email join.

### Live-database verification — complete (D-038)

Confirmed read-only against `Vital-Kauai-prod` on 2026-07-29. Nothing was created or altered; queries returned aggregates only, and no member identifier was selected.

| Check | Result |
|---|---|
| Unique index on `members.profile_id` | **Already exists** — `uq_members_profile_id`, `UNIQUE (profile_id) WHERE profile_id IS NOT NULL` |
| Duplicate non-null `profile_id` groups | **0**; max rows per `profile_id` is 1 |
| Rows with `profile_id IS NULL` | **0** of 17 |
| Rows with `id <> profile_id` | **2** of 17 |
| `members.profile_id` foreign key | `REFERENCES member_profiles(id) ON DELETE SET NULL` |
| PostgreSQL version | **17.6** |

`finance.current_member_id()` is therefore single-valued today, and **PR 1 adds no index** — the constraint it would have added already exists.

**The two divergent rows are the whole argument.** 12% of production members have `id <> profile_id`. A policy written as `member_id = auth.uid()` against a `members(id)` column returns nothing for those members — no error, no log, just a member whose financial data silently disappears. D-015 is not defensive; the data requires it.

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

**Creation.** Agreements are created by `finance.create_agreement()`, a `SECURITY DEFINER` function that inserts the agreement **and its initial lifecycle event** in one transaction (§6).

**That guarantee is enforced by the database, not by the function.** `service_role` legitimately inserts agreements during the PR 2 import, so a direct `INSERT` is a supported path — and a direct `INSERT` alone would leave an agreement with no lifecycle event, making `v_agreement_lifecycle` return nothing and contradicting §6's claim that current lifecycle is never `NULL`. A **`DEFERRABLE INITIALLY DEFERRED` constraint trigger** therefore checks **at commit** that every agreement has exactly one event with `from_status IS NULL`. Deferral is what lets the two inserts happen in either order within one transaction while still making the pair mandatory. No agreement can exist without a lifecycle, by any path.

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

```

```sql
-- exactly one initial event per agreement
CREATE UNIQUE INDEX ON finance.agreement_lifecycle_events (agreement_id)
  WHERE from_status IS NULL;
```

- Current lifecycle = latest event by `occurred_at DESC, seq DESC` — total, for the same reason as §5. This lookup is expressed exactly once, in **`finance.v_agreement_lifecycle`** (one row per agreement, exposing the current status and the actor, reason and timestamp of the transition that set it). Nothing else re-derives it.
- Every agreement has an initial event created atomically with it (§4), so current lifecycle is **never NULL**.
- The transition trigger takes `SELECT … FOR UPDATE` **on the agreement row** before validating, serialising concurrent transitions. Without the lock, two concurrent transitions from `active` would both validate and both commit.
- No `lifecycle_status` column exists on `finance.agreements`.

### The transition graph

Stating only "terminal states accept no outbound transition" left the rest undefined and the trigger unwritable. The complete legal set:

| From | Permitted `to_status` |
|---|---|
| *(initial event, `from_status IS NULL`)* | `draft` only |
| `draft` | `active`, `canceled`, `waived` |
| `active` | `fulfilled`, `canceled`, `waived` |
| `fulfilled` | `active` |
| `canceled` | — terminal |
| `waived` | — terminal |

Anything not in this table is rejected.

Two choices worth stating plainly:

- **Every agreement begins at `draft`**, so `create_agreement()` has one unambiguous initial event and tests have one expected value.
- **`fulfilled → active` is permitted** because fulfilment is an operational judgement, not a financial fact. A founder who marks an agreement fulfilled and then agrees further contribution must be able to reopen it. `canceled` and `waived` stay terminal because reversing either is a different decision that deserves a new agreement rather than a quiet reopen.

Lifecycle remains entirely separate from `payment_state`: an agreement can be `fulfilled` while `partial`, or `active` while `paid`. Neither constrains the other, and neither appears in the other's computation.

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
  recorded_by                 uuid NULL -> auth.users(id) (RESTRICT)   -- human actor
  recorded_by_system          finance.system_actor NULL                -- automated actor
  reason                      text NULL
  legacy_donation_id          uuid NULL      -- import traceability, no FK by design
  origin_stripe_event_id      text NULL -> finance.stripe_events(event_id) (RESTRICT)
  livemode                    boolean NOT NULL
```

`origin_stripe_event_id` records **which webhook event caused this entry**. Without it L11 was unenforceable — it required ledger `livemode` to match "the originating event or session," but no column connected a ledger row to either, so there was no join path and no way to write the trigger. The column is NULL for external payments, imported history, and founder-initiated reversals, all of which have no originating event.

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
| L2 | `external_payment` → `amount_cents > 0`, `source = 'external'`, `external_method` NOT NULL, `parent_entry_id` NULL, and attribution per **L12** | table `CHECK` |
| L3 | `refund` → `amount_cents < 0`, `parent_entry_id` NOT NULL, **and provenance complete for its source**: `source='stripe'` requires `provider_object_id` NOT NULL (the `re_…` Refund id); `source='external'` requires `external_method` NOT NULL and attribution under L12 | table `CHECK` |
| L3b | A `source='stripe'` refund's parent must be a `stripe_payment`. A `source='external'` refund may target either payment type. | constraint trigger |
| L4 | `reversal` → `parent_entry_id` NOT NULL and `amount_cents = -parent.amount_cents` | constraint trigger |
| L5 | `parent_entry_id <> id` | table `CHECK` |
| L6 | Parent must share the same `agreement_id`; parent `entry_type` must satisfy the legal parent matrix; **a reversal's parent must have no *unreversed* children**. Trigger takes `SELECT … FOR UPDATE` on the parent before checking. | constraint trigger |
| L7 | Cumulative **unreversed** refunds against one parent may not exceed the parent's **settled amount**, defined as `parent.amount_cents` (its original positive value). Trigger takes `SELECT … FOR UPDATE` on the parent. | constraint trigger |
| L8 | `UNIQUE (provider_object_id, livemode)` where `provider_object_id IS NOT NULL` | partial unique index |
| L8b | `UNIQUE (provider_payment_intent_id, livemode)` where `entry_type = 'stripe_payment'` | partial unique index |
| L9 | `UNIQUE (legacy_donation_id, entry_type)` where `legacy_donation_id IS NOT NULL` | partial unique index |
| L10 | `currency` matches the agreement | structural under USD-only (§3) |
| L11 | Where `origin_stripe_event_id` is present, ledger `livemode` must equal that event's `livemode`. External payments and imported historic money are `livemode = true` with `origin_stripe_event_id` NULL. | constraint trigger |
| L12 | **`source = 'external'` OR `entry_type = 'reversal'` requires a non-blank `reason` and exactly one attribution — either `recorded_by` (a human) or `recorded_by_system` (an automated actor).** | table `CHECK` |
| L13 | **Provenance fields may not contradict `source`.** `source='stripe'` requires `external_method IS NULL`. `source='external'` requires `provider_object_id IS NULL` **and** `provider_payment_intent_id IS NULL`. | table `CHECK` |

**L13 forbids self-contradicting rows.** The earlier invariants stated what each source *requires* but never what it *excludes*, so a `stripe_payment` could carry `external_method='cash'`, or an `external_payment` could carry a `pi_…` identifier it has no claim to. Either row asserts two incompatible origins at once, and any report grouping by provenance would then double-count it or classify it arbitrarily. Provenance is only useful if a row has exactly one.

`legacy_donation_id` is deliberately outside this rule — it is import traceability, orthogonal to origin, and legitimately present on both Stripe and external imported rows.

**L12 closes an attribution hole.** As originally written, `recorded_by` and `reason` were required only on `external_payment` (L2), so a founder could record an external refund or post a reversal — the entry types that *exist* to correct human error — with no actor and no explanation. A correction nobody is accountable for is the legacy defect wearing new clothes.

**The rule keys on `source`, not on the presence of a provider object id.** Defining "provider-originated" as `source = 'stripe' AND provider_object_id IS NOT NULL` would contradict L1 and D-020, which deliberately permit a Stripe payment imported with a NULL charge-object id — such a row is unambiguously provider money, yet that definition would demand a human actor for it. `source = 'stripe'` is sufficient on its own, because L1 already requires a payment-intent id on every Stripe payment.

Consequences of keying on `source`:

- A refund **executed through Stripe** arrives with `source = 'stripe'` and its own `re_…` id, so it is exempt — the provider is the record of who did it. This holds whether a founder or a customer initiated it.
- A refund **recorded outside Stripe** (a cheque returned, cash handed back) is `source = 'external'` and requires attribution.
- **Every `reversal` requires attribution regardless of source**, because a reversal is never a provider event — it is always a human or system judgement that a record was wrong.

**System attribution requires no login.** Automated actors are recorded in `recorded_by_system` — an enum column, not a foreign key:

```
recorded_by         uuid NULL -> auth.users(id) (RESTRICT)   -- a human
recorded_by_system  finance.system_actor NULL                -- an automated actor

CHECK (num_nonnulls(recorded_by, recorded_by_system) <= 1)
```

`finance.system_actor` values: `reconciliation`, `legacy_import`, `checkout_sweeper`.

An earlier draft attributed automated reversals to a dedicated service account in `auth.users`. That was wrong on two counts: it would make a clean `supabase db reset` depend on an **environment-specific Auth user**, so the migration would apply on one environment and fail on another; and Supabase's guidance is that users are created through the [Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser), not inserted directly by migration. An enum keeps system attribution fully within the `finance` schema, portable across environments, and reproducible from migrations alone — while remaining exactly as legible in an audit as a named person. The `reason` still names the exception that triggered the correction.

**L6's "no unreversed children" rule** prevents the double-subtraction defect: reversing a payment that still carries a live refund would subtract the full original while the refund had already subtracted part of it, driving Received to `−3000` — money the ledger would claim left Vital Kauaʻi that never existed. The step table above shows the correct unwind: reverse the refunds first, then the payment.

**L3 closes a duplicate-refund hole.** As originally written, L3 required only a parent, so a Stripe refund could be inserted with `provider_object_id` NULL — and L8's uniqueness index is partial, applying only where that column is present. Two rows for the same `re_…` refund would both be accepted, defeating D-025's deduplication guarantee. Requiring the Refund id on every Stripe refund makes L8 binding for the whole class rather than optional. External refunds carry the complementary requirement: a method, plus **exactly one attribution — human or system — under L12**. System attribution is as valid as a named person (D-032); requiring a human would make legacy-imported external refunds unimportable.

**L1 requires only the payment-intent id.** Requiring a charge-object id too would make a class of legacy Stripe payments unimportable, and the workarounds are worse: relabelling as `external_payment` would falsely mark Stripe money as founder-recorded, and synthesising an object id would corrupt L8. Instead, a Stripe payment imported without a charge object is inserted with `provider_object_id` NULL, protected by L8b, and raises a `missing_provider_object` exception (§10) for PR 3 to backfill.

### Attribution

`agreement_id` is `NOT NULL`. No `member_id` or `journey_id` is stored — both derive through the agreement, so they cannot drift. Money without a resolvable agreement goes to `finance.reconciliation_exceptions` (§10), never to the ledger.

### Import policy

- **Payments** — legacy rows evidencing money that moved: Stripe-confirmed with a provider reference (`stripe_payment`), and founder-recorded offline with attribution (`external_payment`).
- **Refunds** — historic refunds **are imported**, in a second pass after their parents exist, since L3 requires `parent_entry_id`. A refund whose parent is not importable raises an `orphan_refund` exception rather than being silently dropped. Omitting refunds would overstate Received for every historically refunded member and contaminate the variance report with deltas indistinguishable from adjustment deltas.
- **Not imported** — synthetic `adjust-collected` rows. They are accounting adjustments, not money.
- Every imported row carries `legacy_donation_id`, `livemode = true`, `recorded_by_system = 'legacy_import'`, and a `reason` naming the import batch. Where the original founder who recorded an offline payment is identifiable, `recorded_by` is used instead — the human attribution is better evidence than the batch, and L12 permits exactly one of the two.

---

## 8. Canonical views

### `finance.v_agreement_balances`

One row per agreement. **The only place financial formulas exist.**

**Zero-row rule.** Every aggregate is wrapped in `COALESCE(…, 0)`. SQL `SUM` over zero rows returns `NULL`, not `0`; without coalescing, a newly created agreement would yield `NULL` for every column, fall through every `CASE` branch to `partial`, and feed a `NULL` amount into checkout. Only ledger rows with `livemode = true` are included (see below).

| Column | Definition |
|---|---|
| `contribution_cents` | `COALESCE(latest effective amendment, 0)` |
| `gross_received_cents` | `COALESCE(SUM(amount_cents) FILTER (WHERE entry_type IN ('stripe_payment','external_payment')), 0)` |
| `refunded_cents` | `COALESCE(ABS(SUM(amount_cents) FILTER (WHERE entry_type = 'refund' AND NOT is_reversed)), 0)` — **unreversed refunds only** |
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

- **`refunded_cents` counts only unreversed refunds**, where `is_reversed` means a `reversal` entry targets that row. Counting reversed refunds would leave a member permanently labelled `refunded` after a refund recorded in error had been fully undone: payment `+10000`, refund `−10000`, reversal-of-refund `+10000`, reversal-of-payment `−10000` nets to `0` with nothing having happened, and a naive `refunded_cents` of `10000` would report `refunded` instead of `unpaid`. The same filter keeps the member-facing "Refunded" figure honest — a refund that was undone is not a refund.
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

A custom schema is **not** exposed through PostgREST or reachable by any role until it is granted explicitly, so PR 1 states every grant ([Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)).

| Role | Schema | Tables | Rationale |
|---|---|---|---|
| `authenticated` | `USAGE` | `SELECT` per RLS policy | Members and founders read through RLS |
| **`service_role`** | **`USAGE`** | **`SELECT`, `INSERT`, and the bounded `UPDATE`s of §1** | **Webhook ingestion and reconciliation jobs run as `service_role` and cannot function without this.** Omitting it is a silent runtime failure at PR 3, not a compile error. |
| `anon` | none | none | `REVOKE ALL` |
| `PUBLIC` | none | none | `REVOKE ALL` |

- `service_role` receives **no** `UPDATE` or `DELETE` on the three append-only fact tables. Its elevated access does not exempt it — the append-only triggers raise regardless of role.
- Explicit `ALTER DEFAULT PRIVILEGES` for both `authenticated` and `service_role`, so future objects are neither silently readable nor silently unreachable.
- Explicit per-role table grants. No blanket `GRANT ALL`.
- Sequence usage granted where `service_role` inserts.

### Row-level security
- `ENABLE` **and** `FORCE ROW LEVEL SECURITY` on all nine tables.
- Member `SELECT` policies resolve identity through `finance.current_member_id()` — never an email join.
- Founder policies call the **existing `public.is_founder()`** (§2), not a new V2 predicate. **No hardcoded founder UUIDs.**
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
| Separate events for the same object | Partial unique index on `(event_type, object_id, livemode)` restricted to the **enumerated** terminal at-most-once list below. Not applied to repeatable types such as `charge.refunded`, where two genuine partial refunds share one charge object. |
| Repeatable events double-counting | Enforced at the ledger by **L8** on the refund object itself — independent of event deduplication. |
| Concurrent processing | Claim via `UPDATE … SET processing_status='processing', claimed_at=now() WHERE processing_status IN ('received','failed') RETURNING`. Only the claiming worker proceeds. |
| Failure then replay | On PK conflict: `processed`/`ignored` ⇒ acknowledge and stop; `received`/`failed` ⇒ re-claim and process; `processing` with `claimed_at` older than the staleness window ⇒ re-claim. A sweeper re-queues stale claims. **Unconditionally acknowledging on conflict would strand any event that crashed mid-processing**, since Stripe's redelivery would hit the PK and stop forever. |

Ledger invariants make reprocessing safe in every branch.

### Terminal at-most-once event types

An `e.g.` cannot become an index predicate, so the list is closed and exhaustive. The partial unique index on `(event_type, object_id, livemode)` applies to exactly:

```
'checkout.session.completed'
'checkout.session.expired'
'payment_intent.succeeded'
'payment_intent.canceled'
```

Each of these four is a **terminal state of the object itself**, which the object cannot re-enter: a Checkout Session completes or expires once; a PaymentIntent succeeds or is cancelled once.

**Three types were removed after re-audit**, because "terminal-sounding" is not the same as at-most-once:

| Removed | Why |
|---|---|
| `payment_intent.payment_failed` | Stripe emits this **per failed payment attempt**. A failed PaymentIntent returns to `requires_payment_method` and can be retried, producing another legitimate event with a **new `event.id`** but the **same object id, type and `livemode`**. The index would have discarded the retry's failure event. |
| `checkout.session.async_payment_failed` | Not provably at-most-once from the object's semantics. Excluded on that basis alone. |
| `checkout.session.async_payment_succeeded` | Same — removed for symmetry and for the same reason. |

**The asymmetry of this index justifies the caution.** It is defence-in-depth only: `stripe_events.event_id` is the primary key and already deduplicates redelivery of the *same* event, and L8/L8b prevent double-counting at the ledger regardless. So under-including a type costs nothing, while over-including one **silently discards a real event**. Uncertainty is therefore a reason to exclude, not to include.

**`charge.refunded` remains excluded** — it fires once per refund against the same charge, so a constraint would reject the second genuine partial refund. Refund double-counting is prevented at the ledger by L8 on the Refund object.

Adding a type to this list requires a `DECISIONS.md` entry citing the Stripe semantics that make it at-most-once **per object**, not per attempt.

### Payment processing — what creates a `stripe_payment`

The document specified refunds in detail while leaving the far more common case implicit. Stated explicitly:

**A `stripe_payment` entry is created only from a PaymentIntent verified to be in status `succeeded`.**

1. **`checkout.session.completed` alone is not sufficient.** That event means the customer finished the Checkout flow, not that money settled. For delayed-notification methods the Session completes with `payment_status` of `unpaid` while the PaymentIntent is still `processing`, and it may subsequently fail. Writing a ledger entry there would credit money that never arrived — the mirror of the refund defect in D-025.

2. **Processing verifies, it does not infer.** On `checkout.session.completed`, ingestion retrieves the associated PaymentIntent and [checks its status](https://docs.stripe.com/payments/payment-intents/verifying-status):

   | PaymentIntent status | Ledger effect |
   |---|---|
   | `succeeded` | One `stripe_payment` entry |
   | `processing`, `requires_action`, `requires_payment_method`, `requires_capture` | **None.** Await the terminal event; reconciliation re-checks until resolved. |
   | `canceled` | **None.** |

3. **The terminal signal may arrive by a different event.** `checkout.session.async_payment_succeeded` and `payment_intent.succeeded` are handled the same way and reach the same verification. Whichever arrives first writes the entry; L8/L8b make the other a no-op.

4. **`checkout.session.async_payment_failed` writes nothing** and marks the Session `expired`, releasing the one-live-session slot (§11).

5. **Identity of the entry.** `provider_payment_intent_id` is the PaymentIntent (`pi_…`); `provider_object_id` is the settled Charge (`ch_…`) where available. L8b makes one PaymentIntent capable of producing exactly one payment entry regardless of how many events describe it.

6. **Attribution requires metadata on the PaymentIntent, not only the Session.** Checkout Session metadata **does not propagate** to the PaymentIntent it creates. A `payment_intent.succeeded` event therefore carries *PaymentIntent* metadata — which is empty unless it was set deliberately — so an implementation reading only Session metadata would fail to attribute any payment whose PaymentIntent event arrived first, or arrived alone.

   Every V2 Session is therefore created with `financial_version`, `agreement_id` and `attempt_id` written to **both** `metadata` **and** `payment_intent_data.metadata`. Ingestion resolves attribution from whichever object the event carries, and PR 6 tests that a PaymentIntent webhook processes correctly **without the Session webhook ever being received**.

   A verified payment with no resolvable agreement raises `unattributable_payment` and stays out of the ledger (D-006).

### Refund processing

Refunds are the hardest case in the system: one charge can carry several genuine partial refunds, Stripe emits charge-level events rather than refund-level ones, and the same event may arrive more than once. The rules are therefore explicit.

1. **`event_id` prevents replay of the same Stripe event.** The primary key on `finance.stripe_events.event_id` makes a redelivered event a no-op, subject to the processing-status branch above.

2. **Ledger uniqueness on the Stripe Refund ID prevents double counting across *different* events.** Event-level deduplication is not sufficient: two distinct events can legitimately reference the same refund. **L8** — `UNIQUE (provider_object_id, livemode)` — is keyed on the **Stripe Refund object id** (`re_…`) for refund entries, so a given refund can produce exactly one ledger entry no matter how many events mention it.

3. **A charge-level event never becomes a refund ledger entry itself.** `charge.refunded` describes a charge, not a refund. Writing a ledger entry keyed on the charge id would collide with the payment entry and would double-count on the second partial refund. Charge-level events are **containers**; only Refund objects become `refund` entries.

4. **Handling `charge.refunded` means enumerating the underlying Refund objects — with pagination.** Processing must **not** read the embedded `charge.refunds.data` array, which is a truncated list page (default 10, with `has_more`). A charge with more refunds than one page would silently lose the remainder. Processing enumerates via the Refunds list API filtered by charge, following pagination to exhaustion, and inserts one `refund` entry per qualifying Refund object keyed on that refund's own id, with `parent_entry_id` resolved to the ledger entry carrying the charge's PaymentIntent (L8b). Refunds already present are skipped by L8, not by an application-level check.

5. **Only `succeeded` refunds enter the ledger.** A [Stripe Refund](https://docs.stripe.com/api/refunds/object) carries a `status` of `pending`, `requires_action`, `succeeded`, `failed`, or `canceled`. A refund is money leaving only when it succeeds.

   | Refund status | Ledger effect |
   |---|---|
   | `succeeded` | One `refund` entry |
   | `pending`, `requires_action` | **No entry.** The event is recorded and the reconciliation job re-checks the object until it reaches a terminal status. |
   | `failed`, `canceled` | **No entry.** The money never left. |

   Writing an entry on `pending` would overstate refunds for every refund that later fails, and the correction would be indistinguishable from a genuine reversal.

6. **A refund that regresses from `succeeded` is corrected, never edited.** Some payment methods can fail a refund after it reported success. Because the ledger is append-only, reconciliation raises a `refund_status_regression` exception and the correction is an attributed `reversal` of the refund entry — the money is restored to Received with a visible, attributed record of why.

7. **Partial refunds accumulate and cannot exceed the settled payment.** Each Refund object is its own entry; **L7** caps cumulative unreversed refunds at the parent's original `amount_cents`, serialised by `SELECT … FOR UPDATE` on the parent so concurrent refund events cannot jointly overshoot.

8. **Reconciliation trusts objects, not delivery.** The PR 3 job enumerates Stripe **PaymentIntent, Charge and Refund objects** over a window and diffs them against the ledger. It never assumes an event arrived. A refund present at Stripe with no corresponding ledger entry raises `provider_without_ledger`; a ledger entry with no provider object raises `ledger_without_provider`. Reconciliation may ingest verified provider payments and refunds; it raises exceptions for everything else and never issues a reversal or resolves an exception on its own (§10a).

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
  dedup_key           text NOT NULL GENERATED ALWAYS AS (
                        (CASE kind
                           WHEN 'unattributable_payment'::finance.exception_kind
                             THEN 'unattributable_payment'
                           WHEN 'provider_without_ledger'::finance.exception_kind
                             THEN 'provider_without_ledger'
                           WHEN 'ledger_without_provider'::finance.exception_kind
                             THEN 'ledger_without_provider'
                           WHEN 'amount_mismatch'::finance.exception_kind
                             THEN 'amount_mismatch'
                           WHEN 'currency_violation'::finance.exception_kind
                             THEN 'currency_violation'
                           WHEN 'missing_provider_object'::finance.exception_kind
                             THEN 'missing_provider_object'
                           WHEN 'orphan_refund'::finance.exception_kind
                             THEN 'orphan_refund'
                           WHEN 'refund_status_regression'::finance.exception_kind
                             THEN 'refund_status_regression'
                           WHEN 'stranded_checkout_attempt'::finance.exception_kind
                             THEN 'stranded_checkout_attempt'
                           WHEN 'stale_session_expiry_failed'::finance.exception_kind
                             THEN 'stale_session_expiry_failed'
                           WHEN 'reconciliation_run_failed'::finance.exception_kind
                             THEN 'reconciliation_run_failed'
                           WHEN 'provider_object_processing_failed'::finance.exception_kind
                             THEN 'provider_object_processing_failed'
                         END) || ':' ||
                        coalesce(provider_object_id, '')       || ':' ||
                        coalesce(ledger_entry_id::text, '')    || ':' ||
                        coalesce(agreement_id::text, '')       || ':' ||
                        coalesce(legacy_donation_id::text, '')
                      ) STORED
  first_detected_at   timestamptz NOT NULL default now()
  last_detected_at    timestamptz NOT NULL default now()
  occurrence_count    integer NOT NULL default 1 CHECK (occurrence_count >= 1)
  first_run_id        uuid NULL -> finance.reconciliation_runs(id) (RESTRICT)
  last_run_id         uuid NULL -> finance.reconciliation_runs(id) (RESTRICT)
  consecutive_failure_runs integer NOT NULL default 0 CHECK (consecutive_failure_runs >= 0)
  quarantined_at      timestamptz NULL
  quarantine_reason   text NULL
  released_at         timestamptz NULL
  released_by         uuid NULL -> auth.users(id) (RESTRICT)
  release_note        text NULL
  resolution_status   finance.exception_resolution NOT NULL default 'open'
  resolved_at         timestamptz NULL
  resolved_by         uuid NULL -> auth.users(id) (RESTRICT)
  resolution_note     text NULL

  CHECK ((resolved_at IS NULL) = (resolved_by IS NULL))            -- no partial attribution
  CHECK ((resolution_status = 'open') = (resolved_at IS NULL))      -- open iff unresolved
  CHECK ((resolution_status = 'open') = (resolution_note IS NULL))  -- note iff closed
  CHECK (resolution_note IS NULL
         OR length(btrim(resolution_note)) > 0)                      -- and never blank
  CHECK (last_detected_at >= first_detected_at)
  CHECK ((quarantined_at IS NULL) = (quarantine_reason IS NULL))
  CHECK ((released_at IS NULL) = (released_by IS NULL))
  CHECK (released_at IS NULL OR quarantined_at IS NOT NULL)   -- cannot release what was never quarantined
  CHECK (released_at IS NULL OR released_at <> quarantined_at) -- monotonicity backstop (B-58/B-63)

  -- provider_object_processing_failed shape (B-62)
  CHECK (kind <> 'provider_object_processing_failed' OR (
           provider_object_id IS NOT NULL
       AND detail ? 'object_type'
       AND detail ->> 'object_type' IN
             ('payment_intent','charge','refund','checkout_session')
       AND detail ? 'error_class'
       AND detail ->> 'error_class' IN
             ('malformed_object','object_not_found','object_scoped_bad_request')
  ))

CREATE UNIQUE INDEX ON finance.reconciliation_exceptions (dedup_key, livemode)
  WHERE resolution_status = 'open';
```

`finance.exception_kind` values: `unattributable_payment`, `provider_without_ledger`, `ledger_without_provider`, `amount_mismatch`, `currency_violation`, `missing_provider_object`, `orphan_refund`, `refund_status_regression`, `stranded_checkout_attempt`, `stale_session_expiry_failed`, **`reconciliation_run_failed`**, **`provider_object_processing_failed`**.

### Exception identity and lifecycle

Without a dedup rule the first real run against ~4,000 mismatches inserts 4,000 rows, the next scheduled run inserts the same 4,000 again, and the founder's queue is unusable within days. `id` is a surrogate; **`dedup_key` is the identity of the mismatch itself.**

It is a **`GENERATED ALWAYS AS … STORED` column**, computed by the database from the fields identifying *which* mismatch this is — never from amounts or timestamps, which change while the mismatch stays the same. The full expression is in the DDL above.

Making it generated rather than writer-supplied is the point: a writer able to supply `dedup_key` **defeats deduplication by supplying a different one**, inserting 4,000 fresh rows every run while every constraint still passes. `GENERATED ALWAYS` makes that a PostgreSQL error rather than a convention — no trigger, review or discipline is relied upon.

#### Why the expression spells out every enum label

An earlier draft wrote `kind::text`. **That does not compile.** Generated columns require an `IMMUTABLE` expression, and enum-to-text conversion is only `STABLE` — enum labels can be renamed by `ALTER TYPE`, so the same input could later produce different output.

Verified against the live database (PostgreSQL 17.6), read-only apart from a `TEMP` table that touches no persistent schema:

| Probe | Result |
|---|---|
| `pg_proc.provolatile` for `enum_out(anyenum)` | **STABLE** — not immutable |
| `CREATE TEMP TABLE … GENERATED ALWAYS AS (k::text) STORED` over an existing enum | **Rejected** — table not created |
| Same with the explicit `CASE` mapping | **Accepted**; produced canonical `paid:ch_123` and `refunded:` |
| `INSERT` supplying the generated column | **Rejected** |

The `CASE` maps each of the twelve closed `exception_kind` values to a text **literal**, which is immutable, so the whole expression is immutable and the DDL is accepted.

Wrapping `kind::text` in a function falsely declared `IMMUTABLE` would satisfy the parser and is **forbidden**: it lies to the planner, and a later `ALTER TYPE … RENAME VALUE` would silently corrupt stored keys that no longer match what the expression now produces — every affected exception would lose its identity and re-insert as new.

**Adding a value to `exception_kind` requires adding its `CASE` branch in the same migration** — and the column is **`NOT NULL`**, so an omission is rejected by the database rather than merely caught in review.

An unmapped value makes the `CASE` yield `NULL`, which propagates through `||` and produces a `NULL` key. Without `NOT NULL` that row would insert successfully with no deduplication identity, silently disabling dedup for that entire kind — the exact failure D-040 exists to prevent, reachable by omitting one line in a future migration.

**The test suite is defence in depth, not the enforcement.** Acceptance test 108 asserts every enum value maps to a non-null canonical key, but the database rejects the invalid state independently of whether anyone runs the suite.

Verified against PostgreSQL 17.6 with a `TEMP` table and one label deliberately left unmapped:

| Probe | Result |
|---|---|
| `text NOT NULL GENERATED ALWAYS AS (…) STORED` accepted | **Yes** |
| Row with a **mapped** value | Inserted; key canonical (`paid:ch_1`) |
| Row with the **unmapped** value | **Rejected** — zero rows present |
| `INSERT` supplying `dedup_key` | **Rejected** |

| Situation | Behaviour |
|---|---|
| New mismatch | Insert; `occurrence_count = 1`, `first_detected_at = last_detected_at = now()`, both run ids set |
| **Same mismatch rediscovered while open** | **Upsert, not insert.** `ON CONFLICT (dedup_key, livemode) WHERE resolution_status='open'` → `last_detected_at = now()`, `occurrence_count = occurrence_count + 1`, `last_run_id = <run>` |
| Material detail changed (the amount gap moved) | The same upsert merges `detail` and retains the prior value under `detail.history`, so a widening discrepancy is visible rather than overwritten |
| Resolved, then recurs | The unique index covers **open rows only**, so a resolved row does not block a new one. Recurrence inserts a **fresh** row — a mismatch returning after a founder judged it is a new fact, and silently reopening the old row would erase the record that it was once resolved |
| Different `livemode` | Separate rows; `livemode` is in the uniqueness key, so a test-mode mismatch never collapses onto a live one |
| Two concurrent runs find it simultaneously | The unique index picks the winner; the loser takes the `ON CONFLICT` branch. Concurrency is resolved by the database, not by application checks |

**`detected_at` is deliberately gone.** It was ambiguous — first detection or latest? — and the two questions have different answers and different uses. `first_detected_at` says how long this has been wrong; `last_detected_at` says whether it still is.

**Bounded growth follows.** Rows scale with distinct unresolved mismatches, not with runs × mismatches. A permanently broken record accrues `occurrence_count`, not rows.

### Resolution

Resolution is a founder judgement about a financial discrepancy, so it carries the same attribution requirements as dry-run approval — and previously had none of them. Direct `UPDATE` on `resolution_status`, `resolved_at`, `resolved_by` and `resolution_note` is **withdrawn from every role**.

**`finance.resolve_exception(p_exception_id uuid, p_resolution finance.exception_resolution, p_note text)`** is the only path. `SECURITY DEFINER`, fixed `search_path`, `EXECUTE` to `authenticated` only:

1. Raises unless `public.is_founder()`.
2. Locks the row `FOR UPDATE`.
3. Requires the current `resolution_status` to be **`open`**.
4. Accepts only **`resolved`** or **`dismissed`** as a target — `open` is rejected, so the function cannot reopen anything.
5. Requires a non-blank `p_note`.
6. Sets `resolved_by = auth.uid()` and `resolved_at = clock_timestamp()` **internally**; neither is a parameter.
7. Sets status and note **atomically**, so no intermediate state violates the resolution `CHECK`s.

Consequences:

- **Attribution cannot be spoofed.** A founder cannot record another user as the resolver, nor backdate the decision, because neither value is supplied.
- **Resolution is terminal.** A second call raises, so `resolved` cannot become `dismissed`, a completed resolution cannot be edited, and an old exception cannot be quietly reopened. Correcting a wrong resolution is a deliberate act requiring a new decision entry, not an `UPDATE`.
- **Resolution wins over quarantine.** An actively quarantined row may be resolved; the function does not check quarantine state. Resolving removes the row from `open`, so the partial unique index stops covering it and a genuine recurrence later starts a fresh row with a zero streak — exactly as the quarantine lifecycle describes.

The table constraints make the intermediate states unreachable independently of the function: `(resolved_at IS NULL) = (resolved_by IS NULL)` forbids partial attribution, `(resolution_status = 'open') = (resolved_at IS NULL)` forbids an open row carrying resolution data or a closed row missing it, and a non-blank `resolution_note` is required once closed.

### Creation is also a protected transition

Revoking `UPDATE` protects a transition only if the row cannot be **created** already in the destination state. `service_role` previously held table-wide `INSERT`, so it could insert an exception already `resolved` with an arbitrary `resolved_by` and backdated `resolved_at`, already quarantined without ever reaching the three-failure threshold, or already released. Every guarantee `finance.resolve_exception()`, `finance.quarantine_object()` and `finance.release_quarantine()` provide was reachable around, by the one role that runs unattended.

Two independent mechanisms close it.

**1. The `INSERT` grant is column-scoped.** `service_role` may insert only the columns legitimate exception creation needs:

```
kind, agreement_id, ledger_entry_id, provider_object_id, legacy_donation_id,
livemode, amount_cents, currency, detail,
first_detected_at, last_detected_at, occurrence_count,
first_run_id, last_run_id, consecutive_failure_runs
```

`id` and `resolution_status` take their defaults; `dedup_key` is generated. **The nine protected lifecycle columns are excluded** — `quarantined_at`, `quarantine_reason`, `released_at`, `released_by`, `release_note`, `resolution_status`, `resolved_at`, `resolved_by`, `resolution_note`.

**2. A `BEFORE INSERT` trigger enforces the same thing independently of privileges.** It raises unless the new row has `resolution_status = 'open'` and all nine protected columns `NULL`. The trigger is the load-bearing control: a grant can be widened by a later migration, or bypassed by a superuser or table owner, and the guarantee has to survive that. The grant makes the mistake unlikely; the trigger makes it impossible.

**What still works unchanged:** ordinary exception creation, the deduplicating `ON CONFLICT` upsert (which touches only `last_detected_at`, `occurrence_count`, `detail`, `last_run_id` and `consecutive_failure_runs`), streak updates, and all three lifecycle functions — which are `SECURITY DEFINER` and therefore act with the function owner's rights, not the caller's grants.

### Quarantine

Rule 11 says an object failing terminally in three consecutive runs is quarantined. The state lives **on the exception row**, because `dedup_key` already is the cross-run identity of the object-and-problem pair.

**Quarantine history is never erased.** An earlier draft said release "clears `quarantined_at`" while a `CHECK` required `released_at IS NULL OR quarantined_at IS NOT NULL` — clearing the timestamp with a release recorded would have violated that constraint, so release was literally impossible. The grants compounded it: a founder could write only `released_at`/`released_by`, and so could not have cleared `quarantined_at` or reset the streak even if the constraint had allowed it, while `service_role` is deliberately forbidden from releasing at all.

Both timestamps are therefore **retained**, and quarantine is a **derived** state:

```sql
-- actively quarantined
quarantined_at IS NOT NULL
  AND (released_at IS NULL OR released_at < quarantined_at)
```

| Question | Answer |
|---|---|
| **What counts a streak?** | `consecutive_failure_runs`, incremented **only when `last_run_id` differs from the current run**, so repeated attempts within one run count once. |
| **What breaks a streak?** | Any run in which the object is examined and does not fail terminally. The counter resets to 0. |
| **When does quarantine engage?** | On the increment reaching **3**, through `finance.quarantine_object()`, which sets `quarantined_at` monotonically (see below) and records the terminal error class in `quarantine_reason`. Never by direct `UPDATE`, and never with `now()`. |
| **What does it change?** | Actively quarantined objects are **skipped** — not fetched, not retried, not counted as failures. The exception stays `open` and visible. |
| **Who releases it?** | A founder, through `finance.release_quarantine(p_exception_id uuid, p_note text)` — see the monotonicity rule below. `service_role` holds no `EXECUTE` on it and no `UPDATE` on those columns. |
| **What happens after release?** | `released_at > quarantined_at`, so the object is no longer actively quarantined and re-enters normal processing on the next run. |
| **What if it fails again?** | Three further consecutive terminal failures set a **newer** `quarantined_at`, which is again greater than `released_at` — so the derived predicate makes it active once more. No column is cleared and no state is ambiguous. |
| **What if it is resolved while quarantined?** | Resolution wins; the row leaves `open` and the partial unique index no longer covers it, so a genuine recurrence later starts a fresh row with a zero streak. |

**Honest limits of the history.** These columns record the **latest** quarantine and the **latest** release, not a complete audit trail of every cycle. That is deliberate — the ledger is the append-only record, and the exceptions queue is an operational work list. Where a full cycle history is later required, it belongs in its own append-only table and needs a decision entry; this document does not claim to provide one.

Quarantine is deliberately **not** silent: it stops retrying, it does not stop reporting.

#### Both transitions must be strictly monotonic

The derived predicate compares `released_at` against `quarantined_at`, so **their order is the state**. `now()` is not safe to write either of them: PostgreSQL fixes `now()` at **transaction start**, so a transaction that began before the opposing transition committed will write a timestamp *earlier* than the value already stored. A release could then commit successfully and leave the object still actively quarantined — the function reports success and nothing changes. Equal timestamps are just as bad: `released_at = quarantined_at` fails `released_at < quarantined_at`, so the object stays quarantined.

Both transitions therefore run through functions that lock the row, read the opposing timestamp, and write a value strictly greater than it:

```sql
-- inside finance.release_quarantine(), after SELECT … FOR UPDATE
released_at := GREATEST(clock_timestamp(),
                        quarantined_at + interval '1 microsecond');

-- inside finance.quarantine_object(), after SELECT … FOR UPDATE
quarantined_at := GREATEST(clock_timestamp(),
                           COALESCE(released_at, '-infinity'::timestamptz)
                             + interval '1 microsecond');
```

`clock_timestamp()` reads the wall clock **at statement execution**, not transaction start, so a long-running transaction cannot write a stale value. `GREATEST(…, opposing + 1µs)` guarantees strict ordering even when the clock is adjusted backwards, when two transactions overlap, or when both happen inside the same microsecond. The `FOR UPDATE` lock makes the read-then-write atomic, so two concurrent transitions serialise rather than racing.

`finance.quarantine_object(p_exception_id uuid)` is the counterpart, executable by `service_role` only. **Neither role holds a direct `UPDATE`** on `quarantined_at`, `quarantine_reason`, `released_at` or `released_by` — the ordering guarantee is worthless if any caller can bypass it with a raw `UPDATE`.

**It takes no reason parameter.** `quarantine_reason` is derived internally from the row's own validated `detail.error_class`, because a separately supplied reason can contradict the exception it describes — recording "malformed object" against a row whose `error_class` says `object_not_found` produces an audit trail that is worse than none.

#### Quarantine preconditions

Ordering was necessary but not sufficient: the function still had to refuse rows that should never be quarantined at all. After `SELECT … FOR UPDATE` it raises unless **every** one holds:

| Precondition | Why |
|---|---|
| `resolution_status = 'open'` | A resolved or dismissed exception is closed business; quarantining it would resurrect it into the work list |
| `kind = 'provider_object_processing_failed'` | Quarantine means "stop fetching this provider object". No other kind describes a repeatedly unprocessable object, and quarantining, say, an `amount_mismatch` would silently stop reconciling a real discrepancy |
| Not already actively quarantined | Re-quarantining an active row would move `quarantined_at` forward and extend the skip indefinitely without a new failure justifying it |
| `consecutive_failure_runs >= 3` | The documented threshold. Without this the first or second failure could quarantine, skipping an object that would have succeeded on the next run |
| `provider_object_id` present and `detail.error_class` valid | The shape `CHECK` guarantees this for well-formed rows; the function asserts it again because it derives `quarantine_reason` from that field and must not write a reason built from a missing value |

The threshold check is what makes release meaningful: a released row returns to processing with `consecutive_failure_runs = 0`, so it **cannot be quarantined again until three fresh consecutive failures accumulate**. Release is a real second chance rather than a formality the next run immediately undoes.

A `CHECK (released_at IS NULL OR released_at <> quarantined_at)` rejects the equality case at the table level as a backstop.

**The `NULL` branch is not optional.** An earlier draft wrote `CHECK (released_at IS DISTINCT FROM quarantined_at)`, and `NULL IS DISTINCT FROM NULL` evaluates to **false** — so with both timestamps absent, as every exception begins, the constraint would have rejected **every ordinary exception insert**, breaking the entire queue rather than only its quarantine path. Verified against PostgreSQL 17.6: the old form returns `false` for both-null; the corrected form returns `true` for both-null and for quarantined-with-no-release, `false` for equal non-null values, and `true` for correctly ordered release and re-quarantine.

The consequence is that a release always lands on the released side and a re-quarantine always lands on the quarantined side, **regardless of transaction age, overlap, or clock adjustment**. Test 101 exercises this with two concurrent sessions.

---

## 10a. Reconciliation operations (PR 3)

The scenario this section answers: the job runs for the first time against real Stripe data, finds thousands of mismatches, is interrupted midway, overlaps a scheduled run, hits 429s and timeouts, and is rerun.

### `finance.reconciliation_runs`

```
finance.reconciliation_runs
  id                        uuid PK default gen_random_uuid()
  livemode                  boolean NOT NULL
  implementation_version    text NOT NULL
  window_start              timestamptz NOT NULL
  window_end                timestamptz NOT NULL
  window_exhausted          boolean NOT NULL default false
  cursor                    jsonb NOT NULL default '{}'::jsonb
  status                    finance.run_status NOT NULL default 'running'
  resumed_from_run_id       uuid NULL -> finance.reconciliation_runs(id) (RESTRICT)
  started_at                timestamptz NOT NULL default now()
  heartbeat_at              timestamptz NOT NULL default now()
  finished_at               timestamptz NULL
  objects_scanned           integer NOT NULL default 0
  objects_matched           integer NOT NULL default 0
  exceptions_created        integer NOT NULL default 0   -- real inserts only
  exceptions_reopened       integer NOT NULL default 0   -- real upserts only
  api_calls                 integer NOT NULL default 0
  retries                   integer NOT NULL default 0
  error                     text NULL
  dry_run                   boolean NOT NULL default false
  -- dry-run report (B-54)
  would_create_count        integer NULL CHECK (would_create_count >= 0)
  would_reopen_count        integer NULL CHECK (would_reopen_count >= 0)
  prospective_by_kind       jsonb NULL
  report_samples            jsonb NULL
  report_version            text NULL
  report_completed_at       timestamptz NULL
  -- approval (B-53)
  approved_by               uuid NULL -> auth.users(id) (RESTRICT)
  approved_at               timestamptz NULL
  approval_note             text NULL
  authorized_by_run_id      uuid NULL -> finance.reconciliation_runs(id) (RESTRICT)

  CHECK (window_end > window_start)
  CHECK ((status = 'running') = (finished_at IS NULL))
  CHECK ((status = 'completed') = window_exhausted)          -- biconditional (B-56)
  CHECK (resumed_from_run_id IS DISTINCT FROM id)
  CHECK (authorized_by_run_id IS DISTINCT FROM id)
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
  CHECK ((approved_at IS NULL) = (approval_note IS NULL))
  CHECK (approval_note IS NULL OR length(btrim(approval_note)) > 0)
  CHECK (dry_run OR authorized_by_run_id IS NOT NULL)
  CHECK (NOT dry_run OR authorized_by_run_id IS NULL)
  CHECK (NOT dry_run OR (exceptions_created = 0 AND exceptions_reopened = 0))
  CHECK (dry_run OR (would_create_count IS NULL AND would_reopen_count IS NULL
                     AND prospective_by_kind IS NULL AND report_samples IS NULL
                     AND report_version IS NULL AND report_completed_at IS NULL))
  CHECK (report_completed_at IS NULL
         OR (would_create_count IS NOT NULL AND would_reopen_count IS NOT NULL
             AND prospective_by_kind IS NOT NULL AND report_version IS NOT NULL))
  CHECK (approved_at IS NULL OR report_completed_at IS NOT NULL)   -- no approval without a report
```

```sql
CREATE UNIQUE INDEX ON finance.reconciliation_runs (livemode) WHERE status = 'running';
CREATE UNIQUE INDEX ON finance.reconciliation_runs (resumed_from_run_id)
  WHERE resumed_from_run_id IS NOT NULL;
```

`finance.run_status` enum: `running`, `partial`, `completed`, `failed`, `abandoned`.

### `window_exhausted` is a biconditional

The earlier constraint was `status <> 'completed' OR window_exhausted`, which proves *completed ⇒ exhausted* and nothing else. It still permitted `partial`, `failed`, `abandoned` and even `running` rows carrying `window_exhausted = true` — contradicting the state table and making the flag unusable as evidence, since a `true` value proved nothing on its own.

The constraint is now `CHECK ((status = 'completed') = window_exhausted)`: **only `completed` may carry `true`, and `completed` may not carry `false`.** Every status is tested in both flag states.

### The dry-run report

Rule 17 said a founder reviews the dry run before approving, and D-049 defines `exceptions_created`/`exceptions_reopened` as **real writes**. Both hold — which means those counters are necessarily `0` in a dry run, enforced by `CHECK`. A founder was therefore being asked to approve on the basis of two zeros.

The report columns carry what is actually reviewable, and are populated **only** by dry runs:

| Column | Contents |
|---|---|
| `would_create_count` | Prospective inserts had this been a writing run |
| `would_reopen_count` | Prospective upserts onto already-open exceptions |
| `prospective_by_kind` | Counts keyed by `exception_kind`, so a founder sees *what* is wrong, not only how much |
| `report_samples` | A **bounded, deterministic** sample per kind — capped at 20 per kind and 200 total, ordered by `dedup_key` so two dry runs over identical data produce identical samples. Contains `dedup_key`, provider object id, amount, currency and error class. **No cardholder name, address, email or phone** — the same sanitization rule as `stripe_events.payload` |
| `report_version` | Schema version of the report structure, so a stale-format report is detectable rather than silently misread |
| `report_completed_at` | Set when the report is complete; **approval is impossible without it**, enforced by `CHECK` |

"Would create" and "did create" are kept in separate columns deliberately. Overloading the real counters with prospective semantics would make every historical run's numbers ambiguous about whether they describe writes or intentions.

### Launch authorization — the precise model (B-53)

The earlier trigger validated only `dry_run = true`, an approval, matching `livemode`, and `window_start` not earlier. It would therefore accept authorization from a **running, partial, failed or abandoned** dry run — a job that never finished could authorize money-writing reconciliation. And describing it as the approved run "covering the window" was inaccurate, because nothing constrained `window_end`.

**This is launch authorization, not window coverage.** Naming it accurately matters: reconciliation advances forward indefinitely, so a containment model would demand re-approval on every run and would be abandoned in practice. What a founder approves is a *launch*, scoped to three things.

An authorizing dry run must satisfy **all** of:

| Requirement | Why |
|---|---|
| `dry_run = true` | Only a rehearsal may authorize |
| `status = 'completed'` | A partial or failed rehearsal proves nothing |
| `window_exhausted = true` | Implied by the biconditional, asserted explicitly |
| `finished_at IS NOT NULL` | It must have ended |
| `error IS NULL` | A run that errored is not evidence |
| `approved_by`, `approved_at` non-null | A human said yes |
| `report_completed_at IS NOT NULL` | They had something to say yes *to* |

**Approval itself is rejected** unless the run is `completed`, `error IS NULL`, and its report is finished. A `running`, `partial`, `failed` or `abandoned` dry run cannot be approved at all.

An authorization grants exactly three things:

1. **A mode** — the writing run's `livemode` must match.
2. **An earliest horizon** — the writing run's `window_start` may be no earlier than the approved run's `window_start`. Reaching further back than what was rehearsed is not authorized.
3. **An implementation version** — the writing run's `implementation_version` must equal the approved run's. **Material code change invalidates approval**, because the rehearsal exercised different behaviour. Its provenance is specified below; a caller-supplied label would make this check theatre.

**The canary is contained.** The first writing run for a `(livemode, implementation_version)` pair — one with no prior `completed` writing run — must be **fully contained within the approved dry run's window** *and* span at most 24 hours. Only after that canary reaches `completed` may later writing runs extend beyond the rehearsed `window_end`.

So containment applies exactly where it is meaningful — the first real write — and the horizon plus version bound everything after.

#### Approval is a function, and approved evidence is frozen (B-60)

Direct founder `UPDATE` on `approved_by`/`approved_at` is **withdrawn**. It allowed two things it should not have: a founder could write **another actor's id** into `approved_by`, and could set `approved_at` to any timestamp — so the audit trail recorded whatever the caller typed rather than what happened.

Approval runs through **`finance.approve_dry_run(p_run_id uuid, p_note text)`**, `SECURITY DEFINER`, fixed `search_path`, `EXECUTE` to `authenticated` only:

1. Raises unless `public.is_founder()`.
2. Locks the run row `FOR UPDATE` and validates **every** precondition of the table above — `dry_run`, `status = 'completed'`, `window_exhausted`, `finished_at` present, `error IS NULL`, `report_completed_at` present.
3. Sets `approved_by = auth.uid()` and `approved_at = clock_timestamp()` **internally**. Neither is a parameter, so neither can be supplied.
4. Requires a non-blank `p_note` and stores it in **`approval_note`** — the founder's recorded reason for accepting this evidence. The note is frozen with everything else.
5. Raises if `approved_at` is already set. **Re-approval and replacement approval are refused**; a superseding approval requires a new dry run, so an approval can never be quietly moved to different evidence.

**The approved evidence is then frozen.** A trigger rejects any `UPDATE` where **`OLD.approved_at IS NOT NULL`** that changes any of:

`status`, `error`, `finished_at`, `window_exhausted`, `window_start`, `window_end`, `livemode`, `implementation_version`, `dry_run`, `would_create_count`, `would_reopen_count`, `prospective_by_kind`, `report_samples`, `report_version`, `report_completed_at`, `approved_by`, `approved_at`, `approval_note`.

#### Creation is also a protected transition

The freeze trigger fires on `UPDATE` and keys on `OLD.approved_at`, so it says nothing about `INSERT`. With table-wide `INSERT`, `service_role` could create a run **already** carrying `approved_by`, `approved_at`, `approval_note` and a completed report, then cite it through `authorized_by_run_id` — **the reconciliation job manufacturing its own authorization**, with `finance.approve_dry_run()` never called and the freeze trigger never fired. The entire approval gate was optional for the one role that needs gating.

**1. Column-scoped `INSERT`.** `service_role` may insert only:

```
livemode, implementation_version, window_start, window_end, cursor,
resumed_from_run_id, dry_run, authorized_by_run_id
```

`id`, `status`, `window_exhausted`, `started_at`, `heartbeat_at` and the counters take their defaults. **`approved_by`, `approved_at` and `approval_note` are excluded**, as are the report columns — a report is *produced* by an `UPDATE` during the run, not asserted at creation.

**2. A `BEFORE INSERT` trigger** raises unless all three approval columns are `NULL` at creation, independently of grants.

**`authorized_by_run_id` remains insertable**, because a writing run must cite its authorization at creation. It is validated by the existing trigger against a genuinely approved dry run, and that dry run can now only have been approved by `finance.approve_dry_run()` — which is what makes the citation meaningful rather than circular.

**`finance.approve_dry_run()` is therefore the only `NULL →` approved transition**, at insert and at update alike.

**The predicate is `OLD.approved_at`, not `NEW.approved_at`.** Freezing on the new value would freeze the approval transition itself — the one `UPDATE` that legitimately sets `approved_at` from `NULL` would see a non-null `NEW` and reject, making approval impossible in exactly the way B-52's quarantine release was impossible. Keying on `OLD` permits precisely one transition (`NULL →` internally computed) and rejects every mutation after it.

The trigger fires **regardless of role**, so `service_role` cannot alter what a founder approved. Without the freeze the authorization is meaningless: the job could approve a narrow clean report and afterwards widen the window, swap the version, or rewrite the findings the founder actually read.

### The run state machine

Five statuses, and the distinction between two of them is load-bearing.

| Status | Meaning | Window exhausted? | Resumable? | `finished_at` |
|---|---|---|---|---|
| `running` | In progress; heartbeat live | — | no (it is running) | NULL |
| `partial` | Stopped at a work ceiling with the window **unfinished** | false | **yes** | set |
| `completed` | Every object type exhausted the **whole** window | **true** | no | set |
| `failed` | Retry budget exhausted or a run-fatal error; cursor intact | false | **yes** | set |
| `abandoned` | Heartbeat went stale; superseded by a resumer | false | **yes** | set |

**`partial` exists because "completed but unfinished" would silently skip money.** A run that stops at the object, API-call or time ceiling has not finished its window. Marking it `completed` and then deriving the next window from `previous completed run's window_end` — as rule 1 does — would advance past everything the bounded run never reached. Those Stripe objects would never be examined by any run, and nothing would report a gap.

So: **`completed` means every object type exhausted the entire window**, enforced by the biconditional `CHECK ((status = 'completed') = window_exhausted)`. Only a `completed` run advances the watermark. A `partial` run's successor inherits **the same `window_start` and `window_end`** and resumes from its `cursor`.

### Resume lineage

`resumed_from_run_id` is the self-reference the previous text assumed without providing. A resuming run sets it to the run it continues.

- Resumable statuses are `partial`, `failed` and `abandoned`. A trigger rejects a `resumed_from_run_id` pointing at a `running` or `completed` run — resuming a live run would defeat single-flight, and resuming a completed one would redo finished work.
- Self-reference is rejected by `CHECK`.
- A resuming run copies `window_start`, `window_end` and `cursor` from its predecessor; a trigger enforces the window match, so a resume cannot quietly change scope.
- Lineage is a chain, not a tree: at most one run may resume a given predecessor, enforced by `CREATE UNIQUE INDEX ON finance.reconciliation_runs (resumed_from_run_id) WHERE resumed_from_run_id IS NOT NULL`.

### The twenty operational rules

| # | Rule |
|---|---|
| 1 | **Window.** A fresh run covers `[window_start, window_end)` where `window_end = now() - 5 minutes` (settlement lag) and `window_start = the most recent **`completed`** run's `window_end` - 60 minutes` (overlap margin). **Only a `completed` run advances the watermark**, because only `completed` means the window was exhausted. A `partial`, `failed` or `abandoned` predecessor is *resumed* instead: its successor inherits the identical window and cursor. Overlap is deliberate — re-examining an hour of reconciled objects is free, since matching is idempotent and exceptions dedup. |
| 2 | **Initial lookback.** Run #1 uses `window_start = the earliest `occurred_at` in `finance.ledger_entries`, or 90 days before `now()` where the ledger is empty. Recorded on the run row, so the horizon is auditable rather than implied. |
| 3 | **Cursor.** `cursor` holds, per object type, the last processed object id and Stripe page token. Written **after each page completes**, never mid-page. A resumed run restarts at the last committed page boundary. |
| 4 | **Page and batch sizes.** Stripe list calls use `limit = 100` (the API maximum). Database writes batch at 500 rows per statement. Both are stated so a reviewer can check them, not left to the implementer. |
| 5 | **Resume.** A `running` run whose `heartbeat_at` is older than **10 minutes** is marked `abandoned` by the next starter, which then resumes from its `cursor` under a new run whose `resumed_from_run_id` names it. The same mechanism continues `partial` and `failed` runs. Deployments mid-run are therefore ordinary interruptions. |
| 6 | **Single flight.** The partial unique index on `(livemode) WHERE status = 'running'` makes a second concurrent run for the same mode impossible at the database level. A starter that loses the race exits cleanly rather than queueing. |
| 7 | **Exhaustive pagination for every object type** — PaymentIntents, Charges, Refunds, and Checkout Sessions alike. A single unpaginated page is not a search. This was previously required only of Refunds and Sessions; the failure semantics are identical for all four. |
| 8 | **429 handling.** Honour `Retry-After` when present; otherwise exponential backoff from 1s, doubling, jittered, capped at 60s. Maximum **8 attempts** per call. Rate-limit waits do not count against the run's time budget. |
| 9 | **Timeouts and network failures** are classified as **transient** and follow the same backoff. A connection reset mid-page re-fetches that page from its committed cursor. |
| 10 | **Error classes — four, not three.** See the table below. The distinction that matters: an authentication or configuration failure is **run-scoped** and must not be swallowed as one bad object. |
| 11 | **Retry budget and quarantine.** 8 attempts per call, **200 retries per run** in aggregate. Exceeding it ends the run `failed` with the cursor intact. An object that fails terminally in three consecutive runs is quarantined — see the quarantine lifecycle above for how the streak is counted, broken, and released. |
| 12 | **Exception dedup** — see the lifecycle rules above. Growth is bounded by distinct mismatches. |
| 13 | **Mode isolation.** A run reconciles exactly one `livemode`, using the API key for that mode. Test and live runs are separate rows, separate locks, separate exceptions. Neither can write an entry or exception in the other's mode. |
| 14 | **No double processing.** The overlap in rule 1 means an object may legitimately be *examined* twice; it can never be *recorded* twice, because ledger writes are protected by L8/L8b and exceptions by `dedup_key`. Safety comes from write-side identity, not from perfect read-side partitioning — which is the only design that survives retries. |
| 15 | **Observability.** Every counter above is on the run row: scanned, matched, exceptions created, exceptions reopened, api calls, retries, duration from `started_at`/`finished_at`. A founder can answer "did it work, and what did it find" from one row. |
| 16 | **Alert thresholds.** During shadow (PRs 3–4), `provider_without_ledger` for legacy-tagged charges is the **expected** signal and is not alerted. Alert on: run `failed`; run `abandoned`; `exceptions_created` in a single run exceeding **3× the trailing 7-run median**; any `unattributable_payment` in live mode; any exception open longer than **14 days**. Volume alone is not an alarm — a *change* in volume is. |
| 17 | **First run is a dry run, and approval is a stored, validated fact.** `dry_run = true` enumerates, matches and counts, writing **no** ledger entries and **no** exceptions — only the run row and its report. A founder approves through `finance.approve_dry_run()`; every writing run cites an approved dry run via `authorized_by_run_id`. The complete and only normative specification is **Launch authorization** above — mode, earliest horizon, implementation version, and a contained 24-hour canary. |
| 18 | **Maximum work.** One run stops at whichever comes first: **50,000 objects scanned**, **20,000 API calls**, or **20 minutes** elapsed. It then ends **`partial`** — never `completed` — with `window_exhausted = false` and the cursor preserved. Its successor inherits the same window and resumes. A bounded run that stops honestly is worth more than an unbounded one that is killed, and far more than one that claims completion it did not reach. |
| 19 | **Rerun safety.** A rerun after partial completion resumes from the cursor. A rerun of an already-complete window re-examines and re-matches, creating nothing new — proven by rules 12 and 14. Reruns are always safe; that is the property the whole design buys. |
| 20 | **Reconciliation cannot change financial truth on its own** — see below. |

### Error classification

Treating every non-429 4xx as an object-level problem was wrong. A `401` is not a bad charge; it is a broken run, and skipping it per-object would march through the whole window raising thousands of meaningless exceptions while reconciling nothing.

| Class | Examples | Handling |
|---|---|---|
| **Transient call failure** | 429, 5xx, timeout, connection reset | Retry with backoff (rule 8). Never an exception unless the budget is exhausted. |
| **Object-terminal failure** | 404 on a specific object, malformed object payload, a 400 scoped to one object's fetch | Raise an exception for **that object**, increment its `consecutive_failure_runs`, continue the run. |
| **Run-fatal failure** | **401** invalid API key, **403** insufficient permissions, invalid list-request parameters, account configuration errors, missing webhook secret | **End the run `failed` with the cursor intact.** Raise one `reconciliation_run_failed` exception carrying the error class, and alert. Never per-object, never skipped, never retried within the run. |
| **Ambiguous provider state** | Contradictory responses, unknown status values | Raise an exception and **write nothing to the ledger**. |

A run-fatal failure leaves `window_exhausted = false`, so the window is not advanced and the next run resumes exactly where this one stopped. Nothing is lost and nothing is silently skipped.

#### Object-terminal failures have their own kind

The error table drives quarantine off object-terminal failures, but the closed `exception_kind` enum had no value representing one. `reconciliation_run_failed` is explicitly run-scoped and **must not** be reused — doing so would make a broken run indistinguishable from a bad object, and would let one run's failure inflate an object's quarantine streak.

**`provider_object_processing_failed`** is that value.

| Property | Rule |
|---|---|
| Required fields | Enforced by `CHECK`, not convention: `provider_object_id` NOT NULL; `detail.object_type` present and one of `payment_intent`, `charge`, `refund`, `checkout_session`; `detail.error_class` present and one of `malformed_object`, `object_not_found`, `object_scoped_bad_request` |
| `dedup_key` | Produced by the generated column from `kind` and `provider_object_id`, the only populated identity fields. One object with a persistent processing failure therefore maps to exactly one open row. It cannot be supplied by the writer |
| `detail` | Sanitized: `object_type`, `error_class` (`malformed_object`, `object_not_found`, `object_scoped_bad_request`), provider status code, and the run id. **No cardholder name, address, email or phone** |
| Streak | Each run in which this object fails terminally increments `consecutive_failure_runs` once, via the standard upsert guard on `last_run_id` |
| Recovery | A later run that examines the object successfully finds the open row **by the same `dedup_key`** and resets `consecutive_failure_runs` to 0. The row stays `open` for founder review — a successful examination is not a founder's judgement, so it does not resolve anything |
| Live mode | `livemode` is part of the uniqueness key, so a test-mode processing failure never merges with a live one |

Only an *actively quarantined* object is skipped, so the recovery path is reachable: the streak resets whenever the object is examined and does not fail, and once quarantined only a founder release returns it to processing.

### Counter semantics

`objects_scanned` and `objects_matched` count **examinations performed by this run**, not distinct objects across runs. Because rule 1 overlaps windows by an hour and rule 3 resumes at page boundaries, the same object is legitimately examined more than once — so a sum of `objects_scanned` across runs is not a count of distinct Stripe objects, and must not be read as one. `exceptions_created` counts inserts; `exceptions_reopened` counts upserts onto an already-open row. Uniqueness lives in the write path (L8/L8b, `dedup_key`), not in the counters.

### `implementation_version` provenance (B-61)

The version check is only as trustworthy as the value. A string the caller passes in can be set to whatever unlocks an existing approval, which would make the entire authorization model decorative — the one field distinguishing "the build we rehearsed" from "some other build" would be attacker- or accident-controlled.

**The value is an immutable deployed-build identifier, read server-side.**

- **Source:** a CI-injected build identifier — the deployment's **git commit SHA** or container **image digest** — exposed to the running process as an environment variable at build time (for example `VERCEL_GIT_COMMIT_SHA`, or the image digest for a container deployment).
- **Read server-side, at run creation, from process configuration.** Never from a request body, query parameter, header, cookie, or any client-influenced input. There is no code path in which a browser can determine this value.
- **Never defaulted.** If the identifier is absent from the environment, run creation **fails**. A placeholder such as `'dev'` or `'unknown'` would collapse every environment into one authorization scope, which is worse than refusing to start.
- **Recorded on every run**, dry and writing alike, so an authorization always names the build that produced it.

**What requires a new identifier.** Any redeploy produces a new commit SHA or digest, so in practice *every* change to the reconciliation build invalidates prior authorizations — including dependency and configuration changes that alter behaviour without touching reconciliation source. This is deliberately over-inclusive: the cost of an unnecessary re-approval is one dry run, while the cost of a missed one is a changed job running under a rehearsal it never performed.

**How PR 3 proves it.** The authorization trigger compares the writing run's `implementation_version` to its authorizing run's and rejects any mismatch, so a changed build cannot reuse an old authorization even by accident. PR 3's tests deploy a second build identifier and assert that a writing run citing the earlier authorization is refused, and that supplying the version through any request-shaped input is impossible because the code reads only process configuration.

### Matching

"Reconciliation matching" was previously named as PR 3's sole basis for writing ledger entries without being defined — a ledger write path specified by a phrase. It is:

1. **By provider object identity.** A Stripe Charge or Refund id matching `ledger_entries.provider_object_id` (same `livemode`) is matched. This is exact and is the only automatic match for an *existing* entry.
2. **By PaymentIntent.** For a payment with no charge-object match, `provider_payment_intent_id` (same `livemode`) is matched under L8b.
3. **By V2 metadata**, for provider objects with no ledger entry: `agreement_id` from Session or PaymentIntent metadata (§10) attributes the object, and a verified `succeeded` PaymentIntent is ingested as a `stripe_payment`.
4. **No heuristic matching.** Amount, timestamp and email proximity are **never** used to match. A provider object that cannot be matched by identity or attributed by metadata raises `unattributable_payment` or `provider_without_ledger`. Guessing which member a payment belongs to is exactly the class of error this system exists to eliminate, and a near-match is not evidence.

There is therefore no confidence score and no tie-break, because every rule is exact.

### What reconciliation may and may not write

The previous text said reconciliation "raises exceptions and never silently self-corrects" while also having it issue reversals for `refund_status_regression`. Both cannot be true. The boundary:

| Reconciliation **may** | Reconciliation **may not** |
|---|---|
| Insert `stripe_payment` and `refund` entries for provider objects it has **verified** and **attributed** — this is ingestion, the same rule as the webhook path (§10), simply reached by polling instead of push | Insert any `reversal` |
| Create and reopen exceptions | Resolve an exception |
| Update its own run row | Amend a Contribution, or alter any existing entry in any way |

**The asymmetry is the point.** Recording a payment Stripe confirms is not a judgement — the money moved, and whether we heard about it by webhook or by polling is an implementation detail. Reversing an entry *is* a judgement: it asserts a previously recorded fact was wrong. A job that can decide that unattended can silently unwind real money.

So `refund_status_regression` raises an exception; a **founder** approves the reversal, which carries their `recorded_by`. The `reconciliation` system actor exists for entries the job legitimately creates by ingestion, never for corrections.

This is the answer to point 20, and it is enforceable rather than aspirational: `service_role` has no `UPDATE` on the fact tables, and the append-only triggers hold regardless of role.

---

## 11. Checkout sessions

```
finance.checkout_sessions
  id                 uuid PK default gen_random_uuid()
  agreement_id       uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  stripe_session_id  text NULL UNIQUE     -- NULL while status = 'creating'
  idempotency_key    text NOT NULL UNIQUE -- deterministic; sent to Stripe
  payment_link_id    uuid NULL -> finance.payment_links(id) (RESTRICT)
  amount_cents       bigint NOT NULL CHECK (amount_cents > 0)
  currency           text NOT NULL default 'usd' CHECK (currency = 'usd')
  livemode           boolean NOT NULL
  status             finance.checkout_status NOT NULL default 'creating'
  expires_at         timestamptz NOT NULL
  created_at         timestamptz NOT NULL default now()
  completed_at       timestamptz NULL

  CHECK (status = 'creating' OR stripe_session_id IS NOT NULL)

```

```sql
-- at most one live Checkout Session per agreement per mode
CREATE UNIQUE INDEX ON finance.checkout_sessions (agreement_id, livemode)
  WHERE status IN ('creating','open');
```

The index is keyed on **`(agreement_id, livemode)`**, not `agreement_id` alone. A test-mode Session would otherwise occupy the only slot and block live checkout for that member — a test artefact preventing a real payment. Test and live activity are independent by design; nothing about one should gate the other.

`stripe_session_id` is nullable **only** in `creating`, because the intent row is committed before Stripe is called (§12). The `CHECK` makes any other status without a session id impossible.

### At most one payable Session per agreement

Without the partial unique index, two payment links — or a link and the portal — could each open a Session for the same Remaining amount, and **both would be payable**. The member pays twice, the ledger records two legitimate provider payments, and the agreement lands `overpaid` with no defect anywhere to point at.

The index makes a second live Session impossible at the database level, before Stripe is contacted.

### Reuse requires the Session to still be correct

**An existing `open` Session is never returned unconditionally.** Its amount was computed when it was created; a founder amending the Contribution, or any payment landing in between, changes Remaining and leaves that Session quoting an obsolete figure. Returning it would charge the member the wrong amount — with a valid Stripe Session and a correct-looking ledger entry to show for it.

A Session may be reused **only when every one of these still holds**:

| Must match | Against |
|---|---|
| `agreement_id` | the requesting agreement |
| `amount_cents` | the agreement's **current** `payable_remaining_cents` |
| `currency` | the agreement's currency |
| `livemode` | the requesting context |
| `status` | `open`, and not past `expires_at` |

Where any check fails, the Session is **not** silently dropped — it is a live payable object at Stripe and must be retired there first:

1. Expire it through the Stripe API.
2. **Confirm the expiration** in Stripe's response.
3. Only then mark the local row `expired`, freeing the slot, and create a new Session at the current amount.

**If expiration cannot be confirmed, checkout is blocked** and a `stale_session_expiry_failed` exception is raised. The obsolete Session remains payable at Stripe until it is retired, so creating a replacement while it is still live would produce exactly the two-payable-Sessions state D-029 exists to prevent. Blocking is the safe outcome; guessing is not.

Other consequences:

- **Stale sessions free the slot.** A sweeper expires Sessions past `expires_at`, and marks Sessions Stripe reports as expired or cancelled accordingly.
- **A `creating` row holds the slot** until recovery resolves it (§12) — an attempt whose Stripe state is unknown must block new attempts.
- The slot is released on completion, so an agreement paid in instalments can open a new Session for the new Remaining.

- **A checkout attempt is not a payment.** No ledger entry exists until Stripe confirms, eliminating the legacy orphan-pending-row problem.
- **The idempotency key is sent to Stripe** on `checkout.sessions.create`, not merely recorded locally.
- **The amount is recalculated server-side** from `payable_remaining_cents` immediately before creation. No client amount is trusted.
- **Zero-amount guard.** When `payable_remaining_cents` is `0` or `NULL` (a paid, overpaid, or `not_applicable` agreement), session creation is **refused before any insert**, with a defined message — nothing is owed. The `CHECK (amount_cents > 0)` is the backstop, not the guard. Because nothing is created, no payment link is consumed (§12).
- Session metadata carries `financial_version = 'v2'`, `agreement_id` and `attempt_id` — written to **both** `metadata` and `payment_intent_data.metadata`, because Session metadata does not propagate to the PaymentIntent (§10).

---

## 12. Payment links

```
finance.payment_links
  id                     uuid PK default gen_random_uuid()
  agreement_id           uuid NOT NULL -> finance.agreements(id) (RESTRICT)
  token_hash             text NOT NULL UNIQUE
  status                 finance.link_status NOT NULL default 'active'
  expires_at             timestamptz NOT NULL
  claimed_at             timestamptz NULL
  consumed_at            timestamptz NULL
  consumed_by_session_id uuid NULL -> finance.checkout_sessions(id) (RESTRICT)
  revoked_at             timestamptz NULL
  revoked_by             uuid NULL -> auth.users(id) (RESTRICT)
  attempt_count          integer NOT NULL default 0 CHECK (attempt_count >= 0)
  created_at             timestamptz NOT NULL default now()
  created_by             uuid NOT NULL -> auth.users(id) (RESTRICT)

  CHECK (status <> 'creating' OR claimed_at IS NOT NULL)
  CHECK (status <> 'consumed' OR (consumed_at IS NOT NULL AND consumed_by_session_id IS NOT NULL))
  CHECK (status <> 'revoked'  OR (revoked_at  IS NOT NULL AND revoked_by IS NOT NULL))
```

`finance.link_status` enum: `active`, `creating`, `consumed`, `revoked`.

Only the **hash** is stored; the raw token exists solely in the emailed URL.

### A database transaction cannot span Stripe

The earlier design said session creation and link consumption "occur in one transaction, and if Stripe fails the transaction rolls back." **That is not implementable.** Postgres and Stripe are separate systems with no shared transaction. Holding a Postgres transaction open across a network call to Stripe still leaves the fatal window: if the process dies after Stripe creates the session but before the commit, Stripe has a live payable session and the database has no record of it — the exact orphan the design exists to prevent, inverted.

The link is therefore consumed through a **persisted three-phase attempt**, where every phase boundary is a committed database state.

| Phase | Action | Committed before the next phase |
|---|---|---|
| **1. Claim** | `UPDATE finance.payment_links SET status='creating', claimed_at=now(), attempt_count=attempt_count+1 WHERE id=$1 AND status='active' AND expires_at > now() RETURNING id` | Yes — this is the concurrency guard |
| **2. Record intent** | Insert `finance.checkout_sessions` with `status='creating'`, the agreement, the server-computed amount, and a deterministic `idempotency_key` | Yes — the intent survives a crash |
| **3. Create and finalise** | Call Stripe **passing that idempotency key**; on success update the session to `open` with its `stripe_session_id`, and the link to `consumed` | — |

Zero rows from phase 1 means another request won; that request creates nothing. Concurrency is resolved before Stripe is ever contacted.

**The idempotency key is deterministic** — derived from `(payment_link_id, attempt_count)` — and is [sent to Stripe on the create call](https://docs.stripe.com/api/idempotent_requests). A retry of the same attempt therefore returns the *same* session rather than creating a second one. Recording a key locally without transmitting it prevents nothing.

### Recovery — and the limit of idempotency keys

A crash between phases 2 and 3 leaves a `creating` link and a `creating` session, with **Stripe's state unknown**.

Two properties of Stripe idempotency constrain what recovery may do:

1. **There is no retrieve-by-idempotency-key operation.** A key deduplicates a *repeated request*; it cannot be used to ask "did this ever succeed?"
2. **Keys are not retained indefinitely** — [results may be pruned after roughly 24 hours](https://docs.stripe.com/api/idempotent_requests).

Replaying the same key **after that window has passed therefore creates a second payable Session**, which is precisely the failure the design exists to prevent.

#### Two distinct stranded states

A crash can land in either of two places, and they are not equally dangerous.

**(a) Link claimed, no attempt recorded** — the crash occurred between phase 1 and phase 2. **No Stripe call was ever made**, because the create call happens only in phase 3, after the session row is committed. There is therefore no possibility of a live Session, and the link is safe to restore.

> Recovery: where a link is `creating`, has **no** `finance.checkout_sessions` row referencing it, and `claimed_at` is older than the orphaned-claim TTL (**15 minutes**), a sweeper atomically restores it to `active` —
> `UPDATE finance.payment_links SET status='active', claimed_at=NULL WHERE id=$1 AND status='creating' AND claimed_at < now() - interval '15 minutes' AND NOT EXISTS (SELECT 1 FROM finance.checkout_sessions WHERE payment_link_id = $1)`.
> `attempt_count` is left incremented so the next attempt derives a fresh key. Without this, any crash in that window strands a link permanently.

**(b) Attempt recorded, outcome unknown** — the crash occurred during or after phase 3. Stripe may or may not hold a Session.

#### The replay cutoff is a fixed interval, not a guess

"Inside Stripe's idempotency window" is not something code can test — Stripe exposes no key-expiry lookup. The rule is therefore a **fixed safe cutoff of 23 hours**, measured from the attempt's persisted `checkout_sessions.created_at`, deliberately short of Stripe's ~24-hour pruning so that clock skew and job latency cannot push a replay past it.

| Condition | Action |
|---|---|
| Attempt age **< 23 hours** | Replay the create call with the same key. Stripe returns the original Session if one exists, otherwise creates it. Finalise and consume the link. |
| Attempt age **≥ 23 hours** | **Never replay automatically.** Determine ground truth by enumerating Stripe Checkout Sessions over a bounded creation interval and matching the `attempt_id` in metadata. |
| Ground truth: a Session exists | Finalise it; the link becomes `consumed`. |
| Exhaustive search finds no Session | Raise `stranded_checkout_attempt`. A founder releases the link explicitly. |
| Search inconclusive, or link past `expires_at` | Raise `stranded_checkout_attempt`, leave the link `creating`. Closed out, not released. |

**The search must be exhaustive.** Stripe offers no server-side metadata filter on Checkout Sessions, so the specification requires [listing Sessions](https://docs.stripe.com/api/checkout/sessions/list) across the bounded creation interval **with full pagination to exhaustion**, inspecting `attempt_id` locally. A single unpaginated page is not a search, and treating one as conclusive would produce exactly the false "no Session exists" that leads to a double charge.

**An attempt with ambiguous Stripe state is never automatically released or replayed.** An automatic release that guesses wrong bills a member twice; a stranded link costs a founder one click to reissue.

### Retry behaviour

Consumption is permanent once phase 3 succeeds. The member's retry path is the Stripe Checkout Session URL, resumable until `expires_at`. Once the session expires unpaid, the founder issues a new link. A token that reactivates on abandonment cannot be reasoned about concurrently, and reissue is cheap.

The **zero-amount guard** (§11) runs before phase 1, so an agreement owing nothing never claims a link at all.

---

## 13. Cutover — version-tagged, no dual-write

The same payment is never written into both systems. One payment has exactly one authoritative write path.

| Phase | Behaviour |
|---|---|
| Drain | Sessions created before cutover remain handled by the **legacy** webhook for a defined period. |
| Tagging | Every V2 Checkout Session carries `financial_version = 'v2'`, `agreement_id` and `attempt_id`, written to both Session metadata and `payment_intent_data.metadata` (from PR 6). |
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

## 15. PR 1 implementation specification

Everything below exists because a readiness review found PR 1 unwritable without it. Principles are not specifications.

### Postgres baseline

**PostgreSQL 15 or later is required** — `NULLS NOT DISTINCT` (§4) and `security_invoker` on views (§9) both need it. The live database is **PostgreSQL 17.6**, confirmed read-only on 2026-07-29, so the baseline is satisfied. PR 1 asserts the version before creating anything, so a future environment cannot silently fall below it.

### Functions

**`finance.current_member_id() → uuid`**
`STABLE`, `SECURITY DEFINER`, `SET search_path = pg_catalog, public, finance`.
Returns `members.id` for the row where `members.profile_id = auth.uid()`; `NULL` when there is no session or no matching member. Never raises. `EXECUTE` granted to `authenticated` and `service_role` only. Single-valued resolution depends on B-1 (uniqueness of `members.profile_id`).

**`public.is_founder() → boolean`**
**Not created by V2 — reused.** See §2.

**`finance.release_quarantine(p_exception_id uuid, p_note text) → void`**
`VOLATILE`, `SECURITY DEFINER`, fixed `search_path`. Raises unless `public.is_founder()`. Locks the row `FOR UPDATE`, then sets `released_at = GREATEST(clock_timestamp(), quarantined_at + interval '1 microsecond')`, `released_by = auth.uid()`, resets `consecutive_failure_runs` to 0, and writes `p_note` to **`release_note`** — in one statement, so no intermediate state violates a `CHECK`. It writes `release_note` rather than `resolution_note` because those are different judgements by different rules: `resolution_note` belongs exclusively to `finance.resolve_exception()`. Raises if the row is not actively quarantined. `EXECUTE` to `authenticated` only.

**`finance.resolve_exception(p_exception_id uuid, p_resolution finance.exception_resolution, p_note text) → void`**
`VOLATILE`, `SECURITY DEFINER`, fixed `search_path`. Raises unless `public.is_founder()`. Locks the row, requires current status `open`, accepts only `resolved` or `dismissed`, requires a non-blank `p_note`, and sets `resolved_by = auth.uid()` and `resolved_at = clock_timestamp()` internally — neither is a parameter. Raises on repeat resolution. Permitted while actively quarantined. `EXECUTE` to `authenticated` only.

**`finance.quarantine_object(p_exception_id uuid) → void`**
`VOLATILE`, `SECURITY DEFINER`, fixed `search_path`. Locks the row, validates all five preconditions of §10, derives `quarantine_reason` from the row's own `detail.error_class`, then sets `quarantined_at = GREATEST(clock_timestamp(), COALESCE(released_at, '-infinity') + interval '1 microsecond')`. Takes **no reason parameter**. `EXECUTE` to `service_role` only — this is the job's transition, not a founder's.

**`finance.approve_dry_run(p_run_id uuid, p_note text) → void`**
`VOLATILE`, `SECURITY DEFINER`, fixed `search_path`. Raises unless `public.is_founder()`. Locks the run, validates every precondition of §10a, then sets `approved_by = auth.uid()` and `approved_at = clock_timestamp()` **internally** — neither is a parameter. Requires a non-blank `p_note`, stored in `approval_note`. Raises if already approved. `EXECUTE` to `authenticated` only.

**`finance.create_agreement(p_member_id uuid, p_journey_id uuid, p_purpose finance.agreement_purpose, p_reason text) → uuid`**
`VOLATILE`, `SECURITY DEFINER`, fixed `search_path`. Raises unless `public.is_founder()`. Raises on blank `p_reason`. In one transaction: inserts the agreement, then its initial lifecycle event with `from_status = NULL`, `to_status = 'draft'`, `actor_id = auth.uid()` and `reason = p_reason`. Returns the new `agreements.id`. On unique violation of `(member_id, journey_id, purpose)` it raises rather than returning the existing row — silently returning would make a caller believe it created something it did not. `EXECUTE` granted to `authenticated` only; the founder check is inside.

### RLS policy matrix

`ENABLE` and `FORCE ROW LEVEL SECURITY` on all nine tables. No policy grants `UPDATE` or `DELETE` on the three fact tables to any role.

| Table | `authenticated` — member | `authenticated` — founder | `service_role` |
|---|---|---|---|
| `agreements` | `SELECT` where `member_id = finance.current_member_id()` | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT` |
| `agreement_amounts` | `SELECT` via parent agreement owned by the member | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT` |
| `agreement_lifecycle_events` | none | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT` |
| `ledger_entries` | `SELECT` via parent agreement owned by the member | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT` |
| `checkout_sessions` | `SELECT` via parent agreement owned by the member | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT`, `UPDATE (status, stripe_session_id, completed_at)` |
| `payment_links` | none — the raw token is the member's only handle; the row is never read by them | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT`, `UPDATE (status, claimed_at, consumed_at, consumed_by_session_id, attempt_count)` |
| `stripe_events` | none | `SELECT` where `public.is_founder()` | `SELECT`, `INSERT`, `UPDATE (processing_status, claimed_at, attempt_count, processed_at, processing_error, payload)` |
| `reconciliation_exceptions` | none | `SELECT` where `public.is_founder()`. **No direct `UPDATE` at all** — resolution goes through `finance.resolve_exception()` and release through `finance.release_quarantine()` | `SELECT`; **column-scoped `INSERT`** (§10, protected lifecycle columns excluded); `UPDATE (last_detected_at, occurrence_count, detail, last_run_id, consecutive_failure_runs)`. **Quarantine goes through `finance.quarantine_object()`** |
| `reconciliation_runs` | none | `SELECT` where `public.is_founder()`. **Approval is not a direct `UPDATE`** — it goes through `finance.approve_dry_run()`, so the actor and timestamp cannot be supplied | `SELECT`; **column-scoped `INSERT`** (§10a, approval and report columns excluded); `UPDATE (status, cursor, window_exhausted, heartbeat_at, finished_at, error, objects_scanned, objects_matched, exceptions_created, exceptions_reopened, api_calls, retries, would_create_count, would_reopen_count, prospective_by_kind, report_samples, report_version, report_completed_at)` — **all blocked once `OLD.approved_at` is set**, by the freeze trigger |

Notes:

- **Members have no `INSERT`, `UPDATE` or `DELETE` policy on any table.** Every member-visible figure is a read.
- **Lifecycle events are founder-only** — operational state is internal, and exposing it invites members to read intent that is not addressed to them.
- **Founders have no direct `INSERT` on the fact tables in PR 1.** Writes arrive through approved functions; the founder amendment and external-payment functions ship in PR 5. PR 1's only approved write function is `create_agreement()`, and acceptance test 12 is scoped to it.
- `service_role` `UPDATE` grants are **column-scoped** to the lists above, not table-wide. An earlier revision granted a column named `counters`, which does not exist — the six counter columns are enumerated individually above.
- **No role holds a direct `UPDATE`** on the approval columns, the four quarantine columns, or the four resolution columns (`resolution_status`, `resolved_at`, `resolved_by`, `resolution_note`). Every transition runs through a function that computes actor and timestamp internally, so attribution cannot be spoofed and ordering cannot be violated.
- **Only a founder may approve** (`finance.approve_dry_run`), **resolve** (`finance.resolve_exception`) or **release** (`finance.release_quarantine`); only `service_role` may **quarantine** (`finance.quarantine_object`). The job cannot authorise itself or clear its own quarantine.
- **Once `approved_at` is set, the reviewed evidence is frozen** by trigger, regardless of role.
- **`INSERT` is a protected transition too.** Revoking `UPDATE` on a column protects nothing if a row can be *created* already in the destination state. `reconciliation_exceptions` and `reconciliation_runs` therefore carry column-scoped `INSERT` grants **and** `BEFORE INSERT` triggers; `agreements` carries a deferred constraint trigger requiring its initial lifecycle event.

### `INSERT`-bypass audit — all nine tables

Prompted by B-69 and B-70, every table was checked for the same class: a transition guarded by a function or an `UPDATE` restriction, reachable instead by inserting a row already in the destination state.

| # | Table | Function-protected transition? | Bypassable at `INSERT`? | Protection |
|---|---|---|---|---|
| 1 | `agreements` | Creation must produce an initial lifecycle event | **Yes — B-71.** A direct `INSERT` left an agreement with no lifecycle, contradicting §6 | Deferred constraint trigger checked at commit |
| 2 | `agreement_amounts` | None. Append-only fact; `actor_id` is supplied by whichever authorized path writes it, including the import | No | `NOT NULL` and non-blank `CHECK`s fire on `INSERT` |
| 3 | `agreement_lifecycle_events` | Transition validity | No — the validating trigger already fires **on `INSERT`**, which is the only way rows arrive | Existing transition trigger; one-initial-event index |
| 4 | `ledger_entries` | None. Append-only fact | No — L1–L13 are `CHECK`s and constraint triggers, all evaluated at `INSERT` | Existing invariants |
| 5 | `stripe_events` | None. `service_role` is the sole producer *and* processor | No — inserting a row already `processed` grants that role nothing it does not already hold | — |
| 6 | `checkout_sessions` | None founder-gated. Status transitions belong to `service_role` | No — and a fabricated `completed` session creates no ledger entry, since only a verified PaymentIntent does (D-030) | Status/`stripe_session_id` `CHECK`; one-live-session index |
| 7 | `payment_links` | None founder-gated. Claim and consumption belong to `service_role` | No — same reasoning as 6 | Status `CHECK`s |
| 8 | `reconciliation_exceptions` | Resolution, quarantine, release — all founder- or function-gated | **Yes — B-69** | Column-scoped `INSERT` + `BEFORE INSERT` trigger |
| 9 | `reconciliation_runs` | Approval | **Yes — B-70** | Column-scoped `INSERT` + `BEFORE INSERT` trigger |

Three real bypasses, three fixed. The pattern separating them: a transition is bypassable at `INSERT` exactly when it is gated **for** a role that also holds `INSERT` — so tables 5–7, where `service_role` is the legitimate owner of every transition, are not vulnerable, while 1, 8 and 9, which gate transitions *against* `service_role` or reserve them for a founder, are.
- `service_role` writes the dry-run report columns (it produces the report) but **cannot** write `approved_by`/`approved_at`, so producing a report never approves it.
- The column-scoped grant test asserts **both directions**: every update the job legitimately performs succeeds, and every column outside its list is rejected. A grant that is merely restrictive is not proven correct.

### View columns

**`finance.v_agreement_lifecycle`** — `agreement_id`, `current_status`, `since` (`occurred_at` of the winning event), `actor_id`, `reason`.

**`finance.v_agreement_balances`** — `agreement_id`, `member_id`, `journey_id`, `purpose`, `currency`, `contribution_applies`, plus the eight computed columns of §8.

**`finance.v_member_financials`** — `member_id`, `agreement_count`, `contribution_cents`, `gross_received_cents`, `refunded_cents`, `net_received_cents`, `remaining_cents`, `payable_remaining_cents`. Received sums across **all** agreements; Remaining sums across `contribution_applies` agreements only.

**`finance.v_journey_financials`** — `journey_id` plus the same aggregate columns, restricted to agreements with a non-null `journey_id`.

**`finance.v_agreement_balances_test`** — identical column list to `v_agreement_balances`, filtered to `livemode = false`. Founder-only.

### Implementation notes

- **`is_reversed` cannot sit inside a `FILTER` clause** as written in §8 — a correlated subquery is not permitted there. Compute it in a `LATERAL` join or a pre-aggregated CTE over `ledger_entries` keyed by `parent_entry_id`, then filter on the resulting boolean. The semantics are as stated; only the shape differs.
- **`payment_state` must be cast** — the `CASE` in §8 yields `text`; cast explicitly to `finance.payment_state`.
- **Partial uniqueness is an index, not a table constraint.** Postgres has no `UNIQUE … WHERE` table constraint, so every partial rule is created as `CREATE UNIQUE INDEX … WHERE …`. The complete inventory PR 1 must create:

  | # | Index | Table | Predicate |
  |---|---|---|---|
  | 1 | `(provider_object_id, livemode)` — L8 | `ledger_entries` | `provider_object_id IS NOT NULL` |
  | 2 | `(provider_payment_intent_id, livemode)` — L8b | `ledger_entries` | `entry_type = 'stripe_payment'` |
  | 3 | `(legacy_donation_id, entry_type)` — L9 | `ledger_entries` | `legacy_donation_id IS NOT NULL` |
  | 4 | `(agreement_id)` | `agreement_lifecycle_events` | `from_status IS NULL` |
  | 5 | `(agreement_id, livemode)` | `checkout_sessions` | `status IN ('creating','open')` |
  | 6 | `(dedup_key, livemode)` | `reconciliation_exceptions` | `resolution_status = 'open'` |
  | 7 | `(livemode)` | `reconciliation_runs` | `status = 'running'` |
  | 8 | `(resumed_from_run_id)` | `reconciliation_runs` | `resumed_from_run_id IS NOT NULL` |

  Non-partial uniqueness — `agreements (member_id, journey_id, purpose) NULLS NOT DISTINCT`, `payment_links.token_hash`, `checkout_sessions.stripe_session_id`, `checkout_sessions.idempotency_key` — is expressed as an ordinary table constraint.
- **Append-only enforcement is a trigger, not only a policy** — `BEFORE UPDATE OR DELETE … FOR EACH ROW EXECUTE` raising unconditionally, so it holds for `service_role` and any future role.

### Test framework

Acceptance tests run under **pgTAP**, executed by `supabase test db` against a fresh database. PR 1 adds the `pgtap` extension and a `supabase/tests/` directory. Three items in the acceptance list are **review checks rather than pgTAP assertions** and are verified by the reviewer against the diff: "every object created from tracked migrations", "aggregate views contain no independent financial formula", and "`v_agreement_lifecycle` is the only expression of current lifecycle". They are labelled as such in `PR_PLAN.md`. Concurrency tests use two sessions via `dblink` or paired connections; if the harness cannot express true concurrency, the test is reported as **not run** rather than quietly passing.

---

## 16. Traceability to audit findings

| Audit finding | V2 resolution |
|---|---|
| Core ledger schema un-versioned | All objects from tracked migrations; fresh-reset test in PR 1 |
| No Stripe `event.id` idempotency | `stripe_events.event_id` PK + ledger L8/L8b |
| Webhook sole writer of terminal state | Reconciliation job + exceptions queue (PR 3) |
| Orphan pending donation rows | `checkout_sessions` separate from ledger (§11) |
| Multi-use payment tokens | Atomic claim before Stripe is contacted, consumption on session creation (§12) |
| Allocation race / over-allocation | L6/L7 with row locking (§7) |
| Three routes rewrite `expected_amount_cents` | Append-only `agreement_amounts` (§5) |
| "Collected" defined two ways | Single `net_received_cents` definition (§8) |
| "Remaining" computed four ways | Single `v_agreement_balances`; aggregates reference it (§8) |
| Two disjoint payment-status vocabularies | One computed `payment_state`; lifecycle separate (§6, §8) |
| Provenance in `metadata` only | First-class `entry_type`, `source`, `external_method` (§7) |
| No RLS in repo for money tables | Full RLS, privileges and tests in PR 1 (§9) |
| Hardcoded founder UUIDs | Reuses the existing `public.is_founder()` predicate; V2 never inlines UUIDs (§2, §9) |
| Fragile email-based member join | `finance.current_member_id()`; email join forbidden (§2) |
| `program_price` dollars vs cents drift | Integer cents everywhere; no float (§3) |
