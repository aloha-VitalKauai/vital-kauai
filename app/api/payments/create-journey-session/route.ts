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
  const { journey_id, amount_cents } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));
  if (!journey_id)
    return NextResponse.json({ error: "journey_id required" }, { status: 400 });

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

  // 1. Active commitment for (user, journey)
  const { data: commitment } = await service
    .from("financial_commitments")
    .select("id, expected_amount_cents, status")
    .eq("journey_id", journey_id)
    .eq("member_id", user.id)
    .in("status", ["draft", "active", "partially_paid"])
    .maybeSingle();

  if (!commitment) {
    return NextResponse.json(
      { error: "No active commitment for this journey." },
      { status: 404 },
    );
  }

  // 2. Remaining balance
  const { data: alloc } = await service
    .from("payment_allocations")
    .select("allocated_amount_cents, donation:donations(status)")
    .eq("commitment_id", commitment.id);

  const paid = (alloc ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.donation?.status === "completed")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((sum: number, r: any) => sum + r.allocated_amount_cents, 0);

  const remaining = commitment.expected_amount_cents - paid;
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Commitment already paid." },
      { status: 400 },
    );
  }

  // 3. Charge = requested (if given) else full remaining, clamped to [100, remaining]
  const requested =
    Number.isFinite(amount_cents) && (amount_cents as number) > 0
      ? (amount_cents as number)
      : remaining;
  const charge = Math.min(Math.max(requested, 100), remaining);

  // 4. Reuse open pending session ONLY if amount matches
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: openRow } = await service
    .from("donations")
    .select("stripe_session_id")
    .eq("member_id", user.id)
    .eq("journey_id", journey_id)
    .eq("kind", "journey_contribution")
    .eq("status", "pending")
    .eq("amount_cents", charge)
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
      /* fall through */
    }
  }

  // 5. Cohort_id for denormalized linkage
  const { data: journey } = await service
    .from("journeys")
    .select("cohort_id")
    .eq("id", journey_id)
    .single();

  // 6. Insert pending donation FIRST so the webhook always has a row to find.
  const { data: pending, error: insertErr } = await service
    .from("donations")
    .insert({
      member_id: user.id, // DO NOT refactor
      journey_id: journey_id as string,
      cohort_id: journey?.cohort_id ?? null,
      amount_cents: charge,
      currency: "usd",
      status: "pending",
      kind: "journey_contribution",
      metadata: { commitment_id: commitment.id },
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
          unit_amount: charge,
          product_data: {
            name: "Journey Contribution",
            description: `Payment toward your journey${commitment.status === "partially_paid" ? " (partial)" : ""}`,
          },
        },
      },
    ],
    success_url: `${siteUrl}/portal/journey/payment?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/portal/journey/payment?payment=cancelled`,
    metadata: {
      member_id: user.id, // DO NOT refactor
      journey_id: journey_id as string,
      commitment_id: commitment.id,
      donation_id: pending.id,
      kind: "journey_contribution",
    },
  });

  // 7. Stamp the session_id back so webhook can match by stripe_session_id
  await service
    .from("donations")
    .update({ stripe_session_id: session.id })
    .eq("id", pending.id);

  return NextResponse.json({ url: session.url });
}
