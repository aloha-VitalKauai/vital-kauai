import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createServiceSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { getSquareEnv } from "@/lib/square/client";
import type { PaymentStatus, BookingStatus } from "@/lib/api/bookings";

export const runtime = "nodejs";

// Square webhook handler.
//
// Contract (per https://developer.squareup.com/docs/webhooks/step3validate):
//   - Header `x-square-hmacsha256-signature` is base64(HMAC-SHA256(key, url+body))
//   - `url` is the EXACT notification URL configured in Square Dashboard
//   - Body MUST be read as raw text before parsing, or the HMAC won't match
//
// Storage contract:
//   - Every receipt logs to `webhook_receipts` with source='square' and
//     idempotency_key=<event_id>. UNIQUE constraint on idempotency_key dedupes
//     replays; we return 200 on duplicate so Square stops retrying.
//   - Completed payments update `donations` (square_*, status='completed',
//     completed_at) AND `bookings` (amount_paid_cents, paid_at, payment_status,
//     and booking_status if full payment).
//   - audit_log gets a row with actor_type='square_webhook' for every booking
//     state change.

export async function POST(req: Request) {
  const env = getSquareEnv();
  if (!env.webhookSignatureKey) {
    console.error("square webhook called with no signature key configured");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-square-hmacsha256-signature");
  const rawBody = await req.text();
  const notificationUrl = req.url;

  if (!signature || !verifySquareSignature(env.webhookSignatureKey, notificationUrl, rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: SquareEvent;
  try {
    event = JSON.parse(rawBody) as SquareEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!event.event_id || !event.type) {
    return NextResponse.json({ error: "missing_event_fields" }, { status: 400 });
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Idempotency — UNIQUE on webhook_receipts.idempotency_key. If the insert
  // races with itself, the second one will fail and we skip processing.
  const { error: receiptErr } = await service.from("webhook_receipts").insert({
    source: "square",
    event_type: event.type,
    raw_headers: headerSnapshot(req.headers),
    raw_body: event as unknown as Record<string, unknown>,
    processing_status: "received",
    idempotency_key: event.event_id,
  });
  if (receiptErr) {
    if (isUniqueViolation(receiptErr)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    console.error("webhook_receipts insert failed", receiptErr);
    return NextResponse.json({ error: "receipt_insert_failed" }, { status: 500 });
  }

  try {
    await processSquareEvent(service, event);
    await markReceipt(service, event.event_id, "processed", null);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("square webhook processing failed", { event_id: event.event_id, message });
    await markReceipt(service, event.event_id, "failed", message);
    // 200 so Square doesn't infinitely retry — the receipt row carries the
    // error and ops can replay manually.
    return NextResponse.json({ ok: false, error: message });
  }
}

// ── Signature verification ──────────────────────────────────────────

function verifySquareSignature(
  signatureKey: string,
  notificationUrl: string,
  body: string,
  signatureHeader: string,
): boolean {
  const hmac = createHmac("sha256", signatureKey);
  hmac.update(notificationUrl);
  hmac.update(body);
  const expected = hmac.digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}

// ── Event dispatch ──────────────────────────────────────────────────

type SquareEvent = {
  event_id?: string;
  type?: string;
  merchant_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: {
      payment?: SquarePayment;
      refund?: SquareRefund;
    };
  };
};

type SquarePayment = {
  id?: string;
  status?: string;          // 'APPROVED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  amount_money?: { amount?: number | string; currency?: string };
  order_id?: string;
  customer_id?: string;
  receipt_url?: string;
  created_at?: string;
  updated_at?: string;
};

type SquareRefund = {
  id?: string;
  status?: string;          // 'PENDING' | 'COMPLETED' | 'REJECTED' | 'FAILED'
  payment_id?: string;
  amount_money?: { amount?: number | string };
  created_at?: string;
};

async function processSquareEvent(service: SupabaseClient, event: SquareEvent) {
  switch (event.type) {
    case "payment.created":
    case "payment.updated": {
      const payment = event.data?.object?.payment;
      if (!payment) throw new Error("missing payment object");
      await handlePaymentEvent(service, payment);
      return;
    }
    case "refund.created":
    case "refund.updated": {
      const refund = event.data?.object?.refund;
      if (!refund) throw new Error("missing refund object");
      await handleRefundEvent(service, refund);
      return;
    }
    default:
      // Ignore other events; receipt is still logged.
      return;
  }
}

async function handlePaymentEvent(service: SupabaseClient, payment: SquarePayment) {
  if (!payment.id) throw new Error("payment.id missing");
  const status = (payment.status ?? "").toUpperCase();

  // Find the originating donation row (inserted by create-payment-link).
  // Fall back to order_id lookup; create from scratch as a last resort.
  let donation = await findDonationForPayment(service, payment);
  if (!donation) {
    donation = await selfHealDonation(service, payment);
  }

  const amountCents = toCents(payment.amount_money?.amount);

  // Update donation row with provider IDs no matter what state.
  const donationUpdate: Record<string, unknown> = {
    square_payment_id: payment.id,
    square_order_id: payment.order_id ?? donation.square_order_id ?? null,
    square_customer_id: payment.customer_id ?? null,
  };

  if (status === "COMPLETED") {
    donationUpdate.status = "completed";
    donationUpdate.completed_at = new Date().toISOString();
    if (amountCents != null) donationUpdate.amount_cents = amountCents;
    if (payment.receipt_url) donationUpdate.receipt_url = payment.receipt_url;
  } else if (status === "FAILED" || status === "CANCELED") {
    donationUpdate.status = "failed";
    donationUpdate.failure_reason = `square_status_${status.toLowerCase()}`;
  }

  await service.from("donations").update(donationUpdate).eq("id", donation.id);

  // Only mutate booking state on COMPLETED / FAILED. Approved/Pending stay as
  // payment_link_sent — the link's been opened but money hasn't moved.
  if (status !== "COMPLETED" && status !== "FAILED" && status !== "CANCELED") {
    return;
  }

  const bookingId = (donation.metadata as { booking_id?: string } | null)?.booking_id;
  if (!bookingId) return;

  const { data: booking } = await service
    .from("bookings")
    .select(
      "id, booking_status, payment_status, amount_due_cents, amount_paid_cents",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;

  const before = { ...booking };

  if (status === "COMPLETED" && amountCents != null) {
    const newPaid = (booking.amount_paid_cents ?? 0) + amountCents;
    const due = booking.amount_due_cents ?? newPaid;
    const fullyPaid = due > 0 && newPaid >= due;
    const newPaymentStatus: PaymentStatus = fullyPaid ? "paid" : "deposit_paid";
    const newBookingStatus: BookingStatus = fullyPaid && booking.booking_status !== "completed" && booking.booking_status !== "cancelled"
      ? "confirmed"
      : booking.booking_status as BookingStatus;

    const after = {
      ...booking,
      amount_paid_cents: newPaid,
      paid_at: new Date().toISOString(),
      payment_status: newPaymentStatus,
      booking_status: newBookingStatus,
      square_payment_id: payment.id,
    };

    await service
      .from("bookings")
      .update({
        amount_paid_cents: newPaid,
        paid_at: after.paid_at,
        payment_status: newPaymentStatus,
        booking_status: newBookingStatus,
        square_payment_id: payment.id,
      })
      .eq("id", bookingId);

    await writeAudit(service, bookingId, before, after, "Square payment completed");
  } else if (status === "FAILED" || status === "CANCELED") {
    const after = { ...booking, payment_status: "failed" as PaymentStatus };
    await service
      .from("bookings")
      .update({ payment_status: "failed" })
      .eq("id", bookingId);
    await writeAudit(service, bookingId, before, after, `Square payment ${status.toLowerCase()}`);
  }
}

async function handleRefundEvent(service: SupabaseClient, refund: SquareRefund) {
  if (!refund.payment_id) throw new Error("refund.payment_id missing");
  if ((refund.status ?? "").toUpperCase() !== "COMPLETED") return;

  const { data: donation } = await service
    .from("donations")
    .select("id, metadata, amount_cents")
    .eq("square_payment_id", refund.payment_id)
    .maybeSingle();
  if (!donation) return;

  await service
    .from("donations")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", donation.id);

  const bookingId = (donation.metadata as { booking_id?: string } | null)?.booking_id;
  if (!bookingId) return;

  const { data: booking } = await service
    .from("bookings")
    .select(
      "id, booking_status, payment_status, amount_due_cents, amount_paid_cents",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;

  const refundCents = toCents(refund.amount_money?.amount) ?? donation.amount_cents ?? 0;
  const newPaid = Math.max((booking.amount_paid_cents ?? 0) - refundCents, 0);
  const before = { ...booking };
  const after = {
    ...booking,
    amount_paid_cents: newPaid,
    payment_status: "refunded" as PaymentStatus,
  };

  await service
    .from("bookings")
    .update({
      amount_paid_cents: newPaid,
      payment_status: "refunded",
    })
    .eq("id", bookingId);

  await writeAudit(service, bookingId, before, after, "Square refund processed");
}

// ── Helpers ─────────────────────────────────────────────────────────

type DonationRow = {
  id: string;
  square_payment_id: string | null;
  square_order_id: string | null;
  square_payment_link_id: string | null;
  metadata: Record<string, unknown> | null;
  amount_cents: number;
  member_id: string;
  status: string;
};

async function findDonationForPayment(
  service: SupabaseClient,
  payment: SquarePayment,
): Promise<DonationRow | null> {
  if (payment.id) {
    const { data } = await service
      .from("donations")
      .select(
        "id, square_payment_id, square_order_id, square_payment_link_id, metadata, amount_cents, member_id, status",
      )
      .eq("square_payment_id", payment.id)
      .maybeSingle();
    if (data) return data as DonationRow;
  }
  if (payment.order_id) {
    const { data } = await service
      .from("donations")
      .select(
        "id, square_payment_id, square_order_id, square_payment_link_id, metadata, amount_cents, member_id, status",
      )
      .eq("square_order_id", payment.order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as DonationRow;
  }
  return null;
}

async function selfHealDonation(
  service: SupabaseClient,
  payment: SquarePayment,
): Promise<DonationRow> {
  // Last-resort path: webhook arrived with no matching donation row. This
  // shouldn't happen because create-payment-link inserts the row first, but
  // belt-and-suspenders — insert a minimal row so the booking update has a
  // donation to refer to. member_id and booking_id can't be resolved here
  // (no customer→member mapping), so this is a partial recovery only.
  console.warn("self-healing donation for orphan Square payment", payment.id);
  const { data, error } = await service
    .from("donations")
    .insert({
      member_id: "00000000-0000-0000-0000-000000000000",
      amount_cents: toCents(payment.amount_money?.amount) ?? 0,
      currency: "usd",
      status: "pending",
      kind: "journey_contribution",
      square_payment_id: payment.id,
      square_order_id: payment.order_id ?? null,
      metadata: { provider: "square", orphan: true },
    })
    .select(
      "id, square_payment_id, square_order_id, square_payment_link_id, metadata, amount_cents, member_id, status",
    )
    .single();
  if (error || !data) {
    throw new Error(`self-heal donation insert failed: ${error?.message ?? "unknown"}`);
  }
  return data as DonationRow;
}

async function writeAudit(
  service: SupabaseClient,
  bookingId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  reason: string,
) {
  const { error } = await service.from("audit_log").insert({
    table_name: "bookings",
    row_id: bookingId,
    action: "update",
    actor_id: null,
    actor_type: "square_webhook",
    before_state: before,
    after_state: after,
    reason,
    metadata: {},
  });
  if (error) {
    console.error("audit_log insert failed (Square webhook)", { bookingId, error: error.message });
  }
}

async function markReceipt(
  service: SupabaseClient,
  eventId: string,
  status: "processed" | "failed",
  errorMessage: string | null,
) {
  await service
    .from("webhook_receipts")
    .update({
      processing_status: status,
      processing_error: errorMessage,
    })
    .eq("idempotency_key", eventId);
}

function toCents(value: number | string | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!Number.isFinite(n)) return null;
  return n;
}

function isUniqueViolation(err: { code?: string }): boolean {
  return err?.code === "23505";
}

function headerSnapshot(headers: Headers): Record<string, string> {
  const snap: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "x-square-hmacsha256-signature" || key === "content-type") {
      snap[key] = value;
    }
  });
  return snap;
}
