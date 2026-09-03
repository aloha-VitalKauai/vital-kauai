# Financials V2 — Handoff

**Updated:** 2026-09-03 · **Updated by:** PR 10B brief (D-090)
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
| 10B | Founder-chosen collection amount (D-090) | **MERGED AND DEPLOYED** — #978 squashed as `b4c6668`; migration `20260904010000` applied and stamped 2026-09-03; PostgREST reloaded. See §"PR 10B" below |

## PR 10B — founder-chosen collection amount (D-090)

**State: MERGED AND DEPLOYED.** PR #978 squashed to `main` as `b4c6668` on the founder's
explicit merge instruction after the review below. Migration `20260904010000` applied to
production verbatim (md5 `b4bf4938ef5ca8d7eb85bfc792538e24`, identical to the merged file)
and stamped `finance_pr10b_chosen_amount`; both assertion blocks silent; `notify pgrst`
issued. Post-apply catalog: one defaulted `issue_payment_link` per schema, `amount_cents`
present, 0 rows carrying an amount. Rollout steps 3–4 below remain the founder's live drill.

### Evidence (2026-09-03)

**Review.** Fresh-context adversarial review of the staged diff (attack surfaces a–o):
no blocking code defect. Two non-blocking findings taken before the migration ever
touched production — `begin_checkout_attempt` now requires the link to belong to the
agreement (a foreign link is `VK404`, indistinguishable from a missing one), and the
founder link strip flags a live link whose figure exceeds current Remaining
("revoke and reissue", DANGER tone, display-only). Re-review of the delta: **APPROVE**.
Two further non-blocking notes stand as Future items below (text-pin strength;
single-shot migration, consistent with the D-088-era convention).

**Gates.** `tsc --noEmit` clean. `npm test` 468/468 (447 + 21 in
`lib/finance/checkout.test.ts`). Production build clean (137 pages;
`/api/finance/payment-links` and `/contribute/[token]` compile).
`git diff -- supabase/migrations/20260821140000_finance_pr6_checkout.sql` empty; its
sha256 is pinned in the test.

**Production proof — migration + proof in ONE transaction, terminated by an exception
so it could only roll back.** No `COMMIT` existed in the script. Run 2026-09-03 via the
Supabase management connection against `cbxogagxxnhzqfudxuxb`. The migration's
`ALTER TABLE`, both `DROP FUNCTION`s, all `CREATE`s, grants and both assertion `DO`
blocks ran silently (any raise would have surfaced instead of the results). The
results block then read the catalog and raised:

```
migration: column_exists=t  rows_with_amount=4  issue_payment_link overloads finance=1 finance_api=1
summary: 46 passed, 0 failed
```

(`rows_with_amount=4` are the proof's own links; criterion 16 read **0** pre-existing
rows carrying an amount before the proof issued any — no backfill, `ALTER TABLE`
affected 0 rows.) Every criterion the script covers printed PASS: 1, 2, 3, 4, 5, 7,
8, 9 (including `23505` on `checkout_sessions_live_uq` and its PR 1 definition
verbatim), 10, 11, 12 (non-founder `authenticated` → `founder role required`;
`service_role` no EXECUTE on `finance_api.issue_payment_link(uuid,text,text,bigint)`;
`authenticated` no EXECUTE on `peek`; zero anon/PUBLIC grants; zero `finance_api`
SECURITY DEFINER beyond the D-088 carve-out), 13, 14 (one overload per schema,
`pronargdefaults = 1`, three-argument named call resolves), 15, 16, and F3.

**Downstream untouched — both halves.** Before apply, production reads
`v_agreement_balances` md5 `6c202e145139bc34598b4e188b1e85bb` and
`f_balances(boolean)` md5 `de6d509ad5c65021f91bd11be29871f3`. Criterion 10, inside
the applied transaction, printed the identical pair.

**Rollback held.** Immediately after: production shows one `finance.issue_payment_link`
overload (the original three-argument one) and no `amount_cents` column on
`finance.payment_links`.

### Rollout verification still to do (post-merge, founder)

1. Apply `20260904010000_finance_pr10b_chosen_amount.sql` to production and stamp it;
   confirm the apply output shows no `ERROR`/`WARNING` and both `DO` blocks silent.
