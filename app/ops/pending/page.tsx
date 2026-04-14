'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Lead = {
  id: string
  full_name: string
  email: string
  phone: string | null
  discovery_call_date: string | null
  calendly_booked_at: string | null
  approval_status: 'pending' | 'approved' | 'declined'
  approval_token: string
  approval_decided_at: string | null
  approval_decided_by: string | null
  created_at: string
}

type Filter = 'pending' | 'approved' | 'declined' | 'all'

export default function PendingApprovalsPage() {
  const supabase = createClient()
  const [leads, setLeads]     = useState<Lead[]>([])
  const [filter, setFilter]   = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  useEffect(() => { loadLeads() }, [filter])

  async function loadLeads() {
    setLoading(true)
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('approval_status', filter)
    const { data } = await q
    setLeads(data || [])
    setLoading(false)
  }

  async function approve(lead: Lead) {
    setActing(lead.id)
    const res = await fetch('/api/approve-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: lead.approval_token, decidedBy: 'dashboard' }),
    })
    showToast(res.ok ? `\u2713 ${lead.full_name} approved \u2014 invite sent` : 'Something went wrong. Try again.')
    if (res.ok) loadLeads()
    setActing(null)
  }

  async function decline(lead: Lead) {
    setActing(lead.id)
    const res = await fetch('/api/decline-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: lead.approval_token, decidedBy: 'dashboard' }),
    })
    showToast(res.ok ? `${lead.full_name} declined` : 'Something went wrong. Try again.')
    if (res.ok) loadLeads()
    setActing(null)
  }

  async function resendNotification(lead: Lead) {
    setActing(lead.id)
    const res = await fetch('/api/resend-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id }),
    })
    const data = await res.json()
    showToast(res.ok ? `Founder email resent for ${lead.full_name}` : (data.error || 'Resend failed'))
    setActing(null)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  function formatAgo(date: Date) {
    const diff  = Date.now() - date.getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 60)  return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const statusColor = { pending: '#c8a96e', approved: '#5DCAA5', declined: 'rgba(245,240,232,0.3)' }

  return (
    <div style={{ minHeight: '100vh', background: '#0e1a10', padding: '40px 32px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={{ fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8a96e', margin: '0 0 8px' }}>
          Ops Dashboard
        </p>
        <h1 style={{ color: '#f5f0e8', fontFamily: 'Georgia,serif', fontWeight: 400, fontSize: 28, margin: '0 0 32px' }}>
          Member Approvals
        </h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['pending', 'approved', 'declined', 'all'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 18px', borderRadius: 6, border: filter === f ? '1.5px solid #c8a96e' : '1.5px solid rgba(245,240,232,0.12)', background: filter === f ? 'rgba(200,169,110,0.12)' : 'transparent', color: filter === f ? '#c8a96e' : 'rgba(245,240,232,0.45)', fontFamily: 'sans-serif', fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'sans-serif', fontSize: 14 }}>Loading\u2026</p>
        ) : leads.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', border: '1px solid rgba(245,240,232,0.08)', borderRadius: 8 }}>
            <p style={{ color: 'rgba(245,240,232,0.4)', fontFamily: 'sans-serif', fontSize: 15, margin: 0 }}>
              {filter === 'pending' ? 'No pending approvals' : `No ${filter} leads`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leads.map(lead => (
              <div key={lead.id} style={{ background: 'rgba(245,240,232,0.04)', border: '1px solid rgba(245,240,232,0.08)', borderRadius: 8, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ color: '#f5f0e8', fontFamily: 'Georgia,serif', fontSize: 18 }}>{lead.full_name}</span>
                    <span style={{ fontFamily: 'sans-serif', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: statusColor[lead.approval_status], border: `1px solid ${statusColor[lead.approval_status]}`, padding: '2px 8px', borderRadius: 4 }}>
                      {lead.approval_status}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'sans-serif', fontSize: 13 }}>
                    {lead.email}
                    {lead.phone && <span style={{ marginLeft: 16 }}>{lead.phone}</span>}
                  </div>
                  <div style={{ color: 'rgba(245,240,232,0.35)', fontFamily: 'sans-serif', fontSize: 12, marginTop: 6 }}>
                    {lead.discovery_call_date && `Call: ${new Date(lead.discovery_call_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`}
                    {lead.calendly_booked_at && <span style={{ marginLeft: 16 }}>Booked {formatAgo(new Date(lead.calendly_booked_at))}</span>}
                    {lead.approval_decided_at && <span style={{ marginLeft: 16 }}>Decided {formatAgo(new Date(lead.approval_decided_at))} via {lead.approval_decided_by}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {lead.approval_status === 'pending' && (
                    <>
                      <button onClick={() => approve(lead)} disabled={acting === lead.id} style={{ padding: '10px 20px', borderRadius: 6, background: acting === lead.id ? 'rgba(200,169,110,0.3)' : '#c8a96e', color: '#1a2e1c', border: 'none', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600, cursor: acting === lead.id ? 'not-allowed' : 'pointer' }}>
                        {acting === lead.id ? '\u2026' : 'Approve'}
                      </button>
                      <button onClick={() => decline(lead)} disabled={acting === lead.id} style={{ padding: '10px 20px', borderRadius: 6, background: 'transparent', color: 'rgba(245,240,232,0.45)', border: '1px solid rgba(245,240,232,0.15)', fontFamily: 'sans-serif', fontSize: 13, cursor: acting === lead.id ? 'not-allowed' : 'pointer' }}>
                        Decline
                      </button>
                    </>
                  )}
                  <button onClick={() => resendNotification(lead)} disabled={acting === lead.id} title="Resend founder approval email" style={{ padding: '10px 16px', borderRadius: 6, background: 'transparent', color: 'rgba(245,240,232,0.35)', border: '1px solid rgba(245,240,232,0.1)', fontFamily: 'sans-serif', fontSize: 12, cursor: acting === lead.id ? 'not-allowed' : 'pointer' }}>
                    Resend Email
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: '#c8a96e', color: '#1a2e1c', padding: '12px 24px', borderRadius: 6, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
