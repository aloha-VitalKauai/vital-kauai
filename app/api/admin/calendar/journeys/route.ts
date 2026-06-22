import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { createJourney, getJourneys } from "@/lib/calendar/queries";
import { isIsoDate, validateJourneyInput } from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/journeys[?from=YYYY-MM-DD]
// Lists journeys (most recent first). Optional `from` hides stays that ended
// before that date. Used by the protocol "apply to journey" picker.
export async function GET(req: Request) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  if (from && !isIsoDate(from)) {
    return NextResponse.json(
      { error: "from must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  try {
    const journeys = await getJourneys(ctx.supabase, from ? { from } : undefined);
    return NextResponse.json({ journeys });
  } catch {
    return NextResponse.json(
      { error: "Failed to load journeys" },
      { status: 500 },
    );
  }
}

// POST /api/admin/calendar/journeys
// Body: { display_name, start_date, end_date, client_id?, status?, color?, notes? }
// Creates a scheduled client journey. The journey spans start_date..end_date
// and becomes visible on every day in that range; no events are created.
export async function POST(req: Request) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const errors = validateJourneyInput(input);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const journey = await createJourney(ctx.supabase, {
      display_name: input.display_name as string,
      start_date: input.start_date as string,
      end_date: input.end_date as string,
      client_id: (input.client_id as string | null | undefined) ?? null,
      status: input.status as string | undefined,
      color: (input.color as string | null | undefined) ?? null,
      notes: (input.notes as string | null | undefined) ?? null,
    });
    return NextResponse.json({ journey }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create journey" },
      { status: 500 },
    );
  }
}
