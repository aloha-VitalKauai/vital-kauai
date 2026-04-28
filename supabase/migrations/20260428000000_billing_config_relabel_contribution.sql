-- Relabel the live `billing_config.membership_donation` row so the
-- user-visible label reads "Contribution" instead of "Membership Donation".
--
-- Background: the public site, portal, and dashboard now refer to the
-- per-journey amount as a "contribution". The fallback default in
-- lib/billing/getMembershipDonationConfig.ts and the dashboard save action
-- already write "Contribution", but the existing row in Supabase still has
-- its old label, so anywhere `cfg.label` is rendered keeps showing the old
-- text. This one-off update fixes that without touching the amount,
-- currency, or the row key (which stays `membership_donation` because the
-- key is referenced by the dashboard, API route, and library).

UPDATE public.billing_config
SET
  value_json = jsonb_set(value_json, '{label}', '"Contribution"'::jsonb, true),
  updated_at = NOW()
WHERE key = 'membership_donation';
