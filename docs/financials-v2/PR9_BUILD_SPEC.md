# PR 9 — Final V2 retirement and operational acceptance

Status: implementation-ready · Decision: **D-086** · Baseline: `85f7b82` or later
Evidence inventory: `PR9_RETIREMENT_AUDIT.md` · Roadmap: `PR10_PLUS_ROADMAP.md`

## 1. Outcome

Make Financials V2 the only reachable financial system in the application,
remove every legacy runtime dependency, preserve the frozen legacy schema solely
as forensic evidence, and prove the production Stripe → ledger → portal path end
to end. PR 9 does not create another payment system; it finishes the one built.

## 2. What "complete" means

Every founder and member amount comes from canonical V2 views; every card
payment goes through the PR 6 Checkout machine; every external payment and
correction goes through the PR 5 controls; no route, page, component, cron or
email reads or writes a retired financial table or derived view; no legacy
Stripe/Square code can be invoked even by changing an environment variable; the
retired tables remain empty, frozen and unread; checkout can be stopped by the
single fail-closed V2 interlock; the repository contains an executable absence
gate that fails if legacy financial code returns; and the governing documents
describe the system that actually runs.

## 3. Non-negotiable invariants

1. **One financial truth.** `finance` / `finance_api` are authoritative. Public
   legacy tables and their derived views never supply a displayed amount.
2. **Unknown is never `$0`.** Failed V2 reads render an unavailable state.
3. **No resurrection switch.** Both legacy enable flags and all guarded legacy
   code are removed. A future env change cannot re-arm the retired system.
4. **The V2 circuit breaker remains.** `FINANCE_V2_CHECKOUT_READY` gates Session
   creation and any recovery that could mint a payable Session. It never selects
   a read source, and cleanup continues while it is false.
5. **Permanent database freeze.** The freeze migration, twelve `VK078` triggers,
   revoked write grants and verification remain. The routine unfreeze helper goes.
6. **No destructive history rewrite.** Historical migrations, audit evidence,
   Stripe delivery evidence and ledger entries remain.
7. **No fake accounting.** `members.program_price`, booking amounts and retired
   aggregates may not masquerade as canonical financial facts.
8. **No duplicate provider abstraction.** V2 targets Stripe. Dormant Square
   application code is removed; historical Square columns/migrations remain.
9. **Design continuity.** Preserve the production Contribution language, gift
   presets and $5–$5,000,000 bounds, and the visual system. PR 9 does not
   reopen that product policy.
10. **No public-gift shortcut.** A reusable public QR is PR 10 and must not be
    implemented through a fake member or unattributed V2 payment.

## 4. Entry conditions

**Satisfied:** PR 8 merged and deployed; member-safe and founder replacement
façades live; `/portal/donate` V2-only with old URLs redirected; PR 6 recovery
closeout merged (`1d8b45f`); gift-ceiling alignment merged (`85f7b82`); legacy
tables empty and frozen.

**Required before final production acceptance:** the PR 6 controlled live launch
through the member portal; one authorized live payment creating exactly one
ledger entry; duplicate-delivery, cancel/resume, expiry and revocation drills;
separate authorization for any live refund; and a reconciliation finishing with
no unexplained exception. Code review may begin while checkout is paused, but
**PR 9 cannot be labelled complete until the live acceptance evidence exists.**

## 5. Workstreams

**5.1 Replace remaining legacy reads.** `/dashboard` and `/dashboard/ops` drop
`financials_overview` for `finance_api.founder_financial_overview`, use the V2
vocabulary (Contribution, Received, Remaining, Operating margin), never
recompute margin client-side, and show an unavailable state rather than zero.
The member detail page drops all four retired tables and
`private_ceremony_summary`; its Financials panel and timeline are served by
founder-safe V2 projections using safe labels (Contribution created/amended/
activated, Card payment, Recorded payment, Refund or correction, Link issued/
revoked, Checkout expired) and never expose provider ids, idempotency keys,
actor UUIDs or raw metadata. Member profile save no longer syncs program price.

**5.2 Remove the legacy runtime.** Delete the 14 legacy route handlers after
import proof. In `approve-member` and `add-member-manually`, preserve onboarding
and remove only the `$0` commitment seed. Replace `/pay/[token]` with a
server-rendered retirement notice that performs no token, database or provider
lookup and never converts an old token into a V2 token.

**5.3 Tombstone the deployed Edge Function.** Keep it deployable but inert: no
Stripe SDK, no Supabase client, no signature parsing, no environment flag, no
retired-table string; a deterministic retirement response (410 preferred).

**5.4 Remove provider and scheduler scaffolding.** Delete
`lib/payment-provider.ts` and `lib/square/client.ts`; purge `PAYMENT_PROVIDER`
and Square secrets from `.env.example`; remove `/api/cron/reconcile` and its
schedule; drop `public.fn_reconcile_financial_state()` after a catalog check.

