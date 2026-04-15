'use client'

/**
 * SchedulingRequestQueue.tsx
 * ─────────────────────────────────────────────────────────────
 * Founder-side component: shows pending member availability requests
 * and lets founder assign a date in one step.
 *
 * Reads from: scheduling_requests_view
 * Writes via: resolveSchedulingRequest() server action only
 *
 * Usage in ops dashboard sidebar:
 *   import SchedulingRequestQueue from '@/components/dashboard/SchedulingRequestQueue'
 *   <SchedulingRequestQueue />
 *
 * Drop in: components/dashboard/SchedulingRequestQueue.tsx
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveSchedulingRequest } from '@/app/actions/journeys'
import { journeyDateToInputValue } from '@/lib/journeyDates'

interface RequestRow {
  request_id:        string
  member_id:         string
  member_name:       string
  member_email:      string
  journey_id:        string | null
  journey_status:    string | null
  availability_label: string
  earliest_date:     string
  latest_date:       string
  excluded_ranges:   Array<{ from: string; to: string; reason?: string }>
  notes:             string | null
  request_status:    string
  days_waiting:      number
  submitted_at:      string
}

// ── Assign date modal ─────────────────────────────────────────

function AssignModal({
  request,
  onClose,
  onDone,
}: {
  request: RequestRow
  onClose: () => void
  onDone:  () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState('')
  const [err,  setErr]  = useState('')

  function handleAssign() {
    if (!date) { setErr('Please select a date.'); return }
    setErr('')
    startTransition(async () => {
      const result = await resolveSchedulingRequest(request.request_id, date)
      if (!result.ok) { setErr(result.error ?? 'Error assigning date'); return }
      onDone()
    })
  }

  const minDate = request.earliest_date
  const maxDate = request.latest_date

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999,
    }}>
      <div style={{
        background: '#1C1A17',
        border: '0.5px solid rgba(244,164,53,0.3)',
        borderRadius: 12,
        padding: '24px',
        width: 320,
        fontFamily: 'system-ui, sans-serif',
      }}>
        <p style={{
          fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'rgba(244,164,53,0.7)', marginBottom: 10,
        }}>Assign Ceremony Date</p>

        <p style={{ fontSize: 17, color: '#E8E0D4', marginBottom: 4 }}>
          {request.member_name}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
          Available: {request.availability_label}
        </p>

        {request.excluded_ranges.length > 0 && (
          <p style={{ fontSize: 11, color: 'rgba(244,164,53,0.6)', marginBottom: 12 }}>
            ⚠ Avoid:{' '}
            {request.excluded_ranges
              .map(r => `${r.from} – ${r.to}`)
              .join(', ')}
          </p>
        )}

        {request.notes && (
          <p style={{
            fontSize: 12, color: 'rgba(255,255,255,0.4)',
            fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5,
          }}>
            "{request.notes}"
          </p>
        )}

        <label style={{
          fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 6,
        }}>
          Ceremony Date
        </label>
        <input
          type='date'
          value={date}
          min={minDate}
          max={maxDate}
          onChange={e => setDate(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '9px 12px',
            color: '#E8E0D4',
            fontSize: 13,
            marginBottom: 14,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {err && (
          <p style={{ fontSize: 11, color: '#C07070', marginBottom: 10 }}>{err}</p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px', borderRadius: 6, cursor: 'pointer',
            border: '0.5px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12,
          }}>
            Cancel
          </button>
          <button onClick={handleAssign} disabled={isPending} style={{
            flex: 1, padding: '9px', borderRadius: 6, cursor: isPending ? 'not-allowed' : 'pointer',
            border: '0.5px solid rgba(29,158,117,0.4)',
            background: 'rgba(29,158,117,0.15)',
            color: isPending ? 'rgba(29,158,117,0.4)' : '#1D9E75',
            fontSize: 12, fontWeight: 600,
          }}>
            {isPending ? 'Confirming…' : 'Confirm Date'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function SchedulingRequestQueue() {
  const supabase   = createClient()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [active,   setActive]   = useState<RequestRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('scheduling_requests_view')
      .select('*')
      .eq('request_status', 'pending')
      .order('submitted_at', { ascending: true })
    setRequests((data as RequestRow[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <p style={{
      fontFamily: 'system-ui', fontSize: 12,
      color: 'rgba(255,255,255,0.25)', padding: '8px 0',
    }}>
      Loading requests…
    </p>
  )

  if (requests.length === 0) return (
    <p style={{
      fontFamily: 'system-ui', fontSize: 12,
      color: 'rgba(255,255,255,0.25)', fontStyle: 'italic',
    }}>
      No pending requests
    </p>
  )

  return (
    <>
      {active && (
        <AssignModal
          request={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); load() }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map(req => (
          <div key={req.request_id} style={{
            background: 'rgba(244,164,53,0.04)',
            border: '0.5px solid rgba(244,164,53,0.28)',
            borderRadius: 7,
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <p style={{
                fontFamily: 'system-ui', fontSize: 13,
                color: '#E8E0D4', fontWeight: 500,
              }}>
                {req.member_name}
              </p>
              {req.days_waiting > 1 && (
                <span style={{
                  fontFamily: 'system-ui', fontSize: 9,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: req.days_waiting > 3 ? '#E05050' : 'rgba(255,255,255,0.3)',
                }}>
                  {req.days_waiting}d ago
                </span>
              )}
            </div>

            <p style={{
              fontFamily: 'system-ui', fontSize: 11,
              color: 'rgba(255,255,255,0.4)', marginBottom: 8,
            }}>
              {req.availability_label}
              {req.excluded_ranges.length > 0 && (
                <span style={{ color: 'rgba(244,164,53,0.6)', marginLeft: 6 }}>
                  · {req.excluded_ranges.length} date{req.excluded_ranges.length > 1 ? 's' : ''} to avoid
                </span>
              )}
            </p>

            <button
              onClick={() => setActive(req)}
              style={{
                fontFamily: 'system-ui',
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
                border: '0.5px solid rgba(244,164,53,0.4)',
                background: 'rgba(244,164,53,0.08)',
                color: '#F4A435',
              }}
            >
              Assign date →
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
