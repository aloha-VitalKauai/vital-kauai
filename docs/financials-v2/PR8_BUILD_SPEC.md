# PR 8 — Member Contribution Portal build specification

Status: implementation-ready
Owner: Financials V2
Decision: D-085
Depends on: PR 5 founder agreements; PR 6 checkout protocol and closeout; PR 7 founder command center
Canonical member URL: `/portal/donate`
Design reference: `design/pr8-member-contribution-portal.html` and `design/pr8-member-contribution-portal-3x4.svg`

The design files use illustrative amounts and activity only. They define layout,
hierarchy, language and states; implementation must render authenticated canonical
V2 data and must never hard-code the examples.

## 1. Outcome in one sentence

Give each signed-in member one calm, trustworthy place to understand their
Contribution, see what Vital Kauaʻi has received, pay the full amount that remains
through secure Stripe Checkout, make a clearly separate additional gift, and
review a truthful payment history — entirely from Financials V2.

This is not a new payment engine. PR 6 is the payment engine. PR 8 is the
member-safe authorization, read model and experience on top of it.

## 2. Non-negotiable product rules

- **V2 only.** No legacy table, view, route, flag-off figure or browser-side
  Supabase legacy query may supply a financial value.
- **Unknown is not zero.** If a canonical read fails, render an error/unavailable
  state. Never manufacture $0.
- **Received means net money received.** Refunds and attributed reversals reduce
  Received. Use canonical database values; React performs formatting, not money
  arithmetic.
- **Contribution and gift are different facts.** A gift is stored under a
  separate `additional_gift` agreement, counts in total Received, and never
  changes a Contribution agreement's Remaining.
- **The member cannot choose a partial Contribution amount.** Checkout charges
  the current server-derived `payable_remaining_cents`. Payment plans and
  installments are a later product.
- **One money action per state.** The dominant copper button either creates or
  resumes secure checkout. Secondary actions are quiet links.
- **No secret or internal data in the participant surface.** Never return founder
  reasons, actor UUIDs, Stripe object ids, idempotency keys, raw exception data or
  reconciliation metadata.
- **No custom card form.** The portal hands off to hosted Stripe Checkout. Card
  data never touches Vital Kauaʻi infrastructure.
- **No duplicated checkout protocol.** PR 8 calls the shared PR 6 service and
  database transition functions; it does not implement a second Session state
  machine.
- **Readability remains when checkout is paused.** `FINANCE_V2_CHECKOUT_READY`
  gates issuance/resumption only. It never changes the read source.

## 3. Approved member language

Keep this verbatim in the first implementation pass:

> YOUR CONTRIBUTION
>
> Thank you for your contribution.
>
> Your contribution is always welcome and appreciated. It opens the door for
> members called to this work who carry fewer resources, so they can be met with
> the same care.
>
> It supports the ʻāina of Kauaʻi’s North Shore and the nonprofits we walk
> alongside who protect and preserve this land. And it sustains the church
> itself, the people, practice, and ceremony at the heart of Vital Kauaʻi.

Terminology:

| Internal fact | Member-facing label |
| --- | --- |
| agreed amount | Contribution |
| net received | Received |
| remaining amount | Remaining |
| unpaid | Payment needed |
| partial | Partially received |
| paid | Received in full |
| overpaid | More than Contribution received |
| refunded | Refunded |
| not_applicable | Gift |
| stripe_payment | Card payment |
| external_payment | Recorded payment |
| reversal/refund entry | Refund or correction |

Do not use “debt,” “collections,” “invoice,” “donation balance,” or “amount owed.”

## 4. Information architecture

### 4.1 Page shell

- Keep `/portal/donate` so existing home and mobile links do not break.
- Change navigation labels from Donate/Submit to **Contribution**.
- `/portal/journey/payment` and `/portal/onboarding/donation` become server
  redirects to `/portal/donate`; they do not render old financial components.
- Use the existing authenticated portal shell and safe-area/mobile conventions.

### 4.2 Section order

1. Approved Contribution message.
2. Contribution overview.
3. Individual Contribution agreements.
4. Additional gift.
5. Payment activity.
6. Small support/help footer.

### 4.3 Overview

Display four facts from one member-safe database view:

