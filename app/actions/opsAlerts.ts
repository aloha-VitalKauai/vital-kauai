'use server'

/**
 * app/actions/opsAlerts.ts
 * ─────────────────────────────────────────────────────────────
 * Founder-only wrapper around the SQL function refresh_ops_alerts(),
 * which scans the canonical tables and upserts rows into ops_alerts
 * for every active rule (deposit unpaid, payment received, medical
 * not cleared, webhook orphan, etc.).
 *
 * The pg_cron job 'refresh_ops_alerts' runs the same logic every
 * 15 minutes; this action exists for on-demand refresh from the
 * Alerts tab.
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@/lib/supabase/server'

export interface RefreshResult {
  ok: boolean
  activeCount?: number
  error?: string
}

export async function refreshOpsAlerts(): Promise<RefreshResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('refresh_ops_alerts')
  if (error) return { ok: false, error: error.message }
  return { ok: true, activeCount: typeof data === 'number' ? data : Number(data) }
}
