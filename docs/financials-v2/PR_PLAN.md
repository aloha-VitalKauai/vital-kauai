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
**Contains:** `ALTER FUNCTION public.is_founder() SET search_path = pg_catalog, public` (D-044, executed before any policy depends on it); `CREATE SCHEMA finance`; the **thirteen** enum types; the **nine** tables; the **eight** partial unique indexes of ARCHITECTURE §15; all `CHECK` constraints and constraint triggers; append-only enforcement triggers; RLS policies, grants and default privileges **including `service_role`**; `finance.current_member_id()`, `finance.create_agreement()`, `finance.approve_dry_run()`, `finance.resolve_exception()`, `finance.release_quarantine()` and `finance.quarantine_object()`; the **freeze trigger** on `reconciliation_runs` (founder authority reuses the existing `public.is_founder()`); the **five** views — `v_agreement_lifecycle`, `v_agreement_balances`, `v_agreement_balances_test`, `v_member_financials`, `v_journey_financials`; the full acceptance test suite.
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
3. **Restart semantics.** A run killed mid-page resumes at the last committed page boundary. Repeated *examination* of an object is permitted and expected; what must not occur is a duplicate **ledger entry** or a duplicate **exception**. Counters follow D-049 — they count examinations by this run, not distinct objects.
4. A second concurrent run for the same `livemode` is refused; a test-mode and a live-mode run proceed together.
5. A `running` run with a stale heartbeat is marked `abandoned` and its cursor is resumed under a new run id.
6. Every object type paginates to exhaustion — a charge with more refunds than one page yields every refund.
7. A 429 with `Retry-After` honours it; without it, backoff doubles with jitter and caps; the call succeeds within 8 attempts.
8. A timeout and a connection reset are both retried as transient.
9. An **object-terminal** 4xx on one object raises a `provider_object_processing_failed` exception and the run continues; a **run-fatal** 401/403 does not (see 18d).
10. An ambiguous provider response raises an exception and writes **nothing** to the ledger.
11. Exceeding the per-run retry budget ends the run `failed` with the cursor intact, and the next run resumes.
12. An object failing terminally in three consecutive runs becomes actively quarantined and is skipped by the next run; a founder release through `finance.release_quarantine()` returns it to processing.
13. Running twice over the same window creates no second exception and no second ledger entry.
14. A live-mode run creates no test-mode row, and the reverse.
15. Every counter on the run row matches the observed work.
16. A shadow-phase `provider_without_ledger` volume does not alert; a 3× median spike, a `failed` run, a live `unattributable_payment`, and a 14-day-old open exception each do.
17. `dry_run = true` writes no ledger entry and no exception; its real write counters stay `0` and its **prospective** report columns carry the findings (see 18i).
18. A run hitting the object, API-call or time ceiling ends **`partial`** with `window_exhausted = false` and the cursor preserved; it does **not** end `completed`.
18b. The successor of a `partial` run inherits the identical `window_start`/`window_end` and cursor, and the watermark does not advance until a run reaches `completed`.
18c. A `partial`, `failed` or `abandoned` run can be resumed and its `resumed_from_run_id` records the lineage; resuming a `running` or `completed` run is rejected, as is self-reference and a second resumer of the same predecessor.
18d. **Run-fatal handling** — a simulated 401, a 403, and an invalid list request each end the run `failed` with the cursor intact and raise exactly one `reconciliation_run_failed`; none is treated as an object-level skip.
18e. **Quarantine** — an object failing terminally in three consecutive runs is quarantined and skipped by the next run; a successful examination before the third resets the streak; only a founder can release, and release restores normal processing.
18f0. **Version provenance** — `implementation_version` is read from process configuration only; no request-shaped input can set it, and run creation fails when the build identifier is absent from the environment rather than substituting a placeholder.
18f1. **A changed build cannot reuse an old authorization** — after deploying a second build identifier, a writing run citing the earlier authorization is refused.
18f. **Approval gate** — a writing run with no `authorized_by_run_id` is rejected; one citing an unapproved, incomplete, errored or unreported dry run is rejected; one citing a different `livemode`, an earlier `window_start`, or a different `implementation_version` is rejected.
18g. **Canary containment** — the first writing run for a `(livemode, implementation_version)` pair must be contained within the approved dry run's window and span at most 24 hours; a later `window_end` is rejected until a canary reaches `completed`.
18h. **Canary failure blocks advancement** — a canary ending `partial` or `failed` does not permit a later run to extend beyond the rehearsed `window_end`.
18i. **Dry-run report** — a dry run creates no exception rows and no ledger entries; `exceptions_created` and `exceptions_reopened` remain `0`; `would_create_count`, `would_reopen_count` and `prospective_by_kind` match the mismatches actually present; samples are capped, deterministic across two identical runs, and contain no cardholder name, address, email or phone.
18j. **Object-terminal failures** raise `provider_object_processing_failed`, not `reconciliation_run_failed`, and increment `consecutive_failure_runs` once per run; a later successful examination finds the open row by `dedup_key` and resets the streak without resolving it.
18k. **Two distinct `payment_intent.payment_failed` events** for the same PaymentIntent and `livemode` are both retained; neither creates a ledger entry.
19. **Reconciliation never writes a `reversal`** — attempting one is rejected, and a `refund_status_regression` produces an exception only.
20. A verified `succeeded` PaymentIntent with valid metadata is ingested; one without resolvable attribution raises `unattributable_payment` and is not ingested.
21. No heuristic match occurs — an amount-and-timestamp coincidence with no identity or metadata match raises an exception rather than matching.

