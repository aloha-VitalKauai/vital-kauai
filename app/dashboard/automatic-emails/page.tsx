import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import AutomaticEmailsPanel from '@/components/dashboard/AutomaticEmailsPanel'
import type { JourneyEmailTemplate } from '@/lib/journey-emails'
import type { TransactionalEmailTemplate } from '@/lib/transactional-emails'

export const metadata = { title: 'Automatic Emails — Vital Kauaʻi' }
export const dynamic = 'force-dynamic'

export default async function AutomaticEmailsPage() {
  const founder = await verifyFounder()
  if (!founder) redirect('/login')

  const supabase = await createClient()

  const [{ data: journeyTemplates }, { data: txTemplates }, { data: recentLog }] = await Promise.all([
    supabase
      .from('journey_email_templates')
      .select('id, arc, week_idx, principle_name, principle, theme, subject, intro, action_items, updated_at')
      .order('arc', { ascending: true })
      .order('week_idx', { ascending: true }),
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
      journeyTemplates={(journeyTemplates ?? []) as JourneyEmailTemplate[]}
      transactionalTemplates={(txTemplates ?? []) as TransactionalEmailTemplate[]}
      recentLog={recentLog ?? []}
      founderEmail={founder.email}
    />
  )
}
