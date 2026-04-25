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
import { inputValueToJourneyIso, journeyDateToInputValue } from '@/lib/journeyDates'

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

// ── Financial commitment provisioning ────────────────────────
//
// Mirrors the insert in app/api/approve-member/route.ts (the
// Leads → Approve flow) so members scheduled directly from the
// Journey Scheduling tab also get a draft commitment row. Without
// it, the dark "Active Commitment" panel on the member profile
// is hidden and we can't generate Stripe payment links.
//
// Idempotent on (member_id, journey_id) — safe to call from
// createJourney(), reschedule paths, and any future entry point.
// Non-blocking: a failed insert is logged but does not abort the
// journey mutation, matching approve-member's behavior.

async function ensureFinancialCommitment(
  supabase: any,
  memberId: string,
  journeyId: string,
) {
  const { data: existing } = await supabase
    .from('financial_commitments')
    .select('id')
    .eq('member_id', memberId)
    .eq('journey_id', journeyId)
    .limit(1)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase
    .from('financial_commitments')
    .insert({
      member_id:             memberId,
      journey_id:            journeyId,
      kind:                  'journey_contribution',
      expected_amount_cents: 0,
      status:                'draft',
    })

  if (error) {
    console.error(
      '[journeys.ensureFinancialCommitment] insert failed (non-blocking):',
      error.message,
    )
  }
}

// ── Ceremony mirror sync ─────────────────────────────────────
//
// `journeys` is the canonical scheduling table, but two legacy
// surfaces still drive the founders dashboard:
//   • `members.ceremony_date`  → ceremony_schedule_view (filters
//     out members where this is NULL)
//   • `ceremony_records`       → /dashboard/ceremonies table
//
// Every journey mutation must keep both in sync, or scheduled
// members silently disappear from those views.

async function syncMemberCeremonyDate(supabase: any, memberId: string) {
  const { data: latest } = await supabase
    .from('journeys')
    .select('start_at')
    .eq('member_id', memberId)
    .eq('status', 'scheduled')
    .not('start_at', 'is', null)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const dateOnly = latest?.start_at ? journeyDateToInputValue(latest.start_at) : null
  await supabase
    .from('members')
    .update({ ceremony_date: dateOnly || null })
    .eq('id', memberId)
}

async function syncJourneyCeremonyRecord(
  supabase: any,
  journeyId: string,
  memberId: string,
  status: JourneyStatus,
  startAtIso: string | null,
) {
  if (status === 'scheduled' && startAtIso) {
    const dateOnly = journeyDateToInputValue(startAtIso)
    const { data: existing } = await supabase
      .from('ceremony_records')
      .select('id')
      .eq('journey_id', journeyId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('ceremony_records')
        .update({ ceremony_date: dateOnly, status: 'Scheduled' })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('ceremony_records')
        .insert({
          member_id:     memberId,
          journey_id:    journeyId,
          ceremony_date: dateOnly,
          status:        'Scheduled',
        })
    }
  } else if (status === 'canceled') {
    await supabase
      .from('ceremony_records')
      .update({ status: 'Canceled' })
      .eq('journey_id', journeyId)
  }
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

  await ensureFinancialCommitment(supabase, input.memberId, data.id)
  await syncJourneyCeremonyRecord(
    supabase, data.id, input.memberId, status,
    inputValueToJourneyIso(input.startDate ?? null),
  )
  await syncMemberCeremonyDate(supabase, input.memberId)

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

    await ensureFinancialCommitment(supabase, summary.member_id, data.id)
    await syncJourneyCeremonyRecord(supabase, data.id, summary.member_id, newStatus, startIso)
    await syncMemberCeremonyDate(supabase, summary.member_id)

    return { ok: true, data: { journeyId: data.id, action: 'updated' } }
  }

  // Cancel old, create new — history preserved
  const { error: cancelErr } = await supabase
    .from('journeys')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', journeyId)

  if (cancelErr) return { ok: false, error: `Failed to cancel old journey: ${cancelErr.message}` }

  await syncJourneyCeremonyRecord(supabase, journeyId, summary.member_id, 'canceled', null)

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

  const { data: jRow } = await supabase
    .from('journeys').select('member_id').eq('id', journeyId).single()

  const { error } = await supabase
    .from('journeys')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', journeyId)

  if (error) return { ok: false, error: error.message }

  if (jRow?.member_id) {
    await syncJourneyCeremonyRecord(supabase, journeyId, jRow.member_id, 'canceled', null)
    await syncMemberCeremonyDate(supabase, jRow.member_id)
  }

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

