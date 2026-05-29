import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createServiceSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { getSquareEnv } from "@/lib/square/client";
import type { PaymentStatus, BookingStatus } from "@/lib/api/bookings";

export const runtime = "nodejs";

// Square webhook handler.
//
// Observability contract: EVERY successful Square payment (status=COMPLETED)
// must produce 4 database rows. If any of them is missing, the receipt is
// flipped to processing_status='partial' with a structured processing_error
// listing which writes failed. The webhook is observable from the database
// alone — no log scraping required.
//
//   1. webhook_receipts row (inserted at top, status flips at end)
//   2. donations row (insert or update with square_payment_id, status=completed)
//   3. bookings row (amount_paid_cents, paid_at, payment_status, booking_status)
//   4. audit_log row (actor_type=square_webhook, before+after jsonb)
//
// Diagnostic query for ops:
//   select event_type, processing_status, processing_error, received_at
//   from public.webhook_receipts
//   where source='square' and processing_status != 'processed'
//   order by received_at desc;

type StepResults = {
  receipt: "inserted" | "deduped" | "failed";
  donation: "updated" | "skipped" | "failed" | null;
  booking: "updated" | "skipped" | "not_found" | "missing_id" | "failed" | null;
  audit: "written" | "skipped" | "failed" | null;
  errors: string[];
};

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

  // ── Row 1: webhook_receipts insert (idempotent via UNIQUE constraint) ──
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

  const results: StepResults = {
    receipt: "inserted",
    donation: null,
    booking: null,
    audit: null,
    errors: [],
  };

  try {
    await dispatchEvent(service, event, results);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("square webhook dispatch failed", { event_id: event.event_id, message });
    results.errors.push(`dispatch_exception: ${message}`);
  }

  // ── Finalize receipt with consolidated outcome ──
  const status = computeReceiptStatus(event.type, results);
  await finalizeReceipt(service, event.event_id, status, results);

  // Always 200 — receipt is the durable record of what happened.
  return NextResponse.json({ ok: status === "processed", results });
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
  status?: string;
  amount_money?: { amount?: number | string; currency?: string };
  order_id?: string;
  customer_id?: string;
  receipt_url?: string;
  created_at?: string;
  updated_at?: string;
};

type SquareRefund = {
  id?: string;
  status?: string;
  payment_id?: string;
  amount_money?: { amount?: number | string };
  created_at?: string;
};

async function dispatchEvent(
  service: SupabaseClient,
  event: SquareEvent,
  results: StepResults,
): Promise<void> {
  switch (event.type) {
    case "payment.created":
    case "payment.updated": {
      const payment = event.data?.object?.payment;
      if (!payment) {
        results.errors.push("missing_payment_object");
        return;
      }
      await handlePaymentEvent(service, payment, results);
      return;
    }
    case "refund.created":
    case "refund.updated": {
      const refund = event.data?.object?.refund;
      if (!refund) {
        results.errors.push("missing_refund_object");
        return;
      }
      await handleRefundEvent(service, refund, results);
      return;
    }
    default:
      // Non-acted event — receipt logged, no further rows expected.
      results.donation = "skipped";
      results.booking = "skipped";
      results.audit = "skipped";
      return;
  }
}

