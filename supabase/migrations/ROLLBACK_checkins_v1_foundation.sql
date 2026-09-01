-- Weekly Member Check-Ins Build 1 — rollback. NOT a migration; run manually.
-- The migration only CREATEs new objects, so rollback is two drops plus the
-- shared trigger function. Nothing pre-existing (member_profiles, journeys,
-- auth.users) is touched by the migration or this rollback.

drop table if exists public.member_checkins;
drop table if exists public.checkin_templates;
drop function if exists public.checkins_set_updated_at();
