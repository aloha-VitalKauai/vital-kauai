/**
 * Custom 30-day setup tokens for the "Welcome — set up your account" flow.
 *
 * Supabase's built-in recovery link is hard-capped at 24h on hosted Supabase,
 * which is too short for the typical "approval → first login" lag (a member
 * gets approved, the email sits unread over a weekend, link is dead by Monday).
 *
 * This module mints opaque single-use tokens stored in `public.setup_tokens`,
 * which the /setup-account page exchanges for a server-side admin password
 * update via /api/setup-account/complete.
 */

import { randomBytes } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SETUP_TOKEN_TTL_DAYS = 30

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function setupAccountUrl(token: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, '')}/setup-account?token=${encodeURIComponent(token)}`
}

/**
 * Mint a fresh setup token for `userId`. Any existing live tokens for the
 * same user are marked superseded so only the most recent link is live.
 * `superseded_at` is distinct from `used_at` (written only by /complete):
 * a superseded link gets "a newer link replaced this one" copy plus a
 * self-service resend, while a used link means setup genuinely finished.
 */
export async function createSetupToken(args: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const { userId, email, fullName } = args
  const supabase = db()

  const { error: supersedeErr } = await supabase
    .from('setup_tokens')
    .update({ superseded_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)
    .is('superseded_at', null)
  if (supersedeErr) {
    // Surface loudly — a silent failure here would leave multiple live
    // password-setting links in the wild.
    throw new Error(`Failed to supersede prior setup tokens: ${supersedeErr.message}`)
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('setup_tokens').insert({
    token,
    user_id: userId,
    email,
    full_name: fullName,
    expires_at: expiresAt,
  })
  if (error) {
    throw new Error(`Failed to mint setup token: ${error.message}`)
  }
  return token
}

export type SetupTokenLookup =
  | { ok: true; userId: string; email: string; fullName: string | null }
  | { ok: false; reason: 'not_found' | 'used' | 'superseded' | 'expired' }

export async function lookupSetupToken(token: string): Promise<SetupTokenLookup> {
  if (!token) return { ok: false, reason: 'not_found' }
  const supabase = db()

  const { data, error } = await supabase
    .from('setup_tokens')
    .select('user_id, email, full_name, expires_at, used_at, superseded_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return { ok: false, reason: 'not_found' }
  if (data.used_at) return { ok: false, reason: 'used' }
  if (data.superseded_at) return { ok: false, reason: 'superseded' }
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    userId: data.user_id,
    email: data.email,
    fullName: data.full_name,
  }
}

/**
 * The newest live (unused, unsuperseded, unexpired) token for `userId`, or
 * null. The self-service resend re-sends this link when one exists rather
 * than minting — so a stranger submitting a member's email keeps re-mailing
 * the SAME link instead of invalidating the one already in the member's inbox.
 */
export async function getLiveSetupToken(
  userId: string,
): Promise<{ token: string; expiresAt: string } | null> {
  const supabase = db()
  const { data } = await supabase
    .from('setup_tokens')
    .select('token, expires_at')
    .eq('user_id', userId)
    .is('used_at', null)
    .is('superseded_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { token: data.token, expiresAt: data.expires_at }
}

/**
 * Atomically consume the token. Returns true when THIS call consumed it;
 * false when it was already used (or superseded/missing), so two concurrent
 * /complete submissions resolve to exactly one winner.
 */
export async function markSetupTokenUsed(token: string): Promise<boolean> {
  const supabase = db()
  const { data } = await supabase
    .from('setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .is('superseded_at', null)
    .select('token')
  return (data?.length ?? 0) > 0
}
