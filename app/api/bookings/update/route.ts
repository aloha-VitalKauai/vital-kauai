import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { verifyFounder } from "@/lib/auth/founder-check";
import {
  isValidBookingStatus,
  isValidPaymentStatus,
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
  amount_cents?: number | null;
  notes?: string | null;
};

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
  if (body.amount_cents !== undefined && body.amount_cents !== null) {
    if (!Number.isFinite(body.amount_cents) || body.amount_cents < 0) {
      return NextResponse.json({ error: "invalid amount_cents" }, { status: 400 });
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

  // No booking row yet — insert one so the founder can edit from a blank
  // member. This happens when a member predates the seed or when the row
  // was deleted; either way, create-on-edit is the right ergonomics.
  if (!bookingId) {
    if (!memberId) {
      return NextResponse.json({ error: "member_id required to create booking" }, { status: 400 });
    }
    const { data: created, error: insertErr } = await service
      .from("bookings")
      .insert({
        member_id: memberId,
        booking_status: body.booking_status ?? "invited",
        payment_status: body.payment_status ?? "unpaid",
        package_name: body.package_name ?? null,
        amount_cents: body.amount_cents ?? null,
        notes: body.notes ?? null,
        paid_at: paidAtFor(body.payment_status),
      })
      .select("id")
      .single();
    if (insertErr || !created) {
      console.error("bookings insert failed", insertErr);
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, booking_id: created.id, created: true });
  }

  const update: Record<string, unknown> = {};
  if (body.booking_status !== undefined) update.booking_status = body.booking_status;
  if (body.payment_status !== undefined) {
    update.payment_status = body.payment_status;
    const paidAt = paidAtFor(body.payment_status);
    if (paidAt) update.paid_at = paidAt;
  }
  if (body.package_name !== undefined) update.package_name = body.package_name;
  if (body.amount_cents !== undefined) update.amount_cents = body.amount_cents;
  if (body.notes !== undefined) update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, booking_id: bookingId, noop: true });
  }

  // Resolve member_id for the response (founder may have passed only booking_id).
  if (!memberId) {
    const { data: row } = await service
      .from("bookings")
      .select("member_id")
      .eq("id", bookingId)
      .maybeSingle();
    memberId = row?.member_id ?? null;
  }

  const { error: updateErr } = await service
    .from("bookings")
    .update(update)
    .eq("id", bookingId);
  if (updateErr) {
    console.error("bookings update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, booking_id: bookingId, member_id: memberId });
}

// Stamp paid_at when payment moves to a paid-equivalent state so the
// member portal can show "Paid on …" without a separate column.
function paidAtFor(status: PaymentStatus | undefined): string | null {
  if (!status) return null;
  if (status === "paid" || status === "deposit_paid" || status === "payment_plan_active") {
    return new Date().toISOString();
  }
  return null;
}
