import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { getMembershipDonationConfig } from "@/lib/billing/getMembershipDonationConfig";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-06-20" as any,
  });
}

export async function POST() {
  const stripe = getStripe();
  // 1. Authed user
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 2. Canonical amount
  const cfg = await getMembershipDonationConfig(supabase);
  if (cfg.amount_cents <= 0) {
    return NextResponse.json(
      { error: "Membership donation amount is not configured." },
      { status: 500 },
    );
  }

  // 3. Service-role client for donation reads + inserts
  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 4. Reuse an open pending session (30-min window) — spam protection
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: openRow } = await service
    .from("donations")
    .select("stripe_session_id")
    .eq("member_id", user.id)
    .eq("kind", "initial_membership")
    .eq("status", "pending")
    .gte("created_at", thirtyMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openRow?.stripe_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        openRow.stripe_session_id,
      );
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
    } catch {
      // fall through — create a new session
    }
  }

  // 5. Insert pending donation FIRST so the webhook always has a row to find.
  const { data: pending, error: insertErr } = await service
    .from("donations")
    .insert({
      member_id: user.id, // DO NOT refactor this lookup. See DO NOT CHANGE.
      amount_cents: cfg.amount_cents,
      currency: cfg.currency,
      status: "pending",
      kind: "initial_membership",
    })
    .select("id")
    .single();

  if (insertErr || !pending) {
    console.error("donations insert failed", insertErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  // 6. Create Checkout session with dynamic price_data
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: cfg.currency,
          unit_amount: cfg.amount_cents,
          product_data: {
            name: cfg.label,
            description:
              "Refundable membership donation · Applied toward first month",
          },
        },
      },
    ],
    success_url: `${siteUrl}/portal/onboarding/donation?donation=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/portal/onboarding/donation?donation=cancelled`,
    metadata: {
      member_id: user.id, // DO NOT refactor this lookup. See DO NOT CHANGE.
      donation_id: pending.id,
      kind: "initial_membership",
    },
  });

  // 7. Stamp the session_id back so webhook can match by stripe_session_id
  await service
    .from("donations")
    .update({ stripe_session_id: session.id })
    .eq("id", pending.id);

  return NextResponse.json({ url: session.url });
}
