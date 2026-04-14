import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac } from 'crypto'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---------------------------------------------------------------------------
// EXTRACT — pull invitee data from any known Calendly payload shape
// ---------------------------------------------------------------------------
function extractInviteeData(body: any): {
  email: string | null
  fullName: string
  eventName: string
  startTime: string | null
  calendlyEventId: string | null
  inviteeUri: string | null
} {
  const p = body?.payload || {}

  // Email — try every known location
  const email: string | null =
    p.invitee?.email || p.email || body.email || null

  // Name
  const fullName: string =
    p.invitee?.name || p.name || body.name || 'Unknown'

  // Event details — V1: object, V2: URL string
  let eventName = 'Discovery Call'
  let startTime: string | null = null
  let calendlyEventId: string | null = null

  if (typeof p.event === 'object' && p.event !== null) {
    eventName = p.event.name || eventName
    startTime = p.event.start_time || null
    calendlyEventId = p.event.uuid || null
  }
  if (typeof p.event === 'string') {
    calendlyEventId = p.event.split('/').pop() || null
  }
  if (p.scheduled_event) {
    if (!startTime) startTime = p.scheduled_event.start_time || null
    if (eventName === 'Discovery Call') eventName = p.scheduled_event.name || eventName
    if (!calendlyEventId && p.scheduled_event.uri) {
      calendlyEventId = p.scheduled_event.uri.split('/').pop() || null
    }
  }

  const inviteeUri: string | null = p.uri || p.invitee?.uri || null

  return { email, fullName, eventName, startTime, calendlyEventId, inviteeUri }
}

