import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderSetupLinkEmail } from '@/lib/email-renderers'
import { createSetupToken, setupAccountUrl } from '@/lib/setup-tokens'

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
 * Mints a fresh 30-day setup token (invalidating any prior unused tokens for
 * this member) and re-sends the branded "Welcome — set up your account"
 * email. Same template as the initial approval flow.
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

    let setupLink: string
    try {
      // Provision an auth user for seeded/manually-added members that never
      // ran through approve-member's auth-user step.
      const userId = await ensureAuthUser(member.email, member.full_name)
      const token = await createSetupToken({
        userId,
        email: member.email,
        fullName: member.full_name,
      })
      setupLink = setupAccountUrl(token, env().appUrl)
    } catch (err: any) {
      console.error('[resend-setup-link] token mint failed:', err?.message || err)
      return NextResponse.json(
        { error: 'Failed to generate setup link.' },
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

/**
 * Returns the auth.users id for `email`, creating the row if missing.
 * Members table uses the auth user id as its primary key (members.id ===
 * auth.users.id), so we prefer the existing members.id when present and
 * confirm an auth row exists; otherwise we create the auth row and trust
 * Supabase's id.
 */
async function ensureAuthUser(
  email: string,
  fullName: string | null,
): Promise<string> {
  const supabase = db()

  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) return existing.id

  console.log(`[resend-setup-link] no auth user for ${email}, creating`)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  })
  if (error || !data?.user?.id) {
    throw new Error(`Could not provision auth user for ${email}: ${error?.message || 'no id'}`)
  }
  return data.user.id
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  if (!env().resendKey) {
    console.log('[resend-setup-link] No RESEND_API_KEY — skipping email')
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
