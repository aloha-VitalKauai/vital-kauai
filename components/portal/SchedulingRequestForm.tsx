'use client'

/**
 * SchedulingRequestForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Member-facing availability form. Rendered inside PortalJourneyCard
 * when journey status is 'approved' or 'scheduling' with no date set.
 *
 * Calls submitSchedulingRequest() server action — no direct DB writes.
 *
 * Drop in: components/portal/SchedulingRequestForm.tsx
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useTransition } from 'react'
import { submitSchedulingRequest } from '@/app/actions/journeys'

interface Props {
  onSubmitted?: () => void
}

type FormState = 'idle' | 'submitted'

export default function SchedulingRequestForm({ onSubmitted }: Props) {
  const [isPending, startTransition] = useTransition()
  const [formState, setFormState] = useState<FormState>('idle')
  const [earliest, setEarliest] = useState('')
  const [latest, setLatest] = useState('')
  const [avoid, setAvoid] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')

  function handleSubmit() {
    if (!earliest || !latest) { setErr('Please fill in both date fields.'); return }
    if (latest < earliest) { setErr('Latest date must be after earliest.'); return }
    setErr('')

    // Parse "avoid" field into excluded_ranges if present
    const excludedRanges = avoid.trim()
      ? [{ from: earliest, to: latest, reason: avoid.trim() }]
      : []

    startTransition(async () => {
      const result = await submitSchedulingRequest({
        earliestDate:   earliest,
        latestDate:     latest,
        excludedRanges,
        notes:          notes || null,
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
          We'll confirm your ceremony date within 2–3 days.
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

      {/* Date grid */}
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

      {/* Dates to avoid */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Dates to avoid <span style={{ opacity: 0.45 }}>(optional)</span></label>
        <input
          type='text'
          value={avoid}
          onChange={e => setAvoid(e.target.value)}
          placeholder='e.g. May 15–20, June 3'
          style={inp}
        />
      </div>

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
