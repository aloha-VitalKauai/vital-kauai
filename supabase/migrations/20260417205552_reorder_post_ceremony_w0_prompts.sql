-- Reorder post-ceremony Week 1 (LŌKAHI / Unity) journal-prompt keys.
--
-- The Comprehensive Journal and the weekly post-ceremony page share
-- positional keys of the form `w<week>-p<prompt>`. Reordering the
-- prompts in `lib/journal-prompts.ts` therefore shifts the meaning of
-- any answers already stored in `post_ceremony_progress.journal_responses`
-- under the old indices. This migration remaps any existing answers
-- so they continue to live with the right question.
--
-- Old order (Week 1):
--   p0 = What am I grateful for today?
--   p1 = What is present in my body right now?
--   p2 = What images, impressions, or moments from ceremony keep returning?
--   p3 = Where did I feel the most resistance during the journey?
--   p4 = What did the medicine show me?
--   p5 = What is one thing I feel called to do, release, or begin?
--
-- New order (Week 1):
--   p0 = What did the medicine show me?
--   p1 = What am I grateful for today?
--   p2 = What is present in my body right now?
--   p3 = What images, impressions, or moments from ceremony keep returning?
--   p4 = Where did I feel the most resistance during the journey?
--   p5 = What is one thing I feel called to do, release, or begin?  (unchanged)
--
-- Mapping for already-stored answers:
--   w0-p0 -> w0-p1
--   w0-p1 -> w0-p2
--   w0-p2 -> w0-p3
--   w0-p3 -> w0-p4
--   w0-p4 -> w0-p0
--   w0-p5 -> w0-p5
--
-- Idempotency: this migration is run-once via the supabase migrations
-- table. Running the same key shuffle a second time would re-rotate
-- the answers, so do not re-run manually.

UPDATE post_ceremony_progress
SET journal_responses = (
  SELECT jsonb_object_agg(
    CASE key
      WHEN 'w0-p0' THEN 'w0-p1'
      WHEN 'w0-p1' THEN 'w0-p2'
      WHEN 'w0-p2' THEN 'w0-p3'
      WHEN 'w0-p3' THEN 'w0-p4'
      WHEN 'w0-p4' THEN 'w0-p0'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(journal_responses)
)
WHERE journal_responses ?| ARRAY['w0-p0','w0-p1','w0-p2','w0-p3','w0-p4'];
