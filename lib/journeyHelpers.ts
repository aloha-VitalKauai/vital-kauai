/**
 * lib/journeyHelpers.ts  (hardening pass — replaces v1)
 * ─────────────────────────────────────────────────────────────
 * Types, queries, and display state for the journeys system.
 *
 * Date logic → lib/journeyDates.ts  (never duplicated here)
 * Display logic → getJourneyDisplayStatus()  (single source)
 * UI components only render what this file returns.
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@/lib/supabase/client'
import {
  formatJourneyDate,
  getDaysUntilJourney,
  isJourneyInFuture,
} from '@/lib/journeyDates'

export { formatJourneyDate, getDaysUntilJourney, isJourneyInFuture }

// ── Types ─────────────────────────────────────────────────────

export type BookingType   = 'cohort' | 'private'
export type JourneyStatus = 'approved' | 'scheduling' | 'scheduled' | 'in_progress' | 'completed' | 'canceled'
export type ScheduleType  = 'single_date' | 'date_range' | 'tbd'

export interface Journey {
  id:            string
  member_id:     string
  booking_type:  BookingType
  status:        JourneyStatus
  schedule_type: ScheduleType
  start_at:      string | null
  end_at:        string | null
  cohort_id:     string | null
  location_id:   string | null
  approved_at:   string | null
  scheduled_at:  string | null
  canceled_at:   string | null
  notes:         string | null
  created_at:    string
  updated_at:    string
  cohort?: { id: string; title: string; start_at: string; end_at: string | null } | null
}

export interface JourneyDisplayState {
  title:         string
  displayDate:   string
  subtitle:      string
  showCountdown: boolean
  daysUntil:     number | null
  bookingLabel:  string
  hasJourney:    boolean
}

// ── Queries ───────────────────────────────────────────────────

export async function getActiveJourney(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string
): Promise<Journey | null> {
  const { data, error } = await supabase
    .from('journeys')
    .select(`*, cohort:cohorts (id, title, start_at, end_at)`)
    .eq('member_id', memberId)
    .not('status', 'in', '("canceled","completed")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) { console.error('[getActiveJourney]', error.message); return null }
  return data as Journey | null
}

export async function getActiveJourneyForCurrentUser(): Promise<Journey | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) return null
  return getActiveJourney(supabase, session.user.id)
}

// ── Display state — single source of truth ────────────────────

export function getJourneyDisplayStatus(journey: Journey | null): JourneyDisplayState {
  if (!journey) return {
    title: 'No Journey Scheduled', displayDate: '', hasJourney: false,
    subtitle: 'Your ceremony date will appear here once scheduling begins.',
    showCountdown: false, daysUntil: null, bookingLabel: '',
  }

  const { booking_type, status, schedule_type, start_at, end_at, cohort } = journey

  const bookingLabel = booking_type === 'private' ? 'Private Journey' : (cohort?.title ?? 'Group Journey')
  const title        = booking_type === 'private' ? 'Private Journey' : (cohort?.title ?? 'Your Journey')
  const displayDate  = formatJourneyDate(schedule_type, start_at, end_at)
  const daysUntil    = getDaysUntilJourney(start_at)
  const showCountdown = daysUntil !== null && daysUntil > 0 &&
    (status === 'scheduled' || status === 'in_progress')

  let subtitle = ''
  if (status === 'canceled')    subtitle = 'Journey canceled'
  else if (status === 'completed')   subtitle = 'Journey complete'
  else if (status === 'in_progress') subtitle = 'Your journey is underway'
  else if ((status === 'approved' || status === 'scheduling') && schedule_type === 'tbd')
    subtitle = 'Scheduling in progress'
  else if (status === 'scheduled' && daysUntil !== null)
    subtitle = daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days away`
  else if (status === 'approved' || status === 'scheduling')
    subtitle = 'Awaiting confirmation'

  return { title, displayDate, subtitle, showCountdown, daysUntil, bookingLabel, hasJourney: true }
}