2. Reload the PostgREST schema cache, then from the founder panel issue a link with
   the amount left at the full Remaining — a three-argument `.rpc("issue_payment_link")`
   resolving (or its `VK409 a live link already exists` refusal) proves resolution.
3. Live drill on Shawn Coullahan's $12,500 agreement when the deposit figure is known:
   issue the chosen amount, open `/contribute/<token>`, confirm the Stripe page shows
   exactly that figure, pay, confirm one `stripe_payment` for that amount, Remaining =
   Contribution − paid, state `partial`, then issue the remainder.
4. Retire the stale full-amount Session `cs_live_a1eYrN…` (expires 2026-09-04 21:38 UTC,
   or expire it in the Stripe dashboard) before issuing the first partial — single-flight
   refuses a second live Session.
Label note: `PR10_PREFLIGHT.md` used "10B" for the public-support provider
sub-PR; this section is the D-090 commission and carries the label the
commission gave it. D-090 is settled; this brief implements it, it does not
reopen it.

### Outcome

The founder can issue a payment link for a chosen amount — integer cents,
`> 0`, `<= payable_remaining_cents` — validated in Postgres at issuance and
again at Session creation, with an omitted amount behaving exactly as today.

### Design answers

**A. Where the chosen amount lives.** A nullable column on the link:
`finance.payment_links.amount_cents bigint NULL` with
`CHECK (amount_cents IS NULL OR amount_cents > 0)`. `NULL` means "the full
payable remaining at Session time", which is byte-for-byte today's semantics,
so every existing row and every existing call keeps its meaning. This is an
instruction the founder gave, in the same class as `reason` — it is not a
derived financial value (Remaining stays only in `v_agreement_balances`), and
it is never summed into any figure. Between issuance and Session creation the
link carries the figure; at creation the figure is re-checked against the
**live** view, so a moved balance is caught, never assumed. No new table,
enum, view or flag.

**B. Validation and error codes** (existing `VK4xx` convention):

| Where | Rule | Code / message |
|---|---|---|
| `issue_payment_link` | `p_amount_cents IS NOT NULL AND p_amount_cents <= 0` | `VK400` `issue_payment_link: amount must be a positive number of cents` |
| `issue_payment_link` | `p_amount_cents > payable_remaining_cents` | `VK409` `issue_payment_link: amount % exceeds payable remaining %` |
| `issue_payment_link` | unchanged: not founder, blank reason, not active, nothing payable, live link exists | unchanged |
| `begin_checkout_attempt` | `p_amount_cents <= 0` (existing) | `VK400` unchanged |
| `begin_checkout_attempt` | agreement `payable_remaining_cents` `NULL` or `<= 0` | `VK409` `begin_checkout_attempt: nothing remains to collect` |
| `begin_checkout_attempt` | `p_amount_cents > payable_remaining_cents` | `VK409` `begin_checkout_attempt: amount % exceeds payable remaining %` |
| `begin_checkout_attempt` | `p_link_id IS NOT NULL` and `p_amount_cents <> COALESCE(link.amount_cents, payable_remaining_cents)` | `VK409` `begin_checkout_attempt: amount % does not match the link` |
| route `POST /api/finance/payment-links` | `amountCents` present but not a safe positive integer | HTTP `400` `invalid_amount`, no RPC made |

`bigint` parameters make a fractional amount unrepresentable at the database;
the route refuses it first so the founder gets a clear message. The route
passes `p_amount_cents` **only when the founder supplied one**; otherwise the
argument is omitted and the default applies.

**C. Balance moved down after issuance.** Refuse, never clamp. The founder
issued a figure and the email stated that figure; a member is never charged
a different amount than the one they were sent (the same principle as D-034's
"a Session is never returned unconditionally"). Clamping would also decide,
silently, that the founder still wants the smaller remainder collected — that
is the founder's call. Behaviour: `resolveTokenState` returns `review` when
`link_amount_cents > payable_remaining_cents` (the existing copy "We're
reviewing this checkout… do not submit another payment" — no new state, no
new copy), so `startCheckout` refuses `not_ready` **before phase 1** and the
link is never claimed; `begin_checkout_attempt` enforces the same cap as the
authoritative backstop. The founder revokes and reissues — one click.