- **Contribution** — sum of active contribution-applicable agreement amounts.
- **Received** — net received across the member's V2 ledger, including gifts.
- **Remaining** — canonical contribution Remaining only.
- **Payment state** — plain-language state; for multiple agreements show a
  neutral summary such as “2 active Contributions,” not an invented aggregate
  enum.

If gifts exist, add the quiet line: “Received includes $X in additional gifts.”
Do not place gift money in a Contribution progress bar.

### 4.4 Agreement cards

One card per active/draft contribution-applicable agreement:

- purpose label and optional journey name;
- Contribution, Received and Remaining;
- state chip;
- progress bar based only on that agreement's canonical values;
- state-aware primary action.

Primary action matrix:

| State | Action |
| --- | --- |
| active + payable remaining + ready | Continue to secure payment |
| existing open Session | Resume secure payment |
| processing | disabled Payment processing + explanatory line |
| paid | no money button; Received in full confirmation |
| refunded | no money button; show refund status and support link |
| overpaid | no money button; “We received more than the Contribution. We will contact you if action is needed.” |
| draft/canceled/completed | no checkout action |
| checkout flag off | disabled action + “Secure card payment is temporarily unavailable. Nothing has been charged.” |

### 4.5 Additional gift

This is visually separated after the Contribution facts.

- Heading: **Make an additional gift.**
- Supporting line: “An additional gift is separate from your Contribution and
  never changes what remains.”
- Presets: $50, $100, $250, $500, Custom.
- Custom amount: whole dollars in the UI, converted to cents at the server
  boundary; minimum $5, maximum $25,000 per checkout.
- Button: **Continue with gift.**

Server creates/reuses a separate `additional_gift` agreement and Checkout
attempt atomically. Never attach a gift to a contribution-applicable agreement.
If there is no Contribution agreement, the member may still make a gift.

The limits are an organizational risk policy, not a Stripe capability claim.
Changing them requires one named server constant plus its tests; never a hidden
client-only limit.

### 4.6 Payment activity

Newest first. Each row contains only:

- occurred date;
- purpose/journey label;
- method (Card payment, Recorded payment, Refund or correction);
- signed, formatted amount;
- plain-language status/type.

Refunds and reversals are negative. Never expose founder-entered reasons, actor
identity, provider ids or raw metadata. Empty state: “No Contribution activity
yet. New activity will appear here after it is received.”

## 5. Member-safe database surface

Add one tracked migration. The exact timestamp is assigned at implementation.
Every object is in `finance_api`; `finance` remains private.

### 5.1 Views

All views use `security_invoker = true`, carry an explicit
`finance.current_member_id()` boundary, and grant SELECT to `authenticated`
only.

**`finance_api.member_contribution_overview`** — exactly one row for the current
member, with: `member_id`, `contribution_cents`, `contribution_received_cents`,
`additional_gifts_received_cents`, `net_received_cents`, `refunded_cents`,
`remaining_cents`, `payable_remaining_cents`, `active_agreement_count`.
All amounts come from canonical V2 views. Define zero-row aggregates in SQL.

**`finance_api.member_contribution_agreements`** — only the current member's V2
agreements, with safe presentation fields: `agreement_id`, `journey_id`,
`purpose`, `contribution_cents`, `received_cents`, `refunded_cents`,
`remaining_cents`, `payable_remaining_cents`, `payment_state`.
No founder reason, actor, provider or idempotency fields.

**`finance_api.member_payment_activity`** — only the current member's live
ledger activity, with: `entry_id`, `agreement_id`, `journey_id`, `purpose`,
`entry_type`, `amount_cents`, `occurred_at`. No reason, created_by, provider
ids, parent id, metadata or reconciliation fields.

**`finance_api.member_checkout_status`** — only the current member's attempts,
with presentation-safe fields: `attempt_id`, `agreement_id`, `amount_cents`,
`status`, `expires_at`, `created_at`, `completed_at`. Do not expose
`stripe_session_id`, `payment_link_id` or the Stripe/idempotency key. The route
may use the opaque V2 `attempt_id` for bounded status polling.

### 5.2 Close the broad-history exposure

The current broad authenticated façades were created for founder controls before
the member portal existed. PR 8 must not leave their internal columns callable by
a member merely because the UI hides them.

