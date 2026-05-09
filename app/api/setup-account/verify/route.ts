import { NextRequest, NextResponse } from 'next/server'
import { lookupSetupToken } from '@/lib/setup-tokens'

/**
 * POST /api/setup-account/verify
 * Body: { token: string }
 *
 * Read-only check used by the /setup-account page on first load to confirm
 * the link is still valid and to fetch the first name for the welcome
 * heading. Does not consume the token — that happens in /complete.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json().catch(() => ({}))
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 200 })
    }

    const result = await lookupSetupToken(token)
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 })
    }

    const firstName = result.fullName?.split(' ')[0] || ''
    return NextResponse.json({ ok: true, firstName, email: result.email })
  } catch (err: any) {
    console.error('[setup-account/verify] error:', err.message)
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 200 })
  }
}
