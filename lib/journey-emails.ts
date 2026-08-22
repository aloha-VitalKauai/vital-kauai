/**
 * Server-side helpers for the automatic weekly journey emails.
 *
 * - JourneyEmailTemplate type matches the journey_email_templates row shape
 * - renderJourneyEmailHtml builds the branded email body
 * - sendJourneyEmail posts to Resend
 *
 * The cron at /api/cron/journey-emails and the dashboard editor at
 * /dashboard/automatic-emails both consume this file.
 */

export type JourneyArc = 'pre' | 'post'

export interface JourneyEmailTemplate {
  id?: string
  arc: JourneyArc
  week_idx: number          // 0..5
  principle_name: string
  principle: string
  theme: string
  subject: string
  intro: string
  action_items: string[]
  updated_at?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalkauai.com'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renders the email HTML. The structure is identical for every weekly send so
 * Rachel can preview a single layout and trust every member receives the same
 * shape: principle block, week intro, action items checklist, portal CTA.
 */
export function renderJourneyEmailHtml(
  tpl: JourneyEmailTemplate,
  recipientFirstName: string,
): string {
  const weekNumber = tpl.week_idx + 1
  const arcLabel = tpl.arc === 'pre' ? 'Preparation' : 'Integration'
  const eyebrow = `Week ${weekNumber} · ${arcLabel} · ${tpl.theme}`
  const greeting = recipientFirstName
    ? `Aloha, ${esc(recipientFirstName)}.`
    : 'Aloha.'

  const actionItemsHtml = tpl.action_items
    .map(
      (a) => `
      <tr>
        <td style="vertical-align:top;padding:10px 0;border-bottom:1px solid rgba(245,240,232,.08);">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:24px;vertical-align:top;color:#c8a96e;font-size:14px;line-height:1.6;">○</td>
              <td style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:rgba(245,240,232,.85);">${esc(a)}</td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tpl.subject)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px;}
  .wrap{max-width:600px;margin:0 auto;}
  .card{background:#1a2e1c;border-radius:6px;overflow:hidden;}
  .top-bar{background:#c8a96e;height:4px;}
  .inner{padding:48px 44px 44px;}
  .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px;}
  h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 22px;font-family:Georgia,serif;}
  .greeting{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px;}
  .principle-block{background:#f5f0e8;border-left:3px solid #c8a96e;border-radius:2px;padding:32px 30px;margin:28px 0;}
  .principle-name{font-family:Georgia,serif;font-size:42px;line-height:1;color:#1a2e1c;margin:0 0 14px;letter-spacing:-.01em;}
  .principle-quote{font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.5;color:#3a4a2c;margin:0 0 6px;}
  .principle-theme{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7a6e58;margin:14px 0 0;}
  .intro{color:rgba(245,240,232,.78);font-size:16px;line-height:1.75;margin:24px 0 8px;}
  .actions-label{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:32px 0 6px;}
  .actions-table{width:100%;border-collapse:collapse;margin-top:8px;}
  .cta-wrap{margin:36px 0 12px;text-align:center;}
  .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px;}
  .signoff{color:rgba(245,240,232,.55);font-family:Georgia,serif;font-style:italic;font-size:15px;line-height:1.7;margin:24px 0 0;}
  .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9;margin-top:24px;border-top:1px solid rgba(200,169,110,.12);padding-top:20px;}
  .footer a{color:rgba(200,169,110,.55);text-decoration:none;}
</style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${greeting}</h1>

      <div class="principle-block">
        <div class="principle-name">${esc(tpl.principle_name)}</div>
        <p class="principle-quote">&ldquo;${esc(tpl.principle)}&rdquo;</p>
        <p class="principle-theme">${esc(tpl.theme)}</p>
      </div>

      <p class="intro">${esc(tpl.intro)}</p>

      <p class="actions-label">This week, in the portal</p>
      <table class="actions-table" cellpadding="0" cellspacing="0" border="0">
        ${actionItemsHtml}
      </table>

      <div class="cta-wrap">
        <a class="cta" href="${esc(APP_URL)}/portal">Open the Member Portal &rarr;</a>
      </div>

      <p class="signoff">With aloha,<br>Rachel &amp; Josh</p>

      <div class="footer">
        Vital Kaua&#699;i Church &middot; PO Box 932, Hanalei, HI 96714<br>
        <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
      </div>
    </div>
  </div></div>
</body>
</html>`
}

/**
 * Posts to Resend. Returns the message id on success, throws on HTTP error.
 * No-ops (and returns null) if RESEND_API_KEY is missing — same behavior as
 * the existing resend-setup-link route.
 */
export async function sendJourneyEmail(args: {
  to: string
  subject: string
  html: string
}): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log('[journey-emails] RESEND_API_KEY not set — skipping send to', args.to)
    return null
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: 'Vital Kauaʻi <aloha@vitalkauai.com>',
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { id?: string }
  return data.id ?? null
}

/**
 * Given a ceremony start_at and a moment, returns which (arc, week_idx) the
 * member is *entering* on that day, or null if no week starts that day.
 *
 * Mirrors lib/weekCountdown.ts:
 *   pre  week N start  = ceremony - 42 + (N-1)*7 days
 *   post week N start  = ceremony +  7 + (N-1)*7 days
 *
 * The ceremony week (day 0 through day 6) is deliberately silent — members
 * are on-island — so integration Week 1 lands a week after the ceremony
 * rather than on the day of it.
 *
 * "Entering" means today === weekStart (UTC day comparison). The cron runs
 * once a day, so we only fire on the boundary day.
 */
export function weekToSendToday(
  ceremonyStartAt: string | null | undefined,
  now: Date = new Date(),
): { arc: JourneyArc; week_idx: number } | null {
  if (!ceremonyStartAt) return null
  const ceremony = new Date(ceremonyStartAt)
  if (Number.isNaN(ceremony.getTime())) return null

  const MS = 24 * 60 * 60 * 1000
  const dayKey = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const today = dayKey(now)

  for (let i = 0; i < 6; i++) {
    const preStart = ceremony.getTime() + (-42 + i * 7) * MS
    if (dayKey(new Date(preStart)) === today) return { arc: 'pre', week_idx: i }
    const postStart = ceremony.getTime() + (7 + i * 7) * MS
    if (dayKey(new Date(postStart)) === today) return { arc: 'post', week_idx: i }
  }
  return null
}

/**
 * Returns the *current* week a journey is in — the most recent boundary
 * that has already passed. Used by the catch-up endpoint to send the
 * single most relevant missed week, capped so a member who's been silent
 * for months doesn't suddenly get an ancient email.
 *
 * `maxLatenessDays` defaults to 14 (two cron failures recoverable).
 * Returns null if the most recent boundary is older than that cap.
 */
export function currentWeekForJourney(
  ceremonyStartAt: string | null | undefined,
  now: Date = new Date(),
  maxLatenessDays = 14,
): { arc: JourneyArc; week_idx: number; daysLate: number } | null {
  if (!ceremonyStartAt) return null
  const ceremony = new Date(ceremonyStartAt)
  if (Number.isNaN(ceremony.getTime())) return null

  const MS = 24 * 60 * 60 * 1000
  const dayKey = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const today = dayKey(now)

  let best: { arc: JourneyArc; week_idx: number; daysLate: number } | null = null
  for (let i = 0; i < 6; i++) {
    const preStart = dayKey(new Date(ceremony.getTime() + (-42 + i * 7) * MS))
    if (preStart <= today) {
      const daysLate = Math.round((today - preStart) / MS)
      if (!best || daysLate < best.daysLate) best = { arc: 'pre', week_idx: i, daysLate }
    }
    const postStart = dayKey(new Date(ceremony.getTime() + (7 + i * 7) * MS))
    if (postStart <= today) {
      const daysLate = Math.round((today - postStart) / MS)
      if (!best || daysLate < best.daysLate) best = { arc: 'post', week_idx: i, daysLate }
    }
  }
  if (!best) return null
  if (best.daysLate > maxLatenessDays) return null
  return best
}
