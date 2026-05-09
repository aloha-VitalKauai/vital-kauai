/**
 * Renderers for the three member-facing transactional emails. Each one:
 *   1. Reads its template from the DB (resolveTemplate).
 *   2. Falls back to a hardcoded default per-field if the row is missing.
 *   3. Injects the resulting strings into a hardcoded HTML scaffold.
 *
 * The scaffold (layout, buttons, structural elements) stays in code — only
 * the words are editable. Production never breaks because of a missing or
 * partial template.
 */

import { resolveTemplate } from '@/lib/transactional-emails'

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── setup_link ──────────────────────────────────────────────

export async function renderSetupLinkEmail(args: {
  firstName: string
  setupLink: string
  appUrl: string
}): Promise<{ subject: string; html: string }> {
  const { firstName, setupLink, appUrl } = args
  const safeFirst = esc(firstName)

  const fields = await resolveTemplate(
    'setup_link',
    { firstName: safeFirst, setupLink, appUrl },
    {
      subject: `Welcome to Vital Kauaʻi, ${safeFirst} — set up your account`,
      eyebrow: 'Vital Kauaʻi · Member Portal',
      heading: `Welcome, <em>${safeFirst}.</em>`,
      lead_html: `<p>We're honored to welcome you to Vital Kauaʻi. Your private member portal is ready — it holds everything you need to prepare for your journey.</p><p>Click below to create your account. This takes about 30 seconds.</p>`,
      body_html: '',
      cta_label: 'Set Up My Account →',
      closing_html: `<p class="note">The setup button expires in <strong style="color:rgba(245,240,232,.45)">24 hours</strong>. If it expires, go to the login page and use "Forgot password" to get a new link.</p><p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>`,
    },
  )

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:48px 44px 44px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px}
    .cta-wrap{margin:36px 0 28px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px}
    .steps{margin:28px 0;padding:22px 26px;background:rgba(245,240,232,.05);border-radius:6px;border-left:2px solid #c8a96e}
    .step{display:flex;gap:14px;margin-bottom:14px;align-items:flex-start}
    .step:last-child{margin-bottom:0}
    .step-num{font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;color:#c8a96e;background:rgba(200,169,110,.15);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .step-text{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:rgba(245,240,232,.65);line-height:1.5}
    .step-text strong{color:#f5f0e8}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
    .login-box{background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.1);border-radius:6px;padding:18px 22px;margin-bottom:24px}
    .login-box p{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.5);margin:0 0 4px}
    .login-url{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#c8a96e}
    .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px}
    .note a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">${fields.eyebrow}</p>
      <h1>${fields.heading}</h1>
      ${fields.lead_html}
      <div class="cta-wrap">
        <a class="cta" href="${esc(setupLink)}">${fields.cta_label}</a>
      </div>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div class="step-text">Click the button above — it takes you to your account setup page.</div></div>
        <div class="step"><div class="step-num">2</div><div class="step-text"><strong>Create a password</strong> you'll use every time you sign in.</div></div>
        <div class="step"><div class="step-num">3</div><div class="step-text">You'll land directly in your member portal dashboard.</div></div>
        <div class="step"><div class="step-num">4</div><div class="step-text">Complete your <strong>required documents</strong> as your first step inside.</div></div>
      </div>
      <hr>
      <p style="color:rgba(245,240,232,.6);font-family:'Helvetica Neue',sans-serif;font-size:14px;margin:0 0 16px">After setup, sign in any time at:</p>
      <div class="login-box">
        <p>Member portal login</p>
        <span class="login-url">${esc(appUrl)}/login</span>
      </div>
      ${fields.closing_html}
      <hr>
      <div class="footer">© 2026 Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`

  return { subject: fields.subject, html }
}

// ─── password_reset ────────────────────────────────────────────
//
// Self-service "Forgot password" flow. Visually mirrors setup_link but
// uses copy that fits a returning member, not a brand-new account.
// Not DB-editable today; if Rachel wants to tweak the words, promote
// to a transactional_email_templates row.

export function renderPasswordResetEmail(args: {
  firstName: string
  resetLink: string
  appUrl: string
}): { subject: string; html: string } {
  const { firstName, resetLink, appUrl } = args
  const safeFirst = esc(firstName)

  const subject = `Reset your Vital Kauaʻi password`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:48px 44px 44px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px}
    .cta-wrap{margin:36px 0 28px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
    .login-box{background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.1);border-radius:6px;padding:18px 22px;margin-bottom:24px}
    .login-box p{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.5);margin:0 0 4px}
    .login-url{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#c8a96e}
    .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px}
    .note a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">Vital Kauaʻi · Member Portal</p>
      <h1>Reset your password, <em>${safeFirst}.</em></h1>
      <p>We received a request to reset the password on your Vital Kauaʻi member portal account. Click below to choose a new one — this takes about 30 seconds.</p>
      <div class="cta-wrap">
        <a class="cta" href="${esc(resetLink)}">Reset Password →</a>
      </div>
      <hr>
      <p style="color:rgba(245,240,232,.6);font-family:'Helvetica Neue',sans-serif;font-size:14px;margin:0 0 16px">After resetting, sign in any time at:</p>
      <div class="login-box">
        <p>Member portal login</p>
        <span class="login-url">${esc(appUrl)}/login</span>
      </div>
      <p class="note">This link expires in <strong style="color:rgba(245,240,232,.45)">24 hours</strong>. If you didn't request this reset, you can safely ignore this email — your password will stay the same.</p>
      <p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>
      <hr>
      <div class="footer">© 2026 Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`

  return { subject, html }
}

