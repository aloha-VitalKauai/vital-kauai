/**
 * PR 10C: the printable branded QR card — for email, social sharing, events
 * and physical signage. The QR encodes only https://vitalkauai.com/support.
 * Founder-only route (dashboard); print with the browser's print dialog.
 */

export const metadata = { title: "Support QR Card — Vital Kauaʻi" };

export default function QrCardPage() {
  return (
    <main style={{ background: "#f8f5ef", minHeight: "100vh", padding: 24, fontFamily: "var(--font-body, sans-serif)" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { background: #ffffff !important; padding: 0 !important; }
          .qr-card { box-shadow: none !important; margin: 0 auto !important; }
        }
      `}</style>
      <div className="no-print" style={{ maxWidth: 460, margin: "0 auto 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/dashboard/financials/public-support" style={{ color: "#B8683D", fontSize: 14 }}>&larr; Back</a>
        <span style={{ color: "#8A8A84", fontSize: 13 }}>Use your browser&rsquo;s Print dialog to print or save as PDF.</span>
      </div>

      <div
        className="qr-card"
        style={{
          width: 420, margin: "0 auto", background: "#ffffff",
          border: "1px solid #d8d6cd", borderRadius: 18, overflow: "hidden",
          boxShadow: "0 8px 30px rgba(9,36,25,0.12)",
        }}
      >
        <div style={{ background: "#092419", color: "#f5f0e8", padding: "22px 28px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display, serif)", fontSize: 22, letterSpacing: "0.17em" }}>VITAL KAUAʻI</div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6, color: "#9fb8a8" }}>General Support</div>
        </div>
        <div style={{ padding: "28px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 20, color: "#1E3A2C", margin: "0 0 6px" }}>
            Support the work.
          </p>
          <p style={{ fontSize: 13, color: "#46564e", lineHeight: 1.6, margin: "0 0 20px" }}>
            Your contribution sustains the people, practice, and ceremony at the heart of Vital Kauaʻi.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/support-qr.svg" alt="QR code for vitalkauai.com/support" width={240} height={240} style={{ display: "block", margin: "0 auto" }} />
          <p style={{ fontSize: 14, color: "#1E3A2C", margin: "18px 0 0", letterSpacing: "0.03em" }}>vitalkauai.com/support</p>
        </div>
        <div style={{ borderTop: "1px solid #eceade", padding: "12px 28px 18px", textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#8A8A84" }}>Secure payment powered by Stripe</span>
        </div>
      </div>
    </main>
  );
}
