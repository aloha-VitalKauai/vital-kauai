-- Rename the human role "integration guide" → "PNE Practitioner" in the two
-- member-facing surfaces that live in seeded data (so a code edit could not
-- reach them): the Seven-Day Ceremony Arc protocol and the automated weekly
-- journey emails. Companion to the code-side rename in PR #933.
--
-- Data-only DML (no DDL, no schema change → lib/database.types.ts unaffected).
-- Idempotent: exact-match / case-insensitive guards mean a re-run after the
-- rename finds nothing left to change.
--
-- Reversal: run the inverse string replacement, restoring 'Assigned Integration
-- Guide' and the 'integration guide' / 'integration-guide' role wording.

-- ── 1. Ceremony arc ──────────────────────────────────────────────────────
-- The "Individual Integration Session" item's assigned team/role placeholder,
-- plus any already-applied calendar copy still carrying the verbatim default.
update public.protocol_template_items
set assigned_to = 'Assigned PNE Practitioner'
where assigned_to = 'Assigned Integration Guide';

update public.calendar_events
set assigned_to = 'Assigned PNE Practitioner'
where assigned_to = 'Assigned Integration Guide';

-- ── 2. Automated weekly emails: role rename ──────────────────────────────
-- Founders have hand-edited these rows since the original seed, so replace at
-- the string level over the action_items jsonb. Cover both the spaced noun
-- ("your integration guide") and the hyphenated adjectival form
-- ("integration-guide calls", "integration-guide follow-up calls"). The
-- lowercase, case-sensitive match cannot touch the document name
-- "PNE Integration Guide".
update public.journey_email_templates
set action_items = replace(
      replace(action_items::text, 'integration-guide', 'PNE Practitioner'),
      'integration guide', 'PNE Practitioner'
    )::jsonb,
    updated_at = now()
where action_items::text ilike '%integration guide%'
   or action_items::text ilike '%integration-guide%';

-- ── 3. Automated weekly emails: match the portal's "coaching call" wording ──
-- PR #933 renamed the portal action item; keep the emails consistent.
update public.journey_email_templates
set action_items = replace(action_items::text,
      'Schedule next week''s call with Rachel & Josh',
      'Schedule next week''s coaching call with Rachel & Josh')::jsonb,
    updated_at = now()
where action_items::text like '%Schedule next week''s call with Rachel & Josh%';