// ── Ceremony alignment audit + heal ──────────────────────────
//
// `journeys` is canonical, but `members.ceremony_date` and
// `ceremony_records.ceremony_date` are mirror tables that the
// founders dashboard reads. The sync helpers above run on every
// mutation — but if a sync ever fails (network blip, partial
// write, manual SQL edit), the three tables drift apart and the
// portal/dashboard show different things to the same member.
//
// auditCeremonyAlignment() finds drift; reconcileMemberAlignment()
// re-runs both sync helpers for a single member; reconcileAll()
// does the whole roster in one pass. All founder-only.
//
// Drift kinds:
//   member_date_mismatch — members.ceremony_date != latest scheduled journey date
//   record_missing       — a scheduled journey has no ceremony_records row
//   record_date_mismatch — ceremony_records.ceremony_date != journey start_at
//   record_status_mismatch — Canceled journey still shows Scheduled, etc.

export type DriftKind =
  | 'member_date_mismatch'
  | 'record_missing'
  | 'record_date_mismatch'
  | 'record_status_mismatch'

export interface DriftRow {
  memberId:        string
  memberName:      string | null
  memberEmail:     string | null
  journeyId:       string | null
  journeyStatus:   string | null
  kind:            DriftKind
  expected:        string | null   // YYYY-MM-DD or status string
  actual:          string | null
  detail:          string          // human-readable summary
}

export async function auditCeremonyAlignment(): Promise<
  ActionResult<{ drift: DriftRow[]; checkedMembers: number; checkedJourneys: number }>
> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const [{ data: members }, { data: journeys }, { data: records }] = await Promise.all([
    supabase.from('members').select('id, full_name, email, ceremony_date'),
    supabase.from('journeys').select('id, member_id, status, start_at'),
    supabase.from('ceremony_records').select('id, journey_id, member_id, ceremony_date, status'),
  ])

  const drift: DriftRow[] = []
  const memberById = new Map<string, any>()
  for (const m of members ?? []) memberById.set(m.id, m)

  // Index journeys by member
  const journeysByMember = new Map<string, any[]>()
  for (const j of journeys ?? []) {
    const arr = journeysByMember.get(j.member_id) ?? []
    arr.push(j)
    journeysByMember.set(j.member_id, arr)
  }

  // Index ceremony_records by journey_id
  const recordByJourney = new Map<string, any>()
  for (const r of records ?? []) {
    if (r.journey_id) recordByJourney.set(r.journey_id, r)
  }

  // ── Check member.ceremony_date matches latest scheduled journey ──
  for (const m of members ?? []) {
    const myJourneys = journeysByMember.get(m.id) ?? []
    const scheduled = myJourneys
      .filter((j) => j.status === 'scheduled' && j.start_at)
      .sort((a, b) => (b.start_at > a.start_at ? 1 : -1))
    const latest = scheduled[0] ?? null
    const expected = latest ? journeyDateToInputValue(latest.start_at) : null
    const actual = m.ceremony_date ?? null

    if ((expected ?? null) !== (actual ?? null)) {
      drift.push({
        memberId:      m.id,
        memberName:    m.full_name ?? null,
        memberEmail:   m.email ?? null,
        journeyId:     latest?.id ?? null,
        journeyStatus: latest?.status ?? null,
        kind:          'member_date_mismatch',
        expected,
        actual,
        detail: `members.ceremony_date should be ${expected ?? 'NULL'} (from latest scheduled journey) but is ${actual ?? 'NULL'}`,
      })
    }
  }

  // ── Check ceremony_records vs journeys ──
  for (const j of journeys ?? []) {
    const m = memberById.get(j.member_id)
    const rec = recordByJourney.get(j.id)

    if (j.status === 'scheduled' && j.start_at) {
      const expectedDate = journeyDateToInputValue(j.start_at)

      if (!rec) {
        drift.push({
          memberId:      j.member_id,
          memberName:    m?.full_name ?? null,
          memberEmail:   m?.email ?? null,
          journeyId:     j.id,
          journeyStatus: j.status,
          kind:          'record_missing',
          expected:      expectedDate,
          actual:        null,
          detail: `Scheduled journey on ${expectedDate} has no ceremony_records row`,
        })
        continue
      }

      if (rec.ceremony_date !== expectedDate) {
        drift.push({
          memberId:      j.member_id,
          memberName:    m?.full_name ?? null,
          memberEmail:   m?.email ?? null,
          journeyId:     j.id,
          journeyStatus: j.status,
          kind:          'record_date_mismatch',
          expected:      expectedDate,
          actual:        rec.ceremony_date,
          detail: `ceremony_records.ceremony_date is ${rec.ceremony_date} but journey says ${expectedDate}`,
        })
      }

      if (rec.status !== 'Scheduled' && rec.status !== 'Complete') {
        drift.push({
          memberId:      j.member_id,
          memberName:    m?.full_name ?? null,
          memberEmail:   m?.email ?? null,
          journeyId:     j.id,
          journeyStatus: j.status,
          kind:          'record_status_mismatch',
          expected:      'Scheduled',
          actual:        rec.status,
          detail: `Journey is scheduled but ceremony_records.status is ${rec.status}`,
        })
      }
    } else if (j.status === 'canceled' && rec && rec.status !== 'Canceled') {
      drift.push({
        memberId:      j.member_id,
        memberName:    m?.full_name ?? null,
        memberEmail:   m?.email ?? null,
        journeyId:     j.id,
        journeyStatus: j.status,
        kind:          'record_status_mismatch',
        expected:      'Canceled',
        actual:        rec.status,
        detail: `Journey is canceled but ceremony_records.status is ${rec.status}`,
      })
    }
  }

  return {
    ok: true,
    data: {
      drift,
      checkedMembers:  (members ?? []).length,
      checkedJourneys: (journeys ?? []).length,
    },
  }
}

