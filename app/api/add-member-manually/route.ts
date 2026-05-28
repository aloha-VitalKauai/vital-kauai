import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderSetupLinkEmail } from '@/lib/email-renderers'
import { createSetupToken, setupAccountUrl } from '@/lib/setup-tokens'

/**
 * POST /api/add-member-manually
 * Body: { full_name: string, email: string, phone?: string | null, send_email?: boolean }
 *
 * Founder-only. Creates a member account from scratch — no Calendly lead, no
 * approval token. Mirrors /api/approve-member's side effects (auth user,
 * members row, member_profiles row, member role, timeline event, draft
 * journey + commitment) and mints a 30-day setup token. By default, also
 * sends the branded "Welcome — set up your account" email; pass
 * { send_email: false } to skip sending so the founder can hand the link off
 * out-of-band.
 *
 * Returns: { ok, member_id, setup_link, email_sent }
 */
export async function POST(req: NextRequest) {
  try {
    const founder = await verifyFounder()
    if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : ''
    const email = rawEmail.toLowerCase()
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    const sendEmail = body.send_email !== false

    if (!fullName) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const supabase = db()

    const { data: existingMember } = await supabase
      .from('members')
      .select('id, full_name, email')
      .ilike('email', email)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        {
          error: `A member with that email already exists (${existingMember.full_name}). Use the "Resend setup link" button on their profile instead.`,
          existing_member_id: existingMember.id,
        },
        { status: 409 },
      )
    }

    let userId: string
    try {
      userId = await getOrCreateAuthUser(email, fullName)
    } catch (err: any) {
      console.error('[add-member-manually] auth user failed:', err?.message || err)
      return NextResponse.json({ error: 'Failed to create auth user.' }, { status: 500 })
    }

    const { error: memberErr } = await supabase.from('members').upsert(
      {
        id:        userId,
        full_name: fullName,
        email,
        phone,
        lead_id:   null,
        status:    'Signed, Awaiting Intake',
      },
      { onConflict: 'id' },
    )
    if (memberErr) {
      console.error('[add-member-manually] members insert failed:', JSON.stringify(memberErr))
      return NextResponse.json({ error: `Failed to create member: ${memberErr.message}` }, { status: 500 })
    }

    const { error: profileErr } = await supabase.from('member_profiles').upsert(
      {
        id:                          userId,
        email,
        full_name:                   fullName,
        phone,
        invited_at:                  new Date().toISOString(),
        membership_agreement_signed: false,
        medical_disclaimer_signed:   false,
        deposit_paid:                false,
        onboarding_complete:         false,
      },
      { onConflict: 'id' },
    )
    if (profileErr) {
      console.error('[add-member-manually] profile insert failed:', JSON.stringify(profileErr))
      return NextResponse.json({ error: `Failed to create member profile: ${profileErr.message}` }, { status: 500 })
    }

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (existingRole?.role !== 'founder') {
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: 'member' }, { onConflict: 'user_id' })
      if (roleErr) {
        console.error('[add-member-manually] role assign failed:', JSON.stringify(roleErr))
        return NextResponse.json({ error: `Failed to assign member role: ${roleErr.message}` }, { status: 500 })
      }
    }

    const { error: timelineErr } = await supabase.from('member_timelines').insert({
      member_id:    userId,
      event_type:   'account_manual_add',
      event_title:  'Membership manually added',
      event_detail: `Added by ${founder.email} — ${sendEmail ? 'setup link emailed' : 'setup link generated (not emailed)'}`,
      is_system:    true,
    })
    if (timelineErr) {
      console.error('[add-member-manually] timeline log failed (non-blocking):', JSON.stringify(timelineErr))
    }

    // Seed draft journey + financial commitment so the love-exchange page and
    // program_price sync work the same as for Calendly-approved members.
    // Non-blocking: a missing journey can be recreated from the member editor.
    try {
      const { data: journeyRow } = await supabase
        .from('journeys')
        .insert({
          member_id:     userId,
          booking_type:  'cohort',
          schedule_type: 'tbd',
          status:        'approved',
          approved_at:   new Date().toISOString(),
        })
        .select('id')
        .single()

      if (journeyRow?.id) {
        await supabase.from('financial_commitments').insert({
          member_id:             userId,
          journey_id:            journeyRow.id,
          kind:                  'journey_contribution',
          expected_amount_cents: 0,
          status:                'draft',
        })
      }
    } catch (err: any) {
      console.error('[add-member-manually] journey/commitment seed failed (non-blocking):', err?.message || err)
    }

    let setupLink: string
    try {
      const token = await createSetupToken({ userId, email, fullName })
      setupLink = setupAccountUrl(token, env().appUrl)
    } catch (err: any) {
      console.error('[add-member-manually] setup token mint failed:', err?.message || err)
      return NextResponse.json(
        { error: 'Member created but setup link generation failed. Use "Resend setup link" on their profile.', member_id: userId },
        { status: 500 },
      )
    }

    let emailSent = false
    if (sendEmail) {
      const { data: notifRow } = await supabase
        .from('notification_log')
        .insert({
          lead_id: null,
          notification_type: 'setup_link_manual_add',
          recipient: [email],
          status: 'queued',
          payload: { member_id: userId, fullName, email, trigger: 'manual_add' },
        })
        .select('id')
        .single()

      try {
        await sendSetupEmail(email, fullName, setupLink)
        emailSent = true
        if (notifRow) {
          await supabase
            .from('notification_log')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', notifRow.id)
        }
      } catch (emailErr: any) {
        console.error('[add-member-manually] email send failed:', emailErr?.message || emailErr)
        if (notifRow) {
          await supabase
            .from('notification_log')
            .update({ status: 'failed', failure_reason: emailErr.message })
            .eq('id', notifRow.id)
        }
        return NextResponse.json(
          {
            error: `Member created and setup link minted, but email failed: ${emailErr.message}. You can copy the link below and send it manually.`,
            member_id: userId,
            setup_link: setupLink,
            email_sent: false,
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      member_id: userId,
      setup_link: setupLink,
      email_sent: emailSent,
      message: sendEmail
        ? `${fullName} added and setup link emailed to ${email}.`
        : `${fullName} added. Copy the setup link below and send it to them.`,
    })
  } catch (err: any) {
    console.error('[add-member-manually] unhandled error:', err?.message, err?.stack)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

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

async function getOrCreateAuthUser(email: string, fullName: string): Promise<string> {
  const supabase = db()
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find(
    (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data?.user?.id) {
    throw new Error(`Could not provision auth user for ${email}: ${error?.message || 'no id'}`)
  }
  return data.user.id
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  if (!env().resendKey) {
    console.log('[add-member-manually] No RESEND_API_KEY — skipping email')
    return
  }
  const firstName = fullName.split(' ')[0] || 'Friend'
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
