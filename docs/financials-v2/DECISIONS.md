# Financials V2 — Decision Log

Append-only, like the ledger it governs. Decisions are superseded by new entries, never edited in place.

**Format:** `D-NNN — Title` · Date · Status · Decision · Rationale · Consequences.

---

## D-001 — V2 lives in its own tracked `finance` schema, beside legacy
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Financials V2 is built as a clean backend in a dedicated `finance` Postgres schema, created entirely from tracked migrations. It never reads or writes legacy financial tables. Legacy financial code is reference material only.

**Rationale.** The audit found the core legacy ledger (`donations`, `financial_commitments`, `payment_allocations`, `payment_tokens`, `payout_commitments`, `expense_entries`, `billing_config`) has no `CREATE TABLE` anywhere in the repository — verified by grep. Its DDL, constraints and RLS exist only in the live project. An in-place refactor would extend an un-versioned, unreviewable foundation. A schema boundary makes "beside, not on top of" structurally enforceable: a V2 query touching legacy is a visible schema-qualified mistake, not an accident.

**Consequences.** Two systems coexist during migration. Legacy tables are eventually frozen as reference data rather than dropped.

---

## D-002 — PR 0 branches from `origin/main`; `claude/audit-fixes` is untouched
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Financials V2 work branches from `origin/main` via an isolated git worktree. The `claude/audit-fixes` branch — carrying 32 modified files, roughly 12 untracked files, and 7 unpushed commits — is not committed, pushed, stashed or otherwise altered.

**Rationale.** PR 0 requires a clean baseline. The in-flight work is unreviewed and several of its modified files touch financial routes V2 will replace.

**Consequences.** The uncommitted work remains outstanding and unresolved. It is tracked as an open risk in `HANDOFF.md`.

---

## D-003 — Synthetic `adjust-collected` rows are excluded from the V2 ledger
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Historic synthetic donations created by the legacy `adjust-collected` route are not imported. A historic external payment is imported only where evidence supports that money actually moved.

**Rationale.** These rows are founder accounting adjustments, not payments — the legacy route inserts a donation of `target − current`, permitted to be negative, with no allocation row. The entire value of the V2 ledger is that every row either records money that moved or is an attributed correction to such a record. Importing adjustments would defeat its purpose on day one.

**Consequences.** V2 figures will differ from currently displayed figures wherever an adjustment was applied. PR 2 produces a per-member variance report itemising every delta. Genuine discrepancies are resolved by explicit, attributed ledger entries — visible permanently, never silently absorbed.

---

## D-004 — `finance.payments` is renamed `finance.ledger_entries`
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** The money table is named `finance.ledger_entries`, with entry types `stripe_payment`, `external_payment`, `refund`, `reversal`.

**Rationale.** A table containing refunds and reversals is a ledger, not a payments table. The name should not mislead the next reader.

**Consequences.** All documentation, code and tests use the ledger vocabulary.

---

## D-005 — No generic correction entry type
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** V2 ships no generic balance-changing correction type. A mistaken entry is fixed by inserting an attributed `reversal` linked to it, then inserting the correct replacement entry where one applies. The original is never updated or deleted.

**Rationale.** A generic correction type is an unbounded escape hatch that reproduces exactly the legacy failure this project exists to fix — an adjustment mechanism indistinguishable from real money. Reversal plus replacement expresses every legitimate correction while preserving what was originally recorded and why.

**Consequences.** Correcting an error takes two entries rather than one. The full history of the mistake and its correction is permanent.

---

## D-006 — Ledger entries carry no duplicate member identity
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `finance.ledger_entries.agreement_id` is `NOT NULL`. No `member_id` or `journey_id` is stored on the ledger; both derive by joining through the agreement. Money that cannot be attributed to an agreement goes to `finance.reconciliation_exceptions`, never to the ledger.

**Rationale.** Duplicated identity drifts unless the database enforces consistency structurally. Deriving through the agreement makes drift impossible. The canonical ledger should contain only attributed, real money.

**Consequences.** Every ledger write requires a resolved agreement. Unattributed provider money is visible and actionable in the exceptions queue rather than silently landing in the ledger.

---

## D-007 — V2 is USD-only
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** All `currency` columns are constrained `CHECK (currency = 'usd')`. Agreement and ledger currency therefore match trivially. Multi-currency support is explicitly excluded from V2.

**Rationale.** No repository evidence establishes a multi-currency requirement. Pretending member or journey totals are valid across currencies would be false precision.

**Consequences.** Expansion requires relaxing the check, adding a composite foreign key so currency equality is structurally enforced, and partitioning every aggregate by currency — a future change requiring its own decision entry.

---

## D-008 — Contribution resolves under a total ordering; future-dated amendments are disallowed
**Date:** 2026-07-29 · **Status:** **Superseded in part by D-022** — the ordering clause below is obsolete; the remaining clauses stand.

**Decision.** Contribution is the latest amendment where `effective_at <= now()`, ~~ordered `effective_at DESC, created_at DESC, id DESC`~~ **(ordering superseded by D-022)**. Future-dated amendments are rejected on insert. Exactly one amendment is current; `reason` and `actor_id` are required; `amount_cents` must be non-negative; currency is not repeated on the amendment.

**Rationale.** Scheduled price changes are not a demonstrated requirement and would produce figure changes overnight with no user-initiated cause. The view retains the `effective_at <= now()` filter as defence in depth.

**Superseded reasoning.** This entry originally justified the ordering with "`id` is unique, so the ordering is total". That is true but insufficient: total is not the same as correct. Two amendments written in one transaction tie on `created_at`, leaving a random v4 `uuid` to pick the winner — total, yet not last-recorded-wins. D-022 replaces the tiebreak with a monotonic sequence.

**Consequences.** Scheduled Contribution changes are unavailable. Adding them later requires a decision entry and a review of every dependent view.

---

## D-009 — Lifecycle is modelled as append-only events, separate from financial state
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Agreement lifecycle lives in `finance.agreement_lifecycle_events`, append-only, with current status derived from the latest event. No `lifecycle_status` column exists on `finance.agreements`. Transitions are validated by trigger and carry actor, reason and timestamp. Lifecycle never affects Received, Remaining or payment state.

**Rationale.** A mutable status column plus a separate audit table creates two sources of truth that can disagree. Deriving from append-only events is the smallest model preserving full transition history. The legacy system conflated operational and financial status across two incompatible vocabularies; V2 keeps them structurally apart.

**Consequences.** Reading current lifecycle requires a latest-event lookup, expressed once in a view.

---

## D-010 — Stripe object uniqueness is enforced independently at the ledger
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `finance.stripe_events` deduplicates on `event_id`, with a partial unique index on `(event_type, object_id, livemode)` for terminal at-most-once event types only. Independently, `finance.ledger_entries` carries a partial unique index on `(provider_object_id, livemode)`.

**Rationale.** Event-level deduplication alone is insufficient: legitimately repeatable events such as `charge.refunded` share an object id across two genuine partial refunds, so a blanket uniqueness constraint would reject real money. Ledger-level uniqueness on the underlying charge or refund object is the correct double-count defence and holds even if event deduplication is bypassed entirely.

**Consequences.** Two independent uniqueness layers with different keys. Both are tested.

---

## D-011 — Payment links are consumed atomically at session creation
**Date:** 2026-07-29 · **Status:** **Mechanism superseded by D-024** — atomic consumption and permanent-consumption behaviour stand; the single-transaction mechanism does not.

**Decision.** A payment link is consumed in the same transaction that successfully creates its Checkout Session, by a single conditional update guarded on `consumed_at IS NULL`. Consumption is permanent. The member's retry path is the Stripe Checkout Session URL, resumable until it expires; after expiry the founder issues a new link.

**Rationale.** Legacy stamped `consumed_at` only on webhook success, so one token could open unlimited sessions until one happened to succeed. Conditional update makes concurrent consumption impossible — the loser creates no session. A token that reactivates on abandonment cannot be reasoned about, and reissue is cheap.

**Consequences.** An abandoned checkout whose session has expired requires founder reissue.

---

## D-012 — No dual-write; cutover is version-tagged
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes** the dual-write phase in the initial proposal

**Decision.** The same payment is never written into both legacy and V2. V2 Checkout Sessions carry `financial_version = 'v2'` and `agreement_id` in Stripe metadata. The V2 webhook processes only V2-attributed sessions; the legacy webhook ignores them. Pre-cutover sessions drain through the legacy handler for a defined period. Reconciliation imports verified legacy money for shadow comparison only, never writing back to legacy.

**Rationale.** Dual-write creates two authoritative records of one payment and guarantees divergence under partial failure. One payment must have exactly one authoritative write path. Routing by explicit tag rather than inference makes the boundary unambiguous.

**Consequences.** A defined drain period during which both handlers are live, separated strictly by tag.

---

## D-013 — Service-role access is not the authorization model for founder routes
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** RLS is enabled and forced on all V2 tables (eight at the time of writing; nine since D-041). Founder policies call the **existing `public.is_founder()`** — see D-037, which supersedes this clause; member policies use `finance.current_member_id()`. No hardcoded founder UUIDs. No client `UPDATE` or `DELETE` policies on append-only facts. Service-role access is confined to verified server infrastructure — webhook ingestion and reconciliation jobs.

**Rationale.** The audit found no RLS in the repository for any money table, every `/api/payments/*` route using a service-role client, and the one in-repo money-adjacent policy set inlining founder UUIDs across three policies. Security lived entirely in application code and was invisible to schema review.

**Consequences.** Founder routes authenticate the user and rely on RLS plus approved functions rather than a service-role bypass.

---

## D-014 — Member identity resolution
**Date:** 2026-07-29 · **Status:** **Resolved by D-015**

**Question.** Which table is the canonical member record, and what is the authoritative `auth.uid()` → member linkage? This decides the foreign key on every `finance` table that names a member.

**Why it was open.** The core legacy tables are absent from version control, so the linkage could not be read from schema. A legacy `bookings` policy joins `member_profiles.email → members.email`, implying `auth.uid()` corresponds to `member_profiles.id` rather than `members.id`. Application comments in the repository contradict one another on this exact point.

**Alternatives considered.**

| Option | For | Against |
|---|---|---|
| **A. FK to `member_profiles(id)`** | The only column guaranteed equal to `auth.uid()`; RLS becomes a trivial `= auth.uid()`; the May-09 repoint migration chose it for portal-written tables | A financial agreement could not exist before the member has a portal account — but founders record contributions during onboarding, before accounts exist |
| **B. FK to `members(id)`, resolve via `members.profile_id = auth.uid()`** | `members` is the operational record and exists independently of portal accounts; matches the pattern in `intake/complete` | Requires `members.profile_id` to be unique for single-valued resolution; that constraint is unverified |
| **C. FK to `auth.users(id)`** | Simplest identity | Excludes members without accounts entirely, and puts a domain FK on an auth-schema table |

**Resolution: Option B.** See D-015. Repository evidence settles the factual question; the design question resolves on the requirement that an agreement must be able to exist before a portal account does.

---

## D-015 — Member identity resolves through `members.profile_id`
**Date:** 2026-07-29 · **Status:** Approved · **Resolves D-014**

**Decision.** `finance.agreements.member_id` references `public.members(id)`. The authenticated member resolves through `members.profile_id = auth.uid()`, expressed once in `finance.current_member_id()`, which returns a `members.id`. Member RLS policies compare against that function. Two patterns are forbidden outright: comparing `auth.uid()` directly against a column that references `members(id)`, and resolving a member by email join.

