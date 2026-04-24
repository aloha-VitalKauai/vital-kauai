-- Expand intake_forms to persist the full member intake.
--
-- Context: public/intake-form-legacy.html posts ~30 named fields. Until this
-- migration, only about a third of them matched columns on public.intake_forms
-- — the rest were dropped by pickIntakeFields() in
-- app/api/intake/complete/route.ts. This migration adds the remaining columns
-- so every substantive answer a member gives on the form lands in the DB and
-- can be surfaced in the /dashboard/[id] member view.
--
-- Additive only. All new columns are nullable. Existing rows and existing
-- columns are untouched. Safe to run on production without coordination — old
-- code that doesn't know about the new columns simply writes null / omits them.
--
-- After applying this migration, the companion code change (extend
-- INTAKE_COLUMNS in app/api/intake/complete/route.ts to include these new
-- names) can land and new intake submissions will start persisting the
-- additional fields.

alter table public.intake_forms
  -- Section 1 · Basic Information
  add column if not exists legal_name text,
  add column if not exists preferred_name text,
  add column if not exists location text,
  add column if not exists email text,
  add column if not exists physician_name text,
  add column if not exists physician_phone text,

  -- Section 3 · Body & Somatic Awareness
  add column if not exists body_relationship text,
  add column if not exists grounding_practices text,

  -- Section 4 · Emotional & Psycho-Spiritual Context
  add column if not exists emotional_patterns text,
  add column if not exists current_therapy text,

  -- Section 5 · Experience & History
  add column if not exists personal_growth text,
  add column if not exists childhood_history text,
  add column if not exists integration_history text,

  -- Section 6 · Health & Safety Disclosure (radio)
  add column if not exists mental_health_status text,

  -- Section 7 · Support & Environment (radio + free-text)
  add column if not exists home_support_selection text,
  add column if not exists home_support_people text,

  -- Section 8 · Readiness & Sovereignty
  add column if not exists boundaries_needs text,
  add column if not exists additional_notes text,

  -- Signature block
  add column if not exists signer_name text,
  add column if not exists signed_date date;

-- Constrain the two radio-backed columns to the values the form can actually
-- send. Keeps bad data out even if the form changes later.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'intake_forms_mental_health_status_check'
  ) then
    alter table public.intake_forms
      add constraint intake_forms_mental_health_status_check
      check (
        mental_health_status is null
        or mental_health_status = any (array[
          'stable',
          'in_process',
          'significant',
          'crisis'
        ])
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'intake_forms_home_support_selection_check'
  ) then
    alter table public.intake_forms
      add constraint intake_forms_home_support_selection_check
      check (
        home_support_selection is null
        or home_support_selection = any (array[
          'one',
          'few',
          'help'
        ])
      );
  end if;
end $$;
