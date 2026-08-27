-- Sessions: let a session type be booked on a plain Calendly scheduling URL.
--
-- PNE is hosted on the practitioner's OWN Calendly organization, not ours. We
-- have no API token for it yet, so we cannot mint single-use scheduling links
-- the way we do for Coaching — but we do have the practitioner's public
-- booking URL, and that is enough to send a member to the right calendar.
--
--   with an API token  → single-use link, one booking per link (Coaching)
--   URL only           → the practitioner's public link, prefilled (PNE today)
--
-- Two consequences of the URL-only mode, both deliberate:
--
--   * calendly_event_type_uri becomes nullable. That URI is the key the
--     webhook matches on, and we cannot learn it without an authenticated
--     call to the practitioner's account. A null simply never matches, which
--     is the correct behaviour while their bookings do not reach our webhook
--     at all. When the token arrives, we fill in the real URI and automatic
--     deduction starts working with no further change.
--
--   * A public link is reusable. The ledger is still safe — a booking that
--     arrives without a valid authorization is parked needs_review and
--     deducts nothing — but the link cannot protect the practitioner's own
--     calendar the way a single-use link does. That is the trade for going
--     live before the token exists.

alter table public.calendly_event_mappings
  add column if not exists scheduling_url text;

alter table public.calendly_event_mappings
  alter column calendly_event_type_uri drop not null;

-- A mapping has to be bookable somehow: either we can mint links for it, or
-- it carries a URL we can send members to.
alter table public.calendly_event_mappings
  drop constraint if exists calendly_event_mappings_bookable;
alter table public.calendly_event_mappings
  add constraint calendly_event_mappings_bookable
  check (calendly_event_type_uri is not null or scheduling_url is not null);
