'use client'

/**
 * HeroCountdown
 * Compact countdown card that lives next to the hero text on the
 * pre-ceremony and post-ceremony portal pages. Mirrors the larger
 * "Your Journey" card on /portal but sized for an inline hero slot.
 *
 *   mode="pre"   → shows "Days Until Arrival" + count
 *   mode="post"  → shows "Days Since Ceremony" + count
 */

import { useEffect, useState } from 'react'
import { getActiveJourneyForCurrentUser } from '@/lib/journeyHelpers'
import type { Journey } from '@/lib/journeyHelpers'
import { formatJourneyDate, getDaysUntilJourney } from '@/lib/journeyDates'

type Props = { mode: 'pre' | 'post' }

export default function HeroCountdown({ mode }: Props) {
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getActiveJourneyForCurrentUser()
      .then((j) => { if (!cancelled) setJourney(j) })
      .catch(() => { if (!cancelled) setJourney(null) })
    return () => { cancelled = true }
  }, [])

  if (journey === undefined || !journey?.start_at) return null

  const dateStr = formatJourneyDate(journey.schedule_type, journey.start_at, journey.end_at)
  const journeyLabel =
    journey.booking_type === 'private'
      ? 'Private Journey'
      : journey.cohort?.title ?? 'Group Journey'

  let count: number | null = null
  let countLabel = ''
  if (mode === 'pre') {
    count = getDaysUntilJourney(journey.start_at)
    if (count === null) return null
    countLabel = count === 1 ? 'Day Until Arrival' : 'Days Until Arrival'
  } else {
    const diffMs = Date.now() - new Date(journey.start_at).getTime()
    if (diffMs >= 0) {
      count = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      countLabel = count === 1 ? 'Day Since Ceremony' : 'Days Since Ceremony'
    } else {
      const daysUntil = getDaysUntilJourney(journey.start_at)
      if (daysUntil === null) return null
      count = daysUntil
      countLabel = daysUntil === 1 ? 'Day Until Ceremony' : 'Days Until Ceremony'
    }
  }

  return (
    <aside className="hero-countdown">
      <p className="hc-eyebrow">Your Ceremony</p>
      <p className="hc-date">{dateStr}</p>
      <p className="hc-label">{journeyLabel}</p>
      <div className="hc-divider" />
      <p className="hc-eyebrow">{countLabel}</p>
      <p className="hc-count">{count}</p>

      <style jsx>{`
        .hero-countdown {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 22px 22px 24px;
          width: 240px;
          backdrop-filter: blur(8px);
        }
        .hc-eyebrow {
          font-size: 9px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: rgba(196, 166, 97, 0.75);
          margin: 0 0 8px;
          font-weight: 600;
        }
        .hc-date {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 400;
          color: #f0ebe0;
          line-height: 1.15;
          letter-spacing: -0.005em;
          margin: 0 0 6px;
        }
        .hc-label {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 13px;
          font-style: italic;
          color: rgba(196, 166, 97, 0.85);
          letter-spacing: 0.02em;
          margin: 0;
        }
        .hc-divider {
          border-top: 1px solid rgba(196, 166, 97, 0.2);
          margin: 16px 0 14px;
        }
        .hc-count {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 40px;
          font-weight: 300;
          color: #c4a661;
          line-height: 1;
          letter-spacing: -0.03em;
          margin: 4px 0 0;
        }
      `}</style>
    </aside>
  )
}
