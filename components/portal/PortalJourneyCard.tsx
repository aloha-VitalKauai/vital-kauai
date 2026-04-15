'use client'

/**
 * PortalJourneyCard.tsx  — final version
 * ─────────────────────────────────────────────────────────────
 * Drop-in replacement for the "YOUR JOURNEY" card on the portal dashboard.
 * Same visual as the existing card. Sources from journeys table only.
 *
 * When date is TBD: shows SchedulingRequestForm inline.
 * When date is set: shows date + countdown.
 *
 * USAGE in app/portal/dashboard/page.tsx:
 *   1. import PortalJourneyCard from '@/components/portal/PortalJourneyCard'
 *   2. Replace the existing journey card JSX block with: <PortalJourneyCard />
 *
 * Drop in: components/portal/PortalJourneyCard.tsx
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  getActiveJourney,
  getJourneyDisplayStatus,
  getDaysUntilJourney,
} from '@/lib/journeyHelpers'
import type { Journey } from '@/lib/journeyHelpers'
import SchedulingRequestForm from '@/components/portal/SchedulingRequestForm'

export default function PortalJourneyCard() {
  const supabase = createClientComponentClient()
  const [journey,   setJourney]   = useState<Journey | null | undefined>(undefined)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) { setJourney(null); return }
      const j = await getActiveJourney(supabase, session.user.id)
      setJourney(j)
    }
    load()
  }, [supabase])

  // ── Loading ───────────────────────────────────────────────
  if (journey === undefined) {
    return (
      <div style={cardStyle}>
        <p style={eyebrowStyle}>YOUR JOURNEY</p>
        <div style={{ height: 36, width: '60%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 13, width: '75%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 13, width: '45%', background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
      </div>
    )
  }

  const display  = getJourneyDisplayStatus(journey)
  const daysLeft = journey ? getDaysUntilJourney(journey.start_at) : null
  const isTBD    = !journey || display.displayDate === 'Date TBD'

  // Show scheduling form when: journey exists, date is TBD, not yet submitted
  const showForm = !!journey &&
    isTBD &&
    (journey.status === 'approved' || journey.status === 'scheduling') &&
    !submitted

  // Booking label — shown where "Iboga Journey" was
  const journeyLabel =
    !journey ? null
    : journey.booking_type === 'private' ? 'Private Journey'
    : journey.cohort?.title ?? 'Group Journey'

  // Status text — shown where "Active Member" was
  const statusText =
    !journey ? null
    : {
        approved:    'Approved',
        scheduling:  'Scheduling in Progress',
        scheduled:   'Scheduled',
        in_progress: 'Journey in Progress',
        completed:   'Journey Complete',
        canceled:    'Canceled',
      }[journey.status]

  return (
    <div style={cardStyle}>
      {/* Eyebrow */}
      <p style={eyebrowStyle}>YOUR JOURNEY</p>

      {/* Date */}
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: isTBD ? 32 : 28,
        fontWeight: 400,
        color: isTBD ? 'rgba(240,235,224,0.9)' : '#F0EBE0',
        lineHeight: 1.15,
        letterSpacing: isTBD ? '0.01em' : '-0.01em',
        marginBottom: 10,
      }}>
        {display.displayDate || 'Date TBD'}
      </p>

      {/* Journey label */}
      {journeyLabel && (
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 15, fontStyle: 'italic',
          color: 'rgba(196,166,97,0.85)',
          letterSpacing: '0.02em', marginBottom: 4,
        }}>
          {journeyLabel}
        </p>
      )}

      {/* Status */}
      {statusText && (
        <p style={{
          fontFamily: 'sans-serif', fontSize: 12,
          color: 'rgba(240,235,224,0.4)', letterSpacing: '0.04em',
        }}>
          {statusText}
        </p>
      )}

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Days until arrival */}
      <p style={eyebrowStyle}>DAYS UNTIL ARRIVAL</p>

      {daysLeft !== null && daysLeft > 0 ? (
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 52, fontWeight: 300, color: '#C4A661',
          lineHeight: 1, letterSpacing: '-0.03em', marginTop: 4,
        }}>
          {daysLeft}
        </p>
      ) : (
        <p style={{
          fontFamily: 'sans-serif', fontSize: 13,
          color: 'rgba(255,255,255,0.15)', fontStyle: 'italic', marginTop: 6,
        }}>—</p>
      )}

      {/* Team note */}
      {journey?.notes && (
        <>
          <div style={{ ...dividerStyle, marginTop: 16 }} />
          <p style={{ ...eyebrowStyle, marginBottom: 6 }}>FROM THE TEAM</p>
          <p style={{
            fontFamily: 'sans-serif', fontSize: 12,
            color: 'rgba(255,255,255,0.4)', lineHeight: 1.65, fontStyle: 'italic',
          }}>
            {journey.notes}
          </p>
        </>
      )}

      {/* Scheduling form — only when TBD and not yet submitted */}
      {showForm && (
        <SchedulingRequestForm onSubmitted={() => setSubmitted(true)} />
      )}

      {/* Post-submit confirmation */}
      {submitted && (
        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: 'rgba(196,166,97,0.06)',
          border: '0.5px solid rgba(196,166,97,0.2)',
          borderRadius: 8, textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 15, color: '#C4A661', marginBottom: 3,
          }}>
            ✓ Availability received
          </p>
          <p style={{
            fontFamily: 'sans-serif', fontSize: 11,
            color: 'rgba(255,255,255,0.3)', lineHeight: 1.6,
          }}>
            We'll confirm your date within 2–3 days.
          </p>
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '28px 24px',
}

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  fontSize: 9,
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color: 'rgba(196,166,97,0.7)',
  marginBottom: 10,
}

const dividerStyle: React.CSSProperties = {
  borderTop: '0.5px solid rgba(196,166,97,0.2)',
  margin: '20px 0 16px',
}
