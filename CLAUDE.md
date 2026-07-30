# Vital Kauaʻi — Claude operating notes

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
- Deployment: Vercel, connected to GitHub.

## Content conventions

- Use Hawaiian orthography: `Kauaʻi` (with ʻokina), `Kauaʻi`-based, etc.
- Do not use "shaman" or "trip" — prefer guide / holder / practitioner
  and journey / medicine.
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
