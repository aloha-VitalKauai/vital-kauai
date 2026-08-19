# PR 2 — Clean-start evidence

Status: resolved by **founder attestation**, not by row-level falsification. Read §3
before relying on this document for any deletion decision.

## 1. What was established

| Item | Result | Source |
|---|---|---|
| `finance` schema in production | ABSENT | F00b, executed 2026-08-03 |
| PR 1 objects expected once deployed | 9 tables, 5 views | PR 1 migrations, canonical manifest |
| Legacy surface in `public` | 52 tables, 38 views, 113 policies, 61 triggers | F00b |
| `pgcrypto` available for tokenization | present | F00a |
| Server | PostgreSQL 17.6 (`170006`) | F00a |

## 2. E10 — founder attestation (the governing evidence)

On 2026-08-03 the founder (Josh), who is the primary source and the person who built the
system, attested directly:

> All existing financial records are test data. Vital Kauai does not yet have a supported
> financial system.

This is first-hand knowledge from the only person positioned to know whether the
organisation has ever taken a real payment. Under E10 it was always intended to come from
a human rather than from a query, and it is the strongest single piece of evidence
available.

## 3. What this attestation does and does not cover — stated plainly

**Covers:** provider-processed money. If no payment system ever existed, there can be no
genuine Stripe charge, PaymentIntent, or Checkout Session record.

**Does not fully cover:** manually recorded offline money. A real member who genuinely paid
by cheque, cash, Venmo or bank transfer, whose payment was hand-entered into a legacy
donations or commitments row, would be a REAL record even though no payment system existed.
Nothing in this phase examined that possibility at row level.

The founder elected path A (accept and move) over path B (one aggregate query checking for
financial rows attached to authenticated members, non-round amounts, or external-payment
markers). That was an informed choice made after this limitation was stated.

## 4. Why the residual risk is acceptable here

The `clean_start_claim` verdict exists to gate **cleanup**. Its entire purpose is to decide
whether rows may be deleted, because deletion is unrecoverable and there is no importer to
restore from.

**No deletion is planned.** Decision P2-D1 below makes that standing. With no deletion, a
misclassified row costs nothing: it stays where it is, and it cannot reach a `finance`
balance.

That isolation is structural, not incidental, and was proven in PR 1:

- no `finance` object holds a foreign key into a legacy financial table (ST-017)
- no migration writes a legacy financial table (ST-018)
- no `finance` routine body references a legacy financial table (ST-019)
- canonical balances derive only from `finance.ledger_entries`, filtered to `livemode = true`
- offline and imported money cannot be recorded as `livemode = false` (`ledger_l11_offline_livemode`)

The clean-beside-legacy architecture from PR 0 is what makes this true. `finance` never reads
`public`'s money tables, so there is no contamination path to sever.

## 5. Verdict

`clean_start_claim` remains **UNVERIFIED**, deliberately.

The enum values SUPPORTED and WEAK both require the assertion "zero REAL, zero UNPROVEN
rows". No row was classified, so that assertion cannot honestly be made. Recording WEAK
would overstate the evidence. UNVERIFIED with a recorded attestation is the accurate state.

This blocks nothing that is actually planned, because the only thing the verdict gates is
cleanup, and cleanup is not happening.

## 6. Open item, carried forward

If deletion of legacy financial rows is ever proposed, this document is **not** sufficient
authority. Path B, or an equivalent row-level examination under the asymmetry rule, must be
run first.
