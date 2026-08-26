-- Sessions V1 Build 2 — rollback. NOT a migration; run manually.
-- The migration only CREATEs the holds table and its acquire function, so
-- rollback is two drops. Build 1 objects and everything pre-existing are
-- untouched by the migration and by this rollback.

drop function if exists public.acquire_session_hold(uuid, text, integer);
drop table if exists public.session_booking_holds;
