import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { deleteTemplateItem, updateTemplateItem } from "@/lib/protocols/queries";
import {
  validateTemplateItemPatch,
  type ProtocolTemplateItemInput,
} from "@/lib/protocols/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/admin/protocols/[id]/items/[itemId] — update a block.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { itemId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<ProtocolTemplateItemInput>;
  const errors = validateTemplateItemPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const item = await updateTemplateItem(ctx.supabase, itemId, patch);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/protocols/[id]/items/[itemId] — remove a block.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { itemId } = await params;
  try {
    await deleteTemplateItem(ctx.supabase, itemId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
