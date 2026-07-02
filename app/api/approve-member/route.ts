import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderAppInstallEmail, renderSetupLinkEmail } from '@/lib/email-renderers'
import { createSetupToken, setupAccountUrl } from '@/lib/setup-tokens'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function env() {
  return {
    supabaseUrl:  process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey:   process.env.SUPABASE_SERVICE_ROLE_KEY!,
    appUrl:       process.env.NEXT_PUBLIC_APP_URL || 'https://vital-kauai.vercel.app',
    resendKey:    process.env.RESEND_API_KEY!,
  }
}

// GET  /api/approve-member?token=xxx  <- clicked from founder email button
// POST /api/approve-member            <- called from ops dashboard
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return htmlResponse(errorPage('Missing approval token.'), 400)
    return await handleApproval(token, 'email_button')
  } catch (err: any) {
    console.error('[approve-member] Unhandled GET error:', err.message, err.stack)
    return htmlResponse(errorPage('An unexpected error occurred. Please try again or use the ops dashboard.'), 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const founder = await verifyFounder()
    if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { token, decidedBy } = await req.json()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    return await handleApproval(token, decidedBy || 'dashboard')
  } catch (err: any) {
    console.error('[approve-member] Unhandled POST error:', err.message, err.stack)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleApproval(token: string, source: string) {
  const { data: lead, error } = await db()
    .from('leads')
    .select('*')
    .eq('approval_token', token)
    .single()

  if (error || !lead) return respond(source, false, 'This approval link is invalid or has expired.')
  if (lead.approval_status === 'approved') return respond(source, true, null, lead.full_name, true)
  if (lead.approval_status === 'declined') return respond(source, false, `${lead.full_name} was previously declined. Update from the ops dashboard if needed.`)

  // Token expiration, 7 days from when the lead was created
  const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
  const createdAt = new Date(lead.created_at || lead.calendly_booked_at || 0).getTime()
  if (Date.now() - createdAt > TOKEN_TTL_MS) {
    return respond(source, false, 'This approval link has expired (7 day limit). Use the ops dashboard to approve.')
  }

  // === STEP 1: Create Supabase auth user (no password, member sets it themselves) ===
  let userId: string
  try {
    userId = await getOrCreateAuthUser(lead.email, lead.full_name)
    console.log(`[approve-member] STEP:auth, user ready: ${userId}`)
  } catch (err: any) {
    console.error('[approve-member] STEP:auth, FAILED:', err.message || err)
    return respond(source, false, 'Failed to create account. Check Supabase logs.')
  }

  // === STEP 2: Create members row (main operational table, all FKs point here) ===
  const { data: existingMember } = await db().from('members').select('id').eq('id', userId).single()
  if (!existingMember) {
    const { error: memberErr } = await db().from('members').upsert({
      id:         userId,
      profile_id: userId,
      full_name:  lead.full_name,
      email:      lead.email,
      phone:      lead.phone || null,
      lead_id:    lead.id,
      status:     'Signed, Awaiting Intake',
    }, { onConflict: 'id' })
    if (memberErr) {
      console.error('[approve-member] STEP:members, FAILED:', JSON.stringify(memberErr))
      return respond(source, false, `Failed to create member record: ${memberErr.message}`)
    }
    console.log(`[approve-member] STEP:members, created for ${lead.email}`)
  } else {
    console.log(`[approve-member] STEP:members, already exists for ${lead.email}`)
  }

  // === STEP 3: Create member_profiles row (onboarding checklist) ===
  // Halt on failure: without a profile the user can't access the portal even though
  // auth + members row exist, which leaves them stuck mid-flow.
  const { error: profileErr } = await db().from('member_profiles').upsert({
    id:                          userId,
    email:                       lead.email,
    full_name:                   lead.full_name,
    phone:                       lead.phone || null,
    invited_at:                  new Date().toISOString(),
    membership_agreement_signed: false,
    medical_disclaimer_signed:   false,
    deposit_paid:                false,
    onboarding_complete:         false,
  }, { onConflict: 'id' })
  if (profileErr) {
    console.error('[approve-member] STEP:profiles, FAILED:', JSON.stringify(profileErr))
    return respond(source, false, `Failed to create member profile: ${profileErr.message}`)
  }
  console.log(`[approve-member] STEP:profiles, OK`)

  // === STEP 4: Assign member role (never overwrite founder) ===
  // Halt on failure: without the 'member' role, RLS blocks all portal reads/writes.
  const { data: existingRole } = await db().from('user_roles').select('role').eq('user_id', userId).single()
  if (existingRole?.role === 'founder') {
    console.log(`[approve-member] STEP:role, skipping, already founder`)
  } else {
    const { error: roleErr } = await db().from('user_roles').upsert(
      { user_id: userId, role: 'member' },
      { onConflict: 'user_id' }
    )
    if (roleErr) {
      console.error('[approve-member] STEP:role, FAILED:', JSON.stringify(roleErr))
      return respond(source, false, `Failed to assign member role: ${roleErr.message}`)
    }
    console.log(`[approve-member] STEP:role, assigned member`)
  }

  // === STEP 5: Mark lead approved (member_id FK now valid because members row exists) ===
  // If this fails we MUST stop, continuing leaves the lead stuck in "pending"
  // even though the auth user + members row exist, and the user would still see
  // a success page while the dashboard shows them as un-approved.
  const { error: leadErr } = await db().from('leads').update({
    approval_status:     'approved',
    approval_decided_at: new Date().toISOString(),
    approval_decided_by: source,
    converted_to_member: true,
    member_id:           userId,
    invite_sent_at:      new Date().toISOString(),
  }).eq('approval_token', token)
  if (leadErr) {
    console.error('[approve-member] STEP:lead, FAILED:', JSON.stringify(leadErr))
    return respond(source, false, `Failed to mark lead approved: ${leadErr.message}`)
  }
  console.log(`[approve-member] STEP:lead, marked approved`)

  // === STEP 6: Log timeline event ===
  // Lead is already marked approved at this point, but we still surface timeline
  // failures so ops notices audit gaps, the approval has committed, caller should
  // investigate the audit trail rather than re-trying approval.
  const { error: timelineErr } = await db().from('member_timelines').insert({
    member_id:    userId,
    event_type:   'account_approved',
    event_title:  'Membership approved',
    event_detail: `Approved via ${source}`,
    is_system:    true,
  })
  if (timelineErr) {
    console.error('[approve-member] STEP:timeline, FAILED (lead already approved):', JSON.stringify(timelineErr))
    return respond(source, false, `Approval committed but timeline log failed: ${timelineErr.message}. Check audit trail manually.`)
  }
  console.log(`[approve-member] STEP:timeline, logged`)

  // === STEP 7: Seed journey + draft commitment (non-blocking) ===
  // Gives the founder something to attach a program_price to immediately after
  // approval, saving program_price in the member editor updates this draft
  // commitment's expected_amount_cents via /api/payments/sync-program-price,
  // which then flows to the member's Love Exchange page as "Pledged / Remaining".
  // Log-and-continue: approval has already committed, and these rows can be
  // recreated from the dashboard if the insert blips.
  try {
    const { data: existingJourney } = await db()
      .from('journeys')
      .select('id')
      .eq('member_id', userId)
      .limit(1)
      .maybeSingle()

    let journeyId = existingJourney?.id as string | undefined
    if (!journeyId) {
      const { data: journeyRow, error: journeyErr } = await db()
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
      if (journeyErr || !journeyRow) {
        console.error('[approve-member] STEP:journey, FAILED (non-blocking):', JSON.stringify(journeyErr))
      } else {
        journeyId = journeyRow.id
        console.log(`[approve-member] STEP:journey, created ${journeyId}`)
      }
    } else {
      console.log(`[approve-member] STEP:journey, already exists ${journeyId}`)
    }

    if (journeyId) {
      const { data: existingCommit } = await db()
        .from('financial_commitments')
        .select('id')
        .eq('member_id', userId)
        .eq('journey_id', journeyId)
        .limit(1)
        .maybeSingle()

      if (!existingCommit) {
        const { error: commitErr } = await db()
          .from('financial_commitments')
          .insert({
            member_id:             userId,
            journey_id:            journeyId,
            kind:                  'journey_contribution',
            expected_amount_cents: 0,
            status:                'draft',
          })
        if (commitErr) {
          console.error('[approve-member] STEP:commitment, FAILED (non-blocking):', JSON.stringify(commitErr))
        } else {
          console.log(`[approve-member] STEP:commitment, draft created for journey ${journeyId}`)
        }
      } else {
        console.log(`[approve-member] STEP:commitment, already exists for journey ${journeyId}`)
      }
    }
  } catch (err: any) {
    console.error('[approve-member] STEP:journey+commitment, unexpected error (non-blocking):', err?.message || err)
  }

  // Mint a 30-day single-use setup token. Stored in public.setup_tokens and
  // exchanged server-side for a password set via the admin API in
  // /api/setup-account/complete. Replaces Supabase's recovery link, which is
  // hard-capped at 24h on hosted Supabase.
  let setupLink: string
  try {
    const token = await createSetupToken({
      userId,
      email: lead.email,
      fullName: lead.full_name,
    })
    setupLink = setupAccountUrl(token, env().appUrl)
    console.log(`[approve-member] STEP:setuplink, token minted, expires in 30 days`)
  } catch (err: any) {
    console.error('[approve-member] STEP:setuplink, FAILED:', err?.message || err)
    return respond(source, false, 'Account created but setup link generation failed. Try resending from the dashboard.')
  }

  // Send branded setup instructions email. The approval itself has already
  // committed, so a send failure surfaces as a warning on the success
  // response — the founder is told the truth and pointed at "Resend setup
  // link" instead of seeing a success message for an email that never left.
  let emailWarning: string | null = null
  try {
    await sendSetupEmail(lead.email, lead.full_name, setupLink)
    console.log(`[approve-member] STEP:setup-email, sent`)
  } catch (err: any) {
    console.error('[approve-member] STEP:setup-email, FAILED:', err?.message || err)
    emailWarning = `${lead.full_name} is approved and their account is ready, but the Welcome email failed to send. Use "Resend setup link" on their member profile.`
  }

  // Follow-up: "Add to Home Screen" install instructions. Non-blocking —
  // if it fails the member is still fully onboarded, and Rachel can
  // re-send manually from the dashboard if needed.
  if (!emailWarning) {
    try {
      await sendAppInstallEmail(lead.email, lead.full_name)
    } catch (err: any) {
      console.error('[approve-member] STEP:install-email, FAILED (non-blocking):', err?.message || err)
    }
  }

  return respond(source, true, null, lead.full_name, false, emailWarning)
}

async function getOrCreateAuthUser(email: string, fullName: string): Promise<string> {
  const listRes  = await adminFetch('GET', '/auth/v1/admin/users?per_page=1000')
  const listData = await listRes.json()
  const existing = (listData.users || []).find((u: any) => u.email === email)
  if (existing) return existing.id

  const res  = await adminFetch('POST', '/auth/v1/admin/users', {
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    // No password -- member sets it themselves on /setup-account
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  // Admin REST API returns user object directly (not wrapped in { user: {} })
  const userId = data.user?.id || data.id
  if (!userId) throw new Error(`No user ID in response: ${JSON.stringify(data).slice(0, 200)}`)
  return userId
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  if (!env().resendKey) {
    // Throw so the approval response carries a warning \u2014 reporting success
    // for an email that never left would mislead the founder.
    throw new Error('RESEND_API_KEY missing \u2014 Welcome email skipped')
  }

  const firstName = fullName?.split(' ')[0] || 'Friend'
  const { subject, html } = await renderSetupLinkEmail({
    firstName,
    setupLink,
    appUrl: env().appUrl,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env().resendKey}` },
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

async function sendAppInstallEmail(email: string, fullName: string) {
  if (!env().resendKey) { console.log('No RESEND_API_KEY \u2014 skipping install email'); return }

  const firstName = fullName?.split(' ')[0] || 'Friend'
  const { subject, html } = await renderAppInstallEmail({
    firstName,
    appUrl: env().appUrl,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env().resendKey}` },
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

async function adminFetch(method: string, path: string, body?: object) {
  return fetch(`${env().supabaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey:        env().serviceKey,
      Authorization: `Bearer ${env().serviceKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function respond(
  source: string,
  success: boolean,
  message: string | null,
  name?: string,
  alreadyDone?: boolean,
  warning?: string | null,
) {
  if (source === 'email_button') {
    return htmlResponse(success ? successPage(name!, alreadyDone!, warning) : errorPage(message!), success ? 200 : 400)
  }
  return success
    ? NextResponse.json(warning ? { ok: true, warning } : { ok: true })
    : NextResponse.json({ error: message }, { status: 400 })
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html' } })
}

function successPage(name: string, alreadyDone: boolean, warning?: string | null) {
  const safe = esc(name)
  const body = warning
    ? `<p class="warn">\u26a0 ${esc(warning)}</p>`
    : `<p>${
        alreadyDone
          ? `${safe} was already approved. If they still need their Welcome email, use "Resend setup link" on their member profile.`
          : 'Setup instructions have been sent to their email. You can close this tab.'
      }</p>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Approved</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  .check{font-size:32px;color:#c8a96e;margin-bottom:20px}
  h1{color:#f5f0e8;font-size:24px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  .warn{color:#c8a96e;border:1px solid rgba(200,169,110,.4);border-radius:6px;padding:12px 16px;text-align:left}
  </style></head><body><div class="card">
  <div class="check">${warning ? '\u26a0' : '\u2713'}</div>
  <h1>${alreadyDone ? 'Already approved' : `${safe} approved`}</h1>
  ${body}
  </div></body></html>`
}

function errorPage(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  h1{color:#f5f0e8;font-size:22px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  </style></head><body><div class="card">
  <h1>Something went wrong</h1><p>${message}</p>
  </div></body></html>`
}