- Add explicit founder-only replacement views for any fields PR 5/7 controls
  need (`finance_api.founder_agreement_amount_history`,
  `finance_api.founder_ledger_history`, and
  `finance_api.founder_checkout_sessions`), each with `public.is_founder()` in
  the view definition.
- Move PR 5/7 API and dashboard reads to those views.
- Revoke broad `authenticated` access to internal
  `finance_api.agreement_amounts`, `finance_api.ledger_entries` and
  `finance_api.checkout_sessions` views. Retain only the exact `service_role`
  access used by the machine checkout path.
- Keep `finance_api.payment_links` founder-readable only through its existing
  underlying founder RLS; verify a normal member sees zero. If a consumer needs
  broader access, replace it with a bounded view instead of weakening RLS.
- Assert in the migration that a normal authenticated member cannot read a
  founder reason, actor UUID, Stripe Session id, payment-link id or provider
  identifier through any exposed view.
- Preserve founder controls and service-machine access exactly where required.
  Do not solve this by filtering columns in React.

## 6. Authenticated member checkout

### 6.1 Route

Add `POST /api/finance/member-checkout`.

Accepted bodies:

```json
{ "kind": "contribution", "agreementId": "uuid", "requestId": "uuid" }
{ "kind": "additional_gift", "amountCents": 5000, "requestId": "uuid" }
```

Rules:

- `requestId` is generated once per user intent and reused on retries.
- Contribution requests reject any amount property. The database derives the
  full current `payable_remaining_cents` under lock.
- Gift requests are the only requests that accept an amount.
- Authenticate with the caller's Supabase session first. Do not accept
  `memberId`, email, role or identity from the body.
- The authenticated database function performs member ownership/eligibility and
  creates or returns the attempt. Only after that succeeds may service-role code
  call Stripe/finalize the attempt.
- Response is either a hosted Checkout URL to redirect to, a resumable existing
  URL, or a typed refusal. Never return the Stripe secret or internal metadata.

### 6.2 Database functions

Add SECURITY DEFINER functions with fixed `search_path`, revoked from PUBLIC:

**`finance.begin_member_contribution_checkout(agreement_id, request_id)`** —
EXECUTE `authenticated`. It:

- resolves the member through `finance.current_member_id()`;
- locks the agreement/balance;
- proves the agreement belongs to that member and is active;
- proves `payable_remaining_cents > 0`;
- refuses a client amount because none is accepted;
- returns/resumes an eligible live attempt or atomically creates a new attempt
  using the canonical full remaining amount;
- persists a deterministic key such as
  `vk2_member_contribution_<current-member-id>_<request-id>` in the existing
  unique `checkout_sessions.idempotency_key` column. A replay queries by that
  key and returns the existing attempt.

**`finance.begin_member_gift_checkout(amount_cents, request_id)`** — EXECUTE
`authenticated`. It:

- resolves the current member;
- validates USD cents and the server gift bounds;
- atomically creates or reuses the request's separate `additional_gift`
  agreement, its required initial draft lifecycle fact, its amount, the
  draft → active lifecycle fact, and the Checkout attempt;
- returns the same attempt for a replay of the same request;
- never changes a Contribution agreement.

Use the existing unique Checkout idempotency key as the request binding, e.g.
`vk2_member_gift_<current-member-id>_<request-id>`. On replay, find that attempt
and return its agreement/attempt. The agreement and attempt are created in one
transaction, so a failed insert leaves neither. Add a new field only if execution
proves this cannot be done without ambiguity. Never use amount-and-time
coincidence as identity.

### 6.3 Shared PR 6 service

Extract/reuse a single checkout service called by both the founder token bridge
and the member route. It owns:

- retrieve/reuse of a still-valid Stripe Session;
- stale-session confirmed-expiry before replacement;
- Stripe Session creation with the attempt's persisted idempotency key;
- metadata (`attempt_id`, `agreement_id`, purpose, mode);
- success/cancel URLs;
- database finalization and typed recovery.

The one-live-Session database constraint remains the final concurrency boundary.

## 7. Page/API read route

Add a member endpoint or server loader that reads the three member-safe views with
the user's session. Prefer a server component plus a small client island for
checkout actions. Return one explicit DTO; do not send raw Supabase rows into the
browser.

The DTO includes `checkoutReady` from the server-only readiness flag. It never
includes the flag's raw value or any secret.

