import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Columns the form is allowed to write. Anything else in the payload is ignored.
// Keep in sync with the `intake_forms` table schema and the `name` attributes
// in public/intake-form-legacy.html.
const INTAKE_COLUMNS = [
  "legal_name",
  "preferred_name",
  "date_of_birth",
  "location",
  "phone",
  "emergency_contact",
  "emergency_phone",
  "primary_intention",
  "what_brings_you_here",
  "body_relationship",
  "grounding_practices",
  "emotional_patterns",
  "psychiatric_history",
  "current_therapy",
  "personal_growth",
  "previous_psychedelic_experience",
  "previous_psychedelic_exp",
  "substance_history",
  "childhood_history",
  "integration_history",
  "health_history",
  "current_medications",
  "current_supplements",
  "supplements",
  "medication_interactions",
  "medical_notes",
  "heart_conditions",
  "mental_health_status",
  "home_support_selection",
  "home_support_people",
  "boundaries_needs",
  "additional_notes",
  "dietary_restrictions",
  "accommodation_requests",
  "signer_name",
  "signature",
  "signed_date",
] as const;

// Check-constraint whitelists — anything outside these becomes null.
const MENTAL_HEALTH_VALUES = new Set(["stable", "in_process", "significant", "crisis"]);
const HOME_SUPPORT_VALUES = new Set(["one", "few", "help"]);

function normalizeIntake(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of INTAKE_COLUMNS) {
    const v = body[key];
    if (v === undefined || v === null || v === "") continue;
    out[key] = v;
  }
  if (out.mental_health_status && !MENTAL_HEALTH_VALUES.has(String(out.mental_health_status))) {
    delete out.mental_health_status;
  }
  if (out.home_support_selection && !HOME_SUPPORT_VALUES.has(String(out.home_support_selection))) {
    delete out.home_support_selection;
  }
  return out;
}

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();
  const { data, error } = await db
    .from("intake_forms")
    .select("*")
    .eq("member_id", user.id)
    .order("submission_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    console.error("[intake/complete GET] read error:", error.message);
    return NextResponse.json({ error: "Failed to load intake" }, { status: 500 });
  }

  return NextResponse.json({ intake: data && data.length ? data[0] : null });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const intakeFields = normalizeIntake(body);
    const nowIso = new Date().toISOString();
    const db = serviceDb();

    // Find the most-recent existing row for this member. If one exists we
    // UPDATE it in place so re-submissions replace the prior answers rather
    // than piling up duplicate rows. If none exists, INSERT a fresh row.
    const { data: existing, error: findErr } = await db
      .from("intake_forms")
      .select("id")
      .eq("member_id", user.id)
      .order("submission_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (findErr) {
      console.error("[intake/complete] lookup error:", findErr.message);
      return NextResponse.json({ error: "Failed to save intake form" }, { status: 500 });
    }

    if (existing && existing.length) {
      const { error: updErr } = await db
        .from("intake_forms")
        .update({
          ...intakeFields,
          submission_date: nowIso,
          signed_at: nowIso,
        })
        .eq("id", existing[0].id);
      if (updErr) {
        console.error("[intake/complete] update error:", updErr.message);
        return NextResponse.json({ error: "Failed to save intake form" }, { status: 500 });
      }
    } else {
      const { error: insErr } = await db.from("intake_forms").insert({
        member_id: user.id,
        ...intakeFields,
        submission_date: nowIso,
        signed_at: nowIso,
        created_at: nowIso,
      });
      if (insErr) {
        console.error("[intake/complete] insert error:", insErr.message);
        return NextResponse.json({ error: "Failed to save intake form" }, { status: 500 });
      }
    }

    // Flip the profile flag (user owns this row and can update it under RLS).
    const supabase = await createServerClient();
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
