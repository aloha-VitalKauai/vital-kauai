import type { SupabaseClient } from "@supabase/supabase-js";

// First module under /lib/api. Holds the typed query helpers for the
// portal-home member/profile/specialist surface. Bodies are byte-equivalent
// copies of the Supabase calls that previously lived inline in
// components/portal-home-page.tsx — relocated here so future portal pages
// and the mobile client can consume the same typed contract.

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  intake_form_completed: boolean;
  intake_form_completed_at: string | null;
  membership_agreement_signed: boolean;
  medical_disclaimer_signed: boolean;
  deposit_paid: boolean;
  onboarding_complete: boolean;
  membership_agreement_signed_at: string | null;
  medical_disclaimer_signed_at: string | null;
  deposit_paid_at: string | null;
  deposit_amount: number | null;
};

export type MemberRow = {
  id: string;
  assigned_partner: string | null;
};

export type Specialist = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  calendly_url: string | null;
};

export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("member_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return (data as Profile | null) ?? null;
}

export async function getMyMember(
  supabase: SupabaseClient,
  userEmail: string,
): Promise<MemberRow | null> {
  const { data } = await supabase
    .from("members")
    .select("id, assigned_partner")
    .eq("email", userEmail)
    .single();
  return (data as MemberRow | null) ?? null;
}

export async function getAssignedSpecialist(
  supabase: SupabaseClient,
  partnerName: string,
): Promise<Specialist | null> {
  const { data } = await supabase
    .from("integration_specialists")
    .select("id, name, photo_url, bio, calendly_url")
    .ilike("name", partnerName.trim())
    .eq("active", true)
    .maybeSingle();
  return (data as Specialist | null) ?? null;
}

export function markAgreementSigned(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("member_profiles")
    .update({
      membership_agreement_signed: true,
      membership_agreement_signed_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export function markMedicalSigned(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("member_profiles")
    .update({
      medical_disclaimer_signed: true,
      medical_disclaimer_signed_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export function markDonationPaid(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
) {
  return supabase
    .from("member_profiles")
    .update({
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: amount,
    })
    .eq("id", userId);
}

export function markOnboardingComplete(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("member_profiles")
    .update({
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);
}
