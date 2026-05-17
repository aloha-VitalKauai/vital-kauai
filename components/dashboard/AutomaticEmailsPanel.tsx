'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JourneyArc, JourneyEmailTemplate } from '@/lib/journey-emails'
import type { TransactionalEmailTemplate } from '@/lib/transactional-emails'

type JourneyLogRow = {
  id: string
  arc: string
  week_idx: number
  recipient_email: string
  subject: string
  sent_at: string
  resend_id: string | null
}

type NotificationLogRow = {
  id: string
  lead_id: string | null
  notification_type: string
  recipient: string[] | null
  status: string
  payload: Record<string, unknown> | null
  failure_reason: string | null
  sent_at: string | null
  created_at: string
}

type Props = {
  journeyTemplates: JourneyEmailTemplate[]
  transactionalTemplates: TransactionalEmailTemplate[]
  journeyLog: JourneyLogRow[]
  notificationLog: NotificationLogRow[]
  founderEmail: string
}

const C = {
  bg: '#0D0B09',
  card: '#1A1613',
  border: '#4A3D2E',
  text: '#EDE8DF',
  muted: '#C4B199',
  dim: '#8A7A64',
  faint: '#221A12',
  gold: '#C8A96E',
  goldBg: 'rgba(200,169,110,.12)',
  forest: '#1D6B4A',
  terra: '#C96A52',
}

type Mode = 'journey' | 'transactional' | 'log'

export default function AutomaticEmailsPanel({
  journeyTemplates,
  transactionalTemplates,
  journeyLog,
  notificationLog,
  founderEmail,
}: Props) {
  const [mode, setMode] = useState<Mode>('journey')

  const totalSendCount = journeyLog.length + notificationLog.length

  return (
    <div
      style={{
        margin: '-1.75rem -2rem',
        minHeight: 'calc(100vh - 101px)',
        background: C.bg,
        fontFamily: 'var(--font-jost, sans-serif)',
        color: C.text,
      }}
    >
      <div style={{ borderBottom: `0.5px solid ${C.border}`, padding: '14px 24px' }}>
        <div style={{ fontSize: 10, color: C.dim, letterSpacing: '.12em', textTransform: 'uppercase' }}>
          Automated Member Communications
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, marginTop: 6, fontFamily: 'var(--font-cormorant-garamond,serif)' }}>
          Automatic Emails
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Every email Vital Kauaʻi sends through Resend, with the copy editable from one place.
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
          <ModeTab active={mode === 'journey'} onClick={() => setMode('journey')}>
            Journey Emails ({journeyTemplates.length})
          </ModeTab>
          <ModeTab active={mode === 'transactional'} onClick={() => setMode('transactional')}>
            Transactional Emails ({transactionalTemplates.length})
          </ModeTab>
          <ModeTab active={mode === 'log'} onClick={() => setMode('log')}>
            Send Log ({totalSendCount})
          </ModeTab>
        </div>
      </div>

      {mode === 'journey' && (
        <JourneySection
          templates={journeyTemplates}
          recentLog={journeyLog}
          founderEmail={founderEmail}
        />
      )}
      {mode === 'transactional' && (
        <TransactionalSection
          templates={transactionalTemplates}
          founderEmail={founderEmail}
        />
      )}
      {mode === 'log' && (
        <SendLogSection
          journeyLog={journeyLog}
          notificationLog={notificationLog}
        />
      )}
    </div>
  )
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.goldBg : 'transparent',
        border: active ? `0.5px solid ${C.gold}66` : `0.5px solid ${C.border}`,
        color: active ? C.text : C.muted,
        borderRadius: 6,
        padding: '7px 14px',
        fontSize: 12,
        letterSpacing: '.04em',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// ─── Journey emails section (12 weekly templates) ───────────────────────

