import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveTemplate, type ResolvedFields } from "@/lib/transactional-emails";

/**
 * Lead follow-up sequence.
 *
 * Every lead who reached out and has not booked a discovery call receives a
 * short series of personal notes from Vital Kauaʻi, each ending at the booking
 * link. The sequence stops the moment a call is booked, the lead becomes a
 * member, or the person asks to stop.
 *
 * The record of what was sent lives in `notification_log` (one row per lead
 * and step, `notification_type` = `lead_followup_<step>`), which also serves
 * as the dedup key. A stop request is a row of type `lead_followup_stopped`.
 * No schema change.
 */

export type FollowupStep = {
  /** Suffix used in notification_type and the template key. */
  key: "day2" | "day5" | "day10" | "day21";
  /** Days after the lead was created before this step may send. */
  day: number;
};

export const FOLLOWUP_STEPS: readonly FollowupStep[] = [
  { key: "day2", day: 2 },
  { key: "day5", day: 5 },
  { key: "day10", day: 10 },
  { key: "day21", day: 21 },
];

export const FOLLOWUP_TYPE_PREFIX = "lead_followup_";
export const FOLLOWUP_STOPPED_TYPE = "lead_followup_stopped";

/** Sources whose leads booked a call already; they never enter the sequence. */
const BOOKED_SOURCES = new Set(["Calendly"]);

export type FollowupLead = {
  id: string;
  full_name: string | null;
  email: string;
  source: string | null;
  created_at: string;
  discovery_call_booked: boolean | null;
  converted_to_member: boolean | null;
  approval_status: string | null;
};

