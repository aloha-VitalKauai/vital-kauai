import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import {
  renderJourneyEmailHtml,
  sendJourneyEmail,
  type JourneyEmailTemplate,
} from '@/lib/journey-emails'

export const runtime = 'nodejs'

/**
 * Sends a one-off copy of a template to the founder for review. Does NOT
 * write to journey_email_log — only the cron does that, so production
 * sends stay clean.
 */
export async function POST(req: NextRequest) {
  const founder = await verifyFounder()
  if (!founder) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { template, to } = (await req.json()) as {
    template: JourneyEmailTemplate
    to?: string
  }
  if (!template) return NextResponse.json({ error: 'template required' }, { status: 400 })

  const recipient = to || founder.email
  const subject = `[TEST] ${template.subject}`
  const html = renderJourneyEmailHtml(template, founder.email.split('@')[0] || 'Friend')

  try {
    const id = await sendJourneyEmail({ to: recipient, subject, html })
    return NextResponse.json({ ok: true, id, to: recipient })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'send_failed' },
      { status: 500 },
    )
  }
}
