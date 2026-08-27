/**
 * PR 10C: /support/thank-you — the confirmation the supporter lands on.
 *
 * Every figure shown is OUR attempt row's server-persisted breakdown, looked
 * up by the Session id Stripe redirected back with and verified against
 * Stripe server-side. The browser contributes nothing but the opaque id; an
 * unknown or unpaid session shows a quiet, chargeless message.
 */

import { financeServiceClient, v2StripeClient } from "@/lib/finance/checkout";
import { FOREST, HEADER, IVORY, MUTED, COPPER } from "../SupportPageView";
import { usd } from "@/lib/finance/public-support-page";

export const metadata = { title: "Mahalo—Vital Kauaʻi" };
export const dynamic = "force-dynamic";

const SESSION_RE = /^cs_[A-Za-z0-9_]{8,200}$/;

type Attempt = {
  id: string;
  status: string;
  requested_contribution_cents: number;
  processing_fee_cents: number;
  total_charge_cents: number;
  stripe_session_id: string;
  completed_at: string | null;
};

type View =
  | { kind: "confirmed" | "confirming"; attempt: Attempt }
  | { kind: "unpaid" }
  | { kind: "unknown" };

async function resolve(sessionId: string): Promise<View> {
  if (!SESSION_RE.test(sessionId)) return { kind: "unknown" };

  const fin = financeServiceClient().schema("finance_api");
  const { data } = await fin
    .from("machine_public_checkout_attempts")
    .select("id, status, requested_contribution_cents, processing_fee_cents, total_charge_cents, stripe_session_id, completed_at")
    .eq("stripe_session_id", sessionId)
    .returns<Attempt[]>();
  const attempt = data?.[0];
  if (!attempt) return { kind: "unknown" };

  if (attempt.status === "completed") return { kind: "confirmed", attempt };

  // Not yet recorded by the worker: ask Stripe whether the money is settled.
  try {
    const s = await v2StripeClient().checkout.sessions.retrieve(sessionId);
    if (s.payment_status === "paid" && s.metadata?.financial_version === "public_support_v1") {
      return { kind: "confirming", attempt };
    }
  } catch {
    /* fall through to unpaid */
  }
  return { kind: "unpaid" };
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const view = await resolve(sessionId);

  return (
    <main style={{ minHeight: "100vh", background: IVORY, fontFamily: "var(--font-body, sans-serif)", color: "#1A1A18" }}>
      <div style={{ background: HEADER, color: "#f5f0e8", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 21, letterSpacing: "0.17em" }}>VITAL KAUAʻI</span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>General Support</span>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 22px" }}>
        <section style={{ background: "#fff", border: "1px solid #d8d6cd", borderRadius: 15, padding: "34px 36px" }}>
          {view.kind === "confirmed" || view.kind === "confirming" ? (
            <>
              <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 32, color: FOREST, margin: "0 0 10px" }}>
                Mahalo for your contribution.
              </h1>
              <p style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, margin: "0 0 20px" }}>
                {view.kind === "confirmed"
                  ? "Your contribution has been received. A written acknowledgment will be emailed to you."
                  : "Your payment is confirmed with Stripe and is being recorded. A written acknowledgment will be emailed to you."}
              </p>
              <div style={{ border: "1px solid #8fb29b", background: "#f7fbf7", borderRadius: 12, padding: "16px 20px" }}>
                <Row label="Contribution" value={usd(view.attempt.requested_contribution_cents)} />
                <Row label="Card processing fee" value={usd(view.attempt.processing_fee_cents)} />
                <div style={{ borderTop: "1px solid #d5e3d5", margin: "10px 0" }} />
                <Row label="Total charged" value={usd(view.attempt.total_charge_cents)} strong />
              </div>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
                This fee helps ensure your full intended contribution reaches Vital Kauaʻi.
              </p>
            </>
          ) : view.kind === "unpaid" ? (
            <>
              <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 28, color: FOREST, margin: "0 0 10px" }}>
                Your contribution was not completed.
              </h1>
              <p style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, margin: 0 }}>
                Nothing has been charged. You are welcome to return to the support page and try again.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 28, color: FOREST, margin: "0 0 10px" }}>
                We couldn&rsquo;t find that contribution.
              </h1>
              <p style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, margin: 0 }}>
                If you completed a payment, your acknowledgment will still arrive by email.
              </p>
            </>
          )}
          <p style={{ marginTop: 20, fontSize: 13 }}>
            <span style={{ color: MUTED }}>Questions? </span>
            <a href="mailto:aloha@vitalkauai.com" style={{ color: COPPER, textDecoration: "none", borderBottom: "1px solid #d8a48a" }}>
              Contact Vital Kauaʻi
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 0" }}>
      <span style={{ color: strong ? FOREST : "#46564e", fontSize: strong ? 15 : 14, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ color: FOREST, fontVariantNumeric: "tabular-nums", fontFamily: strong ? "var(--font-display, serif)" : undefined, fontSize: strong ? 22 : 15 }}>
        {value}
      </span>
    </div>
  );
}