**D. Overload vs default.** One function, defaulted fourth parameter
`p_amount_cents bigint DEFAULT NULL`, and the **three-argument signature is
dropped in the same migration** in both `finance` and `finance_api`.
`CREATE OR REPLACE` with a new parameter list creates a second overload; with
`f(uuid,text,text)` and `f(uuid,text,text,bigint DEFAULT NULL)` both present,
a three-argument call raises `function is not unique` and PostgREST's
named-argument resolution is likewise ambiguous. The PR 6 assertion block
counts nothing by number — it asserts zero `SECURITY DEFINER` in
`finance_api`, zero `PUBLIC`/`anon` `EXECUTE`, no `service_role` `EXECUTE` on
the founder link functions, no `authenticated` `EXECUTE` on the machine
functions, and no `UPDATE`/`DELETE` grant on `finance` — and it lives in an
already-applied migration that is not edited or re-run. What matters is that
a **newly created** function defaults to `PUBLIC EXECUTE`, so the new
migration must `REVOKE ALL … FROM public` and re-grant on the new signature,
then run its own copy of that block plus the 10B-specific assertions below.

**E. `begin_checkout_attempt`.** Today it validates only `> 0` and does not
consult the view; the "amount recalculated server-side" guarantee currently
rests on `startCheckout` alone. The cap check moves into the function
(signature unchanged): lock the agreement `FOR UPDATE`, read
`v_agreement_balances`, apply the three `VK409` rules in B. The member-portal
functions (`begin_member_contribution_checkout`, `begin_member_gift_checkout`)
insert directly and never call it, so they are untouched.

**F. UI.** In the Collect drawer, the read-only "Amount to collect" box
becomes a dollar input prefilled with the full Payable Remaining, helper text
"Up to {Remaining}. Leave as is to collect the full balance." The client
checks integer cents `> 0` and `<= remaining` for feedback only; the route and
the database decide. The preview sentence states the entered figure. The
issued box and the email already print `row.amount_cents` from the response,
so they show the chosen figure without change. The link strip gains the
amount where present (one line; the founder must see what a live link is
for before revoking it). `/contribute/[token]` renders `s.amountCents` from
`resolveTokenState`, which now returns the link's figure — **no page change**.

**G. `lib/database.types.ts`.** `finance_api` is not generated (zero
occurrences in the file) and the `public` schema is untouched, so **no
regeneration** and no typed-call change; the `.schema("finance_api")` calls
stay untyped as today.

### In scope

- `supabase/migrations/20260904010000_finance_pr10b_chosen_amount.sql` — the one migration (below).
- `lib/finance/checkout.ts` — `PeekRow` gains `link_amount_cents`; two pure exported helpers, `parseCollectionAmountCents(input: unknown)` and `attemptAmountFor(linkAmountCents, payableRemainingCents)`; `resolveTokenState` returns the link figure in `ready` and `review` when it exceeds payable; `startCheckout` passes `attemptAmountFor(...)` to `begin_checkout_attempt`.
- `app/api/finance/payment-links/route.ts` — `Body` issue variant gains `amountCents?: number`; validate with `parseCollectionAmountCents`; pass `p_amount_cents` only when supplied. Email sentence becomes "Here is your secure, single-use link for your contribution payment of **{amount}**:" (founder may veto the wording).
- `app/components/dashboard/financials/V2FinancialPanel.tsx` — Collect drawer input, preview text, link-strip amount.
- `lib/finance/checkout.test.ts` (new, added to the `npm test` list in `package.json`).
- `supabase/tests/proofs/pr10b_partial_collection.sql` (new; outside the `supabase/tests/finance/*.sql` pgTAP glob, whose harness stops at the PR 1 series) — the rolled-back production proof script, output pasted into the PR.
- `docs/financials-v2/HANDOFF.md` final commit.

### Explicitly out of scope

- Concurrent partial links or Sessions; `checkout_sessions_live_uq` and the one-live-link rule are untouched.
- Member-initiated partials: `/api/finance/member-checkout` and `begin_member_*` stay full-remaining only.
- Amend, or any change to `agreement_amounts`, the lifecycle, or the Contribution.
- Any change to `v_agreement_balances`, `v_member_financials`, `v_journey_financials`, or the founder/member overview views.
- Reconciliation, the worker, the sweepers, `checkout-recovery.ts`, `record_v2_stripe_payment`, the webhook.
- Gifts, public support, processing fees, receipts.
- Payment schedules, reminders, "remaining after this link" projections, or storing any derived figure.
- Retiring the pre-existing D-034 gap on founder-link resume (see Future items).

