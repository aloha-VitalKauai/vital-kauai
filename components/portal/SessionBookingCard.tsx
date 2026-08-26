'use client'

/**
 * SessionBookingCard
 * Sits in the hero aside of the weekly integration portal page, beneath the
 * countdown. Shows the member how many included sessions they have left and
 * lets them book one.
 *
 * The Sessions engine underneath is intricate — allowance ledger, atomic
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
import { describeError, sessionRowState, shouldShowRow } from './sessionCardState'

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
export function SessionCardView({
  rows,
  busy = null,
  notice = null,
  onBook,
}: {
  rows: SessionCardRow[]
  busy?: SessionType | null
  notice?: string | null
  onBook?: (type: SessionType) => void
}) {
  if (rows.length === 0) return null

  return (
    <aside className="sbc">
      <div className="sbc-head">
        <span className="sbc-eyebrow">Book Your Session</span>
        <svg className="sbc-mark" viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" strokeWidth="1" strokeLinecap="round"
             strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21V10" />
          <path d="M12 13c0-3.3 2.5-6 6-6 0 3.3-2.5 6-6 6Z" />
          <path d="M12 16c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5Z" />
        </svg>
      </div>

      {rows.map((row, i) => {
        const isBusy = busy === row.type
        return (
          <div className={`sbc-row${i > 0 ? ' sbc-row-divided' : ''}`} key={row.type}>
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

        /* Desktop: the button tucks inline on the right of each row, matching
           the reference. Below the hero's own 880px breakpoint the card goes
           full width and the buttons stack — thumb-sized, not squeezed. */
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

export default function SessionBookingCard() {
  const [balances, setBalances] = useState<Balances | null>(null)
  const [busy, setBusy] = useState<SessionType | null>(null)
  const [unavailable, setUnavailable] = useState<Partial<Record<SessionType, boolean>>>({})
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const result = await getSessionBalances(supabase, user.id)
      if (!cancelled) setBalances(result)
    })().catch((err) => {
      // A balance we can't read is a card we don't show, never a broken hero.
      // Members see nothing; the console keeps a SANITIZED reason — name,
      // code, message only, never the raw error object (which could carry
      // response payloads or session material).
      console.error('[sessions] balance load failed:', describeError(err))
      if (!cancelled) setBalances(null)
    })
    return () => { cancelled = true }
  }, [])

  const book = useCallback(async (type: SessionType) => {
    setBusy(type)
    setNotice(null)
    try {
      const res = await fetch(`/api/sessions/${type}/book`, { method: 'POST' })

      if (res.status === 503) {
        setUnavailable((u) => ({ ...u, [type]: true }))
        return
      }
      if (res.status === 409) {
        // Nothing left after all — reflect that rather than explaining it.
        setBalances((b) => (b ? { ...b, [type]: { ...b[type], remaining: 0 } } : b))
        return
      }
      if (!res.ok) {
        setNotice('Scheduling is unavailable right now. Please try again shortly.')
        return
      }

      const { booking_url: bookingUrl } = await res.json()
      if (!bookingUrl) {
        setNotice('Scheduling is unavailable right now. Please try again shortly.')
        return
      }
      // Leaving the page; `busy` stays set so the button cannot be re-pressed
      // during navigation.
      window.location.assign(bookingUrl)
    } catch {
      setNotice('Scheduling is unavailable right now. Please try again shortly.')
    } finally {
      setBusy((current) => (current === type ? null : current))
    }
  }, [])

  if (!balances) return null

  const rows: SessionCardRow[] = SESSION_TYPES
    .filter((type) => shouldShowRow(balances[type].granted))
    .map((type) => ({
      type,
      ...sessionRowState({
        remaining: balances[type].remaining,
        unavailable: unavailable[type],
      }),
    }))

  return <SessionCardView rows={rows} busy={busy} notice={notice} onBook={book} />
}
