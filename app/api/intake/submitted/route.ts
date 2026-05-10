import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

// Returns the member's most recently submitted intake form, reshaped into the
// snapshot format the legacy intake form (public/intake-form-legacy.html) uses
// to repopulate fields. Without this, a member who already submitted lands on
// a blank form because the autosave draft is cleared on submit.
//
// Lookup mirrors /api/intake/complete:
//   members.profile_id = auth.uid()  →  members.id  →  intake_forms.member_id
// We use the service-role client because intake_forms RLS expects member_id
// to equal auth.uid(), but member_id is members.id (not auth user id).

const MENTAL_HEALTH_VALUES = new Set(["stable", "in_process", "significant", "crisis"]);
const HOME_SUPPORT_VALUES = new Set(["one", "few", "help"]);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: memberRow, error: memberErr } = await service
      .from("members")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (memberErr) {
      console.error("[intake/submitted] members lookup:", memberErr.message);
      return NextResponse.json({ error: "Failed to load intake" }, { status: 500 });
    }
    if (!memberRow) {
      return NextResponse.json({ snapshot: null });
    }

    const { data: intake, error: intakeErr } = await service
      .from("intake_forms")
      .select("*")
      .eq("member_id", memberRow.id)
      .order("submission_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (intakeErr) {
      console.error("[intake/submitted] intake lookup:", intakeErr.message);
      return NextResponse.json({ error: "Failed to load intake" }, { status: 500 });
    }
    if (!intake) {
      return NextResponse.json({ snapshot: null });
    }

    const record = intake as Record<string, unknown>;
    const responses =
      record.responses && typeof record.responses === "object"
        ? (record.responses as Record<string, unknown>)
        : {};

    // Build the inputs map: prefer typed columns, fall back to verbatim
    // responses jsonb. Responses already contains every non-empty submitted
    // field except `signature` (stored only in its own column).
    const inputs: Record<string, string> = {};
    for (const [k, v] of Object.entries(responses)) {
      if (v === null || v === undefined) continue;
      const s = typeof v === "string" ? v : String(v);
      if (s.trim() === "") continue;
      inputs[k] = s;
    }
    if (typeof record.signature === "string" && record.signature.trim()) {
      inputs.signature = record.signature;
    }

    // Choices the form needs to mark as visually selected. The form stores
    // these as hidden-input values keyed by form field name; we additionally
    // emit a `choices` entry so applySnapshotToForm() lights up the right
    // chip in the UI.
    const choices: { group: string; hiddenId: string; value: string }[] = [];
    const mental = inputs.mental_health_status;
    if (mental && MENTAL_HEALTH_VALUES.has(mental)) {
      choices.push({ group: "mental-health", hiddenId: "f-mental-status", value: mental });
    }
    const support = inputs.home_support_selection;
    if (support && HOME_SUPPORT_VALUES.has(support)) {
      choices.push({
        group: "support-person",
        hiddenId: "f-home-support-selection",
        value: support,
      });
    }

    // Submission required all 5 acknowledgments, so they were all checked.
    const acks = [true, true, true, true, true];

    return NextResponse.json({
      snapshot: {
        savedAt: (record.submission_date as string | null) || null,
        state: { inputs, choices, acks },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[intake/submitted] unhandled:", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