### PR 4 — Founder-only shadow/diff page
**Outcome:** The founder can compare V2 figures against legacy figures side by side, and can see and resolve reconciliation exceptions. **This PR is founder-visible.**
**Contains:** a founder-gated page showing per-member and per-journey V2 vs legacy figures with deltas; the exceptions queue UI. **The queue resolves and releases exclusively through `finance.resolve_exception()` and `finance.release_quarantine()`** — no role holds a direct `UPDATE` on the resolution or quarantine columns, so a UI written against those columns will fail. Actor and timestamp are set inside the functions; the UI supplies only the target status and a non-blank note.
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

All of the following must pass through automated database tests before PR 1 opens. Each is a blocking requirement. Every test maps to an invariant in `ARCHITECTURE.md`; the list grew from 29 to **140** across fifteen review passes, which added coverage for zero-row aggregates, live mode, the parent matrix, lifecycle initialisation, concurrency, invariants L1–L3, L3b and L11–L13, `service_role` privileges, the persisted checkout attempt, one-live-session enforcement per mode, validated session reuse, PaymentIntent metadata propagation, provenance mutual exclusion, system attribution, reversed-refund accounting, reconciliation run state, exception dedup identity, run-state lineage and launch authorization, the derived quarantine model, monotonic quarantine transitions, generated dedup identity, approval attribution and evidence freezing, build-identifier provenance, the dry-run report, object-terminal failure shape, the at-most-once event audit, generated-column platform behaviour and structural non-nullity, quarantine transition preconditions, the approval transition boundary, resolution attribution, `INSERT`-time protection of every function-guarded transition, and satisfiability of every insert predicate. **PR 3 carries its own 33 acceptance tests**, listed with that PR.

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
70. **`v_agreement_lifecycle` is the single consumer projection of current lifecycle** — every application, reporting, view and function read resolves through it. Exactly one internal enforcement derivation is permitted, `finance.tg_lifecycle_transition()`, which must use identical ordering and tie-breaking (`occurred_at DESC, seq DESC`); an allowlist check fails if any third object derives it (D-074). That lifecycle never affects a balance column is asserted in pgTAP.

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
83. **`finished_at` consistency** — a `running` row with `finished_at` set is rejected, and any non-`running` row without it is rejected.
84. **`window_exhausted` biconditional** — every one of the five statuses is tested in both flag states: **10 combinations, 5 valid and 5 rejected**. Valid are `completed`+`true` and each of `running`, `partial`, `failed`, `abandoned` with `false`; rejected are `completed`+`false` and each of the other four with `true`.
85. **Resume lineage** — `resumed_from_run_id` may reference a `partial`, `failed` or `abandoned` run; referencing a `running` or `completed` run is rejected; self-reference is rejected; a second run resuming the same predecessor is rejected.
86. **Approval constraints** — a `dry_run = false` row without `authorized_by_run_id` is rejected; a `dry_run = true` row *with* one is rejected; `approved_by` and `approved_at` must be set together.
87. **Quarantine constraints** — `quarantined_at`/`quarantine_reason` set together; `released_at`/`released_by` set together; a release without a prior quarantine is rejected; `consecutive_failure_runs` may not go negative; **`quarantined_at` is never cleared by any permitted operation**.
88. **Approval and release are founder-only** — `service_role` cannot write `approved_by`/`approved_at` and holds no `EXECUTE` on `finance.release_quarantine()`; a founder can approve and can release through the function.
89. **All eight partial unique indexes exist** with exactly the predicates listed in ARCHITECTURE §15, and each is an index rather than a table constraint.
90. **`public.is_founder()` is hardened** — after PR 1's migration its `proconfig` includes `search_path`, and its signature is `is_founder() RETURNS boolean`, `SECURITY DEFINER`.
91. **Column-scoped grants prove both directions** — every `UPDATE` the reconciliation job legitimately performs succeeds as `service_role`, and every column outside its granted list is rejected.
92. **Quarantine cycle is executable** — quarantine, release via `finance.release_quarantine()`, normal processing, a second quarantine and a second release all succeed in sequence. After each release `released_at > quarantined_at`; after each re-quarantine `quarantined_at > released_at`. No step violates a `CHECK`.
93. `finance.release_quarantine()` raises for a non-founder, raises when the row is not actively quarantined, and in one statement sets `released_at`/`released_by` and resets `consecutive_failure_runs` to 0. `finance.quarantine_object()` is executable by `service_role` and not by a founder; neither role holds a direct `UPDATE` on the four quarantine columns; the function takes **no reason parameter**.
94. **Dry-run write constraints** — a `dry_run = true` row with non-zero `exceptions_created` or `exceptions_reopened` is rejected; a `dry_run = false` row carrying any report column is rejected.
95. **Report completeness** — `report_completed_at` without `would_create_count`, `would_reopen_count`, `prospective_by_kind` or `report_version` is rejected; `approved_at` without `report_completed_at` is rejected.
96. **Authorization source constraints** — a writing run citing a dry run that is `running`, `partial`, `failed`, `abandoned`, unapproved, error-bearing, or lacking a completed report is rejected; one citing a `completed`, error-free, approved, reported dry run of the same `livemode` and `implementation_version` is accepted.
97. **Implementation version binds** — a writing run whose `implementation_version` differs from its authorizing run's is rejected.
98. **Approval preconditions** — approving a `running`, `partial`, `failed` or `abandoned` dry run is rejected, as is approving one with `error` set.
99. **`provider_object_processing_failed` shape is enforced** — a row of that kind is rejected when `provider_object_id` is NULL, when `detail.object_type` is absent or outside `payment_intent|charge|refund|checkout_session`, or when `detail.error_class` is absent or outside `malformed_object|object_not_found|object_scoped_bad_request`. A fully-formed row is accepted, and two such rows for the same object in different `livemode` coexist.
100. **At-most-once index scope** — the partial unique index covers exactly the four types of ARCHITECTURE §10; inserting two `payment_intent.payment_failed` events with distinct `event_id` but the same object id and `livemode` succeeds, and neither creates a ledger entry.
101. **Quarantine ordering under concurrency** — two sessions, the second beginning **before** the first's opposing transition commits. Every release yields `released_at > quarantined_at`; every re-quarantine yields `quarantined_at > released_at`; no equality and no stale transaction timestamp leaves the derived state on the wrong side. Repeated across at least two full cycles.
102. **`dedup_key` cannot be supplied** — an `INSERT` attempting to write `dedup_key` is rejected by PostgreSQL; the stored value always equals the canonical construction; two rows differing only in an attempted key still collide on the open-row unique index.
103. **Approval attribution cannot be spoofed** — `finance.approve_dry_run()` ignores any attempt to supply an actor or timestamp (they are not parameters), records `auth.uid()` and `clock_timestamp()`, raises for a non-founder, and raises on a second approval of the same run.
104. **Approval preconditions inside the function** — approving a run that is not `dry_run`, not `completed`, not `window_exhausted`, unfinished, error-bearing, or lacking `report_completed_at` raises.
105. **Approved evidence is frozen** — after approval, an `UPDATE` to `status`, `error`, `finished_at`, `window_exhausted`, `window_start`, `window_end`, `livemode`, `implementation_version`, `dry_run`, any report column, or either approval column is rejected **as `service_role`** as well as as a founder.
106. **No direct approval write** — `UPDATE` on `approved_by`/`approved_at` is rejected for every role outside the function.
107. **`implementation_version` is required** — inserting a run without it is rejected; the column is never defaulted.

