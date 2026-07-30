# Summary

<!-- One paragraph: what this PR does and why. -->

**Roadmap item:** <!-- e.g. Financials V2 PR 1. If this work is not on a roadmap, stop and get approval first. -->

## Scope

**In scope:**

**Explicitly out of scope:**

<!-- Scope expansion requires a DECISIONS.md entry and approval BEFORE the work is done. -->

## Tests

<!-- What was tested and how. Paste real output — not a description of output. Say plainly if something was skipped or is failing. -->

## Screenshots

<!-- Before and after for any visible change. Write "No visible change" if none. -->

## Migrations

- [ ] No migration in this PR
- [ ] Migration included

**If included:**
- Additive only? <!-- Any destructive operation needs explicit justification. -->
- Applies cleanly to a fresh database?
- Backfill required, and how verified?
- Rows affected:
- Apply order relative to the code in this PR:

## Security review

- Authorization: who can call the new paths, and what enforces it?
- RLS: which policies apply; is any table left unprotected?
- Secrets: confirm none added to the repository.
- Input validation and amounts: confirm no client-supplied amount is trusted.
- PII: what is stored, who can read it, how long is it retained?

## Rollout plan

<!-- Ordered steps. Feature flags and their default state. Who does what, when. -->

## Rollback plan

<!-- Exact steps to revert, including data. If rollback is not clean, say so explicitly and explain the residue. -->

---

## Financial work

Complete this section for any change touching money. Delete it otherwise.

- [ ] I read `docs/financials-v2/PRODUCT_SPEC.md`, `ARCHITECTURE.md` and `HANDOFF.md` before starting.
- [ ] No `finance` database object references a legacy financial table, and this change writes no legacy table. Any legacy **read** is inside a comparison surface named in `ARCHITECTURE.md` §0a.
- [ ] No derived financial value is stored in a table.
- [ ] The three fact tables (`ledger_entries`, `agreement_amounts`, `agreement_lifecycle_events`) remain append-only — no `UPDATE` or `DELETE` path was added against them.
- [ ] Every financial term keeps its single definition; no formula was re-implemented outside `finance.v_agreement_balances`.
- [ ] Every aggregate is `COALESCE`d — `SUM` over zero rows returns `NULL`, not `0`.
- [ ] Stripe-confirmed and founder-recorded money remain distinguishable by column, not by `metadata` convention.
- [ ] No negative or `NULL` amount can reach a payment provider.
- [ ] Amounts are integer cents; no floating-point arithmetic was introduced.
- [ ] `DECISIONS.md` records any architecture change.
- [ ] `HANDOFF.md` is updated as the final commit.

### Scheduled or background work

Complete this block if the change adds or alters a job, sweeper, webhook handler, or anything else that runs unattended. Delete it otherwise.

- [ ] **Re-entrant** — safe to interrupt and rerun; a rerun over already-processed input creates nothing new.
- [ ] **Single-flight or safely concurrent** — two overlapping runs cannot both act.
- [ ] **Resumable** — durable cursor or checkpoint; a mid-run crash or deploy does not lose or repeat work.
- [ ] **Bounded** — maximum work per run stated, so one run cannot exhaust execution time or an API quota.
- [ ] **Rate limits and failures handled** — 429/`Retry-After`, backoff with a cap, retry budget, and transient vs terminal vs ambiguous classification.
- [ ] **Writes are deduplicated by identity**, not by "check then insert".
- [ ] **Observable** — run id, counts and duration recorded; failure is distinguishable from a clean run.
- [ ] **Alert thresholds stated**, distinguishing expected volume from operational failure.
- [ ] **Terminal states are honest** — a bounded or interrupted stop is a distinct, resumable state and does not report completion; any watermark advances only on genuine completion.
- [ ] **Every column named in a `GRANT` exists** in the migration, and the grant test proves permitted updates succeed as well as forbidden ones failing.
- [ ] **Every lifecycle is executable** — for each state a row can enter, the exit transition satisfies every `CHECK` and some role actually holds the columns or function needed to perform it. Tested by walking the full cycle, including re-entry.
- [ ] **Provider event cardinality is cited, not assumed** — any dedup index over provider events names the semantics making that event at-most-once per object rather than per attempt.
