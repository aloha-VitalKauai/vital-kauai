import { NextResponse } from "next/server";
import { createClient as createServiceSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { verifyFounder } from "@/lib/auth/founder-check";
import {
  isValidBookingStatus,
  isValidPaymentStatus,
  type Booking,
  type BookingStatus,
  type PaymentStatus,
} from "@/lib/api/bookings";

export const runtime = "nodejs";

type Body = {
  member_id?: string;
  booking_id?: string;
  booking_status?: BookingStatus;
  payment_status?: PaymentStatus;
  package_name?: string | null;
  amount_due_cents?: number | null;
  amount_paid_cents?: number | null;
  notes?: string | null;
  reason?: string | null;
};

const BOOKING_COLUMNS =
  "id, member_id, journey_id, booking_status, payment_status, package_name, amount_due_cents, amount_paid_cents, square_payment_link_id, square_payment_id, square_order_id, square_customer_id, paid_at, notes, created_at, updated_at";

export async function POST(req: Request) {
  const founder = await verifyFounder();
  if (!founder) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.member_id && !body.booking_id) {
    return NextResponse.json(
      { error: "member_id or booking_id required" },
      { status: 400 },
    );
  }

  if (body.booking_status !== undefined && !isValidBookingStatus(body.booking_status)) {
    return NextResponse.json({ error: "invalid booking_status" }, { status: 400 });
  }
  if (body.payment_status !== undefined && !isValidPaymentStatus(body.payment_status)) {
    return NextResponse.json({ error: "invalid payment_status" }, { status: 400 });
  }
  if (body.amount_due_cents !== undefined && body.amount_due_cents !== null) {
    if (!Number.isFinite(body.amount_due_cents) || body.amount_due_cents < 0) {
      return NextResponse.json({ error: "invalid amount_due_cents" }, { status: 400 });
    }
  }
  if (body.amount_paid_cents !== undefined && body.amount_paid_cents !== null) {
    if (!Number.isFinite(body.amount_paid_cents) || body.amount_paid_cents < 0) {
      return NextResponse.json({ error: "invalid amount_paid_cents" }, { status: 400 });
    }
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Resolve the booking — either by id, or the most recent for the member.
  let bookingId = body.booking_id ?? null;
  let memberId = body.member_id ?? null;
  if (!bookingId && memberId) {
    const { data: existing } = await service
      .from("bookings")
      .select("id")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    bookingId = existing?.id ?? null;
  }

  // ── Create-on-edit ─────────────────────────────────────────────────
  if (!bookingId) {
    if (!memberId) {
      return NextResponse.json({ error: "member_id required to create booking" }, { status: 400 });
    }
    const insertPayload = {
      member_id: memberId,
      booking_status: body.booking_status ?? "invited",
      payment_status: body.payment_status ?? "unpaid",
      package_name: body.package_name ?? null,
      amount_due_cents: body.amount_due_cents ?? null,
      amount_paid_cents: body.amount_paid_cents ?? 0,
      notes: body.notes ?? null,
      paid_at: paidAtFor(body.payment_status),
    };
    const { data: created, error: insertErr } = await service
      .from("bookings")
      .insert(insertPayload)
      .select(BOOKING_COLUMNS)
      .single();
    if (insertErr || !created) {
      console.error("bookings insert failed", insertErr);
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    await writeAuditLog(service, {
      tableName: "bookings",
      rowId: (created as Booking).id,
      action: "insert",
      actorId: founder.id,
      before: null,
      after: created as Booking,
      reason: body.reason?.trim() || "Created from dashboard",
    });
    return NextResponse.json({ ok: true, booking_id: (created as Booking).id, created: true });
  }

  // ── Update existing booking ────────────────────────────────────────
  const { data: before, error: fetchErr } = await service
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", bookingId)
    .maybeSingle();
  if (fetchErr || !before) {
    console.error("bookings fetch-before failed", fetchErr);
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  if (!memberId) memberId = (before as Booking).member_id;

  const update: Record<string, unknown> = {};
  if (body.booking_status !== undefined) update.booking_status = body.booking_status;
  if (body.payment_status !== undefined) {
    update.payment_status = body.payment_status;
    const paidAt = paidAtFor(body.payment_status);
    if (paidAt) update.paid_at = paidAt;
  }
  if (body.package_name !== undefined) update.package_name = body.package_name;
  if (body.amount_due_cents !== undefined) update.amount_due_cents = body.amount_due_cents;
  if (body.amount_paid_cents !== undefined) update.amount_paid_cents = body.amount_paid_cents;
  if (body.notes !== undefined) update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, booking_id: bookingId, noop: true });
  }

  const { data: after, error: updateErr } = await service
    .from("bookings")
    .update(update)
    .eq("id", bookingId)
    .select(BOOKING_COLUMNS)
    .single();
  if (updateErr || !after) {
    console.error("bookings update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await writeAuditLog(service, {
    tableName: "bookings",
    rowId: bookingId,
    action: "update",
    actorId: founder.id,
    before: before as Booking,
    after: after as Booking,
    reason: body.reason?.trim() || "Manual edit from dashboard",
  });

  return NextResponse.json({ ok: true, booking_id: bookingId, member_id: memberId });
}

// Audit log writer. Fail-soft: log to console on error but never roll back
// the booking change — losing the user's edit to preserve audit consistency
// is the wrong trade-off. Operational alerting catches audit gaps.
async function writeAuditLog(
  service: SupabaseClient,
  entry: {
    tableName: string;
    rowId: string;
    action: "insert" | "update" | "delete";
    actorId: string;
    before: Booking | null;
    after: Booking | null;
    reason: string;
  },
) {
  const changes = entry.before && entry.after ? diffBooking(entry.before, entry.after) : null;
  const { error } = await service.from("audit_log").insert({
    table_name: entry.tableName,
    row_id: entry.rowId,
    action: entry.action,
    actor_id: entry.actorId,
    actor_type: "founder",
    before_state: entry.before ?? null,
    after_state: entry.after ?? null,
    reason: entry.reason,
    metadata: changes ? { changed_fields: changes } : {},
  });
  if (error) {
    console.error("audit_log insert failed (booking edit still applied)", {
      row_id: entry.rowId,
      error: error.message,
    });
  }
}

// Field-level diff for the audit_log.metadata payload. Lets the dashboard
// render "payment_status: unpaid → paid" without re-diffing the jsonb.
function diffBooking(before: Booking, after: Booking): string[] {
  const fields: (keyof Booking)[] = [
    "booking_status",
    "payment_status",
    "package_name",
    "amount_due_cents",
    "amount_paid_cents",
    "paid_at",
    "notes",
    "square_payment_link_id",
    "square_payment_id",
    "square_order_id",
    "square_customer_id",
  ];
  return fields.filter((f) => before[f] !== after[f]).map(String);
}

// Stamp paid_at when payment moves to a fully-paid or deposit-paid state.
// payment_plan_active is intentionally excluded — it describes a plan in
// progress, not a payment just collected.
function paidAtFor(status: PaymentStatus | undefined): string | null {
  if (!status) return null;
  if (status === "paid" || status === "deposit_paid") {
    return new Date().toISOString();
  }
  return null;
}
