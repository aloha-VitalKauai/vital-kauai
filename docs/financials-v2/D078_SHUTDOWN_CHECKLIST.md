# D-078 — legacy payment shutdown: production checklist

Ordered. Do not reorder: every step before step 5 must be true *before* the
provider endpoints are touched, so that an event arriving mid-deploy is refused
rather than half-processed.

**Nothing from commit `0f75583` may be deployed.** That commit's guard covered
only 5 of 18 writers and its tests were vacuous. It is superseded.

## Pre-deploy

- [ ] **1. Confirm the flag is absent or not `true` in every Vercel environment**
      (Production, Preview, Development). `LEGACY_PAYMENTS_ENABLED` unset is the
      correct end state — the guard fails closed, so absent means disabled.
      Also confirm `NEXT_PUBLIC_LEGACY_PAYMENTS_ENABLED` is unset, so the UI
      hides the legacy controls. That flag is presentation only; it is not the
      enforcement point.

- [ ] **2. Confirm no migration is included in this deploy.** This is a code-only
      hotfix. The migration-history mismatch between the production ledger and
      the repo remains a *separate* PR 3 preflight blocker and must not be
      touched here.

- [ ] **3. Deploy the application code** (the 15 guarded route handlers, the pay
      page, and the two onboarding routes whose commitment seed is suppressed).

- [ ] **4. Deploy the `stripe-webhook` Edge Function.** It now refuses with HTTP
      503 before signature verification and before any database write, whenever
      `LEGACY_PAYMENTS_ENABLED` is not exactly `true`. Ensure the function's
      environment does not set that variable.

## Provider endpoints

503 is deliberate and was chosen over a 200 "tombstone": Stripe and Square both
treat a non-2xx as a delivery failure and **retain and retry** the event. Nothing
is silently discarded, so if the legacy surface is ever re-enabled the backlog is
still recoverable. A 200 tombstone would acknowledge and destroy events; the
founder explicitly declined that.

- [ ] **5. Stripe Dashboard → Developers → Webhooks.** Inspect every endpoint
      pointing at this project. Record the endpoint IDs and their subscribed
      events in the founder's own records first, then **disable** (not delete)
      each one. Disabling is reversible; deletion loses the event-subscription
      configuration.

- [ ] **6. Square Dashboard → Developer → Webhooks.** Inspect whether any Square
      webhook subscription exists at all. Square columns exist on two legacy
      tables but were never populated, so a subscription may never have been
      created. Record what is found — including "none" — then disable any that
      exist. Do not assume absence without looking.

- [ ] **7. Verify by observation, not by assumption.** With the app deployed,
      send a request to one legacy endpoint (for example `POST /api/payments/generate-link`)
      and confirm a `503` with body `{"error":"legacy_payments_disabled"}`.
      Then confirm the Stripe dashboard shows the endpoint disabled.

## Post-deploy

- [ ] **8. Confirm member onboarding still works.** `approve-member` and
      `add-member-manually` are deliberately **not** refused — only their `$0`
      draft `financial_commitments` seed is suppressed. Approving a member must
      still succeed end to end. If it does not, that is a regression from this
      change, not from the flag.

- [ ] **9. Confirm the legacy financial tables stay empty.** `donations`,
      `financial_commitments` and `payment_tokens` were emptied under D-077 and
      must remain at zero rows until Financials V2 owns them.

## Residuals — none

An earlier revision of this change accepted one residual: the member dashboard
updated `financial_commitments` **directly from the browser** under the founder's
own RLS session, which no server flag can intercept. That was rejected as a
deployment blocker, and correctly so — a write the server cannot refuse means the
flag is not actually authoritative.

That write now goes through `POST /api/payments/adjust-commitment`, a founder-only
server route carrying the same guard as every other writer. The component no
longer constructs a Supabase client at all. The allowlist mechanism that made
"residual" expressible was removed from the inventory, so a future one cannot be
waved through by adding an entry.

Current state, enforced by `scripts/legacy-writer-inventory.mjs` on every run:

| Measure | Value |
|---|---|
| Discovered legacy writers | 18 |
| Server-enforced or write-suppressed | 18 |
| Residuals | 0 |
| Unguarded writers | 0 |
| Browser-side mutations to retired tables | 0 |

## Database-side writers — full recursive classification

