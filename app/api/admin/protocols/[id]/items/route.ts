import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import { createTemplateItem } from "@/lib/protocols/queries";
import {
  validateTemplateItemInput,
  type ProtocolTemplateItemInput,
} from "@/lib/protocols/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/protocols/[id]/items — add a block to a template.
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

  const input = (body ?? {}) as Partial<ProtocolTemplateItemInput>;
  const errors = validateTemplateItemInput(input);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const item = await createTemplateItem(ctx.supabase, id, {
      day_offset: input.day_offset as number,
      title: input.title as string,
      category: input.category as string,
      start_time: input.start_time as string,
      end_time: input.end_time as string,
      location: input.location ?? null,
      assigned_to: input.assigned_to ?? null,
      notes: input.notes ?? null,
      is_private: input.is_private ?? false,
      sort_order: input.sort_order ?? 0,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 },
    );
  }
}
