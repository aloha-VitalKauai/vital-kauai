/**
 * PR 10C: the written acknowledgment, rendered from the immutable snapshot.
 *
 * Template v1 supplies STRUCTURE only. Every legal statement — the entity's
 * legal name, the tax-deductibility language, the no-goods statement, the
 * receipt footer — is founder-configured text carried in the snapshot. This
 * module never hardcodes legal identity, an EIN, or any tax claim, and shows
 * the FULL amount paid with its Contribution / card processing fee breakdown
 * (amendment #12).
 */

export type AcknowledgmentSnapshot = {
  ack_id: string;
  receipt_number: string;
  amount_cents: number;
  contribution_cents: number | null;
  processing_fee_cents: number | null;
  contribution_date: string;
  legal_name: string;
  receipt_footer: string | null;
  tax_language: string;
  no_goods_statement: string;
  template_version: string;
  fund_display_name: string;
  delivery_status: string;
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export function renderAcknowledgmentEmail(a: AcknowledgmentSnapshot): {
  subject: string;
  html: string;
} {
  if (a.template_version !== "v1") {
    // A version this code cannot faithfully render must not be improvised.
    throw new Error(`unknown acknowledgment template version: ${a.template_version}`);
  }
  const breakdown =
    a.contribution_cents !== null && a.processing_fee_cents !== null
      ? `<table style="width:100%;border-collapse:collapse;margin:18px 0" role="presentation">
          <tr><td style="padding:4px 0;color:#46564e;font-size:14px">Contribution</td>
              <td style="padding:4px 0;text-align:right;color:#1E3A2C;font-size:14px">${usd(a.contribution_cents)}</td></tr>
          <tr><td style="padding:4px 0;color:#46564e;font-size:14px">Card processing fee</td>
              <td style="padding:4px 0;text-align:right;color:#1E3A2C;font-size:14px">${usd(a.processing_fee_cents)}</td></tr>
          <tr><td colspan="2" style="border-top:1px solid #d5e3d5;padding:0;height:6px"></td></tr>
          <tr><td style="padding:4px 0;color:#1E3A2C;font-size:15px;font-weight:bold">Total paid</td>
              <td style="padding:4px 0;text-align:right;color:#1E3A2C;font-size:18px;font-weight:bold">${usd(a.amount_cents)}</td></tr>
        </table>`
      : "";

  const html = `<div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#1A1A18;background:#f8f5ef;padding:28px">
    <div style="background:#092419;color:#f5f0e8;padding:18px 24px;letter-spacing:0.17em;font-size:18px">VITAL KAUAʻI</div>
    <div style="background:#ffffff;border:1px solid #d8d6cd;padding:26px 28px">
      <p style="font-size:15px;line-height:1.65;margin:0 0 14px">
        Thank you for your contribution of <strong>${usd(a.amount_cents)}</strong> to
        ${esc(a.legal_name)} on ${esc(longDate(a.contribution_date))} for ${esc(a.fund_display_name)}.
      </p>
      ${breakdown}
      <p style="font-size:14px;line-height:1.65;margin:0 0 10px;color:#46564e">${esc(a.no_goods_statement)}</p>
      <p style="font-size:14px;line-height:1.65;margin:0 0 18px;color:#46564e">${esc(a.tax_language)}</p>
      <p style="font-size:13px;margin:0 0 4px;color:#8A8A84">Receipt ${esc(a.receipt_number)}</p>
      ${a.receipt_footer ? `<p style="font-size:12px;line-height:1.6;margin:14px 0 0;color:#8A8A84;border-top:1px solid #e2e4e0;padding-top:12px">${esc(a.receipt_footer)}</p>` : ""}
    </div>
  </div>`;

  return {
    subject: `Your contribution acknowledgment — ${a.receipt_number}`,
    html,
  };
}
