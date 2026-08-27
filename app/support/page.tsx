/**
 * PR 10C: /support — the permanent public contribution page. The printed QR
 * encodes exactly this URL and nothing else, so it stays valid no matter how
 * the payment implementation changes.
 *
 * Fail-closed: with no ACTIVE campaign the page is a quiet notice — no form,
 * no amounts, no Stripe. The page runs with anon authority only.
 */

import SupportPageView, { FOREST, HEADER, IVORY, MUTED, COPPER } from "./SupportPageView";
import { fetchPublicCampaign } from "@/lib/finance/public-support-page";

export const metadata = {
  title: "Support Vital Kauaʻi",
  description: "Make a General Support contribution to Vital Kauaʻi Church.",
};
export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const campaign = await fetchPublicCampaign();

  // Development-only design escape so the full page can be reviewed and
  // screenshotted before activation. Never compiled into behavior differences
  // in production: the check is on NODE_ENV, not on request input alone.
  const params = await searchParams;
  const devPreview =
    process.env.NODE_ENV === "development" && params.preview === "1" && campaign !== null;

  if (campaign && (campaign.status === "active" || devPreview)) {
    return (
      <SupportPageView
        campaign={campaign}
        interactive={campaign.status === "active"}
        previewLabel={campaign.status === "active" ? undefined : "Design preview—contributions are not open"}
      />
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: IVORY, fontFamily: "var(--font-body, sans-serif)", color: "#1A1A18" }}>
      <div style={{ background: HEADER, color: "#f5f0e8", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 21, letterSpacing: "0.17em" }}>VITAL KAUAʻI</span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>General Support</span>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 22px" }}>
        <section style={{ background: "#fff", border: "1px solid #d8d6cd", borderRadius: 15, padding: "34px 36px" }}>
          <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 30, color: FOREST, margin: "0 0 12px" }}>
            Mahalo for thinking of us.
          </h1>
          <p style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, margin: "0 0 16px" }}>
            Online contributions are not open right now. Nothing has been charged.
          </p>
          <p style={{ fontSize: 14 }}>
            <span style={{ color: MUTED }}>To contribute or ask a question, please </span>
            <a href="mailto:aloha@vitalkauai.com" style={{ color: COPPER, textDecoration: "none", borderBottom: "1px solid #d8a48a" }}>
              contact Vital Kauaʻi
            </a>
            <span style={{ color: MUTED }}>.</span>
          </p>
        </section>
      </div>
    </main>
  );
}