// ─── payment_link ──────────────────────────────────────────────

export async function renderPaymentLinkEmail(args: {
  firstName: string
  amount: string
  payUrl: string
}): Promise<{ subject: string; html: string }> {
  const { firstName, amount, payUrl } = args
  const safeFirst = esc(firstName)
  const escUrl = esc(payUrl)

  const fields = await resolveTemplate(
    'payment_link',
    { firstName: safeFirst, amount, payUrl },
    {
      subject: `Your Vital Kauaʻi journey contribution — ${amount}`,
      eyebrow: 'Vital Kauaʻi · Journey Contribution',
      heading: `Thank you for your contribution, <em>${safeFirst}.</em>`,
      lead_html: `<p>Here's a single-use payment link for your journey contribution. It opens a secure Stripe checkout pre-filled with your amount.</p>`,
      body_html: '',
      cta_label: 'Complete Contribution →',
      closing_html: `<p class="note">This link is single-use and expires in <strong style="color:rgba(245,240,232,.45)">7 days</strong>. If anything looks off, reply to this email and we'll sort it out together.</p><p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>`,
    },
  )

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:48px 44px 44px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px}
    .amount-box{background:rgba(200,169,110,.08);border:1px solid rgba(200,169,110,.25);border-radius:6px;padding:22px 26px;margin:28px 0;text-align:center}
    .amount-label{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.85);margin:0 0 8px}
    .amount-value{font-family:Georgia,serif;font-size:36px;color:#f5f0e8;font-weight:400}
    .cta-wrap{margin:32px 0 24px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px}
    .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px}
    .note a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9;margin-top:18px}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">${fields.eyebrow}</p>
      <h1>${fields.heading}</h1>
      ${fields.lead_html}
      <div class="amount-box">
        <p class="amount-label">Amount</p>
        <span class="amount-value">${esc(amount)}</span>
      </div>
      <div class="cta-wrap">
        <a class="cta" href="${escUrl}">${fields.cta_label}</a>
      </div>
      <hr>
      ${fields.closing_html}
      <div class="footer">© 2026 Vital Kauaʻi Church · PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`

  return { subject: fields.subject, html }
}
