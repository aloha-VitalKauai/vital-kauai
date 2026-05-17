import { NextResponse } from 'next/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import { runJourneyEmailsCatchUp } from '@/lib/api/journey-emails-catchup'

export const runtime = 'nodejs'

/**
 * Founder-gated wrapper around the journey-emails catch-up. Lets the
 * Send Log tab fire the catch-up with one click instead of needing the
 * CRON_SECRET in the chat or terminal.
 *
 * POST body: { dryRun?: boolean }
 */
export async function POST(req: Request) {
  const founder = await verifyFounder()
  if (!founder) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
  } catch {
    // empty/invalid body — default to real send
  }

  try {
    const result = await runJourneyEmailsCatchUp({ dryRun })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown_error' },
      { status: 500 },
    )
  }
}
