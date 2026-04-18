'use server'

/**
 * app/actions/journeys.ts  — CANONICAL MUTATION LAYER
 * ─────────────────────────────────────────────────────────────
 * ALL writes to `journeys` and `scheduling_requests` go here.
 * No client component may import Supabase and write these tables directly.
 *
 * Exports:
 *   Journey mutations (founder-only):
 *     createJourney()
 *     rescheduleJourney()
 *     cancelJourney()
 *     approveJourney()
 *
 *   Scheduling request mutations:
 *     submitSchedulingRequest()   ← member calls this
 *     resolveSchedulingRequest()  ← founder calls this (assigns a date)
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@/lib/supabase/server'
import { inputValueToJourneyIso } from '@/lib/journeyDates'

// ── Types ─────────────────────────────────────────────────────

export type BookingType   = 'cohort' | 'private'
export type ScheduleType  = 'single_date' | 'date_range' | 'tbd'
export type JourneyStatus = 'approved' | 'scheduling' | 'scheduled' | 'in_progress' | 'completed' | 'canceled'

export interface CreateJourneyInput {
  memberId:     string
  bookingType:  BookingType
  scheduleType: ScheduleType
  startDate?:   string | null   // YYYY-MM-DD Hawaii time
  endDate?:     string | null
  cohortId?:    string | null
  notes?:       string | null
}

export interface ActionResult<T = void> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Auth helpers ──────────────────────────────────────────────

async function getClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase: null, user: null, error: 'Not authenticated' }
  return { supabase, user, error: null }
}

async function getFounderClient() {
  const { supabase, user, error } = await getClient()
  if (!supabase || !user) return { supabase: null, error }

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (role?.role !== 'founder') return { supabase: null, error: 'Founder access required' }
  return { supabase, error: null }
}

// ── Input validation ──────────────────────────────────────────

function validateJourneyInput(input: CreateJourneyInput): string | null {
  if (!input.memberId)
    return 'memberId is required'
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

// ── Journey mutations (founder-only) ─────────────────────────

export async function createJourney(
  input: CreateJourneyInput
): Promise<ActionResult<{ journeyId: string }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const validErr = validateJourneyInput(input)
  if (validErr) return { ok: false, error: validErr }

  const status: JourneyStatus =
    input.scheduleType === 'tbd' ? 'scheduling' : 'scheduled'

  const { data, error } = await supabase
    .from('journeys')
    .insert({
      member_id:     input.memberId,
      booking_type:  input.bookingType,
      status,
      schedule_type: input.scheduleType,
      start_at:      inputValueToJourneyIso(input.startDate ?? null),
      end_at:        inputValueToJourneyIso(input.endDate   ?? null),
      cohort_id:     input.cohortId ?? null,
      notes:         input.notes    ?? null,
      approved_at:   new Date().toISOString(),
      scheduled_at:  input.scheduleType !== 'tbd' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { journeyId: data.id } }
}

export async function rescheduleJourney(
  journeyId: string,
  input: Pick<CreateJourneyInput, 'scheduleType' | 'startDate' | 'endDate' | 'cohortId' | 'notes'>
): Promise<ActionResult<{ journeyId: string; action: 'updated' | 'created_new' }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

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
        notes:         input.notes    ?? null,
        scheduled_at:  input.scheduleType !== 'tbd' ? new Date().toISOString() : null,
      })
      .eq('id', journeyId)
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { journeyId: data.id, action: 'updated' } }
  }

  // Cancel old, create new — history preserved
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

export async function cancelJourney(journeyId: string): Promise<ActionResult> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const { data: j } = await supabase
    .from('journeys').select('id, status').eq('id', journeyId).single()

  if (!j) return { ok: false, error: 'Journey not found' }
  if (['in_progress','completed','canceled'].includes(j.status))
    return { ok: false, error: `Cannot cancel a journey with status: ${j.status}` }

  const { error } = await supabase
    .from('journeys')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', journeyId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function approveJourney(
  memberId: string,
  bookingType: BookingType = 'private'
): Promise<ActionResult<{ journeyId: string }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  // Idempotent — return existing if already active
  const { data: existing } = await supabase
    .from('journeys').select('id, status')
    .eq('member_id', memberId)
    .not('status', 'in', '("canceled","completed")')
    .limit(1).maybeSingle()

  if (existing) return { ok: true, data: { journeyId: existing.id } }

  return createJourney({ memberId, bookingType, scheduleType: 'tbd' })
}

// ── Scheduling request mutations ──────────────────────────────

export interface SchedulingRequestInput {
  earliestDate:   string        // YYYY-MM-DD
  latestDate:     string        // YYYY-MM-DD
  excludedRanges?: Array<{      // optional blackout windows
    from: string                // YYYY-MM-DD
    to:   string                // YYYY-MM-DD
    reason?: string
  }>
  notes?: string | null
  preferredCohortId?: string | null  // null = no preference / private ceremony
}

/**
 * submitSchedulingRequest
 * Called by the member from the portal journey card.
 * Creates a scheduling_request row and updates the active journey to 'scheduling'.
 */
