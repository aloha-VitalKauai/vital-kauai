import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyFounder } from '@/lib/auth/founder-check'
import AutomaticEmailsPanel from '@/components/dashboard/AutomaticEmailsPanel'
import type { JourneyEmailTemplate } from '@/lib/journey-emails'

export const metadata = { title: 'Automatic Emails — Vital Kauaʻi' }
export const dynamic = 'force-dynamic'

export default async function AutomaticEmailsPage() {
  const founder = await verifyFounder()
  if (!founder) redirect('/login')

  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('journey_email_templates')
    .select('id, arc, week_idx, principle_name, principle, theme, subject, intro, action_items, updated_at')
    .order('arc', { ascending: true })
    .order('week_idx', { ascending: true })

  const { data: recentLog } = await supabase
    .from('journey_email_log')
    .select('id, arc, week_idx, recipient_email, subject, sent_at')
    .order('sent_at', { ascending: false })
    .limit(20)

  return (
    <AutomaticEmailsPanel
      templates={(templates ?? []) as JourneyEmailTemplate[]}
      recentLog={recentLog ?? []}
      founderEmail={founder.email}
    />
  )
}
