import { NextResponse } from "next/server";
import { legacyPaymentsEnabled, legacyPaymentsDisabledResponse } from "@/lib/payments/legacy-enabled";
import { randomUUID } from "node:crypto";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { getSquareClient, getSquareEnv } from "@/lib/square/client";
import { isSquareActive } from "@/lib/payment-provider";

export const runtime = "nodejs";

// Caller scenarios:
//  - Member on /portal/journey/payment clicks Pay → POST { amount_cents? }
//    We resolve their current booking from session auth.
//  - Founder generates a link from /dashboard → POST { booking_id, amount_cents }
//    (Future. For now /api/payments/email-link still uses the Stripe path.)
//
// The request inserts a pending donation row FIRST (mirroring the Stripe
// pattern so a webhook always has a row to find), then calls Square, then
// stamps the IDs back onto donation + booking.
type Body = {
  booking_id?: string;
  amount_cents?: number;
};

export async function POST(req: Request) {
  // D-078: fail-closed legacy shutdown. MUST be the first statement — before
  // any Stripe/Square client construction, any auth call, and any DB write.
  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();

  if (!isSquareActive()) {
    return NextResponse.json(
      { error: "Square is not the active payment provider" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Resolve the member row for this auth user (members.id ≠ auth.uid()).
  const { data: member } = await service
    .from("members")
    .select("id, email, full_name")
    .eq("email", user.email ?? "")
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  // Resolve booking: explicit body.booking_id, otherwise most recent for this member.
  let bookingId = body.booking_id ?? null;
  if (!bookingId) {
    const { data: latest } = await service
      .from("bookings")
      .select("id")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    bookingId = latest?.id ?? null;
  }
  if (!bookingId) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  const { data: booking, error: bookingErr } = await service
    .from("bookings")
    .select(
      "id, member_id, journey_id, booking_status, payment_status, package_name, amount_due_cents, amount_paid_cents",
    )
    .eq("id", bookingId)
    .single();
  if (bookingErr || !booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  if (booking.member_id !== member.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (booking.booking_status === "cancelled" || booking.booking_status === "completed") {
    return NextResponse.json(
      { error: "booking_terminal_state" },
      { status: 400 },
    );
  }

  // Charge amount: explicit override, else remaining (due − paid). Floor at 100c.
  const remaining = Math.max(
    (booking.amount_due_cents ?? 0) - (booking.amount_paid_cents ?? 0),
    0,
  );
  const requested =
    body.amount_cents !== undefined && body.amount_cents !== null
      ? Number(body.amount_cents)
      : remaining;
  if (!Number.isFinite(requested) || requested < 100) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  const chargeCents = Math.min(Math.max(Math.round(requested), 100), remaining || requested);

  const idempotencyKey = randomUUID();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

  // 1. Insert pending donation row FIRST so the webhook always has something
  //    to find. square_* IDs fill in below once Square responds.
  const { data: donation, error: donationErr } = await service
    .from("donations")
    .insert({
      member_id: member.id,
      journey_id: booking.journey_id ?? null,
      amount_cents: chargeCents,
      currency: "usd",
      status: "pending",
      kind: "journey_contribution",
      metadata: {
        provider: "square",
        booking_id: booking.id,
        idempotency_key: idempotencyKey,
      },
    })
    .select("id")
    .single();
  if (donationErr || !donation) {
    console.error("donations insert failed", donationErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  // 2. Create Square payment link via Quick Pay.
  const square = getSquareClient();
  const { locationId } = getSquareEnv();
  let url: string | null = null;
  let orderId: string | null = null;
  let paymentLinkId: string | null = null;
  try {
    const response = await square.checkout.paymentLinks.create({
      idempotencyKey,
      description: `Vital Kauaʻi booking ${booking.id}`,
      quickPay: {
        name: booking.package_name?.trim() || "Journey contribution",
        priceMoney: {
          amount: BigInt(chargeCents),
          currency: "USD",
        },
        locationId,
      },
      checkoutOptions: {
        redirectUrl: `${siteUrl}/portal/journey/payment?payment=success`,
        askForShippingAddress: false,
      },
      paymentNote: `booking:${booking.id}|donation:${donation.id}`,
    });
    const link = response.paymentLink;
    url = link?.url ?? null;
    orderId = link?.orderId ?? null;
    paymentLinkId = link?.id ?? null;
  } catch (e) {
    console.error("square.paymentLinks.create failed", e);
    // Roll back the pending donation so we don't leave orphan rows.
    await service.from("donations").delete().eq("id", donation.id);
    return NextResponse.json({ error: "square_link_failed" }, { status: 502 });
  }

  if (!url || !paymentLinkId) {
    await service.from("donations").delete().eq("id", donation.id);
    return NextResponse.json({ error: "square_link_missing_url" }, { status: 502 });
  }

  // 3. Stamp Square IDs back onto donation + booking. Best-effort:
  //    failures here don't block the redirect (webhook can self-heal).
  const stamp = await Promise.allSettled([
    service
      .from("donations")
      .update({
        square_payment_link_id: paymentLinkId,
        square_order_id: orderId,
      })
      .eq("id", donation.id),
    service
      .from("bookings")
      .update({
        payment_status: "payment_link_sent",
        square_payment_link_id: paymentLinkId,
        square_order_id: orderId,
        amount_due_cents: booking.amount_due_cents ?? chargeCents,
      })
      .eq("id", booking.id),
  ]);
  stamp
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("square link stamp failed", r));

  return NextResponse.json({ url, payment_link_id: paymentLinkId, order_id: orderId });
}