## 8. State and failure design

| Condition | Member experience | HTTP/server behavior |
| --- | --- | --- |
| unauthenticated | redirect to login | 401 for API |
| V2 read failure | “We couldn't load your Contribution details.” + Retry | logged 5xx; no $0 fallback |
| no agreement | warm empty state + gift area | 200 |
| checkout not ready | figures remain visible; disabled payment action | 503 `checkout_unavailable` on direct POST |
| invalid ownership | generic unavailable message | 404, not 403, to avoid enumeration |
| no payable remaining | refresh state; no Session | 409 typed response |
| existing open Session | resume it | 200 same attempt/URL |
| Stripe temporary failure | calm retry message; attempt remains recoverable | 502/503 typed response |
| canceled return | no success claim; offer Resume | Session remains recoverable |
| success return before webhook | “Payment received by Stripe; confirming…” | poll bounded status only |
| webhook processed | thank-you state + refreshed canonical figures | no client-authored money state |
| refunded/overpaid | explicit factual copy, no checkout action | 200 |

Never use an infinite spinner. Bounded confirmation polling stops and tells the
member that confirmation can take a moment without implying failure or success.

## 9. Visual system

- Canvas: warm ivory `#F6F1E8`. Paper: `#FFFDF8`.
- Forest: `#0D2118`; secondary `#173529`.
- Sage: `#B7C9B8`; soft sage `#E7EFE7`.
- Copper action: `#A6653F`; hover `#8F5434`.
- Ink: `#18211C`; muted ink `#687169`.
- Display: existing editorial serif; body: existing portal sans.
- 12–16px card radius, 1px warm border, almost no shadow.
- Desktop content width 960–1040px. Mobile single column with 20px gutters.
- Minimum 44px touch targets, visible focus, semantic headings and form labels.
- No confetti, urgency, countdowns, progress gamification or fake security marks.

## 10. Files expected to change

Exact names may follow repository conventions, but scope should resemble:

- one tracked migration for member-safe views/functions/grant closure;
- `/app/api/finance/member-checkout/route.ts`;
- shared PR 6 checkout service extraction;
- `/app/portal/donate/page.tsx` and a focused client component;
- redirects at the two superseded portal payment routes;
- portal home/mobile Contribution labels;
- PR 5 founder history reads moved to founder-only views;
- tests, inventory manifest, D-085/docs.

No legacy writer is edited. No `finance` schema is exposed through PostgREST.

## 11. Acceptance tests — blocking

### Authorization and privacy

1. Anonymous users cannot read or begin member checkout.
2. Member A cannot read Member B's overview, agreements, activity or Session.
3. Supplying another agreement id returns 404 and creates zero rows/Stripe calls.
4. A client-supplied member id/email/role is ignored or rejected.
5. `finance.current_member_id()` is the identity boundary.
6. Member-safe responses contain no founder reason, actor UUID, provider id,
   Stripe Session id, payment-link id, idempotency key or reconciliation metadata.
7. Direct PostgREST access by a normal member cannot retrieve those internal
   fields from old façade views.
8. Founder PR 5 history/reversal controls and PR 7 checkout-health reads still
   work after grant closure.

### Money truth

9. Zero-row overview returns real zeros, not nulls.
10. A read failure renders unknown/error, not zeros.
11. Received is net of refunds and reversals.
12. Gift money appears in total Received and additional gifts, not Contribution
    Received or Remaining.
13. Overpayment and refund states match canonical database views.
14. React/client code performs no balance arithmetic.

### Contribution checkout

15. The browser cannot submit or alter a Contribution amount.
16. Checkout uses the locked, current full `payable_remaining_cents`.
17. Founder amendment between render and click uses the new amount.
18. Paid/draft/canceled/completed/no-balance agreements cannot begin checkout.
19. Double-click and request replay return the same attempt/Session.
20. Concurrent token-link and member-portal attempts produce at most one live
    Session per agreement/mode.
21. A valid existing Session resumes; an obsolete amount must be confirmed
    expired before replacement.
22. Stripe failure leaves a recoverable attempt and never a false success.

### Gift checkout

23. Presets and valid custom amounts create `additional_gift`, never a
    contribution-applicable agreement.
