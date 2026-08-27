/**
 * PR 10C: the public support page, as one shared view.
 *
 * Rendered live at /support and inside the founder's preview — the founder
 * approves exactly what the public will see. The approved contribution
 * language is preserved verbatim from the member contribution page; the
 * receiving entity and fund names come from the database, never source code.
 *
 * Deliberately absent: urgency language, countdowns, donor rankings, payment
 * apps, financial jargon. General Support only.
 */

import SupportCheckout from "./SupportCheckout";
import { presetAmounts, type PublicCampaign } from "@/lib/finance/public-support-page";

export const IVORY = "#f8f5ef";
export const FOREST = "#1E3A2C";
export const HEADER = "#092419";
export const MUTED = "#8A8A84";
export const COPPER = "#B8683D";
export const SAGE = "#57906e";
const BORDER = "#d8d6cd";

export default function SupportPageView({
  campaign,
  interactive,
  previewLabel,
}: {
  campaign: PublicCampaign;
  /** False in founder preview: the form renders but never submits. */
  interactive: boolean;
  previewLabel?: string;
}) {
  return (
    <main style={{ minHeight: "100vh", background: IVORY, fontFamily: "var(--font-body, sans-serif)", color: "#1A1A18" }}>
      <div style={{ background: HEADER, color: "#f5f0e8", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display, serif)", fontSize: 21, letterSpacing: "0.17em" }}>VITAL KAUAʻI</span>
        <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>General Support</span>
      </div>

      {previewLabel ? (
        <div style={{ background: COPPER, color: "#fff", textAlign: "center", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px" }}>
          {previewLabel}
        </div>
      ) : null}

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "42px 22px 64px" }}>
        <section style={{ border: `1px solid ${BORDER}`, borderRadius: 15, padding: "32px 36px", background: "linear-gradient(110deg,#f7f8f2,#fbf5eb)", marginBottom: 20 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SAGE, fontWeight: 700, margin: "0 0 8px" }}>
            {campaign.fund_display_name}
          </p>
          <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 34, color: FOREST, margin: "0 0 14px", maxWidth: 460 }}>
            Support the work of {campaign.entity_display_name}.
          </h1>
          <div style={{ color: "#46564e", lineHeight: 1.65, fontSize: 15, maxWidth: 640 }}>
            <p style={{ margin: "0 0 11px" }}>
              Your contribution is always welcome and appreciated. It opens the door for members called
              to this work who carry fewer resources, so they can be met with the same care.
            </p>
            <p style={{ margin: 0 }}>
              It supports the ʻāina of Kauaʻi&rsquo;s North Shore and the nonprofits we walk alongside who
              protect and preserve this land. And it sustains the church itself, the people, practice,
              and ceremony at the heart of Vital Kauaʻi.
            </p>
          </div>
        </section>

        <section style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 15, padding: "30px 34px", maxWidth: 640 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SAGE, fontWeight: 700, margin: "0 0 6px" }}>
            Make a contribution
          </p>
          <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 26, color: FOREST, margin: "0 0 4px" }}>
            Choose your contribution
          </h2>
          <p style={{ color: MUTED, margin: "0 0 20px", fontSize: 14 }}>
            Receiving entity: {campaign.entity_display_name} &middot; {campaign.fund_display_name}
          </p>

          <SupportCheckout
            minCents={campaign.min_amount_cents}
            maxCents={campaign.max_amount_cents}
            presets={presetAmounts(campaign.min_amount_cents, campaign.max_amount_cents)}
            interactive={interactive}
          />

          <p style={{ textAlign: "center", color: MUTED, fontSize: 12, margin: "14px 0 0" }}>
            Secure payment powered by Stripe
          </p>
          <p style={{ color: MUTED, fontSize: 12, marginTop: 18, borderTop: "1px solid #e2e4e0", paddingTop: 14 }}>
            Card details are entered only on Stripe&rsquo;s secure payment page—never on this site.
            A written acknowledgment for your full contribution will be emailed to you.
          </p>
          <p style={{ marginTop: 14, fontSize: 13 }}>
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
