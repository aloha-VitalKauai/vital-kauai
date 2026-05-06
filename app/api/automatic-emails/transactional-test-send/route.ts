import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
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
  // Some tests need the same PDF the production route attaches.
  let attachments: Array<{ filename: string; content: string }> | undefined

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
      // free-guide normally renders inline in its own route. For test we
      // render the same draft preview the founder sees on screen, then
      // attach the actual PDF that production sends so the test fully
      // mirrors what a real recipient gets.
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

      try {
        const pdfPath = path.join(process.cwd(), 'public', 'iboga-guide-free.pdf')
        const pdfBytes = await readFile(pdfPath)
        attachments = [
          {
            filename: 'vital-kauai-iboga-guide.pdf',
            content: pdfBytes.toString('base64'),
          },
        ]
      } catch (pdfErr) {
        console.warn('[transactional-test-send] free_guide PDF not found, sending without attachment:', pdfErr)
      }
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
  const payload: Record<string, unknown> = {
    from: 'Vital Kauaʻi <aloha@vitalkauai.com>',
    to: recipient,
    subject,
    html: rendered.html,
  }
  if (attachments) payload.attachments = attachments

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const txt = await res.text()
    return NextResponse.json({ error: `Resend ${res.status}: ${txt}` }, { status: 500 })
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string }
  return NextResponse.json({ ok: true, id: data.id, to: recipient, attached_pdf: !!attachments })
}
