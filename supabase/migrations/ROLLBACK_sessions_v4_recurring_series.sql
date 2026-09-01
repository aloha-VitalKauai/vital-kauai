-- Sessions V4 recurring series — rollback. NOT a migration; run manually.
--
-- The migration adds one table, three session_bookings columns, one
-- session_booking_holds column, and widens two check constraints. Rollback
-- reverses each step in dependency order: series references on
-- session_bookings go first (the column drop removes its FK and both partial
-- indexes), then the series table itself, then the constraint widenings are
-- narrowed back. Nothing pre-existing (allowances, bookings history, holds
-- rows, mappings) is touched beyond removing the added columns.
--
-- Narrowing the status constraint requires that no 'needs_scheduling' rows
-- remain. Those rows only exist as series occurrence placeholders, so they
-- are removed with the series — they are scheduling state, not member
-- history: no 'needs_scheduling' row ever counts against an allowance.

delete from public.session_bookings where status = 'needs_scheduling';

alter table public.session_bookings drop column if exists series_id;
alter table public.session_bookings drop column if exists meeting_url;
alter table public.session_bookings drop column if exists reminder_sent_at;

alter table public.session_bookings
  drop constraint if exists session_bookings_status_check;
alter table public.session_bookings
  add constraint session_bookings_status_check
  check (status in ('scheduled', 'completed', 'canceled', 'no_show'));

drop table if exists public.session_series;
drop function if exists public.session_series_set_updated_at();

alter table public.session_booking_holds
  drop constraint if exists session_booking_holds_purpose_check;
alter table public.session_booking_holds drop column if exists purpose;

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'session_series') then
    raise exception 'rollback incomplete: session_series still exists';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'session_bookings'
                and column_name in ('series_id', 'meeting_url', 'reminder_sent_at')) then
    raise exception 'rollback incomplete: session_bookings still carries series columns';
  end if;
  raise notice 'Sessions V4 rollback verified: series table, columns and constraint widenings removed';
end $$;
