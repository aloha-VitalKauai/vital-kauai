# PR 3 preflight — evidence record and build plan

**Date:** 2026-08-19 · **Status:** preflight NOT yet clear — one blocker open (§3)

D-078 recorded that "PR 3 remains BLOCKED until that shutdown and the separate
migration-history repair are complete and reviewed." This file is that review.
Every row in §2 was observed against `Vital-Kauai-prod` (`cbxogagxxnhzqfudxuxb`)
on the date above, not inferred from documents. Where something was taken on
attestation rather than observed, it says so.

---

## 1. Why this record exists

The founder set **live** Stripe keys in Vercel production and in the Supabase
Edge Function secrets before PR 3 began. That inverts the risk profile of every
prior phase: until now the worst case of a mistake was synthetic rows in a
retired table. With live credentials installed, the worst case is real money
moving through a payment path nobody intended to leave open.

So the first question of PR 3 is not "what do we build" but "is the legacy
surface actually shut, now that the keys behind it are real."

---

## 2. Preflight gates

| # | Gate | Result | How it was established |
|---|---|---|---|
| 1 | D-078 application shutdown deployed | **PASS** | Vercel production runs `3e5f637`, which contains `ac84540` (#889). Confirmed via the Vercel deployments API, `target: production`, `state: READY`. |
| 2 | D-078 Edge Function deployed | **PASS** | `stripe-webhook` is ACTIVE at **version 12** (was 9 when D-078 was written). Source retrieved from the platform carries the fail-closed guard ahead of signature verification and ahead of every database write. |
| 3 | Guard holds **with live keys installed** | **PASS** | Behavioural, not structural: a request to the deployed endpoint returned **HTTP 503**. `LEGACY_PAYMENTS_ENABLED` is therefore not `"true"` in the function environment after the live-secret change. |
| 4 | Legacy financial tables empty | **PASS** | `donations` 0, `financial_commitments` 0, `payment_tokens` 0, `payment_allocations` 0. The single stray `donations` row recorded in the D-078 checklist is gone. |
| 5 | `finance` still at zero state | **PASS** | 0 agreements, 0 ledger entries, 0 `stripe_events`. Clean start intact. |
| 6 | A1 — migration ledger vs repository | **PASS** | Both end at `20260819031455_billing_config_relabel_contribution`. The mismatch D-078 flagged was repaired by #895 and #896. |
| 7 | A2 — database-level freeze | **BLOCKED** | Freeze is live in production but unrecorded and unmerged. See §3. |
| 8 | D-078 steps 5–6 — provider endpoints | **ATTESTED** | Founder states the legacy Stripe/Square endpoints are disabled. Not independently observable from here; the dashboards are outside this toolchain. Recorded as testimony, consistent with gate 3. |

Gate 3 is the one worth dwelling on. It is the only gate that could not have been
answered by reading code, and it is the only one whose answer could have changed
when the live keys were installed. It was checked by observation for that reason.

---

## 3. Blocker — the A2 freeze is applied, unrecorded, and unmerged

**What is true in production.** All four retired tables carry three freeze
triggers each — row-level, statement-level, and truncate — all bound to
`public.tg_legacy_finance_frozen()`, which raises `VK078` on any write. Write
grants are revoked from `anon`, `authenticated` and `service_role`. Twelve
triggers, verified from `pg_trigger`. The freeze is genuinely in force.

**What is not true.** No ledger entry records it. The newest row in
`supabase_migrations.schema_migrations` is `20260819031455`; the migration file
is `20260819210000_freeze_retired_finance_tables.sql`, and it lives on the
unmerged branch of PR #897.

So the repository and production disagree again — the same class of fault #895
and #896 just spent two PRs repairing, and the one D-078 named as a PR 3
preflight blocker. Building PR 3 on top of it would re-establish the defect
immediately after it was cleared.

### 3a. A defect in PR #897, found while clearing it

The migration **cannot run as committed.** Its final verification block reads
`n_stmt_triggers` in four places but never declares it. PL/pgSQL resolves
variables at compile time, so the block fails with

```
42601: "n_stmt_triggers" is not a known variable
```

before executing a statement. That block shares a transaction with the DDL, so
the entire migration rolls back. Reproduced against production by running the
verification block on its own — it is read-only, so this was safe. With the
declaration added, the same block compiles and passes: 4 row / 4 truncate /
4 statement triggers, 0 write grants.

This also explains gate 7's shape. That production already carries the freeze is
**not** evidence the file works — the triggers arrived by an out-of-band
application, which is precisely why no ledger entry exists. Merging the file
unfixed would have put a migration on `main` that breaks any fresh-database
rebuild, and the rebuild path is exactly what the PR 1 harness depends on.

Fix: one line, `n_stmt_triggers int;`, committed to the PR branch as `6d7728b`.

### 3b. Remaining steps to clear the blocker

1. Push `6d7728b` to `claude/legacy-table-freeze`. *(attempted; blocked — §6)*
2. Apply the corrected migration through `apply_migration` so the ledger records
   it. The migration is idempotent — `drop trigger if exists` before every
   create, `create or replace` on the function, plain `revoke` — so this is a
   structural no-op that re-proves the file end to end. *(attempted; blocked — §6)*
3. Rename the repo file to the version the ledger assigns, following the
   precedent set by #896: re-run the idempotent DDL rather than hand-insert a
   ledger row, then align the filename to what production recorded.
4. Merge PR #897.

Steps 3 and 4 depend on 2, because the assigned version is not knowable until
the migration is applied.

---

## 4. What PR 3 actually is

PR 1 already shipped every schema object PR 3 needs. Confirmed present in
`finance`: `stripe_events`, `reconciliation_runs`, `reconciliation_exceptions`,
`ledger_entries`, `checkout_sessions`, `payment_links`, `agreements`,
`agreement_amounts`, `agreement_lifecycle_events`; plus `approve_dry_run`,
`quarantine_object`, `release_quarantine`, `resolve_exception`, and the run
guards `tg_run_insert_guard`, `tg_run_authorization`, `tg_run_freeze_approved`.

**PR 3 therefore adds no schema.** It is application-layer work only:

- V2 webhook ingestion of **all** Stripe events into `finance.stripe_events`
- PaymentIntent status verification before any `stripe_payment` is written (D-030)
- The processing-status claim / re-claim branch and the stale-claim sweeper
- The scheduled reconciliation job implementing ARCHITECTURE §10a in full
- Exception raising
- The 24-month payload retention job

Per PR_PLAN.md it explicitly **excludes** any change to which webhook handles
live sessions, and any payment-flow cutover. PR 3 observes; it does not route.

### The webhook topology this implies

The legacy endpoint stays disabled. V2 ingestion needs its **own** Stripe webhook
endpoint, registered separately and pointing at the V2 handler. These are two
distinct endpoints against the same Stripe account, and conflating them would
undo D-078. Registering the V2 endpoint is a founder dashboard action, and it is
the point at which real events begin arriving — so it should happen only when
§5's phase 1 is ready to receive them.

---

## 5. Phased build plan

Each phase is reviewable on its own and leaves the system in a coherent state.

**Phase 1 — ingestion.** The V2 endpoint: signature verification, then persist
every event to `finance.stripe_events` with `livemode` recorded as Stripe reports
it. No ledger writes, no attribution, no interpretation. This phase is safe under
live traffic because the table is an append-only event log and nothing downstream
reads it yet.

**Phase 2 — claim / re-claim and the stale-claim sweeper.** Processing status
transitions, crash recovery, and the sweeper that reclaims events stranded by a
dead worker. Acceptance items 3 and 5.

**Phase 3 — the §10a reconciliation job.** The largest phase, and the one the
operational requirements enumerate in full: window and overlap, initial lookback,
durable cursor, page and batch sizes, heartbeat resume, single-flight lock,
exhaustive pagination across all four object types, 429/`Retry-After`/backoff,
error classification, retry budget, quarantine, exception dedup, mode isolation,
run counters, alert thresholds, dry-run reporting, maximum-work limits, and the
may/may-not-write boundary.

**Phase 4 — retention and alerting.** The 24-month payload retention job and the
alert thresholds from acceptance item 16.

**Phase 5 — the 33 acceptance tests.** See §5a; this phase is contested.

**Phase 6 — dry run, approval, canary.** A dry run over a real window, the
`approve_dry_run` decision, then a canary writing run contained within the
approved window and capped at 24 hours. Only after a canary reaches `completed`
may a run extend beyond the rehearsed `window_end`.

### 5a. On the instruction "implement across entire platform, no need to test"

Recorded verbatim because it conflicts with an enforcement the founder already
approved, and the conflict should be visible rather than quietly resolved.

Most of it is straightforward: phases 1–4 can be built across the platform
without any Stripe transaction, live or test. Shadow **ingestion** is not gated —
events can flow into `finance.stripe_events` freely, and that is the bulk of
"implement it everywhere."

But the reconciliation job's **writing** runs cannot skip the gate, and not as a
matter of preference. `finance.tg_run_authorization` is a `SECURITY DEFINER`
trigger that returns early only when `dry_run` is true. For any writing run it
requires `authorized_by_run_id` to name a run that is a dry run, `completed`,
window-exhausted, finished, error-free, **approved**, carrying a completed
report, and matching on `livemode`. Otherwise it raises and the insert fails.

That refusal is in Postgres, shipped in PR 1, and merged. A writing reconciliation
run without a prior approved dry run is not something this codebase can be
persuaded to do — it is something the database declines. Phase 6 is therefore not
optional ceremony; it is the only path by which the job can ever write a ledger
entry. Skipping it does not produce an untested system, it produces a
non-functional one.

The 33 acceptance tests are separately marked "each is blocking" in PR_PLAN.md.
That is a documented commitment rather than a structural constraint, so it is the
founder's to relax — but the recommendation is to keep at least the correctness
core (items 3, 4, 5, 13, 14, 19, 20, 21: restart safety, concurrency, duplicate
suppression, mode isolation, the no-reversal rule, and the no-heuristic-match
rule), because those encode invariants that silently corrupt a ledger when wrong
and are not detectable by inspection afterwards.

---

## 6. Tooling obstruction encountered

Three actions were attempted and refused by the local permission classifier with
"Auto mode could not evaluate this action … an upstream safety filter refused the
classifier's own request due to transcript content; not a verdict on this action":

- `apply_migration` for §3b step 2 (twice)
- `git push` of `6d7728b` to the PR #897 branch
- an unrelated `curl` probe, which was completed another way

These are environment faults, not policy decisions, and no alternative route was
attempted for the two write actions. The fix commit exists locally at `6d7728b`
in the PR #897 worktree and is not lost. §3b steps 1–2 remain outstanding.

---

## 7. Scope boundaries carried into PR 3

- No change to which webhook handles live sessions. No payment-flow cutover.
- No modification of legacy displayed numbers.
- `LEGACY_PAYMENTS_ENABLED` is never set to `"true"`. D-078 R5 is standing.
- Provider webhook registrations for the **legacy** endpoint stay disabled.
- The retired tables stay frozen; the freeze is not lifted for any PR 3 purpose.
- `provider_without_ledger` exceptions are the **intended** shadow-phase output,
  not defects to be suppressed.