### Platform-behaviour and transition preconditions
108. **Generated `dedup_key` compiles and is canonical on the supported PostgreSQL version.** The real generated expression is created; **every one of the twelve `exception_kind` values** is inserted and yields a non-null key matching the canonical construction; an `INSERT` supplying `dedup_key` is rejected; an `UPDATE` attempting to override it is rejected. A `kind::text` form is asserted to be **rejected** by the server, documenting why the `CASE` exists.
109. **Untouched and partial quarantine states insert cleanly** — both timestamps `NULL` succeeds; `quarantined_at` set with `released_at` `NULL` succeeds; equal non-null timestamps are rejected; correctly ordered release and re-quarantine both succeed.
110. **`quarantine_object()` preconditions** — it raises on a first failure (`consecutive_failure_runs = 1`), on a second (`= 2`), on a `resolved` or `dismissed` row, on any `kind` other than `provider_object_processing_failed`, on an already actively quarantined row, and on a row missing `provider_object_id` or a valid `detail.error_class`. It succeeds at `>= 3` with a well-formed row.
111. **Derived quarantine reason** — `quarantine_reason` matches the row's own `detail.error_class`; there is no parameter by which a caller can supply a contradicting reason.
112. **Release then re-quarantine requires three fresh failures** — after release, `consecutive_failure_runs = 0`, and `quarantine_object()` raises until three new consecutive failures accumulate, then succeeds.
113. **Approval transition is permitted exactly once** — `finance.approve_dry_run()` succeeds on an eligible unapproved run; a direct `UPDATE` setting `approved_by`/`approved_at` is rejected for every role; a second call on the same run raises.
114. **`approval_note` is required and frozen** — approving with a blank or whitespace-only note raises; the stored note equals the supplied one; a later `UPDATE` to `approval_note` is rejected.
115. **Post-approval mutation is rejected for every frozen field**, tested individually and **as `service_role`** as well as as a founder, while an `UPDATE` to a non-frozen column on an approved row still succeeds.

