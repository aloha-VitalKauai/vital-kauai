import type { SupabaseClient } from '@supabase/supabase-js'

export type PublicCohort = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  capacity: number | null
}

export async function fetchPublicCohorts(
  supabase: SupabaseClient,
): Promise<PublicCohort[]> {
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from('cohorts')
    .select('id, title, start_at, end_at, capacity')
    .eq('status', 'scheduled')
    .eq('is_public', true)
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true })
  return (data as PublicCohort[] | null) ?? []
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
