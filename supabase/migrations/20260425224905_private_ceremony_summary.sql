-- private_ceremony_summary: per-private-journey financial rollup
--
-- Mirrors cohort_margin_summary but at the journey level for journeys with
-- booking_type = 'private'. Lets the Financials dashboard show each private
-- ceremony member's pay in one place: booked, collected, expenses, payouts,
-- margin.
--
-- Booked is derived with the same fallback ladder used by financials_overview:
--   1) commitments tied directly to this journey
--   2) member-level commitments not tied to any journey
--   3) legacy members.program_price * 100
--
-- Collected only counts donations attributed to this journey_id, so a
-- member's separate initial_membership payment is not double-counted here.

CREATE OR REPLACE VIEW public.private_ceremony_summary AS
SELECT
  j.id                                              AS journey_id,
  j.member_id                                       AS member_id,
  COALESCE(mp.full_name, m.email, 'Member')         AS member_name,
  j.status                                          AS journey_status,
  j.schedule_type                                   AS schedule_type,
  j.start_at                                        AS start_at,
  j.end_at                                          AS end_at,
  COALESCE(
    (SELECT SUM(fc.expected_amount_cents)::bigint
       FROM financial_commitments fc
      WHERE fc.journey_id = j.id
        AND fc.status NOT IN ('canceled','waived')),
    (SELECT SUM(fc.expected_amount_cents)::bigint
       FROM financial_commitments fc
      WHERE fc.member_id = j.member_id
        AND fc.journey_id IS NULL
        AND fc.status NOT IN ('canceled','waived')),
    ROUND(COALESCE(m.program_price, 0)::numeric * 100)::bigint,
    0::bigint
  )                                                 AS booked_cents,
  COALESCE(
    (SELECT SUM(d.amount_cents)::bigint
       FROM donations d
      WHERE d.journey_id = j.id
        AND d.status = 'completed'),
    0::bigint
  )                                                 AS revenue_cents,
  COALESCE(
    (SELECT SUM(e.amount_cents)::bigint
       FROM expense_entries e
      WHERE e.journey_id = j.id),
    0::bigint
  )                                                 AS expense_cents,
  COALESCE(
    (SELECT SUM(p.amount_cents)::bigint
       FROM payout_commitments p
      WHERE p.journey_id = j.id
        AND p.status <> 'canceled'),
    0::bigint
  )                                                 AS payout_cents
FROM journeys j
LEFT JOIN members m         ON m.id = j.member_id
LEFT JOIN member_profiles mp ON mp.id = j.member_id
WHERE j.booking_type = 'private';