Source analysis cannot see inside Postgres, so the catalog was queried directly.
**`provolatile` was deliberately NOT treated as conclusive**: PostgreSQL permits
a STABLE function to call a VOLATILE one that modifies data, so volatility alone
proves nothing. Bodies and the full call graph were inspected instead.

Scope: all **75** user-defined plpgsql functions in non-system schemas.

| Finding | Result |
|---|---|
| Functions containing dynamic SQL (`EXECUTE`) | 1 — `rls_auto_enable` (DDL helper; writes no data) |
| Functions directly writing a retired table | 1 — `recompute_commitment_status_for` (VOLATILE, UPDATEs `financial_commitments`) |
| App-callable RPCs reaching that writer transitively (depth ≤ 10) | **0** |

`fn_reconcile_financial_state` was read in full: six read-only `return query`
SELECTs, no `EXECUTE`, and it calls no user-defined function. The recursive
closure over all six RPCs the application actually calls
(`fn_reconcile_financial_state`, `refresh_ops_alerts`, `finalize_assessment`,
`create_or_resume_assessment`, `get_member_id_from_auth`, `get_public_cohorts`)
reaches no writer of a retired table.

`recompute_commitment_status_for` is reachable only from two trigger functions:

- `donations:trg_recompute_commitments_on_donation_status` — fires on a retired
  table, so it is downstream of the guard.
- `payment_allocations:trg_recompute_commitment_on_allocation` — **this one
  mattered.** `payment_allocations` was not in the original three-table brief,
  yet writing it indirectly UPDATEs `financial_commitments`. Its only two writers
  (`record-offline`, the Stripe Edge Function) were already guarded, so nothing
  was open — but the table is now tracked by the inventory so a future writer
  cannot quietly reopen the path.

The inventory reports every `.rpc()` call site and every `.from(<non-literal>)`
on each run, so a future indirect write must be looked at rather than assumed safe.

## Founder attribution

The replacement endpoint writes through the **caller's own session**, not a
service-role client. Postgres therefore remains authoritative via the
`founders write commitments` policy (`ALL`, `is_founder()`), `auth.uid()` is the
founder for the statement, and it is the identical authorisation path the removed
browser code used — so the move cannot have widened access. A mutation
(`M11`) converts the route to service-role and the suite fails.

The `audit_commitments` trigger durably records before/after state to
`public.audit_log` for every such UPDATE, via a `SECURITY DEFINER` function that
writes even though the caller has no INSERT grant on that table.

**Stated limitation.** `fn_audit_trigger` reads the actor from the
`app.actor_id` GUC, which PostgREST cannot set per request, so audit rows are
attributed `actor_type = 'system'` rather than to the individual founder. This is
pre-existing behaviour and is not a regression — the browser write had the same
gap. Closing it means changing that trigger to fall back to `auth.uid()`, which
is a migration and is out of scope while the migration history is mismatched.
What is durable today: the row change itself, and that RLS admitted it only
because `is_founder()` held for that session.

## Independent review findings and how each was resolved

Round 2 returned **BLOCK** with four findings. All four were real.

**1. The onboarding write-suppressions were unverified (headline).** Deleting
`&& legacyPaymentsEnabled()` from either onboarding route left the suite green.
The disabled-state assertion held on routes that could not reach the commitment
seed in the harness at all — the same vacuity as `0f75583` in a different shape,
and the mutant set had been selected around exactly that blind spot.
*Resolved:* `ONBOARDING_RESOLVER` + `ONBOARDING_FETCH` now drive both routes to
`financial_commitments.insert`, and each has an explicit ENABLED positive control
that must observe the seed before the DISABLED assertion is allowed to mean
anything. Mutants **M13** and **M14** delete each suppression; both are killed.

**2. Raw `fetch` was invisible to the harness.** Email (Resend) and the Supabase
admin REST API are called via global `fetch`, not through any stubbed module, so
`__VK_CALLS` stayed empty while a real outbound request was attempted. The "no
email/link creation" claim had no evidence behind it.
*Resolved:* the loader now wraps global `fetch`, records every call, and blocks
it. Unhandled outbound calls throw, so a test can never pass because a network
call quietly succeeded. Tests may supply canned responses via
`__VK_FETCH_RESOLVE`, and anything not explicitly handled still throws.

**3. `guarded` meant "the identifier appears somewhere".** A guard parked in
`if (false)` — or merely imported — classified a file as guarded while its write
ran unconditionally.
*Resolved:* import bindings and provably-dead branches no longer count. Mutant
**M15** hides a guard in dead code and is killed.

