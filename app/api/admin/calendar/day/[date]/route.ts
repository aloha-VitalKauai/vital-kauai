import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { getCalendarDay } from "@/lib/calendar/queries";
import { isIsoDate } from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/day/YYYY-MM-DD
// Returns the active journeys (with day numbers) and the hourly events for one
// day.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { date } = await params;
  if (!isIsoDate(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const data = await getCalendarDay(ctx.supabase, date);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to load day" },
      { status: 500 },
    );
  }
}
