# Vital Kauaʻi — Claude operating notes

## Consistency over novelty

**Before creating a new abstraction, helper, component, data-access
pattern, role check, type, or styling convention, search the repository
for the existing canonical pattern and reuse it. If two patterns already
exist, do not introduce a third — pick the one that is more common and
say so in the PR description.**

**When touching legacy code, improve only the part required for the
current feature.** Do not perform broad cleanup unless the cleanup is the
explicit PR objective. "While I'm here" refactors make review harder and
hide the real change.

Corollaries worth stating outright:

- **Database row types come from `lib/database.types.ts`**, which is
  generated from the production schema. Do not hand-write an `interface
  Member`, `Profile`, `Journey`, or similar that mirrors a table — import
  the generated `Tables<'members'>` instead. Regenerate with
  `npm run db:types` after any migration and commit the result in the
  same PR as the migration.
- **A failed read is never a zero.** Distinguish "unknown" from "0" /
  "none" / "empty" in every surface, not just financial ones. Never let
  an error path fall through to data that looks valid.
- **High-integrity rules live in Postgres**, as constraints, RLS
  policies, or views — not in React. If correctness depends on it, the
  database enforces it.
- **One PR, one outcome.** Foundation → integration → UI, as separate
  PRs. State in the description what the PR changes, what it
  deliberately does not change, and how it was verified.

Run `npm run typecheck` and `npm test` before opening a PR.

## Working with Rachel

Rachel is a founder of Vital Kauaʻi. When she asks for a change on this
repository, the default flow is:

1. Make the change on the designated working branch.
2. Commit with a clear message.
3. Push the branch.
4. Open a PR if one isn't already open.
5. **Merge the PR to `main` and let Vercel deploy to production** — without
   asking for confirmation.

This standing authorization covers the normal feature/copy/UI/content-edit
path. It does **not** cover:

- Destructive git operations (force-push, `reset --hard`, branch deletion,
  history rewrite) — still confirm each time.
- Edits to payment, auth, Supabase schema, or Stripe configuration — flag
  the blast radius before shipping. Money changes are additionally
  governed by **Financial work** below.
- Public-facing legal/medical copy where the words matter clinically
  (informed consent, contraindications, dosage claims) — draft, but pause
  for review before merging.
- Actions that send messages to members or outside parties on Rachel's
  behalf (SMS, email campaigns, posts) — always confirm.

If a change is cosmetic, copy-level, internal-dashboard-only, or otherwise
low-risk, proceed straight through merge + deploy.

## Financial work

**Any change touching money — contributions, payments, refunds, Stripe,
ledger, balances, or the figures shown on financial screens — is governed
by `docs/financials-v2/`. Read `PRODUCT_SPEC.md`, `ARCHITECTURE.md` and
`HANDOFF.md` before making the change, not after.**

The standing merge authorization above does **not** apply to financial
work. Financial PRs are reviewed before merge, every time.

Binding rules:

- **One PR, one defined outcome.** If the work is not in
  `docs/financials-v2/PR_PLAN.md`, stop and ask. Scope expansion needs a
  `DECISIONS.md` entry and approval *before* the work is done.
- **Database foundation precedes interface.**
- **V2 lives in the `finance` schema.** No `finance` database object may
  reference a legacy financial table — `donations`,
  `financial_commitments`, `payment_allocations`, or `bookings` money
  columns. No V2 code path may **write** one. Legacy **reads** are
  permitted only in the named comparison surfaces listed in
  `ARCHITECTURE.md` §0a. Legacy financial code is reference material
  only; read it to understand history, never extend it.
- **The three fact tables are append-only** — `ledger_entries`,
  `agreement_amounts`, `agreement_lifecycle_events`. Never `UPDATE` or
  `DELETE` them. A mistake is fixed by inserting an attributed reversal,
  then the correct entry. (`stripe_events`, `checkout_sessions`,
  `payment_links` and `reconciliation_exceptions` carry no financial
  truth and take bounded updates by design.)
- **Never store a derived financial value.** Contribution, Received,
  Remaining, Payable Remaining and payment state have exactly one
  definition each, and the calculations live in
  `finance.v_agreement_balances`. Do not re-implement a formula in a
  route, component, or second view.
- **Stripe-confirmed and founder-recorded money stay distinguishable** —
  via first-class columns, never a `metadata` convention.
- **Amounts are integer cents.** No floating point in any financial path.
  Never send a negative amount to a payment provider.
- **Every architecture change is recorded in `DECISIONS.md`**, and
  **every financial PR ends with an updated `HANDOFF.md`.**

Every financial PR carries its own proof: tests with real output,
screenshots, migration evidence, security review, rollout plan and
rollback plan. See `.github/pull_request_template.md`.

## Branch conventions

- Feature branches are named `claude/<short-slug>-<random>` and already
  assigned at session start. Push to the assigned branch.
- `main` is the production branch; Vercel auto-deploys on merge.
- Squash-merge PRs to keep `main` linear.

## Stack context

- Next.js App Router; pages live under `app/`.
- Dashboard routes under `app/dashboard/` are behind founder auth via
  `app/dashboard/layout.tsx`.
- Top-nav tabs are configured in `app/dashboard/DashboardTabs.tsx`.
- Shared dashboard components live in `components/dashboard/`.
- Supabase server/client helpers in `lib/supabase/`.
- Generated database types in `lib/database.types.ts` — see
  **Consistency over novelty** above. Currently covers the `public`
  schema only; the `finance_api` schema is not yet generated, so
  `.schema("finance_api")` calls remain untyped.
- Deployment: Vercel, connected to GitHub.

## Content conventions

- Use Hawaiian orthography: `Kauaʻi` (with ʻokina), `Kauaʻi`-based, etc.
- Do not use "shaman" or "trip" — prefer guide / holder / practitioner
  and journey / ceremony.
- **Iboga is a "plant ally" or "the root", used interchangeably as the
  sentence wants — not "the medicine".** Prefer "root" where the plant is
  physical or ingested ("metabolize the root", "the root meets you in the
  dark"), and "plant ally" where the relationship is the point ("a powerful
  and intelligent plant ally"). The word "medicine" still stands where it
  means something else: the medical field ("naturopathic medicine", "what
  medicine believes is possible"), a journal or company name, healing in the
  broad sense ("joy is medicine, too"), and Paul Heffernan's title below.
- **Affirmative voice only.** Describe what something *is*, not what it
  isn't. Avoid "not X" constructions, hedging negations, and defensive
  disclaimers. Prefer "offered with care" over "not instruction";
  "we gather X when Y" over "we won't ask for X"; "open to beginners"
  over "not only for advanced practitioners." Negatives foreground the
  wrong thing.
- **No "the real X" framings.** Do not write "the real work," "the real
  teaching," "the real integration," "the real you," or any variant that
  ranks one experience as more authentic than another. It is all real.
  Drop the qualifier — say "the work," "the teaching," "integration."
- Paul Heffernan's plant-medicine title is **"Director of Plant
  Regeneration / Medicine Guide"**; his BodyTalk role is separate.
- Dr. Liz is **"Director of On-Island Integration"**.

## SOPs page

`/dashboard/sops` renders the internal playbook. The `SOPS` array in
`components/dashboard/SopsPanel.tsx` is the source of truth. **Do not
invent playbook content** — Rachel uploads or pastes real SOPs and we
wire them in. Until then, the page shows an empty state inviting upload.