function JourneySection({
  templates,
  recentLog,
  founderEmail,
}: {
  templates: JourneyEmailTemplate[]
  recentLog: JourneyLogRow[]
  founderEmail: string
}) {
  const [activeKey, setActiveKey] = useState<string>(`${templates[0]?.arc}|${templates[0]?.week_idx}`)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string>('')

  const active = useMemo(
    () => templates.find((t) => `${t.arc}|${t.week_idx}` === activeKey) ?? templates[0],
    [templates, activeKey],
  )

  async function handlePreview(t: JourneyEmailTemplate) {
    const res = await fetch('/api/automatic-emails/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: t, firstName: 'Friend' }),
    })
    if (!res.ok) { alert('Preview failed'); return }
    const { html } = await res.json()
    setPreviewHtml(html)
  }

  async function handleSendTest(t: JourneyEmailTemplate) {
    setTestStatus('Sending…')
    try {
      const res = await fetch('/api/automatic-emails/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: t, to: founderEmail }),
      })
      const body = await res.json()
      setTestStatus(res.ok ? `Sent to ${founderEmail}` : `Error: ${body.error || res.statusText}`)
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setTimeout(() => setTestStatus(''), 4000)
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, alignItems: 'stretch' }}>
        <aside style={sidebarStyle}>
          <div style={{ padding: '10px 12px 4px', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            12 weekly emails sent automatically the morning each member enters that week. Cron runs daily at 6am Hawaii.
          </div>
          <div style={{ padding: '8px 12px 10px', fontSize: 11, color: C.gold, lineHeight: 1.55, background: C.goldBg, borderTop: `0.5px solid ${C.gold}33`, borderBottom: `0.5px solid ${C.gold}33` }}>
            Auto-synced from the Integration pages. Edit principle, intro, or action items on the Integration page and the next email send picks them up.
          </div>
          {(['pre', 'post'] as JourneyArc[]).map((arc) => (
            <div key={arc} style={{ marginBottom: 18 }}>
              <div style={sectionLabelStyle}>{arc === 'pre' ? 'Preparation' : 'Integration'} — 6 weeks</div>
              {templates
                .filter((t) => t.arc === arc)
                .map((t) => {
                  const k = `${t.arc}|${t.week_idx}`
                  const isActive = k === activeKey
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveKey(k)}
                      style={sidebarItemStyle(isActive)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Week {t.week_idx + 1}</span>
                        <span style={{ fontSize: 10, color: C.gold, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                          {t.principle_name}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.theme}</div>
                      <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{relativeWeekDay(arc, t.week_idx)}</div>
                    </button>
                  )
                })}
            </div>
          ))}

          {recentLog.length > 0 && (
            <div style={{ marginTop: 24, padding: '12px', borderTop: `0.5px solid ${C.border}` }}>
              <div style={sectionLabelStyle}>Recent sends</div>
              {recentLog.slice(0, 8).map((row) => (
                <div key={row.id} style={{ fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 1.4 }}>
                  <div style={{ color: C.text }}>{row.recipient_email}</div>
                  <div style={{ color: C.dim }}>
                    {row.arc === 'pre' ? 'Prep' : 'Integration'} W{row.week_idx + 1} · {new Date(row.sent_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main style={{ padding: '24px 28px', maxWidth: 820 }}>
          {active && (
            <JourneyEditor
              key={`${active.arc}|${active.week_idx}`}
              t={active}
              onPreview={() => handlePreview(active)}
              onSendTest={() => handleSendTest(active)}
              testStatus={testStatus}
              founderEmail={founderEmail}
            />
          )}
        </main>
      </div>

      {previewHtml && <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </>
  )
}

// ─── Transactional emails section ───────────────────────────────────────

function TransactionalSection({
  templates: initialTemplates,
  founderEmail,
}: {
  templates: TransactionalEmailTemplate[]
  founderEmail: string
}) {
  const [items, setItems] = useState<TransactionalEmailTemplate[]>(initialTemplates)
  const [activeKey, setActiveKey] = useState<string>(initialTemplates[0]?.key ?? '')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string>('')

  const active = useMemo(
    () => items.find((t) => t.key === activeKey) ?? items[0],
    [items, activeKey],
  )

  function update(key: string, patch: Partial<TransactionalEmailTemplate>) {
    setItems((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  }

  async function handleSave(t: TransactionalEmailTemplate) {
    setSavingKey(t.key)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('transactional_email_templates')
        .update({
          subject: t.subject,
          eyebrow: t.eyebrow,
          heading: t.heading,
          lead_html: t.lead_html,
          body_html: t.body_html,
          cta_label: t.cta_label,
          closing_html: t.closing_html,
          updated_at: new Date().toISOString(),
        })
        .eq('key', t.key)
      if (error) alert(`Save failed: ${error.message}`)
    } finally {
      setSavingKey(null)
    }
  }

  async function handlePreview(t: TransactionalEmailTemplate) {
    const res = await fetch('/api/automatic-emails/transactional-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: t }),
    })
    if (!res.ok) { alert('Preview failed'); return }
    const { html } = await res.json()
    setPreviewHtml(html)
  }

  async function handleSendTest(t: TransactionalEmailTemplate) {
    setTestStatus('Sending…')
    try {
      const res = await fetch('/api/automatic-emails/transactional-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: t, to: founderEmail }),
      })
      const body = await res.json()
      setTestStatus(res.ok ? `Sent to ${founderEmail}` : `Error: ${body.error || res.statusText}`)
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setTimeout(() => setTestStatus(''), 4000)
  }

  const memberItems = items.filter((t) => t.audience === 'member')
  const founderItems = items.filter((t) => t.audience === 'founder')

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, alignItems: 'stretch' }}>
        <aside style={sidebarStyle}>
          <div style={{ padding: '10px 12px 4px', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            One-off emails triggered by specific events — approvals, free-guide downloads, payment links, internal alerts.
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabelStyle}>Member-facing — editable</div>
            {memberItems.map((t) => (
              <button key={t.key} onClick={() => setActiveKey(t.key)} style={sidebarItemStyle(activeKey === t.key)}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.display_name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.subject}</div>
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabelStyle}>Founder alerts — display only</div>
            {founderItems.map((t) => (
              <button key={t.key} onClick={() => setActiveKey(t.key)} style={sidebarItemStyle(activeKey === t.key)}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.display_name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.subject}</div>
              </button>
            ))}
          </div>
        </aside>

        <main style={{ padding: '24px 28px', maxWidth: 820 }}>
          {active && (
            <TransactionalEditor
              key={active.key}
              t={active}
              onChange={(patch) => update(active.key, patch)}
              onSave={() => handleSave(active)}
              onPreview={() => handlePreview(active)}
              onSendTest={() => handleSendTest(active)}
              saving={savingKey === active.key}
              testStatus={testStatus}
              founderEmail={founderEmail}
            />
          )}
        </main>
      </div>

      {previewHtml && <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </>
  )
}

// ─── Send log section (combined journey + transactional history) ────────

type UnifiedSendRow = {
  id: string
  ts: string // ISO — used for sorting + display
  source: 'journey' | 'transactional'
  category: string // e.g. "Journey · Prep W1", "Payment Link"
  recipient: string // joined string for display
  subject: string
  status: 'sent' | 'failed' | 'queued'
  failure_reason: string | null
  detail: Record<string, unknown> | null
}

const NOTIFICATION_LABELS: Record<string, string> = {
  founder_approval: 'Founder approval (new lead)',
  founder_approval_resend: 'Founder approval (resend)',
  free_guide_email: 'Free guide download',
  setup_link_resend: 'Setup link (resend)',
  payment_link_email: 'Payment link',
  password_reset: 'Password reset',
}

function labelForNotificationType(type: string): string {
  return NOTIFICATION_LABELS[type] ?? type.replace(/_/g, ' ')
}

function unifyJourneyRow(r: JourneyLogRow): UnifiedSendRow {
  const arcLabel = r.arc === 'pre' ? 'Prep' : 'Integration'
  return {
    id: `j:${r.id}`,
    ts: r.sent_at,
    source: 'journey',
    category: `Journey · ${arcLabel} W${r.week_idx + 1}`,
    recipient: r.recipient_email,
    subject: r.subject,
    status: 'sent', // journey_email_log only stores successful sends
    failure_reason: null,
    detail: r.resend_id ? { resend_id: r.resend_id } : null,
  }
}

function unifyNotificationRow(r: NotificationLogRow): UnifiedSendRow {
  const ts = r.sent_at ?? r.created_at
  const recipients = Array.isArray(r.recipient) ? r.recipient.join(', ') : (r.recipient ?? '')
  const subject = subjectFromPayload(r.notification_type, r.payload)
  return {
    id: `n:${r.id}`,
    ts,
    source: 'transactional',
    category: labelForNotificationType(r.notification_type),
    recipient: recipients,
    subject,
    status: (r.status === 'sent' || r.status === 'failed' || r.status === 'queued') ? r.status : 'queued',
    failure_reason: r.failure_reason,
    detail: r.payload,
  }
}

function subjectFromPayload(type: string, payload: Record<string, unknown> | null): string {
  if (!payload) return labelForNotificationType(type)
  const name = typeof payload.fullName === 'string' ? payload.fullName : typeof payload.full_name === 'string' ? payload.full_name : null
  switch (type) {
    case 'founder_approval':
    case 'founder_approval_resend':
      return name ? `Approval request for ${name}` : 'Founder approval request'
    case 'free_guide_email':
      return name ? `Free guide sent to ${name}` : 'Free guide sent'
    case 'setup_link_resend':
      return 'Setup link resent'
    case 'payment_link_email':
      if (typeof payload.amount_cents === 'number') {
        return `Payment link · $${(payload.amount_cents / 100).toFixed(2)}`
      }
      return 'Payment link'
    case 'password_reset':
      return 'Password reset link'
    default:
      return labelForNotificationType(type)
  }
}

function SendLogSection({
  journeyLog,
  notificationLog,
}: {
  journeyLog: JourneyLogRow[]
  notificationLog: NotificationLogRow[]
}) {
  type SourceFilter = 'all' | 'journey' | 'transactional'
  type StatusFilter = 'all' | 'sent' | 'failed' | 'queued'

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const merged = useMemo<UnifiedSendRow[]>(() => {
    const all = [
      ...journeyLog.map(unifyJourneyRow),
      ...notificationLog.map(unifyNotificationRow),
    ]
    return all.sort((a, b) => (a.ts < b.ts ? 1 : -1))
  }, [journeyLog, notificationLog])

  const counts = useMemo(() => countByWindow(merged), [merged])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return merged.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q) {
        const hay = `${r.recipient} ${r.subject} ${r.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [merged, sourceFilter, statusFilter, query])

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 18, maxWidth: 760 }}>
        Every email Vital Kauaʻi has sent through Resend, oldest visible going back roughly the last few hundred sends. Use this to confirm sends went out, watch for failures, and verify the system is healthy.
        <span style={{ color: C.dim, display: 'block', marginTop: 4 }}>
          Reload the page to refresh. Member-facing approval emails (setup-link on first approval) currently aren&apos;t recorded here — only resends and founder alerts are.
        </span>
      </div>

      <CatchUpPanel />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 22 }}>
        <StatCard label="Last 24 hours" value={counts.day} sub={`${counts.dayFailed} failed`} highlight={counts.dayFailed > 0} />
        <StatCard label="Last 7 days" value={counts.week} sub={`${counts.weekFailed} failed`} highlight={counts.weekFailed > 0} />
        <StatCard label="Last 30 days" value={counts.month} sub={`${counts.monthFailed} failed`} highlight={counts.monthFailed > 0} />
        <StatCard label="All shown" value={merged.length} sub={`${counts.totalFailed} failed · ${counts.totalQueued} queued`} highlight={counts.totalFailed > 0} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterChip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>All sources</FilterChip>
        <FilterChip active={sourceFilter === 'journey'} onClick={() => setSourceFilter('journey')}>Journey</FilterChip>
        <FilterChip active={sourceFilter === 'transactional'} onClick={() => setSourceFilter('transactional')}>Transactional</FilterChip>
        <div style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '0 4px' }} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Any status</FilterChip>
        <FilterChip active={statusFilter === 'sent'} onClick={() => setStatusFilter('sent')}>Sent</FilterChip>
        <FilterChip active={statusFilter === 'failed'} onClick={() => setStatusFilter('failed')}>Failed</FilterChip>
        <FilterChip active={statusFilter === 'queued'} onClick={() => setStatusFilter('queued')}>Queued</FilterChip>
        <input
          placeholder="Search recipient or subject…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            marginLeft: 'auto',
            background: C.card,
            border: `0.5px solid ${C.border}`,
            color: C.text,
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 12,
            minWidth: 220,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
        Showing {filtered.length} of {merged.length}
      </div>

      <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={logHeaderStyle}>
          <div style={{ flex: '0 0 150px' }}>Sent</div>
          <div style={{ flex: '0 0 180px' }}>Type</div>
          <div style={{ flex: '1 1 220px' }}>Recipient</div>
          <div style={{ flex: '2 1 280px' }}>Subject / payload</div>
          <div style={{ flex: '0 0 80px', textAlign: 'right' }}>Status</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: C.dim, fontSize: 12 }}>
            No sends match these filters.
          </div>
        ) : (
          filtered.map((row) => {
            const expanded = expandedId === row.id
            return (
              <div key={row.id} style={logRowWrapStyle}>
                <button onClick={() => setExpandedId(expanded ? null : row.id)} style={logRowStyle}>
                  <div style={{ flex: '0 0 150px', fontSize: 11, color: C.muted }}>{formatTs(row.ts)}</div>
                  <div style={{ flex: '0 0 180px', fontSize: 11 }}>
                    <SourceBadge source={row.source} />
                    <span style={{ color: C.muted, marginLeft: 6 }}>{row.category}</span>
                  </div>
                  <div style={{ flex: '1 1 220px', fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {row.recipient || <span style={{ color: C.dim }}>—</span>}
                  </div>
                  <div style={{ flex: '2 1 280px', fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {row.subject}
                  </div>
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
                    <StatusPill status={row.status} />
                  </div>
                </button>
                {expanded && (
                  <div style={logDetailStyle}>
                    {row.failure_reason && (
                      <div style={{ color: C.terra, fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: C.dim, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 10, marginRight: 8 }}>Failure</span>
                        {row.failure_reason}
                      </div>
                    )}
                    <div style={{ color: C.dim, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 10, marginBottom: 6 }}>Payload</div>
                    <pre style={{ fontSize: 11, color: C.text, background: C.faint, padding: 10, borderRadius: 4, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {row.detail ? JSON.stringify(row.detail, null, 2) : '(no payload)'}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function countByWindow(rows: UnifiedSendRow[]) {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  let dayCount = 0, dayFailed = 0
  let weekCount = 0, weekFailed = 0
  let monthCount = 0, monthFailed = 0
  let totalFailed = 0, totalQueued = 0

  for (const r of rows) {
    const age = now - new Date(r.ts).getTime()
    if (age <= day) { dayCount++; if (r.status === 'failed') dayFailed++ }
    if (age <= 7 * day) { weekCount++; if (r.status === 'failed') weekFailed++ }
    if (age <= 30 * day) { monthCount++; if (r.status === 'failed') monthFailed++ }
    if (r.status === 'failed') totalFailed++
    if (r.status === 'queued') totalQueued++
  }
  return {
    day: dayCount, dayFailed,
    week: weekCount, weekFailed,
    month: monthCount, monthFailed,
    totalFailed, totalQueued,
  }
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return iso }
}

function StatCard({ label, value, sub, highlight }: { label: string; value: number; sub: string; highlight?: boolean }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${highlight ? C.terra + '99' : C.border}`, borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.dim }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-cormorant-garamond,serif)', color: C.text, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: highlight ? C.terra : C.dim, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.goldBg : 'transparent',
        border: active ? `0.5px solid ${C.gold}66` : `0.5px solid ${C.border}`,
        color: active ? C.text : C.muted,
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 11,
        letterSpacing: '.04em',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function SourceBadge({ source }: { source: 'journey' | 'transactional' }) {
  const isJourney = source === 'journey'
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 9,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 3,
        background: isJourney ? 'rgba(29,107,74,.18)' : C.goldBg,
        color: isJourney ? '#7DCFA8' : C.gold,
        border: `0.5px solid ${isJourney ? '#7DCFA833' : C.gold + '44'}`,
      }}
    >
      {isJourney ? 'Journey' : 'Trans'}
    </span>
  )
}

function StatusPill({ status }: { status: 'sent' | 'failed' | 'queued' }) {
  const styles: Record<typeof status, { bg: string; fg: string; bd: string; label: string }> = {
    sent:   { bg: 'rgba(29,107,74,.22)', fg: '#7DCFA8', bd: '#7DCFA844', label: 'Sent' },
    failed: { bg: 'rgba(201,106,82,.20)', fg: C.terra, bd: C.terra + '66', label: 'Failed' },
    queued: { bg: C.faint, fg: C.muted, bd: C.border, label: 'Queued' },
  }
  const s = styles[status]
  return (
    <span style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 3, background: s.bg, color: s.fg, border: `0.5px solid ${s.bd}` }}>
      {s.label}
    </span>
  )
}

type CatchUpPreview = {
  member_name: string | null
  member_email: string | null
  arc: 'pre' | 'post'
  week_idx: number
  days_late: number
  subject: string
}

function CatchUpPanel() {
  const [busy, setBusy] = useState<'dry' | 'send' | null>(null)
  const [preview, setPreview] = useState<CatchUpPreview[] | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function call(dryRun: boolean) {
    setBusy(dryRun ? 'dry' : 'send')
    setError(null)
    if (dryRun) {
      setPreview(null)
      setResult(null)
    }
    try {
      const res = await fetch('/api/automatic-emails/run-catchup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`)
        return
      }
      if (dryRun) {
        setPreview(body.preview ?? [])
        if ((body.preview ?? []).length === 0) {
          setResult('No journeys are due for catch-up right now.')
        }
      } else {
        const { sent = 0, skipped = 0, errors = 0, message } = body
        setResult(
          errors > 0
            ? `Sent ${sent}, skipped ${skipped}, ${errors} error${errors === 1 ? '' : 's'}.`
            : message
              ? `Done — ${message.replace(/_/g, ' ')}.`
              : `Sent ${sent}, skipped ${skipped}. Reload to see them in the log.`,
        )
        setPreview(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      style={{
        background: C.card,
        border: `0.5px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 16px',
        marginBottom: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Catch-up sender
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 580, lineHeight: 1.55 }}>
            Sends each active journey&apos;s current week if the daily cron missed it. Capped at 14 days late and de-dupes against the log, so it&apos;s safe to run.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => call(true)} disabled={busy !== null} style={btnSecondary}>
            {busy === 'dry' ? 'Checking…' : 'Preview (dry run)'}
          </button>
          <button onClick={() => call(false)} disabled={busy !== null} style={btnPrimary}>
            {busy === 'send' ? 'Sending…' : 'Send catch-up'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.terra }}>Error: {error}</div>
      )}
      {result && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.gold }}>{result}</div>
      )}
      {preview && preview.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Would send {preview.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.map((p, i) => (
              <div key={i} style={{ fontSize: 12, color: C.text, padding: '8px 10px', background: C.faint, borderRadius: 4, border: `0.5px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span>
                    <strong style={{ color: C.text }}>{p.member_name || p.member_email}</strong>
                    <span style={{ color: C.muted }}> · {p.arc === 'pre' ? 'Prep' : 'Integration'} Week {p.week_idx + 1}</span>
                  </span>
                  <span style={{ color: C.dim, fontSize: 11 }}>{p.days_late}d late</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{p.subject} → {p.member_email}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const logHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: C.faint,
  padding: '10px 14px',
  fontSize: 10,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: C.dim,
  borderBottom: `0.5px solid ${C.border}`,
}
const logRowWrapStyle: React.CSSProperties = {
  borderBottom: `0.5px solid ${C.border}`,
  background: C.bg,
}
const logRowStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '10px 14px',
  background: 'transparent',
  border: 0,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'inherit',
}
const logDetailStyle: React.CSSProperties = {
  padding: '4px 14px 14px',
  background: C.faint,
  borderTop: `0.5px dashed ${C.border}`,
}

// ─── Editor sub-components ──────────────────────────────────────────────

function JourneyEditor(props: {
  t: JourneyEmailTemplate
  onPreview: () => void
  onSendTest: () => void
  testStatus: string
  founderEmail: string
}) {
  const { t, onPreview, onSendTest, testStatus, founderEmail } = props
  const arcLabel = t.arc === 'pre' ? 'pre-ceremony' : 'post-ceremony'
  const integrationHref = `/portal/integration/${arcLabel}`

  return (
    <div>
      <EditorHeader
        eyebrow={`${t.arc === 'pre' ? 'Preparation' : 'Integration'} · Week ${t.week_idx + 1}`}
        title={t.principle_name}
        onPreview={onPreview}
        onSendTest={onSendTest}
        saving={false}
        testStatus={testStatus}
      />

      <div style={{ marginTop: 14, padding: '12px 14px', background: C.goldBg, border: `0.5px solid ${C.gold}55`, borderRadius: 6, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        Read-only preview. The values below come straight from the{' '}
        <a href={integrationHref} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, textDecoration: 'underline' }}>
          {t.arc === 'pre' ? 'pre-ceremony' : 'post-ceremony'} integration page
        </a>
        . To change copy, edit the integration page — the next email send picks it up.
      </div>

      <ReadField label="Hawaiian principle name" value={t.principle_name} />
      <ReadField label="Principle quote" value={t.principle} />
      <ReadField label="Theme" value={t.theme} />
      <ReadField label="Email subject" value={t.subject} />
      <ReadField label="Week intro" value={t.intro} multiline />

      <label style={labelStyle}>Action items ({t.action_items.length})</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {t.action_items.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6 }}>
            <span style={{ color: C.gold, fontSize: 14, lineHeight: 1.55 }}>○</span>
            <span style={{ flex: 1, color: C.text, fontSize: 14, lineHeight: 1.55 }}>{a}</span>
          </div>
        ))}
      </div>

      <FooterNote founderEmail={founderEmail}>
        Every email follows the same shape: principle block, week intro, action items, and a button to <strong style={{ color: C.text }}>Open the Member Portal</strong>. Sent automatically the morning a member enters this week.
      </FooterNote>
    </div>
  )
}

function ReadField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <>
      <label style={labelStyle}>{label}</label>
      <div style={{ ...inputStyle, color: C.text, whiteSpace: multiline ? 'pre-wrap' : 'normal', lineHeight: 1.6, minHeight: multiline ? 80 : undefined }}>
        {value}
      </div>
    </>
  )
}

