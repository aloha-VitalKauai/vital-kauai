import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/calendar/queries";
import {
  validateCalendarEventPatch,
  type CalendarEventInput,
} from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/calendar/events/[id]
// Body: partial CalendarEventInput. Only provided keys are updated.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<CalendarEventInput>;
  const errors = validateCalendarEventPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const event = await updateCalendarEvent(ctx.supabase, id, patch);
    return NextResponse.json({ event });
  } catch {
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/calendar/events/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id } = await params;

  try {
    await deleteCalendarEvent(ctx.supabase, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 },
    );
  }
}
