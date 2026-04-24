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
  the blast radius before shipping.
- Public-facing legal/medical copy where the words matter clinically
  (informed consent, contraindications, dosage claims) — draft, but pause
  for review before merging.
- Actions that send messages to members or outside parties on Rachel's
  behalf (SMS, email campaigns, posts) — always confirm.

If a change is cosmetic, copy-level, internal-dashboard-only, or otherwise
low-risk, proceed straight through merge + deploy.

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
- Paul Heffernan's plant-medicine title is **"Director of Plant
  Regeneration / Medicine Guide"**; his BodyTalk role is separate.
- Dr. Liz is **"Director of On-Island Integration"**.

## SOPs page

`/dashboard/sops` renders the internal playbook. The `SOPS` array in
`components/dashboard/SopsPanel.tsx` is the source of truth. **Do not
invent playbook content** — Rachel uploads or pastes real SOPs and we
wire them in. Until then, the page shows an empty state inviting upload.
