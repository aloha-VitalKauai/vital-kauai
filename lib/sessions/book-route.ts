// Shared handler behind POST /api/sessions/coaching/book and
// POST /api/sessions/pne/book. The routes stay one line each; everything
// testable lives here and in booking.ts.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { SessionType } from "./balance";
import { createSessionBookingLink } from "./booking";

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function handleBookRequest(
  sessionType: SessionType,
  options: { purpose?: "single" | "series_anchor" } = {},
) {
  // Who is asking — the member's own cookie session, nothing client-supplied.
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Prefill name from the canonical member record when we have it.
  const { data: member } = await supabase
    .from("members")
    .select("full_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  const result = await createSessionBookingLink(supabase, {
    memberId: user.id,
    memberEmail: user.email ?? null,
    memberName: member?.full_name ?? null,
    sessionType,
    purpose: options.purpose,
  });

  if (result.ok) {
    return NextResponse.json({
      booking_url: result.bookingUrl,
      hold_expires_at: result.holdExpiresAt,
    });
  }
  if (result.reason === "no_sessions_remaining") {
    // Build 3 renders this as "Included sessions complete".
    return NextResponse.json({ error: "no_sessions_remaining" }, { status: 409 });
  }
  if (result.reason === "not_configured") {
    return NextResponse.json({ error: "booking_not_configured" }, { status: 503 });
  }
  return NextResponse.json({ error: "calendly_error" }, { status: 502 });
}
