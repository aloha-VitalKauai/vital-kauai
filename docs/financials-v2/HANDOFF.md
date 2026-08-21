# Financials V2 — Handoff

**Updated:** 2026-08-21 · **Updated by:** PR 4 preflight
**Protocol:** every Financials V2 PR updates this file as its final commit. It is the first document read when picking the work back up.

---

## Current status

**Phase:** PR 5 — founder financial controls. **Implemented.** PR 4 shipped before it (#904). PR 5 detail under the corrected scope (D-082): clean-start banner, canonical V2 positions with no legacy columns, exceptions queue with resolve/dismiss/release through the database functions, quarantine, health and recent runs, at `/dashboard/financials/verification`.

| PR | Outcome | State |
|---|---|---|
| 0 | Architecture and project-control documents | **Merged** `aa32694` |
| 1 | `finance` schema foundation | **Merged** `c76f209` (#839). 140/140 requirements proven; deployed to production 2026-08-03 |
| 2 | **Clean-start activation** (NOT the importer PR_PLAN describes) | **Complete.** See §"PR 2 was rescoped" |
| 3 | Stripe shadow ingestion + §10a reconciliation | **Merged and DEPLOYED** — 3A `bcda54c`, 3B `76112ba`, 3C `92d0486`, canary fix `0724a7c` |
| 4 | Founder-only verification workspace | **Preflight done** — `PR4_PREFLIGHT.md` |
| 5–9 | See [PR_PLAN.md](PR_PLAN.md) | Not started |

## PR 2 was rescoped — PR_PLAN is stale on this point

`PR_PLAN.md` still describes PR 2 as a two-pass importer producing "a per-member
variance report against legacy figures". **That was never built.** PR 2 became
Clean-Start Activation: the founder attested no genuine historical financial record
existed, and D-077 subsequently wiped the legacy financial tables entirely.

Consequence for PR 4: the variance artifact PR 4 was designed to display **does not
exist**, and no trustworthy historical financial reference survives. PR 4 renders an
honest *reference-unavailable* state rather than synthesising a comparison. Full
evidence in `PR4_PREFLIGHT.md`.

## What is live in production

- **`finance` schema is PRIVATE.** It is not exposed to PostgREST. All application
  access goes through the **`finance_api`** façade — SECURITY INVOKER throughout, so
  it adds no privilege and the underlying grants and RLS still authorise.
- **V2 Stripe ingestion is live.** Endpoint `financials-v2-shadow`
  (`we_1U6kwIKBySbdp3Q1Klr1wEhu`) at `/api/finance/stripe-webhook`, 20 event types,
  Snapshot payloads, signature enforced (a forged signature is rejected with zero
  rows written).
- **Reconciliation runs hourly** (`/api/cron/finance-reconcile`, always a dry run).
  The **worker, sweepers and 24-month retention** run every 10 minutes
  (`/api/cron/finance-worker`).
- **Founder control** at `/dashboard/financials/reconciliation`: review a dry-run
  report, approve it on the founder's own session, start the canary.
- **Legacy payment surface is shut** (D-078) and the retired tables are frozen at the
  database level (12 `VK078` triggers, write grants revoked).

## Decisions added since PR 1

| | |
|---|---|
| **D-077** | Founder-authorised wipe of legacy financial data. Supersedes P2-D1 |
| **D-078** | Legacy Stripe integration shut down fail-closed |
| **D-079** | `finance` is append-only to the app role; PR 3 adds SECURITY DEFINER mutation functions rather than grants |
| **D-080** | The authoritative 20-event Stripe subscription; "all events" resolved |
| **D-081** | A `23505` on `stripe_events` has two causes and conflating them destroys data |

## Standing constraints

- **Never expose `finance`** to PostgREST. Expose only `finance_api`.
- **Never set `LEGACY_PAYMENTS_ENABLED=true`** (D-078 R5), and never roll back to a
  pre-guard build.
- The retired tables stay frozen and empty.
- Founder identity and timestamps on financial actions are **database-generated**;
  no route may supply them, and no role holds direct `UPDATE` on resolution or
  quarantine columns.

## PR 5 (this PR)

Founder financial controls, mounted inside the member-profile Financials tab.
Five SECURITY DEFINER functions (create-with-Contribution, amend, external
payment, reversal, lifecycle transition) with finance_api SECURITY INVOKER
wrappers; D-083 database-enforced idempotency for external payments
(ledger_entries.idempotency_key + partial unique index). Reusable
V2FinancialPanel component (app/components/dashboard/financials/) built to the
Vital Kauaʻi design language for PR 7 to mount unchanged. Booking payment
editing (payment_status / amount_due / amount_paid) RETIRED from
BookingStatusSection — booking operations remain, financial truth lives only in
V2. Legacy FinancialRecordsCard and MemberFinancialSection are no longer
rendered (files intact for the D-078 test suite). "Collect remaining balance"
deliberately absent — that becomes functional in PR 6.

## PR 6 (this PR)

The checkout protocol per PR6_BUILD_SPEC: hashed single-use links, three-phase
attempt (claim -> durable attempt -> Stripe Session with a self-derived
deterministic idempotency key), one payable Session per (agreement, livemode),
verified payment_intent.succeeded -> exactly one stripe_payment via
record_v2_stripe_payment (idempotent on payment intent + mode), Collect drawer +
link strip in V2FinancialPanel, /contribute/[token] bridge and thank-you page
with canonical confirmation, orphaned-claim sweeper on the worker cron. The V2
checkout Stripe client pins 2026-03-25.dahlia (STRIPE_V2_API_VERSION in
lib/finance/checkout.ts), matching the live destination.

Rollout state: founder issuance is behind FINANCE_V2_CHECKOUT_READY (unset =
fail closed). Revocation, status, the bridge and the worker paths are live.

## PR 7 (this PR)

/dashboard/financials replaced with the V2-only Founder Financial Command Center
per PR7_BUILD_SPEC and D-084 (no legacy fallback, no financial read flag).
Migration 20260821180000: finance_api.founder_financial_overview and
founder_payment_activity — security_invoker + security_barrier, explicit
is_founder() boundary, granted to authenticated only, verified as all four roles
rolled-back (member sees zero rows; anon/service hold no grant; the retired-table
dependency check is asserted in-transaction). The retired
financials_overview/cohort_margin_summary/private_ceremony_summary reads and the
Cohort/Private margin tabs left the page. Expenses/payouts mutations reused
unchanged. Checkout state reported truthfully: links paused unless
FINANCE_V2_CHECKOUT_READY === "true" (still unset).

## Next action

PR 6 closeout (controlled live-mode exercise, two remaining sweeper drivers,
bounded review, then FINANCE_V2_CHECKOUT_READY=true). Then PR 8.

## Blockers

**B-1 and B-2 are both closed.** PR 0 was approved and merged at `aa32694`.

### B-1 — CLOSED by live evidence (D-038)
Verified read-only against `Vital-Kauai-prod` on 2026-07-29. `uq_members_profile_id` **already exists** (`UNIQUE (profile_id) WHERE profile_id IS NOT NULL`); 0 duplicate groups; 0 rows with `profile_id IS NULL`; **2 of 17 rows with `id <> profile_id`**; PostgreSQL 17.6. `finance.current_member_id()` is single-valued today and **PR 1 adds no index**.

The two divergent rows validate D-015 against production: 12% of members would silently return no financial data under a `member_id = auth.uid()` policy.

### B-2 — CLOSED
Independent review returned APPROVE at `86a767a`; PR #838 merged as `aa32694`.

### B-74 — CLOSED
True multi-session concurrency tests implemented and passing (11 assertions) for requirements 21, 35, 37, 50 and 101. The earlier list wrongly named 42 and 48; corrected above.

### B-77 — CLOSED
Resolved by **D-074**, which distinguishes the single consumer projection (`v_agreement_lifecycle`) from exactly one named internal enforcement derivation (`tg_lifecycle_transition`). `security_invoker` is preserved on the view. Both derivations are asserted to use identical `occurred_at DESC, seq DESC` ordering, and a static allowlist fails if any third object derives lifecycle state. Requirement 70 is amended accordingly.


### B-75 — CLOSED
Executable coverage is **140/140**, script-verified by `supabase/tests/coverage_map.py`. Raised from 93 by writing real assertions, not relabelling. The two `pass()` placeholders and one hardcoded `true` static check that briefly stood in for requirements 96, 97 and 1/3 were **replaced with real assertions**, and the missing launch-authorization trigger they were standing in for was implemented.


### B-76 — CLOSED
Read-only production inspection completed 2026-07-30 against `Vital-Kauai-prod`. PostgreSQL **17.6**; **zero** `finance` schema objects or types (no collision); `is_founder() returns boolean`, `SECURITY DEFINER`, `STABLE`, `proconfig NOT_SET`, owner `postgres`; `members.id`/`members.profile_id`/`journeys.id`/`auth.users.id` all `uuid`; `uq_members_profile_id` present; roles `anon, authenticated, postgres, service_role, supabase_admin`; `members` owned by `postgres` and migrations run as `postgres`. Nothing was applied.


### B-72 … B-73 — Seventh independent BLOCK: two unsatisfiable specifications (resolved, pending re-review)

Both were rules that could not be executed as written — the same class as B-52 and B-63.

| ID | Finding | Resolution |
|---|---|---|
| B-72 | The exception `INSERT` predicate demanded `resolution_status = 'open'` **and** "all nine protected columns `NULL`" — but `resolution_status` is one of the nine, so it had to be `'open'` and `NULL` at once. **Every exception insert would have failed.** | Trigger asserts `'open'` for that column and requires the **other eight** `NULL`; the grant still excludes all nine so the default supplies `'open'` (D-070) |
| B-73 | §4, D-069 and test 133 claimed the agreement and its initial event could insert "in either order" — impossible, since the child's foreign key is non-deferrable and the transition trigger locks the parent | Parent-first sequence specified; deferral scoped to what it actually buys; FK left non-deferrable; test 133b asserts child-first is rejected (D-071) |

### B-69 … B-71 — Sixth independent BLOCK: `INSERT`-time bypass (resolved)

Revoking `UPDATE` protects a transition only if the row cannot be **created** already in the destination state.

| ID | Finding | Resolution |
|---|---|---|
| B-69 | `service_role` held table-wide `INSERT` on `reconciliation_exceptions`, so it could create a row already resolved with an arbitrary resolver, already quarantined below threshold, or already released | Column-scoped `INSERT` excluding all nine protected columns, plus a `BEFORE INSERT` trigger asserting `resolution_status = 'open'` and the **other eight** protected columns `NULL`; resolution biconditional completed (D-068, predicate corrected by D-070) |
| B-70 | Same on `reconciliation_runs` — the job could insert a run already approved with a completed report, then cite it. The freeze trigger fires on `UPDATE` and never saw it, so **`approve_dry_run()` was not the only approval path** | Column-scoped `INSERT` excluding approval and report columns, plus a `BEFORE INSERT` trigger; `authorized_by_run_id` stays insertable and validated (D-068) |
| B-71 | **Found by the requested audit.** `agreements` claimed no agreement can exist without a lifecycle, but `service_role` inserts agreements during the PR 2 import and a direct insert left none | `DEFERRABLE INITIALLY DEFERRED` constraint trigger checked at commit (D-069) |

**Audit of all nine tables** is in ARCHITECTURE §15. Three were genuinely bypassable and are fixed; six are not, because `service_role` legitimately owns every transition on them.

### B-67 … B-68 — Fifth independent BLOCK: structural enforcement and resolution attribution (resolved)

| ID | Finding | Resolution |
|---|---|---|
| B-67 | The `CASE` omission was explained and test-detected, but the table still **permitted** a `NULL` `dedup_key` — a row with no dedup identity would insert and silently disable dedup for that kind | Column declared `NOT NULL GENERATED ALWAYS … STORED`. Verified live: definition accepted, mapped value canonical, **unmapped value rejected**, writer override rejected (D-066) |
| B-68 | Founder held direct `UPDATE` on the four resolution columns — the same attribution defect fixed for approval in D-059, still present one table over. A request could name another resolver, backdate the decision, reopen a closed exception, or edit a completed resolution | `finance.resolve_exception()` — founder-only, locked, `open`-only, target restricted to `resolved`/`dismissed`, non-blank note, actor and timestamp internal, terminal. Direct `UPDATE` withdrawn from **every** role; biconditional constraints make partial states unreachable; `release_note` separated from `resolution_note` (D-067) |

### B-63 … B-66 — Fourth independent BLOCK: constraint and platform executability (resolved)

Every one of these would have failed at migration time or first insert. Two were verified empirically against the live PostgreSQL 17.6 rather than reasoned about.

| ID | Finding | Resolution |
|---|---|---|
| B-63 | `CHECK (released_at IS DISTINCT FROM quarantined_at)` is **false when both are NULL**, so **every ordinary exception insert would be rejected** | `CHECK (released_at IS NULL OR released_at <> quarantined_at)`. Truth table verified live: both-null passes, quarantined-only passes, equal non-null fails, ordered states pass (D-062) |
| B-64 | `kind::text` in a generated column **does not compile** — enum-to-text is `STABLE`, not `IMMUTABLE` | Explicit `CASE` over all twelve labels. Verified live: `enum_out` is `STABLE`; the cast form was **rejected**; the `CASE` form was **accepted**, canonical, and writer-proof (D-063) |
| B-65 | `quarantine_object()` guaranteed ordering but could quarantine a resolved row, a wrong kind, an already-quarantined row, or an object on its first failure | Five locked preconditions; `quarantine_reason` derived from the row's own `detail.error_class`; reason parameter removed (D-064) |
| B-66 | Freeze trigger keyed on the wrong tuple would have made approval itself impossible; `p_note` was stored nowhere | Trigger keys on **`OLD.approved_at`**, permitting exactly one transition; `approval_note` added, required non-blank, and frozen (D-065) |

### B-58 … B-62 — Third independent BLOCK: transition integrity (resolved)

| ID | Finding | Resolution |
|---|---|---|
| B-58 | `now()` is fixed at transaction start, so an overlapping transaction could write quarantine timestamps in the wrong order — a release could succeed and leave the object quarantined | Both transitions run through functions using `GREATEST(clock_timestamp(), opposing + 1µs)` under `FOR UPDATE`; no role holds a direct `UPDATE`; equality backstopped by `CHECK`; two-session test 101 (D-057) |
| B-59 | The superseded D-050 approval section survived beside its replacement, specifying a contradictory model | Section **deleted**; §10a "Launch authorization" is the sole normative text; rule 17 points at it; D-050 marked history no normative text may cite (D-058) |
| B-60 | Approval attribution was spoofable and approved evidence mutable — `service_role` could rewrite the report, window or version after approval | `finance.approve_dry_run()` sets actor and timestamp internally and refuses re-approval; a trigger freezes 17 evidence fields regardless of role (D-059) |
| B-61 | `implementation_version` was an unverified caller label | CI-injected commit SHA or image digest, read server-side, never from request input, never defaulted (D-060) |
| B-62 | `dedup_key` was writer-supplied and the exception shape was prose-only | `GENERATED ALWAYS AS … STORED`; `CHECK`-enforced object type and error class from closed lists (D-061) |

### B-52 … B-57 — Second independent BLOCK: executability of the state machine (resolved)

| ID | Finding | Resolution |
|---|---|---|
| B-52 | **Quarantine release was impossible** — clearing `quarantined_at` violated its own `CHECK`, and the grants gave the founder neither the columns nor a path | Quarantine history retained; active state **derived** from `quarantined_at` vs `released_at`; founder-only `finance.release_quarantine()` releases and resets atomically (D-051) |
| B-53 | A **running, partial or failed** dry run could authorize money-writing reconciliation; "covers the window" constrained only `window_start` | Authorizing run must be completed, exhausted, finished, error-free, approved and reported. Renamed **launch authorization**: mode + earliest horizon + implementation version, with a contained 24-hour canary (D-052) |
| B-54 | Dry-run output was unreviewable — real-write counters are `0` by definition, so approval rested on two zeros | Bounded, sanitized, deterministic report columns; approval impossible without `report_completed_at`; real counters keep their D-049 meaning (D-053) |
| B-55 | Object-terminal failures had no `exception_kind`, and `reconciliation_run_failed` is run-scoped | `provider_object_processing_failed` with dedup, detail, streak and recovery rules (D-054) |
| B-56 | `window_exhausted` was constrained in one direction only | `CHECK ((status = 'completed') = window_exhausted)`; all five statuses tested in both flag states (D-055) |
| B-57 | `payment_intent.payment_failed` is emitted **per attempt**, so the index would discard a legitimate retry failure | List cut from seven to **four** object-terminal states; two unprovable async types also removed (D-056) |

### B-44 … B-51 — Independent review, verdict BLOCK (resolved)

The reconciliation state machine was reviewed as one system. Every finding was a real gap between what the documents promised and what they could express.

| ID | Finding | Resolution |
|---|---|---|
| B-44 | `is_founder()` hardening was ownerless — PR 1 would build founder RLS on an unhardened `SECURITY DEFINER` boundary | **Assigned to PR 1** (D-044). The earlier risk explanation was **wrong** and is corrected: the body is schema-qualified, so `search_path` cannot redirect `public.user_roles`; the real concern is operator resolution and future edits |
| B-45 | Resume lineage was described but not representable | `resumed_from_run_id` with status, self-reference, window and one-resumer-per-predecessor constraints; `finished_at` consistency enforced for every status (D-046) |
| B-46 | "Completed but unfinished" would **permanently skip** Stripe objects | New `partial` status; `completed` requires `window_exhausted`; only `completed` advances the watermark (D-045) |
| B-47 | Grant named a nonexistent `counters` column | Six counter columns enumerated; approval and release columns added; both-directions grant test (D-043 amended) |
| B-48 | Quarantine was unimplementable — nothing counted, held or identified failures across runs | State on the exception row keyed by `dedup_key`; streak rules, reset, founder-only release (D-047) |
| B-49 | PR 3 test 3 contradicted rule 14 by demanding no object be examined twice | Test rewritten to page-boundary restart with no duplicate ledger entry or exception; counter meaning defined (D-049) |
| B-50 | Run-fatal and object-terminal errors were conflated — a 401 would be skipped as one bad object | Four error classes; 401/403/invalid-list ends the run `failed` with cursor intact (D-048) |
| B-51 | Dry-run approval was stated but unenforced | Persisted approval, cited authorization, window and mode validation, 24-hour canary, founder-only grant. *(D-050 — since fully superseded by D-052 and D-059.)* |

### B-31 … B-43 — Operational readiness review (resolved)

An eighth review asked what happens when reconciliation first runs against real Stripe data, finds ~4,000 mismatches, is interrupted, overlaps a scheduled run, hits 429s and timeouts, and is rerun. **Zero of twenty operational points were defined.**

| ID | Finding | Resolution |
|---|---|---|
| B-31 | Live PR description stale — revision 3, 73 tests, D-032, five passes | Rewritten in full against the final documents and SHA |
| B-32 | Test 31 stated L11 as "event **or session**" with no session join path; test 74 duplicated it correctly | Single event-based spec at 31; duplicate removed; count re-verified by script |
| B-33 | Exceptions had no dedup identity — ~4,000 rows re-inserted every run | `dedup_key` + partial unique index on open rows, upsert-on-rediscovery, occurrence counting (D-040) |
| B-34 | The job had nowhere to store a cursor, run id or lock | `finance.reconciliation_runs` as table 9, created in PR 1 (D-041) |
| B-35 | "Never self-corrects" contradicted reconciliation issuing reversals | Ingest/correct boundary: may ingest verified provider money, may never reverse or resolve (D-039) |
| B-36 | `service_role` could not update an exception, so recurrence could only re-insert | Column-scoped `UPDATE` grant added |
| B-37 | "Reconciliation matching" was a ledger write path defined by a phrase | Identity-only matching, no heuristics (D-042) |
| B-38 | PR 3 had no acceptance tests | 21 added |
| B-39 | Exhaustive pagination required only for Refunds and Sessions | Required for all four object types |
| B-40 | No `exception_kind` for operational failure | `reconciliation_run_failed` added |
| B-41 | Retention job scheduled with no operational spec | Covered by §10a's batch and concurrency rules |
| B-42 | PR template asked nothing a scheduled job would fail | Re-entrancy, retry and observability questions added |
| B-43 | Reviewer remit had no re-entrancy coverage | Added to the reviewer agent and skill |

All twenty operational points are now specified in ARCHITECTURE §10a.

### B-22 … B-30 — PR 1 executability review (resolved)

A clean-context review asked one question: *could a competent engineer write PR 1's migration and tests from these documents alone?* The answer was **no** — the documents read as complete while being unbuildable. Nine blockers, six of them pure documentation gaps.

| ID | Blocker | Resolution |
|---|---|---|
| B-22 | `payment_links` had a bare column list — no types, nullability or FK targets | Full DDL with status CHECKs (§12) |
| B-23 | The journey FK target was never named — only "canonical journey record" | **`public.journeys(id)`**, confirmed by `20260505000000:30` |
| B-24 | `is_founder()` unspecified: no signature, and no statement of where founder-ness is stored | **V2 reuses the existing `public.is_founder()`** — a `user_roles` lookup already used by live RLS. A second predicate would be a second place to drift (D-037) |
| B-25 | `create_agreement()` had no signature, authorization, or initial `to_status` | Full spec; initial event is always `draft` (§15) |
| B-26 | The lifecycle transition graph was undefined beyond "terminals are terminal" | Complete graph, including why `fulfilled → active` is permitted (§6) |
| B-27 | **L11 was unenforceable** — it required `livemode` to match "the originating event or session" while no column joined a ledger row to either | `origin_stripe_event_id` added to `ledger_entries` (§7) |
| B-28 | The terminal event-type list was an `e.g.`, which cannot become an index predicate | Closed, enumerated list of seven types (§10) |
| B-29 | RLS was principles, not policies | Full per-table × per-role matrix (§15) |
| B-30 | Views, functions, grants, PG version and test framework unspecified | §15 "PR 1 implementation specification": view column lists, function specs, column-scoped grants, PG15 baseline, pgTAP |

Minors also fixed: `is_reversed` cannot sit in a `FILTER` clause (LATERAL/CTE note), `payment_state` needs an explicit cast, partial uniqueness is an index not a constraint, three tests marked as reviewer checks rather than pgTAP assertions, stale text flagged inline in D-026 and D-029, and the test count corrected.

### B-16 … B-21 — Third external review, Stripe boundary (resolved)

| ID | Finding | Resolution |
|---|---|---|
| B-16 | A crash after link claim but before the attempt insert stranded the link permanently; "inside the idempotency window" is also not a testable condition | Orphaned-claim sweeper restores after a 15-minute TTL (safe — Stripe was never called); replay bounded by a **fixed 23-hour cutoff**; out-of-window search must paginate to exhaustion (D-035) |
| B-17 | Reusing an `open` Session can charge an obsolete amount after an amendment or another payment | Reuse only when agreement, amount, currency, livemode and **current** payable Remaining all match; otherwise expire at Stripe, **confirm**, then free the slot. Unconfirmed expiry blocks checkout and raises `stale_session_expiry_failed` (D-034) |
| B-18 | Session metadata does not propagate to the PaymentIntent, so `payment_intent.succeeded` could not be attributed | Metadata written to **both** `metadata` and `payment_intent_data.metadata`; PR 6 tests a PaymentIntent webhook arriving alone (D-033) |
| B-19 | The one-live-Session index on `(agreement_id)` let a test Session block live checkout | Keyed on `(agreement_id, livemode)` (D-034) |
| B-20 | Test 29 and the L3 commentary demanded a human `recorded_by`, contradicting L12/D-032 and blocking legacy import | Both now require exactly one attribution, human **or** system (D-036) |
| B-21 | Nothing forbade contradictory provenance — a Stripe entry could carry `external_method`, an external entry a `pi_…` | **L13** mutual-exclusion checks; `legacy_donation_id` exempt as traceability (D-036) |

### B-10 … B-15 — Second external review of PR #838 (resolved)

| ID | Finding | Resolution |
|---|---|---|
| B-10 | Checkout recovery unsafe — Stripe has no retrieve-by-idempotency-key, and keys expire (~24h), so a later replay could create a second payable Session | Replay only inside the window; otherwise resolve by `attempt_id` metadata search. **Ambiguous state is never auto-released or auto-replayed** (D-028) |
| B-11 | Two links, or a link plus the portal, could each open a payable Session for the same Remaining | Partial unique index: at most one `creating`/`open` Session per agreement; existing URL returned instead; stale-session expiry frees the slot (D-029) |
| B-12 | What creates a `stripe_payment` was never stated; `checkout.session.completed` alone is insufficient | Only a **verified `succeeded` PaymentIntent** writes a payment entry (D-030) |
| B-13 | L3 permitted a Stripe refund with no `re_…` id, and L8's index is partial — so duplicates were possible despite D-025 | L3 requires provenance complete for its source; L3b constrains the parent type (D-031) |
| B-14 | PR description's lower sections were stale (ten enums, 62 tests, D-001–D-023, three passes) | Description fully rewritten, not banner-patched |
| B-15 | A real `auth.users` account as system actor makes migrations depend on an environment-specific Auth user | `recorded_by_system` enum instead — no login required, portable across environments (D-032) |

### B-3 … B-9 — First external review of PR #838 (resolved)
All seven are resolved and listed here for the re-reviewer to confirm.

| ID | Finding | Resolution |
|---|---|---|
| B-3 | `PR_PLAN` said nine enums and omitted `v_agreement_lifecycle` from PR 1's contents | Enum and view counts now stated consistently in both documents (thirteen enums, nine tables, five views as of B-34); test 4 covers both |
| B-4 | A reversed refund left the member marked `refunded` | `refunded_cents` counts **unreversed** refunds only; test 65 |
| B-5 | Payment-link design assumed Stripe and Postgres share one transaction | Replaced by a persisted three-phase attempt with a deterministic Stripe idempotency key and a sweeper (D-024) |
| B-6 | Refund statuses, failed refunds and list pagination unmodelled | Only `succeeded` refunds enter the ledger; regression raises an exception; enumeration is paginated (D-025) |
| B-7 | Founder-recorded refunds and reversals could be saved without actor or reason | L12 requires reason plus exactly one attribution, on `source='external'` or any reversal (D-026, mechanism corrected by D-032) |
| B-8 | Grants omitted `service_role`, which the webhook requires | Explicit grant table including `service_role`, with no fact-table `UPDATE`/`DELETE` (D-027) |
| B-9 | D-016 named four legacy-read surfaces then said three | Corrected to four; a duplicated sentence in ARCHITECTURE §0a also removed |

## Open risks

Monitored, not blocking.

### R-1 — Exposed GitHub personal access token
A GitHub PAT is embedded in plaintext in the repository's git remote URL. This is a repository-security issue independent of Financials V2 and independent of Stripe. **The token should be rotated.**

*Scope note: the Stripe credentials encountered during the audit were not live credentials. The live Stripe account is not compromised and is not part of this risk.*

### R-2 — Uncommitted work on `claude/audit-fixes`
That branch carries 32 modified files, roughly 12 untracked files, and 7 unpushed commits. Several modified files touch financial routes that V2 will replace — `create-journey-session`, `email-link`, `generate-link`, `pay/[token]`, `donations/create-*`. Per D-002 this work is untouched by Financials V2 and remains outstanding. Findings observed only in that tree are marked `[DIRTY]` in [AUDIT.md](AUDIT.md) and carry no design weight.

### R-3 — Legacy baseline schema is un-versioned
The legacy money tables exist only in the live project. V2 is unaffected by design (D-001), but legacy behaviour cannot be fully reviewed from the repository. **Shadow comparison in PRs 3 and 4 therefore carries more evidentiary weight than code reading** — behaviour is settled by observed figures, not inference.

### R-5 — CLOSED, reassigned to PR 1 (D-044)
`public.is_founder()` is `SECURITY DEFINER` with no pinned `search_path` (`proconfig` NULL, confirmed live). **PR 1 now owns the fix** — `ALTER FUNCTION public.is_founder() SET search_path = pg_catalog, public;` — executed before any policy depends on it, with a test asserting `proconfig` afterwards.

**The original R-5 wording was inaccurate** and is corrected in D-044: the function body schema-qualifies `public.user_roles` and `auth.uid()`, so `search_path` cannot redirect those relations. The genuine concerns are unqualified operator resolution inside a `SECURITY DEFINER` context, and the absence of protection against a future edit introducing an unqualified reference.

### R-6 — Duplicate index on `members.profile_id`
Both `idx_members_profile_id` and `uq_members_profile_id` exist with the same predicate; the non-unique one is redundant. Harmless, minor write cost. Not V2's to fix.

### R-4 — Variance is expected at import
V2 figures will differ from currently displayed figures wherever a legacy `adjust-collected` adjustment was applied (D-003), and historic refunds now import too (D-021). This is intended. The founder should expect some numbers to move when the shadow page first appears; PR 2's variance report explains each one.

## Future items

Noticed during audit or design, deliberately not folded into any current PR.

- **`journey_email_log` identity mismatch.** Its `member_id` references `members(id)` while its member RLS policy compares `member_id = auth.uid()` — the same defect two migrations already repaired elsewhere. It works only while `members.id` happens to equal `auth.uid()`. Not owned by Financials V2.
- **`app/portal/labs/page.tsx` references `members.auth_user_id`**, a column appearing nowhere else in the repository, silently falling back to `user.id`.
- **`lib/auth/founder-check.ts` uses a hardcoded `FOUNDER_IDS` array** while the database has `public.is_founder()`. V2 uses the database predicate; the application path is not V2's to fix but is the same drift risk.
- **Legacy Square scaffolding**, including a self-heal path inserting a donation with a hardcoded all-zeroes `member_id`. Dormant, but a hazard if the provider flag is ever flipped.

## Decisions carried forward

D-001 … D-074 recorded. **D-014 is resolved by D-015.** **D-008's ordering clause is superseded by D-022**; its remaining clauses stand. **D-011's single-transaction mechanism is superseded by D-024**, whose recovery mechanism is in turn **corrected by D-028**. **D-026's system-actor mechanism is corrected by D-032.** **D-028 is refined by D-035**, **D-029 by D-034**, **D-013's founder-predicate clause is superseded by D-037**, **D-043's rules 10, 17 and 18 are corrected by D-048, D-050 and D-045**, **D-047's release mechanism by D-051**, **D-050 by D-052**, **D-045 tightened by D-055**, **D-043's event list by D-056**, **D-051's timestamp mechanism by D-057**, **D-050 fully superseded by D-052 and D-059**, **D-040/D-054 tightened by D-061**, **D-057's backstop corrected by D-062 and preconditions added by D-064**, **D-061's expression corrected by D-063**, **D-059 completed by D-065**, **D-063 made structurally enforced by D-066**, **D-059/D-064/D-067 completed at the `INSERT` boundary by D-068**, **D-068's predicate corrected by D-070**, and **D-069's insertion order corrected by D-071**. No decision is open. See [DECISIONS.md](DECISIONS.md).

## Working agreement

- One PR accomplishes one defined outcome.
- Database foundation precedes interface.
- Every financial term has exactly one definition.
- Recorded financial facts are append-only; errors are corrected by attributed reversal.
- Legacy financial code is reference material only; legacy reads occur solely in the named comparison surfaces; legacy routes remain until the new path is proven.
- Scope expansion requires a `DECISIONS.md` entry and approval before work begins.
- The standing auto-merge authorization in `CLAUDE.md` does not apply to financial work.
- Every PR ends with an updated `HANDOFF.md`.