async function handlePaymentEvent(
  service: SupabaseClient,
  payment: SquarePayment,
  results: StepResults,
): Promise<void> {
  if (!payment.id) {
    results.errors.push("payment_id_missing");
    return;
  }
  const status = (payment.status ?? "").toUpperCase();

  // ── Resolve donation row ──
  let donation = await findDonationForPayment(service, payment);
  if (!donation) {
    try {
      donation = await selfHealDonation(service, payment);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.errors.push(`donation_self_heal_failed: ${message}`);
      results.donation = "failed";
      return;
    }
  }

  // ── Row 2: update donation with provider IDs + status ──
  const donationUpdate: Record<string, unknown> = {
    square_payment_id: payment.id,
    square_order_id: payment.order_id ?? donation.square_order_id ?? null,
    square_customer_id: payment.customer_id ?? null,
  };
  const amountCents = toCents(payment.amount_money?.amount);
  if (status === "COMPLETED") {
    donationUpdate.status = "completed";
    donationUpdate.completed_at = new Date().toISOString();
    if (amountCents != null) donationUpdate.amount_cents = amountCents;
    if (payment.receipt_url) donationUpdate.receipt_url = payment.receipt_url;
  } else if (status === "FAILED" || status === "CANCELED") {
    donationUpdate.status = "failed";
    donationUpdate.failure_reason = `square_status_${status.toLowerCase()}`;
  }

  const { error: donationErr } = await service
    .from("donations")
    .update(donationUpdate)
    .eq("id", donation.id);
  if (donationErr) {
    results.errors.push(`donation_update_failed: ${donationErr.message}`);
    results.donation = "failed";
    return;
  }
  results.donation = "updated";

  // Non-terminal status → no booking/audit work expected.
  if (status !== "COMPLETED" && status !== "FAILED" && status !== "CANCELED") {
    results.booking = "skipped";
    results.audit = "skipped";
    return;
  }

  // ── Resolve booking ──
  const bookingId = (donation.metadata as { booking_id?: string } | null)?.booking_id;
  if (!bookingId) {
    results.errors.push("booking_id_missing_from_donation_metadata");
    results.booking = "missing_id";
    return;
  }

  const { data: booking, error: bookingFetchErr } = await service
    .from("bookings")
    .select(
      "id, booking_status, payment_status, amount_due_cents, amount_paid_cents",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingFetchErr) {
    results.errors.push(`booking_fetch_failed: ${bookingFetchErr.message}`);
    results.booking = "failed";
    return;
  }
  if (!booking) {
    results.errors.push(`booking_not_found: ${bookingId}`);
    results.booking = "not_found";
    return;
  }

  const before = { ...booking };
  let after: Record<string, unknown>;
  let bookingUpdate: Record<string, unknown>;
  let reason: string;

  if (status === "COMPLETED") {
    if (amountCents == null) {
      results.errors.push("payment_amount_missing");
      results.booking = "failed";
      return;
    }
    const newPaid = (booking.amount_paid_cents ?? 0) + amountCents;
    const due = booking.amount_due_cents ?? newPaid;
    const fullyPaid = due > 0 && newPaid >= due;
    const newPaymentStatus: PaymentStatus = fullyPaid ? "paid" : "deposit_paid";
    const newBookingStatus: BookingStatus =
      fullyPaid && booking.booking_status !== "completed" && booking.booking_status !== "cancelled"
        ? "confirmed"
        : (booking.booking_status as BookingStatus);

    bookingUpdate = {
      amount_paid_cents: newPaid,
      paid_at: new Date().toISOString(),
      payment_status: newPaymentStatus,
      booking_status: newBookingStatus,
      square_payment_id: payment.id,
    };
    after = { ...before, ...bookingUpdate };
    reason = "Square payment completed";
  } else {
    // FAILED / CANCELED
    bookingUpdate = { payment_status: "failed" };
    after = { ...before, payment_status: "failed" };
    reason = `Square payment ${status.toLowerCase()}`;
  }

  // ── Row 3: update booking ──
  const { error: bookingUpdateErr } = await service
    .from("bookings")
    .update(bookingUpdate)
    .eq("id", bookingId);
  if (bookingUpdateErr) {
    results.errors.push(`booking_update_failed: ${bookingUpdateErr.message}`);
    results.booking = "failed";
    return;
  }
  results.booking = "updated";

  // ── Row 4: audit_log write ──
  const { error: auditErr } = await service.from("audit_log").insert({
    table_name: "bookings",
    row_id: bookingId,
    action: "update",
    actor_id: null,
    actor_type: "square_webhook",
    before_state: before,
    after_state: after,
    reason,
    metadata: { event_id: payment.id, square_status: status },
  });
  if (auditErr) {
    results.errors.push(`audit_log_failed: ${auditErr.message}`);
    results.audit = "failed";
    return;
  }
  results.audit = "written";
}

