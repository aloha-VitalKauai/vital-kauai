-- Automatic weekly journey emails.
--
-- journey_email_templates : editable per-week content (Hawaiian principle,
--   subject, intro, action items). 12 rows total: 6 pre + 6 post. The
--   founders dashboard at /dashboard/automatic-emails reads/writes this.
--
-- journey_email_log : send-history. Cron checks this before sending so a
--   member never receives the same week twice.

create table if not exists public.journey_email_templates (
  id              uuid primary key default gen_random_uuid(),
  arc             text not null check (arc in ('pre','post')),
  week_idx        int  not null check (week_idx between 0 and 5),
  principle_name  text not null,
  principle       text not null,
  theme           text not null,
  subject         text not null,
  intro           text not null,
  action_items    jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  unique (arc, week_idx)
);

create index if not exists journey_email_templates_arc_week_idx
  on public.journey_email_templates (arc, week_idx);

create table if not exists public.journey_email_log (
  id                uuid primary key default gen_random_uuid(),
  journey_id        uuid not null references public.journeys(id) on delete cascade,
  member_id         uuid not null references public.members(id) on delete cascade,
  arc               text not null check (arc in ('pre','post')),
  week_idx          int  not null check (week_idx between 0 and 5),
  recipient_email   text not null,
  subject           text not null,
  resend_id         text,
  sent_at           timestamptz not null default now(),
  template_snapshot jsonb,
  unique (journey_id, arc, week_idx)
);

create index if not exists journey_email_log_member
  on public.journey_email_log (member_id, sent_at desc);

-- RLS — founders read everything, members read their own log only.
alter table public.journey_email_templates enable row level security;
alter table public.journey_email_log       enable row level security;

drop policy if exists "founders read templates"   on public.journey_email_templates;
drop policy if exists "founders write templates"  on public.journey_email_templates;
drop policy if exists "founders read log"         on public.journey_email_log;
drop policy if exists "members read own log"      on public.journey_email_log;

create policy "founders read templates" on public.journey_email_templates
  for select to authenticated
  using (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  );

create policy "founders write templates" on public.journey_email_templates
  for all to authenticated
  using (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  )
  with check (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  );

create policy "founders read log" on public.journey_email_log
  for select to authenticated
  using (
    auth.uid() in (
      'd6e824e3-69ab-447c-b046-afecfe4b7028'::uuid,
      '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid
    )
  );

create policy "members read own log" on public.journey_email_log
  for select to authenticated
  using (member_id = auth.uid());

-- ─── Seed: 12 templates pulled from the existing pre/post-ceremony pages ───

insert into public.journey_email_templates
  (arc, week_idx, principle_name, principle, theme, subject, intro, action_items)
