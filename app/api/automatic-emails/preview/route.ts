import { NextRequest, NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { renderJourneyEmailHtml, type JourneyEmailTemplate } from '@/lib/journey-emails'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const founder = await verifyFounder()
  if (!founder) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { template, firstName } = (await req.json()) as {
    template: JourneyEmailTemplate
    firstName?: string
  }
  if (!template) return NextResponse.json({ error: 'template required' }, { status: 400 })

  const html = renderJourneyEmailHtml(template, firstName ?? 'Friend')
  return NextResponse.json({ html })
}