async function handleRefundEvent(
  service: SupabaseClient,
  refund: SquareRefund,
  results: StepResults,
): Promise<void> {
  if (!refund.payment_id) {
    results.errors.push("refund_payment_id_missing");
    return;
  }
  if ((refund.status ?? "").toUpperCase() !== "COMPLETED") {
    results.donation = "skipped";
    results.booking = "skipped";
    results.audit = "skipped";
    return;
  }

  const { data: donation, error: donationFetchErr } = await service
    .from("donations")
    .select("id, metadata, amount_cents")
    .eq("square_payment_id", refund.payment_id)
    .maybeSingle();
  if (donationFetchErr) {
    results.errors.push(`donation_fetch_failed: ${donationFetchErr.message}`);
    results.donation = "failed";
    return;
  }
  if (!donation) {
    results.errors.push(`donation_for_refund_not_found: payment=${refund.payment_id}`);
    results.donation = "failed";
    return;
  }

  const { error: donationUpdateErr } = await service
    .from("donations")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", donation.id);
  if (donationUpdateErr) {
    results.errors.push(`donation_refund_update_failed: ${donationUpdateErr.message}`);
    results.donation = "failed";
    return;
  }
  results.donation = "updated";

  const bookingId = (donation.metadata as { booking_id?: string } | null)?.booking_id;
  if (!bookingId) {
    results.errors.push("booking_id_missing_from_donation_metadata");
    results.booking = "missing_id";
    return;
  }

  const { data: booking, error: bookingFetchErr } = await service
    .from("bookings")
    .select(
      "id, booking_status, payment_status, amount_due_cents, amount_paid_cents",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingFetchErr) {
    results.errors.push(`booking_fetch_failed: ${bookingFetchErr.message}`);
    results.booking = "failed";
    return;
  }
  if (!booking) {
    results.errors.push(`booking_not_found: ${bookingId}`);
    results.booking = "not_found";
    return;
  }

  const refundCents = toCents(refund.amount_money?.amount) ?? donation.amount_cents ?? 0;
  const newPaid = Math.max((booking.amount_paid_cents ?? 0) - refundCents, 0);
  const before = { ...booking };
  const after = {
    ...before,
    amount_paid_cents: newPaid,
    payment_status: "refunded" as PaymentStatus,
  };

  const { error: bookingUpdateErr } = await service
    .from("bookings")
    .update({
      amount_paid_cents: newPaid,
      payment_status: "refunded",
    })
    .eq("id", bookingId);
  if (bookingUpdateErr) {
    results.errors.push(`booking_update_failed: ${bookingUpdateErr.message}`);
    results.booking = "failed";
    return;
  }
  results.booking = "updated";

  const { error: auditErr } = await service.from("audit_log").insert({
    table_name: "bookings",
    row_id: bookingId,
    action: "update",
    actor_id: null,
    actor_type: "square_webhook",
    before_state: before,
    after_state: after,
    reason: "Square refund processed",
    metadata: { refund_id: refund.id, payment_id: refund.payment_id },
  });
  if (auditErr) {
    results.errors.push(`audit_log_failed: ${auditErr.message}`);
    results.audit = "failed";
    return;
  }
  results.audit = "written";
}

// ── Receipt finalization ────────────────────────────────────────────

function computeReceiptStatus(
  eventType: string | undefined,
  results: StepResults,
): "processed" | "partial" | "failed" {
  // Hard failure: dispatch threw OR a non-event-type problem (e.g. missing payment object)
  // and nothing got written downstream.
  if (results.errors.some((e) => e.startsWith("dispatch_exception"))) {
    return "failed";
  }

  const isCompletedPayment =
    (eventType === "payment.created" || eventType === "payment.updated") &&
    results.donation === "updated" &&
    results.booking === "updated";

  // Strict 4-row contract on COMPLETED payments + completed refunds.
  const expectsAllFour =
    isCompletedPayment ||
    (eventType?.startsWith("refund.") && results.donation === "updated");

  if (expectsAllFour) {
    if (
      results.donation === "updated" &&
      results.booking === "updated" &&
      results.audit === "written"
    ) {
      return "processed";
    }
    return "partial";
  }

  // Non-acted events / non-terminal payment states — receipt is the only
  // expected row. processed if no errors, partial if any.
  return results.errors.length === 0 ? "processed" : "partial";
}

async function finalizeReceipt(
  service: SupabaseClient,
  eventId: string,
  status: "processed" | "partial" | "failed",
  results: StepResults,
) {
  const errorPayload =
    status === "processed"
      ? null
      : JSON.stringify({
          status,
          donation: results.donation,
          booking: results.booking,
          audit: results.audit,
          errors: results.errors,
        });

  const { error } = await service
    .from("webhook_receipts")
    .update({
      processing_status: status,
      processing_error: errorPayload,
    })
    .eq("idempotency_key", eventId);

  if (error) {
    // Last-resort console — at this point even the receipt update failed,
    // which means DB connectivity is broken. There's nothing else to do.
    console.error("webhook_receipts finalize failed", {
      event_id: eventId,
      status,
      error: error.message,
    });
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

// ── Donation lookup helpers ─────────────────────────────────────────

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
  // Last-resort path: webhook arrived with no matching donation row. The
  // create-payment-link route inserts a pending donation FIRST so this
  // shouldn't fire — but if it does, log the orphan visibly. member_id is
  // null-valued (no customer→member mapping here); the booking update will
  // mark itself as missing_id in the receipt.
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

// ── Misc ────────────────────────────────────────────────────────────

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
