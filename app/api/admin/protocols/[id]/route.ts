import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import {
  deleteProtocolTemplate,
  getProtocolTemplate,
  updateProtocolTemplate,
} from "@/lib/protocols/queries";
import {
  validateTemplatePatch,
  type ProtocolTemplateInput,
} from "@/lib/protocols/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/protocols/[id] — one template with its items.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { id } = await params;
  try {
    const template = await getProtocolTemplate(ctx.supabase, id);
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json(
      { error: "Failed to load protocol" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/protocols/[id] — update the template header.
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

  const patch = (body ?? {}) as Partial<ProtocolTemplateInput>;
  const errors = validateTemplatePatch(patch);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const template = await updateProtocolTemplate(ctx.supabase, id, patch);
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json(
      { error: "Failed to update protocol" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/protocols/[id] — delete the template (items cascade;
// already-applied calendar events keep their place, source_template_id nulls).
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
    await deleteProtocolTemplate(ctx.supabase, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete protocol" },
      { status: 500 },
    );
  }
}
