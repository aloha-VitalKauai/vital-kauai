-- Add 'additional_gift' to the donations kind check constraint.
-- Constraint name confirmed via pre-flight: donations_kind_check
ALTER TABLE donations
  DROP CONSTRAINT donations_kind_check,
  ADD CONSTRAINT donations_kind_check
    CHECK (kind = ANY (ARRAY[
      'initial_membership'::text,
      'journey_contribution'::text,
      'monthly_membership'::text,
      'other'::text,
      'additional_gift'::text
    ]));