export type SentRecord = { notification_type: string; sent_at: string | null; created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The sequences are forward-only. Leads created before this moment (and
 * invitations sent before it) are never written to; the list that existed
 * when the system was built is not treated as a live pipeline.
 */
export const SEQUENCE_START_AT = new Date("2026-09-16T00:00:00Z");

/** True when this lead is still in the sequence at all. */
export function isEligible(lead: FollowupLead, sent: SentRecord[]): boolean {
  if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return false;
  if (new Date(lead.created_at).getTime() < SEQUENCE_START_AT.getTime()) return false;
  if (lead.discovery_call_booked || lead.converted_to_member) return false;
  if (lead.source && BOOKED_SOURCES.has(lead.source)) return false;
  if (lead.approval_status === "declined") return false;
  if (sent.some((s) => s.notification_type === FOLLOWUP_STOPPED_TYPE)) return false;
  return true;
}

/**
 * The single step due for this lead right now, or null.
 *
 * Only the next unsent step is considered, and it sends only once both are
 * true: the lead is at least `step.day` days old, and at least the gap
 * between this step and the previous one has passed since the previous
 * send. So an old lead who never received anything gets day2 today, day5
 * three days later, and so on, rather than the whole series at once.
 */
export function dueStep(lead: FollowupLead, sent: SentRecord[], now: Date): FollowupStep | null {
  if (!isEligible(lead, sent)) return null;
  const sentByKey = new Map<string, Date>();
  for (const s of sent) {
    if (!s.notification_type.startsWith(FOLLOWUP_TYPE_PREFIX)) continue;
    const key = s.notification_type.slice(FOLLOWUP_TYPE_PREFIX.length);
    sentByKey.set(key, new Date(s.sent_at ?? s.created_at));
  }
  const created = new Date(lead.created_at).getTime();
  let prev: FollowupStep | null = null;
  for (const step of FOLLOWUP_STEPS) {
    const sentAt = sentByKey.get(step.key);
    if (sentAt) {
      prev = step;
      continue;
    }
    const byAge = created + step.day * DAY_MS;
    const prevSent = prev ? sentByKey.get(prev.key)!.getTime() : created;
    const byGap = prevSent + (step.day - (prev?.day ?? 0)) * DAY_MS;
    return now.getTime() >= Math.max(byAge, byGap) ? step : null;
  }
  return null;
}

// ── Stop link ────────────────────────────────────────────────

function stopSecret(): string {
  const s = process.env.LEAD_FOLLOWUP_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("LEAD_FOLLOWUP_SECRET or CRON_SECRET must be set");
  return s;
}

export function stopToken(leadId: string, secret = stopSecret()): string {
  return createHmac("sha256", secret).update(leadId).digest("hex").slice(0, 32);
}

export function verifyStopToken(leadId: string, token: string, secret = stopSecret()): boolean {
  const expected = stopToken(leadId, secret);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function stopUrl(siteUrl: string, leadId: string): string {
  return `${siteUrl}/api/lead-followups/stop?l=${encodeURIComponent(leadId)}&t=${stopToken(leadId)}`;
}

// ── Copy ─────────────────────────────────────────────────────

export const BOOKING_URL =
  "https://calendly.com/aloha-vitalkauai/30min?utm_source=email&utm_medium=followup&utm_campaign=dc60";

const SIGNOFF = `<p>With aloha,<br>Vital Kauaʻi<br>Hanalei, Kauaʻi</p>`;

export const FOLLOWUP_DEFAULTS: Record<FollowupStep["key"], ResolvedFields> = {
  day2: {
    subject: "A conversation, whenever you are ready",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>You reached out to Vital Kauaʻi recently, and we wanted to write to you personally.</p><p>People find their way to us at their own pace. Some read the guide and sit with it for months. Some know the moment they land on the page. Wherever you are with it, the next step is the same and it is simple: a 30-minute conversation with us. We hear what is calling you, walk you through how the program works, and answer whatever questions are alive in you.</p>",
    body_html: "<p>If that feels right, choose a time below. And if you would rather just write back, we read every reply.</p>",
    cta_label: "Choose a time",
    closing_html: SIGNOFF,
  },
  day5: {
    subject: "What the call is",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>A discovery call is thirty minutes on Zoom. We get to meet you, hear what is calling you, and answer your questions about safety, preparation, timing, and membership.</p><p>You leave knowing whether this path is yours. That is the whole call. Membership is by application, so the conversation is where we both find out.</p>",
    body_html: "<p>If you have been circling it, this is the door.</p>",
    cta_label: "Book a discovery call",
    closing_html: SIGNOFF,
  },
  day10: {
    subject: "Up to three, and months of holding",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>Every ceremony here is a gathering of up to three members. Three, so that every person is fully seen and fully held. The ceremony is two nights; the journey around it is months: medical review, somatic and nervous-system preparation, and structured integration with our team of guides, practitioners, and physicians.</p><p>This depth of holding is what we felt was missing from plant ally spaces, and it is what we bring to every member.</p>",
    body_html: "<p>If you want to understand how it would work for you, the conversation is where that begins.</p>",
    cta_label: "Book a discovery call",
    closing_html: SIGNOFF,
  },
  day21: {
    subject: "Whenever the time is right",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>This is the last note from us for a while. The invitation stays open: when the time is right, a 30-minute conversation is how every journey with us begins.</p><p>Until then, be gentle with yourself. The work you have already done is the ground the root meets you on.</p>",
    body_html: "<p>The link below will be here whenever you are.</p>",
    cta_label: "Book a discovery call",
    closing_html: SIGNOFF,
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function renderFollowupEmail(input: {
  step: FollowupStep;
  lead: FollowupLead;
  siteUrl: string;
}): Promise<{ subject: string; html: string }> {
  const { step, lead, siteUrl } = input;
  const firstName = esc((lead.full_name ?? "").trim().split(/\s+/)[0] || "friend");
  const fields = await resolveTemplate(
    `lead_followup_${step.key}`,
    { firstName, bookingUrl: BOOKING_URL },
    FOLLOWUP_DEFAULTS[step.key],
  );
  const stop = esc(stopUrl(siteUrl, lead.id));

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:44px 44px 40px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:26px;font-weight:400;line-height:1.3;margin:0 0 18px}
    p{color:rgba(245,240,232,.78);font-size:16px;line-height:1.75;margin:0 0 18px}
    .cta-wrap{margin:26px 0 10px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:16px 34px;border-radius:3px}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.35);text-align:center;line-height:1.9;margin-top:28px}
    .footer a{color:rgba(245,240,232,.5)}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">${fields.eyebrow}</p>
      <h1>${fields.heading}</h1>
      ${fields.lead_html}
      ${fields.body_html}
      <div class="cta-wrap"><a class="cta" href="${esc(BOOKING_URL)}">${fields.cta_label}</a></div>
      ${fields.closing_html}
      <div class="footer">Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714<br><a href="${stop}">Stop these notes</a></div>
    </div>
  </div></div>
</body>
</html>`;

  return { subject: fields.subject, html };
}

export async function sendFollowupEmail(input: {
  toEmail: string;
  subject: string;
  html: string;
  resendKey: string;
}): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.resendKey}` },
    body: JSON.stringify({
      from: "Vital Kauaʻi <aloha@vitalkauai.com>",
      reply_to: "aloha@vitalkauai.com",
      to: input.toEmail,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
  const json = (await res.json().catch(() => null)) as { id?: string } | null;
  return json?.id ?? null;
}
