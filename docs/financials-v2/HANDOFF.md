# Financials V2 — Handoff

**Updated:** 2026-07-29 · **Updated by:** PR 0
**Protocol:** every Financials V2 PR updates this file as its final commit. It is the first document read when picking the work back up.

---

## Current status

**Phase:** PR 0 — architecture and project-control documents.
**State:** **PR 0 is not approved.** Documents written and revised across eight review passes: an adversarial model review (29 findings, 9 blockers), an internal-consistency check (9 defects, 3 blockers), a first external review of PR #838 (7 findings, B-3 … B-9), a clean-context re-verification (1 blocker, 6 minors), a second external review (6 findings, B-10 … B-15), a third external review at the Stripe boundary (6 findings, B-16 … B-21), a PR 1 executability review (9 blockers, 8 minors — B-22 … B-30), and an operational readiness review (7 blockers, 6 minors — **zero of twenty operational points defined**, B-31 … B-43). All resolved. Awaiting independent re-review.

The clean-context pass caught a defect introduced by the B-7 fix itself: L12 originally defined "provider-originated" as `source='stripe' AND provider_object_id IS NOT NULL`, which contradicted L1 and D-020 — a Stripe payment imported without a charge-object id would have demanded a human actor that no document assigned. L12 now keys on `source` alone.

| PR | Outcome | State |
|---|---|---|
| 0 | Architecture and project-control documents | **In review** |
| 1 | `finance` schema foundation | Blocked — **B-2 only** (B-1 closed by D-038) |
| 2–9 | See [PR_PLAN.md](PR_PLAN.md) | Not started |

## Next action

Independent reviewer confirms the PR 0 documents contain **no unresolved contradiction in the financial model**. PR 1 does not begin until that confirmation is recorded here.

## Blockers

**B-2 is the only remaining blocker.** B-1 is closed.

### B-1 — CLOSED by live evidence (D-038)
Verified read-only against `Vital-Kauai-prod` on 2026-07-29. `uq_members_profile_id` **already exists** (`UNIQUE (profile_id) WHERE profile_id IS NOT NULL`); 0 duplicate groups; 0 rows with `profile_id IS NULL`; **2 of 17 rows with `id <> profile_id`**; PostgreSQL 17.6. `finance.current_member_id()` is single-valued today and **PR 1 adds no index**.

The two divergent rows validate D-015 against production: 12% of members would silently return no financial data under a `member_id = auth.uid()` policy.

### B-2 — PR 0 review not yet complete (blocks PR 1)
Per the working agreement, implementation waits on reviewer confirmation that the documents contain no unresolved contradiction in the financial model. **PR 0 is explicitly not approved.**

### B-31 … B-43 — Operational readiness review (resolved, pending re-review)

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

### R-5 — `public.is_founder()` has no `SET search_path`
Its live definition is `SECURITY DEFINER` without a pinned `search_path` — the shape ARCHITECTURE §9 forbids for every V2 function. A caller able to influence `search_path` may resolve `public.user_roles` to an object they control. V2 inherits this exposure because every founder policy calls it.

**Fix:** `ALTER FUNCTION public.is_founder() SET search_path = pg_catalog, public;` — a one-line change to an existing object, **outside PR 0's documentation-only scope**. Not owned by Financials V2, but V2 depends on it.

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

D-001 … D-043 recorded. **D-014 is resolved by D-015.** **D-008's ordering clause is superseded by D-022**; its remaining clauses stand. **D-011's single-transaction mechanism is superseded by D-024**, whose recovery mechanism is in turn **corrected by D-028**. **D-026's system-actor mechanism is corrected by D-032.** **D-028 is refined by D-035**, **D-029 by D-034**, and **D-013's founder-predicate clause is superseded by D-037**. No decision is open. See [DECISIONS.md](DECISIONS.md).

## Working agreement

- One PR accomplishes one defined outcome.
- Database foundation precedes interface.
- Every financial term has exactly one definition.
- Recorded financial facts are append-only; errors are corrected by attributed reversal.
- Legacy financial code is reference material only; legacy reads occur solely in the named comparison surfaces; legacy routes remain until the new path is proven.
- Scope expansion requires a `DECISIONS.md` entry and approval before work begins.
- The standing auto-merge authorization in `CLAUDE.md` does not apply to financial work.
- Every PR ends with an updated `HANDOFF.md`.