### Acceptance criteria

1. **Omitted amount is unchanged.** `finance_api.issue_payment_link(agreement, hash, reason)` with no fourth argument returns `amount_cents = payable_remaining_cents`; the row has `amount_cents IS NULL`; `startCheckout` creates the Session for the payable remaining read at attempt time.
2. **Partial issuance and Session.** Contribution 1,250,000; `p_amount_cents = 500000` → row `amount_cents = 500000`, returned `amount_cents = 500000`; `resolveTokenState` → `ready` with `amountCents = 500000`; `begin_checkout_attempt` row `amount_cents = 500000`; Stripe `unit_amount = 500000`; the email and the issued box print $5,000.00.
3. **Zero rejected.** `p_amount_cents = 0` → `VK400`; zero rows inserted.
4. **Negative rejected.** `p_amount_cents = -1` → `VK400`; zero rows inserted.
5. **Over-cap rejected at issuance.** `p_amount_cents = payable_remaining_cents + 1` → `VK409`; zero rows inserted. `p_amount_cents = payable_remaining_cents` succeeds.
6. **Non-integer refused at the route.** `amountCents` of `50.5`, `"5000"`, `NaN` or `2^53` → HTTP `400 invalid_amount`; no RPC call.
7. **Moved balance is refused, not clamped.** Issue 500,000 on payable 1,250,000; record an external payment of 800,000 (payable now 450,000). `resolveTokenState` → `review`; `POST /api/contribute` → `409`; the link is still `active` (never claimed); no `checkout_sessions` row exists. Calling `begin_checkout_attempt(link, agreement, 500000, true)` directly raises `VK409 … exceeds payable remaining`.
8. **Link–attempt consistency.** For a link with `amount_cents = 500000`, `begin_checkout_attempt(link, agreement, 400000, true)` raises `VK409 … does not match the link`; for a link with `amount_cents IS NULL`, an amount other than the current payable remaining raises the same.
9. **Single-flight unchanged.** With a live link, a second `issue_payment_link` — with or without an amount — raises `VK409 … a live link already exists`. A second `creating`/`open` Session for the same `(agreement_id, livemode)` raises `23505` on `checkout_sessions_live_uq`, and `pg_get_indexdef('finance.checkout_sessions_live_uq'::regclass)` is identical before and after the migration.
10. **Downstream is untouched.** After `record_v2_stripe_payment(agreement, 500000, …, livemode = true)`: `v_agreement_balances` reports `gross_received_cents = 500000`, `remaining_cents = 750000`, `payment_state = 'partial'`; the view definition (`pg_get_viewdef`) is unchanged. A second link — omitted amount → 750,000, or `p_amount_cents = 750000` — then issues successfully.
11. **Paid agreement still refuses.** With `payable_remaining_cents = 0`, `issue_payment_link` with or without an amount raises `VK409 nothing remains to collect`.
12. **Role boundary.** As a non-founder `authenticated` user, `finance_api.issue_payment_link(…, 500000)` raises `founder role required` and inserts nothing. `has_function_privilege('service_role', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE')` is false; `anon` and `PUBLIC` hold no `EXECUTE` on any function created by the migration; `finance_api` still has zero `SECURITY DEFINER` functions.
13. **Member path cannot supply an amount.** `POST /api/finance/member-checkout` with `kind: "contribution"` and any of `amountCents`/`amount`/`amount_cents` still returns `400 amount_not_accepted`; `finance.begin_member_contribution_checkout(uuid, uuid)` remains the only signature and has no amount parameter.
14. **Exactly one overload.** After migration, `finance.issue_payment_link` and `finance_api.issue_payment_link` each have exactly one `pg_proc` row, with `pronargdefaults = 1`; a three-argument call through PostgREST (`.rpc("issue_payment_link", { p_agreement_id, p_token_hash, p_reason })`) resolves without ambiguity.
15. **Assertion block passes.** The migration's closing `DO` block (PR 6 block verbatim plus 12 and 14 and the column/CHECK existence) raises nothing on apply; the PR 6 file is byte-unchanged (`git diff --stat` shows no change to `20260821140000_finance_pr6_checkout.sql`).
16. **Fresh database.** The migration applies after the existing series on an empty database with `rows affected = 0` for the `ALTER TABLE`.
17. **Gates.** `npm test` green including `lib/finance/checkout.test.ts`; `npm run typecheck` clean; production build clean; `scripts/retirement-gate.mjs` clean.