**Rationale — established from repository evidence.** `member_profiles.id` equals `auth.users.id`. `members.id` does **not**: the equality is a coincidence of the normal provisioning path and is known-false in production for at least one manually seeded row. Two migrations exist solely to repair foreign keys written against the wrong assumption — `20260509000000_repoint_ceremony_progress_fks.sql` states the mismatch "only happened to work for members whose `members.id` equals their `auth.uid()`", and `20260509010000_repoint_followup_tasks_member_fk.sql` names the failing case as a manual admin seed. The true link is `members.profile_id`, which is nullable: a member row can exist with no portal account. Since founders record financial agreements during onboarding — before portal accounts exist — the agreement must hang off the operational record.

**Consequences.** `finance.current_member_id()` requires `members.profile_id` to be unique to be single-valued. **This is the only surface still blocked**, and it blocks a migration detail, not the architecture. Before creating the function, PR 1 must confirm against the live database: (1) whether `members.profile_id` carries a unique constraint or index, adding one after verifying no duplicates if not; (2) how many rows have `profile_id IS NULL` or `id <> profile_id`. Answers are recorded as a superseding entry.

**Related defect noted, not owned by V2.** `journey_email_log` still carries the repaired anti-pattern — a `members(id)` foreign key with a `member_id = auth.uid()` policy. Recorded in `HANDOFF.md` as a future item.

---

## D-016 — Legacy reads are permitted only in named comparison surfaces
**Date:** 2026-07-29 · **Status:** Approved · **Refines D-001**

**Decision.** The rule separates by layer. **Schema:** no `finance` object may reference a legacy financial table — absolute. **Write paths:** no V2 code path may write a legacy table — absolute. **Read paths:** legacy reads are permitted only in four named surfaces — the PR 2 import and variance report, the PR 4 founder shadow/diff page, the PR 7 founder flag-off read path, and the PR 8 member flag-off read path. All four are read-only and retired at PR 9; the first three are founder-scoped.

**Rationale.** As originally written, "V2 never reads or writes legacy financial tables" made PRs 2, 4 and 7 unimplementable — every shadow comparison must read `public.donations`. An absolute rule that the plan requires breaking is worse than a precise one, because it trains everyone to treat the rule as advisory.

**Consequences.** Any legacy read outside the four named surfaces is a defect. The reviewer checks the named list, not a general prohibition.

---

## D-017 — Canonical views coalesce zero rows and filter to live mode
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Every aggregate in `finance.v_agreement_balances` is wrapped in `COALESCE(…, 0)`. Canonical balances include only `livemode = true` ledger entries; a founder-only `v_agreement_balances_test` mirrors the definition for test-mode money. External payments and imported historic money are `livemode = true`.

**Rationale.** SQL `SUM` over zero rows returns `NULL`, not `0`. Without coalescing, a newly created agreement — the most common state in the system — would yield `NULL` for every column, fall through every `CASE` branch to `partial`, and feed a `NULL` amount into checkout. Separately, without a live-mode filter, test-mode webhook traffic during the PR 3 shadow phase would inflate real members' balances.

---

## D-018 — `payment_state` gains `not_applicable`, and a reversal is not a refund
**Date:** 2026-07-29 · **Status:** Approved · **Amends the five-value enum in the initial design**

**Decision.** `finance.payment_state` has six values; `not_applicable` is added for purposes where Remaining has no meaning (`additional_gift`, `other`). The `refunded` branch keys on `refunded_cents > 0`, not on `net_received_cents <= 0` alone; an entry recorded in error and then reversed returns to `unpaid`.

**Rationale.** A $500 gift against a zero Contribution would otherwise report `overpaid` with `−$500` remaining, and that negative figure would aggregate into member and journey totals. Separately, a founder who mistakenly records a check and reverses it — the correction path D-005 mandates — would otherwise show `refunded` with `refunded_cents = 0`, telling a member their money was refunded when no money ever moved. `unpaid` is the truthful state: nothing happened.

**Consequences.** Aggregate views sum Received across all agreements but Remaining across applicable agreements only.

---

## D-019 — A reversal's parent must have no children; "settled amount" defined
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** A `refund` may target only a `stripe_payment` or `external_payment`. A `reversal` may target any of those or a `refund`, but **only if the parent has no *unreversed* children** — an entry is reversed when a `reversal` targets it. "Settled amount" in L7 means the parent's original `amount_cents`, and L7 counts only **unreversed** refunds. To unwind a partially refunded payment, reverse the refunds first, then the payment.

**Rationale.** Without the rule: payment `+10000`, refund `−3000`, reversal `−10000` are each individually legal and sum to `−3000` — money the ledger claims left Vital Kauaʻi that never existed. Leaving "settled amount" undefined admitted three different readings, which is exactly the "one number, two definitions" class this project exists to eliminate. Permitting reversal of a refund preserves a correction path for a refund recorded in error; it produces a positive-signed reversal, which is why `reversed_cents` is a signed sum.

**Why "unreversed" rather than "no children at all".** The ledger is append-only, so reversing a refund does not remove the refund row. A no-children rule would therefore leave the parent payment permanently un-reversible, making the documented unwind path impossible to execute — the rule would forbid the procedure the same decision prescribes. Scoping to unreversed children preserves the double-subtraction defence while allowing the unwind, and it still makes double reversal impossible, since a reversed entry carries a reversal child that is itself unreversed.

---

## D-020 — Stripe payments require only a payment-intent id
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** L1 requires `provider_payment_intent_id` on a `stripe_payment`; `provider_object_id` is optional. Uniqueness is protected by L8 on the charge/refund object where present and by L8b on the payment intent. A Stripe payment imported without a charge object raises a `missing_provider_object` exception for backfill.

**Rationale.** Requiring both would make a class of legacy Stripe payments unimportable, and both workarounds are worse: relabelling as `external_payment` would falsely mark Stripe money as founder-recorded, violating the provenance invariant; synthesising a charge id would corrupt L8's uniqueness key and the reconciliation match.

---

## D-021 — Historic refunds are imported
**Date:** 2026-07-29 · **Status:** Approved · **Extends D-003**

**Decision.** The PR 2 import runs in two passes: payments first, then historic refunds parented to them. A refund whose parent is not importable raises an `orphan_refund` exception rather than being dropped.

**Rationale.** Importing payments alone would overstate Received for every historically refunded member, and those deltas would land in the variance report indistinguishable from the intended `adjust-collected` deltas — defeating the report's purpose.

---

## D-022 — Fact tables order by a monotonic sequence, not a timestamp
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes the ordering clause of D-008**

**Decision.** `agreement_amounts` and `agreement_lifecycle_events` carry a `seq bigint GENERATED ALWAYS AS IDENTITY`. Resolution orders by `effective_at DESC, seq DESC` and `occurred_at DESC, seq DESC` respectively. The future-dated amendment trigger has **no clock-skew tolerance**.

**Rationale.** `created_at` defaults to `now()`, which is transaction start time, so two amendments written in one transaction tie — leaving a random v4 `uuid` to pick the winner. That is total but not last-recorded-wins, and it contradicts the determinism requirement. A tolerance window on future dating would separately accept amendments the view then hides until wall-clock catches up, so a founder would save a new Contribution and see no change.

---

## D-023 — Event redelivery branches on processing status
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** On a primary-key conflict in `finance.stripe_events`: `processed`/`ignored` acknowledges and stops; `received`/`failed` re-claims and processes; `processing` with a stale `claimed_at` re-claims. A sweeper re-queues stale claims.

**Rationale.** Unconditionally acknowledging on conflict strands any event that inserted its row and then crashed mid-processing — Stripe's redelivery hits the primary key and stops forever, and the money silently never lands. Ledger invariants make reprocessing safe in every branch.

---

## D-024 — Checkout uses a persisted three-phase attempt, not a cross-system transaction
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes the single-transaction claim in D-011**

**Decision.** Payment-link consumption proceeds through three phases, each committed before the next: **claim** the link atomically (`status='active' → 'creating'`), **record intent** by inserting a `creating` checkout session with a deterministic idempotency key, then **create and finalise** by calling Stripe with that key. A sweeper replays stranded attempts using the same key and releases a link only where Stripe confirms no session exists. `finance.link_status` and a `creating` checkout status are added; `checkout_sessions.stripe_session_id` is nullable only while `creating`.

**Rationale.** D-011 stated that session creation and link consumption "occur in one transaction" and that "if Stripe fails, the transaction rolls back." Postgres and Stripe are separate systems with no shared transaction, so this is not implementable. Holding a transaction open across the network call does not help: a crash after Stripe creates the session but before the commit leaves Stripe with a live payable session and the database with no record — the orphan problem inverted, and worse, because the member can still pay it. Committing each phase means every failure mode leaves a recoverable, inspectable state. The deterministic key makes replay return the *same* session rather than a second one.

**Consequences.** One extra committed row per attempt, and a sweeper to own stranded attempts (`stranded_checkout_attempt`). Concurrency is resolved at phase 1, before Stripe is contacted.

---

## D-025 — Only `succeeded` Stripe refunds enter the ledger, enumerated with pagination
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** A Refund object produces a ledger entry only at `status = 'succeeded'`. `pending` and `requires_action` produce none and are re-checked by reconciliation until terminal; `failed` and `canceled` produce none ever. A refund regressing from `succeeded` raises `refund_status_regression` and is corrected by an attributed reversal. Refunds are enumerated through the paginated Refunds list API, never the embedded `charge.refunds.data` array.

**Rationale.** Writing an entry on `pending` overstates refunds for every refund that later fails, and the correction would be indistinguishable from a genuine reversal. The embedded refund array on a Charge is a truncated page (default 10, with `has_more`), so a charge with more refunds than one page would silently lose the remainder — a class of undercount that produces no error anywhere.

---

## D-026 — Corrections require an actor and a reason
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** L12: an entry with `source = 'external'`, or of `entry_type = 'reversal'`, requires `recorded_by` NOT NULL and a non-blank `reason`. Reconciliation-initiated reversals carry the `reconciliation` system actor with a reason naming the triggering exception. *(D-032 supersedes the earlier Auth-account mechanism: PR 1 must not create an `auth.users` row.)*

**Rationale.** Attribution was required only on `external_payment`, so a founder could post an external refund or a reversal — the entry types that exist specifically to correct human error — with no actor and no explanation. An unattributed correction is the legacy defect in new clothing.

**Why the rule keys on `source` rather than on a provider object id.** An earlier formulation defined "provider-originated" as `source = 'stripe' AND provider_object_id IS NOT NULL`. That contradicts L1 and D-020, which deliberately permit a Stripe payment imported with a NULL charge-object id: unambiguously provider money that the rule would nonetheless have demanded a human actor for, with no document saying who. `source = 'stripe'` suffices on its own, since L1 already requires a payment-intent id on every Stripe payment.

**Consequences.** A refund executed through Stripe is exempt — the provider records who did it — whether a founder or a customer initiated it. A refund recorded outside Stripe requires attribution. Every reversal requires attribution regardless of source, because a reversal is never a provider event.

---

## D-027 — `service_role` privileges are granted explicitly
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** PR 1 grants `service_role` `USAGE` on `finance` plus `SELECT`, `INSERT` and the bounded `UPDATE`s of §1, with matching `ALTER DEFAULT PRIVILEGES`. `service_role` receives no `UPDATE` or `DELETE` on the three append-only fact tables, and the append-only triggers raise regardless of role.

