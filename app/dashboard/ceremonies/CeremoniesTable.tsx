'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rescheduleJourney } from '@/app/actions/journeys'

type Row = {
  id:             string
  member_id:      string
  ceremony_date:  string | null
  medicine_form:  string | null
  guides_present: string | null
  status:         string | null
  integration_calls: number | null
  pre_notes:      string | null
  post_notes:     string | null
  journey_id:     string | null
  schedule_type:  string | null
}

const TH: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#6B6B67', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '0.5px solid rgba(0,0,0,0.09)', background: '#FAFAF8', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', fontSize: 12, verticalAlign: 'middle' }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CeremonyDateCell({ row }: { row: Row }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.ceremony_date ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Inline edit only supports single_date private/cohort journeys.
  // date_range and tbd should go through the Journey Scheduler.
  const editable = !!row.journey_id && row.schedule_type === 'single_date'

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{fmtDate(row.ceremony_date)}</span>
        {editable && (
          <button
            onClick={() => { setEditing(true); setDraft(row.ceremony_date ?? ''); setErr(null) }}
            title="Edit ceremony date"
            style={{
              border: '0.5px solid rgba(0,0,0,0.12)',
              background: '#FAFAF8',
              color: '#6B6B67',
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 99,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Edit</button>
        )}
      </div>
    )
  }

  function save() {
    setErr(null)
    if (!draft) { setErr('Pick a date'); return }
    if (!row.journey_id) { setErr('Missing journey'); return }
    const journeyId = row.journey_id
    startTransition(async () => {
      const result = await rescheduleJourney(journeyId, {
        scheduleType: 'single_date',
        startDate:    draft,
        endDate:      null,
        cohortId:     null,
        notes:        null,
      })
      if (!result.ok) {
        setErr(result.error ?? 'Save failed')
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isPending}
          style={{
            padding: '4px 8px',
            border: '0.5px solid rgba(0,0,0,0.15)',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'inherit',
            background: '#fff',
            color: '#1A1A18',
            outline: 'none',
          }}
        />
        <button
          onClick={save}
          disabled={isPending}
          style={{
            border: 'none',
            background: '#085041',
            color: '#fff',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 99,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >{isPending ? 'Saving…' : 'Save'}</button>
        <button
          onClick={() => { setEditing(false); setErr(null); setDraft(row.ceremony_date ?? '') }}
          disabled={isPending}
          style={{
            border: '0.5px solid rgba(0,0,0,0.12)',
            background: 'transparent',
            color: '#6B6B67',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 99,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >Cancel</button>
      </div>
      {err && (
        <span style={{ fontSize: 10, color: '#A32D2D' }}>{err}</span>
      )}
    </div>
  )
}

export default function CeremoniesTable({
  rows,
  memberMap,
}: {
  rows: Row[]
  memberMap: Record<string, string>
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Member', 'Ceremony date', 'Medicine form', 'Guides present', 'Status', 'Integration calls', 'Pre notes', 'Post notes'].map((h) => (
            <th key={h} style={TH}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#9E9E9A', fontSize: 14 }}>No ceremony records yet</td></tr>
        ) : rows.map((r) => {
          const isComplete = r.status === 'Complete'
          return (
            <tr key={r.id} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
              <td style={TD}><div style={{ fontWeight: 500, fontSize: 13 }}>{memberMap[r.member_id] ?? 'Unknown'}</div></td>
              <td style={TD}><CeremonyDateCell row={r} /></td>
              <td style={TD}>{r.medicine_form ?? '—'}</td>
              <td style={TD}>{r.guides_present ?? '—'}</td>
              <td style={TD}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap',
                  background: isComplete ? '#E1F5EE' : '#FAEEDA',
                  color: isComplete ? '#085041' : '#633806',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isComplete ? '#1D9E75' : '#EF9F27', display: 'inline-block' }} />
                  {r.status ?? 'Unknown'}
                </span>
              </td>
              <td style={TD}>{r.integration_calls ?? 0}</td>
              <td style={{ ...TD, fontSize: 11, color: r.pre_notes ? '#6B6B67' : '#9E9E9A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pre_notes ?? '—'}</td>
              <td style={{ ...TD, fontSize: 11, color: r.post_notes ? '#6B6B67' : '#9E9E9A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.post_notes ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