### Migration plan — `20260904010000_finance_pr10b_chosen_amount.sql`

Additive only; one file; apply **before** the code deploys (the old code
omits the argument and keeps working against the defaulted function; the
new code must not run against the old function). Rows affected: 0.

1. `ALTER TABLE finance.payment_links ADD COLUMN amount_cents bigint NULL CONSTRAINT payment_links_amount_cents_positive CHECK (amount_cents IS NULL OR amount_cents > 0);` — no backfill; `NULL` is the correct meaning for every existing row.
2. `DROP FUNCTION finance_api.issue_payment_link(uuid, text, text); DROP FUNCTION finance.issue_payment_link(uuid, text, text);`
3. `CREATE FUNCTION finance.issue_payment_link(p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint DEFAULT NULL) RETURNS TABLE (link_id uuid, amount_cents bigint, expires_at timestamptz)` — PR 6 body verbatim with three additions after the "nothing remains" check: the `VK400` and `VK409` rules from B; `INSERT … (…, amount_cents) VALUES (…, p_amount_cents)`; `RETURN QUERY SELECT v_id, COALESCE(p_amount_cents, v_bal.payable_remaining_cents), v_exp`. Same `SECURITY DEFINER`, same `search_path`, same lock order (agreement `FOR UPDATE` first).
4. `CREATE OR REPLACE FUNCTION finance.begin_checkout_attempt(uuid, uuid, bigint, boolean)` — same signature; body adds `PERFORM 1 FROM finance.agreements WHERE id = p_agreement_id FOR UPDATE`, the view read, and the three `VK409` rules from B/E before the `INSERT`.
5. `DROP FUNCTION finance_api.peek_payment_link(text); DROP FUNCTION finance.peek_payment_link(text);` then recreate both with one added trailing column `link_amount_cents bigint` (`l.amount_cents`). Return-type changes require drop; both are `service_role`-only and read-only.
6. `CREATE OR REPLACE VIEW finance_api.payment_links` — same column list plus `amount_cents` appended (adding a trailing column is permitted by `CREATE OR REPLACE VIEW`).
7. `CREATE FUNCTION finance_api.issue_payment_link(p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint DEFAULT NULL)` — `SECURITY INVOKER`, one-line `SELECT * FROM finance.issue_payment_link(...)`.
8. Grants, on every new signature: `REVOKE ALL … FROM public`; `GRANT EXECUTE` on both `issue_payment_link` to `authenticated` only; on both `peek_payment_link` to `service_role` only; `begin_checkout_attempt` grants are unchanged because its signature is unchanged. `GRANT SELECT ON finance_api.payment_links TO authenticated, service_role` re-stated.
9. Closing `DO $chk$` block: the PR 6 block verbatim, plus: column exists with the named CHECK; exactly one `issue_payment_link` in each schema with `pronargdefaults = 1`; `pg_get_indexdef` of `checkout_sessions_live_uq` equals its PR 1 text; no `PUBLIC`/`anon` `EXECUTE` on the two new signatures.

The PR 6 migration is not edited. The `supabase/tests/migrations_manifest.txt`
series is frozen at PR 1 and does not list this file (it lists none since).

### Test plan

**Proven by SQL in a rolled-back production transaction** (`BEGIN; … ROLLBACK;`
as founder `request.jwt.claim.sub`, then as a member, then as `service_role`;
script committed at `supabase/tests/proofs/pr10b_partial_collection.sql`,
output pasted into the PR): criteria 1, 3, 4, 5 (issuance half), 7 (the
direct `begin_checkout_attempt` call), 8, 9, 10, 11, 12, 14, 15, 16. The
`payment_links` and `checkout_sessions` rows created inside the transaction
are discarded with it; `ledger_entries` is written only via
`record_v2_stripe_payment` inside the same rolled-back transaction, so no
production fact row is created.

