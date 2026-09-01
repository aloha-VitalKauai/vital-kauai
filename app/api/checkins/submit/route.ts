// POST /api/checkins/submit — the weekly check-in write path.
//
// Who is asking comes from the member's own cookie session, never the
// payload. The write itself runs as the service role (member_checkins has
// no member write policy), with ownership and the already-submitted guard
// enforced in lib/checkins/submit.ts.

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { submitCheckin } from "@/lib/checkins/submit";

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { checkinId?: unknown; answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.checkinId !== "string" || body.checkinId.length === 0) {
    return NextResponse.json({ error: "checkin_id_required" }, { status: 400 });
  }

  const result = await submitCheckin(getServiceSupabase(), {
    checkinId: body.checkinId,
    memberId: user.id,
    answers: body.answers,
  });

  if (result.ok) {
    return NextResponse.json({ checkin: result.checkin });
  }
  switch (result.reason) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "already_submitted":
      return NextResponse.json({ error: "already_submitted" }, { status: 409 });
    case "invalid_responses":
      return NextResponse.json(
        { error: "invalid_responses", details: result.errors },
        { status: 400 },
      );
    default:
      return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
