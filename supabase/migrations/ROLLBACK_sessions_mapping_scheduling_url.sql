-- Rollback for the scheduling-URL mapping mode. NOT a migration; run manually.
-- Restoring NOT NULL requires that no URL-only mapping rows remain, so those
-- are removed first — they are integration config, not member history.

delete from public.calendly_event_mappings where calendly_event_type_uri is null;

alter table public.calendly_event_mappings
  drop constraint if exists calendly_event_mappings_bookable;
alter table public.calendly_event_mappings
  alter column calendly_event_type_uri set not null;
alter table public.calendly_event_mappings
  drop column if exists scheduling_url;