**Proven by `node:test` over the TS logic** (`lib/finance/checkout.test.ts`,
no database, no Stripe — the same shape as `app/api/support/checkout/route.test.ts`
and the source-pinning style of `app/portal/donate/pr8-truth.test.ts`):
- `parseCollectionAmountCents`: `undefined`/`null` → `null` (full); `500000` → `500000`; `0`, `-1`, `50.5`, `"5000"`, `NaN`, `Infinity`, `2**53` → refused (criterion 6).
- `attemptAmountFor`: `(null, 1250000)` → `1250000`; `(500000, 1250000)` → `500000`; `(500000, 500000)` → `500000`; `(500000, 450000)` → refused `exceeds_remaining`; `(null, 0)`, `(500000, 0)`, `(null, null)` → refused `nothing_payable` (criteria 1, 2, 7).
- Source pins: `startCheckout` calls `attemptAmountFor` and the `ready` check before `claim_payment_link`; the founder route forwards `p_amount_cents` only inside an `if (amountCents !== null)`; `app/api/finance/member-checkout/route.ts` still contains `amount_not_accepted` and never mentions `p_amount_cents` (criterion 13); `lib/finance/member-checkout.ts` calls no `begin_checkout_attempt`.
- `pr7-truth`/`pr9-truth` pins are unaffected (none pin the Collect drawer copy — verified by grep).

**Proven by the founder in production after deploy** (test-mode key is not
configured for founder links, so this is the live drill, as PR 6's was): issue
a $1.00 partial on a real agreement, confirm the bridge page shows $1.00, pay
it, confirm exactly one `stripe_payment` of 100 cents and `payment_state =
partial`; then issue the remainder. Criteria 2 (Stripe half) and 10 (end to
end).

### Rollout and rollback

**Rollout.** No new flag. Issuance stays behind the existing
`FINANCE_V2_CHECKOUT_READY` (currently `true`). Order: (1) apply the migration
and stamp it; (2) confirm through Supabase that a three-argument
`.rpc("issue_payment_link", …)` still resolves (PostgREST reloads its schema
cache on DDL); (3) merge and let Vercel deploy; (4) the founder runs the $1.00
drill above; (5) `HANDOFF.md` records the drill output.

**Rollback.** Code: revert the squash commit — the old route omits the
argument and works against the defaulted function. Database, only if the
function bodies must also go back: first revoke every live link that carries
an amount (`SELECT id FROM finance.payment_links WHERE amount_cents IS NOT NULL
AND status IN ('active','creating')` → `revoke_payment_link` each), because a
pre-10B `startCheckout` would charge such a link the **full** remaining;
then `DROP` the four-argument functions and recreate the PR 6 bodies and
grants for `issue_payment_link`, `begin_checkout_attempt` and
`peek_payment_link`, and the view without the column. The column stays —
nullable, unreferenced, harmless. Rollback is clean; the only residue is
`amount_cents` values on historical rows, which are audit facts and correct.

### Security review (PR template answers)

- **Authorization.** Issuance: `authenticated` may `EXECUTE`, and `public.is_founder()` inside the `SECURITY DEFINER` body is the gate, exactly as PR 6. `begin_checkout_attempt` and `peek_payment_link`: `service_role` only, unchanged. `anon`/`PUBLIC`: nothing. Asserted in-migration.
- **RLS.** No table policy changes. `finance.payment_links` remains `SELECT`-only to API roles; the only write paths are the `SECURITY DEFINER` functions.
- **Secrets.** None added.
- **Input validation and amounts.** The founder's amount is an instruction, validated three times: route (`Number.isSafeInteger`, `> 0`), `issue_payment_link` (`> 0`, `<= payable_remaining` under agreement lock), `begin_checkout_attempt` (`> 0`, `<= payable_remaining`, equals the link's figure, under agreement lock). The member browser cannot supply any amount on any path. Integer cents throughout; the only figure sent to Stripe is `checkout_sessions.amount_cents`, which is `> 0` by `CHECK` and bounded by `payable_remaining_cents = GREATEST(remaining, 0)` — never negative, never `NULL`.
- **PII.** Nothing new stored; `amount_cents` is not PII. Retention unchanged.

### Risks

