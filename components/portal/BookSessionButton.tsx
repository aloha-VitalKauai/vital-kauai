'use client'

/**
 * BookSessionButton
 * A "Book a Session" control that routes through the Sessions engine instead
 * of linking straight to a Calendly page. The member sees the same thing
 * either way; the difference is that this path takes an authorization first,
 * so the booking is attributed to them and counts against their allowance —
 * the same ledger the sessions card in the integration hero reads from.
 *
 * Presentation is left to the caller's className, so this drops into the
 * portal team cards and the Week 1 action list without either one growing
 * its own copy of the booking logic.
 */

import { useCallback, useState } from 'react'
import type { SessionType } from '@/lib/sessions/balance'
import {
  BOOKING_NONE_REMAINING_NOTICE,
  BOOKING_UNAVAILABLE_NOTICE,
  requestSessionBooking,
} from '@/lib/sessions/book-client'

export default function BookSessionButton({
  type,
  className,
  noticeClassName,
  children,
  busyLabel = 'Opening…',
}: {
  type: SessionType
  className?: string
  noticeClassName?: string
  children: React.ReactNode
  busyLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const book = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    const result = await requestSessionBooking(type)
    if (result.status === 'ok') {
      // Leaving the page; `busy` stays set so the control cannot be pressed
      // twice during navigation.
      window.location.assign(result.bookingUrl)
      return
    }
    setNotice(
      result.status === 'none_remaining'
        ? BOOKING_NONE_REMAINING_NOTICE
        : BOOKING_UNAVAILABLE_NOTICE,
    )
    setBusy(false)
  }, [type])

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={book}>
        {busy ? busyLabel : children}
      </button>
      {notice && <p className={noticeClassName}>{notice}</p>}
    </>
  )
}
