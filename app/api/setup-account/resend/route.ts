import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { renderSetupLinkEmail } from '@/lib/email-renderers'
import { createSetupToken, getLiveSetupToken, setupAccountUrl } from '@/lib/setup-tokens'

/**
 * POST /api/setup-account/resend
 * Body: { email: string }
 *
 * Member-facing self-service rescue for the /setup-account error screen: a
 * member holding a superseded/expired/invalid Welcome link enters their email
 * and gets a working setup link mailed to the address we have on file.
 *
 * Anti-enumeration: the response is the same generic 200 for every input,
 * and it is sent BEFORE any member lookup or email work happens (via
 * `after()`), so response body and timing are identical for hits and misses.
 *
 * Abuse limits: 3/hour per member email + a global hourly ceiling, counted
 * in notification_log. When a live link already exists it is RE-SENT rather
 * than re-minted, so repeated requests never invalidate the link a member is
 * holding, and strangers submitting a member's email can't churn their links.
 *
 * Members who already sign in are skipped silently — their path is
 * "Forgot password" on the sign-in page, and the link only ever goes to the
 * email on file, never back to the requester.
 */

const GENERIC_RESPONSE = {
  ok: true,
  message:
    'Check your inbox in a moment — if an account for that email still needs setup, a fresh link is on its way.',
}

const RESEND_LIMIT_PER_EMAIL_PER_HOUR = 3
const RESEND_LIMIT_GLOBAL_PER_HOUR = 30
const NOTIFICATION_TYPE = 'setup_link_self_resend'
// Re-send the existing live link while it has at least this long left;
// mint a replacement only when it's near expiry.
const REUSE_MIN_REMAINING_MS = 24 * 60 * 60 * 1000

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

/** Escape LIKE wildcards so user input matches literally under ilike. */
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : ''

  // '*' is rejected outright: PostgREST aliases it to the LIKE '%' wildcard
  // even when backslash-escaped, so it can never match literally.
  if (!rawEmail || rawEmail.includes('*') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const email = rawEmail.toLowerCase()

  // All lookup + send work happens after the response is on the wire.
  after(async () => {
    try {
      await processResend(email)
    } catch (err: any) {
      console.error('[setup-account/resend] unhandled error:', err?.message, err?.stack)
    }
  })

  return NextResponse.json(GENERIC_RESPONSE)
}

async function processResend(email: string) {
  const supabase = db()

  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, email, lead_id')
    .ilike('email', escapeLikePattern(email))
    .maybeSingle()

  if (!member?.email) {
    // Logging intentionally minimal so server logs don't reveal probed emails.
    console.log('[setup-account/resend] no member match for submitted email')
    return
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Insert the accounting row FIRST, then count rows including our own —
  // concurrent requests count each other, and a failed insert aborts the
  // send entirely (fail closed) so limiting can never be silently disabled.
  const { data: notifRow, error: notifErr } = await supabase
    .from('notification_log')
    .insert({
      lead_id: member.lead_id ?? null,
      notification_type: NOTIFICATION_TYPE,
      recipient: [member.email],
      status: 'queued',
      payload: {
        member_id: member.id,
        fullName:  member.full_name,
        email:     member.email,
        trigger:   'self_service_setup_resend',
      },
    })
    .select('id')
    .single()
  if (notifErr || !notifRow) {
    console.error('[setup-account/resend] accounting insert failed — aborting send:', notifErr?.message)
    return
  }

  const finish = async (status: string, failureReason?: string) => {
    await supabase
      .from('notification_log')
      .update(
        status === 'sent'
          ? { status, sent_at: new Date().toISOString() }
          : { status, failure_reason: failureReason ?? null },
      )
      .eq('id', notifRow.id)
  }

  const { count: globalCount } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('notification_type', NOTIFICATION_TYPE)
    .gte('created_at', oneHourAgo)
  if ((globalCount ?? 0) > RESEND_LIMIT_GLOBAL_PER_HOUR) {
    // Tripping the global ceiling smells like an attack wave, so log loudly.
    console.error('[setup-account/resend] GLOBAL hourly ceiling tripped — sends paused this hour')
    await finish('skipped', 'global hourly ceiling reached')
    return
  }

  const { count: emailCount } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('notification_type', NOTIFICATION_TYPE)
    .contains('recipient', [member.email])
    .gte('created_at', oneHourAgo)
  if ((emailCount ?? 0) > RESEND_LIMIT_PER_EMAIL_PER_HOUR) {
    console.log(`[setup-account/resend] throttled: ${RESEND_LIMIT_PER_EMAIL_PER_HOUR}/hour cap`)
    await finish('skipped', 'per-email hourly cap reached')
    return
  }

  // Resolve the auth user via members.id (=== auth.users.id by design) and
  // verify the email matches before touching anything. A missing or divergent
  // auth row is founder-reconciliation territory — provisioning here would
  // mint an auth account orphaned from the member data keyed to members.id.
  const { data: got } = await supabase.auth.admin.getUserById(member.id)
  const authUser = got?.user ?? null

  if (!authUser || authUser.email?.toLowerCase() !== member.email.toLowerCase()) {
    console.error(
      `[setup-account/resend] members.id ${member.id} has a missing or divergent auth user — founder reconciliation needed (use Resend setup link on their profile)`,
    )
    await finish('failed', 'members.id/auth.users missing or email mismatch — founder reconciliation needed')
    return
  }

  // Members who already sign in have a working password — their path is
  // "Forgot password". Setup links stay reserved for accounts awaiting setup.
  if (authUser.last_sign_in_at) {
    await finish('skipped', 'member already signs in — setup link unnecessary')
    return
  }

  // Prefer re-sending the live link; mint only when none is live (or it's
  // about to expire). Keeps every copy of the email in the inbox working.
  let token: string
  const live = await getLiveSetupToken(authUser.id)
  if (live && new Date(live.expiresAt).getTime() - Date.now() > REUSE_MIN_REMAINING_MS) {
    token = live.token
  } else {
    token = await createSetupToken({
      userId: authUser.id,
      email: member.email,
      fullName: member.full_name,
    })
  }

  try {
    await sendSetupEmail(member.email, member.full_name, setupAccountUrl(token, env().appUrl))
    await finish('sent')
  } catch (emailErr: any) {
    console.error('[setup-account/resend] email send failed:', emailErr.message)
    await finish('failed', emailErr.message)
  }
}

async function sendSetupEmail(email: string, fullName: string | null, setupLink: string) {
  if (!env().resendKey) {
    // Throw so the notification_log row records 'failed' — a log row
    // claiming 'sent' for an email that never left would mislead founders.
    throw new Error('RESEND_API_KEY missing — email skipped')
  }

  const firstName = fullName?.split(' ')[0] || 'Friend'
  // Same renderer + DB-backed template as /api/approve-member and
  // /api/resend-setup-link, so dashboard template edits update all three.
  const { subject, html } = await renderSetupLinkEmail({
    firstName,
    setupLink,
    appUrl: env().appUrl,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${env().resendKey}`,
    },
    body: JSON.stringify({
      from:    'Vital Kauaʻi <aloha@vitalkauai.com>',
      to:      email,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Resend ${res.status}: ${txt}`)
  }
}