**4. A header-conditional backdoor survives.** Adding
`&& req.headers.get("x-vk-bypass") !== "1"` to a route keeps the suite green.
*Accepted, not solved.* No finite test suite can enumerate every input a
deliberate backdoor might key on; this is a property of adversarial code review,
not of this gate. Recorded here so it is a known limit rather than an implied
guarantee.

**Process finding.** The tree changed while round 2 was running, so its numbers
described a tree that no longer existed. The tree was frozen for the final
review, and the numbers below are stated against that frozen tree.

## Round 3 review — BLOCK, and how it was resolved

**BLOCKING: `components/` was not scanned.** `SCAN_DIRS` covered
`app, lib, supabase/functions, scripts` — but the repo has a top-level
`components/` tree of 95 files including `components/dashboard/financials/`. A
browser-side write planted there was certified clean by the gate: 198 tests
green, `0 unguarded / 0 browser / 0 residual`, manifest matching.

Note *why* it survived the mutant set: M5 plants a writer in `app/api/...` and
M8 restores one in `app/dashboard/...` — both inside already-scanned directories.
Neither tested the **scope boundary**, so the blind spot was structurally
invisible to the protocol.

*Resolved:* `components` added, `supabase` broadened from `supabase/functions`,
and — more importantly — the inventory now **audits its own scope**. Any
top-level directory containing scannable source that is not in `SCAN_DIRS` fails
the gate. Adding `src/` or restoring `pages/` can no longer shrink coverage
silently. Scanned files went 287 → 382. Mutants **M16** (writer in
`components/`) and **M17** (writer in a brand-new top-level directory) both kill.

**Overstatement 1 — the mutation-precise meta-test was bypassable.** It matched
the *shape* of each `expect` regex, so `expect: /\(donations\)\.insert|./` — true
against any path — passed while proving nothing. *Resolved:* every expectation
must now also REJECT a list of decoy call paths (auth lookups, role checks,
unrelated tables, the Resend endpoint). A trivially-true pattern cannot.

**Overstatement 2 — "no outbound fetch" covered global `fetch` only.**
`node:http` / `node:https` were uninstrumented. Latent (no route uses them), but
unevidenced as claimed. *Resolved:* both are now recorded and blocked.

**Overstatement 3 — `guarded` remains file-scoped.** A live mention anywhere in a
file marks it guarded, and `inDeadBranch` only recognises literal
`if (false)` / `if (0)` / `if (true)…else`; an indirection such as
`const NEVER = false; if (NEVER) {...}` would still read as guarded.
*Not fully solved, and not claimed to be.* Full dominance analysis would
misclassify the Stripe Edge Function, whose writes live in helpers called from
the guarded handler. The inventory is a **discovery** tool; enforcement is the
behavioural suite, which covers all 18 writers. Review confirmed 0 of 18 are
misclassified today.

### A defect found by the sandbox, not by review

While adding M16 the mutation runner was blocked from executing: its cleanup did
`rm -rf` on the **parent directory** of any created mutant file. For a mutant
planted at `components/dashboard/__legacy_probe.tsx` that resolves to
`rm -rf components/dashboard` — 15 files of real application source, deleted as
"cleanup". The runner now deletes only the file it wrote, then only directories
it created itself, innermost first, and only while empty. Restoring a mutation
must never be able to destroy the tree.

## Round 4 review — BLOCK, and how it was resolved

Five holes, every one at a **scope boundary** — the same class as round 3. The
recurring lesson: the mutant set kept probing where the design already looked.
Each fix below now has a mutant that probes the boundary itself.

**H1 (critical) — file-extension boundary.** The scanner emitted only
`.ts/.tsx/.mts`. A `.js` route handler in a scanned directory was invisible to
the whole gate — and Next/SWC compiles and ships it, so it is a **live,
deployable, unguarded money route**. `allowJs: false` stops `tsc`, not the build.
It also defeated the scope self-audit, since that used the same walker.
*Resolved:* `.js/.jsx/.mjs/.cjs/.cts` are scanned; `ScriptKind` is chosen per
extension. Mutant **M18**.

**H2 (critical) — outbound HTTP was bypassable by ESM named import.** Patching
`lib.default.request` left `import { request } from "node:https"` fully live;
review issued a genuine TLS connection through it before a guard. *Resolved:*
`node:http`/`node:https` are now intercepted at the module-resolution layer, so
every import form resolves to the recorder. Mutant **M21**.

