import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Columns we accept from the intake form. Anything else in the payload is ignored.
// Names must match existing columns on public.intake_forms — unknown names
// would trigger a Postgres error on insert.
const INTAKE_COLUMNS = [
  // Pre-existing clinical / contact columns
  "date_of_birth",
  "phone",
  "emergency_contact",
  "emergency_phone",
  "health_history",
  "current_medications",
  "psychiatric_history",
  "substance_history",
  "primary_intention",
  "what_brings_you_here",
  "dietary_restrictions",
  "accommodation_requests",
  "signature",
  "heart_conditions",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "resting_heart_rate",
  "current_supplements",
  "previous_psychedelic_exp",
  "medication_interactions",
  "medical_notes",
  "supplements",
  "previous_psychedelic_experience",
  // Added via migration 20260424220000_intake_forms_expanded_columns.sql
  "legal_name",
  "preferred_name",
  "location",
  "physician_name",
  "physician_phone",
  "body_relationship",
  "grounding_practices",
  "emotional_patterns",
  "current_therapy",
  "personal_growth",
  "childhood_history",
  "integration_history",
  "mental_health_status",
  "home_support_selection",
  "home_support_people",
  "boundaries_needs",
  "additional_notes",
  "signer_name",
  "signed_date",
] as const;

function pickIntakeFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of INTAKE_COLUMNS) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      out[key] = body[key];
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const intakeFields = pickIntakeFields(body);
    const nowIso = new Date().toISOString();

    // Does the member already have an intake_forms row? (user can't UPDATE under RLS,
    // only founders/guides can — but we don't need to: the profile flag is the source
    // of truth for "completed", and first-submission captures the payload.)
    // We can't SELECT either (founders/guides only), but INSERT policy is open with check=true.
    // The intake_forms.member_id will rely on a DB unique index if one exists; otherwise
    // we may produce duplicate rows on re-submit, which is fine — ops dashboards just look
    // for existence.
    const { error: insErr } = await supabase.from("intake_forms").insert({
      member_id: user.id,
      ...intakeFields,
      submission_date: nowIso,
      signed_at: nowIso,
      created_at: nowIso,
    });
    if (insErr && insErr.code !== "23505") {
      // 23505 = unique_violation: already submitted, that's fine — continue to flip flag.
      console.error("[intake/complete] intake insert error:", insErr.message);
      return NextResponse.json({ error: "Failed to save intake form" }, { status: 500 });
    }

    // Flip flag on member_profiles (user can update own row).
    const { error: profErr } = await supabase
      .from("member_profiles")
      .update({
        intake_form_completed: true,
        intake_form_completed_at: nowIso,
      })
      .eq("id", user.id);
    if (profErr) {
      console.error("[intake/complete] profile update error:", profErr.message);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    // If all four requirements are now met, flip onboarding_complete.
    const { data: profile, error: readErr } = await supabase
      .from("member_profiles")
      .select(
        "intake_form_completed, deposit_paid, membership_agreement_signed, medical_disclaimer_signed, onboarding_complete",
      )
      .eq("id", user.id)
      .single();

    if (!readErr && profile) {
      if (
        profile.intake_form_completed &&
        profile.deposit_paid &&
        profile.membership_agreement_signed &&
        profile.medical_disclaimer_signed &&
        !profile.onboarding_complete
      ) {
        const { error: completeErr } = await supabase
          .from("member_profiles")
          .update({
            onboarding_complete: true,
            onboarding_completed_at: nowIso,
          })
          .eq("id", user.id);
        if (completeErr) {
          console.error("[intake/complete] onboarding_complete flip failed:", completeErr.message);
          return NextResponse.json(
            { error: "Intake saved, but failed to finalize onboarding. Please contact support." },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[intake/complete] unhandled:", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
