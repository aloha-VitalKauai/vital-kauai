-- Sessions V1 foundation — rollback. NOT a migration; run manually.
-- The migration only CREATEs new objects, so rollback is three drops plus the
-- trigger function. Nothing pre-existing (webhook_receipts, journeys,
-- member_profiles, auth.users) is touched by the migration or this rollback.

drop table if exists public.session_bookings;
drop table if exists public.member_session_allowances;
drop table if exists public.calendly_event_mappings;
drop function if exists public.session_bookings_set_updated_at();