**H3 — `SKIP` was unanchored.** Any directory whose path merely contained `out`
(e.g. `lib/out/`) was skipped wholesale. *Resolved:* anchored patterns. Mutant **M19**.

**H4 — root-level source files were never scanned.** `SCAN_DIRS` held only
directories, so `middleware.ts` — which runs on **every production request** —
plus `instrumentation.ts` and the config files were outside the gate.
*Resolved:* root-level source files are scanned. Mutant **M20**.

**H5 — `IGNORED_TOP_LEVEL` was trusted, not verified.** Its comment claimed the
listed directories held no scannable source; nothing checked. *Resolved:* an
ignored directory containing source is now reported as unscanned. This
immediately surfaced `public/sw.js` — a real service worker that ships to
browsers — which was consequently added to the scan rather than ignored.

Scanned files: 287 → **395**.

### Standing limitation (unchanged, still not claimed)

`guarded` remains file-scoped and `inDeadBranch` recognises only literal
constant conditions. Full dominance analysis would misclassify the Stripe Edge
Function, whose writes live in helpers called from the guarded handler. The
inventory is a **discovery** tool; enforcement is the behavioural suite, which
covers all 18 writers. Review has confirmed across rounds that 0 of 18 are
misclassified.

## Round 5 review — BLOCK, and how it was resolved

**HOLE 1 (blocking) — exclusion by filename.** `SKIP` dropped `*.test.ts`, but
such a file is an ordinary module. Review wrote `lib/payments/vkhelper.test.ts`
containing a service-role write to three retired tables, imported it from a live
`app/api/.../route.ts` with no guard, and the gate reported `0 unguarded` with
198 tests green. A deployable unguarded money path, certified clean.
*Resolved:* the filename rule is gone; those files are scanned like any other.
Mutant **M22** reproduces the exact exploit.

**HOLE 2 (blocking) — the scope audit could not fire for the one directory it
named.** `out` was in `IGNORED_TOP_LEVEL`, and the "verified" check walked it
with `walkFiles`, whose own `SKIP` contained `^out(\/|$)` — so it always returned
empty. The verification was structurally incapable of reporting `out`,
`node_modules` or `.next`. *Resolved:* the audit now uses its own walker
(`auditWalk`) that deliberately does not honour `SKIP`. Mutant **M23**.

Also corrected: **M19 was named `writer-in-dir-named-out` but planted in
`lib/out/`**, implying coverage of root `out/` that did not exist. Renamed to
`M19-writer-in-nested-dir-named-out`; root `out/` is now M23. A mutant whose name
overstates its reach is its own kind of false evidence.

**HOLE 3 — "no outbound HTTP" was narrower than stated.** `node:net`,
`node:tls`, `node:dns` and global `WebSocket` were **silent-live**: review opened
a raw socket and the harness recorded nothing. No route uses them, so there was
no live leak — but the loader's own standard is that a claim holds because it is
enforced, not because nobody has written that code yet. *Resolved:* all are
recorded and blocked. Mutant **M24** opens a raw socket before a guard.

Scanned files: 287 → **398**. Mutants: 21 → **24**.

## Round 6 review — BLOCK, and how it was resolved

Both blocking findings were **one-line variants of mutants that already existed**
— the clearest possible demonstration that a mutant set proves only what it
actually varies.

**H1 — computed member access.** The walker matched only
`ts.isPropertyAccessExpression` with `name.text === "from"`, so
`db["from"]("donations").insert(...)` matched nothing at all: not a writer, not
even a dynamic site. That is mutant M5 with one character changed, and it shipped
as a deployable unguarded money route with the entire gate green.
*Resolved:* element access with a string literal is handled; a non-literal
computed method is reported as dynamic. Mutant **M25**.

**H2 — guard granularity was per FILE, not per handler.** Appending a second
exported handler to an already-guarded route inherited its guarded status.
Review added an unauthenticated `DELETE` that zeroes commitments; gate green.
*Resolved:* guards and writes are attributed to the enclosing function, and a
handler counts as guarded only if it — or a local function it transitively calls
— reaches the guard. The call graph is required, not optional:
`approve-member`'s `GET` is guarded only via `handleApproval`. Mutant **M26**.

