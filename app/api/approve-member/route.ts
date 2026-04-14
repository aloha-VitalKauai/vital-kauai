import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

  // === STEP 1: Create Supabase auth user (no password — member sets it themselves) ===
  let userId: string
  try {
    userId = await getOrCreateAuthUser(lead.email, lead.full_name)
    console.log(`[approve-member] STEP:auth — user ready: ${userId}`)
  } catch (err: any) {
    console.error('[approve-member] STEP:auth — FAILED:', err.message || err)
    return respond(source, false, 'Failed to create account. Check Supabase logs.')
  }

  // === STEP 2: Create members row (main operational table — all FKs point here) ===
  const { data: existingMember } = await db().from('members').select('id').eq('id', userId).single()
  if (!existingMember) {
    const { error: memberErr } = await db().from('members').upsert({
      id:        userId,
      full_name: lead.full_name,
      email:     lead.email,
      phone:     lead.phone || null,
      lead_id:   lead.id,
      status:    'Signed — Awaiting Intake',
    }, { onConflict: 'id' })
    if (memberErr) {
      console.error('[approve-member] STEP:members — FAILED:', JSON.stringify(memberErr))
      return respond(source, false, `Failed to create member record: ${memberErr.message}`)
    }
    console.log(`[approve-member] STEP:members — created for ${lead.email}`)
  } else {
    console.log(`[approve-member] STEP:members — already exists for ${lead.email}`)
  }

  // === STEP 3: Create member_profiles row (onboarding checklist) ===
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
  if (profileErr) console.error('[approve-member] STEP:profiles — FAILED:', JSON.stringify(profileErr))
  else console.log(`[approve-member] STEP:profiles — OK`)

  // === STEP 4: Assign member role (never overwrite founder) ===
  const { data: existingRole } = await db().from('user_roles').select('role').eq('user_id', userId).single()
  if (existingRole?.role === 'founder') {
    console.log(`[approve-member] STEP:role — skipping, already founder`)
  } else {
    const { error: roleErr } = await db().from('user_roles').upsert(
      { user_id: userId, role: 'member' },
      { onConflict: 'user_id' }
    )
    if (roleErr) console.error('[approve-member] STEP:role — FAILED:', JSON.stringify(roleErr))
    else console.log(`[approve-member] STEP:role — assigned member`)
  }

  // === STEP 5: Mark lead approved (member_id FK now valid because members row exists) ===
  const { error: leadErr } = await db().from('leads').update({
    approval_status:     'approved',
    approval_decided_at: new Date().toISOString(),
    approval_decided_by: source,
    converted_to_member: true,
    member_id:           userId,
    invite_sent_at:      new Date().toISOString(),
  }).eq('approval_token', token)
  if (leadErr) console.error('[approve-member] STEP:lead — FAILED:', JSON.stringify(leadErr))
  else console.log(`[approve-member] STEP:lead — marked approved`)

  // === STEP 6: Log timeline event ===
  const { error: timelineErr } = await db().from('member_timelines').insert({
    member_id:    userId,
    event_type:   'account_approved',
    event_title:  'Membership approved',
    event_detail: `Approved via ${source} \u2014 setup instructions sent`,
    is_system:    true,
  })
  if (timelineErr) console.error('[approve-member] STEP:timeline — FAILED:', JSON.stringify(timelineErr))
  else console.log(`[approve-member] STEP:timeline — logged`)

  // Generate one-time setup link -> /portal/set-password
  // This is NOT an ongoing magic link.
  // After they create their password, they ALWAYS log in with email + password.
  const setupLink = await generatePasswordSetupLink(lead.email, lead.full_name)

  if (!setupLink) {
    return respond(source, false, 'Account created but setup link generation failed. Try resending from the dashboard.')
  }

  // Send branded setup instructions email
  await sendSetupEmail(lead.email, lead.full_name, setupLink)

  return respond(source, true, null, lead.full_name, false)
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
    // No password -- member sets it themselves on /portal/set-password
  })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data.user.id
}

async function generatePasswordSetupLink(email: string, fullName: string): Promise<string | null> {
  // Try invite first (for new users)
  let res = await adminFetch('POST', '/auth/v1/admin/generate_link', {
    type:  'invite',
    email,
    options: {
      redirect_to: `${env().appUrl}/portal/set-password`,
      data: { full_name: fullName },
    },
  })
  let data = await res.json()
  if (data.action_link) return data.action_link

  // If user already exists, use recovery link instead
  if (data.error_code === 'email_exists' || data.msg?.includes('already been registered')) {
    res = await adminFetch('POST', '/auth/v1/admin/generate_link', {
      type: 'recovery',
      email,
      options: {
        redirect_to: `${env().appUrl}/portal/set-password`,
      },
    })
    data = await res.json()
    if (data.action_link) return data.action_link
  }

  console.error('Setup link generation failed:', data)
  return null
}

