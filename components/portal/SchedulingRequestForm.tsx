'use client'

/**
 * SchedulingRequestForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Member-facing availability form. Rendered inside PortalJourneyCard
 * when journey status is 'approved' or 'scheduling' with no date set.
 *
 * Calls submitSchedulingRequest() server action — no direct DB writes.
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useTransition } from 'react'
import { submitSchedulingRequest } from '@/app/actions/journeys'
import { createClient } from '@/lib/supabase/client'
import { fetchPublicCohorts, formatCohortRange, type PublicCohort } from '@/lib/cohorts'

interface Props {
  onSubmitted?: () => void
}

type FormState = 'idle' | 'submitted'

const PRIVATE = '__private__'

export default function SchedulingRequestForm({ onSubmitted }: Props) {
  const [isPending, startTransition] = useTransition()
  const [formState, setFormState] = useState<FormState>('idle')
  const [earliest, setEarliest] = useState('')
  const [latest, setLatest] = useState('')
  const [preferred, setPreferred] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [cohorts, setCohorts] = useState<PublicCohort[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    fetchPublicCohorts(supabase).then(rows => {
      if (!cancelled) setCohorts(rows)
    })
    return () => { cancelled = true }
  }, [])

  const pickedCohort = preferred && preferred !== PRIVATE
    ? cohorts.find(c => c.id === preferred) ?? null
    : null
  const needsDateRange = !pickedCohort  // flexible or private ceremony

  function handleSubmit() {
    let earliestToSend = earliest
    let latestToSend = latest

    if (pickedCohort) {
      // Use the cohort's own date range; don't require form inputs.
      earliestToSend = new Date(pickedCohort.start_at).toISOString().slice(0, 10)
      latestToSend = new Date(pickedCohort.end_at ?? pickedCohort.start_at).toISOString().slice(0, 10)
    } else {
      if (!earliest || !latest) { setErr('Please share your available date range.'); return }
      if (latest < earliest) { setErr('Latest date must be after earliest.'); return }
    }
    setErr('')

    const preferredCohortId = pickedCohort ? pickedCohort.id : null
    const noteParts: string[] = []
    if (preferred === PRIVATE) noteParts.push('Requesting a private ceremony (custom date).')
    if (notes.trim()) noteParts.push(notes.trim())
    const combinedNotes = noteParts.length ? noteParts.join('\n\n') : null

    startTransition(async () => {
      const result = await submitSchedulingRequest({
        earliestDate:      earliestToSend,
        latestDate:        latestToSend,
        excludedRanges:    [],
        notes:             combinedNotes,
        preferredCohortId,
      })

      if (!result.ok) { setErr(result.error ?? 'Something went wrong.'); return }
      setFormState('submitted')
      onSubmitted?.()
    })
  }

  // ── Submitted state ───────────────────────────────────────
  if (formState === 'submitted') {
    return (
      <div style={{
        marginTop: 14,
        padding: '14px',
        background: 'rgba(196,166,97,0.06)',
        border: '0.5px solid rgba(196,166,97,0.2)',
        borderRadius: 8,
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 16, color: '#C4A661', marginBottom: 4,
        }}>
          ✓ Availability received
        </p>
        <p style={{
          fontFamily: 'sans-serif', fontSize: 11,
          color: 'rgba(255,255,255,0.35)', lineHeight: 1.6,
        }}>
          We'll be in touch to confirm your ceremony date.
        </p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'sans-serif',
    fontSize: 12,
    color: '#F0EBE0',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const lbl: React.CSSProperties = {
    fontFamily: 'sans-serif',
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.28)',
    display: 'block',
    marginBottom: 5,
  }

  return (
    <div style={{
      marginTop: 14,
      padding: '14px',
      background: 'rgba(196,166,97,0.05)',
      border: '0.5px solid rgba(196,166,97,0.2)',
      borderRadius: 8,
    }}>
      <p style={{
        fontFamily: 'sans-serif',
        fontSize: 9,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'rgba(196,166,97,0.6)',
        marginBottom: 12,
      }}>
        Share your availability
      </p>

      {/* Preferred ceremony date */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Preferred ceremony date <span style={{ opacity: 0.45 }}>(optional)</span></label>
        <select
          value={preferred}
          onChange={e => setPreferred(e.target.value)}
          style={inp}
        >
          <option value=''>No preference / I&apos;m flexible</option>
          {cohorts.map(c => (
            <option key={c.id} value={c.id}>
              {formatCohortRange(c.start_at, c.end_at)}
              {c.title ? ` · ${c.title}` : ''}
            </option>
          ))}
          <option value={PRIVATE}>Private ceremony (request a custom date)</option>
        </select>
      </div>

      {/* Date grid — only when no specific cohort is chosen */}
      {needsDateRange && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={lbl}>Earliest available</label>
          <input
            type='date'
            value={earliest}
            onChange={e => setEarliest(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Latest available</label>
          <input
            type='date'
            value={latest}
            onChange={e => setLatest(e.target.value)}
            min={earliest || new Date().toISOString().slice(0, 10)}
            style={inp}
          />
        </div>
      </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Notes for the team <span style={{ opacity: 0.45 }}>(optional)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder='Anything helpful for timing…'
          style={{ ...inp, resize: 'none', lineHeight: 1.55 }}
        />
      </div>

      {err && (
        <p style={{
          fontFamily: 'sans-serif', fontSize: 11,
          color: '#C07070', marginBottom: 8,
        }}>{err}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        style={{
          width: '100%',
          padding: '9px',
          borderRadius: 6,
          border: '0.5px solid rgba(196,166,97,0.4)',
          background: isPending ? 'rgba(196,166,97,0.05)' : 'rgba(196,166,97,0.1)',
          color: isPending ? 'rgba(196,166,97,0.4)' : '#C4A661',
          fontFamily: 'sans-serif',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Sending…' : 'Send availability →'}
      </button>
    </div>
  )
}
