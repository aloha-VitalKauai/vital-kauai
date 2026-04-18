import { redirect } from "next/navigation";
import Stripe from "stripe";
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

export default async function PayByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // 1. Look up token (no consumption — webhook stamps consumed_at on success).
  const { data: pt } = await service
    .from("payment_tokens")
    .select("token, commitment_id, consumed_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pt) return <TokenInvalid reason="not_available" />;
  if (pt.consumed_at) return <TokenInvalid reason="already_paid" />;
  if (new Date(pt.expires_at) <= new Date())
    return <TokenInvalid reason="expired" />;

  // 2. Load commitment
  const { data: fc } = await service
    .from("financial_commitments")
    .select("id, member_id, journey_id, expected_amount_cents, status")
    .eq("id", pt.commitment_id)
    .single();
  if (!fc || !["draft", "active", "partially_paid"].includes(fc.status)) {
    return <TokenInvalid reason="commitment_closed" />;
  }

  // 3. Remaining balance
  const { data: alloc } = await service
    .from("payment_allocations")
    .select("allocated_amount_cents, donation:donations(status)")
    .eq("commitment_id", fc.id);
  const paid = (alloc ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.donation?.status === "completed")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, r: any) => s + r.allocated_amount_cents, 0);
  const remaining = fc.expected_amount_cents - paid;
  if (remaining <= 0) return <TokenInvalid reason="already_paid" />;

  // 4. Reuse an open Stripe session for this token within the last 30 min
  //    (handles Stripe-cancel → user clicks the same link again).
  const stripe = getStripe();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: openRow } = await service
    .from("donations")
    .select("stripe_session_id, amount_cents")
    .eq("kind", "journey_contribution")
    .eq("status", "pending")
    .eq("amount_cents", remaining)
    .contains("metadata", { token_used: token })
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
        redirect(existing.url);
      }
    } catch {
      // fall through and create a new session
    }
  }

  // 5. Member email for Stripe receipt
  const { data: mp } = await service
    .from("member_profiles")
    .select("email")
    .eq("id", fc.member_id)
    .single();

  const { data: journey } = await service
    .from("journeys")
    .select("cohort_id")
    .eq("id", fc.journey_id)
    .single();

  // 6. Insert pending donation FIRST so the webhook can never lose the row
  const { data: pendingDonation, error: insertErr } = await service
    .from("donations")
    .insert({
      member_id: fc.member_id,
      journey_id: fc.journey_id,
      cohort_id: journey?.cohort_id ?? null,
      amount_cents: remaining,
      currency: "usd",
      status: "pending",
      kind: "journey_contribution",
      metadata: { commitment_id: fc.id, token_used: token },
    })
    .select("id")
    .single();

  if (insertErr || !pendingDonation) {
    console.error("token donation insert failed", insertErr);
    return <TokenInvalid reason="db_error" />;
  }

  // 7. Stripe session
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: mp?.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: remaining,
          product_data: { name: "Journey Contribution" },
        },
      },
    ],
    success_url: `${siteUrl}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/pay/${token}`,
    metadata: {
      member_id: fc.member_id,
      journey_id: fc.journey_id,
      commitment_id: fc.id,
      donation_id: pendingDonation.id,
      kind: "journey_contribution",
      token_used: token,
    },
  });

  // 8. Stamp the session_id back so webhook can find by session_id too
  await service
    .from("donations")
    .update({ stripe_session_id: session.id })
    .eq("id", pendingDonation.id);

  if (session.url) redirect(session.url);
  return <TokenInvalid reason="stripe_error" />;
}

function TokenInvalid({ reason }: { reason: string }) {
  const messages: Record<string, string> = {
    not_available: "This payment link is not valid.",
    expired: "This payment link has expired. Please request a new one.",
    commitment_closed: "This commitment is no longer open for payment.",
    already_paid: "This commitment has already been paid in full.",
    stripe_error: "Unable to open payment session. Please try again.",
    db_error: "We couldn't start the payment. Please try again.",
  };
  return (
    <main
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        Payment Link Unavailable
      </h1>
      <p style={{ color: "#8B8070" }}>
        {messages[reason] ?? messages.not_available}
      </p>
    </main>
  );
}
