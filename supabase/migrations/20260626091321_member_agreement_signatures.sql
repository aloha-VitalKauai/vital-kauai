-- Member signing: capture typed signatures for the Church Membership Agreement
-- and the Medical Disclaimer & Risk Acknowledgment, mirroring the existing
-- safety_agreement_signature column. Additive and non-destructive — existing
-- rows are untouched (columns default NULL). The corresponding *_signed /
-- *_signed_at boolean+timestamp columns already exist.
alter table public.member_profiles
  add column if not exists membership_agreement_signature text,
  add column if not exists medical_disclaimer_signature text;

comment on column public.member_profiles.membership_agreement_signature is
  'Typed full-legal-name signature for the Church Membership Agreement (set when the member signs in the portal).';
comment on column public.member_profiles.medical_disclaimer_signature is
  'Typed full-legal-name signature for the Medical Disclaimer & Risk Acknowledgment (set when the member signs in the portal).';