24. Values below $5, above $25,000, fractional/NaN/negative/overflow values
    are refused before Stripe.
25. Replaying the same gift request returns the same agreement/attempt/Session.
26. Two separate intentional gifts of the same amount create two distinct facts.
27. A member with no Contribution agreement can make a gift.

### End-to-end and states

28. Checkout readiness off leaves reads available and all issuance fail-closed.
29. Cancel return never says paid and offers Resume.
30. Success return before webhook says confirming, not paid.
31. Duplicate webhook delivery moves the ledger/balance exactly once.
32. PaymentIntent success works without a Checkout Session webhook.
33. Refund webhook reduces Received and updates the member state.
34. Processing polling is bounded and accessible.
35. Old portal payment URLs redirect to `/portal/donate` without legacy reads.
36. Desktop, 768px, 390px and 320px layouts have no horizontal overflow.
37. Keyboard-only checkout/gift selection, error recovery and focus return work.
38. Currency is announced accessibly and amounts use locale formatting.
39. No secret, raw Stripe payload or personal financial detail is logged.
40. Writer inventory changes are inspected; no legacy writer/read residual is
    added or reclassified.

### Launch evidence

41. PR 6 outstanding sweepers and bounded review are complete.
42. Controlled live checkout proves: member click → Stripe → signed webhook →
    worker → one ledger entry → canonical balance → member thank-you state.
43. Cancel/resume, expiry, duplicate-delivery, refund and revocation drills pass.
44. `FINANCE_V2_CHECKOUT_READY=true` is set only after 41–43 pass.
45. Legacy flags remain absent and legacy tables remain frozen/zero.

## 12. Implementation sequence

1. Preflight current grants, view columns and PR 6 closeout state; record evidence.
2. Add migration and role-matrix tests for safe reads, functions and grant closure.
3. Move founder history consumers, then prove PR 5 remains intact.
4. Extract the shared PR 6 checkout service with no behavior change.
5. Add authenticated contribution checkout and its concurrency/idempotency tests.
6. Add gift checkout and its request-identity tests.
7. Build the server read DTO and page state matrix.
8. Replace/redirect legacy member routes and update navigation labels.
9. Run unit/integration/type/build/inventory/accessibility/responsive gates.
10. Run one bounded adversarial review focused on authorization, privacy,
    idempotency, amount derivation and state truth; resolve findings.
11. Deploy with checkout still fail-closed if PR 6 launch evidence is incomplete.
12. Execute launch drills; only then enable checkout.

## 13. Definition of done

PR 8 is done when a member can see only their truthful V2 Contribution position,
complete or resume a secure full-remaining card checkout, optionally make a
separate gift, and see the resulting net activity — while another member, an
anonymous caller, client tampering, retries, concurrent clicks and internal
façade probing cannot reveal private fields or create duplicate/mis-priced money.

---

## Amendment — production copy and gift policy (D-086, 2026-08-22)

The approved language in §3 and the presets in §4.5 were amended in production
after PR 8 shipped. The **live** text and policy, which PR 9 preserves and must
not reopen, are:

**Hero copy** (GitHub #910, amended by D-089):

> YOUR CONTRIBUTION
>
> Mahalo for your contribution.
>
> ~~Your support helps us provide scholarships for members in need, particularly
> for our first responders and essential workers.~~
>
> Your membership contribution goes toward your entire journey—six weeks of
> preparation, eight days on Kauaʻi, and six weeks of integration.

The scholarship sentence moved to the additional-gift section under D-089,
reworded to "Your gift", because scholarships are funded by gifts rather than
by a member's own Contribution.

**Gift presets** (GitHub #911): **$500, $2,500, $5,000, $15,000**, plus Custom.

**Gift bounds** (GitHub #913): whole dollars, **$5 minimum, $5,000,000 maximum**.
#911 raised the browser ceiling only; the server constant and the database check
were still $25,000, so any custom gift between the two was accepted by the UI and
then refused with a generic error — the hidden client-only limit this spec
forbids. #913 aligned all three layers and added a test that derives both
ceilings from source and fails if they diverge again.

This is *our* risk ceiling only. Card networks and Stripe impose their own
per-charge limits far below it, so a gift near the maximum would be declined by
the issuer long before it reached the ledger. Declines are rendered truthfully
and are never represented as payment.
