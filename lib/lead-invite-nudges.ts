import { resolveTemplate, type ResolvedFields } from "@/lib/transactional-emails";

/**
 * Post-call nudges.
 *
 * After a discovery call, a founder approves the lead and the system emails
 * a membership setup link. Some people let that sit. This sends two gentle
 * reminders, with a fresh link, to anyone approved who has not completed
 * setup: three days after the invitation, and again seven days after the
 * first reminder. Stops the moment they join. Dedup through
 * notification_log like the pre-call sequence.
 */

export const NUDGE_STEPS = [
  { key: "invite_nudge_1", daysAfterInvite: 3 },
  { key: "invite_nudge_2", daysAfterPrev: 7 },
] as const;

export type NudgeKey = (typeof NUDGE_STEPS)[number]["key"];
export const NUDGE_TYPE_PREFIX = "lead_";

export type NudgeLead = {
  id: string;
  full_name: string | null;
  email: string;
  member_id: string | null;
  approval_status: string | null;
  converted_to_member: boolean | null;
  invite_sent_at: string | null;
};

export type NudgeSent = { notification_type: string; sent_at: string | null; created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function dueNudge(lead: NudgeLead, sent: NudgeSent[], now: Date): NudgeKey | null {
  if (lead.approval_status !== "approved") return null;
  if (lead.converted_to_member) return null;
  if (!lead.member_id || !lead.invite_sent_at) return null;
  if (sent.some((s) => s.notification_type === "lead_followup_stopped")) return null;
  const at = (key: string) => {
    const r = sent.find((s) => s.notification_type === `${NUDGE_TYPE_PREFIX}${key}`);
    return r ? new Date(r.sent_at ?? r.created_at).getTime() : null;
  };
  const invited = new Date(lead.invite_sent_at).getTime();
  const t = now.getTime();
  const n1 = at("invite_nudge_1");
  if (n1 === null) return t >= invited + 3 * DAY_MS ? "invite_nudge_1" : null;
  const n2 = at("invite_nudge_2");
  if (n2 === null) return t >= n1 + 7 * DAY_MS ? "invite_nudge_2" : null;
  return null;
}

export const NUDGE_DEFAULTS: Record<NudgeKey, ResolvedFields> = {
  invite_nudge_1: {
    subject: "Your invitation is waiting",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>It was good to talk with you. Your invitation to membership is open, and the next step is a short one: set up your member account, and the preparation begins.</p>",
    body_html: "<p>The link below is fresh and good for thirty days. If anything is in the way, reply here and we will sort it together.</p>",
    cta_label: "Set up my account",
    closing_html: "<p>With aloha,<br>Rachel<br>Vital Kauaʻi · Hanalei, Kauaʻi</p>",
  },
  invite_nudge_2: {
    subject: "Still here, whenever you are",
    eyebrow: "Vital Kauaʻi",
    heading: "Aloha {{firstName}},",
    lead_html:
      "<p>A gentle note: your invitation is still open. Some people move quickly; some sit with it for a while. Both are right.</p>",
    body_html: "<p>When you are ready, the link below takes you straight in. And if the timing has changed, tell us; the door stays open.</p>",
    cta_label: "Set up my account",
    closing_html: "<p>With aloha,<br>Rachel<br>Vital Kauaʻi · Hanalei, Kauaʻi</p>",
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function renderNudgeEmail(input: { key: NudgeKey; fullName: string | null; setupUrl: string }): Promise<{ subject: string; html: string }> {
  const firstName = esc((input.fullName ?? "").trim().split(/\s+/)[0] || "friend");
  const f = await resolveTemplate(`lead_${input.key}`, { firstName, setupUrl: input.setupUrl }, NUDGE_DEFAULTS[input.key]);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}.wrap{max-width:560px;margin:0 auto}.card{background:#1a2e1c;border-radius:6px;overflow:hidden}.top-bar{background:#c8a96e;height:4px}.inner{padding:44px 44px 40px}.eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}h1{color:#f5f0e8;font-size:26px;font-weight:400;line-height:1.3;margin:0 0 18px}p{color:rgba(245,240,232,.78);font-size:16px;line-height:1.75;margin:0 0 18px}.cta-wrap{margin:26px 0 10px;text-align:center}.cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:16px 34px;border-radius:3px}.footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.35);text-align:center;line-height:1.9;margin-top:28px}</style></head>
<body><div class="wrap"><div class="card"><div class="top-bar"></div><div class="inner">
<p class="eyebrow">${f.eyebrow}</p><h1>${f.heading}</h1>${f.lead_html}${f.body_html}
<div class="cta-wrap"><a class="cta" href="${esc(input.setupUrl)}">${f.cta_label}</a></div>${f.closing_html}
<div class="footer">Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714</div>
</div></div></div></body></html>`;
  return { subject: f.subject, html };
}
