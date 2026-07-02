import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { lookupSetupToken, markSetupTokenUsed } from '@/lib/setup-tokens'

/**
 * POST /api/setup-account/complete
 * Body: { token: string, password: string }
 *
 * Validates the setup token, atomically consumes it, then sets the password
 * on the underlying auth user via the admin API. The client then signs in
 * with the password it just created.
 *
 * Consume-first means two concurrent submissions resolve to exactly one
 * winner; when the password set itself fails afterward, the token is
 * restored so the same link stays usable for a retry.
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
          ? 'This setup link has expired. Email yourself a fresh one from this page.'
          : lookup.reason === 'superseded'
            ? 'A newer setup link replaced this one. Open your most recent Welcome email, or email yourself a fresh link from this page.'
            : lookup.reason === 'used'
              ? 'Your account is already set up. Sign in with the password you created, or use "Forgot password" on the sign-in page.'
              : 'Email yourself a fresh setup link from this page.'
      return NextResponse.json({ ok: false, reason: lookup.reason, error: message }, { status: 400 })
    }

    // Consume the token BEFORE setting the password so two concurrent
    // submissions resolve to exactly one winner.
    const consumed = await markSetupTokenUsed(token)
    if (!consumed) {
      // Lost the race — re-check the token so the reason is accurate
      // (a founder re-mint mid-flight reads 'superseded', a completed
      // setup reads 'used').
      const recheck = await lookupSetupToken(token)
      const reason = !recheck.ok && recheck.reason === 'superseded' ? 'superseded' : 'used'
      return NextResponse.json(
        {
          ok: false,
          reason,
          error:
            reason === 'superseded'
              ? 'A newer setup link replaced this one. Open your most recent Welcome email, or email yourself a fresh link from this page.'
              : 'Your account is already set up. Sign in with the password you created, or use "Forgot password" on the sign-in page.',
        },
        { status: 400 },
      )
    }

    const supabase = db()
    const { error: updateErr } = await supabase.auth.admin.updateUserById(lookup.userId, {
      password,
    })
    if (updateErr) {
      console.error('[setup-account/complete] updateUserById failed:', updateErr.message)
      // This request was the sole consumer and the password stayed unset —
      // restore the token so the same link works for a retry instead of
      // burning one link per failed attempt.
      await supabase
        .from('setup_tokens')
        .update({ used_at: null })
        .eq('token', token)
      return NextResponse.json(
        {
          ok: false,
          error:
            'Something interrupted the setup. Give it another try in a moment, or contact aloha@vitalkauai.com.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, email: lookup.email })
  } catch (err: any) {
    console.error('[setup-account/complete] unhandled error:', err.message, err.stack)
    return NextResponse.json(
      { ok: false, error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