// ---------------------------------------------------------------------------
// SIGNATURE — optional Calendly webhook signature verification
// ---------------------------------------------------------------------------
function verifySignature(req: NextRequest, rawBody: string): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (!signingKey) {
    console.warn('[webhook] STEP:signature — no CALENDLY_WEBHOOK_SIGNING_KEY configured, skipping verification')
    return true // TODO: set CALENDLY_WEBHOOK_SIGNING_KEY in production to enforce
  }

  const signature = req.headers.get('calendly-webhook-signature')
  if (!signature) {
    console.warn('[webhook] STEP:signature — no header but signing key is set')
    return false
  }

  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [k, v] = part.split('=')
      return [k, v]
    })
  )
  if (!parts.t || !parts.v1) return false

  const expected = createHmac('sha256', signingKey)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex')

  return expected === parts.v1
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // ALWAYS return 200 to Calendly — even on errors.
  const supabase = getSupabase()
  let rawBody = ''
  let body: any = null

  // === STEP 1: Read raw body ===
  console.log('[webhook] STEP:receive — incoming POST /api/calendly-webhook')
  try {
    rawBody = await req.text()
  } catch {
    console.error('[webhook] STEP:receive — FAILED to read body')
    return NextResponse.json({ ok: false, reason: 'body_read_error' }, { status: 200 })
  }

  // === STEP 2: Parse JSON ===
  try {
    body = JSON.parse(rawBody)
    console.log('[webhook] STEP:parse — OK, event:', body.event)
  } catch {
    console.error('[webhook] STEP:parse — FAILED, invalid JSON')
    await saveReceipt(supabase, {
      event_type: 'parse_error',
      raw_body: { raw: rawBody.slice(0, 5000) },
      raw_headers: extractHeaders(req),
      processing_status: 'failed',
      processing_error: 'Invalid JSON body',
    })
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200 })
  }

  const eventType = body.event || 'unknown'

  // === STEP 3: Save raw receipt BEFORE any processing ===
  const receiptId = await saveReceipt(supabase, {
    event_type: eventType,
    raw_body: body,
    raw_headers: extractHeaders(req),
    processing_status: 'received',
  })
  console.log(`[webhook] STEP:receipt — saved id: ${receiptId}`)

  // === STEP 4: Signature verification ===
  if (!verifySignature(req, rawBody)) {
    console.error('[webhook] STEP:signature — FAILED verification')
    await updateReceipt(supabase, receiptId, 'failed', 'Signature verification failed')
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 200 })
  }
  console.log('[webhook] STEP:signature — OK')

  // === STEP 5: Filter event type ===
  if (eventType !== 'invitee.created') {
    console.log(`[webhook] STEP:filter — ignored event type: ${eventType}`)
    await updateReceipt(supabase, receiptId, 'ignored', `Event type: ${eventType}`)
    return NextResponse.json({ ok: true, ignored: true })
  }

  // === STEP 6: Extract invitee data ===
  const { email, fullName, eventName, startTime, calendlyEventId, inviteeUri } =
    extractInviteeData(body)
  console.log(`[webhook] STEP:extract — email=${email}, name=${fullName}, eventId=${calendlyEventId}, inviteeUri=${inviteeUri}`)

  if (!email) {
    const keys = JSON.stringify(Object.keys(body.payload || {}))
    console.error(`[webhook] STEP:extract — FAILED, no email. Payload keys: ${keys}`)
    await updateReceipt(supabase, receiptId, 'failed', `Missing email. Keys: ${keys}`)
    return NextResponse.json({ ok: false, reason: 'missing_email' }, { status: 200 })
  }

  // === STEP 7: Idempotency — use DB UNIQUE constraint to block race conditions ===
  // Calendly sends duplicate webhooks within milliseconds. The application-level
  // check can't catch them because both arrive before either is marked processed.
  // Instead, try to claim the idempotency_key via INSERT — if it conflicts, it's a dupe.
  if (inviteeUri) {
    const { error: claimErr } = await supabase
      .from('webhook_receipts')
      .update({ idempotency_key: inviteeUri })
      .eq('id', receiptId)

    if (claimErr && claimErr.code === '23505') {
      // UNIQUE violation — another webhook already claimed this inviteeUri
      console.log(`[webhook] STEP:idempotency — duplicate (DB constraint), skipping: ${inviteeUri}`)
      await updateReceipt(supabase, receiptId, 'ignored', `Duplicate: ${inviteeUri}`)
      return NextResponse.json({ ok: true, deduplicated: true })
    }

    // Double-check: did another receipt already process this?
    const { data: existing } = await supabase
      .from('webhook_receipts')
      .select('id')
      .eq('idempotency_key', inviteeUri)
      .neq('id', receiptId)
      .limit(1)
      .single()

    if (existing) {
      console.log(`[webhook] STEP:idempotency — duplicate (existing receipt), skipping: ${inviteeUri}`)
      await updateReceipt(supabase, receiptId, 'ignored', `Duplicate: ${inviteeUri}`)
      return NextResponse.json({ ok: true, deduplicated: true })
    }
  }
  console.log('[webhook] STEP:idempotency — OK, not a duplicate')

  // === STEP 8: Smart upsert — preserve approval_token if lead already exists ===
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id, approval_status, approval_token')
    .eq('email', email)
    .single()

  // Only generate a new token if there isn't one already
  const approvalToken = existingLead?.approval_token || randomBytes(32).toString('hex')

  let lead: any
  let leadError: any

  if (existingLead && existingLead.approval_status !== 'pending') {
    // Already approved/declined — update booking info only, preserve decision
    console.log(`[webhook] STEP:upsert — existing lead (${existingLead.approval_status}), updating booking fields only`)
    const { data, error } = await supabase
      .from('leads')
      .update({
        discovery_call_booked: true,
        discovery_call_date: startTime ? startTime.split('T')[0] : null,
        calendly_event_id: calendlyEventId,
        calendly_booked_at: new Date().toISOString(),
        // DO NOT touch: approval_status, approval_token, converted_to_member, member_id
      })
      .eq('email', email)
      .select()
      .single()
    lead = data
    leadError = error
  } else if (existingLead) {
    // Existing pending lead — update booking info, keep existing token
    console.log(`[webhook] STEP:upsert — existing pending lead, preserving token`)
    const { data, error } = await supabase
      .from('leads')
      .update({
        full_name: fullName,
        source: 'Calendly',
        discovery_call_booked: true,
        discovery_call_date: startTime ? startTime.split('T')[0] : null,
        calendly_event_id: calendlyEventId,
        calendly_booked_at: new Date().toISOString(),
        // Keep existing approval_token — do NOT overwrite
      })
      .eq('email', email)
      .select()
      .single()
    lead = data
    leadError = error
  } else {
    // Brand new lead
    console.log(`[webhook] STEP:upsert — new lead`)
    const { data, error } = await supabase
      .from('leads')
      .insert({
        full_name: fullName,
        email,
        source: 'Calendly',
        discovery_call_booked: true,
        discovery_call_date: startTime ? startTime.split('T')[0] : null,
        calendly_event_id: calendlyEventId,
        calendly_booked_at: new Date().toISOString(),
        approval_status: 'pending',
        approval_token: approvalToken,
      })
      .select()
      .single()
    lead = data
    leadError = error
  }

  if (leadError) {
    console.error(`[webhook] STEP:upsert — FAILED: ${JSON.stringify(leadError)}`)
    await updateReceipt(supabase, receiptId, 'failed', `Lead upsert: ${leadError.message}`)
    return NextResponse.json({ ok: false, reason: 'db_error' }, { status: 200 })
  }

  console.log(`[webhook] STEP:upsert — OK, lead id: ${lead.id}, status: ${lead.approval_status}`)

  // Link receipt to lead + mark processed
  await supabase
    .from('webhook_receipts')
    .update({
      processing_status: 'processed',
      lead_id: lead.id,
    })
    .eq('id', receiptId)

  // === STEP 9: Queue + send founder notification ===
  // Use the lead's current approval_token (may be existing if already decided)
  const tokenForEmail = lead.approval_token || approvalToken

  const notificationId = await logNotification(supabase, {
    lead_id: lead.id,
    notification_type: 'founder_approval',
    recipient: ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
    status: 'queued',
    payload: { fullName, email, eventName, startTime },
  })

  try {
    await sendFounderNotification({ fullName, email, eventName, startTime, approvalToken: tokenForEmail })
    console.log(`[webhook] STEP:notify — SENT founder email for ${fullName}`)
    await updateNotification(supabase, notificationId, 'sent')
  } catch (emailErr: any) {
    console.error(`[webhook] STEP:notify — FAILED: ${emailErr.message}`)
    await updateNotification(supabase, notificationId, 'failed', emailErr.message)
    // Lead is saved — founders can still approve from /ops/pending
  }

  console.log(`[webhook] DONE — lead: ${lead.id}, receipt: ${receiptId}`)
  return NextResponse.json({ ok: true, leadId: lead.id })
}

