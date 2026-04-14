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
