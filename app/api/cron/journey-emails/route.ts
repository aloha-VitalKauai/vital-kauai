import { NextResponse } from 'next/server'
import { createClient as createServiceSupabase } from '@supabase/supabase-js'
import {
  renderJourneyEmailHtml,
  sendJourneyEmail,
  weekToSendToday,
  type JourneyEmailTemplate,
  type JourneyArc,
} from '@/lib/journey-emails'

export const runtime = 'nodejs'

/**
 * Daily cron — sends weekly preparation/integration emails to members on the
 * day they enter a new pre/post-ceremony week.
 *
 * Auth: Bearer ${CRON_SECRET} OR ?secret=... (matches /api/cron/reconcile).
 *
 * Logic:
 *   1. Pull active journeys with a known start_at.
 *   2. For each, ask weekToSendToday() if today is a week boundary day.
 *   3. Skip if (journey, arc, week_idx) already exists in journey_email_log.
 *   4. Pull the template, render, send via Resend, log.
 *
 * Late-booking behavior: only sends weeks whose start day is exactly today.
 * A member approved 3 weeks before ceremony will start receiving emails from
 * the next week boundary onward; missed weeks are not back-filled.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[journey-emails] CRON_SECRET not set')
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

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // 1. Active journeys with a date.
  const { data: journeys, error: jErr } = await supabase
    .from('journeys')
    .select('id, member_id, start_at, status')
    .in('status', ['scheduled', 'in_progress'])
    .not('start_at', 'is', null)

  if (jErr) {
    console.error('[journey-emails] journeys query failed', jErr)
    return NextResponse.json({ error: 'journeys_query_failed' }, { status: 500 })
  }

  // 2. Decide who needs which email today.
  type Pending = {
    journey_id: string
    member_id: string
    arc: JourneyArc
    week_idx: number
  }
  const pending: Pending[] = []
  for (const j of journeys ?? []) {
    const hit = weekToSendToday(j.start_at as string)
    if (!hit) continue
    pending.push({
      journey_id: j.id as string,
      member_id: j.member_id as string,
      arc: hit.arc,
      week_idx: hit.week_idx,
    })
  }

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: 0, message: 'no_weeks_today' })
  }

  // 3. De-dupe against the log.
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
    return NextResponse.json({ ok: true, sent: 0, skipped: pending.length, errors: 0, message: 'all_already_sent' })
  }

  // 4. Pull templates + member emails in batch.
  const { data: templatesRaw } = await supabase
    .from('journey_email_templates')
    .select('id, arc, week_idx, principle_name, principle, theme, subject, intro, action_items')

  const templates = new Map<string, JourneyEmailTemplate>()
  for (const t of (templatesRaw ?? []) as JourneyEmailTemplate[]) {
    templates.set(`${t.arc}|${t.week_idx}`, t)
  }

  const memberIds = Array.from(new Set(todo.map((t) => t.member_id)))
  const { data: members } = await supabase
    .from('members')
    .select('id, email, full_name')
    .in('id', memberIds)

  const memberById = new Map(
    (members ?? []).map((m) => [m.id as string, m as { id: string; email: string | null; full_name: string | null }]),
  )

  // 5. Send + log.
  let sent = 0
  let errors = 0
  const errorDetails: Array<{ journey_id: string; reason: string }> = []

  for (const t of todo) {
    const tpl = templates.get(`${t.arc}|${t.week_idx}`)
    const member = memberById.get(t.member_id)
    if (!tpl) {
      errors++
      errorDetails.push({ journey_id: t.journey_id, reason: 'template_missing' })
      continue
    }
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
