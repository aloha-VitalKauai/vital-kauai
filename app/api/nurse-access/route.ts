import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
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
    resendKey: process.env.RESEND_API_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey:  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }
}

/**
 * POST /api/nurse-access
 * Body: { practitioner_id: string }
 *
 * Founder-only. Provisions (or refreshes) a nurse login for a roster entry:
 * creates the auth user if needed, grants the 'nurse' role, links the roster
 * entry via practitioners.auth_user_id, mints a 30-day setup token, and
 * emails the sign-in setup link. Safe to call again — it re-sends a fresh
 * link and supersedes older ones, same as the member flow.
 */
export async function POST(req: NextRequest) {
  try {
    const founder = await verifyFounder()
    if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { practitioner_id } = await req.json()
    if (!practitioner_id) {
      return NextResponse.json({ error: 'practitioner_id is required' }, { status: 400 })
    }

    const supabase = db()
    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .select('id, full_name, email, auth_user_id, active')
      .eq('id', practitioner_id)
      .maybeSingle()

    if (pErr || !practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
    }
    if (!practitioner.email) {
      return NextResponse.json(
        { error: 'Add an email to this team member first — the login link is sent there.' },
        { status: 400 },
      )
    }
    if (!practitioner.active) {
      return NextResponse.json(
        { error: 'This team member is inactive. Reactivate them before enabling access.' },
        { status: 400 },
      )
    }

    const userId = practitioner.auth_user_id ?? (await getOrCreateAuthUser(practitioner.email, practitioner.full_name))

    // A login is exactly one role here. Never repurpose a founder or member
    // account into a nurse account — that would swap what the person sees.
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (existingRole && existingRole.role !== 'nurse') {
      return NextResponse.json(
        { error: `${practitioner.email} already has a ${existingRole.role} account. Use a different email for their nurse login.` },
        { status: 409 },
      )
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'nurse' }, { onConflict: 'user_id' })
    if (roleErr) {
      return NextResponse.json({ error: `Failed to grant nurse role: ${roleErr.message}` }, { status: 500 })
    }

    const { error: linkErr } = await supabase
      .from('practitioners')
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', practitioner.id)
    if (linkErr) {
      return NextResponse.json({ error: `Failed to link login: ${linkErr.message}` }, { status: 500 })
    }

    const token = await createSetupToken({
      userId,
      email: practitioner.email,
      fullName: practitioner.full_name,
    })
    const setupLink = setupAccountUrl(token, env().appUrl)

    let emailWarning: string | null = null
    try {
      await sendNurseSetupEmail(practitioner.email, practitioner.full_name, setupLink)
    } catch (err) {
      emailWarning = `Login is ready, but the email failed to send (${err instanceof Error ? err.message : 'unknown error'}). Click the button again to retry.`
    }

    return NextResponse.json({ ok: true, warning: emailWarning })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}

async function getOrCreateAuthUser(email: string, fullName: string): Promise<string> {
  const { supabaseUrl, serviceKey } = env()
  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }

  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers })
  const listData = await listRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (listData.users || []).find((u: any) => u.email === email)
  if (existing) return existing.id

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      // No password — the nurse sets it on /setup-account
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  const userId = data.user?.id || data.id
  if (!userId) throw new Error(`No user ID in response: ${JSON.stringify(data).slice(0, 200)}`)
  return userId
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendNurseSetupEmail(email: string, fullName: string, setupLink: string) {
  const { resendKey } = env()
  if (!resendKey) throw new Error('RESEND_API_KEY missing')

  const firstName = esc(fullName?.split(' ')[0] || 'Aloha')
  const html = `
  <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1A1A18;">
    <h2 style="font-weight: 400; color: #085041;">Aloha ${firstName},</h2>
    <p style="font-size: 15px; line-height: 1.6;">
      You&rsquo;ve been given care-team access at Vital Kaua&#699;i. Your account shows the
      members in your care — their medical profile, intake form, lab documents,
      and a shared notes log.
    </p>
    <p style="font-size: 15px; line-height: 1.6;">
      Set your password to get started. This link works for 30 days:
    </p>
    <p style="margin: 28px 0;">
      <a href="${setupLink}"
         style="background: #085041; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px;">
        Set up your account
      </a>
    </p>
    <p style="font-size: 13px; color: #6B6B67; line-height: 1.6;">
      After setting your password, sign in any time at
      <a href="${env().appUrl}/login" style="color: #085041;">${env().appUrl.replace(/^https?:\/\//, '')}/login</a>.
      Member health information is confidential — please keep this account to yourself.
    </p>
    <p style="font-size: 14px; color: #6B6B67;">With aloha,<br/>Vital Kaua&#699;i</p>
  </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Vital Kauaʻi <aloha@vitalkauai.com>',
      to: email,
      subject: 'Your Vital Kauaʻi care-team account',
      html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`)
  }
}
