'use client'

/**
 * SessionBookingCard
 * Sits in the hero aside of the weekly integration portal page, beneath the
 * countdown. Shows the member how many included sessions they have left and
 * lets them book one.
 *
 * The Sessions engine underneath is intricate—allowance ledger, atomic
 * booking authorizations, Calendly webhooks. None of that surfaces here. The
 * member sees a session, a number, and a button.
 *
 * Balances are read with the member's own session, so RLS returns their rows
 * and nobody else's; booking goes through the existing endpoints, which own
 * all of the gating logic.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getSessionBalances,
  SESSION_TYPES,
  type SessionBalance,
  type SessionType,
} from '@/lib/sessions/balance'
import {
  BOOKING_UNAVAILABLE_NOTICE,
  requestSessionBooking,
  requestWeeklyScheduling,
  type BookingRequest,
} from '@/lib/sessions/book-client'
import { describeError, sessionRowState, shouldShowRow } from './sessionCardState'
import {
  seriesPanelState,
  type SeriesOccurrence,
  type SeriesPanelState,
} from './sessionSeriesState'

const LABELS: Record<SessionType, { name: string; detail: string }> = {
  coaching: { name: 'Coaching', detail: '1 Hour Coaching Call' },
  pne: { name: 'PNE', detail: 'PsychoNeuroEnergetics' },
}

function SessionIcon({ type }: { type: SessionType }) {
  return (
    <span className="sbc-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="20" height="20" fill="none"
           stroke="currentColor" strokeWidth="1.1"
           strokeLinecap="round" strokeLinejoin="round">
        {type === 'coaching' ? (
          <>
            <path d="M16 27V13" />
            <path d="M16 16c0-4 3-7 7-7 0 4-3 7-7 7Z" />
            <path d="M16 20c0-3.3-2.5-6-6-6 0 3.3 2.5 6 6 6Z" />
          </>
        ) : (
          <>
            <path d="M5 13c2.4 0 2.4 2.4 4.8 2.4S12.2 13 14.6 13 17 15.4 19.4 15.4 21.8 13 24.2 13 26.6 15.4 27 15.4" />
            <path d="M5 20c2.4 0 2.4 2.4 4.8 2.4S12.2 20 14.6 20 17 22.4 19.4 22.4 21.8 20 24.2 20 26.6 22.4 27 22.4" />
          </>
        )}
      </svg>
    </span>
  )
}

export type SessionCardRow = {
  type: SessionType
  label: string
  canBook: boolean
}

/**
 * Pure presentation. Split from the container so the card can be rendered
 * without a Supabase session, which is what makes it reviewable in isolation.
 */
const SCHEDULE_STATE_LABELS: Record<string, string> = {
  done: 'Complete',
  next: 'Next',
  upcoming: 'Scheduled',
  needs_scheduling: 'Needs a time',
  canceled: 'Canceled',
}

