import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { deleteJourney, updateJourney } from "@/lib/calendar/queries";
import { validateJourneyPatch, type JourneyInput } from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/calendar/journeys/[id]
// Body: partial JourneyInput. Only provided keys are updated. Deleting a
// journey cascades to its events (FK on delete cascade).
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

  const patch = (body ?? {}) as Partial<JourneyInput>;
  const errors = validateJourneyPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const journey = await updateJourney(ctx.supabase, id, patch);
    return NextResponse.json({ journey });
  } catch {
    return NextResponse.json(
      { error: "Failed to update journey" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/calendar/journeys/[id]
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
    await deleteJourney(ctx.supabase, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete journey" },
      { status: 500 },
    );
  }
}
