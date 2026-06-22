import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { createCalendarEvent } from "@/lib/calendar/queries";
import {
  validateCalendarEventInput,
  type CalendarEventInput,
} from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/calendar/events
// Body: { journey_id, title, category, event_date, start_time, end_time,
//         location?, assigned_to?, notes?, is_private?, sort_order? }
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

  const input = (body ?? {}) as Partial<CalendarEventInput>;
  const errors = validateCalendarEventInput(input);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const event = await createCalendarEvent(ctx.supabase, {
      journey_id: input.journey_id as string,
      title: input.title as string,
      category: input.category as string,
      event_date: input.event_date as string,
      start_time: input.start_time as string,
      end_time: input.end_time as string,
      location: input.location ?? null,
      assigned_to: input.assigned_to ?? null,
      notes: input.notes ?? null,
      is_private: input.is_private ?? false,
      sort_order: input.sort_order ?? 0,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 },
    );
  }
}
