import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lightweight endpoint for client-side scripts that need the logged-in
// member's id (e.g. the intake form autosave, which keys draft state
// in localStorage so drafts don't leak between members on a shared browser).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ id: user.id, email: user.email ?? null });
}
