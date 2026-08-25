/**
 * PR 10C: the founder's Public Support console.
 *
 * Configure the receipt identity and campaign parameters, PREVIEW everything
 * the public and supporters will see — the /support page, the fee disclosure,
 * the thank-you breakdown, the acknowledgment, the QR — and activate or
 * retire the campaign. Activation is a DATABASE-authorized founder action
 * under this founder's own JWT; service_role cannot perform it.
 */

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import SupportPageView from "@/app/support/SupportPageView";
import PublicSupportControls from "./PublicSupportControls";
import { quoteProcessingFee } from "@/lib/finance/public-support-fees";
import { renderAcknowledgmentEmail } from "@/lib/finance/acknowledgment-email";
import { usd } from "@/lib/finance/public-support-page";

export const metadata = { title: "Public Support — Vital Kauaʻi" };
export const dynamic = "force-dynamic";

type FounderCampaign = {
  id: string;
  slug: string;
  status: string;
  livemode: boolean;
  min_amount_cents: number;
  max_amount_cents: number;
  bounds_approved_at: string | null;
  copy_version: string;
  activation_reason: string | null;
  activated_at: string | null;
  retirement_reason: string | null;
  retired_at: string | null;
  entity_display_name: string;
  legal_name: string | null;
  ein_last4: string | null;
  tax_exempt_basis: string | null;
  tax_deductible_ack_enabled: boolean;
  fund_display_name: string;
  fee_bps: number;
  fee_fixed_cents: number;
  fee_policy_version: string;
  receipt_footer: string | null;
  receipt_contact: string | null;
  ack_tax_language: string | null;
  ack_no_goods_statement: string | null;
  ack_template_version: string;
  legal_entity_id: string;
};