export function SessionCardView({
  rows,
  coachingPanel = null,
  busy = null,
  notice = null,
  scheduleOpen = false,
  onBook,
  onSetWeekly,
  onToggleSchedule,
}: {
  rows: SessionCardRow[]
  coachingPanel?: SeriesPanelState | null
  busy?: SessionType | 'weekly' | null
  notice?: string | null
  scheduleOpen?: boolean
  onBook?: (type: SessionType) => void
  onSetWeekly?: () => void
  onToggleSchedule?: () => void
}) {
  const panel = coachingPanel && coachingPanel.kind !== 'book' ? coachingPanel : null
  if (rows.length === 0 && !panel) return null

  const eyebrow =
    panel?.kind === 'series'
      ? 'Next Integration Session'
      : panel?.kind === 'set_weekly'
        ? 'Post-Integration Coaching'
        : 'Book Your Session'

  return (
    <aside className="sbc">
      <div className="sbc-head">
        <span className="sbc-eyebrow">{eyebrow}</span>
        <svg className="sbc-mark" viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" strokeWidth="1" strokeLinecap="round"
             strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21V10" />
          <path d="M12 13c0-3.3 2.5-6 6-6 0 3.3-2.5 6-6 6Z" />
          <path d="M12 16c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5Z" />
        </svg>
      </div>

      {panel?.kind === 'set_weekly' && (
        <div className="sbc-panel">
          <div className="sbc-lead">
            <SessionIcon type="coaching" />
            <span className="sbc-names">
              <span className="sbc-name">Integration Coaching</span>
              <span className="sbc-detail">Weekly · 1 Hour Coaching Call</span>
            </span>
            <span className="sbc-count">
              {panel.remaining} session{panel.remaining === 1 ? '' : 's'} remaining
            </span>
          </div>
          <p className="sbc-weekly-copy">
            Choose the weekly time you&rsquo;ll meet with us throughout integration.
          </p>
          <button
            type="button"
            className="sbc-book"
            disabled={busy === 'weekly'}
            onClick={() => onSetWeekly?.()}
          >
            {busy === 'weekly' ? 'Opening…' : 'Set My Weekly Time'}
            {busy !== 'weekly' && <span className="sbc-arrow" aria-hidden="true">→</span>}
          </button>
        </div>
      )}

      {panel?.kind === 'series' && (
        <div className="sbc-panel">
          {panel.nextDate ? (
            <>
              <p className="sbc-next-date">{panel.nextDate}</p>
              <p className="sbc-next-time">{panel.nextTime}</p>
            </>
          ) : (
            <p className="sbc-next-date">Your next time is being scheduled</p>
          )}
          <p className="sbc-rhythm">
            {panel.rhythm}
            <span className="sbc-rhythm-sep" aria-hidden="true">·</span>
            {panel.remaining} session{panel.remaining === 1 ? '' : 's'} remaining
          </p>
          <div className="sbc-actions">
            {panel.meetingUrl && (
              <a className="sbc-book sbc-join" href={panel.meetingUrl} target="_blank" rel="noreferrer">
                Join Call
              </a>
            )}
            <button type="button" className="sbc-book sbc-ghost" onClick={() => onToggleSchedule?.()}>
              {scheduleOpen ? 'Hide Schedule' : 'View Schedule'}
            </button>
          </div>
          {scheduleOpen && (
            <ul className="sbc-slist">
              {panel.schedule.map((entry, i) => (
                <li key={i} className={`sbc-slist-row sbc-s-${entry.state}`}>
                  <span className="sbc-slist-when">
                    {entry.date} · {entry.time}
                  </span>
                  <span className="sbc-slist-state">{SCHEDULE_STATE_LABELS[entry.state]}</span>
                </li>
              ))}
            </ul>
          )}
          {panel.unscheduled > 0 && (
            <p className="sbc-notice">
              {panel.unscheduled} session{panel.unscheduled === 1 ? '' : 's'} await
              {panel.unscheduled === 1 ? 's' : ''} a new time — message us and
              we&rsquo;ll find one together.
            </p>
          )}
        </div>
      )}

      {rows.map((row, i) => {
        const isBusy = busy === row.type
        return (
          <div
            className={`sbc-row${i > 0 || panel ? ' sbc-row-divided' : ''}`}
            key={row.type}
          >
            <div className="sbc-lead">
              <SessionIcon type={row.type} />
              <span className="sbc-names">
                <span className="sbc-name">{LABELS[row.type].name}</span>
                <span className="sbc-detail">{LABELS[row.type].detail}</span>
              </span>
              <span className="sbc-count">{row.label}</span>
            </div>
            <button
              type="button"
              className="sbc-book"
              disabled={!row.canBook || isBusy}
              aria-label={`Book ${LABELS[row.type].name} session`}
              onClick={() => onBook?.(row.type)}
            >
              <span className="sbc-book-wide">
                {isBusy ? 'Opening…' : `Book ${LABELS[row.type].name} Session`}
              </span>
              <span className="sbc-book-slim">{isBusy ? 'Opening…' : 'Book'}</span>
              {!isBusy && <span className="sbc-arrow" aria-hidden="true">→</span>}
            </button>
          </div>
        )
      })}

      {notice && <p className="sbc-notice">{notice}</p>}

      <style jsx>{`
        .sbc {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 22px 24px 24px;
          width: 440px;
          max-width: 100%;
          backdrop-filter: blur(8px);
          margin-top: 18px;
        }
        .sbc-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(196, 166, 97, 0.2);
        }
        .sbc-eyebrow {
          font-size: 9px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: rgba(196, 166, 97, 0.75);
          font-weight: 600;
        }
        .sbc-mark { color: rgba(168, 197, 172, 0.5); flex: none; }

        .sbc-row { padding: 18px 0 0; }
        .sbc-row-divided {
          margin-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }
        .sbc-lead { display: flex; align-items: center; gap: 14px; }
        .sbc-icon {
          width: 44px;
          height: 44px;
          flex: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(168, 197, 172, 0.28);
          border-radius: 50%;
          color: #a8c5ac;
        }
        .sbc-names { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        .sbc-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px;
          font-weight: 400;
          color: #f0ebe0;
          line-height: 1.1;
          letter-spacing: -0.005em;
        }
        .sbc-detail {
          font-size: 11.5px;
          color: rgba(245, 240, 232, 0.5);
          letter-spacing: 0.02em;
        }
        .sbc-count {
          font-size: 12px;
          color: rgba(168, 197, 172, 0.85);
          letter-spacing: 0.02em;
          white-space: nowrap;
          flex: none;
        }

        .sbc-book {
          margin-top: 14px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 18px;
          min-height: 44px;
          border: none;
          border-radius: 999px;
          background: rgba(122, 158, 126, 0.92);
          color: #14251a;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s ease, opacity 0.2s ease;
        }
        .sbc-book:hover:not(:disabled) { background: #8fb093; }
        .sbc-book:disabled { opacity: 0.4; cursor: default; }
        .sbc-book-slim { display: none; }
        .sbc-arrow { font-size: 13px; letter-spacing: 0; }

        .sbc-notice {
          margin: 16px 0 0;
          font-size: 11.5px;
          line-height: 1.6;
          color: rgba(245, 240, 232, 0.55);
        }

        /* ── post-integration coaching panel (set_weekly / series states) ── */
        .sbc-panel { padding: 18px 0 0; }
        .sbc-weekly-copy {
          margin: 14px 0 0;
          font-size: 12.5px;
          line-height: 1.65;
          color: rgba(245, 240, 232, 0.65);
        }
        .sbc-next-date {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 27px;
          font-weight: 400;
          color: #f0ebe0;
          line-height: 1.15;
          letter-spacing: -0.005em;
        }
        .sbc-next-time {
          margin: 4px 0 0;
          font-size: 14px;
          color: rgba(168, 197, 172, 0.95);
          letter-spacing: 0.04em;
        }
        .sbc-rhythm {
          margin: 12px 0 0;
          font-size: 11.5px;
          color: rgba(245, 240, 232, 0.55);
          letter-spacing: 0.03em;
        }
        .sbc-rhythm-sep { margin: 0 7px; color: rgba(196, 166, 97, 0.6); }
        .sbc-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }
        .sbc-actions .sbc-book { margin-top: 0; flex: 1 1 140px; }
        a.sbc-book { text-decoration: none; }
        .sbc-ghost {
          background: transparent;
          border: 1px solid rgba(168, 197, 172, 0.4);
          color: rgba(168, 197, 172, 0.95);
        }
        .sbc-ghost:hover:not(:disabled) { background: rgba(122, 158, 126, 0.15); }
        .sbc-slist {
          list-style: none;
          margin: 16px 0 0;
          padding: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }
        .sbc-slist-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 12px;
          color: rgba(245, 240, 232, 0.75);
        }
        .sbc-slist-when { min-width: 0; }
        .sbc-slist-state {
          flex: none;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(168, 197, 172, 0.85);
        }
        .sbc-s-done { color: rgba(245, 240, 232, 0.4); }
        .sbc-s-done .sbc-slist-state { color: rgba(245, 240, 232, 0.35); }
        .sbc-s-next .sbc-slist-state { color: rgba(196, 166, 97, 0.9); }
        .sbc-s-needs_scheduling .sbc-slist-state,
        .sbc-s-canceled .sbc-slist-state { color: rgba(224, 178, 133, 0.85); }

        /* Desktop: the button tucks inline on the right of each row, matching
           the reference. Below the hero's own 880px breakpoint the card goes
           full width and the buttons stack—thumb-sized, not squeezed. */
        @media (min-width: 881px) {
          .sbc-row {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .sbc-lead { flex: 1; min-width: 0; }
          .sbc-book {
            margin-top: 0;
            width: auto;
            flex: none;
            padding: 11px 20px;
            letter-spacing: 0.1em;
          }
          .sbc-book-wide { display: none; }
          .sbc-book-slim { display: inline; }
        }
        @media (max-width: 880px) {
          .sbc { width: 100%; }
        }
      `}</style>
    </aside>
  )
}

