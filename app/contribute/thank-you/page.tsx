/**
 * PR 6: the success return. A redirect is not settled money — this page checks
 * the canonical Session + ledger state and says "confirming" until both agree.
 */
import { confirmBySessionId } from "@/lib/finance/checkout";

export const metadata = { title: "Mahalo—Vital Kauaʻi" };
export const dynamic = "force-dynamic";

const FOREST = "#1E3A2C";

export default async function ThankYouPage({
  searchParams,
}: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const s = session_id ? await confirmBySessionId(session_id).catch(() => ({ state: "pending" as const })) : { state: "unknown" as const };

  return (
    <main style={{ minHeight: "100vh", background: "#f8f5ef", fontFamily: "var(--font-body, sans-serif)", color: "#1A1A18" }}>
      <div style={{ background: "#092419", color: "#f5f0e8", padding: "0 34px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 21, letterSpacing: "0.17em" }}>VITAL KAUAʻI</span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Secure contribution</span>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 22px" }}>
        <section style={{ background: "#fff", border: "1px solid #d8d6cd", borderRadius: 15, padding: "34px 36px" }}>
          {s.state === "confirmed" ? (
            <>
              <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 30, color: FOREST, margin: "0 0 10px" }}>Mahalo for your contribution</h1>
              <p style={{ color: "#46564e", fontSize: 15, lineHeight: 1.6 }}>
                {(s.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} has
                been received and recorded. A receipt is on its way from Stripe.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 30, color: FOREST, margin: "0 0 10px" }}>We’re confirming your contribution</h1>
              <p style={{ color: "#46564e", fontSize: 15, lineHeight: 1.6 }}>
                Your payment is being confirmed with Stripe. This usually takes a moment—please
                do not submit another payment.
              </p>
              <a href="" style={{ display: "inline-block", marginTop: 14, color: FOREST, fontSize: 14, border: "1px solid rgba(30,58,44,0.3)", borderRadius: 7, padding: "9px 16px", textDecoration: "none" }}>Refresh</a>
            </>
          )}
          <p style={{ marginTop: 22, fontSize: 13 }}>
            <span style={{ color: "#8A8A84" }}>Questions? </span>
            <a href="mailto:aloha@vitalkauai.com" style={{ color: "#B8683D", textDecoration: "none" }}>Contact Vital Kauaʻi</a>
          </p>
        </section>
      </div>
    </main>
  );
}
