import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Public-site switch for scheduled ceremony dates. While false, the marketing
 * pages (home, stay, iboga-journey, upcoming-ceremonies) skip the cohort
 * fetch and render their "TBA / Dates Coming" states, and the stay-page hero
 * keeps its plain "Hanalei, Kauaʻi" line. The member portal scheduling form
 * reads cohorts directly and stays live. Flip to true to show dates again.
 */
export const PUBLIC_CEREMONY_DATES_VISIBLE = true

/**
 * The founder-set public label for a ceremony. 'auto' derives it from
 * capacity; the rest are deliberate overrides. Mirrors the CHECK constraint on
 * cohorts.public_status.
 */
export type CohortPublicStatus = 'auto' | 'open' | 'filling' | 'full'

export type PublicCohort = {
  id: string
  title: string
  start_at: string
  end_at: string | null
  capacity: number | null
  assigned_count?: number
  /** Absent on a client that has not yet picked up the column; treated as 'auto'. */
  public_status?: CohortPublicStatus | string | null
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
 * The merged card shows one status for the week, so the most closed of the
 * group wins: a week with one journey full and one open is not open. Without
 * this the merged row would drop the override entirely and advertise the week
 * as open.
 */
function mergePublicStatus(group: PublicCohort[]): CohortPublicStatus {
  const statuses = group.map(g => g.public_status ?? 'auto')
  if (statuses.includes('full')) return 'full'
  if (statuses.includes('filling')) return 'filling'
  if (statuses.every(s => s === 'open')) return 'open'
  return 'auto'
}

/**
 * Merges cohorts that share the same start/end dates into a single display row
 * (e.g. a Men's + Women's journey on the same week become one card titled
 * "Men's / Women's Iboga Journeys"). Capacity and assigned_count are summed.
 * Use for public card rendering only—the scheduling form should stay ungrouped.
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
      public_status: mergePublicStatus(group),
    })
  }
  out.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  return out
}

/**
 * Public status label, from cohorts.public_status. Returns 'Full', 'Filling
 * Now', or null so the card shows 'Open'. We don't broadcast remaining spot
 * counts publicly.
 *
 * Selling out wins over an 'open' or 'filling' override: a ceremony at
 * capacity reads Full whatever the founder set, so a status left behind can
 * never advertise spots that do not exist. An unrecognised value — including
 * the column being absent, before the migration lands — falls back to 'auto'.
 */
export function spotsLeftLabel(cohort: PublicCohort): string | null {
  const status = cohort.public_status ?? 'auto'
  if (status === 'full') return 'Full'

  const assigned = cohort.assigned_count ?? 0
  const soldOut = cohort.capacity != null && cohort.capacity - assigned <= 0
  if (soldOut) return 'Full'

  if (status === 'filling') return 'Filling Now'
  return null
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