function TransactionalEditor(props: {
  t: TransactionalEmailTemplate
  onChange: (patch: Partial<TransactionalEmailTemplate>) => void
  onSave: () => void
  onPreview: () => void
  onSendTest: () => void
  saving: boolean
  testStatus: string
  founderEmail: string
}) {
  const { t, onChange, onSave, onPreview, onSendTest, saving, testStatus, founderEmail } = props
  const editable = t.editable

  return (
    <div>
      <EditorHeader
        eyebrow={t.audience === 'member' ? 'Member-facing email' : 'Founder alert · display-only'}
        title={t.display_name}
        onSave={editable ? onSave : undefined}
        onPreview={onPreview}
        onSendTest={editable ? onSendTest : undefined}
        saving={saving}
        testStatus={testStatus}
      />

      {t.description && (
        <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6, padding: '12px 14px', marginTop: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          {t.description}
        </div>
      )}

      {t.variables && t.variables.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 11, color: C.dim }}>
          Variables available:{' '}
          {t.variables.map((v, i) => (
            <span key={v}>
              <code style={{ background: C.faint, padding: '1px 6px', borderRadius: 3, color: C.gold }}>{`{{${v}}}`}</code>
              {i < t.variables.length - 1 ? ' ' : ''}
            </span>
          ))}
        </div>
      )}

      <Field
        label="Subject"
        value={t.subject ?? ''}
        onChange={(v) => onChange({ subject: v })}
        readOnly={!editable}
      />

      {editable && (
        <>
          <Field
            label="Eyebrow (small label above heading)"
            value={t.eyebrow ?? ''}
            onChange={(v) => onChange({ eyebrow: v })}
          />
          <Field
            label="Heading (HTML allowed; <em> for italics)"
            value={t.heading ?? ''}
            onChange={(v) => onChange({ heading: v })}
          />
          <Field
            label="Lead paragraph(s) — HTML"
            value={t.lead_html ?? ''}
            onChange={(v) => onChange({ lead_html: v })}
            multiline
            big
          />
          <Field
            label="Body paragraph(s) — optional, HTML"
            value={t.body_html ?? ''}
            onChange={(v) => onChange({ body_html: v })}
            multiline
            big
          />
          <Field
            label="CTA button label"
            value={t.cta_label ?? ''}
            onChange={(v) => onChange({ cta_label: v })}
          />
          <Field
            label="Closing notes — HTML"
            value={t.closing_html ?? ''}
            onChange={(v) => onChange({ closing_html: v })}
            multiline
            big
          />
        </>
      )}

      <FooterNote founderEmail={founderEmail}>
        {editable
          ? <>Edits to this template apply the next time the email is sent. Structural elements (buttons, attachments, login boxes) stay in code — you control the words. <strong style={{ color: C.text }}>Test → me</strong> sends a copy with sample variable values.</>
          : <>This is an internal alert sent to founders only. Listed here for visibility — there&apos;s no member-facing copy to edit.</>}
      </FooterNote>
    </div>
  )
}

