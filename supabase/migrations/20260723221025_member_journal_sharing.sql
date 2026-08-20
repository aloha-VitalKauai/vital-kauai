-- PR #3: portal-wide journal & reflection sharing consent.
--
-- A single member preference governs whether the care team (founders /
-- assigned guides) may view that member's pre/post-ceremony journal
-- responses, PNE reflections, and Questions-for-the-Medicine. The preference
-- lives on the canonical members row; enforcement is server-side in the
-- Founder Dashboard (private response text is stripped before it reaches the
-- founder's browser). Additive and idempotent.

alter table public.members
  add column if not exists journal_sharing_enabled boolean not null default false,
  add column if not exists journal_sharing_decided_at timestamptz,
  add column if not exists legacy_journal_access_enabled boolean not null default false;

comment on column public.members.journal_sharing_enabled is
  'True only when the member personally enables portal-wide journal and reflection sharing.';
comment on column public.members.journal_sharing_decided_at is
  'Timestamp when the member personally selected or changed their journal-sharing preference.';
comment on column public.members.legacy_journal_access_enabled is
  'Compatibility access for existing members whose journals were already available to authorized founders before explicit sharing controls were introduced. This is not a record of member consent.';

-- Existing-member backfill: every member that existed before this migration
-- keeps the founder visibility they already had (via the #821 founder-read RLS
-- policy) through the legacy compatibility flag — WITHOUT recording any
-- personal consent. journal_sharing_enabled stays false and
-- journal_sharing_decided_at stays null for these members, so we never imply
-- they personally checked the box. A fixed cutoff keeps this deterministic and
-- idempotent: members created after the migration are never captured and
-- default to private until they choose on intake.
update public.members
  set legacy_journal_access_enabled = true
  where created_at < timestamptz '2026-07-24 00:00:00+00'
    and legacy_journal_access_enabled = false;
