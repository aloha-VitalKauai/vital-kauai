# PRs 10–14 — roadmap

PR 9 leaves a clean, trustworthy V2 platform. Everything below is explicitly
**out of scope** for PR 9 and proceeds in its own PR.

| PR | Scope | Blocking preflight |
| --- | --- | --- |
| **10** | Public reusable choose-your-own-amount contribution QR | Must first settle Church-versus-LLC fund attribution. A public gift has no member identity, so it cannot reuse the member checkout path, and it must never be implemented through a fake member or an unattributed V2 payment. |
| **11** | Append-only expenses and payouts, with voids rather than hard deletes | Owns the expense/payout entry surface that PR 9 deliberately left in place, and the delete/void control that PR 9 was forbidden to add. |
| **12** | Donor CRM, anonymous-donor identity, tax receipts and year-end statements | Depends on PR 10's attribution decision. |
| **13** | Legal-entity / fund accounting and general ledger | Depends on PR 11. |
| **14** | Bank feeds, payroll, tax filing | Last; depends on 11–13. |

Recurring payments, installments, subscriptions and any historical financial
reconstruction remain out of scope across all of the above unless separately
commissioned.
