# PR 8 implementation directive for Claude

Build PR 8 from `origin/main` using `docs/financials-v2/PR8_BUILD_SPEC.md` as
the controlling contract. Read D-085, PR 6 migrations/services, PR 5
member-profile controls, and the current portal routes before editing.

## Mission

Replace the member's retired financial experience with one V2-only Contribution
Portal at `/portal/donate`. It must show canonical Contribution/Received/Remaining,
allow full-remaining Stripe Checkout through PR 6, support a separate additional
gift, and show a member-safe activity history in the approved design.

## Do not reinterpret these decisions

- No legacy financial reads or fallbacks. No financial read flag.
- Keep `/portal/donate` as the stable URL; redirect the two older payment pages.
- “Contribution” is primary. A gift is separate and never changes Remaining.
- Contribution amount is never accepted from the browser. Charge the locked
  server-derived full payable remaining amount.
- Reuse PR 6's attempt/idempotency/Session/recovery service. Do not create a
  second checkout state machine.
- Authorization is `finance.current_member_id()`, not a request member id and not
  `auth.users.id` treated as `members.id`.
- Do not expose founder reasons, actor ids, provider ids, idempotency keys or raw
  reconciliation data to members, including by direct PostgREST calls.
- Do not enable checkout until the PR 6 closeout and PR 8 launch evidence pass.

## Required work order

1. **Read-only preflight.** Verify the actual database grants, exposed façade
   columns, checkout function signatures, one-live index, current cron drivers and
   readiness flag. Explicitly report any mismatch with the build spec.
2. **Privacy migration first.** Add member-safe views and member checkout
   functions. Move PR 5 history reads to founder-only views, revoke broad member
   access to internal history, and prove the four-role matrix behaviorally in a
   rolled-back production transaction.
3. **Shared checkout service.** Extract the PR 6 create/reuse/finalize logic and
   lock its existing behavior with tests before adding member callers.
4. **Member checkout route.** Contribution derives full remaining in Postgres;
   gift uses a distinct, idempotent `additional_gift` agreement.
5. **Member UI.** Use the exact approved copy and design references. Implement the
   full state matrix; React formats but does not calculate money.
6. **Retire rendered legacy member paths.** Redirect old routes and relabel portal
   navigation. Do not alter a legacy writer merely to make the inventory quiet.
7. **Gates and one bounded review.** Run all 45 acceptance requirements, existing
   tests, `tsc`, production build and inventory. The review is bounded to PR 8's
   authorization, privacy, amount truth, idempotency, concurrency and member-state
   claims.
8. **Deploy fail-closed if needed.** Finish PR 6 recovery/controlled-live evidence
   before setting `FINANCE_V2_CHECKOUT_READY=true`.

## Proof standard

“The UI hides it” is not privacy proof. “The button is disabled” is not checkout
proof. “Stripe usually deduplicates” is not idempotency proof. Demonstrate the
database/route behavior with adversarial requests and rolled-back production-safe
tests. Every claimed state must be observable from the canonical V2 facts.

Stop and report before mutation if the preflight finds that implementing this
requires weakening an existing database invariant, exposing `finance`, granting
members service-role capability, or accepting a Contribution amount from the
client.