// ---------------------------------------------------------------------------
// RECEIPT HELPERS
// ---------------------------------------------------------------------------
async function saveReceipt(
  supabase: ReturnType<typeof getSupabase>,
  data: {
    event_type: string
    raw_body: any
    raw_headers: any
    processing_status: string
    processing_error?: string
  }
): Promise<string | null> {
  try {
    const { data: receipt, error } = await supabase
      .from('webhook_receipts')
      .insert({ source: 'calendly', ...data })
      .select('id')
      .single()
    if (error) {
      console.error('[webhook] receipt save failed:', error.message)
      return null
    }
    return receipt.id
  } catch (e: any) {
    console.error('[webhook] receipt save exception:', e.message)
    return null
  }
}

async function updateReceipt(
  supabase: ReturnType<typeof getSupabase>,
  receiptId: string | null,
  status: string,
  error?: string
) {
  if (!receiptId) return
  try {
    await supabase
      .from('webhook_receipts')
      .update({ processing_status: status, processing_error: error })
      .eq('id', receiptId)
  } catch {}
}

function extractHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  const keep = [
    'content-type', 'user-agent', 'calendly-webhook-signature',
    'x-forwarded-for', 'x-real-ip',
  ]
  for (const key of keep) {
    const val = req.headers.get(key)
    if (val) headers[key] = val
  }
  return headers
}

// ---------------------------------------------------------------------------
// NOTIFICATION HELPERS
// ---------------------------------------------------------------------------
async function logNotification(
  supabase: ReturnType<typeof getSupabase>,
  data: {
    lead_id: string
    notification_type: string
    recipient: string[]
    status: string
    payload: any
  }
): Promise<string | null> {
  try {
    const { data: row, error } = await supabase
      .from('notification_log')
      .insert(data)
      .select('id')
      .single()
    if (error) {
      console.error('[webhook] notification log insert failed:', error.message)
      return null
    }
    return row.id
  } catch (e: any) {
    console.error('[webhook] notification log exception:', e.message)
    return null
  }
}

async function updateNotification(
  supabase: ReturnType<typeof getSupabase>,
  id: string | null,
  status: string,
  failureReason?: string
) {
  if (!id) return
  try {
    await supabase
      .from('notification_log')
      .update({
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : undefined,
        failure_reason: failureReason,
      })
      .eq('id', id)
  } catch {}
}

// ---------------------------------------------------------------------------
// FOUNDER NOTIFICATION EMAIL
// ---------------------------------------------------------------------------
export async function sendFounderNotification({
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
    throw new Error('No RESEND_API_KEY configured')
  }

  const firstName = esc(fullName?.split(' ')[0] || 'Someone')
  const safeName = esc(fullName)
  const safeEmail = esc(email)
  const safeEventName = esc(eventName)
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
      <div class="field"><div class="label">Name</div><div class="value">${safeName}</div></div>
      <div class="field"><div class="label">Email</div><div class="value">${safeEmail}</div></div>
      <div class="field"><div class="label">Call type</div><div class="value">${safeEventName}</div></div>
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
      subject: `New discovery call: ${safeName} \u2014 ${callDate}`,
      html,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Resend ${res.status}: ${errorText}`)
  }
}