**Rationale.** A custom schema is unreachable until granted. Webhook ingestion and the reconciliation job run as `service_role`; omitting the grant is a silent runtime failure at PR 3 rather than a build error. Granting it does not weaken the append-only guarantee, which is enforced by trigger rather than by privilege.

---

## D-028 — Stranded checkout attempts are never auto-replayed or auto-released past the idempotency window
**Date:** 2026-07-29 · **Status:** Approved · **Corrects the recovery mechanism in D-024**

**Decision.** Replay with the stored idempotency key is permitted **only inside Stripe's idempotency retention window**. Outside it, recovery determines ground truth by enumerating Stripe Checkout Sessions over the attempt's creation window and matching an `attempt_id` carried in Session metadata. A Session found is finalised; an exhaustive search finding none raises `stranded_checkout_attempt` for explicit founder release; an inconclusive search leaves the link `creating`. Ambiguous state is never resolved automatically.

**Rationale.** D-024 assumed a replayed key could answer "did this succeed?" It cannot. Stripe offers **no retrieve-by-idempotency-key operation** — a key deduplicates a repeated request — and [results age out after roughly 24 hours](https://docs.stripe.com/api/idempotent_requests). Replaying after expiry therefore creates a **second payable Session**, the exact failure the three-phase design exists to prevent. An automatic release that guesses wrong bills a member twice; a stranded link costs a founder one click.

**Consequences.** Every V2 Session carries `attempt_id` in metadata so the post-window search is exact. Some stranded attempts require human resolution — accepted deliberately over a silent double-charge.

---

## D-029 — At most one live Checkout Session per agreement
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** A partial unique index on `finance.checkout_sessions (agreement_id, livemode) WHERE status IN ('creating','open')` *(keyed on `livemode` per D-034; the original entry said `agreement_id` alone)*. A request while a live Session exists returns that Session's URL rather than creating another. A sweeper expires Sessions past `expires_at`, and those Stripe reports expired or cancelled, freeing the slot. A `creating` row holds the slot until recovery resolves it.

**Rationale.** Nothing previously stopped two payment links — or a link and the portal — each opening a Session for the same Remaining. **Both would be payable.** The member pays twice, both payments are legitimate provider money, and the agreement lands `overpaid` with no defect to point at: every component behaved correctly. The constraint belongs in the database, before Stripe is contacted, not in application logic that each entry point must remember.

**Consequences.** One outstanding payment request per agreement at a time — also the better member experience. The slot releases on completion, so instalments remain possible.

---

## D-030 — Only a verified `succeeded` PaymentIntent creates a `stripe_payment`
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Ingestion retrieves and [verifies the PaymentIntent status](https://docs.stripe.com/payments/payment-intents/verifying-status) before writing. Only `succeeded` produces a ledger entry. `processing`, `requires_action`, `requires_payment_method` and `requires_capture` produce none and are re-checked by reconciliation; `canceled` produces none. `checkout.session.async_payment_succeeded` and `payment_intent.succeeded` reach the same verification; whichever arrives first writes, and L8/L8b make the rest no-ops.

**Rationale.** The architecture specified refunds at length and left the commonest case implicit. `checkout.session.completed` means the customer finished the flow, not that money settled: for delayed-notification methods the Session completes with `payment_status: 'unpaid'` while the PaymentIntent is still `processing`, and it can subsequently fail. Writing on session completion would credit money that never arrived — the mirror of the refund defect D-025 exists to prevent.

---

## D-031 — Refund provenance is required and typed by source
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** L3 requires provenance complete for a refund's source: `source='stripe'` requires `provider_object_id` (the `re_…` Refund id); `source='external'` requires `external_method` and L12 attribution. L3b requires a Stripe refund's parent to be a `stripe_payment`; an external refund may target either payment type.

**Rationale.** L3 previously required only a parent, so a Stripe refund could be written with `provider_object_id` NULL — and **L8's uniqueness index is partial**, applying only where that column is present. Two rows for the same `re_…` refund would both be accepted, defeating D-025's deduplication guarantee entirely. Requiring the Refund id makes L8 binding for the class rather than optional. External refunds carry the complementary requirement: a method and a named actor, since no provider vouches for them.

---

## D-032 — System attribution is an enum, not an Auth user
**Date:** 2026-07-29 · **Status:** Approved · **Corrects the system-actor mechanism in D-026**

**Decision.** `finance.ledger_entries` carries `recorded_by_system finance.system_actor NULL` beside `recorded_by`, with `CHECK (num_nonnulls(recorded_by, recorded_by_system) <= 1)`. L12 is satisfied by exactly one of them. Values: `reconciliation`, `legacy_import`, `checkout_sweeper`.

**Rationale.** D-026 attributed automated reversals to a dedicated `auth.users` service account. That would make a clean `supabase db reset` depend on an **environment-specific Auth user** — the migration applies on one environment and fails on another — and Supabase's guidance is that users are created through the [Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser), not inserted by migration. An enum keeps system attribution inside the `finance` schema, portable, and reproducible from migrations alone, while remaining exactly as legible in an audit as a named person.

**Consequences.** Imports attribute to `legacy_import` where the original founder is unidentifiable, and to `recorded_by` where they are — human attribution being the better evidence.

---

## D-033 — Attribution metadata is written to the PaymentIntent, not only the Session
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Every V2 Checkout Session sets `financial_version`, `agreement_id` and `attempt_id` on **both** `metadata` and `payment_intent_data.metadata`. Ingestion resolves attribution from whichever object an event carries. PR 6 tests that a PaymentIntent webhook processes correctly with the Session webhook never arriving.

**Rationale.** Checkout Session metadata **does not propagate** to the PaymentIntent it creates. A `payment_intent.succeeded` event therefore carries PaymentIntent metadata, which is empty unless set deliberately. D-030 requires verifying the PaymentIntent before writing a payment, and events can arrive in any order or singly — so an implementation reading only Session metadata would fail to attribute any payment whose PaymentIntent event arrived first or alone, and the money would land in `unattributable_payment` despite being perfectly well identified at Stripe.

---

## D-034 — Session reuse is validated, and superseded Sessions are expired at Stripe first
**Date:** 2026-07-29 · **Status:** Approved · **Refines D-029**

**Decision.** An existing `open` Session is reused **only when** agreement, `amount_cents`, `currency`, `livemode` and the agreement's **current** `payable_remaining_cents` all still match, and it is not past `expires_at`. Otherwise it is expired through the Stripe API, the expiration **confirmed in Stripe's response**, and only then is the local row marked `expired` and the slot freed. Where expiration cannot be confirmed, **checkout is blocked** and `stale_session_expiry_failed` is raised. The one-live-Session index is keyed on `(agreement_id, livemode)`.

**Rationale.** D-029 said a request while a live Session exists returns that Session's URL. But its amount was fixed at creation: a founder amending the Contribution, or any payment landing in between, leaves it quoting an obsolete figure — and the member is charged the wrong amount with a valid Stripe Session and a correct-looking ledger entry to show for it. Dropping the Session locally is not enough either: it remains payable at Stripe, so creating a replacement alongside it produces exactly the two-payable-Sessions state D-029 exists to prevent. Blocking on unconfirmed expiry is the safe outcome. Keying the index on `livemode` prevents a test-mode Session from occupying the only slot and blocking a real payment.

---

## D-035 — Two sweepers, two safety rules, one fixed replay cutoff
**Date:** 2026-07-29 · **Status:** Approved · **Refines D-028**

**Decision.**

- **Orphaned claim** — a link `creating` with **no** `checkout_sessions` row and `claimed_at` older than a **15-minute TTL** is atomically restored to `active`. Safe unconditionally, because the Stripe call happens only after the session row is committed, so no Session can exist.
- **Stranded attempt** — replay is permitted only within a **fixed 23-hour cutoff** measured from the persisted `checkout_sessions.created_at`. Beyond it, ground truth comes from **exhaustively paginated** Checkout Session enumeration over a bounded creation interval, matched locally on `attempt_id`. Ambiguous outcomes raise `stranded_checkout_attempt` and are never auto-replayed or auto-released.

**Rationale.** D-028 left two gaps. First, a crash between claiming the link and inserting the attempt row stranded the link **permanently** — no attempt existed for any sweeper to act on, and the link could never return to `active`. That state is provably safe to recover, because Stripe was never contacted. Second, "inside Stripe's idempotency window" is not a testable condition: Stripe exposes no key-expiry lookup, so the rule has to be a fixed interval. 23 hours sits deliberately short of Stripe's ~24-hour pruning so clock skew and job latency cannot push a replay past it. Stripe also offers no server-side metadata filter on Sessions, so the out-of-window search must paginate to exhaustion — treating a single page as conclusive would produce the false "no Session exists" that causes a double charge.

---

## D-036 — Provenance fields may not contradict `source`
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** L13: `source='stripe'` requires `external_method IS NULL`; `source='external'` requires `provider_object_id IS NULL` and `provider_payment_intent_id IS NULL`. `legacy_donation_id` is exempt — it is import traceability, orthogonal to origin, and legitimately present on both.

**Rationale.** The invariants stated what each source *requires* and never what it *excludes*, so a `stripe_payment` could carry `external_method='cash'` and an `external_payment` could carry a `pi_…` identifier it has no claim to. Such a row asserts two incompatible origins at once; any report grouping by provenance would double-count or arbitrarily classify it. Provenance is only useful when a row has exactly one.

**Also corrected here:** acceptance test 29 and the L3 commentary both demanded a "named human" on external entries, contradicting L12 and D-032 and making legacy-imported external payments and refunds unimportable. Both now require exactly one valid attribution, human **or** system.


---

## D-037 — V2 reuses `public.is_founder()`; PR 1 gaps closed
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes the founder-predicate clause of D-013**

**Decision.** V2 does not define `finance.is_founder()`. Founder policies call the existing `public.is_founder()`. Alongside this, PR 1's previously unwritable specifications are now fixed in ARCHITECTURE §15: `payment_links` DDL, `public.journeys(id)` as the journey FK target, `create_agreement()`'s signature and initial `draft` event, the complete lifecycle transition graph, the enumerated terminal event-type list, the full RLS policy matrix, view column lists, the PostgreSQL 15 baseline, and pgTAP as the test framework. `finance.ledger_entries` gains `origin_stripe_event_id` so L11 has a join path.

**Rationale.** A readiness review asked whether an engineer could write PR 1's migration from these documents alone, and the answer was no — nine blockers, six of them pure documentation gaps. Principles are not specifications: "versioned, no hardcoded UUIDs" is a prohibition, not a definition, and it left the founder predicate undefined while `public.is_founder()` already existed in the repository and was already used by live RLS. Defining a second predicate would have created exactly the drift this project exists to eliminate. L11 was separately unenforceable: it required ledger `livemode` to match "the originating event or session" while no column connected a ledger row to either.

**Consequences.** PR 1 confirms `public.is_founder()`'s definition against the live database before relying on it. The application-layer `verifyFounder()` hardcoded-UUID path in `lib/auth/founder-check.ts` is not used by V2 and is recorded as a future item.


---

## D-038 — B-1 resolved by live evidence; PR 1 adds no index
**Date:** 2026-07-29 · **Status:** Approved · **Closes B-1**

**Decision.** `finance.current_member_id()` may be created as specified. PR 1 adds **no** unique index on `members.profile_id`.

**Evidence.** Confirmed read-only against `Vital-Kauai-prod` on 2026-07-29; aggregates only, no member identifier selected, nothing created or altered.

| Check | Result |
|---|---|
| Unique index on `members.profile_id` | **Already exists** — `uq_members_profile_id`, `UNIQUE (profile_id) WHERE profile_id IS NOT NULL` |
| Duplicate non-null `profile_id` groups | 0; max 1 row per `profile_id` |
| `profile_id IS NULL` | 0 of 17 |
| `id <> profile_id` | **2 of 17** |
| `members.profile_id` FK | `REFERENCES member_profiles(id) ON DELETE SET NULL` |
| PostgreSQL | 17.6 |
| `public.is_founder()` | `SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'founder')`, `STABLE SECURITY DEFINER` |

**Consequence.** The two divergent rows validate D-015 against production: 12% of members would silently return no financial data under a `member_id = auth.uid()` policy. A separate finding — `public.is_founder()` carries no `SET search_path` — is recorded as risk R-5, outside PR 0's scope.

---

## D-039 — Reconciliation may ingest, never correct
**Date:** 2026-07-29 · **Status:** Approved · **Resolves a contradiction between D-025 and D-032**

**Decision.** Reconciliation may insert `stripe_payment` and `refund` entries for provider objects it has verified and attributed, and may create and reopen exceptions. It may **not** insert a `reversal`, resolve an exception, amend a Contribution, or alter any existing entry. `refund_status_regression` raises an exception; a founder approves the corrective reversal, which carries their `recorded_by`.

**Rationale.** The documents simultaneously said reconciliation "raises exceptions and never silently self-corrects" and had it issue reversals for refund regressions. Both could not hold. The distinction that resolves it: recording a payment Stripe confirms is not a judgement — the money moved, and whether we learned of it by webhook or by polling is an implementation detail. Reversing an entry **is** a judgement, asserting a previously recorded fact was wrong. A job permitted to make that call unattended can silently unwind real money.

**Consequence.** The `reconciliation` system actor attributes ingested entries only, never corrections. Enforced structurally: `service_role` holds no `UPDATE` on the fact tables and the append-only triggers fire regardless of role.

---

## D-040 — Reconciliation exceptions have a deterministic dedup identity
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `finance.reconciliation_exceptions` gains `dedup_key`, `first_detected_at`, `last_detected_at`, `occurrence_count`, `first_run_id`, `last_run_id`, and a partial unique index on `(dedup_key, livemode) WHERE resolution_status = 'open'`. Rediscovery upserts. A resolved exception that recurs inserts a fresh row. `detected_at` is removed.

**Rationale.** The table had a surrogate `id` and no identity for the mismatch itself, so the first real run's ~4,000 exceptions would re-insert in full on every subsequent run and the founder's queue would be unusable within days. `dedup_key` is computed from the fields identifying *which* mismatch this is, never from amounts or timestamps, which change while the mismatch persists. `detected_at` was ambiguous between first and latest detection; both questions matter and have different answers, so both are stored. Restricting uniqueness to open rows means a recurrence after resolution is recorded as the new fact it is, rather than silently reopening a row a founder already judged.

**Consequence.** Row count scales with distinct unresolved mismatches, not runs × mismatches. Concurrent discovery is resolved by the index rather than by application checks.

---

## D-041 — Reconciliation job state lives in a ninth table, created in PR 1
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `finance.reconciliation_runs` is added as table 9, created in PR 1 and first used in PR 3. It carries window bounds, a durable `cursor`, run counters, heartbeat, dry-run flag, and a partial unique index on `(livemode) WHERE status = 'running'` for single-flight.

**Rationale.** The job needed a cursor to resume, a run identity for observability, and a lock for single-flight, and had nowhere to keep any of them. Adding the table in PR 3 would contradict PR 1's stated completeness and split schema ownership across two PRs; PR 1 owns all schema. Single-flight keyed on `livemode` lets test and live runs proceed independently.

**Consequence.** Tables 8 → 9; enums 12 → 13 with `finance.run_status`.

---

## D-042 — Reconciliation matches by identity only; no heuristics
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Matching is by provider object id, then by PaymentIntent under L8b, then by V2 metadata attribution. Amount, timestamp and email proximity are **never** used. An object that cannot be matched or attributed raises an exception. There is no confidence score and no tie-break.

**Rationale.** "Reconciliation matching" was named as PR 3's sole basis for writing ledger entries and never defined — a ledger write path specified by a phrase. Heuristic matching would guess which member a payment belongs to, which is precisely the class of error this system exists to eliminate; a near-match is not evidence.

---

## D-043 — Operational rules are part of the architecture, not implementation detail
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** ARCHITECTURE §10a specifies all twenty operational properties of the reconciliation job — window and overlap, initial lookback, cursor, page and batch sizes, resume, single-flight, exhaustive pagination for all four object types, 429 and `Retry-After` handling with bounded backoff, failure classification, retry budget and quarantine, exception dedup, mode isolation, double-processing safety, run counters, alert thresholds, dry-run first, maximum-work limits, rerun safety, and the ingest/correct boundary. PR 3 carries acceptance tests of its own, listed with that PR in `PR_PLAN.md`.

**Rationale.** An operational readiness review found **zero of twenty** defined. Every one was correct in principle and unbuildable in practice: against the stated scenario the job would have double-inserted thousands of exceptions per run and been unable to resume. A scheduled job that touches money is not implementation detail — its re-entrancy is an architectural property, and leaving it to the implementer means it is decided by whoever is least equipped to decide it.


---

## D-044 — PR 1 hardens `public.is_founder()`; the earlier risk explanation was wrong
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes risk R-5's framing**

**Decision.** PR 1 executes `ALTER FUNCTION public.is_founder() SET search_path = pg_catalog, public;` and verifies the live signature before writing any policy that calls it. A reviewer check confirms `proconfig` is non-null afterwards.

**Correction.** A previous revision claimed a caller could "resolve `public.user_roles` to an object they control." **That was false.** The function body schema-qualifies both `public.user_roles` and `auth.uid()`, so `search_path` cannot redirect either relation. The accurate concerns are narrower: unqualified **operator** resolution (the `=` comparisons) still goes through `search_path` inside a `SECURITY DEFINER` context; a future edit adding one unqualified reference would silently remove the protection with no test to catch it; and Supabase's `function_search_path_mutable` linter flags it.

**Rationale for owning it.** §9 requires a fixed `search_path` on every `SECURITY DEFINER` function V2 relies on. Exempting the single function every founder policy calls would make that rule decorative, and recording it as "someone else's risk" while PR 1 builds an authorization boundary on top of it is precisely the ownerless-risk pattern this project exists to eliminate.

---

## D-045 — `partial` is a distinct run status; only `completed` advances the watermark
**Date:** 2026-07-29 · **Status:** Approved · **Corrects rule 18 of D-043** · **Constraint form tightened by D-055** · **Enum inventory reconciled by D-072**

**Decision.** `finance.run_status` gains `partial`. A run stopping at a work ceiling ends `partial` with `window_exhausted = false`; its successor inherits the identical window and cursor. `completed` requires every object type to have exhausted the whole window, enforced by ~~`CHECK (status <> 'completed' OR window_exhausted)`~~ **the biconditional `CHECK ((status = 'completed') = window_exhausted)` per D-055**. Only a `completed` run advances the next window's start.

**Rationale.** Rule 18 marked a bounded run `completed` while rule 1 derived the next window from the last `completed` run's `window_end`. Together they **skip every object the bounded run never reached** — permanently, with no gap reported anywhere, because both rules behaved exactly as written. Money would go unreconciled and nothing would say so.

---

## D-046 — Resume lineage is a stored, constrained self-reference
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `reconciliation_runs.resumed_from_run_id` references the run being continued. Resumable statuses are `partial`, `failed`, `abandoned`; a trigger rejects lineage onto a `running` or `completed` run. Self-reference is rejected by `CHECK`. A resumer inherits its predecessor's window, enforced by trigger. At most one run may resume a given predecessor. `finished_at` consistency is enforced for every status by `CHECK ((status = 'running') = (finished_at IS NULL))`.

**Rationale.** §10a described resuming "under a new run id referencing the abandoned one" while the table had no such column — the lineage the recovery story depends on could not be recorded, so a resumed chain was unauditable. Restricting the target status matters too: resuming a `running` run would defeat single-flight, and resuming a `completed` one would redo finished work.

---

## D-047 — Quarantine state lives on the exception row
**Date:** 2026-07-29 · **Status:** **Mechanism corrected by D-051** — the location and streak rules stand; "release clears `quarantined_at`" does not.

**Decision.** `reconciliation_exceptions` gains `consecutive_failure_runs`, `quarantined_at`, `quarantine_reason`, `released_at`, `released_by`. The streak increments only when `last_run_id` differs from the current run, so retries within one run count once; any run in which the object does not fail terminally resets it. Reaching 3 sets `quarantined_at`. Quarantined objects are skipped by later runs but remain `open` and visible. Only a founder may release, which clears quarantine and resets the streak.

**Rationale.** Rule 11 promised quarantine after three consecutive failures while nothing counted failures, held quarantine state, or connected a failure in one run to the same object in the next. `dedup_key` is already the cross-run identity of the object-and-problem pair, so no second identity is introduced. Quarantine stops retrying; it deliberately does not stop reporting.

---

## D-048 — Four error classes; run-fatal failures end the run
**Date:** 2026-07-29 · **Status:** Approved · **Corrects rule 10 of D-043**

**Decision.** Transient (429, 5xx, timeout, reset) → retry. Object-terminal (404, malformed object, object-scoped 400) → exception for that object, run continues. **Run-fatal (401, 403, invalid list parameters, account configuration) → end the run `failed` with the cursor intact, raise one `reconciliation_run_failed`, alert.** Ambiguous → exception, no ledger write.

**Rationale.** Rule 10 classed every non-429 4xx as object-terminal, so an invalid API key would have been treated as one bad charge — marching through the entire window raising thousands of meaningless exceptions while reconciling nothing, and reporting a run that "continued". Authentication and configuration failures are properties of the run, not of an object.

---

## D-049 — Counters measure examinations, not distinct objects
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `objects_scanned` and `objects_matched` count examinations performed by a run. Overlapping windows and page-boundary resumes mean the same object is legitimately examined more than once, so these counters must not be summed across runs as a count of distinct Stripe objects. `exceptions_created` counts inserts; `exceptions_reopened` counts upserts onto an open row.

**Rationale.** PR 3 test 3 asserted a restart "processes no object twice", contradicting rule 14, which correctly states an object may be examined repeatedly and that safety comes from idempotent writes. The test was demanding a property the design deliberately does not have — and could only have been satisfied by weakening the resume guarantee. Uniqueness belongs in the write path, not the counters.

---

## D-050 — Dry-run approval is a persisted, validated authorization
**Date:** 2026-07-29 · **Status:** **Superseded by D-052 and D-059.** Retained as history only — its window model and its direct-`UPDATE` approval mechanism are both obsolete. No normative text may cite this entry.

**Decision.** A founder approves a dry run by setting `approved_by`/`approved_at` on that run row. Every writing run cites one via `authorized_by_run_id`, enforced by `CHECK (dry_run OR authorized_by_run_id IS NOT NULL)` and a trigger validating that the cited run is a dry run, is approved, shares `livemode`, and has a `window_start` no later than the writing run's. The first writing run per mode is capped at a 24-hour window. Only a founder holds the grant on the approval columns.

**Rationale.** Rule 17 said a founder reviews the dry run "before a writing run is permitted" while nothing recorded the review and nothing prevented starting `dry_run = false` immediately. An approval gate that exists only in prose is not a gate. Reaching further back than the reviewed window invalidates the approval, because the founder approved a scope, not a job.


---

## D-051 — Quarantine is derived from retained timestamps, released by a founder-only function
**Date:** 2026-07-29 · **Status:** Approved · **Corrects the release mechanism of D-047** · **Timestamp mechanism tightened by D-057**

**Decision.** `quarantined_at` and `quarantine_reason` are never cleared. Active quarantine is derived: `quarantined_at IS NOT NULL AND (released_at IS NULL OR released_at < quarantined_at)`. Release happens through `finance.release_quarantine(p_exception_id, p_note)` — `SECURITY DEFINER`, founder-gated — which sets `released_at`/`released_by` and resets `consecutive_failure_runs` in one statement. A later re-quarantine writes a newer `quarantined_at` and becomes active again. `service_role` holds neither the columns nor `EXECUTE`.

**Rationale.** D-047 said release "clears `quarantined_at`" while a `CHECK` required `released_at IS NULL OR quarantined_at IS NOT NULL`. Clearing the timestamp with a release recorded violates that constraint, so **release was literally impossible**. The grants compounded it: a founder could write only `released_at`/`released_by` and so could not have cleared the timestamp or reset the streak even had the constraint allowed it, while `service_role` is deliberately forbidden from releasing at all. Deriving the state from two retained timestamps removes the contradiction, survives repeated cycles without ambiguity, and keeps the reset atomic.

**Honest limit.** These columns record the **latest** quarantine and the **latest** release, not every cycle. A full cycle history would need its own append-only table and a decision entry; this design does not claim to provide one.

---

## D-052 — Launch authorization, not window coverage
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-050**

**Decision.** An authorizing dry run must be `dry_run = true`, `status = 'completed'`, `window_exhausted = true`, `finished_at` non-null, `error IS NULL`, approved, and carry a completed report. Approval is itself rejected unless the run is completed, error-free and reported. An authorization grants three things: **mode**, **earliest horizon** (`window_start` no earlier than the approved run's), and **implementation version** (equality required). The first writing run per `(livemode, implementation_version)` must be **contained within the approved dry run's window** and span at most 24 hours; only after that canary reaches `completed` may later runs extend beyond the rehearsed `window_end`.

**Rationale.** D-050's trigger validated neither completion nor absence of error, so a **running, partial or failed** dry run could authorize money-writing reconciliation — a rehearsal that never finished, licensing the real thing. Separately, calling it "covers the window" while constraining only `window_start` was inaccurate: the writing run could end arbitrarily later. Containment alone is not viable either, since reconciliation advances forward indefinitely and would demand re-approval every run. Naming it launch authorization and bounding it by horizon plus version is what the model actually is, with containment applied exactly where it is meaningful — the first real write.

---

## D-053 — Dry runs produce a bounded, sanitized, reviewable report
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** `reconciliation_runs` gains `would_create_count`, `would_reopen_count`, `prospective_by_kind`, `report_samples`, `report_version`, `report_completed_at`, populated only by dry runs. Samples are deterministic, capped at 20 per kind and 200 total, ordered by `dedup_key`, and sanitized to the same rule as `stripe_events.payload`. `exceptions_created` and `exceptions_reopened` keep their D-049 meaning — **real writes only** — and are constrained to `0` in a dry run. Approval is impossible without `report_completed_at`.

**Rationale.** Rule 17 asked a founder to review a dry run before approving, while rule 17 also forbids the dry run from writing exceptions and D-049 defines those counters as actual inserts. The founder was therefore being asked to approve on the evidence of two zeros, with 4,000 prospective findings recorded nowhere. Overloading the real counters with "would write" semantics was the tempting shortcut and would have made every historical run's numbers ambiguous about whether they describe writes or intentions.

---

## D-054 — Object-terminal failures have their own exception kind
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** Adds `provider_object_processing_failed`, requiring `provider_object_id` and an `object_type` in sanitized `detail`, with `dedup_key` built from kind plus provider object id. It increments `consecutive_failure_runs` once per run via the standard `last_run_id` guard, and a later successful examination finds the open row by `dedup_key` and resets the streak without resolving it. `livemode` isolates as usual.

**Rationale.** The error-class table drove quarantine off object-terminal failures while the closed enum had no value to represent one. The only available substitute, `reconciliation_run_failed`, is explicitly run-scoped; reusing it would have made a broken run indistinguishable from a bad object and let a single run failure inflate an object's quarantine streak.

---

## D-055 — `window_exhausted` is a biconditional
**Date:** 2026-07-29 · **Status:** Approved · **Tightens D-045**

**Decision.** `CHECK ((status = 'completed') = window_exhausted)`. Only `completed` may carry `true`; `completed` may not carry `false`. Every status is tested in both flag states.

**Rationale.** `status <> 'completed' OR window_exhausted` proves only *completed ⇒ exhausted*. It permitted `partial`, `failed`, `abandoned` and `running` rows flagged exhausted, contradicting the state table and making the flag useless as evidence — a `true` value proved nothing on its own, which defeats the purpose of having recorded it.

---

## D-056 — The at-most-once event list is restricted to four object-terminal states
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-043's event list**

**Decision.** The partial unique index on `(event_type, object_id, livemode)` covers exactly `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.canceled`. Removed: `payment_intent.payment_failed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`. Adding any type requires a decision entry citing the Stripe semantics that make it at-most-once **per object**, not per attempt.

**Rationale.** `payment_intent.payment_failed` is emitted **per failed attempt**. A failed PaymentIntent returns to `requires_payment_method` and can be retried, producing a second legitimate event with a new `event.id` but the same object id, type and `livemode` — which the index would have **silently discarded**. The two async Checkout types were removed because at-most-once is not provable from the object's semantics, and the index is asymmetric in cost: `event_id` already deduplicates redelivery and L8/L8b prevent ledger double-counting, so under-including costs nothing while over-including drops a real event. Uncertainty is a reason to exclude.


---

## D-057 — Quarantine transitions are strictly monotonic, via functions only
**Date:** 2026-07-29 · **Status:** Approved · **Tightens D-051** · **Backstop constraint corrected by D-062; preconditions added by D-064**

**Decision.** Both transitions run through `SECURITY DEFINER` functions that lock the row and write a timestamp strictly greater than the opposing one: `finance.release_quarantine()` sets `released_at := GREATEST(clock_timestamp(), quarantined_at + interval '1 microsecond')`; `finance.quarantine_object()` sets `quarantined_at := GREATEST(clock_timestamp(), COALESCE(released_at,'-infinity') + interval '1 microsecond')`. `quarantine_object` is `service_role`-only, `release_quarantine` founder-only. **No role holds a direct `UPDATE`** on the four quarantine columns. A `CHECK (released_at IS DISTINCT FROM quarantined_at)` backstops equality.

**Rationale.** D-051 specified `now()`, which PostgreSQL fixes at **transaction start**. A transaction that began before the opposing transition committed writes a timestamp *earlier* than the stored value, so `finance.release_quarantine()` could commit successfully and leave the object still actively quarantined — a release that reports success and changes nothing. Equality is equally wrong, since the derived predicate requires `released_at < quarantined_at` to mean quarantined. `clock_timestamp()` is evaluated at statement time rather than transaction start, and `GREATEST(…, opposing + 1µs)` holds under overlapping transactions and backward clock adjustment alike. Routing both transitions through functions is what makes the guarantee real: an ordering rule any caller can bypass with a raw `UPDATE` is not a guarantee.

---

## D-058 — Normative authorization text exists in exactly one place
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** The "Dry-run approval is a stored fact" section is **deleted**. "Launch authorization" in §10a is the sole normative specification, and operational rule 17 points at it rather than restating it. D-050 is marked superseded history that no normative text may cite.

**Rationale.** The superseded D-050 model survived alongside its replacement, so the document specified two mutually inconsistent authorization schemes at once — the old one still saying approval is a direct column write, that only `window_start` is checked, and that the canary is keyed on `livemode` alone. An implementer reading top to bottom would have found the obsolete section first. Duplication is how a corrected model silently reverts.

---

## D-059 — Approval is a function; approved evidence is frozen
**Date:** 2026-07-29 · **Status:** Approved · **Supersedes D-050's approval mechanism**

**Decision.** Direct `UPDATE` on `approved_by`/`approved_at` is withdrawn from every role. `finance.approve_dry_run(p_run_id, p_note)` validates all preconditions, sets `approved_by = auth.uid()` and `approved_at = clock_timestamp()` internally — neither is a parameter — and raises on re-approval. A trigger then freezes `status`, `error`, `finished_at`, `window_exhausted`, `window_start`, `window_end`, `livemode`, `implementation_version`, `dry_run`, all six report columns and both approval columns, **regardless of role**.

**Rationale.** A direct update let a founder write **another actor's id** into `approved_by` and any timestamp into `approved_at`, so the audit trail recorded what the caller typed rather than what happened. Worse, nothing froze the evidence: `service_role` retained `UPDATE` on the report columns, window and version, so the job could present a narrow clean report, obtain approval, and afterwards widen the window, swap the build, or rewrite the findings the founder actually read. An authorization whose subject can change after the fact authorizes nothing.

---

## D-060 — `implementation_version` is a deployed-build identifier read server-side
**Date:** 2026-07-29 · **Status:** Approved

**Decision.** The value is a CI-injected immutable build identifier — git commit SHA or container image digest — read from process configuration at run creation. It is never accepted from a request body, parameter, header or cookie, and never defaulted: an absent identifier fails run creation rather than substituting a placeholder. Every run records it. PR 3 proves a changed build cannot reuse an earlier authorization.

**Rationale.** The version equality check is only as trustworthy as the value's provenance. A caller-supplied label can be set to whatever unlocks an existing approval, which reduces the one field distinguishing "the build we rehearsed" from "some other build" to decoration. Defaulting to `'dev'` or `'unknown'` would collapse every environment into a single authorization scope. Redeploys are over-inclusive by design: an unnecessary re-approval costs one dry run, a missed one runs a changed job under a rehearsal it never performed.

---

## D-061 — `dedup_key` is generated; exception shape is enforced by `CHECK`
**Date:** 2026-07-29 · **Status:** Approved · **Tightens D-040 and D-054** · **Expression form corrected by D-063**

**Decision.** `reconciliation_exceptions.dedup_key` is a `GENERATED ALWAYS AS … STORED` column, so no writer can supply it. `provider_object_processing_failed` rows are constrained by `CHECK` to carry a non-null `provider_object_id`, a `detail.object_type` from the closed list `payment_intent | charge | refund | checkout_session`, and a `detail.error_class` from `malformed_object | object_not_found | object_scoped_bad_request`.

**Rationale.** D-040 called the key "deterministic and computed at write time" while nothing stopped a writer supplying a different one — and a writer that can choose `dedup_key` **defeats deduplication entirely**, inserting thousands of fresh rows per run with every constraint still passing. D-054's required fields were likewise asserted in prose and enforced nowhere, so an incomplete exception would have been accepted and its quarantine identity silently wrong. `GENERATED ALWAYS` and `CHECK` move both from convention to impossibility.


---

## D-062 — The monotonicity backstop must permit the untouched state
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-057**

**Decision.** The constraint is `CHECK (released_at IS NULL OR released_at <> quarantined_at)`. The separate rule that a non-null `released_at` requires a non-null `quarantined_at` is retained.

**Rationale.** D-057 specified `CHECK (released_at IS DISTINCT FROM quarantined_at)`. `NULL IS DISTINCT FROM NULL` evaluates to **false**, and every exception is inserted with both timestamps `NULL` — so the constraint would have **rejected every ordinary exception insert**, breaking the exceptions queue entirely rather than only its quarantine path. Verified against PostgreSQL 17.6: the old form returns `false` for the both-null case; the new form returns `true` there, `true` when quarantined with no release, `false` on equal non-null values, and `true` for correctly ordered release and re-quarantine.

**Consequence.** The backstop now constrains exactly what it was meant to — equality *after* a release — and is silent on states where one or both timestamps are absent.

---

## D-063 — The generated `dedup_key` expression enumerates every enum label
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-061** · **Made structurally enforced by D-066**

**Decision.** The generated expression uses an explicit `CASE` mapping each of the twelve `exception_kind` values to a text literal, rather than `kind::text`. Adding an enum value requires adding its `CASE` branch in the same migration. Declaring a wrapper function `IMMUTABLE` over `kind::text` is forbidden.

**Rationale.** D-061's expression **does not compile**. Generated columns require an `IMMUTABLE` expression, and enum-to-text is only `STABLE` because `ALTER TYPE … RENAME VALUE` can change the output for the same input. Confirmed on the live database (PostgreSQL 17.6): `enum_out(anyenum)` is `STABLE` in `pg_proc`, and a `CREATE TEMP TABLE … GENERATED ALWAYS AS (k::text) STORED` probe over an existing enum was rejected, while the `CASE` form was accepted, produced the canonical values, and rejected an `INSERT` supplying the column. A falsely-`IMMUTABLE` wrapper would satisfy the parser and then let a future label rename silently corrupt stored keys — every affected exception losing its identity and re-inserting as new.

**Consequence.** An unmapped enum value yields `NULL` through `||` and silently disables deduplication for that kind, so acceptance test 108 asserts every value maps to a non-null canonical key.

---

## D-064 — `quarantine_object()` validates state, and derives its own reason
**Date:** 2026-07-29 · **Status:** Approved · **Tightens D-057**

**Decision.** After locking, the function raises unless: `resolution_status = 'open'`; `kind = 'provider_object_processing_failed'`; the row is not already actively quarantined; `consecutive_failure_runs >= 3`; and `provider_object_id` plus a valid `detail.error_class` are present. `quarantine_reason` is derived internally from `detail.error_class`, and the function takes **no reason parameter**.

**Rationale.** D-057 guaranteed timestamp ordering and nothing about whether the row should be quarantined at all — a resolved exception, a wrong kind, an already-quarantined row, or an object on its *first* failure could all be quarantined, each silently stopping reconciliation of something that should still be examined. A caller-supplied reason could also contradict the row it describes, producing an audit trail worse than none. The threshold check is what makes release meaningful: a released row returns with a zero streak and cannot be re-quarantined until three fresh consecutive failures.

---

## D-065 — The freeze trigger keys on `OLD.approved_at`; `p_note` is stored
**Date:** 2026-07-29 · **Status:** Approved · **Completes D-059**

**Decision.** The freeze trigger rejects `UPDATE`s where **`OLD.approved_at IS NOT NULL`**, permitting exactly one `NULL →` internally-computed approval transition. `finance.approve_dry_run()` requires a non-blank `p_note` and stores it in a new `approval_note` column, which joins the frozen set.

**Rationale.** D-059 said the trigger freezes "a row with `approved_at IS NOT NULL`" without saying which tuple. Keyed on `NEW`, the approval `UPDATE` itself would see a non-null value and reject — **approval would be impossible**, the same shape as B-52's unexecutable quarantine release. Separately, `p_note` was a parameter no column stored and no behaviour used, so a founder's stated reason for accepting the evidence was silently discarded; the alternative was to drop the parameter, but the reason is worth keeping precisely because it is the human judgement the whole gate exists to capture.


---

## D-066 — The generated `dedup_key` is `NOT NULL`
**Date:** 2026-07-29 · **Status:** Approved · **Completes D-063**

**Decision.** `reconciliation_exceptions.dedup_key` is declared `text NOT NULL GENERATED ALWAYS AS (…) STORED`.

**Rationale.** D-063 explained that an `exception_kind` value omitted from the `CASE` yields `NULL` through `||`, and relied on acceptance test 108 to catch it. That leaves the invalid state **permitted by the table**: a row with no deduplication identity would insert successfully, silently disabling dedup for that entire kind — the failure D-040 exists to prevent, reachable by omitting one line in a future migration and skipping the suite. A test is defence in depth; the database must reject the state independently.

**Verified** against PostgreSQL 17.6 with a `TEMP` table and one label deliberately unmapped: the `NOT NULL GENERATED ALWAYS … STORED` definition was **accepted**; a mapped value inserted with a canonical key; the **unmapped value was rejected**; and an `INSERT` supplying the column was rejected.

---

## D-067 — Exception resolution is a founder-only function; attribution is internal
**Date:** 2026-07-29 · **Status:** Approved · **Completed at the `INSERT` boundary by D-068**

**Decision.** Direct `UPDATE` on `resolution_status`, `resolved_at`, `resolved_by` and `resolution_note` is withdrawn from **every** role. `finance.resolve_exception(p_exception_id, p_resolution, p_note)` — `SECURITY DEFINER`, fixed `search_path`, founder-gated, `EXECUTE` to `authenticated` — locks the row, requires current status `open`, accepts only `resolved` or `dismissed`, requires a non-blank note, sets `resolved_by = auth.uid()` and `resolved_at = clock_timestamp()` internally, and writes status and note atomically. Repeat resolution raises. Resolution is permitted while actively quarantined.

Table constraints make the intermediate states unreachable independently: `(resolved_at IS NULL) = (resolved_by IS NULL)`, `(resolution_status = 'open') = (resolved_at IS NULL)`, and a non-blank `resolution_note` once closed.

**Rationale.** This was the same attribution defect already fixed for dry-run approval in D-059, still present one table over. A founder-supplied request could name **another user** as the resolver, backdate the decision, reopen a closed exception, or edit a completed resolution — and resolution is a financial judgement about a discrepancy, so a false attribution is exactly as damaging here as on an approval. Making resolution terminal is deliberate: correcting a wrong resolution should be a visible, deliberate act, not an `UPDATE` that leaves no trace it happened.

**Consequence.** `finance.release_quarantine()` now writes a new `release_note` column rather than appending to `resolution_note`, so the two judgements keep separate columns with separate owners. Founder access to `reconciliation_exceptions` is `SELECT` only; every mutation is a function call.


---

## D-068 — `INSERT` is a protected transition wherever `UPDATE` is
**Date:** 2026-07-29 · **Status:** Approved · **Completes D-059, D-064 and D-067** · **Predicate corrected by D-070**

**Decision.** `service_role` loses table-wide `INSERT` on `finance.reconciliation_exceptions` and `finance.reconciliation_runs`, replaced by column-scoped grants that exclude every protected lifecycle column. Two `BEFORE INSERT` triggers enforce the same rule independently of privileges: a new exception must have `resolution_status = 'open'` **and the remaining eight** resolution, quarantine and release columns `NULL` (`quarantined_at`, `quarantine_reason`, `released_at`, `released_by`, `release_note`, `resolved_at`, `resolved_by`, `resolution_note`) — `resolution_status` is itself protected, is `NOT NULL` with default `'open'`, and so is asserted rather than required `NULL`; a new run must have `approved_by`, `approved_at` and `approval_note` all `NULL`. `authorized_by_run_id` remains insertable and is validated against a genuinely approved dry run. The resolution biconditional is completed with `(resolution_status = 'open') = (resolution_note IS NULL)`.

**Rationale.** Revoking `UPDATE` protects a transition only if the row cannot be **created** already in the destination state. With table-wide `INSERT`, `service_role` could insert an exception already `resolved` with an arbitrary resolver and backdated timestamp, already quarantined without reaching the three-failure threshold, or already released — and could insert a run already carrying `approved_by`, `approved_at`, `approval_note` and a completed report, then cite it through `authorized_by_run_id`. **The reconciliation job could manufacture its own authorization**, with `finance.approve_dry_run()` never called and the freeze trigger — which fires on `UPDATE` and keys on `OLD.approved_at` — never involved. Every guarantee D-059, D-064 and D-067 established was reachable around, by the one role that runs unattended.

The trigger is the load-bearing control and the grant is defence in depth, not the reverse: a grant can be widened by a later migration or bypassed by a table owner, and the guarantee has to survive that.

**Consequence.** Ordinary creation, the deduplicating upsert, streak updates, and all four lifecycle functions are unaffected — `SECURITY DEFINER` functions act with the owner's rights, not the caller's grants.

---

## D-069 — Agreement creation requires its initial lifecycle event, enforced at commit
**Date:** 2026-07-29 · **Status:** Approved · **Insertion order corrected by D-071**

**Decision.** A `DEFERRABLE INITIALLY DEFERRED` constraint trigger requires every `finance.agreements` row to have exactly one `agreement_lifecycle_events` row with `from_status IS NULL`, checked at commit.

**Rationale.** Found by the `INSERT`-bypass audit that B-69 and B-70 prompted. §4 claimed "no agreement can exist without a lifecycle" and §6 claimed current lifecycle "is never `NULL`", but both rested on everyone using `finance.create_agreement()` — while `service_role` holds `INSERT` and the PR 2 import legitimately creates agreements directly. A direct insert would leave `v_agreement_lifecycle` returning nothing for that agreement, quietly falsifying two stated invariants. Deferring to commit allows the agreement row to survive the instant between its own insert and its event's insert, without which the pair could not be created at all. It does **not** permit child-first insertion: `agreement_lifecycle_events.agreement_id` carries a non-deferrable foreign key to `agreements(id)`, and the transition trigger locks the parent, so the executable sequence is agreement first, then its initial event, then commit. The foreign key is deliberately left non-deferrable rather than relaxed to support an order nothing needs.

**Audit result.** All nine tables were checked for this class. Three were genuinely bypassable — `agreements`, `reconciliation_exceptions`, `reconciliation_runs` — and all three are fixed. The remaining six are not, and the distinction is stated in ARCHITECTURE §15: a transition is bypassable at `INSERT` exactly when it is gated **against** a role that also holds `INSERT`. Where `service_role` legitimately owns every transition on a table, inserting a row in a later state grants it nothing it does not already hold.


---

## D-070 — The exception `INSERT` predicate asserts `'open'` and requires eight NULLs
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-068**

**Decision.** The `BEFORE INSERT` trigger on `finance.reconciliation_exceptions` raises unless `resolution_status = 'open'` **and** the remaining **eight** protected columns are `NULL`: `quarantined_at`, `quarantine_reason`, `released_at`, `released_by`, `release_note`, `resolved_at`, `resolved_by`, `resolution_note`. The column-scoped `INSERT` grant continues to exclude all **nine**, so the database default supplies `'open'`.

**Rationale.** D-068 said a new exception must have `resolution_status = 'open'` *and* "all nine protected columns `NULL`" — but `resolution_status` is itself one of the nine. The predicate therefore demanded that one column be `'open'` and `NULL` simultaneously, which is unsatisfiable, so **every exception insert would have failed** and the queue would never have received a row. The same class as B-63's backstop: a rule that forbids the invalid state and the valid one together.

**Consequence.** The grant and the trigger deliberately differ in scope. The grant excludes `resolution_status` so no writer can choose it; the trigger asserts its value rather than its absence. Nine excluded, one asserted, eight required `NULL`.

---

## D-071 — Agreement and initial event insert parent-first; deferral is not reordering
**Date:** 2026-07-29 · **Status:** Approved · **Corrects D-069**

**Decision.** The executable sequence is: insert the agreement, insert its initial `draft` lifecycle event in the same transaction, commit; the deferred constraint trigger then verifies exactly one initial event. The foreign key from `agreement_lifecycle_events.agreement_id` to `agreements(id)` remains **non-deferrable**, and the transition trigger is unchanged.

**Rationale.** D-069 claimed the two rows could be inserted "in either order". They cannot: the foreign key is non-deferrable and is therefore checked immediately, so a child-first insert fails before deferral is ever consulted, and the transition trigger separately locks and validates the parent row. What deferral actually buys is narrower and still necessary — it lets the *completeness* check wait until commit, so the agreement row is not rejected in the instant between its own insert and its event's insert. Without it the pair could not be created at all.

**Consequence.** The foreign key is deliberately left non-deferrable and the transition trigger is not redesigned, because no caller needs child-first insertion and relaxing either would weaken a check to support an order nothing uses. Test 133b asserts child-first is rejected, so the distinction is enforced rather than merely described.


---

## D-072 — `finance.run_status` has five values; the §1 inventory row was stale
**Date:** 2026-07-30 · **Status:** Approved · **Reconciles ARCHITECTURE §1 with D-045**

**Decision.** `finance.run_status` is created with **five** values: `running`, `partial`, `completed`, `failed`, `abandoned`. `ARCHITECTURE.md` §1's enum inventory row is corrected to include `partial`, and `PR_PLAN.md` test 84 is corrected to state ten combinations — five valid, five rejected.

**Rationale.** PR 1 could not begin because the approved specification named two different value sets for one enum. §1's inventory row listed four values while §10a's normative definition, the run-state table, D-045 and PR_PLAN test 84 all named five. The inventory row is a summary that was never updated when D-045 added `partial`; every independent normative source agrees on five.

The choice was load-bearing rather than cosmetic. Without `partial`, a run stopping at a work ceiling must be recorded as `completed` — and since only a `completed` run advances the watermark (rule 1), the next window would start after everything the bounded run never reached. That is **exactly the B-46 defect**, reintroduced at the schema level by a stale documentation row.

**Test 84's arithmetic was also wrong.** Five statuses across two flag states is ten combinations, not eight: valid are `completed`+`true` plus each of the other four with `false`; rejected are `completed`+`false` plus each of the other four with `true`. Eight matched neither five values (ten combinations) nor four (eight combinations, four rejected).

**Consequence.** No behavioural change to the approved design — this records what D-045 already decided and removes the contradiction blocking implementation. The correction and its implementation ship atomically in PR 1.


---

## D-073 — Financial actors cannot be deleted; audit history outranks account removal
**Date:** 2026-07-30 · **Status:** Approved

**Decision.** `finance.agreements.created_by`, `agreement_amounts.actor_id`, `agreement_lifecycle_events.actor_id`, `ledger_entries.recorded_by`, `payment_links.created_by`/`revoked_by`, `reconciliation_exceptions.resolved_by`/`released_by` and `reconciliation_runs.approved_by` all reference `auth.users(id)` **`ON DELETE RESTRICT`**. Once any financial fact attributes to a user, that `auth.users` row cannot be deleted.

**Rationale.** An independent review flagged that this changes existing production behaviour: Supabase account deletion and GoTrue admin delete will begin failing for any user with financial history. That is the intended outcome, not an oversight. Every one of these columns exists to answer "who did this, and when" about money. `ON DELETE CASCADE` would erase the financial record along with the account; `SET NULL` would silently strip attribution from an append-only ledger that cannot be corrected by update. Both defeat the purpose of the column.

**Intended operational behaviour.** Account *deactivation* is the supported path for a departing user — revoke roles and sessions, leave the `auth.users` row in place. Hard deletion is available only for users with no financial attribution, which is the common case for members who never transacted. Where a hard delete is genuinely required for a user with history, it is a deliberate, reviewed operation: reassign or anonymise at the application layer first, with a decision entry, rather than weakening the foreign keys.

**Tested.** `05_guards.sql` asserts every finance → `auth.users` FK is `RESTRICT`, that deleting an actor with financial history is refused, and that a user with no attribution still deletes normally.


---

## D-074 — Requirement 70 distinguishes consumer projection from internal enforcement
**Date:** 2026-07-30 · **Status:** Approved · **Clarifies requirement 70**

**Decision.** `finance.v_agreement_lifecycle` is the **single consumer projection** of current lifecycle: every read by application code, reporting surface, view or function resolves through it. Exactly one **internal enforcement** derivation is additionally permitted — `finance.tg_lifecycle_transition()`, named explicitly — which reads the immutable events table directly to validate `from_status`. No third implementation may exist.

**Rationale.** The trigger cannot read the view. The view is `security_invoker`, so inside a `SECURITY DEFINER` trigger it would evaluate RLS as the calling member and could hide the very rows the validation depends on — a member could then drive an agreement through an illegal transition because the trigger could not see the current state. That is a strictly worse defect than the duplication, and `security_invoker` is preserved rather than weakened to accommodate it. The view is also created after the trigger in migration order.

Requirement 70 as originally written ("the only expression of current lifecycle") did not distinguish these two roles, so a correct implementation could not satisfy it literally. The distinction is projection versus enforcement, not an exemption.

**Constraints this places on both.** The trigger and the view **must use identical ordering and tie-breaking**: `occurred_at DESC, seq DESC`. If they diverge, enforcement and reporting disagree about the same agreement — the exact class of defect Financials V2 exists to remove. This is asserted by test, not by convention.

**Enforced by allowlist.** A static check fails if any object other than `v_agreement_lifecycle` and `tg_lifecycle_transition` derives lifecycle state from `agreement_lifecycle_events`, so a third implementation cannot appear silently.

## D-075 — The resolution boundary is execution identity, not a session variable

**Decision.** `finance.reconciliation_exceptions.resolution_status`, `resolved_at`,
`resolved_by` and `resolution_note` are writable only through
`finance.resolve_exception()`. Enforcement is layered:

1. no application role holds `UPDATE` on those columns, so a direct write fails
   the privilege check (42501) before any trigger runs;
2. `finance.tg_exception_resolution_guard()` rejects any remaining direct write
   whose `current_user` is not the owner of `finance.resolve_exception()`. The
   trigger function is **`SECURITY INVOKER`, deliberately**: as `SECURITY
   DEFINER` its `current_user` would be the trusted owner for *every* caller and
   the check would admit everyone — the first implementation had exactly that
   bug, undetected because probes died at the privilege layer before reaching
   the trigger. The trusted owner is resolved through the exact schema-qualified
   signature (`to_regprocedure('finance.resolve_exception(uuid,
   finance.exception_resolution, text)')`), so an overload or similarly named
   function cannot change which owner is trusted;
3. `finance.resolve_exception()` is `SECURITY DEFINER`, founder-gated, owned by
   the migration owner, with `search_path` pinned to `pg_catalog, public, finance`.

**Rejected alternative.** An earlier implementation gated the trigger on a
transaction-local GUC that `resolve_exception()` set. It was removed before
merge: any caller could set that GUC and write directly, so it was a documented
bypass rather than a boundary. No GUC gates any finance guard.

**Trusted administrative boundary.** Requirement 121 originally read "every
role". PostgreSQL cannot exclude a table's owner or a superuser from that table,
and `SECURITY DEFINER` presupposes a trusted owner. The requirement is therefore
scoped to application roles, and the owner is named as the administrative
boundary. Application roles must never be granted that identity, and no
application code path runs as it.

**Privileges are additive.** The column REVOKEs pin today's ACL; PostgreSQL has
no negative ACL, so a later table-wide `GRANT UPDATE` would re-confer the four
columns despite them. The durable protections are the identity trigger and the
gate: the behavioural suite widens the grant to `service_role` inside a
rolled-back transaction and proves the write then *reaches the trigger* and is
rejected by identity — so removing the trigger, or flipping it to
`SECURITY DEFINER`, fails the build even in a future where the ACL has drifted.

**How this is proven.** `07_completion.sql` asserts: founder succeeds through the
function; a non-founder is denied through the function; a founder's direct
`UPDATE` is denied; `service_role`'s direct `UPDATE` is denied; setting the name
of the removed GUC confers nothing; state is unchanged after every denied write;
and the trigger admits only the owner identity. `sabotage.sh` flips the trigger function to `SECURITY DEFINER` and the gate must fail. `sabotage.sh` additionally
removes the trigger and widens the grant, and the gate must fail in both cases.


## D-076 — The ARCHITECTURE §10 at-most-once index is created (9th partial unique index)

**Decision.** ARCHITECTURE §10 mandates a partial unique index on
`finance.stripe_events (event_type, object_id, livemode)` restricted to the four
terminal event types (`checkout.session.completed/expired`,
`payment_intent.succeeded/canceled`), but §15's inventory listed exactly eight
indexes (none on `stripe_events`) and requirement 89 asserted "all eight" — an
internal contradiction the Checkpoint B semantic review surfaced. Resolved by
**creating the index** (migration 0004). Requirement 89 now reads "nine",
requirement 100 cites the real index, and the prior assertion that
`stripe_events` carries PK-only ([A7-077]) is rewritten to expect PK + this
index. Enforces at-most-once for terminal Stripe events at the database layer
before PR 3 ingestion, rather than relying solely on application dedup.

**Also recorded here (Checkpoint B review remediations):**
- **R31 / L11 defect** — `ledger_l11_offline_livemode` CHECK added: external
  payments and imported money (`legacy_donation_id` present) must be
  `livemode = true`; only genuine Stripe test-mode entries may be
  `livemode = false`. Without it, founder-recorded real money entered as
  `livemode = false` silently dropped out of every canonical balance.
- **Quarantine/release identity guard** — `tg_exception_quarantine_guard`
  (SECURITY INVOKER, owner via exact `regprocedure`) added so the
  quarantine/release columns have the same D-075 execution-identity boundary as
  the resolution columns; a future table-wide GRANT can no longer let an
  application role forge a below-threshold quarantine directly.
- **`tg_link_claim_guard` → SECURITY INVOKER** — it makes no identity comparison
  and reads no other table, so DEFINER was pointless privilege.

## D-077 — Founder-authorised wipe of legacy financial data (supersedes P2-D1)

**Decision.** On 2026-08-13 (HST) the founder explicitly authorised deletion of all
legacy financial rows, stating that only two genuine participants had ever attended
and that their financial data would be re-entered by hand. Executed the same
session: `donations` 20 rows, `financial_commitments` 14, `payment_tokens` 3,
`payment_allocations` 0. `bookings` (11 rows) was deliberately preserved because its
content is operational booking status rather than financial history, and every row
recorded `$0` paid.

**This supersedes P2-D1**, recorded during PR 2 planning, which stated that no legacy
financial row would ever be deleted. P2-D1's reasoning — deletion is unrecoverable,
there is no importer to restore from, and the rows were inert because `finance` never
reads them — remains correct. The founder weighed it and chose deletion anyway, to
clear synthetic figures from the legacy dashboard before live activation. Recorded
here rather than silently applied.

**Evidence gathered before deleting**, which moved the earlier founder attestation
from testimony to observation:

- Every donation carrying a Stripe session used a test-mode session identifier; zero
  live-mode identifiers existed. Checkout Session ids are the only Stripe object type
  that encodes mode, so this is conclusive.
- No donation ever completed — all sessioned rows were `status = "pending"`.
- The two rows lacking any provider identifier were self-labelled in metadata as a
  pre-launch manual backfill, and both were already refunded.
- All donation rows belonged to the founder's own account, the organisation's own
  account, or one internal staff member. No external participant held one.

**Safeguards applied.** A full row-level archive was captured immediately before the
delete, held outside version control at mode `600` with its SHA-256 recorded. A
redacted, committable recovery record carrying no member identifiers, no email
addresses and no payment tokens is at `docs/financials-v2/PR2_WIPE_RECOVERY_REDACTED.md`.
Cascade behaviour was verified beforehand; post-delete counts were verified zero, and
the `finance` schema was confirmed untouched at zero state.

**Residual risk, stated plainly.** If any deleted row was genuine, the only
reconstruction source is the local archive. The evidence makes that unlikely, not
impossible. The archive must not be discarded.

## D-078 — The legacy Stripe integration is live and must be shut down before PR 3

**Finding.** PR 3's directive recorded that "Stripe is disconnected from the runtime
system." That was false. Verified 2026-08-13:

- The `stripe-webhook` Supabase Edge Function is deployed and **ACTIVE at version 9**.
- Four server paths create Stripe Checkout Sessions:
  `app/api/donations/create-session`, `app/api/donations/create-gift-session`,
  `app/api/payments/create-journey-session`, and the server component
  `app/pay/[token]/page.tsx`.
- Two runtimes hold credentials for the same Stripe account on different SDK versions:
  the Next.js app on `stripe@^22`, the Edge Function on `stripe@14.21.0`, both pinning
  request API version `2024-06-20`.
- The legacy flag `PAYMENT_PROVIDER` (`lib/payment-provider.ts`) **defaults to
  `"stripe"` when unset — it fails open**, contrary to the fail-closed requirement for
  financial flags.
- The Edge Function contains a self-heal path that **inserts** a `donations` row when
  one is missing, so a completing session recreates financial rows rather than no-oping.

**Consequence.** These paths write to `donations` and `financial_commitments`, which
D-077 just emptied. Any checkout initiated from the app would repopulate them and
restore synthetic figures to the legacy dashboard. PR 3 is therefore not "connect
Stripe" but "supersede a running payment integration."

**Decision.** The legacy Stripe integration is to be shut down fail-closed as a
narrowly scoped PR 2 closeout, before PR 3 preflight resumes. PR 3 remains BLOCKED
until that shutdown and the separate migration-history repair are complete and
reviewed.

## D-079 — PR 3 requires a mutation surface; `finance` is append-only to the app role

**Finding.** PR 3 was scoped as "application-layer work only", and an early revision
of `PR3_PREFLIGHT.md` asserted "PR 3 adds no schema". Both were wrong, and wrong for
the same reason: the tables existing was mistaken for the tables being writable.

Verified against production 2026-08-19. For `service_role` — the role every server
route runs as — the `finance` schema is deliberately append-only:

- **No table in `finance` grants `UPDATE` or `DELETE`** to `anon`, `authenticated`
  or `service_role`.
- `reconciliation_runs`, `reconciliation_exceptions`, `checkout_sessions` and
  `payment_links` grant `SELECT` only.
- `stripe_events`, `ledger_entries`, `agreements`, `agreement_amounts` and
  `agreement_lifecycle_events` grant `INSERT` and `SELECT`.
- The complete set of SECURITY DEFINER writers into `finance` is six functions:
  `approve_dry_run`, `create_agreement`, `quarantine_object`, `release_quarantine`,
  `resolve_exception`, `revoke_payment_link`. **None** creates a reconciliation run,
  advances run counters or the cursor, claims a `stripe_events` row, or raises an
  exception.

**Consequence.** Phase 1 ingestion is genuinely pure application work, because
`INSERT` on `stripe_events` is granted. Everything after it was not implementable as
specified: the claim/re-claim branch and stale-claim sweeper need `UPDATE` on
`stripe_events`; the §10a job needs `INSERT` **and** `UPDATE` on
`reconciliation_runs`; exception raising needs `INSERT` on
`reconciliation_exceptions`. Code written against them fails at runtime with
`permission denied` — not at review, and not in a way a mocked test would catch.

**Decision.** PR 3 adds one migration
(`20260820003000_finance_reconciliation_mutations.sql`) providing nine SECURITY
DEFINER functions and nothing more: `claim_stripe_events`, `complete_stripe_event`,
`sweep_stale_event_claims`, `start_reconciliation_run`,
`advance_reconciliation_run`, `finish_reconciliation_run`, `abandon_stale_runs`,
`raise_reconciliation_exception`, `reset_object_failure_streak`.

**Granting `UPDATE` to `service_role` was considered and rejected.** Note that
`service_role` already holds `BYPASSRLS`, so the RLS policies on these tables do not
constrain it — the grants are the only thing that does. Granting `UPDATE` would not
be a small relaxation; it would remove the sole remaining control and let any route
rewrite a run's approval evidence, window or counters. The run guards
(`tg_run_authorization`, `tg_run_freeze_approved`) are written on the assumption that
callers cannot do that.

**Authorization model.** The EXECUTE grant is the boundary, and the only one: every
function revokes from `PUBLIC` and grants solely to `service_role`. A role check
inside the bodies is deliberately absent — once execution enters a SECURITY DEFINER
function `current_user` is the owner for the whole call tree, so such a check would
inspect `postgres` and pass unconditionally. It would read as a safeguard while
enforcing nothing. Founder-only operations remain the existing functions, which
authorize via `is_founder()`; that works because it reads JWT claims rather than the
effective role.

**Hardening.** Every function pins `search_path`, validates inputs, and constrains
which state transitions it permits: only a `processing` event may be completed, only
a `running` run may advance or finish, only a `completed` run may report an exhausted
window (18b), counter deltas are additive and non-negative (D-049), and a failed
event or run must carry an error. The migration asserts all of this in the same
transaction that applies it, including that no `UPDATE`/`DELETE`/`TRUNCATE` grant
exists in `finance` afterwards.

**Two defects were found by executing the behaviour, not by reading the DDL**, and
both would have shipped otherwise:

1. `reconciliation_exceptions.detail` is `jsonb`, not `text`. The first version of
   `raise_reconciliation_exception` declared it `text` and failed with `42804` on
   every call. The static assertions all passed.
2. `exc_processing_failure_shape` (D-061) requires that a
   `provider_object_processing_failed` exception carry `provider_object_id` plus
   `detail.object_type` and `detail.error_class` drawn from fixed vocabularies. The
   function now validates this itself, turning an opaque `23514` into a message that
   names the offending field.

This is the same lesson D-078's review rounds recorded: a check that has never been
executed is a claim, not evidence.

## D-080 — The authoritative Stripe event subscription (resolves the "all events" contradiction)

**The contradiction.** `PR_PLAN.md` (PR 3) says ingestion covers "**all** Stripe
events into `finance.stripe_events`". `ARCHITECTURE.md` §10 instead enumerates four
event types, and §10a rule 7 names four **object** types reconciliation walks. Taken
naively these give three different answers to "what should the endpoint subscribe
to", and defaulting to "all events" would have settled it by accident.

**Resolution — the statements answer different questions.**

1. *What does the handler do with what arrives?* PR_PLAN's "all" governs this, and it
   is correct: the handler filters nothing. Filtering would discard an event Stripe
   had already committed to delivering, and D-078's lesson is that discarding
   provider events is the expensive mistake.

2. *What should the endpoint be subscribed to?* **Neither document states this.**
   ARCHITECTURE §10's four-type list is NOT the answer — it is the predicate of the
   partial unique index `stripe_events_terminal_at_most_once_uq` and governs
   deduplication, as D-056 says explicitly. §10's remark that "under-including a
   type costs nothing, while over-including one silently discards a real event" is
   about that index, not about subscription.

   The controlling requirement is therefore **§10a rule 7**: reconciliation
   enumerates *PaymentIntent, Charge, Refund and Checkout Session*. The subscription
   is the finance-relevant event types of exactly those four objects.

**Decision.** `lib/finance/stripe-event-types.ts` holds the single authoritative
list — **20 event types** across the four reconciled objects. The Stripe dashboard
configuration, the handler, this documentation and the automated tests all reference
that one file, so they cannot drift apart.

**Subscribing to every Stripe event is rejected.** It would record `customer.*`,
`invoice.*`, `product.*`, `payout.*` and similar types serving no requirement,
inflating a table that carries a 24-month retention obligation and diluting the
shadow signal PR 3 exists to produce. A test asserts each of those maps to no
reconciled object and is not subscribed.

**Enforced by tests, not by assertion:** every at-most-once type is subscribed (or
the index would defend a type never received); the at-most-once list matches the
index predicate exactly; `payment_intent.payment_failed` is subscribed but NOT
deduplicated (Stripe emits it per failed *attempt*, so two are legitimate for one
PaymentIntent — acceptance 18k); every subscribed type maps to a reconciled object;
every reconciled object is covered by at least one subscribed type; and
`charge.refund.updated` classifies as a Refund rather than a Charge, which prefix
order would otherwise get wrong.

**Handler behaviour on an unlisted type.** It is still recorded — question 1 above —
and logged as configuration drift. Silence would let the dashboard diverge from this
file unnoticed, which is the failure mode this decision exists to prevent.

## D-081 — A 23505 on `stripe_events` has two causes, and conflating them destroys data

**Finding.** PR 3A's ingestion route treated any `23505` as a duplicate delivery and
answered `200`. There are two distinct causes:

- `stripe_events_pkey` — the same `event_id` twice. Routine redelivery; the event is
  already recorded and `200` is correct.
- `stripe_events_terminal_at_most_once_uq` — a **different** event (different
  `event_id`) of a terminal type for the same object.

For the second, `200` acknowledges an event that was never stored, and Stripe then
stops retrying. That is exactly the hazard ARCHITECTURE §10 names — "over-including
one silently discards a real event" — reached through the handler rather than
through the index definition.

**Decision.** Classification keys on the **constraint name**, not the SQLSTATE. A
primary-key collision returns `200`; an at-most-once conflict returns `409` and logs
the event id, type and object id. A `23505` naming no recognised constraint is
treated as a conflict, not as benign — defaulting to "duplicate" would reintroduce
the silent discard by another route.

The `409` means Stripe retains the event and retries will keep colliding. That is
deliberate: a stuck, noisy event is recoverable by a human, a silently discarded one
is not. Reaching this state means either the at-most-once assumption is wrong for
that type or something upstream is genuinely duplicating, and both need a decision
rather than a default.
