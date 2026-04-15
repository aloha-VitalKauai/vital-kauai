'use client'

/**
 * CohortManager.tsx
 * ─────────────────────────────────────────────────────────────
 * Founder-side cohort CRUD panel.
 * Create, view, and manage group ceremony cohorts.
 *
 * Drop in: components/dashboard/CohortManager.tsx
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Cohort {
  id: string
  title: string
  start_at: string
  end_at: string | null
  capacity: number | null
  status: 'scheduled' | 'completed' | 'canceled'
  created_at: string
}

interface CohortMember {
  journey_id: string
  member_name: string
  member_email: string
  status: string
  portal_display_date: string
}

function toInputDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    timeZone: 'Pacific/Honolulu',
  })
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// ── Create/Edit cohort form ───────────────────────────────────

function CohortForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: Cohort
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const supabase = createClientComponentClient()
  const [title, setTitle]       = useState(existing?.title ?? '')
  const [startDate, setStart]   = useState(toInputDate(existing?.start_at ?? null))
  const [endDate, setEnd]       = useState(toInputDate(existing?.end_at ?? null))
  const [capacity, setCapacity] = useState(existing?.capacity?.toString() ?? '')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function handleSave() {
    if (!title.trim()) { setErr('Title is required.'); return }
    if (!startDate) { setErr('Start date is required.'); return }
    setSaving(true); setErr('')

    const payload = {
      title: title.trim(),
      start_at: new Date(startDate + 'T12:00:00-10:00').toISOString(),
      end_at:   endDate ? new Date(endDate + 'T12:00:00-10:00').toISOString() : null,
      capacity: capacity ? parseInt(capacity) : null,
      status:   'scheduled',
    }

    let data, error
    if (existing) {
      const res = await supabase.from('cohorts').update(payload).eq('id', existing.id).select().single()
      data = res.data; error = res.error
    } else {
      const res = await supabase.from('cohorts').insert(payload).select().single()
      data = res.data; error = res.error
    }

    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(data.id)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 6,
    fontSize: 13, background: '#FAFAF8', color: '#1A1A18',
    outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: '#888', marginBottom: 4, display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={lbl}>Cohort Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder='e.g. "Spring 2026 Cohort"' style={inp} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Start Date</label>
          <input type='date' value={startDate} onChange={e => setStart(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>End Date <span style={{ opacity: 0.5 }}>(optional)</span></label>
          <input type='date' value={endDate} min={startDate}
            onChange={e => setEnd(e.target.value)} style={inp} />
        </div>
      </div>
      <div style={{ maxWidth: 160 }}>
        <label style={lbl}>Capacity <span style={{ opacity: 0.5 }}>(optional)</span></label>
        <input type='number' min={1} value={capacity}
          onChange={e => setCapacity(e.target.value)}
          placeholder='e.g. 8' style={inp} />
      </div>
      {err && <p style={{ fontSize: 12, color: '#C04040', margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 6,
          border: '1px solid rgba(0,0,0,0.12)',
          background: 'transparent', color: '#6B6B67', fontSize: 13, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '8px 20px', borderRadius: 6, border: 'none',
          background: saving ? '#A0B0A8' : '#1A5C3A',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Cohort'}
        </button>
      </div>
    </div>
  )
}

// ── Cohort card ───────────────────────────────────────────────

function CohortCard({
  cohort,
  onRefresh,
}: {
  cohort: Cohort
  onRefresh: () => void
}) {
  const supabase = createClientComponentClient()
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [members, setMembers]     = useState<CohortMember[]>([])
  const [loadingM, setLoadingM]   = useState(false)

  const days = daysUntil(cohort.start_at)
  const isPast = days < 0

  async function loadMembers() {
    setLoadingM(true)
    const { data } = await supabase
      .from('journey_summary_view')
      .select('journey_id,member_name,member_email,status,portal_display_date')
      .eq('cohort_id', cohort.id)
    setMembers((data as CohortMember[]) ?? [])
    setLoadingM(false)
  }

  useEffect(() => {
    if (expanded) loadMembers()
  }, [expanded]) // eslint-disable-line

  const statusColor = {
    scheduled: { bg: '#E8F5EE', color: '#1A5C3A' },
    completed: { bg: '#EDF5EF', color: '#2D6040' },
    canceled:  { bg: '#F5E8E8', color: '#7A3535' },
  }[cohort.status]

  return (
    <div style={{
      border: '0.5px solid rgba(0,0,0,0.1)',
      borderRadius: 10,
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px' }}>
        {/* Date block */}
        <div style={{
          width: 52, height: 52,
          borderRadius: 8,
          background: isPast ? '#F0F0EE' : '#E8F5EE',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: isPast ? '#888' : '#1A5C3A', lineHeight: 1 }}>
            {new Date(cohort.start_at).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'Pacific/Honolulu' })}
          </span>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: isPast ? '#AAAAAA' : '#2D8060' }}>
            {new Date(cohort.start_at).toLocaleDateString('en-US', { month: 'short', timeZone: 'Pacific/Honolulu' })}
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: 0 }}>
              {cohort.title}
            </p>
            <span style={{
              padding: '2px 8px', borderRadius: 99,
              background: statusColor.bg, color: statusColor.color,
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{cohort.status}</span>
          </div>
          <p style={{ fontSize: 12, color: '#888', margin: '3px 0 0' }}>
            {formatDate(cohort.start_at)}
            {cohort.end_at ? ` — ${formatDate(cohort.end_at)}` : ''}
            {cohort.capacity ? ` · Max ${cohort.capacity}` : ''}
            {!isPast && days > 0 ? ` · ${days} days away` : ''}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setEditing(e => !e); setExpanded(false) }}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.12)',
              background: editing ? '#E8F5EE' : '#FAFAF8',
              color: editing ? '#1A5C3A' : '#6B6B67',
              fontSize: 12, cursor: 'pointer',
            }}
          >Edit</button>
          <button
            onClick={() => { setExpanded(e => !e); setEditing(false) }}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: expanded ? '1.5px solid #1A5C3A' : '1px solid rgba(0,0,0,0.12)',
              background: expanded ? '#E8F5EE' : '#FAFAF8',
              color: expanded ? '#1A5C3A' : '#6B6B67',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            {expanded ? 'Hide Members' : 'Members ↓'}
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ padding: 16, borderTop: '0.5px solid rgba(0,0,0,0.08)', background: '#F8F8F6' }}>
          <CohortForm
            existing={cohort}
            onSaved={() => { setEditing(false); onRefresh() }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {/* Members panel */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
          <p style={{
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#AAAAAA', margin: '14px 0 10px',
          }}>
            Members in this cohort
          </p>
          {loadingM ? (
            <p style={{ fontSize: 12, color: '#AAAAAA' }}>Loading…</p>
          ) : members.length === 0 ? (
            <p style={{ fontSize: 12, color: '#AAAAAA', fontStyle: 'italic' }}>
              No members assigned yet. Use Journey Scheduling to assign members to this cohort.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => (
                <div key={m.journey_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#F8F8F6',
                  borderRadius: 6,
                  border: '0.5px solid rgba(0,0,0,0.08)',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A18', margin: 0 }}>{m.member_name}</p>
                    <p style={{ fontSize: 11, color: '#888', margin: '1px 0 0' }}>{m.member_email}</p>
                  </div>
                  <span style={{
                    fontSize: 11, color: '#888',
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: '#EEEEE8',
                  }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function CohortManager() {
  const supabase = createClientComponentClient()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cohorts')
      .select('*')
      .order('start_at', { ascending: false })
    setCohorts((data as Cohort[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const upcoming = cohorts.filter(c => c.status === 'scheduled' && daysUntil(c.start_at) > 0)
  const past     = cohorts.filter(c => c.status !== 'scheduled' || daysUntil(c.start_at) <= 0)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A18', margin: '0 0 4px' }}>
            Cohort Management
          </h2>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            Create and manage group ceremony cohorts. Members are assigned via Journey Scheduling.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: '8px 16px', borderRadius: 6,
            border: 'none', background: '#1A5C3A',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          + New Cohort
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{
          padding: 16, marginBottom: 20,
          border: '1.5px solid #1A5C3A',
          borderRadius: 10, background: '#F4FAF6',
        }}>
          <p style={{
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#1A5C3A', marginBottom: 14, fontWeight: 600,
          }}>New Cohort</p>
          <CohortForm
            onSaved={() => { setCreating(false); load() }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#AAAAAA', padding: 20 }}>Loading cohorts…</p>
      ) : cohorts.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          border: '1px dashed rgba(0,0,0,0.1)', borderRadius: 10,
          color: '#AAAAAA', fontSize: 13,
        }}>
          No cohorts yet. Create your first cohort above.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#AAAAAA', marginBottom: 10 }}>
                Upcoming
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {upcoming.map(c => <CohortCard key={c.id} cohort={c} onRefresh={load} />)}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#AAAAAA', marginBottom: 10 }}>
                Past / Completed
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {past.map(c => <CohortCard key={c.id} cohort={c} onRefresh={load} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
