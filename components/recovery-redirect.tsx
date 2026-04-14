'use client'

import { useEffect } from 'react'

/**
 * Detects Supabase recovery tokens in the URL hash and redirects
 * to /setup-account. Supabase's redirect_to is unreliable,
 * so this catches recovery links no matter where they land.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      window.location.replace(`/setup-account#${hash}`)
    }
  }, [])

  return null
}
