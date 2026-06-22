import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { applyTemplateToJourney } from "@/lib/protocols/queries";
import { isApplyMode } from "@/lib/protocols/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/protocols/[id]/apply
// Body: { journey_id: string, mode?: "append" | "replace" }
//
// Materializes the template's blocks onto the journey's calendar as ordinary
// (editable) calendar_events, dated relative to the journey's start_date. In
// "replace" mode, events previously generated from this template on this
// journey are cleared first. Returns { created, skipped, removed }.
export async function POST(
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

  const input = (body ?? {}) as { journey_id?: unknown; mode?: unknown };
  if (typeof input.journey_id !== "string" || !input.journey_id) {
    return NextResponse.json(
      { error: "journey_id is required" },
      { status: 400 },
    );
  }
  if (input.mode != null && !isApplyMode(input.mode)) {
    return NextResponse.json(
      { error: 'mode must be "append" or "replace"' },
      { status: 400 },
    );
  }
  const mode = isApplyMode(input.mode) ? input.mode : "append";

  try {
    const result = await applyTemplateToJourney(ctx.supabase, {
      templateId: id,
      journeyId: input.journey_id,
      mode,
    });
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof Error && e.message === "journey_not_found") {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to apply protocol" },
      { status: 500 },
    );
  }
}
