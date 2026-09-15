/**
 * Founder alert on every new lead.
 *
 * One short email to the founders the moment a lead arrives from any public
 * form, so a same-day personal reply is possible while the automatic notes
 * carry the rest. Server-side only (needs RESEND_API_KEY). Never throws:
 * a failed alert must never fail the lead capture that triggered it.
 */

export const FOUNDER_ALERT_EMAILS = ["aloha@vitalkauai.com", "joshuaperdue2@gmail.com"] as const;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderFounderLeadAlert(input: {
  fullName: string;
  email: string;
  source: string;
  phone?: string | null;
  message?: string | null;
  leadsUrl: string;
}): { subject: string; html: string; text: string } {
  const { fullName, email, source, phone, message, leadsUrl } = input;
  const subject = `New lead · ${fullName || email} · ${source}`;
  const lines = [
    `New lead from ${source}.`,
    `Name: ${fullName || "(none given)"}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    message ? `Message: ${message}` : null,
    ``,
    `Reply directly to this email to write to them. The automatic follow-up notes continue on their own and stop the moment they book.`,
    `Leads: ${leadsUrl}`,
  ].filter((l) => l !== null) as string[];
  const text = lines.join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#1a1a18">
    <p><strong>New lead from ${esc(source)}.</strong></p>
    <p>Name: ${esc(fullName || "(none given)")}<br>Email: <a href="mailto:${esc(email)}">${esc(email)}</a>${phone ? `<br>Phone: ${esc(phone)}` : ""}</p>
    ${message ? `<p style="border-left:2px solid #c8a96e;padding-left:12px;color:#3d3d38">${esc(message)}</p>` : ""}
    <p style="color:#6b6b64;font-size:14px">Reply directly to this email to write to them. The automatic follow-up notes continue on their own and stop the moment they book.<br><a href="${esc(leadsUrl)}">Open leads</a></p>
  </div>`;
  return { subject, html, text };
}

export async function sendFounderLeadAlert(input: {
  fullName: string;
  email: string;
  source: string;
  phone?: string | null;
  message?: string | null;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";
  try {
    const { subject, html, text } = renderFounderLeadAlert({ ...input, leadsUrl: `${siteUrl}/dashboard/leads` });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Vital Kauaʻi <aloha@vitalkauai.com>",
        to: [...FOUNDER_ALERT_EMAILS],
        reply_to: input.email,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) console.error("[founder-alert] Resend", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[founder-alert] failed", err);
    return false;
  }
}