async function sendSetupEmail(email: string, fullName: string, setupLink: string) {
  const firstName = fullName?.split(' ')[0] || 'Friend'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;background:#f5f0e8;margin:0;padding:40px 16px}
    .wrap{max-width:560px;margin:0 auto}
    .card{background:#1a2e1c;border-radius:6px;overflow:hidden}
    .top-bar{background:#c8a96e;height:4px}
    .inner{padding:48px 44px 44px}
    .eyebrow{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8a96e;margin:0 0 22px}
    h1{color:#f5f0e8;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 20px}
    h1 em{font-style:italic;color:rgba(245,240,232,.7)}
    p{color:rgba(245,240,232,.7);font-size:16px;line-height:1.75;margin:0 0 18px}
    .cta-wrap{margin:36px 0 28px;text-align:center}
    .cta{display:inline-block;background:#c8a96e;color:#1a2e1c;text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:17px 38px;border-radius:3px}
    .steps{margin:28px 0;padding:22px 26px;background:rgba(245,240,232,.05);border-radius:6px;border-left:2px solid #c8a96e}
    .step{display:flex;gap:14px;margin-bottom:14px;align-items:flex-start}
    .step:last-child{margin-bottom:0}
    .step-num{font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;color:#c8a96e;background:rgba(200,169,110,.15);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .step-text{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:rgba(245,240,232,.65);line-height:1.5}
    .step-text strong{color:#f5f0e8}
    hr{border:none;border-top:1px solid rgba(200,169,110,.15);margin:28px 0}
    .login-box{background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.1);border-radius:6px;padding:18px 22px;margin-bottom:24px}
    .login-box p{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:rgba(245,240,232,.5);margin:0 0 4px}
    .login-url{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#c8a96e}
    .note{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:rgba(245,240,232,.3);line-height:1.6;margin:0 0 12px}
    .note a{color:#c8a96e;text-decoration:none}
    .footer{font-family:'Helvetica Neue',sans-serif;font-size:11px;color:rgba(245,240,232,.22);text-align:center;line-height:1.9}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="top-bar"></div>
    <div class="inner">
      <p class="eyebrow">Vital Kaua\u02BBi \u00B7 Member Portal</p>
      <h1>Welcome, <em>${firstName}.</em></h1>
      <p>We're honored to welcome you to Vital Kaua\u02BBi. Your private member portal is ready \u2014 it holds everything you need to prepare for your journey.</p>
      <p>Click below to create your account. This takes about 30 seconds.</p>
      <div class="cta-wrap">
        <a class="cta" href="${setupLink}">Set Up My Account \u2192</a>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text">Click the button above \u2014 it takes you to your account setup page.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Create a password</strong> you'll use every time you sign in.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text">You'll land directly in your member portal dashboard.</div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-text">Complete your <strong>required documents</strong> as your first step inside.</div>
        </div>
      </div>
      <hr>
      <p style="color:rgba(245,240,232,.6);font-family:'Helvetica Neue',sans-serif;font-size:14px;margin:0 0 16px">After setup, sign in any time at:</p>
      <div class="login-box">
        <p>Member portal login</p>
        <span class="login-url">${env().appUrl}/portal/sign-in</span>
      </div>
      <p class="note">The setup button expires in <strong style="color:rgba(245,240,232,.45)">24 hours</strong>. If it expires, go to the login page and use "Forgot password" to get a new link.</p>
      <p class="note">Questions? Reply to this email or reach us at <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a></p>
      <hr>
      <div class="footer">\u00A9 2026 Vital Kaua\u02BBi Church \u00B7 PO Box 932, Hanalei, HI 96714<br>aloha@vitalkauai.com</div>
    </div>
  </div></div>
</body>
</html>`

  if (!env().resendKey) { console.log('No RESEND_API_KEY \u2014 skipping setup email'); return }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env().resendKey}` },
    body: JSON.stringify({
      from:    'Vital Kaua\u02BBi <aloha@vitalkauai.com>',
      to:      email,
      subject: `Welcome to Vital Kaua\u02BBi, ${firstName} \u2014 set up your account`,
      html,
    }),
  })
  if (!res.ok) console.error('Resend failed:', await res.text())
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

function respond(source: string, success: boolean, message: string | null, name?: string, alreadyDone?: boolean) {
  if (source === 'email_button') {
    return htmlResponse(success ? successPage(name!, alreadyDone!) : errorPage(message!), success ? 200 : 400)
  }
  return success
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: message }, { status: 400 })
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html' } })
}

function successPage(name: string, alreadyDone: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Approved</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  .check{font-size:32px;color:#c8a96e;margin-bottom:20px}
  h1{color:#f5f0e8;font-size:24px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  </style></head><body><div class="card">
  <div class="check">\u2713</div>
  <h1>${alreadyDone ? 'Already approved' : `${name} approved`}</h1>
  <p>${alreadyDone ? `${name} was already approved. Their setup email was sent.` : 'Setup instructions have been sent to their email. You can close this tab.'}</p>
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
