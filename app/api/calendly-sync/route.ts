import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendFounderNotification } from '../calendly-webhook/route'

/**
 * GET /api/calendly-sync
 *
 * Polling fallback: fetches recent Calendly bookings and backfills any
 * that the webhook missed. Safe to run on a cron (e.g. every 5 minutes).
 *
 * Requires env var: CALENDLY_API_TOKEN (personal access token)
 * Optional env var: CALENDLY_USER_URI (your Calendly user URI)
 *
 * This endpoint is idempotent — it skips leads that already exist.
 */
export async function GET(req: NextRequest) {
  const apiToken = process.env.CALENDLY_API_TOKEN
  if (!apiToken) {
    return NextResponse.json(
      { error: 'CALENDLY_API_TOKEN not configured' },
      { status: 500 }
    )
  }

  // Auth check — require CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Step 1: Get the Calendly user URI if not configured
    let userUri = process.env.CALENDLY_USER_URI
    if (!userUri) {
      const meRes = await calendlyFetch(apiToken, '/users/me')
      userUri = meRes.resource?.uri
      if (!userUri) {
        return NextResponse.json({ error: 'Could not resolve Calendly user URI' }, { status: 500 })
      }
    }

    // Step 2: Fetch recent scheduled events (last 24 hours)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const eventsRes = await calendlyFetch(apiToken, '/scheduled_events', {
      user: userUri,
      min_start_time: since,
      status: 'active',
      count: '50',
    })

    const events = eventsRes.collection || []
    console.log(`[calendly-sync] Found ${events.length} events in last 24h`)

    let synced = 0
    let skipped = 0
    let errors = 0

    // Step 3: For each event, fetch invitees and backfill missing leads
    for (const event of events) {
      try {
        const eventUri = event.uri
        const eventId = eventUri?.split('/').pop()
        const inviteesRes = await calendlyFetch(apiToken, `/scheduled_events/${eventId}/invitees`)
        const invitees = inviteesRes.collection || []

        for (const invitee of invitees) {
          const email = invitee.email
          if (!email) continue

          // Check if lead already exists
          const { data: existing } = await supabase
            .from('leads')
            .select('id, approval_status, approval_token')
            .eq('email', email)
            .single()

          if (existing) {
            // Lead exists — update booking info if it's still pending
            if (existing.approval_status === 'pending') {
              // Backfill approval_token if missing (e.g. lead created via client-side form without token)
              const backfillToken = (existing as any).approval_token || randomBytes(32).toString('hex')
              await supabase
                .from('leads')
                .update({
                  discovery_call_booked: true,
                  discovery_call_date: event.start_time ? event.start_time.split('T')[0] : null,
                  calendly_event_id: eventId,
                  calendly_booked_at: new Date().toISOString(),
                  approval_token: backfillToken,
                })
                .eq('id', existing.id)
            }
            skipped++
            continue
          }

          // New lead — insert with approval token
          const approvalToken = randomBytes(32).toString('hex')
          const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert({
              full_name: invitee.name || 'Unknown',
              email,
              source: 'Calendly',
              discovery_call_booked: true,
              discovery_call_date: event.start_time ? event.start_time.split('T')[0] : null,
              calendly_event_id: eventId,
              calendly_booked_at: new Date().toISOString(),
              approval_status: 'pending',
              approval_token: approvalToken,
            })
            .select()
            .single()

          if (leadError) {
            console.error(`[calendly-sync] Failed to insert lead ${email}:`, leadError.message)
            errors++
            continue
          }

          console.log(`[calendly-sync] Backfilled lead: ${invitee.name} (${email})`)

          // Send founder notification for the missed booking
          try {
            await sendFounderNotification({
              fullName: invitee.name || 'Unknown',
              email,
              eventName: event.name || 'Discovery Call',
              startTime: event.start_time || null,
              approvalToken,
            })

            // Log the notification
            await supabase.from('notification_log').insert({
              lead_id: lead.id,
              notification_type: 'founder_approval',
              recipient: ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
              status: 'sent',
              sent_at: new Date().toISOString(),
              payload: { trigger: 'calendly_sync_backfill' },
            })

            console.log(`[calendly-sync] Founder notification sent for ${invitee.name}`)
          } catch (emailErr: any) {
            console.error(`[calendly-sync] Email failed for ${email}:`, emailErr.message)
            await supabase.from('notification_log').insert({
              lead_id: lead.id,
              notification_type: 'founder_approval',
              recipient: ['joshuaperdue2@gmail.com', 'aloha@vitalkauai.com'],
              status: 'failed',
              failure_reason: emailErr.message,
              payload: { trigger: 'calendly_sync_backfill' },
            })
          }

          synced++
        }
      } catch (eventErr: any) {
        console.error(`[calendly-sync] Error processing event:`, eventErr.message)
        errors++
      }
    }

    console.log(`[calendly-sync] Done — synced: ${synced}, skipped: ${skipped}, errors: ${errors}`)
    return NextResponse.json({ ok: true, synced, skipped, errors, eventsChecked: events.length })
  } catch (err: any) {
    console.error('[calendly-sync] Unhandled error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Calendly API helper
// ---------------------------------------------------------------------------
async function calendlyFetch(
  token: string,
  path: string,
  params?: Record<string, string>
) {
  const url = new URL(`https://api.calendly.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly API ${res.status}: ${text}`)
  }

  return res.json()
}
