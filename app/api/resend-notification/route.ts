import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendFounderNotification } from '../calendly-webhook/route'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/resend-notification
 * Body: { lead_id: string }
 *
 * Re-sends the founder approval email for a given lead.
 * Used from /ops/pending dashboard when the original email was lost or failed.
 */
export async function POST(req: NextRequest) {
  try {
    const { lead_id } = await req.json()

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, full_name, email, approval_token, approval_status, discovery_call_date')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (!lead.approval_token) {
      return NextResponse.json({ error: 'Lead has no approval token' }, { status: 400 })
    }

    // Log the notification attempt
    const { data: notifRow } = await supabase
      .from('notification_log')
      .insert({
        lead_id: lead.id,
        notification_type: 'founder_approval_resend',
        recipient: ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
        status: 'queued',
        payload: {
          fullName: lead.full_name,
          email: lead.email,
          trigger: 'manual_resend',
        },
      })
      .select('id')
      .single()

    // Send the email
    try {
      await sendFounderNotification({
        fullName: lead.full_name,
        email: lead.email,
        eventName: 'Discovery Call',
        startTime: lead.discovery_call_date || null,
        approvalToken: lead.approval_token,
      })

      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notifRow.id)
      }

      return NextResponse.json({
        ok: true,
        message: `Founder notification resent for ${lead.full_name} (${lead.email})`,
      })
    } catch (emailErr: any) {
      if (notifRow) {
        await supabase
          .from('notification_log')
          .update({ status: 'failed', failure_reason: emailErr.message })
          .eq('id', notifRow.id)
      }

      return NextResponse.json(
        { error: `Email send failed: ${emailErr.message}` },
        { status: 500 }
      )
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
