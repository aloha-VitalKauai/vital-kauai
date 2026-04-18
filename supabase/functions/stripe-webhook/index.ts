import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/**
 * Self-healing donation upsert. Returns the donation row's id.
 * If a row already exists for this session, returns it. Otherwise inserts
 * one from session metadata so a payment is NEVER silently lost when an API
 * route's INSERT failed before the user redirected to Stripe.
 */
async function ensureDonationRow(s: Stripe.Checkout.Session) {
  const { data: existing, error: lookupErr } = await supabase
    .from("donations")
    .select("id, status")
    .eq("stripe_session_id", s.id)
    .maybeSingle();

  if (lookupErr) throw new Error(`donations lookup failed: ${lookupErr.message}`);
  if (existing) return existing;

  // Fall back to donation_id in metadata (when API route inserted row first
  // but failed to UPDATE the session_id back).
  const donationIdMeta = s.metadata?.donation_id;
  if (donationIdMeta) {
    const { data: byMeta } = await supabase
      .from("donations")
      .select("id, status")
      .eq("id", donationIdMeta)
      .maybeSingle();
    if (byMeta) {
      // Backfill the session_id so future events match by session_id.
      await supabase
        .from("donations")
        .update({ stripe_session_id: s.id })
        .eq("id", byMeta.id)
        .is("stripe_session_id", null);
      return byMeta;
    }
  }

  // Last-resort self-heal: insert from metadata.
  const memberId = s.metadata?.member_id;
  const kind = s.metadata?.kind ?? "initial_membership";
  if (!memberId) {
    throw new Error(
      `webhook for unknown session with no member_id in metadata: ${s.id}`,
    );
  }
  const { data: inserted, error: insertErr } = await supabase
    .from("donations")
    .insert({
      member_id: memberId,
      journey_id: s.metadata?.journey_id ?? null,
      stripe_session_id: s.id,
      amount_cents: s.amount_total ?? 0,
      currency: s.currency ?? "usd",
      status: "pending",
      kind,
      metadata: {
        commitment_id: s.metadata?.commitment_id,
        token_used: s.metadata?.token_used,
        self_healed: true,
      },
    })
    .select("id, status")
    .single();
  if (insertErr || !inserted) {
    throw new Error(`donations self-heal insert failed: ${insertErr?.message}`);
  }
  return inserted;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("no signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("signature verification failed", err);
    return new Response("bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;

        const existing = await ensureDonationRow(s);

        // Idempotency guard
        if (existing.status === "completed" || existing.status === "refunded") {
          break;
        }

        const amount_cents = s.amount_total ?? 0;
        const currency = s.currency ?? "usd";
        const pi =
          typeof s.payment_intent === "string"
            ? s.payment_intent
            : s.payment_intent?.id;

        let receiptUrl: string | null = null;
        if (pi) {
          try {
            const intent = await stripe.paymentIntents.retrieve(pi, {
              expand: ["latest_charge"],
            });
            const charge = intent.latest_charge as Stripe.Charge | null;
            receiptUrl = charge?.receipt_url ?? null;
          } catch (err) {
            console.error("paymentIntents.retrieve failed", err);
          }
        }

        await supabase
          .from("donations")
          .update({
            status: "completed",
            amount_cents,
            currency,
            stripe_payment_intent_id: pi ?? null,
            receipt_url: receiptUrl,
            completed_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", s.id)
          .neq("status", "completed"); // atomic guard

        // Mark payment_token consumed if this was a tokenized link
        const tokenUsed = s.metadata?.token_used;
        if (tokenUsed) {
          await supabase
            .from("payment_tokens")
            .update({ consumed_at: new Date().toISOString() })
            .eq("token", tokenUsed)
            .is("consumed_at", null);
        }

        // Phase 2: allocate to commitment if this is a journey contribution
        if (
          s.metadata?.kind === "journey_contribution" &&
          s.metadata?.commitment_id
        ) {
          const { data: donation } = await supabase
            .from("donations")
            .select("id")
            .eq("stripe_session_id", s.id)
            .single();

          if (donation) {
            const { data: fc } = await supabase
              .from("financial_commitments")
              .select("expected_amount_cents")
              .eq("id", s.metadata.commitment_id)
              .single();

            const { data: priorAlloc } = await supabase
              .from("payment_allocations")
              .select("allocated_amount_cents")
              .eq("commitment_id", s.metadata.commitment_id);

            const alreadyAllocated = (priorAlloc ?? []).reduce(
              (acc: number, r: { allocated_amount_cents: number }) =>
                acc + r.allocated_amount_cents,
              0,
            );
            const capacity = Math.max(
              (fc?.expected_amount_cents ?? 0) - alreadyAllocated,
              0,
            );
            const toAllocate = Math.min(amount_cents, capacity);

            if (toAllocate > 0) {
              const { error: allocErr } = await supabase
                .from("payment_allocations")
                .insert({
                  donation_id: donation.id,
                  commitment_id: s.metadata.commitment_id,
                  allocated_amount_cents: toAllocate,
                });
              if (allocErr) {
                console.error("allocation insert failed", allocErr);
              }
            }
            // amount_cents - toAllocate remains unallocated (credit)
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const { data: existing } = await supabase
          .from("donations")
          .select("status")
          .eq("stripe_session_id", s.id)
          .maybeSingle();
        if (
          !existing ||
          existing.status === "failed" ||
          existing.status === "completed"
        )
          break;

        await supabase
          .from("donations")
          .update({ status: "failed", failure_reason: "async_payment_failed" })
          .eq("stripe_session_id", s.id)
          .eq("status", "pending");
        break;
      }

      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi =
          typeof c.payment_intent === "string"
            ? c.payment_intent
            : c.payment_intent?.id;
        if (!pi) break;

        const { data: existing } = await supabase
          .from("donations")
          .select("status")
          .eq("stripe_payment_intent_id", pi)
          .maybeSingle();
        if (!existing || existing.status === "refunded") break;

        await supabase
          .from("donations")
          .update({
            status: "refunded",
            refunded_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", pi)
          .neq("status", "refunded");

        // Phase 2: send refund alert email for journey contributions
        // (DB trigger handles journey cancellation + ops_alert row)
        const { data: refunded } = await supabase
          .from("donations")
          .select("id, kind, amount_cents, member_id, journey_id")
          .eq("stripe_payment_intent_id", pi)
          .single();

        if (refunded?.kind === "journey_contribution") {
          const { data: mp } = await supabase
            .from("member_profiles")
            .select("full_name, email")
            .eq("id", refunded.member_id)
            .single();

          const resendKey = Deno.env.get("RESEND_API_KEY");
          const founderEmail =
            Deno.env.get("FOUNDER_EMAIL") ?? "aloha@vitalkauai.com";
          if (resendKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Vital Kauaʻi <notifications@vitalkauai.com>",
                to: [founderEmail],
                subject: `Journey payment refunded — ${mp?.full_name ?? "member"}`,
                html: `
                  <p>A journey payment was refunded and the journey has been auto-canceled.</p>
                  <ul>
                    <li><b>Member:</b> ${mp?.full_name ?? ""} (${mp?.email ?? ""})</li>
                    <li><b>Amount refunded:</b> $${(refunded.amount_cents / 100).toFixed(2)}</li>
                    <li><b>Journey ID:</b> ${refunded.journey_id}</li>
                    <li><b>Donation ID:</b> ${refunded.id}</li>
                  </ul>
                  <p>Review in the founder dashboard.</p>
                `,
              }),
            }).catch((err) => console.error("resend failed", err));
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("webhook handler error", err);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