1. **Overload ambiguity** (`function is not unique` / PostgREST "could not choose the best candidate"). Mitigation: the three-argument signatures are dropped in the same migration; criterion 14 asserts one `pg_proc` row per schema and a three-argument PostgREST call.
2. **New function created with `PUBLIC EXECUTE`.** Mitigation: `REVOKE ALL … FROM public` on each new signature, and the closing block asserts zero `anon`/`PUBLIC` `EXECUTE` (criterion 12).
3. **A partial Session is paid after the balance moves under it** (external payment recorded while a $5,000 Session is open, so the member overpays). This is the pre-existing D-034 gap on the founder-link **resume** path (`open_session` resumes without re-checking the amount), not introduced here, and a partial does not make it more likely. Mitigation in this PR: refusal before claim (criterion 7) and the cap in `begin_checkout_attempt` close the window before a Session exists; the resume path is recorded as a Future item, not folded in.
4. **Old code against the new function / new code against the old function.** Mitigation: apply the migration first; the old code passes three arguments and the default covers it; the new route passes the fourth only when supplied.
5. **Email says "complete your contribution of $5,000" for a partial.** Mitigation: the one-sentence wording change in scope; founder reviews the sentence in the PR.
6. **Dollar-to-cents rounding in the drawer** (`Math.round(parseFloat(x) * 100)`, the existing pattern for external payments). Mitigation: the route refuses anything that is not a safe integer; the database receives `bigint` only; the founder sees the exact cents figure in the preview before creating.
7. **PostgREST schema cache stale after the function signature changes.** Mitigation: rollout step 2 verifies a live call before the code deploys; Supabase reloads on DDL, and `NOTIFY pgrst, 'reload schema'` is the fallback.

### Implementer: first action

Write the migration first, then run the rolled-back production proof script
against it before touching any TypeScript. Database foundation precedes
interface.

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

## PR 8 state (2026-08-21)

Branch claude/financials-v2-pr8 (head 7b867d2). Migration
`20260821220000_finance_pr8_member_portal.sql` is committed but NOT APPLIED —
its façade revocations would break the deployed founder pages until the PR 8
consumers ship, so it is applied at deploy time, immediately before merge.
Four-role behavioral proof PASSED in a rolled-back production transaction
(member scoping, façade denial, cross-member VK404, gift replay identity,
concurrent-gift VK409, bounds, anon/non-member denial, service machine view).
Gates at 7b867d2: 369/369 tests, tsc clean, production build clean
(/portal/donate + /api/finance/member-checkout compile). Bounded adversarial
review: see PR notes. Checkout remains fail-closed (flag unset) until the PR 6
closeout drills and launch evidence pass.

## PR 9 state (2026-08-22)

