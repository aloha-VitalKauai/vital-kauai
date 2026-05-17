import { NextResponse } from 'next/server'
import { runJourneyEmailsCatchUp } from '@/lib/api/journey-emails-catchup'

export const runtime = 'nodejs'

/**
 * One-shot catch-up sender for journey emails missed because the daily
 * cron failed. Same auth as the daily cron: Bearer ${CRON_SECRET} or
 * ?secret=... Add ?dryRun=1 to preview.
 *
 * Shared logic lives in lib/api/journey-emails-catchup.ts so the
 * founder-gated /api/automatic-emails/run-catchup route can call the
 * same function without exposing the cron secret to the dashboard.
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
