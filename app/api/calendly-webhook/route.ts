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
  const supabase = getSupabase()
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle new bookings
  if (payload.event !== 'invitee.created') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const invitee   = payload.payload.invitee
  const eventDet  = payload.payload.event

  const email           = invitee.email
  const fullName        = invitee.name
  const eventName       = eventDet?.name || 'Discovery Call'
  const startTime       = eventDet?.start_time
  const calendlyEventId = eventDet?.uuid

  // Generate a secure approval token (used in approve/decline email buttons)
  const approvalToken = randomBytes(32).toString('hex')

  // Save lead to Supabase
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .upsert({
      full_name:             fullName,
      email,
      source:                'Calendly',
      discovery_call_booked: true,
      discovery_call_date:   startTime ? startTime.split('T')[0] : null,
      calendly_event_id:     calendlyEventId,
      calendly_booked_at:    new Date().toISOString(),
      approval_status:       'pending',
      approval_token:        approvalToken,
    }, { onConflict: 'email' })
    .select()
    .single()

  if (leadError) {
    console.error('Lead upsert failed:', leadError)
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  // Email founders — notification only, no approve/decline yet
  // They will use this email AFTER the discovery call to approve or decline
  await sendFounderNotification({ fullName, email, eventName, startTime, approvalToken })

  return NextResponse.json({ ok: true, leadId: lead.id })
}

async function sendFounderNotification({
  fullName, email, eventName, startTime, approvalToken
}: {
  fullName: string
  email: string
  eventName: string
  startTime: string
  approvalToken: string
}) {
  const firstName  = fullName?.split(' ')[0] || 'Someone'
  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://vital-kauai.vercel.app'
  const approveUrl = `${baseUrl}/api/approve-member?token=${approvalToken}`
  const declineUrl = `${baseUrl}/api/decline-member?token=${approvalToken}`
  const dashUrl    = `${baseUrl}/ops/pending`

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

  if (!process.env.RESEND_API_KEY) {
    console.log('No RESEND_API_KEY — skipping founder notification')
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    'Vital Kaua\u02BBi <aloha@vitalkauai.com>',
      to:      ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
      subject: `New discovery call: ${fullName} \u2014 ${callDate}`,
      html,
    }),
  })
}