**H3 — egress instrumentation covered functions, not classes or namespaces.**
`new net.Socket().connect(...)` genuinely **connected to api.stripe.com** with
nothing recorded; `dns.promises.resolve4` ran live; `child_process` was outside
the model entirely. *Resolved:* socket classes and `dns.promises` are wrapped and
blocked. `child_process` is **record-only, not blocked** — this suite legitimately
shells out to `git` and to the inventory script — which still means a route
exfiltrating through a subprocess appears in `__VK_CALLS` and fails the
"no side effects" assertion. Mutant **M27**.

Mutants: 24 → **27**.

## Round 7 review — BLOCK, and how it was resolved

Four of five findings were deployable exploits. All were the R6 defect re-entered
through syntax the analyzer did not recognise — which is the standing lesson of
this exercise: **a static gate proves only what its patterns happen to match.**

**H1 — arrow-function handlers.** `export const POST = async () => {}` is a
`VariableStatement`, not a `FunctionDeclaration`, so the per-handler detector
never registered it and fell back to the file-level flag — which was true because
a *different* handler carried the guard. The idiomatic Next.js form was the
blind spot. Mutant **M28**.

**H2 — re-export aliases.** `export { nukeIt as DELETE }` was never inspected.
Mutant **M29**.

**H3 — call-graph edges only followed bare identifiers.** A handler reaching its
write through `obj.helper()` recorded no edge, so it appeared write-free and
therefore guarded. Mutant **M30**.

**H4 — a destructured `.from` erased the write entirely.** `const { from } = svc`
matched no chain pattern, so the write was not misclassified — it was **absent
from the inventory**, making the "18/18 writers" census itself unsound.
*Resolved:* `.from` aliases are tracked, and — more importantly — **unresolvable
table references now FAIL the gate**. A gate that reports "0 unguarded" must fail
loudly on what it cannot analyse rather than omit it. Mutant **M31**.

**H5 — http2, dgram and worker_threads were silent-live.** `http2` is the
transport a modern Stripe/gRPC client would use. Worst of the three:
**a worker thread does not inherit this process's module hooks**, so code inside
one bypassed the entire interception mechanism rather than one channel — review
connected to api.stripe.com from a worker with nothing recorded. *Resolved:*
http2 and dgram are blocked; `Worker` construction is blocked outright. Mutant **M32**.

Mutants: 27 → **32**.

## Review status at commit — read this before deploying

Seven independent adversarial review rounds were run. **Every round returned
BLOCK**, and this is committed while round 7's findings are resolved but
unconfirmed by an eighth round. That is a deliberate, founder-approved decision,
and the reasoning should be visible to anyone reading this later.

**What the rounds actually found, and where.** Rounds 1–2 found defects in the
**shutdown itself**: only 5 of 18 writers guarded, and tests so vacuous that
inverting a guard left them green. Those are fixed and are covered by behavioural
tests and mutants M1–M15.

Rounds 3–7 found **no defect in the shutdown**. Every finding was in the
*verification machinery* — the AST inventory and the test loader — and every one
was demonstrated by planting hypothetical attacker code (`db["from"](...)`,
`export { x as DELETE }`, a worker thread opening a socket) that **does not exist
in this repository**. They are real weaknesses in the gate's ability to catch a
*future* writer; they were not live holes in the current shutdown.

**What is enforced today, by behavioural evidence:**

| | |
|---|---|
| Legacy writers, all server-enforced or write-suppressed | 18 / 18 |
| Residuals | 0 |
| Browser-side mutations to retired tables | 0 |
| Unscanned source directories | 0 |
| Unresolvable table references | 0 |
| Enabled positive controls that are mutation-precise | 14 / 14 |
| Killable mutants killed (+ null control) | 32 / 32 |
| Test suite | 198 / 198 |
| `tsc --noEmit` | clean |

**Known limitations, carried forward as follow-up — not blockers:**

1. `guarded` is per-handler but reachability is intra-file only. A write reached
   through an imported helper in another module is attributed at file level.
2. Dead-branch detection recognises only literal constant conditions;
   `const NEVER = false; if (NEVER) {...}` would still read as live.
3. Egress blocking is an explicit allowlist (`fetch`, `http`, `https`, `net`,
   `tls`, `dns`, `http2`, `dgram`, `WebSocket`, `Worker`; `child_process`
   recorded only). It is not a general property of the sandbox.
4. A backdoor keyed on untested input (e.g. a magic header) cannot be caught by
   any finite suite. This was accepted in round 2 and remains accepted.

None of these is exploitable by code currently in the repository. Each is a way a
*future* change could evade the gate, which is why they are written down rather
than left implicit.
