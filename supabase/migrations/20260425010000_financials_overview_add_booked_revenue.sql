-- financials_overview: add booked_revenue_cents + enrolled_members
--
-- "Booked" was previously computed client-side from members.program_price,
-- which left out anyone whose pledge lives in financial_commitments
-- (e.g. members onboarded through the new commitment flow). The result was
-- the Overview/Financials/Ops dashboards disagreeing about expected revenue
-- after a guide adjusted a member's commitment.
--
-- This view now exposes a single canonical booked_revenue_cents that prefers
-- the sum of active financial_commitments per member and falls back to
-- legacy members.program_price when no commitment exists.

CREATE OR REPLACE VIEW public.financials_overview AS
SELECT
  COALESCE((SELECT SUM(donations.amount_cents)
              FROM donations
             WHERE donations.status = 'completed'
               AND donations.kind IN ('initial_membership','journey_contribution')), 0::bigint) AS total_revenue_cents,
  COALESCE((SELECT SUM(donations.amount_cents)
              FROM donations
             WHERE donations.status = 'completed'
               AND donations.kind = 'initial_membership'), 0::bigint) AS onboarding_revenue_cents,
  COALESCE((SELECT SUM(donations.amount_cents)
              FROM donations
             WHERE donations.status = 'completed'
               AND donations.kind = 'journey_contribution'), 0::bigint) AS journey_revenue_cents,
  COALESCE((SELECT SUM(expense_entries.amount_cents) FROM expense_entries), 0::bigint) AS total_expenses_cents,
  COALESCE((SELECT SUM(payout_commitments.amount_cents)
              FROM payout_commitments
             WHERE payout_commitments.status <> 'canceled'), 0::bigint) AS total_payouts_cents,
  COALESCE((SELECT SUM(payout_commitments.amount_cents)
              FROM payout_commitments
             WHERE payout_commitments.status = 'pending'), 0::bigint) AS payouts_pending_cents,
  COALESCE((SELECT SUM(payout_commitments.amount_cents)
              FROM payout_commitments
             WHERE payout_commitments.status = 'scheduled'), 0::bigint) AS payouts_scheduled_cents,
  COALESCE((SELECT SUM(payout_commitments.amount_cents)
              FROM payout_commitments
             WHERE payout_commitments.status = 'paid'), 0::bigint) AS payouts_paid_cents,
  COALESCE((SELECT SUM(member_booked.cents) FROM (
    SELECT
      COALESCE(
        (SELECT SUM(fc.expected_amount_cents)::bigint
           FROM financial_commitments fc
          WHERE fc.member_id = m.id
            AND fc.status NOT IN ('canceled','waived')),
        ROUND(COALESCE(m.program_price,0)::numeric * 100)::bigint
      ) AS cents
    FROM members m
  ) member_booked), 0::bigint) AS booked_revenue_cents,
  (SELECT COUNT(*) FROM members)::bigint AS enrolled_members;
