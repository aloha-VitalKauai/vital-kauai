import type { SupabaseClient } from '@supabase/supabase-js'

export type PublicCohort = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  capacity: number | null
  assigned_count?: number
}

export async function fetchPublicCohorts(
  supabase: SupabaseClient,
): Promise<PublicCohort[]> {
  const { data, error } = await supabase.rpc('get_public_cohorts')
  if (error || !data) return []
  return data as PublicCohort[]
}

/** Returns a short 'X spots left' phrase when only 3 or fewer remain, else null. */
export function spotsLeftLabel(cohort: PublicCohort): string | null {
  if (cohort.capacity == null) return null
  const assigned = cohort.assigned_count ?? 0
  const left = cohort.capacity - assigned
  if (left <= 0) return 'Full'
  if (left > 3) return null
  return left === 1 ? '1 spot left' : `${left} spots left`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatCohortRange(start: string, end: string | null): string {
  const s = new Date(start)
  if (!end) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}, ${s.getUTCFullYear()}`
  }
  const e = new Date(end)
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear()
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth()
  if (sameMonth) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}\u2013${e.getUTCDate()}, ${s.getUTCFullYear()}`
  }
  if (sameYear) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()} \u2013 ${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${s.getUTCFullYear()}`
  }
  return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}, ${s.getUTCFullYear()} \u2013 ${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`
}