/**
 * reconcileMemberAlignment
 * Re-runs both sync helpers for a single member, bringing
 * ceremony_records and members.ceremony_date back in line with
 * the canonical journeys table.
 */
export async function reconcileMemberAlignment(
  memberId: string
): Promise<ActionResult<{ healed: number }>> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const { data: js } = await supabase
    .from('journeys')
    .select('id, status, start_at')
    .eq('member_id', memberId)

  let healed = 0
  for (const j of js ?? []) {
    await syncJourneyCeremonyRecord(supabase, j.id, memberId, j.status, j.start_at)
    healed += 1
  }
  await syncMemberCeremonyDate(supabase, memberId)

  return { ok: true, data: { healed } }
}

/**
 * reconcileAllAlignment
 * Walks every member with at least one journey and reconciles.
 * Use sparingly — full table sweep.
 */
export async function reconcileAllAlignment(): Promise<
  ActionResult<{ membersHealed: number; journeysSynced: number }>
> {
  const { supabase, error: authErr } = await getFounderClient()
  if (!supabase) return { ok: false, error: authErr! }

  const { data: js } = await supabase
    .from('journeys')
    .select('id, member_id, status, start_at')

  const byMember = new Map<string, any[]>()
  for (const j of js ?? []) {
    const arr = byMember.get(j.member_id) ?? []
    arr.push(j)
    byMember.set(j.member_id, arr)
  }

  let journeysSynced = 0
  for (const [memberId, list] of byMember) {
    for (const j of list) {
      await syncJourneyCeremonyRecord(supabase, j.id, memberId, j.status, j.start_at)
      journeysSynced += 1
    }
    await syncMemberCeremonyDate(supabase, memberId)
  }

  return {
    ok: true,
    data: { membersHealed: byMember.size, journeysSynced },
  }
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
  const { error: expireErr } = await supabase
    .from('scheduling_requests')
    .update({ status: 'expired' })
    .eq('member_id', user.id)
    .eq('status', 'pending')

  if (expireErr) return { ok: false, error: `Failed to expire prior requests: ${expireErr.message}` }

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
