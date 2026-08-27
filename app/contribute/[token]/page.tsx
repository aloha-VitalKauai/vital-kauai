/**
 * PR 6: the controlled contribution bridge. Token possession is the credential;
 * the page shows no member identity, agreement ids or history. Amount comes
 * from the canonical view via resolveTokenState — never from the client.
 */
import { resolveTokenState } from "@/lib/finance/checkout";
import ContinueButton from "./ContinueButton";

export const metadata = { title: "Your Contribution—Vital Kauaʻi" };
export const dynamic = "force-dynamic";

const IVORY = "#FBFAF6", FOREST = "#1E3A2C", MUTED = "#8A8A84", COPPER = "#B8683D";

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await resolveTokenState(token).catch(() => ({ state: "review" as const }));

  const terminal: Record<string, { h: string; b: string }> = {
    unknown: { h: "This link is not recognised", b: "Nothing has been charged. Please contact Vital Kauaʻi for a current link." },
    expired: { h: "This link has expired", b: "Nothing has been charged. Please contact Vital Kauaʻi for a current link." },
    revoked: { h: "This link is no longer active", b: "Nothing has been charged. Please contact Vital Kauaʻi for a current link." },
    paid: { h: "Your contribution is complete", b: "Mahalo. No additional payment is needed." },
    processing: { h: "We’re confirming your contribution", b: "Please do not submit another payment. Your confirmation is on its way." },
    review: { h: "We’re reviewing this checkout", b: "Please do not submit another payment. We’ll contact you if anything is needed." },
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8f5ef", fontFamily: "var(--font-body, sans-serif)", color: "#1A1A18" }}>
      <div style={{ background: "#092419", color: "#f5f0e8", padding: "0 34px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 21, letterSpacing: "0.17em" }}>VITAL KAUAʻI</span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Secure contribution</span>
      </div>
      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "42px 22px" }}>
        <section style={{ border: "1px solid #d8d6cd", borderRadius: 15, padding: "32px 36px", background: "linear-gradient(110deg,#f7f8f2,#fbf5eb)", marginBottom: 20 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#57906e", fontWeight: 700, margin: "0 0 8px" }}>Your contribution</p>
          <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 34, color: FOREST, margin: "0 0 14px", maxWidth: 420 }}>Thank you for your contribution.</h1>
          <div style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, maxWidth: 640 }}>
            <p style={{ margin: "0 0 11px" }}>Your contribution is always welcome and appreciated. It opens the door for members called to this work who carry fewer resources, so they can be met with the same care.</p>
            <p style={{ margin: 0 }}>It supports the ʻāina of Kauaʻi’s North Shore and the nonprofits we walk alongside who protect and preserve this land. And it sustains the church itself, the people, practice, and ceremony at the heart of Vital Kauaʻi.</p>
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #d8d6cd", borderRadius: 15, padding: "30px 34px", maxWidth: 640 }}>
          {(s.state === "ready" || s.state === "open_session") ? (
            <>
              <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#57906e", fontWeight: 700, margin: "0 0 6px" }}>Journey Contribution</p>
              <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 26, color: FOREST, margin: "0 0 4px" }}>
                {s.state === "open_session" ? "Your secure checkout is ready" : "Continue your contribution"}
              </h2>
              <p style={{ color: MUTED, margin: "0 0 22px", fontSize: 14 }}>Your secure payment amount is calculated from your current agreement.</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #8fb29b", background: "#f7fbf7", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                <div>
                  <span style={{ display: "block", color: MUTED, fontSize: 11, marginBottom: 4 }}>Amount due today</span>
                  <strong style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 29, color: FOREST, fontVariantNumeric: "tabular-nums" }}>{usd(s.amountCents)}</strong>
                </div>
              </div>
              <ContinueButton token={token} resume={s.state === "open_session"} />
              <p style={{ textAlign: "center", color: MUTED, fontSize: 12, margin: "12px 0 0" }}>Secure payment powered by Stripe</p>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 18, borderTop: "1px solid #e2e4e0", paddingTop: 14 }}>
                Your amount is verified again before Stripe opens. No card details are entered or stored by Vital Kauaʻi.
              </p>
            </>
          ) : s.state === "confirmed" ? (
            <>
              <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 26, color: FOREST, margin: "0 0 8px" }}>Mahalo for your contribution</h2>
              <p style={{ color: "#46564e", fontSize: 15 }}>{usd(s.amountCents)} has been received. A receipt is on its way from Stripe.</p>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 26, color: FOREST, margin: "0 0 8px" }}>{terminal[s.state]?.h ?? "Secure checkout is temporarily unavailable"}</h2>
              <p style={{ color: "#46564e", fontSize: 15 }}>{terminal[s.state]?.b ?? "Nothing has been charged. Please try again shortly."}</p>
            </>
          )}
          <p style={{ marginTop: 20, fontSize: 13 }}>
            <span style={{ color: MUTED }}>Questions? </span>
            <a href="mailto:aloha@vitalkauai.com" style={{ color: COPPER, textDecoration: "none", borderBottom: "1px solid #d8a48a" }}>Contact Vital Kauaʻi</a>
          </p>
        </section>
      </div>
      <div style={{ display: "none" }}>{IVORY}</div>
    </main>
  );
}
