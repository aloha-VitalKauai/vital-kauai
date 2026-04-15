/**
 * journeyDates.ts
 * ─────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all journey date logic.
 *
 * Rules:
 *   DB stores → UTC (timestamptz)
 *   Display   → Pacific/Honolulu
 *   All countdown + formatting uses only these helpers
 *
 * Do not write date math anywhere else.
 * Drop in: lib/journeyDates.ts
 * ─────────────────────────────────────────────────────────────
 */

const HI_TZ = 'Pacific/Honolulu'

// ── Core parsing ─────────────────────────────────────────────

/**
 * parseJourneyDate
 * Takes an ISO UTC string from the DB and returns the wall-clock
 * Date object as it would appear in Hawaii.
 */
export function parseJourneyDate(isoUtc: string): Date {
  // We create a new Date that represents the Hawaii local time
  // by converting via toLocaleString and re-parsing.
  const localStr = new Date(isoUtc).toLocaleString('en-US', { timeZone: HI_TZ })
  return new Date(localStr)
}

/**
 * journeyDateToInputValue
 * Converts an ISO UTC start_at to a YYYY-MM-DD string suitable for
 * an <input type="date"> in Hawaii time.
 */
export function journeyDateToInputValue(isoUtc: string | null): string {
  if (!isoUtc) return ''
  const d = parseJourneyDate(isoUtc)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * inputValueToJourneyIso
 * Converts a YYYY-MM-DD date input value to an ISO UTC string,
 * treating the input as noon Hawaii time (avoids off-by-one day bugs).
 */
export function inputValueToJourneyIso(dateStr: string): string | null {
  if (!dateStr) return null
  // noon Hawaii = UTC+10 offset, so noon HI = 22:00 UTC same day
  // Using a fixed ISO string avoids DST edge cases
  return `${dateStr}T22:00:00.000Z` // noon Hawaii = 22:00 UTC
}

// ── Formatting ────────────────────────────────────────────────

/**
 * formatJourneyDate
 * The canonical display formatter for portal cards and pages.
 *
 *   single_date  → "May 9, 2026"
 *   date_range, same month → "May 9–12, 2026"
 *   date_range, cross month → "May 30 – June 2, 2026"
 *   tbd / null → "Date TBD"
 */
export function formatJourneyDate(
  scheduleType: 'single_date' | 'date_range' | 'tbd',
  startAt: string | null,
  endAt: string | null = null
): string {
  if (scheduleType === 'tbd' || !startAt) return 'Date TBD'

  const start = parseJourneyDate(startAt)

  if (scheduleType === 'single_date') {
    return _fmtFull(start)
  }

  if (scheduleType === 'date_range' && endAt) {
    const end = parseJourneyDate(endAt)
    if (
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      // "May 9–12, 2026"
      return `${_monthName(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    }
    // "May 30 – June 2, 2026"
    return `${_monthName(start)} ${start.getDate()} – ${_monthName(end)} ${end.getDate()}, ${end.getFullYear()}`
  }

  return 'Date TBD'
}

// ── Countdown ─────────────────────────────────────────────────

/**
 * getDaysUntilJourney
 * Returns the number of whole days from now until journey.start_at.
 * Returns null if no start_at, or if the date is in the past.
 *
 * Uses ceiling so "tomorrow" always shows 1, not 0.
 */
export function getDaysUntilJourney(startAt: string | null): number | null {
  if (!startAt) return null
  const diffMs = new Date(startAt).getTime() - Date.now()
  if (diffMs <= 0) return null
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * isJourneyInFuture
 * True if start_at exists and is strictly in the future.
 */
export function isJourneyInFuture(startAt: string | null): boolean {
  if (!startAt) return false
  return new Date(startAt).getTime() > Date.now()
}

// ── Private helpers ───────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function _monthName(d: Date): string {
  return MONTHS[d.getMonth()]
}

function _fmtFull(d: Date): string {
  return `${_monthName(d)} ${d.getDate()}, ${d.getFullYear()}`
}
