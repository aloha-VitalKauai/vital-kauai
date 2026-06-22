import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { getCalendarRange } from "@/lib/calendar/queries";
import { isIsoDate } from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/range?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns the journeys overlapping the range and the events within it.
export async function GET(req: Request) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!isIsoDate(start) || !isIsoDate(end)) {
    return NextResponse.json(
      { error: "start and end query params must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (end < start) {
    return NextResponse.json(
      { error: "end must be on or after start" },
      { status: 400 },
    );
  }

  try {
    const data = await getCalendarRange(ctx.supabase, {
      startDate: start,
      endDate: end,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to load calendar range" },
      { status: 500 },
    );
  }
}