**MERGED AND DEPLOYED.** Production SHA **`a409dd6`** (PR #914, squashed).
Migration `20260822020000` applied and stamped; `fn_reconcile_financial_state`
is ABSENT. Verified in production: legacy routes 404, `/pay/<token>` renders the
retirement notice with no lookup, V2 crons and webhook alive, retired tables
`0/0/0/0` with 12 freeze triggers all firing on the primary and zero write
grants, `finance` unexposed to anon, canonical money $100/$100/$0, 1 ledger row,
0 open exceptions.

Financials V2 is the only financial system the application can reach. 29 files
removed: 14 legacy route handlers, the legacy cron, the dead financial
components, both provider clients, both enable flags, and the entire
guard-centric D-078 suite. `/dashboard`, `/dashboard/ops` and the member profile
read canonical `finance_api` views; a failed or non-founder read renders
"Unavailable", never `$0`. `/pay/[token]` is a no-lookup notice and the legacy
Edge webhook is a dependency-free 410 tombstone.

`scripts/retirement-gate.mjs` proves absence repository-wide across all eight
executable extensions, deriving its scope from the files it actually read rather
than from a skip list. Ten mutants killed, null control green, tree byte-restored.

Migration `20260822020000` (drop `public.fn_reconcile_financial_state`) is
written and proven in a rolled-back transaction but **NOT APPLIED**.

Gates at `30a82ad`: 248/248 tests, `tsc` clean, production build clean
(128 pages, down from 144), retirement gate clean. Four-role and freeze proofs
passed in a rolled-back production transaction. One bounded adversarial review:
8 findings, all resolved; two further defects were found and fixed before it ran
(a cross-member timeline leak, and the inverted scope audit).

**Authorized deviation:** expense/payout entry routes retained until PR 11.

### Acceptance status

DONE: server-side drills (one-live enforcement, cancel frees the slot, resume via
finalize, confirmed expiry refusing a foreign Session id, paid agreement refusing
checkout, link claim → orphan restore, revocation and issuance proven
founder-gated), four-role and freeze proofs, reconciliation matching the live
payment (`scanned=1 matched=1 exc=0` across 22 consecutive runs, all DRY).

OUTSTANDING, needs founder action:
1. Duplicate-delivery drill — resend `evt_3U74pqKBySbdp3Q106ChA1en` from the
   Stripe destination; confirm no second ledger entry and no balance movement.
2. Positive revoke and member-portal cancel/resume — founder acts, deliberately
   not manufactured here.
3. An APPLYING (non-dry) reconciliation run, which needs the approval → canary
   sequence. Dry runs report `would_create=0`, so there is nothing pending.
4. Deploy and verify the legacy Edge tombstone (returns 410); confirm the old
   Stripe/Square destinations are disabled.

### Known defect — cancel/waive do not affect canonical totals

`finance.f_balances` never consults agreement lifecycle, so a CANCELLED or
WAIVED agreement still contributes to Contribution and Remaining. The member
portal hides such agreements' cards (PR 7 review fix), which makes it worse: the
overview shows a Remaining balance with no card explaining it. Pre-existing in
the PR 8-era views; surfaced by the first cancellation this system has had.
**Founder decision recorded: cancelled and waived agreements must be EXCLUDED
ENTIRELY from Contribution, Received and Remaining.** Fix pending as its own PR
with proofs.

Artifact: agreement `72aa064a` (`membership`) is a PR 9 drill scaffold. It is
cancelled and amended to $0, so it contributes nothing. It could not be deleted —
`agreement_amounts` is append-only, correctly — and remains as audit evidence.

`FINANCE_V2_CHECKOUT_READY` is **true** in Vercel Production. One live $100
payment has been taken and reconciled to exactly one ledger entry.

## Copy amendment (2026-08-28) — D-089

Founder-requested copy change to the member Contribution portal, no behaviour.
The hero's scholarship sentence moved to the additional-gift section and was
reworded from "Your support" to "Your gift"; the hero now states what the
Contribution covers (six weeks of preparation, eight days on Kauaʻi, six weeks
of integration).

Scholarships are funded by gifts, not by a member's own Contribution, so the
sentence had been sitting above the wrong figures. `PR8_BUILD_SPEC.md`'s D-086
production-copy amendment is updated, and the PR 8 truth test still pins every
approved sentence verbatim against the new text.

The gift section's "An additional gift is separate from your Contribution and
never changes what remains." was also removed by founder decision. The
guarantee is structural (`contribution_applies = false`, gift receipts summed
separately) and unchanged; only the member-facing statement of it is gone.

No figure, formula, ledger path, checkout path or state label was touched.

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

- **Founder-link resume does not re-check the amount (D-034 gap).** `resolveTokenState` returns `open_session` and `startCheckout` resumes it without comparing `checkout_sessions.amount_cents` to the current `payable_remaining_cents`; the member-portal path (`lib/finance/member-checkout.ts`) does compare and expires-then-recreates. Pre-existing before PR 10B; noticed while briefing it. Fix is its own PR: apply the D-034 reuse table to the founder-link path.
- **The PR 6 assertion block is no longer verbatim-reusable.** D-088 (`20260823020000`) made `finance_api.public_campaign_status` the one `SECURITY DEFINER` function anon may execute and carved it out of its own assertions by name; the PR 6 counts ("zero `finance_api` SECURITY DEFINER", "zero anon/PUBLIC EXECUTE") now fail on that function alone. PR 10B's migration carries the PR 6 block with the same named carve-out. Any future brief that says "PR 6 block verbatim" should say "PR 6 block with the D-088 carve-out". Noticed while applying PR 10B to a local build of the series.
- **The retirement gate's scope audit flags a build output.** With `.next/` present (after `npm run build`), `retirement-gate.test.ts`'s null control and restoration tests fail on "source file exists but was never scanned: .next/…" even though `.next` is in `PRUNED_DIRS`; the suite is green once `.next` is removed. Run `npm test` before `npm run build`, or align the scope audit's walk with the prune list. Noticed while running the PR 10B gates.
- **`supabase/tests/migrations_manifest.txt` is stale.** It lists eight `20260730…` filenames that no longer exist on disk (the PR 1 files were renamed to `20260814…`) and nothing after PR 1, so `run_all.sh` and the pgTAP harness cannot build a database from the current series. Noticed while deciding where PR 10B's SQL proof could live. Not PR 10B's to fix.
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
