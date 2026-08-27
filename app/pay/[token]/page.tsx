/**
 * PR 9 (D-086): retired legacy payment link.
 *
 * This route once resolved a retired link row and rendered a payable page.
 * It now performs NO lookup of any kind — no token parse, no database call, no
 * provider call — because a retired link must not be able to reach a retired
 * table even to discover that it is retired. The token in the URL is ignored.
 *
 * It is deliberately not a redirect to /portal/donate: an old link may be held
 * by someone who is not signed in, and silently landing them on a live payment
 * surface would invite a payment against the wrong record. It says what
 * happened and lets the member choose.
 */

export const metadata = { title: "Link retired—Vital Kauaʻi" };

const IVORY = "#f6f1e8", PAPER = "#fffdf8", FOREST = "#0d2118";
const FOREST2 = "#173529", MUTED = "#687169", LINE = "#dedbd1";

export default function RetiredPaymentLinkPage() {
  return (
    <main style={{ minHeight: "100vh", background: IVORY, display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <section
        style={{
          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 18,
          padding: "40px 36px", maxWidth: 560, width: "100%",
          fontFamily: "var(--font-body, system-ui, sans-serif)", color: "#18211c",
        }}
      >
        <p style={{ margin: "0 0 14px", color: "#a6653f", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Payment link
        </p>
        <h1 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontWeight: 400, fontSize: 34, lineHeight: 1.15, color: FOREST, margin: "0 0 18px" }}>
          This link has retired.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#415047", margin: "0 0 14px" }}>
          Nothing has been charged. This payment link belonged to our previous system,
          which is no longer in use.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#415047", margin: "0 0 28px" }}>
          Your Contribution and everything received toward it are safe, and you can
          view them any time in your member portal.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a
            href="/portal/donate"
            style={{ display: "inline-block", minHeight: 48, padding: "14px 22px", borderRadius: 10, background: "#a6653f", color: "#fff", fontWeight: 700, textDecoration: "none" }}
          >
            Open my Contribution
          </a>
          <a
            href="/portal/contact"
            style={{ display: "inline-block", minHeight: 48, padding: "14px 22px", borderRadius: 10, border: `1px solid ${FOREST2}`, color: FOREST2, fontWeight: 650, textDecoration: "none" }}
          >
            Contact Vital Kauaʻi
          </a>
        </div>
        <p style={{ fontSize: 13, color: MUTED, margin: "26px 0 0", lineHeight: 1.5 }}>
          If you are not signed in, you will be asked to sign in first—your Contribution
          is only ever shown to you.
        </p>
      </section>
    </main>
  );
}