export async function submitSchedulingRequest(
  input: SchedulingRequestInput
): Promise<ActionResult<{ requestId: string }>> {
  const { supabase, user, error: authErr } = await getClient()
  if (!supabase || !user) return { ok: false, error: authErr! }

  // Validate dates
  if (!input.earliestDate || !input.latestDate)
    return { ok: false, error: 'Both earliest and latest dates are required' }
  if (input.latestDate < input.earliestDate)
    return { ok: false, error: 'Latest date must be on or after earliest date' }

  // Get active journey for this member
  const { data: journey } = await supabase
    .from('journeys').select('id, status')
    .eq('member_id', user.id)
    .not('status', 'in', '("canceled","completed")')
    .limit(1).maybeSingle()

  // Expire any existing pending requests from this member
  await supabase
    .from('scheduling_requests')
    .update({ status: 'expired' })
    .eq('member_id', user.id)
    .eq('status', 'pending')

  // Insert new request
  const { data, error } = await supabase
    .from('scheduling_requests')
    .insert({
      member_id:           user.id,
      journey_id:          journey?.id ?? null,
      earliest_date:       input.earliestDate,
      latest_date:         input.latestDate,
      excluded_ranges:     input.excludedRanges ?? [],
      notes:               input.notes ?? null,
      preferred_cohort_id: input.preferredCohortId ?? null,
      status:              'pending',
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  // Update journey to 'scheduling' if it's still at 'approved'
  if (journey?.status === 'approved') {
    await supabase
      .from('journeys')
      .update({ status: 'scheduling' })
      .eq('id', journey.id)
  }

  return { ok: true, data: { requestId: data.id } }
}

/**
 * resolveSchedulingRequest
 * Called by founder after reviewing availability.
 * Assigns a date, marks request as scheduled, creates/updates the journey.
 */
export async function resolveSchedulingRequest(
  requestId: string,
  assignedDate: string,           // YYYY-MM-DD
  scheduleType: ScheduleType = 'single_date',
  endDate?: string | null
): Promise<ActionResult<{ journeyId: string }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  // Load the request
  const { data: req, error: reqErr } = await supabase
    .from('scheduling_requests')
    .select('id, member_id, journey_id, status')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return { ok: false, error: 'Request not found' }
  if (req.status === 'scheduled')
    return { ok: false, error: 'Request already resolved' }

  let journeyId = req.journey_id

  if (journeyId) {
    // Reschedule the existing journey
    const result = await rescheduleJourney(journeyId, {
      scheduleType,
      startDate: assignedDate,
      endDate:   endDate ?? null,
    })
    if (!result.ok) return { ok: false, error: result.error }
    journeyId = result.data!.journeyId
  } else {
    // Create a new journey for this member
    const result = await createJourney({
      memberId:     req.member_id,
      bookingType:  'private',
      scheduleType,
      startDate:    assignedDate,
      endDate:      endDate ?? null,
    })
    if (!result.ok) return { ok: false, error: result.error }
    journeyId = result.data!.journeyId
  }

  // Mark request as scheduled
  await supabase
    .from('scheduling_requests')
    .update({
      status:      'scheduled',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  return { ok: true, data: { journeyId } }
}