type Balances = Record<SessionType, SessionBalance>

type ActiveSeries = {
  id: string
  first_session_at: string
  timezone: string
  planned_sessions: number
  status: string
}

export default function SessionBookingCard({ phase = 'pre' }: { phase?: 'pre' | 'post' }) {
  const [balances, setBalances] = useState<Balances | null>(null)
  const [series, setSeries] = useState<ActiveSeries | null>(null)
  const [occurrences, setOccurrences] = useState<SeriesOccurrence[]>([])
  const [busy, setBusy] = useState<SessionType | 'weekly' | null>(null)
  const [unavailable, setUnavailable] = useState<Partial<Record<SessionType, boolean>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const result = await getSessionBalances(supabase, user.id)
      if (cancelled) return
      setBalances(result)

      // Post-ceremony, the coaching row is series-aware: read the member's
      // active series and its occurrences under their own session (RLS).
      if (phase === 'post') {
        const { data: activeSeries, error: seriesErr } = await supabase
          .from('session_series')
          .select('id, first_session_at, timezone, planned_sessions, status')
          .eq('member_id', user.id)
          .eq('session_type', 'coaching')
          .eq('status', 'active')
          .maybeSingle()
        if (seriesErr) throw new Error(`session_series read failed: ${seriesErr.message}`)
        if (cancelled) return
        if (activeSeries) {
          const { data: occ, error: occErr } = await supabase
            .from('session_bookings')
            .select('scheduled_at, status, meeting_url')
            .eq('series_id', activeSeries.id)
          if (occErr) throw new Error(`series occurrences read failed: ${occErr.message}`)
          if (cancelled) return
          setSeries(activeSeries as ActiveSeries)
          setOccurrences((occ ?? []) as SeriesOccurrence[])
        }
      }
    })().catch((err) => {
      // A balance we can't read is a card we don't show, never a broken hero.
      // Members see nothing; the console keeps a SANITIZED reason—name,
      // code, message only, never the raw error object (which could carry
      // response payloads or session material).
      console.error('[sessions] balance load failed:', describeError(err))
      if (!cancelled) setBalances(null)
    })
    return () => { cancelled = true }
  }, [phase])

  const openScheduler = useCallback(async (
    key: SessionType | 'weekly',
    request: () => Promise<BookingRequest>,
    balanceType: SessionType,
  ) => {
    // The scheduler opens in its own tab so the member keeps their place in
    // the portal. The tab has to be opened HERE, synchronously inside the
    // click: browsers only permit window.open while a user gesture is still
    // on the stack, and the await below breaks that chain.
    const tab = window.open('', '_blank')
    if (tab) {
      try {
        // Sever window.opener so the scheduler can never reach back into the
        // portal tab, and leave something calm on screen while we fetch.
        tab.opener = null
        tab.document.write(
          '<!doctype html><title>Opening your scheduler…</title>' +
            '<body style="margin:0;display:grid;place-items:center;height:100vh;' +
            'background:#1c2b1e;color:#a8c5ac;font:14px/1.6 -apple-system,sans-serif">' +
            'Opening your scheduler…</body>',
        )
        tab.document.close()
      } catch {
        // A browser that refuses the write still navigates fine below.
      }
    }
    const abandonTab = () => {
      try {
        tab?.close()
      } catch {
        /* already gone */
      }
    }

    setBusy(key)
    setNotice(null)
    try {
      const result = await request()

      if (result.status === 'unavailable') {
        abandonTab()
        setUnavailable((u) => ({ ...u, [balanceType]: true }))
        return
      }
      if (result.status === 'none_remaining') {
        // Nothing left after all—reflect that rather than explaining it.
        abandonTab()
        setBalances((b) =>
          b ? { ...b, [balanceType]: { ...b[balanceType], remaining: 0 } } : b,
        )
        return
      }
      if (result.status === 'error') {
        abandonTab()
        setNotice(BOOKING_UNAVAILABLE_NOTICE)
        return
      }

      if (tab) {
        tab.location.href = result.bookingUrl
      } else {
        // Popup blocked, or a standalone PWA that refuses new windows: fall
        // back to this tab rather than stranding the member with nothing.
        window.location.assign(result.bookingUrl)
      }
    } catch {
      abandonTab()
      setNotice(BOOKING_UNAVAILABLE_NOTICE)
    } finally {
      setBusy((current) => (current === key ? null : current))
    }
  }, [])

  const book = useCallback(
    (type: SessionType) => openScheduler(type, () => requestSessionBooking(type), type),
    [openScheduler],
  )
  const setWeekly = useCallback(
    () => openScheduler('weekly', () => requestWeeklyScheduling(), 'coaching'),
    [openScheduler],
  )

  if (!balances) return null

  const coachingPanel = seriesPanelState({
    postCeremony: phase === 'post',
    balanceRemaining: balances.coaching.remaining,
    series,
    occurrences,
  })

  const rows: SessionCardRow[] = SESSION_TYPES
    // The coaching row is replaced by its panel while one is active.
    .filter((type) => !(type === 'coaching' && coachingPanel.kind !== 'book'))
    .filter((type) => shouldShowRow(balances[type].granted))
    .map((type) => ({
      type,
      ...sessionRowState({
        remaining: balances[type].remaining,
        unavailable: unavailable[type],
      }),
    }))

  return (
    <SessionCardView
      rows={rows}
      coachingPanel={coachingPanel}
      busy={busy}
      notice={notice}
      scheduleOpen={scheduleOpen}
      onBook={book}
      onSetWeekly={setWeekly}
      onToggleSchedule={() => setScheduleOpen((open) => !open)}
    />
  )
}
