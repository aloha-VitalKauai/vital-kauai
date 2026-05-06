-- Editable copy for transactional emails sent through Resend.
--
-- Each existing send route reads its template here, interpolates
-- {{variables}}, and injects the result into its hardcoded HTML scaffold.
-- If the row is missing or unreadable, the route falls back to a hardcoded
-- default — production never breaks because of a missing template.
--
-- Member-facing templates (editable=true) are surfaced in the founders
-- dashboard editor. Founder-facing alerts (editable=false) are listed as
-- display-only so the dashboard reflects everything in play.

create table if not exists public.transactional_email_templates (
  key            text primary key,
  audience       text not null check (audience in ('member','founder')),
  editable       boolean not null default true,
  display_name   text not null,
  description    text,
  subject        text not null,
  eyebrow        text,
  heading        text,
  lead_html      text,
  body_html      text,
  cta_label      text,
  closing_html   text,
  variables      jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);

alter table public.transactional_email_templates enable row level security;

drop policy if exists "founders read transactional"  on public.transactional_email_templates;
drop policy if exists "founders write transactional" on public.transactional_email_templates;

create policy "founders read transactional" on public.transactional_email_templates
  for select to authenticated
  using (auth.uid() in ('d6e824e3-69ab-447c-b046-afecfe4b7028'::uuid, '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid));

create policy "founders write transactional" on public.transactional_email_templates
  for all to authenticated
  using (auth.uid() in ('d6e824e3-69ab-447c-b046-afecfe4b7028'::uuid, '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid))
  with check (auth.uid() in ('d6e824e3-69ab-447c-b046-afecfe4b7028'::uuid, '268f721a-9c7c-4bb2-82b7-3c29178281b1'::uuid));

-- Seed: 3 member-facing (editable) + 3 founder-facing (display-only)

insert into public.transactional_email_templates
  (key, audience, editable, display_name, description, subject, eyebrow, heading, lead_html, body_html, cta_label, closing_html, variables)
values
  ('setup_link', 'member', true,
   'Member account setup',
   'Sent when a lead is approved to become a member, and when a founder manually re-sends an expired setup link. Auth flow — exercise care editing.',
   'Welcome to Vital Kauaʻi, {{firstName}} — set up your account',
   'Vital Kauaʻi · Member Portal',
   'Welcome, <em>{{firstName}}.</em>',
   '<p>We''re honored to welcome you to Vital Kauaʻi. Your private member portal is ready — it holds everything you need to prepare for your journey.</p><p>Click below to create your account. This takes about 30 seconds.</p>',
   null,
   'Set Up My Account →',
   '<p class="note">The setup button expires in <strong style="color:rgba(245,240,232,.45)">24 hours</strong>. If it expires, go to the login page and use "Forgot password" to get a new link.</p><p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>',
   '["firstName","setupLink","appUrl"]'::jsonb),

  ('free_guide', 'member', true,
   'Free Iboga guide download',
   'Sent when someone submits the free-guide form on the marketing site. Includes the PDF as an attachment.',
   'Your Free Iboga Guide',
   'Vital Kauaʻi · Free Resource',
   'Your Iboga guide, <em>{{firstName}}.</em>',
   '<p>Mahalo for reaching out. The guide we wish existed when we began our own journeys is attached to this email as a PDF, and you can read it on the web anytime at the link below.</p><p>It covers the history and lineage of Iboga, what to expect during ceremony, how we prepare body and nervous system, and how to choose a safe, qualified provider.</p>',
   '<p>If, after reading, you sense this work may be for you, the next step is a conversation. We hold discovery calls with everyone before they enter ceremony, and we would be honored to connect with you.</p>',
   'Book a Discovery Call →',
   '<p class="links">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>.</p>',
   '["firstName","guideUrl","pdfUrl","discoveryUrl"]'::jsonb),

  ('payment_link', 'member', true,
   'Journey contribution payment link',
   'Sent when a founder generates a Stripe payment link for a member''s contribution.',
   'Your Vital Kauaʻi journey contribution — {{amount}}',
   'Vital Kauaʻi · Journey Contribution',
   'Thank you for your contribution, <em>{{firstName}}.</em>',
   '<p>Here''s a single-use payment link for your journey contribution. It opens a secure Stripe checkout pre-filled with your amount.</p>',
   null,
   'Complete Contribution →',
   '<p class="note">This link is single-use and expires in <strong style="color:rgba(245,240,232,.45)">7 days</strong>. If anything looks off, reply to this email and we''ll sort it out together.</p><p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>',
   '["firstName","amount","payUrl"]'::jsonb),

  ('discovery_call_notification', 'founder', false,
   'Discovery call booked notification',
   'Sent to Rachel & Josh when a discovery call is booked through Calendly. Display-only — internal alert.',
   'New discovery call: {{name}} — {{callDate}}',
   null, null, null, null, null,
   null,
   '["name","callDate","email","leadDashboardUrl"]'::jsonb),

  ('stripe_refund_notification', 'founder', false,
   'Stripe refund alert',
   'Sent to Rachel & Josh when a Stripe payment is refunded. Lives in the Supabase Edge Function (separate deploy). Display-only.',
   'Journey payment refunded — {{memberName}}',
   null, null, null, null, null,
   null,
   '["memberName","amount","reason"]'::jsonb),

  ('reconciliation_failure', 'founder', false,
   'Daily reconciliation failure alert',
   'Sent to Rachel & Josh by the daily reconciliation cron when an invariant fails. Display-only.',
   '[Vital Kauaʻi] Financial reconciliation failed ({{failureCount}} checks)',
   null, null, null, null, null,
   null,
   '["failureCount","failures"]'::jsonb)
on conflict (key) do nothing;
