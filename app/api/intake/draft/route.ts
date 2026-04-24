import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Intake form draft storage — cross-device autosave.
// GET returns the saved draft (if any); POST upserts; DELETE clears.
// Backed by public.member_drafts (migration 20260424230000_member_drafts.sql).
// If the table isn't present yet, callers will receive a 503; the intake
// form client falls back to localStorage-only autosave in that case.

const FORM_KEY = "intake";

type DraftRow = {
  payload: unknown;
  updated_at: string;
};

function draftStorageUnavailable(err: { code?: string; message?: string } | null | undefined) {
  // 42P01 = undefined_table (migration hasn't been applied yet)
  return err?.code === "42P01";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("member_drafts")
    .select("payload, updated_at")
    .eq("member_id", user.id)
    .eq("form_key", FORM_KEY)
    .maybeSingle<DraftRow>();

  if (error) {
    if (draftStorageUnavailable(error)) {
      return NextResponse.json({ error: "Draft storage unavailable" }, { status: 503 });
    }
    console.error("[intake/draft GET] ", error.message);
    return NextResponse.json({ error: "Failed to load draft" }, { status: 500 });
  }

  if (!data) return NextResponse.json({ draft: null });
  return NextResponse.json({ draft: { payload: data.payload, updated_at: data.updated_at } });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error } = await supabase.from("member_drafts").upsert(
    {
      member_id: user.id,
      form_key: FORM_KEY,
      payload: body as object,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,form_key" },
  );

  if (error) {
    if (draftStorageUnavailable(error)) {
      return NextResponse.json({ error: "Draft storage unavailable" }, { status: 503 });
    }
    console.error("[intake/draft POST] ", error.message);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("member_drafts")
    .delete()
    .eq("member_id", user.id)
    .eq("form_key", FORM_KEY);

  if (error) {
    if (draftStorageUnavailable(error)) {
      // Table doesn't exist yet — nothing to delete; treat as success.
      return NextResponse.json({ ok: true });
    }
    console.error("[intake/draft DELETE] ", error.message);
    return NextResponse.json({ error: "Failed to clear draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
