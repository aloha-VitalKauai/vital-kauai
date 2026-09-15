import { resolveTemplate, type ResolvedFields } from "@/lib/transactional-emails";
import { BOOKING_URL } from "@/lib/lead-followups";

/**
 * Cancelled discovery call: one gentle re-book note.
 *
 * Calendly sends `invitee.canceled` both for a true cancellation and for the
 * first half of a reschedule (which is immediately followed by a new
 * `invitee.created`). Only a true cancellation earns the note.
 */

export const REBOOK_TYPE = "discovery_call_rebook";

export function isDiscoveryCallEvent(eventName: string | null | undefined): boolean {
  return /discovery/i.test(eventName ?? "");
}

/** True only for a genuine cancellation of a discovery call. */
export function shouldSendRebook(input: {
  eventType: string;
  eventName: string | null | undefined;
  rescheduled: boolean | null | undefined;
  alreadySent: boolean;
}): boolean {
  if (input.eventType !== "invitee.canceled") return false;
  if (!isDiscoveryCallEvent(input.eventName)) return false;
  if (input.rescheduled) return false;
  if (input.alreadySent) return false;
  return true;
}

const REBOOK_LINK = BOOKING_URL.replace("utm_medium=followup", "utm_medium=rebook");

export const REBOOK_DEFAULTS: ResolvedFields = {
  subject: "Whenever it works for you",
  eyebrow: "Vital Kauaʻi",
  heading: "Aloha {{firstName}},",
  lead_html:
    "<p>We saw the call had to move. Life does that, and there is no hurry on our side.</p><p>Whenever a new time works, the door is open: thirty minutes on Zoom with us, to hear what is calling you and answer whatever is alive in you.</p>",
  body_html: "<p>Pick a time below, or simply write back and we will find one together.</p>",
  cta_label: "Choose a new time",
  closing_html: "<p>With aloha,<br>Rachel<br>Vital Kauaʻi · Hanalei, Kauaʻi</p>",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function renderRebookEmail(fullName: string | null): Promise<{ subject: string; html: string }> {
  const firstName = esc((fullName ?? "").trim().split(/\s+/)[0] || "friend");
  const f = await resolveTemplate(REBOOK_TYPE, { firstName, bookingUrl: REBOOK_LINK }, REBOOK_DEFAULTS);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}.wrap{max-width:560px;margin:0 auto}.card{background:#1a2e1c;border-radius:6px;overflow:hidden}.top-bar{background:#c8a96e;height:4px}.inner{padding:44px 44px 40px}.eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}h1{color:#f5f0e8;font-size:26px;font-weight:400;line-height:1.3;margin:0 0 18px}p{color:rgba(245,240,232,.78);font-size:16px;line-height:1.75;margin:0 0 18px}.cta-wrap{margin:26px 0 10px;text-align:center}.cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:16px 34px;border-radius:3px}.footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.35);text-align:center;line-height:1.9;margin-top:28px}</style></head>
<body><div class="wrap"><div class="card"><div class="top-bar"></div><div class="inner">
<p class="eyebrow">${f.eyebrow}</p><h1>${f.heading}</h1>${f.lead_html}${f.body_html}
<div class="cta-wrap"><a class="cta" href="${esc(REBOOK_LINK)}">${f.cta_label}</a></div>${f.closing_html}
<div class="footer">Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714</div>
</div></div></div></body></html>`;
  return { subject: f.subject, html };
}
