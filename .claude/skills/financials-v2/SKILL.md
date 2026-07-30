---
name: financials-v2
description: Run one Financials V2 PR end to end — architect defines, implementer builds, reviewer inspects the real diff in a fresh context, corrections loop until clean. Use when working on any Financials V2 PR, or when asked to continue the financials work.
---

# Financials V2 — PR orchestration

One PR at a time, through three separated roles. The separation is the point: the person who defines the work does not build it, and the person who builds it does not judge it.

## Before anything

Read `docs/financials-v2/HANDOFF.md`. It states the current PR, the blockers, and the next action. Everything else follows from it.

**Do not skip to implementation because the task looks small.** The legacy system this replaces was built one reasonable small change at a time.

## The loop

### 1. Architect defines the current PR

Launch `financials-architect`. It produces a brief in `HANDOFF.md`: outcome, in scope, explicitly out of scope, numbered acceptance criteria, migration plan, rollout and rollback, risks.

Skip this step only when a current, unchanged brief already exists for the PR in flight.

### 2. Implementer builds exactly that PR

Launch `financials-implementer` with the brief. It changes **only** what the brief lists. Anything else it notices goes to `HANDOFF.md` as a future item.

It runs the tests and captures **real output**.

### 3. Reviewer inspects the actual diff, fresh

Launch `financials-reviewer` in a **new context** — it must not inherit the implementer's reasoning, or it will confirm the implementer's assumptions instead of testing them. Give it the base ref and the PR brief. It reads `git diff`, not the PR description.

It cannot edit files. It returns numbered findings, each **BLOCKING** or **NON-BLOCKING**, and a verdict.

### 4. Blocking findings return to the implementer

Send them back to `financials-implementer`. It fixes them and **reruns the full test suite**, not only the affected tests. It reports what changed with fresh output.

### 5. Re-review

Back to step 3, in a fresh context again. Loop until the reviewer returns **APPROVE**.

A finding is not resolved by arguing it away. If the implementer believes a finding is wrong, it must show why with a citation or a failing-then-passing test.

### 6. Update `HANDOFF.md`

**Every PR ends with a `HANDOFF.md` update** as the final commit: what shipped, what remains, new risks, next action. This is the whole memory of the project between sessions.

## Rules that hold regardless of what is asked

- **One PR accomplishes one defined outcome.** If it is not in `PR_PLAN.md`, stop and ask.
- **Scope expansion requires a `DECISIONS.md` entry and approval before the work is done** — not a note afterwards.
- **Database foundation precedes interface.**
- **The standing auto-merge authorization in `CLAUDE.md` does not apply to financial work.** Financial PRs are reviewed before merge, every time.
- **Every PR carries its own proof** — real test output, screenshots, migration evidence, security review, rollout and rollback.

## The invariants

Any step that violates one of these is wrong, however reasonable the request:

- V2 lives in the `finance` schema; no database object references a legacy financial table; no V2 write path touches legacy; legacy reads only in the named comparison surfaces of `ARCHITECTURE.md` §0a.
- The three fact tables are append-only. Corrections are attributed reversals.
- No derived financial value is stored. One definition per term, in `finance.v_agreement_balances`.
- Stripe-confirmed and founder-recorded money stay distinguishable by column.
- Integer cents. No floating point. No negative amount to a provider.

## When the reviewer and implementer deadlock

Stop the loop and surface both positions to the founder with the evidence each side offers. Do not merge a PR over an unresolved blocking finding, and do not silently downgrade a finding to non-blocking to clear the queue.