values
  -- Pre Week 1 — Ike
  ('pre', 0, 'Ike', 'I create my reality.', 'Perception',
   'Week 1 of your preparation · Ike',
   'This is the beginning of something real. Iboga asks for your presence, your honesty, and your full participation. What you do in these six weeks matters — the way you prepare becomes part of the experience itself.',
   '[
     "Sign your Membership Agreement and Medical Disclaimer",
     "Submit your contribution",
     "Read \"Understanding Iboga\" and \"What Iboga Works On\" in your Preparedness Guide",
     "Read Week 1 in The PsychoNeuroEnergetics (PNE) Guide: The Language of the Body",
     "Respond to this week''s journal prompts",
     "Schedule your two pre-ceremony calls with your integration guide (one in week two, one in week four)"
   ]'::jsonb),

  -- Pre Week 2 — Makia
  ('pre', 1, 'Makia', 'Energy flows where attention goes.', 'Focus',
   'Week 2 of your preparation · Makia',
   'You are no longer the person who was considering this. The moment you committed, something changed. This week''s job is to feel that shift, as a lived, embodied orientation — moving you from "I signed up for something" to "I am inside a process."',
   '[
     "Respond to this week''s journal prompts",
     "Read \"Iboga & Ibogaine\" and \"Medical Preparation & Contraindications\" in your Preparedness Guide",
     "Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide: Nervous System Regulation",
     "Connect with your integration guide",
     "Schedule your required medical appointments and labs",
     "Schedule next week''s call with Rachel & Josh"
   ]'::jsonb),

  -- Pre Week 3 — Manawa
  ('pre', 2, 'Manawa', 'The moment of power is now.', 'Presence',
   'Week 3 of your preparation · Manawa',
   'You have everything you need, right here, in this moment. Through simple practices of breath, body awareness, and sensation, you build the muscle of presence — and the capacity to be with what is. When ceremony comes, this is what carries you.',
   '[
     "Respond to this week''s journal prompts",
     "Read \"Body, Mind, Spirit Preparation\" in your Preparedness Guide",
     "Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide: Building Somatic Awareness",
     "Begin writing your Questions for the Medicine",
     "Connect with Rachel & Josh"
   ]'::jsonb),

  -- Pre Week 4 — Kala
  ('pre', 3, 'Kala', 'You are unlimited.', 'Release',
   'Week 4 of your preparation · Kala',
   'Kala means release. The limits you live inside are mostly inherited — stories you were given, strategies you built to survive. This week is about loosening those grips and trusting what arises when you stop managing your life so closely.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 4 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide — bring the material that is surfacing",
     "Begin clearing contraindicated substances per your protocol timeline (cannabis: clear fully 2 weeks before ceremony)"
   ]'::jsonb),

  -- Pre Week 5 — Aloha
  ('pre', 4, 'Aloha', 'To love is to be happy with.', 'Connection',
   'Week 5 of your preparation · Aloha',
   'Aloha is a way of being in relationship. This week you turn outward — even as the inner work continues — because transformation that touches your relationships is transformation that lands.',
   '[
     "Respond to this week''s journal prompts",
     "Read \"Ceremony Day\" and \"The Days After\" in your Preparedness Guide",
     "Read Week 5 in The PsychoNeuroEnergetics (PNE) Guide",
     "Share the Support Person Guide with your home circle this week",
     "Begin preparing your home environment for your return",
     "Complete the What to Bring packing checklist",
     "Schedule next week''s call with Rachel & Josh"
   ]'::jsonb),

  -- Pre Week 6 — Mana + Pono (ceremony week)
  ('pre', 5, 'Mana + Pono', 'All power comes from within.', 'Sovereignty & Integrity',
   'Week 6 · Mana + Pono · You have done the work',
   'The work of preparation is complete. What remains is alignment — meeting yourself honestly about what you are ready to receive. Trust your team. Let yourself be held. That is enough. That is everything.',
   '[
     "Respond to this week''s journal prompts",
     "Read \"Integration, The Real Work\" in your Preparedness Guide",
     "Read Week 6 in The PsychoNeuroEnergetics (PNE) Guide",
     "Confirm labs are submitted",
     "Save our direct contacts for arrival week",
     "Connect with Rachel & Josh — bring your finalized Questions for the Medicine",
     "Connect with your integration guide",
     "Schedule your post-ceremony integration-guide call (within 48 hours of ceremony, while still on Kauaʻi)",
     "Confirm travel and send arrival details to aloha@vitalkauai.com",
     "Finalize your Questions for the Medicine"
   ]'::jsonb),

  -- Post Week 1 — Lōkahi
  ('post', 0, 'Lōkahi', 'All things are connected. Act in unity.', 'Unity',
   'Week 1 of integration · Lōkahi',
   'The medicine is still moving in you. Lōkahi means unity — the integration of all that was shown into the whole of who you are. This week asks almost nothing of you except presence. Rest after ceremony is active integration. Your nervous system is processing. Trust it.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 1 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide — your post-ceremony call within 48 hours of ceremony (while still on Kauaʻi)",
     "Rest completely for the first 48 hours",
     "Journal what arose: images, moments, what the medicine showed you",
     "Schedule next week''s integration-guide call"
   ]'::jsonb),

  -- Post Week 2 — Mālama
  ('post', 1, 'Mālama', 'Tend what is precious.', 'Tending',
   'Week 2 of integration · Mālama',
   'The insights are alive. Now you tend them. The noribogaine window — your brain''s heightened state of plasticity — is at its most open right now. What you practice this week is being written more deeply than usual.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide",
     "Schedule a check-in call with Rachel & Josh",
     "Schedule next week''s integration-guide call"
   ]'::jsonb),

  -- Post Week 3 — Haʻahaʻa
  ('post', 2, 'Haʻahaʻa', 'Remain humble. Stay teachable.', 'Humility',
   'Week 3 of integration · Haʻahaʻa',
   'The familiar is returning — meet it differently. By week three, the acute aliveness of ceremony has softened. Your ability to notice the old, welcome it, and shift it with greater awareness is alive. Meet all of it with humility rather than shame.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide",
     "Schedule next week''s integration-guide call"
   ]'::jsonb),

  -- Post Week 4 — Kuleana
  ('post', 3, 'Kuleana', 'Carry your responsibility with honor.', 'Responsibility',
   'Week 4 of integration · Kuleana',
   'The knowing is yours now. Let it become how you live. Week four is where the seeing becomes choosing. The noribogaine window is beginning to narrow — what you anchor into behavior now is what will carry forward.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 4 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide",
     "Schedule next week''s integration-guide call"
   ]'::jsonb),

  -- Post Week 5 — Aloha
  ('post', 4, 'Aloha', 'Let love be the way you act.', 'Love in Action',
   'Week 5 of integration · Aloha',
   'You have changed. Your relationships are noticing. The people in your life are responding to a changed version of you. This week you learn how to hold your new ground with love rather than armor.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 5 in The PsychoNeuroEnergetics (PNE) Guide",
     "Connect with your integration guide",
     "Schedule next week''s integration-guide call"
   ]'::jsonb),

  -- Post Week 6 — Pono
  ('post', 5, 'Pono', 'Stand in right relationship.', 'Right Relationship',
   'Week 6 of integration · Pono',
   'Six weeks in. This is who you are now. Week six marks the close of the intensive integration window and the opening of a longer, quieter arc. The medicine''s work continues — in your dreams, your relationships, your daily choices.',
   '[
     "Respond to this week''s journal prompts",
     "Read Week 6 in The PsychoNeuroEnergetics (PNE) Guide",
     "Schedule your Completion Call with Rachel & Josh",
     "Connect with your integration guide"
   ]'::jsonb)
on conflict (arc, week_idx) do nothing;
