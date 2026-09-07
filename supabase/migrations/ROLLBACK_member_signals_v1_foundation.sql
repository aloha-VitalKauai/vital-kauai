-- Member Signals Build 1 — rollback. NOT a migration; run manually.
-- The migration only CREATEs new objects, so rollback is a view, two tables
-- and two functions. Nothing pre-existing (member_profiles, members,
-- journeys, is_founder) is touched by the migration or by this rollback.
--
-- Order matters: the view depends on both tables, and the acknowledgments
-- table depends on member_signals.

drop view if exists public.v_member_signal_current;
drop table if exists public.member_signal_acknowledgments;
drop table if exists public.member_signals;
drop function if exists public.signals_refuse_update();
drop function if exists public.member_signal_journal_consent(uuid);