// ─── Shared bits ────────────────────────────────────────────────────────

function EditorHeader(props: {
  eyebrow: string
  title: string
  onSave?: () => void
  onPreview: () => void
  onSendTest?: () => void
  saving: boolean
  testStatus: string
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            {props.eyebrow}
          </div>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-cormorant-garamond,serif)', fontWeight: 400, margin: '6px 0 0' }}>
            {props.title}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={props.onPreview} style={btnSecondary}>Preview</button>
          {props.onSendTest && (
            <button onClick={props.onSendTest} style={btnSecondary}>Test → me</button>
          )}
          {props.onSave && (
            <button onClick={props.onSave} disabled={props.saving} style={btnPrimary}>
              {props.saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
      {props.testStatus && (
        <div style={{ marginTop: 12, fontSize: 12, color: props.testStatus.startsWith('Error') ? C.terra : C.gold }}>
          {props.testStatus}
        </div>
      )}
    </>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  big?: boolean
  readOnly?: boolean
}) {
  return (
    <>
      <label style={labelStyle}>{props.label}</label>
      {props.multiline ? (
        <textarea
          style={{ ...inputStyle, minHeight: props.big ? 130 : 90, resize: 'vertical', lineHeight: 1.6 }}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          readOnly={props.readOnly}
        />
      ) : (
        <input
          style={inputStyle}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          readOnly={props.readOnly}
        />
      )}
    </>
  )
}

function FooterNote({ founderEmail, children }: { founderEmail: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28, padding: '12px 14px', background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
      <div style={{ color: C.dim, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 10, marginBottom: 4 }}>How this gets sent</div>
      {children}
      <div style={{ marginTop: 6, color: C.dim }}>Test sends go to <span style={{ color: C.text }}>{founderEmail}</span>.</div>
    </div>
  )
}

function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#222', fontFamily: 'var(--font-jost,sans-serif)' }}>Preview</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
          >Close</button>
        </div>
        <iframe title="Email preview" srcDoc={html} style={{ width: '100%', flex: 1, border: 0 }} />
      </div>
    </div>
  )
}

