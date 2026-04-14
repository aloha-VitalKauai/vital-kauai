import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET  /api/decline-member?token=xxx  <- clicked from founder email button
// POST /api/decline-member            <- called from ops dashboard
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return htmlResponse(errorPage('Missing token.'), 400)
  return handleDecline(token, 'email_button', null)
}

export async function POST(req: NextRequest) {
  const founder = await verifyFounder()
  if (!founder) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { token, reason, decidedBy } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  return handleDecline(token, decidedBy || 'dashboard', reason)
}

async function handleDecline(token: string, source: string, reason: string | null) {
  const { data: lead, error } = await getSupabase()
    .from('leads')
    .select('*')
    .eq('approval_token', token)
    .single()

  if (error || !lead) {
    if (source === 'email_button') return htmlResponse(errorPage('This link is invalid or has expired.'), 400)
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  if (lead.approval_status === 'declined') {
    if (source === 'email_button') return htmlResponse(alreadyDeclinedPage(lead.full_name), 200)
    return NextResponse.json({ ok: true, alreadyDeclined: true })
  }

  await getSupabase().from('leads').update({
    approval_status:     'declined',
    approval_decided_at: new Date().toISOString(),
    approval_decided_by: source,
    decline_reason:      reason || null,
  }).eq('approval_token', token)

  if (source === 'email_button') return htmlResponse(declinedPage(lead.full_name), 200)
  return NextResponse.json({ ok: true })
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html' } })
}

function declinedPage(name: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Declined</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  h1{color:#f5f0e8;font-size:22px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  </style></head><body><div class="card">
  <h1>${name} has been declined</h1>
  <p>No invite will be sent. You can close this tab. If you change your mind, update their status from the ops dashboard.</p>
  </div></body></html>`
}

function alreadyDeclinedPage(name: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Already Declined</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  h1{color:#f5f0e8;font-size:22px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  </style></head><body><div class="card">
  <h1>Already declined</h1>
  <p>${name} was already marked as declined. Manage from the ops dashboard if needed.</p>
  </div></body></html>`
}

function errorPage(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title>
  <style>body{font-family:Georgia,serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1a2e1c;padding:52px 44px;border-radius:8px;max-width:440px;text-align:center}
  h1{color:#f5f0e8;font-size:22px;font-weight:400;margin:0 0 14px}
  p{color:rgba(245,240,232,.6);font-size:15px;line-height:1.65;margin:0}
  </style></head><body><div class="card"><h1>Something went wrong</h1><p>${message}</p></div></body></html>`
}
