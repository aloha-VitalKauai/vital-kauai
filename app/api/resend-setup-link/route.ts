import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
function env() {
  return {
    appUrl:    process.env.NEXT_PUBLIC_APP_URL || 'https://vital-kauai.vercel.app',
    resendKey: process.env.RESEND_API_KEY!,
  }
}

/**
 * POST /api/resend-setup-link
 * Body: { member_id: string }
 *
 * Generates a fresh Supabase recovery link for an already-approved member
 * and re-sends the branded "Welcome — set up your account" email.
 *
 * Used when the original 24-hour setup link from /api/approve-member has
 * expired. Same email template as the initial approval flow.
 */
export async function POST(req: NextRequest) {
  try {
    const founder = await verifyFounder()
    if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { member_id } = await req.json()
    if (!member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    const supabase = db()

    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, full_name, email, lead_id')
      .eq('id', member_id)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (!member.email) {
      return NextResponse.json({ error: 'Member has no email on file' }, { status: 400 })
    }

    const setupLink = await generatePasswordSetupLink(member.email)
    if (!setupLink) {
      return NextResponse.json(
        { error: 'Failed to generate setup link from Supabase' },
        { status: 500 },
      )
    }

    const { data: notifRow } = await supabase
      .from('notification_log')
      .insert({
        lead_id: member.lead_id ?? null,
        notification_type: 'setup_link_resend',
        recipient: [member.email],
        status: 'queued',
        payload: {
          member_id: member.id,
          fullName:  member.full_name,
          email:     member.email,
          trigger:   'manual_resend',
        },
      })
      .select('id')
      .single()

    try {
      await sendSetupEmail(member.email, member.full_name, setupLink)

      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notifRow.id)
      }

      return NextResponse.json({
        ok: true,
        message: `Setup link resent to ${member.full_name} (${member.email})`,
      })
    } catch (emailErr: any) {
      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'failed', failure_reason: emailErr.message })
          .eq('id', notifRow.id)
      }
      return NextResponse.json(
        { error: `Email send failed: ${emailErr.message}` },
        { status: 500 },
      )
    }
  } catch (err: any) {
    console.error('[resend-setup-link] error:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function generatePasswordSetupLink(email: string): Promise<string | null> {
  const supabase = db()
  const redirectTo = `${env().appUrl}/setup-account`

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  let link = data?.properties?.action_link
  if (link) {
    const url = new URL(link)
    url.searchParams.set('redirect_to', redirectTo)
    link = url.toString()
    return link
  }
  console.error('[resend-setup-link] generateLink failed:', error?.message || 'no action_link')
  return null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  const firstName = esc(fullName?.split(' ')[0] || 'Friend')
  const appUrl = env().appUrl

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
    .login-box{background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.1);border-radius:6px;padding:18px 22px;margin:24px 0}
    .login-box p{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.5);margin:0 0 4px}
    .login-url{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#c8a96e}
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
      <p class="eyebrow">Vital Kaua\u02BBi \u00B7 Member Portal</p>
      <h1>Here\u2019s a fresh link, <em>${firstName}.</em></h1>
      <p>Your previous account-setup link expired. Click below to create your password \u2014 it takes about 30 seconds.</p>
      <div class="cta-wrap">
        <a class="cta" href="${setupLink}">Set Up My Account \u2192</a>
      </div>
      <hr>
      <p style="color:rgba(245,240,232,.6);font-family:'Helvetica Neue',sans-serif;font-size:14px;margin:0 0 16px">After setup, sign in any time at:</p>
      <div class="login-box">
        <p>Member portal login</p>
        <span class="login-url">${appUrl}/login</span>
      </div>
      <p class="note">This link expires in <strong style="color:rgba(245,240,232,.45)">24 hours</strong>. If it expires again, reply to this email and we\u2019ll send another.</p>
      <p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>
      <div class="footer">\u00A9 2026 Vital Kaua\u02BBi Church \u00B7 PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`

  if (!env().resendKey) {
    console.log('[resend-setup-link] No RESEND_API_KEY \u2014 skipping email')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${env().resendKey}`,
    },
    body: JSON.stringify({
      from:    'Vital Kaua\u02BBi <aloha@vitalkauai.com>',
      to:      email,
      subject: `Your Vital Kaua\u02BBi setup link, ${firstName} \u2014 fresh copy`,
      html,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Resend ${res.status}: ${txt}`)
  }
}
