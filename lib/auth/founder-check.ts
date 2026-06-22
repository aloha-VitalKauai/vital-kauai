import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const FOUNDER_IDS = [
  'd6e824e3-69ab-447c-b046-afecfe4b7028', // aloha@vitalkauai.com
  '268f721a-9c7c-4bb2-82b7-3c29178281b1', // joshuaperdue2@gmail.com
]

/**
 * Verifies the request is from an authenticated founder.
 * Returns the user if authorized, null otherwise.
 */
export async function verifyFounder(): Promise<{ id: string; email: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!FOUNDER_IDS.includes(user.id)) return null
  return { id: user.id, email: user.email || '' }
}

/**
 * Route-handler guard for founder-only API endpoints.
 *
 * Resolves the cookie-based Supabase session and returns the live client
 * alongside the user (so callers don't create a second client) when the caller
 * is a founder. Otherwise returns a discriminated failure with the HTTP status
 * the route should send: 401 when no session, 403 when authenticated but not a
 * founder.
 *
 * The founder allow-list here matches the DB-layer gate: both founder IDs also
 * carry role = 'founder' in user_roles, which is what the calendar tables' RLS
 * (public.is_founder()) checks — so queries made with `supabase` pass RLS.
 */
export type FounderApiContext =
  | { ok: true; supabase: SupabaseClient; user: { id: string; email: string } }
  | { ok: false; status: 401 | 403; error: string }

export async function requireFounder(): Promise<FounderApiContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }
  if (!FOUNDER_IDS.includes(user.id)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true, supabase, user: { id: user.id, email: user.email || '' } }
}
