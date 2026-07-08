import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderPasswordResetEmail } from '@/lib/email-renderers'

/**
 * POST /api/forgot-password
 * Body: { email: string }
 *
 * Member-facing self-service password reset. Looks up the email in the
 * `members` table — if it matches an approved member, generates a fresh
 * Supabase recovery link and sends our branded reset email.
 *
 * Always returns 200 with the same generic message regardless of whether
 * the email matched a member, so an attacker can't probe which addresses
 * have accounts.
 */

const GENERIC_RESPONSE = {
  ok: true,
  message:
    'If an approved member account exists for that email, a password reset link is on its way. Check your inbox in a moment.',
}

// Hard cap on password reset emails per address per hour. Keeps a known
// member's email from being weaponized as a way to spam their inbox.
const RESET_LIMIT_PER_HOUR = 3

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
function env() {
  return {
    appUrl:    process.env.NEXT_PUBLIC_APP_URL || 'https://vitalkauai.com',
    resendKey: process.env.RESEND_API_KEY!,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawEmail = typeof body?.email === 'string' ? body.email.trim() : ''

    // '*' is rejected outright: PostgREST aliases it to the LIKE '%' wildcard
    // even when backslash-escaped, so it can never match literally.
    if (!rawEmail || rawEmail.includes('*') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const email = rawEmail.toLowerCase()
    const supabase = db()

    // Escape LIKE wildcards so a submitted "b%@yahoo.com" matches literally
    // instead of pattern-matching across member emails.
    const emailPattern = email.replace(/[\\%_]/g, (m: string) => `\\${m}`)

    const { data: member } = await supabase
      .from('members')
      .select('id, full_name, email, lead_id')
      .ilike('email', emailPattern)
      .maybeSingle()

    if (!member || !member.email) {
      // Constant-time-ish: do nothing, but return the same response. Logging
      // intentionally minimal so server logs don't reveal probed emails.
      console.log('[forgot-password] no member match for submitted email')
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('notification_type', 'password_reset')
      .contains('recipient', [member.email])
      .gte('created_at', oneHourAgo)

    if ((recentCount ?? 0) >= RESET_LIMIT_PER_HOUR) {
      console.log(
        `[forgot-password] throttled: ${member.email} hit ${RESET_LIMIT_PER_HOUR}/hour cap`,
      )
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const resetLink = await generateRecoveryLink(member.email, member.full_name)
    if (!resetLink) {
      console.error('[forgot-password] failed to generate recovery link')
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const { data: notifRow } = await supabase
      .from('notification_log')
      .insert({
        lead_id: member.lead_id ?? null,
        notification_type: 'password_reset',
        recipient: [member.email],
        status: 'queued',
        payload: {
          member_id: member.id,
          fullName:  member.full_name,
          email:     member.email,
          trigger:   'self_service_forgot_password',
        },
      })
      .select('id')
      .single()

    try {
      await sendResetEmail(member.email, member.full_name, resetLink)

      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notifRow.id)
      }
    } catch (emailErr: any) {
      console.error('[forgot-password] email send failed:', emailErr.message)
      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'failed', failure_reason: emailErr.message })
          .eq('id', notifRow.id)
      }
      // Still return generic — surfacing send errors would also leak existence.
    }

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (err: any) {
    console.error('[forgot-password] unhandled error:', err.message, err.stack)
    return NextResponse.json(GENERIC_RESPONSE)
  }
}

async function generateRecoveryLink(
  email: string,
  fullName: string | null,
): Promise<string | null> {
  const supabase = db()
  const redirectTo = `${env().appUrl}/setup-account`

  // generateLink({ type: 'recovery' }) only succeeds when an auth.users row
  // exists for the email. Approved members always have one (created in
  // /api/approve-member), but seeded/manually-added rows in public.members
  // may not — provision idempotently to keep the flow robust.
  await ensureAuthUserExists(email, fullName)

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
  console.error('[forgot-password] generateLink failed:', error?.message || 'no action_link')
  return null
}

async function ensureAuthUserExists(email: string, fullName: string | null): Promise<void> {
  const supabase = db()
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) return

  const { error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  })
  if (error) {
    throw new Error(`Could not provision auth user for ${email}: ${error.message}`)
  }
}

async function sendResetEmail(email: string, fullName: string | null, resetLink: string) {
  if (!env().resendKey) {
    console.log('[forgot-password] No RESEND_API_KEY — skipping email')
    return
  }

  const firstName = fullName?.split(' ')[0] || 'Friend'
  const { subject, html } = renderPasswordResetEmail({
    firstName,
    resetLink,
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