### Structural non-nullity and resolution attribution
116. **`dedup_key` is structurally non-null** — the `NOT NULL GENERATED ALWAYS … STORED` definition is accepted on the supported PostgreSQL version; **every one of the twelve enum values** produces a non-null canonical key; a test fixture with an intentionally unmapped value **cannot produce an insertable row**; an `INSERT` or `UPDATE` supplying `dedup_key` is rejected.
117. **Resolution constraints** — an `open` row carrying `resolved_at` or `resolved_by` is rejected; a `resolved` or `dismissed` row missing either is rejected; a row with one set and the other NULL is rejected; a closed row with a blank or NULL `resolution_note` is rejected.
118. **`resolve_exception()` attribution cannot be spoofed** — the function takes no actor or timestamp parameter; the stored `resolved_by` equals `auth.uid()` and `resolved_at` is the call time; a non-founder call raises.
119. **`resolve_exception()` preconditions** — a blank or whitespace-only note raises; a target of `open` raises; a second call on an already-resolved or dismissed row raises; changing `resolved` to `dismissed` raises.
120. **Resolution wins over quarantine** — an actively quarantined row resolves successfully, leaves `open`, and is no longer covered by the open-row unique index, so a later recurrence inserts a fresh row with `consecutive_failure_runs = 0`.
121. **No direct resolution write** — `UPDATE` on `resolution_status`, `resolved_at`, `resolved_by` or `resolution_note` is rejected for **every** role, founder and `service_role` alike.
122. **`release_note` is separate from `resolution_note`** — `finance.release_quarantine()` writes `release_note` and leaves `resolution_note` untouched.

