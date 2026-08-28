-- "The medicine" → "the root" / "plant ally" in the automated journey emails,
-- matching the code-side change in the same PR.
--
-- Iboga is named as a plant ally or as the root, used interchangeably as the
-- sentence wants. The word "medicine" still stands where it means something
-- else, which is why this is four targeted replacements rather than a blanket
-- one: "medicine music" in the ceremony protocol is a term of art for the
-- music itself and is deliberately left alone.
--
-- Data-only DML (no DDL, no schema change → lib/database.types.ts unaffected).
-- Idempotent: each guard stops matching once its replacement has run.
--
-- Reversal: run the inverse replacements over the same columns.

-- ── 1. "Questions for the Medicine" → "Questions for the Root" ───────────
-- The member-facing name of the /portal/questions feature, renamed in the
-- same PR. Founders have hand-edited these rows, so replace at the string
-- level over the action_items jsonb rather than rewriting whole rows.
update public.journey_email_templates
set action_items = replace(action_items::text,
      'Questions for the Medicine', 'Questions for the Root')::jsonb,
    updated_at = now()
where action_items::text like '%Questions for the Medicine%';

-- ── 2. Post-ceremony Week 1: the arrival line and its journalling prompt ─
update public.journey_email_templates
set intro = replace(intro,
      'The medicine is still moving in you.', 'The root is still moving in you.'),
    updated_at = now()
where intro like '%The medicine is still moving in you.%';

update public.journey_email_templates
set action_items = replace(action_items::text,
      'what the medicine showed you', 'what the root showed you')::jsonb,
    updated_at = now()
where action_items::text like '%what the medicine showed you%';

-- ── 3. Post-ceremony Week 6: the closing arc ─────────────────────────────
update public.journey_email_templates
set intro = replace(intro,
      'The medicine''s work continues', 'The root''s work continues'),
    updated_at = now()
where intro like '%The medicine''s work continues%';
