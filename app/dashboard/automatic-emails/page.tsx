import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import AutomaticEmailsPanel from '@/components/dashboard/AutomaticEmailsPanel'
import type { TransactionalEmailTemplate } from '@/lib/transactional-emails'
import { getAllJourneyEmailTemplates } from '@/lib/journey-emails-from-integration'

export const metadata = { title: 'Automatic Emails — Vital Kauaʻi' }
export const dynamic = 'force-dynamic'

export default async function AutomaticEmailsPage() {
  const founder = await verifyFounder()
  if (!founder) redirect('/login')

  const supabase = await createClient()

  // Journey templates are derived from the Integration page content — they
  // auto-sync, so the dashboard view is read-only and there is no DB fetch.
  const journeyTemplates = getAllJourneyEmailTemplates()

  const [{ data: txTemplates }, { data: recentLog }] = await Promise.all([
    supabase
      .from('transactional_email_templates')
      .select('key, audience, editable, display_name, description, subject, eyebrow, heading, lead_html, body_html, cta_label, closing_html, variables, updated_at')
      .order('audience', { ascending: false }) // member first
      .order('display_name', { ascending: true }),
    supabase
      .from('journey_email_log')
      .select('id, arc, week_idx, recipient_email, subject, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20),
  ])

  return (
    <AutomaticEmailsPanel
      journeyTemplates={journeyTemplates}
      transactionalTemplates={(txTemplates ?? []) as TransactionalEmailTemplate[]}
      recentLog={recentLog ?? []}
      founderEmail={founder.email}
    />
  )
}
