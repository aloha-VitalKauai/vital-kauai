/**
 * Helpers for transactional emails whose copy is editable from the founders
 * dashboard. Each existing send route reads its template, interpolates
 * {{variables}}, and injects the strings into its hardcoded HTML scaffold.
 *
 * Failure modes:
 *   - DB read fails  → caller falls back to its hardcoded default
 *   - Row missing    → caller falls back to its hardcoded default
 *   - Field missing  → use the corresponding hardcoded default field
 *
 * Production never breaks because of a missing template.
 */

import { createClient as createServiceSupabase } from '@supabase/supabase-js'

export type TransactionalEmailKey =
  | 'setup_link'
  | 'app_install'
  | 'free_guide'
  | 'payment_link'
  | 'discovery_call_notification'
  | 'stripe_refund_notification'
  | 'reconciliation_failure'

export interface TransactionalEmailTemplate {
  key: TransactionalEmailKey | string
  audience: 'member' | 'founder'
  editable: boolean
  display_name: string
  description: string | null
  subject: string
  eyebrow: string | null
  heading: string | null
  lead_html: string | null
  body_html: string | null
  cta_label: string | null
  closing_html: string | null
  variables: string[]
  updated_at?: string
}

/**
 * Replaces every `{{name}}` in `s` with `vars[name]`. Unknown names are left
 * intact (so a forgotten variable shows up loudly in the rendered email
 * instead of silently disappearing). Empty string values still substitute.
 */
export function interpolate(s: string, vars: Record<string, string>): string {
  if (!s) return s
  return s.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match,
  )
}

/**
 * Service-role Supabase client. Used only inside server routes to read
 * templates without RLS in the way.
 */
function serviceSupabase() {
  return createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Fetches a transactional email template from the DB. Returns null if the
 * row is missing or the query fails — callers should fall back to a
 * hardcoded default in that case so production keeps working.
 */
export async function getTransactionalTemplate(
  key: TransactionalEmailKey,
): Promise<TransactionalEmailTemplate | null> {
  try {
    const supabase = serviceSupabase()
    const { data, error } = await supabase
      .from('transactional_email_templates')
      .select(
        'key, audience, editable, display_name, description, subject, eyebrow, heading, lead_html, body_html, cta_label, closing_html, variables, updated_at',
      )
      .eq('key', key)
      .maybeSingle()

    if (error || !data) {
      if (error) console.warn('[transactional-emails] template fetch failed', key, error.message)
      return null
    }
    return data as TransactionalEmailTemplate
  } catch (err) {
    console.warn('[transactional-emails] template fetch threw', key, err)
    return null
  }
}

/**
 * Resolves a template + applies fallbacks per-field. Each field falls back
 * to the matching key in `defaults` so a partially-filled template still
 * renders cleanly.
 */
export type ResolvedFields = {
  subject: string
  eyebrow: string
  heading: string
  lead_html: string
  body_html: string
  cta_label: string
  closing_html: string
}

export async function resolveTemplate(
  key: TransactionalEmailKey,
  vars: Record<string, string>,
  defaults: ResolvedFields,
): Promise<ResolvedFields> {
  const tpl = await getTransactionalTemplate(key)
  const pick = <K extends keyof ResolvedFields>(field: K): string =>
    interpolate(((tpl?.[field as keyof TransactionalEmailTemplate] as string | null) ?? defaults[field]) || '', vars)

  return {
    subject: pick('subject'),
    eyebrow: pick('eyebrow'),
    heading: pick('heading'),
    lead_html: pick('lead_html'),
    body_html: pick('body_html'),
    cta_label: pick('cta_label'),
    closing_html: pick('closing_html'),
  }
}