**5.5 Remove dead components and navigation** after import proof, leaving
`/portal/donate` as the only member financial destination.

**5.6 Replace the shutdown test with a retirement gate.** A repository-wide
scanner over all eight executable extensions that fails on retired table
reads/writes (direct, computed, aliased, dynamic), retired views,
`fn_reconcile_financial_state`, legacy route strings and enable flags, provider
imports, any I/O in the Edge tombstone, and any source directory or extension
omitted from the scan. Scope is audited independently of the skip rules. Ten
mutants must all be killed, the null control must pass, and restoration must be
byte-identical.

**5.7 Documentation and design closure**, plus cross-surface consistency QA at
320/390/768/desktop with keyboard navigation, visible focus, semantic headings
and contrast treated as blocking.

## 6. Migration contract

One bounded tracked migration: drop the unused legacy reconciliation function,
optionally revoke residual grants first, change nothing about the four frozen
tables or their evidence, delete no legacy data or audit history, and assert
in-transaction that the function is absent and the freeze remains complete. If
another database object references a retired table, stop and record it in the
audit rather than widening scope.

## 7. Acceptance contract (all blocking)

**Runtime absence (1–10a):** zero application reads/writes of the four retired
tables; zero references to the three retired derived views; zero legacy payment
route handlers; onboarding still works with no legacy seed; no legacy enable
flag or helper in source or `.env.example`; no Square/provider-selector code;
tombstone free of Stripe, Supabase, network and retired-table dependencies;
legacy cron and schedule absent while V2 crons remain; old payment URLs redirect
or show the bounded notice without a database or provider call; email previews
free of retired payment URLs; and the expense/payout mutation position recorded.

**Truth and authorization (11–19b):** dashboards use V2 or show unknown; member
Financials and Timeline contain no legacy fact; profile save cannot mutate
finance; Member A cannot read Member B's financial data; a normal member cannot
read founder reasons, actors or provider identifiers; service role cannot call
founder-only controls; `finance` remains unexposed with `finance_api` the sole
façade; failed V2 reads never render `$0`; terminology matches the canonical
vocabulary; gift presets and the $5–$5,000,000 bounds remain identical across
UI, server and database; and founder dashboards never present legacy
expense/payout rows as canonical accounting.

**Money path (20–28a):** checkout refused while the readiness flag is false;
recovery cleanup runs while paused but cannot mint a payable Session; one
authorized live checkout creates one Session and one ledger entry; the charged
amount equals the server-derived payable Remaining; duplicate delivery creates
no second entry or balance movement; cancel/resume, revocation and confirmed
expiry behave as specified; a founder amendment prevents stale-amount reuse;
refund/reversal behaviour is proven without an unauthorized live refund;
reconciliation completes with no unexplained exception; and boundary tests prove
$5 accepted, $4 refused, $5,000,000 reaching the provider adapter in a
non-charging stub, and $5,000,001 refused before any Stripe call.

**Freeze and evidence (29–38):** retired tables remain `0/0/0/0`; twelve freeze
triggers remain enabled with write grants revoked; INSERT/UPDATE/DELETE/TRUNCATE
probes refused; migration repo and production ledger aligned; old Stripe and
Square destinations disabled with the V2 destination active; full suite,
typecheck and production build pass; every mutant killed with a green null
control and a clean tree; responsive and accessibility QA passes; no secrets or
provider identifiers in PR text, logs or screenshots; and `HANDOFF.md` names the
production SHA and accurately declares PR 9's state.

## 8. Rollout order

Capture a read-only production baseline; land the V2 read replacements; land the
legacy deletion, tombstone and retirement gate; apply the cleanup migration;
merge and deploy with `FINANCE_V2_CHECKOUT_READY` retaining its current value;
deploy and verify the Edge tombstone; remove legacy environment variables from
Vercel and Supabase and never set them true; run the acceptance contract; record
the production SHA and close D-078/PR 9 operationally.

If a production assertion fails, use the readiness interlock to stop new
Sessions and fix forward. Never restore a legacy route, unfreeze a retired table
or deploy a pre-D-078 build.

## 9. Exclusions

No public reusable donation QR, donor CRM, anonymous-donor identity, tax
receipts, year-end statements, legal-entity or fund accounting, general ledger,
bank feeds, payroll, tax filing, recurring payments, installments, subscriptions
or historical financial reconstruction. Those proceed per `PR10_PLUS_ROADMAP.md`;
PR 10's preflight must first settle Church-versus-LLC fund attribution.

## 10. Done definition

PR 9 is done when a repository-wide search and a behavioural gate both
demonstrate that no application code can reach the retired financial system,
production money moves only through V2, every user-facing number is canonical,
the frozen tables remain protected, and the operational record matches reality.
