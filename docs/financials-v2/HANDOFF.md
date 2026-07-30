# Financials V2 — Handoff

**Updated:** 2026-07-29 · **Updated by:** PR 0
**Protocol:** every Financials V2 PR updates this file as its final commit. It is the first document read when picking the work back up.

---

## Current status

**Phase:** PR 0 — architecture and project-control documents.
**State:** Documents written. Three review passes run: an adversarial model review (29 findings, 9 blockers) and an internal-consistency check (9 defects, 3 blockers). All resolved. Awaiting independent review.

| PR | Outcome | State |
|---|---|---|
| 0 | Architecture and project-control documents | **In review** |
| 1 | `finance` schema foundation | Blocked — B-1, B-2 |
| 2–9 | See [PR_PLAN.md](PR_PLAN.md) | Not started |

## Next action

Independent reviewer confirms the PR 0 documents contain **no unresolved contradiction in the financial model**. PR 1 does not begin until that confirmation is recorded here.

## Blockers

Both must clear before PR 1 begins.

### B-1 — `members.profile_id` uniqueness is unverified (blocks a PR 1 migration detail)
The identity **design** is settled: `finance.agreements.member_id` references `public.members(id)`, and the authenticated member resolves through `members.profile_id = auth.uid()` inside `finance.current_member_id()` (D-015). What remains unverified is whether `members.profile_id` carries a unique constraint — required for that function to be single-valued — and how many production rows have `profile_id IS NULL` or `id <> profile_id`. The base schema is not in version control, so this must be confirmed against the live database.

**Blocks:** creation of `finance.current_member_id()` and every member RLS policy depending on it. It does not block the architecture.
**Resolution:** PR 1 confirms both, adds a unique index after verifying no duplicates if none exists, and records the answer as a superseding `DECISIONS.md` entry.

### B-2 — PR 0 review not yet complete (blocks PR 1)
Per the working agreement, implementation waits on reviewer confirmation that the documents contain no unresolved contradiction in the financial model.

## Open risks

Monitored, not blocking.

### R-1 — Exposed GitHub personal access token
A GitHub PAT is embedded in plaintext in the repository's git remote URL. This is a repository-security issue independent of Financials V2 and independent of Stripe. **The token should be rotated.**

*Scope note: the Stripe credentials encountered during the audit were not live credentials. The live Stripe account is not compromised and is not part of this risk.*

### R-2 — Uncommitted work on `claude/audit-fixes`
That branch carries 32 modified files, roughly 12 untracked files, and 7 unpushed commits. Several modified files touch financial routes that V2 will replace — `create-journey-session`, `email-link`, `generate-link`, `pay/[token]`, `donations/create-*`. Per D-002 this work is untouched by Financials V2 and remains outstanding. Findings observed only in that tree are marked `[DIRTY]` in [AUDIT.md](AUDIT.md) and carry no design weight.

### R-3 — Legacy baseline schema is un-versioned
The legacy money tables exist only in the live project. V2 is unaffected by design (D-001), but legacy behaviour cannot be fully reviewed from the repository. **Shadow comparison in PRs 3 and 4 therefore carries more evidentiary weight than code reading** — behaviour is settled by observed figures, not inference.

### R-4 — Variance is expected at import
V2 figures will differ from currently displayed figures wherever a legacy `adjust-collected` adjustment was applied (D-003), and historic refunds now import too (D-021). This is intended. The founder should expect some numbers to move when the shadow page first appears; PR 2's variance report explains each one.

## Future items

Noticed during audit or design, deliberately not folded into any current PR.

- **`journey_email_log` identity mismatch.** Its `member_id` references `members(id)` while its member RLS policy compares `member_id = auth.uid()` — the same defect two migrations already repaired elsewhere. It works only while `members.id` happens to equal `auth.uid()`. Not owned by Financials V2.
- **`app/portal/labs/page.tsx` references `members.auth_user_id`**, a column appearing nowhere else in the repository, silently falling back to `user.id`.
- **Legacy Square scaffolding**, including a self-heal path inserting a donation with a hardcoded all-zeroes `member_id`. Dormant, but a hazard if the provider flag is ever flipped.

## Decisions carried forward

D-001 … D-023 recorded. **D-014 is resolved by D-015.** **D-008's ordering clause is superseded by D-022**; its remaining clauses stand. No decision is open. See [DECISIONS.md](DECISIONS.md).

## Working agreement

- One PR accomplishes one defined outcome.
- Database foundation precedes interface.
- Every financial term has exactly one definition.
- Recorded financial facts are append-only; errors are corrected by attributed reversal.
- Legacy financial code is reference material only; legacy reads occur solely in the named comparison surfaces; legacy routes remain until the new path is proven.
- Scope expansion requires a `DECISIONS.md` entry and approval before work begins.
- The standing auto-merge authorization in `CLAUDE.md` does not apply to financial work.
- Every PR ends with an updated `HANDOFF.md`.