export default async function PublicSupportConsole() {
  const supabase = await createServerSupabase();
  const fin = supabase.schema("finance_api");
  const { data } = await fin
    .from("founder_public_campaigns")
    .select("*")
    .eq("slug", "general-support")
    .returns<FounderCampaign[]>();
  const c = data?.[0];

  if (!c) {
    return (
      <main style={{ padding: 40, fontFamily: "var(--font-body, sans-serif)" }}>
        <h1>Public Support</h1>
        <p>The campaign could not be loaded (founder session required).</p>
      </main>
    );
  }

  const configured =
    Boolean(c.legal_name) && c.tax_deductible_ack_enabled &&
    Boolean(c.ack_tax_language) && Boolean(c.ack_no_goods_statement) &&
    Boolean(c.receipt_footer) && Boolean(c.bounds_approved_at);

  const feePolicy = {
    feeBps: c.fee_bps,
    feeFixedCents: c.fee_fixed_cents,
    feePolicyVersion: c.fee_policy_version,
  };
  const samples = [500, 10000, 100000].map((cents) => quoteProcessingFee(cents, feePolicy));
  const sample100 = samples[1];

  const ackPreview =
    configured && c.legal_name && c.ack_tax_language && c.ack_no_goods_statement
      ? renderAcknowledgmentEmail({
          ack_id: "preview",
          receipt_number: "VK-2026-00000 (SAMPLE)",
          amount_cents: sample100.totalCents,
          contribution_cents: sample100.contributionCents,
          processing_fee_cents: sample100.processingFeeCents,
          contribution_date: "2026-08-25",
          legal_name: c.legal_name,
          receipt_footer: c.receipt_footer,
          tax_language: c.ack_tax_language,
          no_goods_statement: c.ack_no_goods_statement,
          template_version: c.ack_template_version,
          fund_display_name: c.fund_display_name,
          delivery_status: "pending",
        })
      : null;

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 80px", fontFamily: "var(--font-body, sans-serif)" }}>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 30, color: "#1E3A2C", margin: "0 0 4px" }}>
        Public Support
      </h1>
      <p style={{ color: "#8A8A84", margin: "0 0 24px", fontSize: 14 }}>
        Campaign <code>{c.slug}</code> &middot; status <strong>{c.status}</strong>
        {c.activated_at ? ` · activated ${new Date(c.activated_at).toLocaleDateString()}` : ""}
        {c.retired_at ? ` · retired ${new Date(c.retired_at).toLocaleDateString()}` : ""}
      </p>

      <PublicSupportControls
        campaignId={c.id}
        entityId={c.legal_entity_id}
        status={c.status}
        configured={configured}
        current={{
          legalName: c.legal_name,
          einLast4: c.ein_last4,
          taxExemptBasis: c.tax_exempt_basis,
          receiptFooter: c.receipt_footer,
          receiptContact: c.receipt_contact,
          ackTaxLanguage: c.ack_tax_language,
          ackNoGoodsStatement: c.ack_no_goods_statement,
          ackEnabled: c.tax_deductible_ack_enabled,
          minCents: c.min_amount_cents,
          maxCents: c.max_amount_cents,
          boundsApproved: Boolean(c.bounds_approved_at),
          feeBps: c.fee_bps,
          feeFixedCents: c.fee_fixed_cents,
          feePolicyVersion: c.fee_policy_version,
        }}
      />

      <section style={{ margin: "36px 0" }}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>Fee disclosure preview</h2>
        <p style={{ color: "#8A8A84", fontSize: 13, margin: "0 0 10px" }}>
          Founder-configured policy {c.fee_policy_version}: {(c.fee_bps / 100).toFixed(2)}% + {usd(c.fee_fixed_cents)}. The supporter pays the fee; the fee is never optional.
        </p>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {["Contribution", "Card processing fee", "Total charged"].map((h) => (
                <th key={h} style={{ textAlign: "right", padding: "6px 14px", borderBottom: "1px solid #d8d6cd", color: "#46564e" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((q) => (
              <tr key={q.contributionCents}>
                <td style={{ textAlign: "right", padding: "6px 14px" }}>{usd(q.contributionCents)}</td>
                <td style={{ textAlign: "right", padding: "6px 14px" }}>{usd(q.processingFeeCents)}</td>
                <td style={{ textAlign: "right", padding: "6px 14px", fontWeight: 700 }}>{usd(q.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ margin: "36px 0" }}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>QR — permanent, reusable</h2>
        <p style={{ color: "#8A8A84", fontSize: 13, margin: "0 0 12px", maxWidth: 640 }}>
          Encodes only <code>https://vitalkauai.com/support</code> — never a Stripe link — so every printed
          copy stays valid if the payment implementation changes. Do not distribute before activation.
        </p>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/support-qr-1024.png" alt="QR code for vitalkauai.com/support" width={140} height={140} style={{ border: "1px solid #d8d6cd", borderRadius: 8 }} />
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <a href="/support-qr-1024.png" download style={{ color: "#B8683D" }}>Download PNG (1024px)</a><br />
            <a href="/support-qr.svg" download style={{ color: "#B8683D" }}>Download SVG (print-scale)</a><br />
            <a href="/dashboard/financials/public-support/qr-card" style={{ color: "#B8683D" }}>Open printable QR card</a>
          </div>
        </div>
      </section>

      {ackPreview ? (
        <section style={{ margin: "36px 0" }}>
          <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>Acknowledgment preview (sample figures)</h2>
          <div style={{ border: "1px dashed #B8683D", borderRadius: 10, padding: 8, maxWidth: 640 }}
               dangerouslySetInnerHTML={{ __html: ackPreview.html }} />
        </section>
      ) : (
        <section style={{ margin: "36px 0" }}>
          <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>Acknowledgment preview</h2>
          <p style={{ color: "#8a4b2f", fontSize: 14 }}>
            Configure the legal name, acknowledgment wording, footer and bounds to unlock the preview
            — activation is refused (VK428) until this is complete.
          </p>
        </section>
      )}

      <section style={{ margin: "36px 0" }}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>Thank-you page preview (sample figures)</h2>
        <div style={{ border: "1px dashed #B8683D", borderRadius: 10, maxWidth: 640, padding: "16px 20px", background: "#fff" }}>
          <h3 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 24, color: "#1E3A2C", margin: "0 0 8px" }}>Mahalo for your contribution.</h3>
          <div style={{ border: "1px solid #8fb29b", background: "#f7fbf7", borderRadius: 12, padding: "12px 16px", fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Contribution</span><span>{usd(sample100.contributionCents)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Card processing fee</span><span>{usd(sample100.processingFeeCents)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #d5e3d5", marginTop: 6, paddingTop: 6 }}><span>Total charged</span><span>{usd(sample100.totalCents)}</span></div>
          </div>
        </div>
      </section>

      <section style={{ margin: "36px 0" }}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 22, color: "#1E3A2C" }}>Public page preview</h2>
        <p style={{ color: "#8A8A84", fontSize: 13, margin: "0 0 10px" }}>Exactly what /support renders once active. The form below is display-only.</p>
        <div style={{ border: "1px dashed #B8683D", borderRadius: 10, overflow: "hidden" }}>
          <SupportPageView
            campaign={{
              slug: c.slug,
              status: c.status,
              entity_display_name: c.entity_display_name,
              fund_display_name: c.fund_display_name,
              min_amount_cents: c.min_amount_cents,
              max_amount_cents: c.max_amount_cents,
              copy_version: c.copy_version,
              fee_bps: c.fee_bps,
              fee_fixed_cents: c.fee_fixed_cents,
              fee_policy_version: c.fee_policy_version,
            }}
            interactive={false}
            previewLabel="Founder preview — not live"
          />
        </div>
      </section>
    </main>
  );
}