### `INSERT`-time protection of guarded transitions
123. **Ordinary exception creation succeeds** as `service_role` using only the granted columns; the row lands with `resolution_status = 'open'` (from the column default, since the grant excludes it) and the **other eight** protected columns `NULL`.
124. **Supplying any protected lifecycle column at `INSERT` fails as `service_role`** — each of the nine is rejected, tested individually: `resolution_status` set to anything other than `'open'`, and each of `resolved_at`, `resolved_by`, `resolution_note`, `quarantined_at`, `quarantine_reason`, `released_at`, `released_by`, `release_note` set non-`NULL`. The `BEFORE INSERT` trigger rejects them **even when the grant is widened**, proving the trigger and not the grant is load-bearing.
124b. **The trigger predicate is satisfiable** — an insert supplying `resolution_status = 'open'` explicitly (with the grant widened to permit it) is accepted, confirming the predicate asserts `'open'` for that column rather than requiring it `NULL`.
125. **The deduplicating upsert still executes** — `ON CONFLICT` touching `last_detected_at`, `occurrence_count`, `detail`, `last_run_id` and `consecutive_failure_runs` succeeds, and the streak update path is unaffected.
126. **Resolution, quarantine and release still succeed only through their functions**, and remain executable after the `INSERT` restrictions.
127. **`(resolution_status = 'open') = (resolution_note IS NULL)`** — an `open` row carrying a note is rejected, and a closed row without one is rejected.
128. **A normal unapproved run inserts** as `service_role` using only the granted columns.
129. **`service_role` cannot insert any approval field** — `approved_by`, `approved_at` and `approval_note` are each rejected at `INSERT`, individually, and by the trigger even with a widened grant.
130. **A fabricated approved dry run cannot authorize a writing run** — a run inserted with approval fields is rejected outright, so no such row exists to cite; and citing an unapproved run is rejected by the authorization trigger.
131. **Founder approval through `finance.approve_dry_run()` still succeeds**, and the post-approval freeze still rejects every frozen field afterwards.
132. **`authorized_by_run_id` remains insertable** for a writing run citing a genuinely approved dry run.
133. **Agreement creation requires its initial lifecycle event** — inserting an agreement and committing **without** an initial event fails **at commit**; inserting the agreement **first** and then its initial `draft` event in one transaction succeeds; `finance.create_agreement()` succeeds unchanged; the one-initial-event unique index still rejects a duplicate initial event.
133b. **Child-first insertion is rejected**, confirming the deferred trigger is not a licence to reorder: inserting a lifecycle event before its agreement fails on the non-deferrable foreign key.
