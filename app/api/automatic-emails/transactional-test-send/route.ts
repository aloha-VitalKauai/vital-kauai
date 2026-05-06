import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderSetupLinkEmail, renderPaymentLinkEmail } from '@/lib/email-renderers'
import type { TransactionalEmailTemplate } from '@/lib/transactional-emails'

export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vital-kauai.vercel.app'

/**
 * Sends a real test copy of a transactional email to the founder. Uses the
 * production renderer (which reads from DB) so the test reflects what
 * members will actually receive after a save.
 *
 * Founder-facing alerts are display-only — those return 400 since there's
 * no body to send.
 *
 * NOTE: free_guide is skipped here because it requires a PDF attachment
 * that the renderer doesn't handle directly. We send a plain version of
 * the body for review, with a clear note that the real email also
 * includes the PDF.
 */
export async function POST(req: NextRequest) {
  const founder = await verifyFounder()
  if (!founder) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { template, to } = (await req.json()) as {
    template: TransactionalEmailTemplate
    to?: string
  }
  if (!template?.key) return NextResponse.json({ error: 'template required' }, { status: 400 })
  if (!template.editable) {
    return NextResponse.json(
      { error: 'founder alerts are display-only — no test send' },
      { status: 400 },
    )
  }

  const recipient = to || founder.email
  const firstName = (founder.email.split('@')[0] || 'Friend').replace(/[^a-zA-Z]/g, '') || 'Friend'

  let rendered: { subject: string; html: string }
  try {
    if (template.key === 'setup_link') {
      rendered = await renderSetupLinkEmail({
        firstName,
        setupLink: `${APP_URL}/setup-account?token=preview`,
        appUrl: APP_URL,
      })
    } else if (template.key === 'payment_link') {
      rendered = await renderPaymentLinkEmail({
        firstName,
        amount: '$15,000.00',
        payUrl: `${APP_URL}/portal/journey/payment?token=preview`,
      })
    } else if (template.key === 'free_guide') {
      // free-guide route does PDF attachment work that lives in its own
      // route file. For test, render a body-only preview using the same
      // scaffold and skip the attachment.
      const previewRes = await fetch(`${req.nextUrl.origin}/api/automatic-emails/transactional-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: req.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({ template }),
      })
      const data = await previewRes.json()
      rendered = { subject: data.subject, html: data.html }
    } else {
      return NextResponse.json({ error: `unknown template key: ${template.key}` }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'render_failed' },
      { status: 500 },
    )
  }

  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const subject = `[TEST] ${rendered.subject}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: 'Vital Kauaʻi <aloha@vitalkauai.com>',
      to: recipient,
      subject,
      html: rendered.html,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    return NextResponse.json({ error: `Resend ${res.status}: ${txt}` }, { status: 500 })
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string }
  return NextResponse.json({ ok: true, id: data.id, to: recipient })
}
