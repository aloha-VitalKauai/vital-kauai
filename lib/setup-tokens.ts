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
 * Mint a fresh setup token for `userId`. Any existing unused tokens for the
 * same user are marked used so only the most recent link is live.
 */
export async function createSetupToken(args: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const { userId, email, fullName } = args
  const supabase = db()

  await supabase
    .from('setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

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
  | { ok: false; reason: 'not_found' | 'used' | 'expired' }

export async function lookupSetupToken(token: string): Promise<SetupTokenLookup> {
  if (!token) return { ok: false, reason: 'not_found' }
  const supabase = db()

  const { data, error } = await supabase
    .from('setup_tokens')
    .select('user_id, email, full_name, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return { ok: false, reason: 'not_found' }
  if (data.used_at) return { ok: false, reason: 'used' }
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    userId: data.user_id,
    email: data.email,
    fullName: data.full_name,
  }
}

export async function markSetupTokenUsed(token: string): Promise<void> {
  const supabase = db()
  await supabase
    .from('setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
}
