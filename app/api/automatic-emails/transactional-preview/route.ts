import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { interpolate, type TransactionalEmailTemplate } from '@/lib/transactional-emails'

export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalkauai.com'

/**
 * Renders the founder's draft template (whatever they currently have on
 * screen, even unsaved) into the branded forest/cream scaffold so they
 * see exactly what their copy looks like.
 *
 * For founder-facing alerts (display-only, no body), shows just the
 * subject in a minimal layout — those have no editable body to render.
 */
export async function POST(req: NextRequest) {
  const founder = await verifyFounder()
  if (!founder) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { template } = (await req.json()) as { template: TransactionalEmailTemplate }
  if (!template?.key) {
    return NextResponse.json({ error: 'template required' }, { status: 400 })
  }

  const vars = sampleVarsFor(template.key)
  const subject = interpolate(template.subject ?? '', vars)
  const html = template.editable
    ? renderDraftPreview(template, vars)
    : renderFounderAlertPreview(subject)

  return NextResponse.json({ html, subject })
}

/**
 * Sample variable values — close to what the route would interpolate at
 * real send time, so the preview reflects production output.
 */
function sampleVarsFor(_key: string): Record<string, string> {
  return {
    firstName: 'Friend',
    appUrl: APP_URL,
    setupLink: `${APP_URL}/setup-account?token=preview`,
    guideUrl: `${APP_URL}/iboga-guide`,
    pdfUrl: `${APP_URL}/iboga-guide-free.pdf`,
    discoveryUrl: `${APP_URL}/begin-your-journey`,
    payUrl: `${APP_URL}/portal/journey/payment?token=preview`,
    amount: '$15,000.00',
    name: 'Sample Lead',
    email: 'sample@example.com',
    callDate: 'Tue, May 12, 2026 · 10:00 AM HST',
    leadDashboardUrl: `${APP_URL}/dashboard/leads`,
    memberName: 'Sample Member',
    reason: 'Refunded per member request',
    failureCount: '2',
    failures: '— check_member_status\n— check_payment_consistency',
  }
}

function renderDraftPreview(t: TransactionalEmailTemplate, vars: Record<string, string>): string {
  const eyebrow = interpolate(t.eyebrow ?? '', vars)
  const heading = interpolate(t.heading ?? '', vars)
  const lead = interpolate(t.lead_html ?? '', vars)
  const body = interpolate(t.body_html ?? '', vars)
  const cta = interpolate(t.cta_label ?? '', vars)
  const closing = interpolate(t.closing_html ?? '', vars)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px;}
  .wrap{max-width:560px;margin:0 auto;}
  .card{background:#1a2e1c;border-radius:6px;overflow:hidden;}
  .top-bar{background:#c8a96e;height:4px;}
  .inner{padding:48px 44px 44px;}
  .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px;}
  h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 22px;font-family:Georgia,serif;}
  h1 em{font-style:italic;color:rgba(245,240,232,.7);}
  p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px;}
  .links{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.55);line-height:1.8;}
  .links a{color:#c8a96e;text-decoration:none;}
  .cta-wrap{margin:36px 0 12px;text-align:center;}
  .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px;}
  .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px;}
  .note a{color:#c8a96e;text-decoration:none;}
  hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0;}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <div class="top-bar"></div>
  <div class="inner">
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    ${heading ? `<h1>${heading}</h1>` : ''}
    ${lead}
    ${body}
    ${cta ? `<div class="cta-wrap"><a class="cta" href="#">${cta}</a></div>` : ''}
    <hr>
    ${closing}
  </div>
</div></div>
</body>
</html>`
}

function renderFounderAlertPreview(subject: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f5f0e8;padding:32px;margin:0">
<div style="background:#1a2e1c;color:#f5f0e8;padding:32px;border-radius:6px;max-width:560px;margin:0 auto">
<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 16px;font-family:'Helvetica Neue',sans-serif">Internal alert · founder-facing</p>
<h1 style="margin:0 0 12px;font-size:22px;font-weight:400">${subject}</h1>
<p style="color:rgba(245,240,232,.6);margin:0;font-size:14px">This email is sent to founders only — no member-facing copy.</p>
</div></body></html>`
}