function relativeWeekDay(arc: JourneyArc, weekIdx: number) {
  if (arc === 'pre') {
    const days = 42 - weekIdx * 7
    return `${days} days before ceremony`
  }
  const days = weekIdx * 7
  return days === 0 ? 'On ceremony day' : `${days} days after ceremony`
}

// ─── Styles ────────────────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  borderRight: `0.5px solid ${C.border}`,
  padding: '16px 12px',
  background: C.bg,
  position: 'sticky',
  top: 56,
  alignSelf: 'flex-start',
  maxHeight: 'calc(100vh - 56px)',
  overflowY: 'auto',
}
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: C.dim,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  padding: '8px 12px 6px',
}
function sidebarItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: active ? C.goldBg : 'transparent',
    border: active ? `0.5px solid ${C.gold}66` : '0.5px solid transparent',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 4,
    cursor: 'pointer',
    color: C.text,
    fontFamily: 'inherit',
  }
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.card,
  border: `0.5px solid ${C.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 14,
  color: C.text,
  fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: C.dim,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  marginBottom: 6,
  marginTop: 18,
}
const btnPrimary: React.CSSProperties = {
  background: C.gold,
  color: '#1a2e1c',
  border: 0,
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: C.muted,
  border: `0.5px solid ${C.border}`,
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 12,
  letterSpacing: '.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `0.5px solid ${C.border}`,
  borderRadius: 6,
  color: C.muted,
  padding: '8px 10px',
  cursor: 'pointer',
  fontSize: 12,
}
const addBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `0.5px dashed ${C.border}`,
  borderRadius: 6,
  color: C.muted,
  padding: '10px 12px',
  cursor: 'pointer',
  fontSize: 12,
  marginTop: 4,
  alignSelf: 'flex-start',
}
