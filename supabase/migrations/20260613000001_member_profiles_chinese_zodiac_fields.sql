-- Vital Profile foundation, part 2: Chinese Zodiac storage.
--
-- Stacks on top of 20260613000000_member_profiles_vital_profile_fields.sql.
-- Chinese Zodiac will (initially) be computed internally from birth_date
-- — no third-party API required. Storing the resolved values rather than
-- re-deriving on every read keeps the read path cheap and lets the
-- founder dashboard surface them without extra compute.
--
-- All four columns are nullable with no default. Existing rows untouched.
-- Inherits the same RLS policies that protect every other field on
-- member_profiles (members view/update own, founders read all).
--
-- Reversibility:
--   alter table public.member_profiles
--     drop column if exists chinese_zodiac_animal,
--     drop column if exists chinese_zodiac_element,
--     drop column if exists chinese_zodiac_yin_yang,
--     drop column if exists chinese_zodiac_year_label;

alter table public.member_profiles
  -- One of the twelve animals (Rat, Ox, Tiger, …). Stored as text rather
  -- than an enum because the source-of-truth calculation may shift
  -- (e.g. solar-term vs lunar new-year boundary handling) and an enum
  -- would lock the vocabulary before that decision is settled.
  add column if not exists chinese_zodiac_animal     text,

  -- One of the five elements (Wood, Fire, Earth, Metal, Water).
  add column if not exists chinese_zodiac_element    text,

  -- 'yin' or 'yang'.
  add column if not exists chinese_zodiac_yin_yang   text,

  -- Human-readable year label (e.g. "Wood Rabbit" or "Year of the Wood
  -- Rabbit") — denormalized so dashboard/UI rendering doesn't have to
  -- reassemble it from the parts every render.
  add column if not exists chinese_zodiac_year_label text;
