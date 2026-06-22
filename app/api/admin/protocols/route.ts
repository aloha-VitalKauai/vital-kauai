import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";
import {
  createProtocolTemplate,
  getProtocolTemplates,
} from "@/lib/protocols/queries";
import {
  validateTemplateInput,
  type ProtocolTemplateInput,
} from "@/lib/protocols/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/protocols — all templates, each with its items.
export async function GET() {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  try {
    const templates = await getProtocolTemplates(ctx.supabase);
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json(
      { error: "Failed to load protocols" },
      { status: 500 },
    );
  }
}

// POST /api/admin/protocols — create a template (header only; items added via
// /protocols/[id]/items).
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

  const input = (body ?? {}) as Partial<ProtocolTemplateInput>;
  const errors = validateTemplateInput(input);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  try {
    const template = await createProtocolTemplate(ctx.supabase, {
      name: input.name as string,
      description: input.description ?? null,
      kind: input.kind,
      duration_days: input.duration_days,
      is_active: input.is_active,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create protocol" },
      { status: 500 },
    );
  }
}
