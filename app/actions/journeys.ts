'use server'

/**
 * app/actions/journeys.ts
 * ─────────────────────────────────────────────────────────────
 * SERVER MUTATION BOUNDARY — all writes to `journeys` go here.
 *
 * Rules:
 *   • Client components NEVER write to journeys directly
 *   • All mutations go through these server actions
 *   • Ceremony sync is enforced by DB trigger (trg_sync_journey_to_ceremony)
 *   • These actions run server-side only — never imported by client code
 *
 * Drop in: app/actions/journeys.ts
 * ─────────────────────────────────────────────────────────────
 */

import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { inputValueToJourneyIso } from '@/lib/journeyDates'

// ── Types ────────────────────────────────────────────────────

export type BookingType   = 'cohort' | 'private'
export type ScheduleType  = 'single_date' | 'date_range' | 'tbd'
export type JourneyStatus = 'approved' | 'scheduling' | 'scheduled' | 'in_progress' | 'completed' | 'canceled'

export interface CreateJourneyInput {
  memberId:     string       // member_profiles.id (= auth.users.id)
  bookingType:  BookingType
  scheduleType: ScheduleType
  startDate?:   string | null  // YYYY-MM-DD in Hawaii time
  endDate?:     string | null  // YYYY-MM-DD in Hawaii time
  cohortId?:    string | null
  notes?:       string | null
}

export interface ActionResult<T = void> {
  ok:    boolean
  data?: T
  error?: string
}

// ── Auth helper ───────────────────────────────────────────────

async function getFounderClient() {
  const supabase = createServerActionClient({ cookies })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase: null, error: 'Not authenticated' }

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (role?.role !== 'founder') return { supabase: null, error: 'Founder access required' }
  return { supabase, error: null }
}

// ── Validation ────────────────────────────────────────────────

function validateInput(input: CreateJourneyInput): string | null {
  if (!input.memberId) return 'memberId is required'
  if (input.bookingType === 'private' && input.cohortId)
    return 'Private bookings cannot have a cohort'
  if (input.bookingType === 'cohort' && !input.cohortId)
    return 'Cohort bookings require a cohortId'
  if (input.scheduleType === 'single_date' && !input.startDate)
    return 'single_date requires a start date'
  if (input.scheduleType === 'date_range' && (!input.startDate || !input.endDate))
    return 'date_range requires both start and end dates'
  if (input.startDate && input.endDate && input.endDate <= input.startDate)
    return 'End date must be after start date'
  return null
}

// ── createJourney ─────────────────────────────────────────────

/**
 * createJourney
 * Creates a new journey for a member. Founder-only.
 * Ceremony sync fires automatically via DB trigger.
 */
export async function createJourney(
  input: CreateJourneyInput
): Promise<ActionResult<{ journeyId: string }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const validErr = validateInput(input)
  if (validErr) return { ok: false, error: validErr }

  const status: JourneyStatus =
    input.scheduleType === 'tbd' ? 'scheduling' : 'scheduled'

  const { data, error } = await supabase
    .from('journeys')
    .insert({
      member_id:    input.memberId,
      booking_type: input.bookingType,
      status,
      schedule_type: input.scheduleType,
      start_at:     inputValueToJourneyIso(input.startDate ?? null),
      end_at:       inputValueToJourneyIso(input.endDate   ?? null),
      cohort_id:    input.cohortId  ?? null,
      notes:        input.notes     ?? null,
      approved_at:  new Date().toISOString(),
      scheduled_at: input.scheduleType !== 'tbd' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { journeyId: data.id } }
}

// ── rescheduleJourney ─────────────────────────────────────────

/**
 * rescheduleJourney
 * Implements the history-preservation rule:
 *
 *   safe_to_update  → update in place (no finalized assessments, not started)
 *   create_new      → cancel old journey, create new one
 *
 * Ceremony sync fires automatically via DB trigger on the journey row.
 */
export async function rescheduleJourney(
  journeyId: string,
  input: Pick<CreateJourneyInput, 'scheduleType' | 'startDate' | 'endDate' | 'cohortId' | 'notes'>
): Promise<ActionResult<{ journeyId: string; action: 'updated' | 'created_new' }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  // Read current journey safety state
  const { data: summary, error: viewErr } = await supabase
    .from('journey_summary_view')
    .select('journey_id, member_id, booking_type, reschedule_action, status')
    .eq('journey_id', journeyId)
    .single()

  if (viewErr || !summary) return { ok: false, error: 'Journey not found' }

  const newStatus: JourneyStatus =
    input.scheduleType === 'tbd' ? 'scheduling' : 'scheduled'

  const startIso = inputValueToJourneyIso(input.startDate ?? null)
  const endIso   = inputValueToJourneyIso(input.endDate   ?? null)

  if (summary.reschedule_action === 'safe_to_update') {
    const { data, error } = await supabase
      .from('journeys')
      .update({
        schedule_type: input.scheduleType,
        start_at:      startIso,
        end_at:        endIso,
        cohort_id:     input.cohortId ?? null,
        status:        newStatus,
        notes:         input.notes ?? null,
        scheduled_at:  input.scheduleType !== 'tbd' ? new Date().toISOString() : null,
      })
      .eq('id', journeyId)
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { journeyId: data.id, action: 'updated' } }
  }

  // Cancel old, create new
  await supabase
    .from('journeys')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', journeyId)

  const result = await createJourney({
    memberId:     summary.member_id,
    bookingType:  summary.booking_type as BookingType,
    scheduleType: input.scheduleType,
    startDate:    input.startDate,
    endDate:      input.endDate,
    cohortId:     input.cohortId,
    notes:        input.notes,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: { journeyId: result.data!.journeyId, action: 'created_new' } }
}

// ── cancelJourney ─────────────────────────────────────────────

/**
 * cancelJourney
 * Cancels an active journey. Founder-only.
 * Refuses to cancel if the journey is in_progress or completed.
 */
export async function cancelJourney(
  journeyId: string
): Promise<ActionResult> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const { data: j } = await supabase
    .from('journeys')
    .select('id, status')
    .eq('id', journeyId)
    .single()

  if (!j) return { ok: false, error: 'Journey not found' }
  if (['in_progress', 'completed', 'canceled'].includes(j.status))
    return { ok: false, error: `Cannot cancel a journey in status: ${j.status}` }

  const { error } = await supabase
    .from('journeys')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', journeyId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── approveJourney (TBD → scheduling) ────────────────────────

/**
 * approveJourney
 * Marks a member as approved and awaiting scheduling.
 * Creates a TBD journey if one doesn't exist.
 */
export async function approveJourney(
  memberId: string,
  bookingType: BookingType = 'private'
): Promise<ActionResult<{ journeyId: string }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  // Check for existing active journey
  const { data: existing } = await supabase
    .from('journeys')
    .select('id, status')
    .eq('member_id', memberId)
    .not('status', 'in', '("canceled","completed")')
    .limit(1)
    .maybeSingle()

  if (existing) return { ok: true, data: { journeyId: existing.id } }

  return createJourney({
    memberId,
    bookingType,
    scheduleType: 'tbd',
  })
}
