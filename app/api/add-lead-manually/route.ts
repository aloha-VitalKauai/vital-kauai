import { NextRequest, NextResponse } from 'next/server'
import { requireFounder } from '@/lib/auth/founder-check'

/**
 * POST /api/add-lead-manually
 * Body: { full_name: string, email: string, phone?: string, source?: string, message?: string, notes?: string }
 *
 * Founder-only. Inserts a row directly into `leads` for prospects that come
 * in outside the tracked intake paths (walk-up conversation, referral,
 * DM, etc.) so they show up in the Leads pipeline. approval_status is set
 * to 'approved' since a founder is vouching for the lead directly — this
 * keeps it out of the /ops/pending queue, which expects a Calendly-issued
 * approval_token.
 *
 * Returns: { ok, lead_id }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireFounder()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    const { supabase, user } = ctx

    const body = await req.json().catch(() => ({}))
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : ''
    const email = rawEmail.toLowerCase()
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'Manual'
    const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

    if (!fullName) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, full_name')
      .ilike('email', email)
      .maybeSingle()

    if (existingLead) {
      return NextResponse.json(
        { error: `A lead with that email already exists (${existingLead.full_name}).`, existing_lead_id: existingLead.id },
        { status: 409 },
      )
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('leads')
      .insert({
        full_name: fullName,
        email,
        phone,
        source,
        message,
        notes,
        approval_status: 'approved',
        approval_decided_at: new Date().toISOString(),
        approval_decided_by: user.email,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[add-lead-manually] insert failed:', JSON.stringify(insertErr))
      return NextResponse.json({ error: `Failed to create lead: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, lead_id: inserted.id })
  } catch (err: any) {
    console.error('[add-lead-manually] unhandled error:', err?.message, err?.stack)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
