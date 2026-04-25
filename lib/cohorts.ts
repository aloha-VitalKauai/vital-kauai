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

function combineTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? ''
  const split = titles.map(t => t.split(/\s+/))
  const minLen = Math.min(...split.map(s => s.length))
  let commonSuffix = 0
  for (let i = 1; i <= minLen; i++) {
    const word = split[0][split[0].length - i].toLowerCase()
    if (split.every(s => s[s.length - i].toLowerCase() === word)) commonSuffix = i
    else break
  }
  if (commonSuffix === 0) return titles.join(' / ')
  const suffixWords = split[0].slice(split[0].length - commonSuffix)
  const prefixes = split.map(s => s.slice(0, s.length - commonSuffix).join(' ')).filter(Boolean)
  const last = suffixWords[suffixWords.length - 1]
  const pluralized = /s$/i.test(last) ? last : last + 's'
  const suffixPart = [...suffixWords.slice(0, -1), pluralized].join(' ')
  return prefixes.length ? `${prefixes.join(' / ')} ${suffixPart}` : suffixPart
}

/**
 * Merges cohorts that share the same start/end dates into a single display row
 * (e.g. a Men's + Women's journey on the same week become one card titled
 * "Men's / Women's Iboga Journeys"). Capacity and assigned_count are summed.
 * Use for public card rendering only — the scheduling form should stay ungrouped.
 */
export function groupCohortsByDate(cohorts: PublicCohort[]): PublicCohort[] {
  const groups = new Map<string, PublicCohort[]>()
  for (const c of cohorts) {
    const key = `${c.start_at}|${c.end_at ?? ''}`
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  const out: PublicCohort[] = []
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue }
    const totalCap = group.reduce((n, g) => n + (g.capacity ?? 0), 0)
    out.push({
      id: group.map(g => g.id).join(','),
      title: combineTitles(group.map(g => g.title)),
      start_at: group[0].start_at,
      end_at: group[0].end_at,
      capacity: totalCap > 0 ? totalCap : null,
      assigned_count: group.reduce((n, g) => n + (g.assigned_count ?? 0), 0),
    })
  }
  out.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  return out
}

/**
 * Cohorts to display as 'Full' publicly regardless of assigned_count.
 * Keyed by the UTC YYYY-MM-DD of start_at. Use when a ceremony is closed to
 * new bookings but names haven't been entered in the backend yet.
 */
const FORCED_FULL_START_DATES = new Set<string>([
  '2026-06-21', // Jun 21–27, 2026 · Hanalei
  '2026-07-05', // Jul 5–11, 2026 · Hanalei
])

function utcDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns a short 'X spots left' phrase when only 3 or fewer remain, else null. */
export function spotsLeftLabel(cohort: PublicCohort): string | null {
  if (FORCED_FULL_START_DATES.has(utcDateKey(cohort.start_at))) return 'Full'
  if (cohort.capacity == null) return null
  const assigned = cohort.assigned_count ?? 0
  const left = cohort.capacity - assigned
  if (left <= 0) return 'Full'
  if (left > 3) return null
  return left === 1 ? '1 spot left' : `${left} spots left`
}

/** True if the cohort is publicly displayed as Full (forced or sold out). */
export function isCohortFull(cohort: PublicCohort): boolean {
  return spotsLeftLabel(cohort) === 'Full'
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
