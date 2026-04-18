import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-06-20" as any,
  });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const { amount_cents } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));

  const cents = Number(amount_cents);
  if (!Number.isFinite(cents) || cents < 100 || cents > 1_000_000) {
    return NextResponse.json(
      { error: "amount_cents must be between 100 and 1000000" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Insert pending donation FIRST so the webhook always has a row to find.
  const { data: pending, error: insertErr } = await service
    .from("donations")
    .insert({
      member_id: user.id, // DO NOT refactor
      amount_cents: cents,
      currency: "usd",
      status: "pending",
      kind: "additional_gift",
    })
    .select("id")
    .single();

  if (insertErr || !pending) {
    console.error("donations insert failed", insertErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: {
            name: "Additional Gift — Vital Kaua\u02BBi",
          },
        },
      },
    ],
    success_url: `${siteUrl}/portal/donate?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/portal/donate?payment=cancelled`,
    metadata: {
      member_id: user.id, // DO NOT refactor
      donation_id: pending.id,
      kind: "additional_gift",
    },
  });

  // Stamp session_id back so webhook can match by stripe_session_id.
  await service
    .from("donations")
    .update({ stripe_session_id: session.id })
    .eq("id", pending.id);

  return NextResponse.json({ url: session.url, session_id: session.id });
}
