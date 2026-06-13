-- Vital Profile foundation: birth data + archetypal personalization fields.
--
-- Backend/data-structure only. No frontend surfaces consume these columns
-- yet — this migration prepares the storage layer for upcoming onboarding
-- work (astrology, Human Design, Gene Keys, Enneagram).
--
-- All new columns are nullable with no defaults. Existing rows are not
-- mutated, existing reads/writes are unaffected, and older code paths that
-- don't know about these columns continue to work (Postgres returns null,
-- inserts/upserts that omit them get null). Safe to apply on production
-- without coordination.
--
-- Reversibility: every column is dropped by a single
--   alter table public.member_profiles drop column ...
-- (down migration intentionally not authored as a file — Supabase
-- migrations are forward-only; the rollback block below documents the
-- exact statements to run if needed.)
--
-- RLS:
--   Inheritance only. member_profiles already enforces:
--     - "Members can view own profile"   (auth.uid() = id)
--     - "Members can update own profile" (auth.uid() = id, with check)
--     - "Founders can read all member_profiles" (is_founder() or auth.uid() = id)
--   New columns live on the same row, so they are automatically protected
--   by these row-level checks. No new policies are needed.

alter table public.member_profiles
  -- Birth data — entered by the member during a future onboarding step.
  -- birth_date is a calendar date (no time). birth_time is local clock
  -- time at the recorded city; we keep the original timezone in
  -- birth_timezone (IANA name, e.g. "Pacific/Honolulu") so downstream
  -- chart calculations can resolve the moment unambiguously.
  add column if not exists birth_date              date,
  add column if not exists birth_time              time,
  add column if not exists birth_location_city     text,
  add column if not exists birth_location_country  text,
  add column if not exists birth_timezone          text,

  -- Western astrology placements. Stored as free text (e.g. "Cancer",
  -- "Scorpio") rather than enums so we don't lock the schema before the
  -- compute layer is chosen. A future migration can tighten to a check
  -- constraint or enum once the source-of-truth calculator is settled.
  add column if not exists zodiac_sun              text,
  add column if not exists zodiac_moon             text,
  add column if not exists zodiac_rising           text,

  -- Human Design. type / strategy / authority / profile are short labels
  -- ("Generator", "To Respond", "Sacral", "1/3"). defined_centers is a
  -- jsonb array of center names (e.g. ["Sacral","G","Throat"]) — jsonb
  -- because the set is unbounded-ish and we may later attach gates/
  -- channels under the same key.
  add column if not exists human_design_type             text,
  add column if not exists human_design_strategy         text,
  add column if not exists human_design_authority        text,
  add column if not exists human_design_profile          text,
  add column if not exists human_design_defined_centers  jsonb,

  -- Gene Keys — the four primary spheres of the Activation Sequence
  -- (Life's Work, Evolution, Radiance, Purpose). Stored as text because
  -- a Gene Key is typically rendered as "Key.Line" (e.g. "26.4"); a future
  -- migration can split into structured columns if we need to query by
  -- line independently.
  add column if not exists gene_keys_life_work    text,
  add column if not exists gene_keys_evolution    text,
  add column if not exists gene_keys_radiance     text,
  add column if not exists gene_keys_purpose      text,

  -- Enneagram. type is the core number (1–9), wing is the adjacent
  -- number, instinct is one of self-preservation / social / sexual.
  -- Stored as text to keep the foundation forgiving; a check constraint
  -- can be added later once we standardize the input vocabulary.
  add column if not exists enneagram_type      text,
  add column if not exists enneagram_wing      text,
  add column if not exists enneagram_instinct  text;

-- Reference: rollback (not executed)
--
--   alter table public.member_profiles
--     drop column if exists birth_date,
--     drop column if exists birth_time,
--     drop column if exists birth_location_city,
--     drop column if exists birth_location_country,
--     drop column if exists birth_timezone,
--     drop column if exists zodiac_sun,
--     drop column if exists zodiac_moon,
--     drop column if exists zodiac_rising,
--     drop column if exists human_design_type,
--     drop column if exists human_design_strategy,
--     drop column if exists human_design_authority,
--     drop column if exists human_design_profile,
--     drop column if exists human_design_defined_centers,
--     drop column if exists gene_keys_life_work,
--     drop column if exists gene_keys_evolution,
--     drop column if exists gene_keys_radiance,
--     drop column if exists gene_keys_purpose,
--     drop column if exists enneagram_type,
--     drop column if exists enneagram_wing,
--     drop column if exists enneagram_instinct;
