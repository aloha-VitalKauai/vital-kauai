# PR 4 preflight — is there anything to compare against?

**Date:** 2026-08-21 · **Method:** read-only. No write was issued against any
table, and no legacy table was touched at all.

PR 4 is specified as a *shadow/diff* page: "compare V2 figures against legacy
figures side by side." That premise has to be tested before any comparison is
built, because a diff against a reference that no longer means anything is worse
than no diff — it renders fabricated history with the authority of a report.

---

## 1. PR 2's import and variance artifact do not exist

`PR_PLAN.md` describes PR 2 as an importer:

> Two-pass import. Pass 1 imports payments; pass 2 imports historic refunds …
> Idempotency via the `(legacy_donation_id, entry_type)` unique index …
> **A per-member variance report against legacy figures.**
> **Done when:** the import is proven idempotent across repeated runs, refunds are
> correctly parented, and **the variance report is delivered for review**.

None of that was built. PR 2 was executed as **Clean-Start Activation and
Test-Data Isolation** — the importer, legacy mapping, import checkpoints, legacy
reconciliation, provenance tables, dry-run import reporting and import rollback
were all explicitly placed out of scope, and the founder's attestation was that
no genuine historical financial record existed to import.

Confirmed here rather than assumed:

| Evidence | Observation |
|---|---|
| `docs/financials-v2/` contents | `PR2_CLEAN_START_EVIDENCE.md` and `PR2_WIPE_RECOVERY_REDACTED.md` exist. **No variance report.** |
| `finance.ledger_entries` | **0 rows** — nothing was ever imported |
| `finance.agreements` | **0 rows** |
| `ledger_entries.legacy_donation_id` | column exists, never populated |

**So the artifact PR 4 was designed to display was never produced.** PR 4's
comparison premise is unsatisfiable as written. That is a documentation drift
between PR_PLAN (written before PR 2 was rescoped) and what PR 2 actually did —
not a defect in either.

---

## 2. What historical reference survives D-077 / D-078

Four candidates. Each was examined; none is a trustworthy financial reference.

### a. The retired tables — empty and frozen

`donations`, `financial_commitments`, `payment_tokens`, `payment_allocations`:
**0 rows each**, and frozen at the database level (12 `VK078` triggers, write
grants revoked). There is nothing in them to compare against, by construction.

### b. `public.audit_log` — a real record, of the wrong thing

This is the candidate that deserved actual scrutiny rather than dismissal. The
audit trigger captured `before_state` on every delete, so the wipe did not destroy
the *record* of what was wiped. 111 rows cover the retired tables.

Bucketed by when the delete happened:

| Bucket | Deleted | Completed | Refunded | Pending | Live-mode sessions |
|---|---|---|---|---|---|
| Before the wipe (Apr 2026) | 1 | 1 ($250) | 0 | 0 | 0 |
| **The D-077 wipe** (2026-08-14 01:32:05Z) | **20** | **0** | **2** | 18 | **0** |
| After the wipe (2026-08-19) | 1 | 0 | 0 | 1 | 0 |

**This corroborates D-077 exactly** — 20 rows, zero completed, two refunded, zero
live-mode identifiers — and independently, from a source D-077 did not cite. The
single `completed` row is a dev-era deletion four months earlier carrying no Stripe
session at all, outside D-077's scope; it does not contradict the decision.

It is nonetheless **not usable as a financial reference**, for three separate
reasons, any one of which is sufficient:

1. **It records money that never moved.** Of the 20 wiped donations: 0 completed,
   18 test-mode sessions, 0 live-mode. The amounts total roughly $17.5k across all
   deletes. Rendering that as "legacy figures" would put ~$17.5k of history on a
   founder's screen that was never revenue — precisely the misleading comparison
   this preflight exists to prevent.
2. **It is incomplete.** The audit trigger arrived in migration `20260418011828`
   (2026-04-18). Anything created before that date has no trail, so the record is
   not a complete history even of the synthetic data.
3. **Its attribution is degraded.** D-078 records that `fn_audit_trigger` reads the
   actor from the `app.actor_id` GUC, which PostgREST cannot set per request, so
   rows are attributed `actor_type = 'system'` rather than to a person.

Keep it as forensic evidence. Do not display it as financial history.

### c. `public.bookings` — operational, and internally inconsistent

11 rows, preserved by D-077 deliberately because its content is booking status
rather than financial history.

- `sum(amount_paid_cents)` = **0** — no money recorded as received, on any row
- `sum(amount_due_cents)` = **$7,000** — an intention, not a receipt

Using `amount_due` as a reference would present *what someone was expected to pay*
as *what was historically paid*. Worse, `PR2_WIPE_RECOVERY_REDACTED.md` records
that the surviving booking says **$7,000 due** while the deleted commitment for the
same participant said **$7,500 expected** — a discrepancy that predates the wipe
and is still unresolved. The two candidate references disagree with each other.

### d. `members.program_price` — a price list

A configured price is what someone *would* be charged, not a record of money
received. Excluded on the same grounds as `amount_due`.

---

## 3. Conclusion — clean start, and an honest unavailable-reference state

**No trustworthy historical financial reference survives.** The V2 ledger is also
empty (0 agreements, 0 ledger entries), so the comparison PR 4 was specified to
render would be *nothing against nothing*, dressed as a diff.

PR 4 therefore renders an explicit **reference-unavailable** state: it states that
no comparable historical figures exist, says why (D-077/D-078 and the clean-start
decision), and shows the canonical V2 figures alone. It does **not** synthesise a
comparison from zeroed tables, `members.program_price`, booking totals, audit-log
snapshots of test-mode rows, names, emails, or amount/timestamp coincidence.

The delta column is retained in the layout but reads *unavailable* rather than a
number, so that when PR 5 begins recording real external payments and PR 6 real
Stripe money, the same surface starts showing genuine deltas without being rebuilt.

---

## 4. What PR 4 needs that does not yet exist

Verified against the live database:

**Already present**
- `finance.resolve_exception` and `finance.release_quarantine` — both `EXECUTE` to
  `authenticated`, both setting actor and timestamp internally
- `finance.v_member_financials`, `finance.v_journey_financials`,
  `finance.v_agreement_balances`, `finance.v_agreement_lifecycle`
- `finance_api.reconciliation_exceptions` (read view, `security_invoker`)

**Missing — PR 4 must add, to `finance_api` only**
- `finance_api.resolve_exception(...)` and `finance_api.release_quarantine(...)`
  — SECURITY INVOKER wrappers, `EXECUTE` to `authenticated` only. `finance` stays
  private; the wrappers add no privilege, so `is_founder()` inside the underlying
  functions remains the authorisation, and actor/timestamp stay database-generated.
- Read views over `v_member_financials` and `v_journey_financials`, with
  `security_invoker = true` so founder RLS is evaluated as the caller.

**Explicitly out of scope for PR 4:** any member-facing surface, payment
collection, contribution amendment, external-payment recording, the reversal flow,
any legacy write, and the saved Financials dashboard (PR 7) or member Contribution
portal (PR 8).
