import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVitalProfile, loadBirthInput } from "@/lib/vital-profile/generate";

// POST /api/profile/generate-vital-profile
//
// Auth-protected endpoint that:
//   1. Resolves the calling user via the cookie-based Supabase session.
//   2. Reads the user's stored birth data from member_profiles (the
//      Supabase client uses the user's JWT, so RLS — not just our
//      `eq("id", user.id)` filter — guarantees they can't read another
//      member's row).
//   3. Runs every Vital Profile provider against that input in parallel.
//   4. Returns the typed VitalProfileCalculationResult.
//
// What it intentionally does NOT do:
//   - It does not persist anything to member_profiles. Every provider is
//     currently a stub returning `kind: "placeholder"`; persisting that
//     would clobber real future data. Persistence will be added in a
//     follow-up PR alongside the real provider implementations, and only
//     when the orchestrator returns `kind: "ok"` for the field in
//     question.
//   - It does not accept birth data in the request body. The route reads
//     stored data only, so a malicious client can't ask us to compute
//     against arbitrary inputs and run up provider quota.
//
// Stub-phase behavior: every provider returns placeholder, so the
// response is shape-correct but contains no real archetypal data. This
// is the contract a future PR will fill in.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const birthInput = await loadBirthInput(supabase, user.id);
  if (!birthInput) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 },
    );
  }

  const result = await generateVitalProfile(birthInput);
  return NextResponse.json(result);
}
