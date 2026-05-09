import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { lookupSetupToken, markSetupTokenUsed } from '@/lib/setup-tokens'

/**
 * POST /api/setup-account/complete
 * Body: { token: string, password: string }
 *
 * Validates the setup token, sets the password on the underlying auth user
 * via the admin API, and marks the token used. The client then signs in
 * with the password it just created.
 *
 * Token is consumed even on partial success (password set but bookkeeping
 * fails), to avoid double-use windows.
 */
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const MIN_PASSWORD_LENGTH = 8

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token    = typeof body?.token === 'string' ? body.token : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token.' }, { status: 400 })
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      )
    }

    const lookup = await lookupSetupToken(token)
    if (!lookup.ok) {
      const message =
        lookup.reason === 'expired'
          ? 'This setup link has expired. Use "Forgot password" on the sign-in page to get a fresh link.'
          : lookup.reason === 'used'
            ? 'This setup link has already been used. Sign in with the password you created, or use "Forgot password".'
            : 'This setup link is invalid.'
      return NextResponse.json({ ok: false, reason: lookup.reason, error: message }, { status: 400 })
    }

    const supabase = db()
    const { error: updateErr } = await supabase.auth.admin.updateUserById(lookup.userId, {
      password,
    })
    if (updateErr) {
      console.error('[setup-account/complete] updateUserById failed:', updateErr.message)
      return NextResponse.json(
        { ok: false, error: 'Could not set password. Please try again or contact aloha@vitalkauai.com.' },
        { status: 500 },
      )
    }

    await markSetupTokenUsed(token)

    return NextResponse.json({ ok: true, email: lookup.email })
  } catch (err: any) {
    console.error('[setup-account/complete] unhandled error:', err.message, err.stack)
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
