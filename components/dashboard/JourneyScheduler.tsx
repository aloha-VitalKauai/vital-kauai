'use client'

/**
 * components/dashboard/JourneyScheduler.tsx  (hardening pass)
 * ─────────────────────────────────────────────────────────────
 * Founder panel to create and manage member journeys.
 *
 * RULES (enforced):
 *   • NO direct writes to Supabase — all mutations via server actions
 *   • NO ceremony_date usage — reads from journeys + cohorts only
 *   • NO email-based joins — member rows identified by profile_id
 *
 * Server actions imported from: app/actions/journeys.ts
 * Drop in: components/dashboard/JourneyScheduler.tsx
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback, useTransition } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { journeyDateToInputValue } from '@/lib/journeyDates'
import { createJourney, rescheduleJourney, cancelJourney } from '@/app/actions/journeys'
import type { BookingType, ScheduleType } from '@/app/actions/journeys'

// ── Types ─────────────────────────────────────────────────────

interface MemberRow {
  member_id:    string
  profile_id:   string | null  // null = no portal account yet
  full_name:    string
  email:        string
  pipeline_stage: string
}

interface CohortRow {
  id:       string
  title:    string
  start_at: string
  end_at:   string | null
  status:   string
  capacity: number | null
}

interface JourneySummaryRow {
  journey_id:               string
  member_id:                string   // = profile_id
  member_name:              string
  member_email:             string
  booking_type:             string
  status:                   string
  schedule_type:            string
  start_at:                 string | null
  end_at:                   string | null
  cohort_title:             string | null
  portal_display_date:      string
  portal_display_status:    string
  days_until_start:         number | null
  has_finalized_assessments: boolean
  reschedule_action:        string
}

// ── Helpers ───────────────────────────────────────────────────

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Pacific/Honolulu',
  })
}

// ── Status badge ─────────────────────────────────────────────

function JourneyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    approved:    { bg: '#F5F0E0', color: '#7A6535' },
    scheduling:  { bg: '#F5F0E0', color: '#7A6535' },
    scheduled:   { bg: '#E8F5EE', color: '#1D6A4A' },
    in_progress: { bg: '#D6F0E6', color: '#0E4A30' },
    completed:   { bg: '#EDF5EF', color: '#2D6040' },
    canceled:    { bg: '#F5E8E8', color: '#7A3535' },
  }
  const s = map[status] ?? { bg: '#F0F0EE', color: '#666' }
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99,
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>{status.replace('_', ' ')}</span>
  )
}

// ── Journey form ──────────────────────────────────────────────

interface JourneyFormProps {
  profileId:      string          // member_profiles.id
  cohorts:        CohortRow[]
  existing:       JourneySummaryRow | null
  onDone:         () => void
  onCancel:       () => void
}

function JourneyForm({ profileId, cohorts, existing, onDone, onCancel }: JourneyFormProps) {
  const [isPending, startTransition] = useTransition()

  const [bookingType,   setBookingType]   = useState<BookingType>(
    (existing?.booking_type as BookingType) ?? 'private'
  )
  const [scheduleType,  setScheduleType]  = useState<ScheduleType>(
    (existing?.schedule_type as ScheduleType) ?? 'tbd'
  )
  const [startDate,     setStartDate]     = useState(
    journeyDateToInputValue(existing?.start_at ?? null)
  )
  const [endDate,       setEndDate]       = useState(
    journeyDateToInputValue(existing?.end_at ?? null)
  )
  const [cohortId,      setCohortId]      = useState(() => {
    if (!existing?.cohort_title) return ''
    return cohorts.find(c => c.title === existing.cohort_title)?.id ?? ''
  })
  const [notes,         setNotes]         = useState('')
  const [err,           setErr]           = useState('')

  // Auto-fill dates from selected cohort
  useEffect(() => {
    if (bookingType !== 'cohort' || !cohortId) return
    const c = cohorts.find(c => c.id === cohortId)
    if (!c) return
    setStartDate(journeyDateToInputValue(c.start_at))
    setEndDate(journeyDateToInputValue(c.end_at))
    setScheduleType(c.end_at ? 'date_range' : 'single_date')
  }, [cohortId, bookingType, cohorts])

  function handleSubmit() {
    setErr('')
    startTransition(async () => {
      const input = {
        scheduleType,
        startDate: startDate || null,
        endDate:   endDate   || null,
        cohortId:  bookingType === 'cohort' ? cohortId || null : null,
        notes:     notes || null,
      }

      let result
      if (existing) {
        result = await rescheduleJourney(existing.journey_id, input)
      } else {
        result = await createJourney({ memberId: profileId, bookingType, ...input })
      }

      if (!result.ok) { setErr(result.error ?? 'Unknown error'); return }
      onDone()
    })
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6,
    fontSize: 13, background: '#FAFAF8', color: '#1A1A18',
    outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: '#888', marginBottom: 5, display: 'block',
  }
  const btn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
    border: active ? '1.5px solid #1A5C3A' : '1px solid rgba(0,0,0,0.12)',
    background: active ? '#E8F5EE' : '#FAFAF8',
    color: active ? '#1A5C3A' : '#6B6B67',
    fontSize: 12, fontWeight: active ? 600 : 400,
  })

  const rescheduling = !!existing
  const willCreateNew = existing?.reschedule_action === 'create_new_journey'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {willCreateNew && (
        <div style={{
          padding: '10px 14px', background: '#FFF8E8',
          border: '1px solid #E8C84A', borderRadius: 6,
          fontSize: 12, color: '#7A5A10', lineHeight: 1.6,
        }}>
          <strong>⚠ History preserved</strong> — this journey has finalized assessments.
          The existing journey will be canceled and a new one created. No data is lost.
        </div>
      )}

      {/* Booking type */}
      <div>
        <label style={lbl}>Booking Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['private', 'cohort'] as BookingType[]).map(t => (
            <button key={t} onClick={() => { setBookingType(t); if (t === 'private') setCohortId('') }}
              style={btn(bookingType === t)}>
              {t === 'private' ? '◆ Private' : '◈ Group Cohort'}
            </button>
          ))}
        </div>
      </div>

      {/* Cohort selector */}
      {bookingType === 'cohort' && (
        <div>
          <label style={lbl}>Cohort</label>
          <select value={cohortId} onChange={e => setCohortId(e.target.value)} style={inp}>
            <option value=''>Select a cohort…</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>
                {c.title} — {formatDateShort(c.start_at)}
                {c.capacity ? ` (cap: ${c.capacity})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Schedule type */}
      <div>
        <label style={lbl}>Schedule</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: 'tbd',         l: 'Date TBD'    },
            { v: 'single_date', l: 'Single Date'  },
            { v: 'date_range',  l: 'Date Range'   },
          ].map(o => (
            <button key={o.v} onClick={() => setScheduleType(o.v as ScheduleType)}
              style={btn(scheduleType === o.v)}>{o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      {scheduleType !== 'tbd' && (
        <div style={{ display: 'grid', gridTemplateColumns: scheduleType === 'date_range' ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div>
            <label style={lbl}>{scheduleType === 'date_range' ? 'Start Date' : 'Ceremony Date'}</label>
            <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
          </div>
          {scheduleType === 'date_range' && (
            <div>
              <label style={lbl}>End Date</label>
              <input type='date' value={endDate} min={startDate}
                onChange={e => setEndDate(e.target.value)} style={inp} />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label style={lbl}>Note to Member <span style={{ opacity: 0.5 }}>(optional)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder='Shown in the member portal card'
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
      </div>

      {err && <p style={{ fontSize: 12, color: '#C04040', margin: 0 }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: '#6B6B67', fontSize: 13,
        }}>Cancel</button>
        <button onClick={handleSubmit} disabled={isPending} style={{
          padding: '8px 20px', borderRadius: 6, border: 'none',
          background: isPending ? '#A0B0A8' : '#1A5C3A',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}>
          {isPending ? 'Saving…' : rescheduling ? 'Update Journey' : 'Schedule Journey'}
        </button>
      </div>
    </div>
  )
}

// ── Member row ────────────────────────────────────────────────

function MemberJourneyRow({
  member, journey, cohorts, onRefresh,
}: {
  member:    MemberRow
  journey:   JourneySummaryRow | null
  cohorts:   CohortRow[]
  onRefresh: () => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [canceling,   setCanceling]   = useState(false)
  const [isPending,   startTransition] = useTransition()

  const noPortalAccount = !member.profile_id

  function handleCancel() {
    if (!journey) return
    setCanceling(false)
    startTransition(async () => {
      const result = await cancelJourney(journey.journey_id)
      if (!result.ok) { alert(result.error); return }
      onRefresh()
    })
  }

  return (
    <div style={{
      border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8,
      overflow: 'hidden', background: '#fff',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
        alignItems: 'center', padding: '12px 16px', gap: 12,
      }}>
        {/* Member */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A18', margin: 0 }}>
            {member.full_name}
          </p>
          <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
            {member.email}
            {noPortalAccount && (
              <span style={{
                marginLeft: 6, padding: '1px 6px', borderRadius: 99,
                background: '#FFF3E0', color: '#A05A10', fontSize: 9, fontWeight: 600,
              }}>No portal invite</span>
            )}
          </p>
        </div>

        {/* Journey date — from journeys only, never ceremony_date */}
        <div>
          {journey ? (
            <>
              <p style={{
                fontSize: 13, margin: 0,
                color: journey.portal_display_date === 'Date TBD' ? '#A08040' : '#1A1A18',
                fontWeight: journey.portal_display_date === 'Date TBD' ? 400 : 500,
                fontStyle: journey.portal_display_date === 'Date TBD' ? 'italic' : 'normal',
              }}>
                {journey.portal_display_date}
              </p>
              <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>
                {journey.booking_type === 'private' ? '◆ Private' : `◈ ${journey.cohort_title ?? 'Cohort'}`}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#AAAAAA', fontStyle: 'italic', margin: 0 }}>
              No journey scheduled
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          {journey
            ? <JourneyStatusBadge status={journey.status} />
            : <span style={{ fontSize: 11, color: '#AAAAAA' }}>—</span>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          {journey && ['approved','scheduling','scheduled'].includes(journey.status) && (
            <button
              onClick={() => setCanceling(c => !c)}
              style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(200,80,80,0.3)', background: '#FFF5F5',
                color: '#A04040', fontSize: 11,
              }}
            >✕</button>
          )}
          <button
            onClick={() => { setExpanded(e => !e); setCanceling(false) }}
            disabled={noPortalAccount}
            title={noPortalAccount ? 'Invite member to portal first' : undefined}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: noPortalAccount ? 'not-allowed' : 'pointer',
              border: expanded ? '1.5px solid #1A5C3A' : '1px solid rgba(0,0,0,0.12)',
              background: expanded ? '#E8F5EE' : '#FAFAF8',
              color: noPortalAccount ? '#AAAAAA' : expanded ? '#1A5C3A' : '#4A4A48',
              fontSize: 12, fontWeight: 500,
            }}
          >
            {journey ? 'Edit ↓' : '+ Schedule'}
          </button>
        </div>
      </div>

      {/* Cancel confirmation */}
      {canceling && journey && (
        <div style={{
          padding: '10px 16px', borderTop: '0.5px solid rgba(200,80,80,0.2)',
          background: '#FFF8F8', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <p style={{ fontSize: 12, color: '#A04040', margin: 0, flex: 1 }}>
            Cancel this journey? This cannot be undone if assessments exist.
          </p>
          <button onClick={() => setCanceling(false)} style={{
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
            color: '#6B6B67', fontSize: 12,
          }}>Keep</button>
          <button onClick={handleCancel} disabled={isPending} style={{
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            border: 'none', background: '#C04040', color: '#fff', fontSize: 12,
          }}>
            {isPending ? 'Canceling…' : 'Cancel Journey'}
          </button>
        </div>
      )}

      {/* Expand form */}
      {expanded && member.profile_id && (
        <div style={{
          padding: 16, borderTop: '0.5px solid rgba(0,0,0,0.08)', background: '#F8F8F6',
        }}>
          <JourneyForm
            profileId={member.profile_id}
            cohorts={cohorts}
            existing={journey}
            onDone={() => { setExpanded(false); onRefresh() }}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function JourneyScheduler() {
  const supabase = createClientComponentClient()
  const [members,   setMembers]   = useState<MemberRow[]>([])
  const [journeys,  setJourneys]  = useState<JourneySummaryRow[]>([])
  const [cohorts,   setCohorts]   = useState<CohortRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'all' | 'unscheduled' | 'scheduled'>('all')
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, jRes, cRes] = await Promise.all([
      // Use profile_id — no ceremony_date dependency
      supabase
        .from('member_pipeline_view')
        .select('member_id, profile_id, full_name, email, pipeline_stage')
        .not('pipeline_stage', 'eq', 'onboarding')
        .order('full_name'),
      supabase.from('journey_summary_view').select('*'),
      supabase.from('cohorts').select('*').eq('status', 'scheduled').order('start_at'),
    ])

    setMembers((mRes.data ?? []).map((r: {
      member_id: string; profile_id: string | null;
      full_name: string; email: string; pipeline_stage: string;
    }) => ({
      member_id:      r.member_id,
      profile_id:     r.profile_id,
      full_name:      r.full_name,
      email:          r.email,
      pipeline_stage: r.pipeline_stage,
    })))
    setJourneys(jRes.data as JourneySummaryRow[] ?? [])
    setCohorts(cRes.data as CohortRow[] ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Journey map: profile_id → active journey
  const journeyByProfile = new Map(
    journeys
      .filter(j => !['canceled','completed'].includes(j.status))
      .map(j => [j.member_id, j])   // journey.member_id = profile_id
  )

  const filtered = members.filter(m => {
    const has = m.profile_id ? journeyByProfile.has(m.profile_id) : false
    if (filter === 'unscheduled' && has)  return false
    if (filter === 'scheduled'   && !has) return false
    if (search) {
      const q = search.toLowerCase()
      if (!m.full_name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const unscheduledCount = members.filter(m => !(m.profile_id && journeyByProfile.has(m.profile_id))).length
  const noAccountCount   = members.filter(m => !m.profile_id).length

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A18', margin: '0 0 4px' }}>
          Journey Scheduling
        </h2>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
          Assign ceremony dates to approved members.
          {unscheduledCount > 0 && (
            <span style={{
              marginLeft: 8, padding: '2px 8px', borderRadius: 99,
              background: '#FFF3E0', color: '#A05A10', fontSize: 11, fontWeight: 600,
            }}>{unscheduledCount} unscheduled</span>
          )}
          {noAccountCount > 0 && (
            <span style={{
              marginLeft: 6, padding: '2px 8px', borderRadius: 99,
              background: '#FFF0F0', color: '#A04040', fontSize: 11, fontWeight: 600,
            }}>{noAccountCount} need portal invite</span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type='text' placeholder='Search…' value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 12px', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6, fontSize: 13, width: 200, outline: 'none', background: '#FAFAF8',
          }} />
        {(['all', 'unscheduled', 'scheduled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            border: filter === f ? '1.5px solid #1A5C3A' : '1px solid rgba(0,0,0,0.12)',
            background: filter === f ? '#E8F5EE' : '#FAFAF8',
            color: filter === f ? '#1A5C3A' : '#6B6B67',
            fontSize: 12, fontWeight: filter === f ? 600 : 400, textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', padding: '0 16px 8px', gap: 12 }}>
        {['Member', 'Journey Date', 'Status', ''].map((h, i) => (
          <span key={i} style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#AAAAAA' }}>
            {h}
          </span>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#AAAAAA', fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#AAAAAA', fontSize: 13,
          border: '1px dashed rgba(0,0,0,0.1)', borderRadius: 8 }}>
          {search ? 'No members match.' : 'No members in this view.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(member => (
            <MemberJourneyRow
              key={member.member_id}
              member={member}
              journey={member.profile_id ? (journeyByProfile.get(member.profile_id) ?? null) : null}
              cohorts={cohorts}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
