-- Tighten spaced em dashes ("word — word") to the house form ("word—word") in
-- authored copy that lives in the database rather than in the codebase, so the
-- automated emails and seeded protocol copy match the member-facing site after
-- PR #937.
--
-- Data-only DML (no DDL, no schema change → lib/database.types.ts unaffected).
-- Idempotent: once tightened there is no ' — ' left for the guard to match, so
-- a re-run changes nothing.
--
-- Reversal: run the inverse replacement (E'—' → E' — ') over the same
-- columns. Note the inverse is broader than this migration, since it would also
-- space out any em dash that was already tight before this ran.
--
-- Deliberately NOT touched:
--   • public.members.status — 'Signed — Awaiting Intake' is a keyed value that
--     four dashboard surfaces look up by exact string. Changing it is a code +
--     data change, not a copy change.
--   • member_timelines, ops_alerts, sms_logs, webhook_receipts,
--     followup_tasks.email_subject — records of what was shown or sent. History
--     is not rewritten to match today's typography.
--   • intake_forms — member-written prose.

-- ── 1. Automated weekly journey emails ───────────────────────────────────
update public.journey_email_templates
set intro         = replace(intro, ' — ', '—'),
    subject       = replace(subject, ' — ', '—'),
    theme         = replace(theme, ' — ', '—'),
    principle     = replace(principle, ' — ', '—'),
    action_items  = replace(action_items::text, ' — ', '—')::jsonb,
    updated_at    = now()
where intro like '% — %'
   or subject like '% — %'
   or theme like '% — %'
   or principle like '% — %'
   or action_items::text like '% — %';

-- ── 2. Transactional email templates ─────────────────────────────────────
update public.transactional_email_templates
set subject      = replace(subject, ' — ', '—'),
    eyebrow      = replace(eyebrow, ' — ', '—'),
    heading      = replace(heading, ' — ', '—'),
    lead_html    = replace(lead_html, ' — ', '—'),
    body_html    = replace(body_html, ' — ', '—'),
    cta_label    = replace(cta_label, ' — ', '—'),
    closing_html = replace(closing_html, ' — ', '—'),
    description  = replace(description, ' — ', '—')
where subject like '% — %'
   or eyebrow like '% — %'
   or heading like '% — %'
   or lead_html like '% — %'
   or body_html like '% — %'
   or cta_label like '% — %'
   or closing_html like '% — %'
   or description like '% — %';

-- ── 3. Protocol templates and their items ────────────────────────────────
update public.protocol_templates
set name        = replace(name, ' — ', '—'),
    description = replace(description, ' — ', '—')
where name like '% — %'
   or description like '% — %';

update public.protocol_template_items
set title    = replace(title, ' — ', '—'),
    location = replace(location, ' — ', '—'),
    notes    = replace(notes, ' — ', '—')
where title like '% — %'
   or location like '% — %'
   or notes like '% — %';

-- ── 4. Calendar events instantiated from those items ─────────────────────
-- Applying a protocol copies the item's title/location/notes onto a member's
-- calendar, so the already-applied copies carry the same spacing.
update public.calendar_events
set title    = replace(title, ' — ', '—'),
    location = replace(location, ' — ', '—'),
    notes    = replace(notes, ' — ', '—')
where title like '% — %'
   or location like '% — %'
   or notes like '% — %';

-- ── 5. Remaining authored labels ─────────────────────────────────────────
update public.assessment_window_config
set label = replace(label, ' — ', '—'),
    notes = replace(notes, ' — ', '—')
where label like '% — %'
   or notes like '% — %';

update public.calendly_event_mappings
set label = replace(label, ' — ', '—')
where label like '% — %';
