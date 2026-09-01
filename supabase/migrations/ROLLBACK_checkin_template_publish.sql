-- Build 4 (question editor) — rollback. NOT a migration; run manually.
-- The migration only CREATEs one function; nothing pre-existing is touched.

drop function if exists public.publish_checkin_template(integer, jsonb);
