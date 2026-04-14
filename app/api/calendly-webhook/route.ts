import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // ALWAYS return 200 to Calendly — even on errors.
  // If we return 4xx/5xx, Calendly enters retry backoff and eventually
  // stops delivering webhooks entirely. We handle errors internally.
  try {
    let payload: any
    try {
      payload = await req.json()
    } catch {
      console.error('[calendly-webhook] Invalid JSON body')
      return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200 })
    }

    // Only handle new bookings
    if (payload.event !== 'invitee.created') {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const invitee = payload.payload?.invitee
    const eventDet = payload.payload?.event

    if (!invitee?.email) {
      console.error('[calendly-webhook] Missing invitee email in payload')
      return NextResponse.json({ ok: false, reason: 'missing_email' }, { status: 200 })
    }

    const email = invitee.email
    const fullName = invitee.name || 'Unknown'
    const eventName = eventDet?.name || 'Discovery Call'
    const startTime = eventDet?.start_time || null
    const calendlyEventId = eventDet?.uuid || null

    // Generate a secure approval token
    const approvalToken = randomBytes(32).toString('hex')

    // Save lead to Supabase
    const supabase = getSupabase()
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .upsert({
        full_name: fullName,
        email,
        source: 'Calendly',
        discovery_call_booked: true,
        discovery_call_date: startTime ? startTime.split('T')[0] : null,
        calendly_event_id: calendlyEventId,
        calendly_booked_at: new Date().toISOString(),
        approval_status: 'pending',
        approval_token: approvalToken,
      }, { onConflict: 'email' })
      .select()
      .single()

    if (leadError) {
      console.error('[calendly-webhook] Lead upsert failed:', JSON.stringify(leadError))
      // Still return 200 — don't let Calendly retry
      return NextResponse.json({ ok: false, reason: 'db_error', detail: leadError.message }, { status: 200 })
    }

    console.log(`[calendly-webhook] Lead saved: ${fullName} (${email}) — id: ${lead.id}`)

    // Send founder notification email — wrapped in try/catch so it never crashes the webhook
    try {
      await sendFounderNotification({ fullName, email, eventName, startTime, approvalToken })
      console.log(`[calendly-webhook] Founder notification sent for ${fullName}`)
    } catch (emailErr: any) {
      console.error('[calendly-webhook] Founder email failed:', emailErr.message)
      // Lead is saved — founders can still approve from /ops/pending dashboard
    }

    return NextResponse.json({ ok: true, leadId: lead.id })
  } catch (err: any) {
    // Catch-all — NEVER let an unhandled error return 500 to Calendly
    console.error('[calendly-webhook] Unhandled error:', err.message, err.stack)
    return NextResponse.json({ ok: false, reason: 'internal_error' }, { status: 200 })
  }
}

async function sendFounderNotification({
  fullName, email, eventName, startTime, approvalToken
}: {
  fullName: string
  email: string
  eventName: string
  startTime: string | null
  approvalToken: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[calendly-webhook] No RESEND_API_KEY — skipping founder notification')
    return
  }

  const firstName = fullName?.split(' ')[0] || 'Someone'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vital-kauai.vercel.app'
  const approveUrl = `${baseUrl}/api/approve-member?token=${approvalToken}`
  const declineUrl = `${baseUrl}/api/decline-member?token=${approvalToken}`
  const dashUrl = `${baseUrl}/ops/pending`

  const callDate = startTime
    ? new Date(startTime).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
    : 'Date TBD'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:-apple-system,sans-serif;background:#f5f5f5;margin:0;padding:32px 0}
    .card{max-width:540px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    .header{background:#1a2e1c;padding:24px 32px}
    .header-label{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c8a96e;margin:0 0 8px}
    .header h1{color:#f5f0e8;font-size:20px;font-weight:400;margin:0}
    .body{padding:28px 32px}
    .field{margin-bottom:16px}
    .label{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:4px}
    .value{font-size:16px;color:#1a1a1a}
    hr{border:none;border-top:1px solid #eee;margin:24px 0}
    .instructions{font-size:14px;color:#555;line-height:1.6;margin-bottom:24px;background:#f9f9f9;padding:16px;border-radius:6px;border-left:3px solid #c8a96e}
    .buttons{display:flex;gap:12px;margin-bottom:24px}
    .btn-yes{flex:1;background:#1a2e1c;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:6px;font-size:14px;font-weight:600;display:block}
    .btn-no{flex:1;background:#fff;color:#666;text-decoration:none;text-align:center;padding:14px 24px;border-radius:6px;font-size:14px;font-weight:500;display:block;border:1.5px solid #ddd}
    .dash-link{text-align:center;font-size:13px;color:#888}
    .dash-link a{color:#c8a96e;text-decoration:none}
    .footer{background:#f9f9f9;padding:16px 32px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p class="header-label">Vital Kaua\u02BBi \u00B7 New Booking</p>
      <h1>New discovery call booked</h1>
    </div>
    <div class="body">
      <div class="field"><div class="label">Name</div><div class="value">${fullName}</div></div>
      <div class="field"><div class="label">Email</div><div class="value">${email}</div></div>
      <div class="field"><div class="label">Call type</div><div class="value">${eventName}</div></div>
      <div class="field"><div class="label">Scheduled for</div><div class="value">${callDate}</div></div>
      <hr>
      <div class="instructions">
        <strong>After your discovery call with ${firstName}</strong>, come back to this email and click Approve or Decline below. Do not click until after the call.
      </div>
      <div class="buttons">
        <a href="${approveUrl}" class="btn-yes">\u2713 Approve \u2014 Send Portal Invite</a>
        <a href="${declineUrl}" class="btn-no">\u2715 Decline</a>
      </div>
      <div class="dash-link">Or manage all pending approvals from your <a href="${dashUrl}">ops dashboard \u2192</a></div>
    </div>
    <div class="footer">Vital Kaua\u02BBi Church \u00B7 aloha@vitalkauai.com</div>
  </div>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Vital Kaua\u02BBi <aloha@vitalkauai.com>',
      to: ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
      subject: `New discovery call: ${fullName} \u2014 ${callDate}`,
      html,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Resend ${res.status}: ${errorText}`)
  }
}
