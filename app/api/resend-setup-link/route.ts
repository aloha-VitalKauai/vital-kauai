import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderSetupLinkEmail } from '@/lib/email-renderers'

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

    const setupLink = await generatePasswordSetupLink(member.email, member.full_name)
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

async function generatePasswordSetupLink(email: string, fullName: string | null): Promise<string | null> {
  const supabase = db()
  const redirectTo = `${env().appUrl}/setup-account`

  // Ensure an auth user exists for this email — generateLink({ type: 'recovery' })
  // only works when the user already exists, otherwise it returns no action_link.
  // Members seeded directly into public.members (admin seeds, manual additions)
  // never went through approve-member's auth-user creation, so we provision
  // them here on first resend. Idempotent: skips if already present.
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
  console.error('[resend-setup-link] generateLink failed:', error?.message || 'no action_link')
  return null
}

/**
 * Looks up the auth.users row for `email`; creates one if it doesn't exist.
 * Mirrors approve-member's getOrCreateAuthUser flow. We use email_confirm:true
 * so the recovery link works immediately without a separate confirmation step.
 */
async function ensureAuthUserExists(email: string, fullName: string | null): Promise<void> {
  const supabase = db()

  // The Admin SDK's listUsers paginates; for our small user count, page 1 is
  // sufficient. If we ever exceed ~50 users, swap to listUsers({ page, perPage }).
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) return

  console.log(`[resend-setup-link] no auth user for ${email}, creating`)
  const { error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
    // No password — they set it on /setup-account via the recovery link.
  })
  if (error) {
    console.error('[resend-setup-link] createUser failed:', error.message)
    throw new Error(`Could not provision auth user for ${email}: ${error.message}`)
  }
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  if (!env().resendKey) {
    console.log('[resend-setup-link] No RESEND_API_KEY \u2014 skipping email')
    return
  }

  const firstName = fullName?.split(' ')[0] || 'Friend'
  // Same renderer + DB-backed template as /api/approve-member, so editing the
  // setup_link template in the dashboard updates both flows.
  const { subject, html } = await renderSetupLinkEmail({
    firstName,
    setupLink,
    appUrl: env().appUrl,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${env().resendKey}`,
    },
    body: JSON.stringify({
      from:    'Vital Kaua\u02BBi <aloha@vitalkauai.com>',
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
