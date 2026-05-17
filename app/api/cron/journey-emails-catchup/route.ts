import { NextResponse } from 'next/server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import {
  renderJourneyEmailHtml,
  sendJourneyEmail,
  currentWeekForJourney,
  type JourneyArc,
} from '@/lib/journey-emails'
import { getJourneyEmailTemplate } from '@/lib/journey-emails-from-integration'

export const runtime = 'nodejs'

/**
 * One-shot catch-up sender for journey emails missed because the daily
 * cron failed (e.g. CRON_SECRET was unset on Vercel). Same auth as the
 * daily cron: Bearer ${CRON_SECRET} OR ?secret=...
 *
 * Behavior: for each active journey, finds the *current* week the member
 * is in (the most recent boundary that has already passed) and sends that
 * one email if it hasn't already been logged. Capped at 14 days of
 * lateness so a stale journey doesn't trigger an old prep email.
 *
 * Add ?dryRun=1 to preview what would send without actually sending.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[journey-emails-catchup] CRON_SECRET not set')
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  }

  const url = new URL(req.url)
  const headerAuth = req.headers.get('authorization')
  const querySecret = url.searchParams.get('secret')
  const authorized =
    headerAuth === `Bearer ${secret}` || querySecret === secret
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const dryRun = url.searchParams.get('dryRun') === '1'

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: journeys, error: jErr } = await supabase
    .from('journeys')
    .select('id, member_id, start_at, status')
    .in('status', ['scheduled', 'in_progress'])
    .not('start_at', 'is', null)

  if (jErr) {
    console.error('[journey-emails-catchup] journeys query failed', jErr)
    return NextResponse.json({ error: 'journeys_query_failed' }, { status: 500 })
  }

  type Pending = {
    journey_id: string
    member_id: string
    arc: JourneyArc
    week_idx: number
    days_late: number
  }
  const pending: Pending[] = []
  for (const j of journeys ?? []) {
    const hit = currentWeekForJourney(j.start_at as string)
    if (!hit) continue
    pending.push({
      journey_id: j.id as string,
      member_id: j.member_id as string,
      arc: hit.arc,
      week_idx: hit.week_idx,
      days_late: hit.daysLate,
    })
  }

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: 0, message: 'no_eligible_journeys' })
  }

  const { data: existing } = await supabase
    .from('journey_email_log')
    .select('journey_id, arc, week_idx')
    .in('journey_id', pending.map((p) => p.journey_id))

  const sentKey = new Set(
    (existing ?? []).map((r) => `${r.journey_id}|${r.arc}|${r.week_idx}`),
  )
  const todo = pending.filter(
    (p) => !sentKey.has(`${p.journey_id}|${p.arc}|${p.week_idx}`),
  )

  if (todo.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: pending.length, errors: 0, message: 'all_already_logged' })
  }

  const memberIds = Array.from(new Set(todo.map((t) => t.member_id)))
  const { data: members } = await supabase
    .from('members')
    .select('id, email, full_name')
    .in('id', memberIds)

  const memberById = new Map(
    (members ?? []).map((m) => [m.id as string, m as { id: string; email: string | null; full_name: string | null }]),
  )

  if (dryRun) {
    const preview = todo.map((t) => {
      const member = memberById.get(t.member_id)
      const tpl = getJourneyEmailTemplate(t.arc, t.week_idx)
      return {
        journey_id: t.journey_id,
        member_email: member?.email ?? null,
        member_name: member?.full_name ?? null,
        arc: t.arc,
        week_idx: t.week_idx,
        days_late: t.days_late,
        subject: tpl.subject,
      }
    })
    return NextResponse.json({ ok: true, dryRun: true, would_send: preview.length, preview })
  }

  let sent = 0
  let errors = 0
  const errorDetails: Array<{ journey_id: string; reason: string }> = []

  for (const t of todo) {
    const tpl = getJourneyEmailTemplate(t.arc, t.week_idx)
    const member = memberById.get(t.member_id)
    if (!member?.email) {
      errors++
      errorDetails.push({ journey_id: t.journey_id, reason: 'member_email_missing' })
      continue
    }

    const firstName = (member.full_name ?? '').split(' ')[0] || ''
    const html = renderJourneyEmailHtml(tpl, firstName)

    try {
      const resendId = await sendJourneyEmail({
        to: member.email,
        subject: tpl.subject,
        html,
      })

      await supabase.from('journey_email_log').insert({
        journey_id: t.journey_id,
        member_id: t.member_id,
        arc: t.arc,
        week_idx: t.week_idx,
        recipient_email: member.email,
        subject: tpl.subject,
        resend_id: resendId,
        template_snapshot: tpl,
      })
      sent++
    } catch (err) {
      errors++
      errorDetails.push({
        journey_id: t.journey_id,
        reason: err instanceof Error ? err.message : 'send_failed',
      })
    }
  }

  return NextResponse.json({
    ok: errors === 0,
    sent,
    skipped: pending.length - todo.length,
    errors,
    errorDetails: errors > 0 ? errorDetails : undefined,
  })
}
