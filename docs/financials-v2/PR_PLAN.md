# Financials V2 — PR Plan

**Status:** Approved with revisions (2026-07-29).
**Companion documents:** [PRODUCT_SPEC.md](PRODUCT_SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [HANDOFF.md](HANDOFF.md)

---

## Rules

1. **One PR accomplishes one defined outcome.** Scope expansion requires a `DECISIONS.md` entry and approval before work begins.
2. **Database foundation precedes interface.**
3. **Every PR ends with an updated `HANDOFF.md`.**
4. **Every PR carries its own proof** — tests, evidence, migration output, rollout and rollback plans. See the pull request template.
5. **Legacy code and routes remain until the new path is proven.**

**Founder visibility.** PR 4 is founder-visible by design — it is the shadow/diff page. PRs 1, 2 and 3 change nothing any user can see. The first *participant-facing* change is PR 8.

---

## Sequence

### PR 0 — Architecture and project-control documents
**Outcome:** The approved specification, architecture, audit record, decision log, PR plan and handoff protocol exist in the repository, together with the project team definitions, a `CLAUDE.md` financial-work section, and a pull request template.
**Contains:** documentation and agent/skill definitions only. **No schema, no application code, no migration, no data.**
**Done when:** the independent reviewer confirms the documents contain no unresolved contradiction in the financial model.

### PR 1 — `finance` schema foundation
**Outcome:** The complete V2 schema exists, is fully constrained, is protected by RLS, exposes the canonical views, and is proven by automated database tests.
**Contains:** `CREATE SCHEMA finance`; the **thirteen** enum types; the **nine** tables; all `CHECK` constraints and constraint triggers; append-only enforcement triggers; RLS policies, grants and default privileges **including `service_role`**; `finance.current_member_id()` and `finance.create_agreement()` (founder authority reuses the existing `public.is_founder()`); the **five** views — `v_agreement_lifecycle`, `v_agreement_balances`, `v_agreement_balances_test`, `v_member_financials`, `v_journey_financials`; the full acceptance test suite.
**Excludes:** application code, data import, any UI.
**Not blocked.** Live verification is complete (D-038): `uq_members_profile_id` already exists, there are no duplicates and no NULL `profile_id`, and PostgreSQL is 17.6. **PR 1 adds no index for this.**
**Done when:** every test in "PR 1 acceptance tests" below passes on a fresh database.

### PR 2 — Legacy fact import and variance report
**Outcome:** Verified historic money exists in the V2 ledger, unattributable money sits in the exceptions queue, and every per-member difference from legacy figures is itemised for adjudication.
**Contains:**
- **Agreement creation.** The import creates one agreement per `(member_id, journey_id, purpose)` — the uniqueness rule in ARCHITECTURE §4 — plus its initial lifecycle event. Every legacy donation is assigned to an agreement by this grouping. Ledger entries require `agreement_id`, so this precedes any ledger write.
- **Two-pass import.** Pass 1 imports payments; pass 2 imports historic refunds, which require their parent to exist (L3). A refund whose parent is not importable raises an `orphan_refund` exception rather than being dropped.
- Idempotency via the `(legacy_donation_id, entry_type)` unique index; dry-run mode first; re-runnable without duplication.
- Population of `finance.reconciliation_exceptions`, including `missing_provider_object` for Stripe payments imported without a charge-object id.
- A per-member variance report against legacy figures.

**Legacy access:** read-only, under the ARCHITECTURE §0a comparison carve-out.
**Excludes:** synthetic `adjust-collected` rows. Any write to a legacy table.
**Done when:** the import is proven idempotent across repeated runs, refunds are correctly parented, and the variance report is delivered for review.

### PR 3 — V2 Stripe event shadow ingestion and reconciliation job
**Outcome:** V2 independently observes Stripe and reconciles against its own ledger, with no change to the live payment flow.
**Contains:** V2 webhook ingestion of **all** Stripe events into `finance.stripe_events`; **PaymentIntent status verification before any `stripe_payment` is written (D-030)**; the processing-status claim/re-claim branch and the stale-claim sweeper; the scheduled reconciliation job enumerating PaymentIntent, Charge and Refund objects; exception raising; the 24-month payload retention job.
**Attribution during this window:** session tagging does not exist until PR 6, so PR 3 writes ledger entries only for events it can attribute to a V2 agreement by **reconciliation matching**. Tag-based routing becomes primary from PR 6.
**Expected signal:** `provider_without_ledger` exceptions for legacy-tagged charges are the intended shadow output during this phase, not errors.
**Excludes:** any change to which webhook handles live sessions. No payment-flow cutover.
**Operational requirements:** the reconciliation job implements ARCHITECTURE §10a in full — window and overlap, initial lookback, durable cursor, page and batch sizes, resume via heartbeat, single-flight lock, exhaustive pagination for all four object types, 429/`Retry-After`/backoff, error classification, retry budget and quarantine, exception dedup, mode isolation, run counters, alert thresholds, dry-run first, maximum-work limits, and the may/may-not write boundary.

**Done when:** duplicate, out-of-order, concurrent and replayed events are proven safe; a crash mid-processing is proven recoverable rather than stranded; and every PR 3 acceptance test below passes.

#### PR 3 acceptance tests

Integration tests against the Stripe test-mode API and a seeded database. Each is blocking.

1. A run covers `[window_start, window_end)` with the stated settlement lag and 60-minute overlap; the window is recorded on the run row.
2. Run #1 with an empty ledger uses the 90-day lookback; with a populated ledger it uses the earliest `occurred_at`.
3. The cursor advances only at page boundaries; a run killed mid-page resumes from the last committed boundary and processes no object twice.
4. A second concurrent run for the same `livemode` is refused; a test-mode and a live-mode run proceed together.
5. A `running` run with a stale heartbeat is marked `abandoned` and its cursor is resumed under a new run id.
6. Every object type paginates to exhaustion — a charge with more refunds than one page yields every refund.
7. A 429 with `Retry-After` honours it; without it, backoff doubles with jitter and caps; the call succeeds within 8 attempts.
8. A timeout and a connection reset are both retried as transient.
9. A terminal 4xx on one object raises an exception and the run continues.
10. An ambiguous provider response raises an exception and writes **nothing** to the ledger.
11. Exceeding the per-run retry budget ends the run `failed` with the cursor intact, and the next run resumes.
12. An object failing terminally in three consecutive runs is quarantined and flagged for manual review.
13. Running twice over the same window creates no second exception and no second ledger entry.
14. A live-mode run creates no test-mode row, and the reverse.
15. Every counter on the run row matches the observed work.
16. A shadow-phase `provider_without_ledger` volume does not alert; a 3× median spike, a `failed` run, a live `unattributable_payment`, and a 14-day-old open exception each do.
17. `dry_run = true` writes no ledger entry and no exception, and still reports accurate counters.
18. A run hitting the object, API-call or time ceiling ends `completed` with the cursor preserved.
19. **Reconciliation never writes a `reversal`** — attempting one is rejected, and a `refund_status_regression` produces an exception only.
20. A verified `succeeded` PaymentIntent with valid metadata is ingested; one without resolvable attribution raises `unattributable_payment` and is not ingested.
21. No heuristic match occurs — an amount-and-timestamp coincidence with no identity or metadata match raises an exception rather than matching.

### PR 4 — Founder-only shadow/diff page
**Outcome:** The founder can compare V2 figures against legacy figures side by side, and can see and resolve reconciliation exceptions. **This PR is founder-visible.**
**Contains:** a founder-gated page showing per-member and per-journey V2 vs legacy figures with deltas; the exceptions queue UI.
**Excludes:** any member-facing surface. Any change to legacy displayed numbers.

### PR 5 — Founder amendment and external-payment controls
**Outcome:** The founder can set and amend Contributions and record external payments in V2, through approved functions with full attribution.
**Contains:** amendment UI writing `finance.agreement_amounts`; record-external-payment UI writing `finance.ledger_entries`; reversal flow; lifecycle transition controls.
**Excludes:** removal of the legacy `adjust-*` routes — they remain until V2 reads are live.

### PR 6 — V2 Checkout Sessions, Stripe idempotency and single-use links
**Outcome:** V2 can create Checkout Sessions correctly, with the idempotency key transmitted to Stripe, amounts derived server-side, and payment links consumed atomically.
**Contains:**
- The three-phase `finance.checkout_sessions` write path (claim → record intent → create), with the deterministic idempotency key transmitted to Stripe.
- **Metadata written to both `metadata` and `payment_intent_data.metadata`** — `financial_version`, `agreement_id`, `attempt_id` — since Session metadata does not propagate to the PaymentIntent (D-033).
- **One-live-Session enforcement per `(agreement_id, livemode)`**, with **validated reuse**: an existing Session is returned only when agreement, amount, currency, livemode and current `payable_remaining_cents` all still match; otherwise it is expired through Stripe, the expiration confirmed, and only then is the slot freed (D-034).
- Hashed single-use link issue, atomic claim, consumption and revocation.
- **The orphaned-claim sweeper** — restores a link claimed with no attempt row after a 15-minute TTL, safe because no Stripe call was made (D-035).
- **The stranded-attempt sweeper** — replays only within a fixed 23-hour cutoff from the persisted attempt timestamp; beyond it, resolves by exhaustively paginated Session enumeration matched on `attempt_id`, and **never auto-replays or auto-releases an ambiguous attempt** (D-035).
- The stale-session expiry job that frees the live-Session slot.

**Required tests:** a PaymentIntent webhook processes correctly **without the Session webhook ever arriving**; a founder amendment between Session creation and reuse causes expiry-and-recreate rather than an obsolete charge; unconfirmed expiry blocks checkout and raises `stale_session_expiry_failed`.
**Excludes:** routing members to the V2 flow. Sessions are exercised in a controlled test path only.

### PR 7 — Founder Financials reads V2 behind a feature flag
**Outcome:** Founder financial surfaces read `finance.v_agreement_balances` when the flag is on, legacy when off.
**Contains:** feature-flagged read path for founder dashboards.
**Excludes:** member-facing surfaces.

### PR 8 — Member Contribution reads and pays through V2 behind a feature flag
**Outcome:** Members see V2 figures and pay through V2 Checkout Sessions when the flag is on. **First participant-facing change.**
**Contains:** feature-flagged member portal and pay-page read and write paths.
**Precondition:** shadow verification reviewed and accepted; all variances explained or resolved.

### PR 9 — Cutover, legacy drain, retirement and final QA
**Outcome:** All new sessions and payment writes go to V2 only; legacy financial tables are frozen reference data; legacy financial display is retired.
**Contains:** flag removal; legacy webhook drain completion; legacy financial display retirement; final QA evidence.
**Retains:** legacy tables as frozen, readable, never-written reference data.

---

## PR 1 acceptance tests

All of the following must pass through automated database tests before PR 1 opens. Each is a blocking requirement. Every test maps to an invariant in `ARCHITECTURE.md`; the list grew from 29 to **87** across eight review passes, which added coverage for zero-row aggregates, live mode, the parent matrix, lifecycle initialisation, concurrency, invariants L1–L3, L3b and L11–L13, `service_role` privileges, the persisted checkout attempt, one-live-session enforcement per mode, validated session reuse, PaymentIntent metadata propagation, provenance mutual exclusion, system attribution, reversed-refund accounting, reconciliation run state, and exception dedup identity. **PR 3 carries its own 21 acceptance tests**, listed with that PR.

### Schema and reproducibility
1. Migrations apply cleanly to a fresh database.
2. *(reviewer check, not pgTAP)* Every `finance` object is created entirely from tracked migrations — nothing pre-existing is assumed.
3. A complete Supabase reset succeeds end to end.
4. All thirteen enum types exist with exactly the values listed in ARCHITECTURE §1, all nine tables exist, and all five views exist.

### Append-only enforcement
5. Ledger entries cannot be updated through normal roles.
6. Ledger entries cannot be deleted through normal roles.
7. Agreement amounts cannot be updated or deleted.
8. Agreement lifecycle events cannot be updated or deleted.
9. Append-only holds even for a role that bypasses RLS — the trigger raises, not merely the policy.

### Access control
10. Member A cannot read Member B's agreements, amounts, lifecycle events, ledger entries, or balance rows.
11. A member cannot insert any financial fact.
12. Authorized founder actions succeed through the approved functions.
13. Views respect RLS — querying a view returns no row a direct table query would deny.
14. `anon` and `PUBLIC` have no access to any `finance` object.
15. `finance.current_member_id()` resolves through `members.profile_id`, and returns no row for a member whose `profile_id` is NULL.
16. `SECURITY DEFINER` functions have a fixed `search_path`, and `EXECUTE` is not granted to `PUBLIC`.

### Agreements and lifecycle
17. `(member_id, journey_id, purpose)` is unique, and `NULLS NOT DISTINCT` prevents duplicate member-level agreements.
18. Creating an agreement creates its initial lifecycle event in the same transaction; current lifecycle is never NULL.
19. Only one initial event (`from_status IS NULL`) can exist per agreement.
20. An invalid lifecycle transition is rejected; terminal states accept no outbound transition.
21. Two concurrent transitions from the same status cannot both commit.
22. Lifecycle state has no effect on any balance column or on `payment_state`.

### Contribution resolution
23. Contribution resolves deterministically under `effective_at DESC, seq DESC`, including ties on `effective_at`.
24. Two amendments inserted in the *same transaction* resolve to the later `seq` — not to a random `uuid`.
25. An agreement with no amendment yields a Contribution of `0`.
26. Future-dated amendments are rejected on insert with no tolerance window, and the view excludes any that reach the table.
27. A blank or whitespace-only `reason` is rejected; a negative `amount_cents` is rejected.

### Ledger invariants L1–L13
28. **L1** — a `stripe_payment` is rejected without `provider_payment_intent_id`, with `source <> 'stripe'`, with a non-positive amount, or with a parent.
29. **L2** — an `external_payment` is rejected without `external_method`, with no attribution, with `source <> 'external'`, with a non-positive amount, or with a parent. It is **accepted with `recorded_by_system` alone**, so a legacy-imported external payment needs no human actor.
30. **L3** — a `refund` is rejected without `parent_entry_id`, with a positive amount, with `source='stripe'` and a NULL `provider_object_id`, or with `source='external'` and no `external_method`.
30b. **L3b** — a `source='stripe'` refund is rejected when its parent is not a `stripe_payment`.
31. **L11** — a ledger entry whose `livemode` disagrees with the `finance.stripe_events` row named by its `origin_stripe_event_id` is rejected. An entry with a NULL `origin_stripe_event_id` is accepted, and external and imported entries are `livemode = true` with a NULL origin.
32. **L12** — an entry with `source = 'external'`, or of `entry_type = 'reversal'`, is rejected with a blank `reason` or with no attribution. It is **satisfied by either** `recorded_by` or `recorded_by_system`, and rejected when **both** are set. A `stripe_payment` is accepted without either, **including when `provider_object_id` is NULL**, so an imported Stripe payment never demands a human actor.
32b. `recorded_by_system` requires no `auth.users` row — a fresh database with zero Auth users can insert a `legacy_import` entry.
32c. **L13** — a `source='stripe'` entry carrying `external_method` is rejected.
32d. **L13** — a `source='external'` entry carrying `provider_object_id` or `provider_payment_intent_id` is rejected.
32e. `legacy_donation_id` is accepted on both Stripe and external entries — L13 does not touch import traceability.

### Protocol tables
33. `checkout_sessions` enforces unique `stripe_session_id`, unique `idempotency_key`, and `amount_cents > 0`.
34. A `checkout_sessions` row in any status other than `creating` is rejected without a `stripe_session_id`.
35. **At most one live Session per agreement per mode** — a second `creating`/`open` row for the same `(agreement_id, livemode)` is rejected, while a test-mode Session and a live-mode Session for the same agreement coexist.
36. Expiring or completing a live Session frees the slot, and a new Session for the same agreement is then accepted.
37. `payment_links` claim is atomic — two concurrent claims of one link yield exactly one winner, and the loser creates nothing.
38. A link claim is rejected when the link is `creating`, `consumed`, `revoked`, or past `expires_at`.
39. `reconciliation_exceptions` rejects a non-`open` row lacking `resolved_at` or `resolved_by`.

### Role privileges
40. `service_role` can `SELECT` and `INSERT` on the tables the webhook and reconciliation jobs require.
41. `service_role` cannot `UPDATE` or `DELETE` a row in any of the three append-only fact tables — the trigger raises despite the elevated role.
42. `anon` and `PUBLIC` have no privilege on any `finance` object, including after `ALTER DEFAULT PRIVILEGES` is applied.

### Ledger correctness
43. A payment increases net Received exactly once.
44. A duplicate provider object cannot double-count — a second entry with the same `(provider_object_id, livemode)` is rejected (L8).
45. A duplicate payment intent on a `stripe_payment` is rejected (L8b).
46. A refund reduces net Received.
47. A partial refund works and leaves the correct balance.
48. Two partial refunds against one charge both succeed and accumulate.
49. A refund exceeding the parent's settled amount is rejected.
50. Cumulative refunds exceeding the parent's settled amount are rejected, including under concurrent insertion.
51. A refund may not target a refund or a reversal.
52. A reversal requires a valid parent and must exactly negate it.
53. A reversal is rejected when the parent has an **unreversed** child — the partial-refund-then-reverse double-subtraction case.
54. **The full unwind executes:** payment, then refund, then reversal-of-refund, then reversal-of-payment succeeds and net Received returns to `0`. A no-children rule would make this impossible.
55. An entry cannot be reversed twice.
56. Reversing a refund restores the **parent payment's** refund headroom under L7.
57. An entry cannot reference itself as parent; parent and child must share an agreement.
58. A ledger entry cannot be inserted without an agreement.
59. `(legacy_donation_id, entry_type)` is unique, so a re-run import cannot duplicate — while still permitting one legacy row to yield both a payment and its refund.

### Calculations
60. An agreement with **no ledger entries** returns `0` for every aggregate and `unpaid` — not `NULL`, and not `partial`. Every aggregate is `COALESCE`d.
61. `remaining_cents` and `payable_remaining_cents` calculate correctly across the full range of states, and both are `NULL` when `contribution_applies` is false.
62. Overpayment produces a negative `remaining_cents` and a zero `payable_remaining_cents`.
63. A refunded-to-zero agreement is distinguishable from one that never received payment — `refunded` versus `unpaid`.
64. A payment recorded in error and then reversed returns `unpaid`, not `refunded`.
65. **A refund that is itself reversed does not count toward `refunded_cents`**, and a fully unwound agreement (payment, refund, reversal-of-refund, reversal-of-payment) returns `unpaid` — not `refunded`.
66. A gift agreement returns `not_applicable` with NULL remaining, and its money still counts toward member and journey Received while contributing nothing to Remaining totals.
67. `payment_state` returns exactly one deterministic value for every row of the reachable-state table in ARCHITECTURE §8.
68. `livemode = false` entries are excluded from canonical balances and appear only in the founder-only test view.
69. *(reviewer check, not pgTAP)* Aggregate views derive from `v_agreement_balances` and contain no independent financial formula.
70. *(reviewer check for the first clause)* `v_agreement_lifecycle` is the only expression of current lifecycle; that lifecycle never affects a balance column **is** asserted in pgTAP.

### Newly specified surfaces
71. `finance.create_agreement()` raises for a non-founder, raises on blank reason, creates the agreement and its initial `draft` lifecycle event in one transaction, and raises rather than returning silently on a duplicate `(member_id, journey_id, purpose)`.
72. Every transition in the ARCHITECTURE §6 graph is accepted and every transition outside it is rejected, including both terminal states.
73. `payment_links` status CHECKs hold — `creating` without `claimed_at`, `consumed` without `consumed_by_session_id`, and `revoked` without `revoked_by` are each rejected.
74. Members have no `SELECT` on `agreement_lifecycle_events`, `payment_links`, `stripe_events` or `reconciliation_exceptions`.
75. `service_role` `UPDATE` is column-scoped — an update to a column outside the granted list is rejected.

### Currency
76. USD constraints hold — a non-USD agreement or ledger entry is rejected.

### Reconciliation state and exception identity
77. `reconciliation_runs` rejects `window_end <= window_start`, and rejects a `running` row carrying `finished_at`.
78. **Single flight** — a second `running` run for the same `livemode` is rejected, while a `running` test-mode run and a `running` live-mode run coexist.
79. **Exception dedup** — inserting the same `(dedup_key, livemode)` while one is `open` conflicts; the upsert raises `occurrence_count`, advances `last_detected_at`, leaves `first_detected_at` unchanged, and creates no second row.
80. A resolved exception does not block a new row for the same `dedup_key`; recurrence inserts a fresh row and the resolved row is preserved.
81. The same `dedup_key` in different `livemode` yields two independent rows.
82. `last_detected_at >= first_detected_at` is enforced.
