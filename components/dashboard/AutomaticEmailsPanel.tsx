'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JourneyArc, JourneyEmailTemplate } from '@/lib/journey-emails'
import type { TransactionalEmailTemplate } from '@/lib/transactional-emails'

type LogRow = {
  id: string
  arc: string
  week_idx: number
  recipient_email: string
  subject: string
  sent_at: string
}

type Props = {
  journeyTemplates: JourneyEmailTemplate[]
  transactionalTemplates: TransactionalEmailTemplate[]
  recentLog: LogRow[]
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

type Mode = 'journey' | 'transactional'

export default function AutomaticEmailsPanel({
  journeyTemplates,
  transactionalTemplates,
  recentLog,
  founderEmail,
}: Props) {
  const [mode, setMode] = useState<Mode>('journey')

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

        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          <ModeTab active={mode === 'journey'} onClick={() => setMode('journey')}>
            Journey Emails ({journeyTemplates.length})
          </ModeTab>
          <ModeTab active={mode === 'transactional'} onClick={() => setMode('transactional')}>
            Transactional Emails ({transactionalTemplates.length})
          </ModeTab>
        </div>
      </div>

      {mode === 'journey' ? (
        <JourneySection
          templates={journeyTemplates}
          recentLog={recentLog}
          founderEmail={founderEmail}
        />
      ) : (
        <TransactionalSection
          templates={transactionalTemplates}
          founderEmail={founderEmail}
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
  templates: initialTemplates,
  recentLog,
  founderEmail,
}: {
  templates: JourneyEmailTemplate[]
  recentLog: LogRow[]
  founderEmail: string
}) {
  const [items, setItems] = useState<JourneyEmailTemplate[]>(initialTemplates)
  const [activeKey, setActiveKey] = useState<string>(`${initialTemplates[0]?.arc}|${initialTemplates[0]?.week_idx}`)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string>('')

  const active = useMemo(
    () => items.find((t) => `${t.arc}|${t.week_idx}` === activeKey) ?? items[0],
    [items, activeKey],
  )

  function update(key: string, patch: Partial<JourneyEmailTemplate>) {
    setItems((prev) => prev.map((t) => (`${t.arc}|${t.week_idx}` === key ? { ...t, ...patch } : t)))
  }

  async function handleSave(t: JourneyEmailTemplate) {
    const key = `${t.arc}|${t.week_idx}`
    setSavingKey(key)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('journey_email_templates')
        .update({
          principle_name: t.principle_name,
          principle: t.principle,
          theme: t.theme,
          subject: t.subject,
          intro: t.intro,
          action_items: t.action_items,
          updated_at: new Date().toISOString(),
        })
        .eq('arc', t.arc)
        .eq('week_idx', t.week_idx)
      if (error) alert(`Save failed: ${error.message}`)
    } finally {
      setSavingKey(null)
    }
  }

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
          {(['pre', 'post'] as JourneyArc[]).map((arc) => (
            <div key={arc} style={{ marginBottom: 18 }}>
              <div style={sectionLabelStyle}>{arc === 'pre' ? 'Preparation' : 'Integration'} — 6 weeks</div>
              {items
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
              onChange={(patch) => update(`${active.arc}|${active.week_idx}`, patch)}
              onSave={() => handleSave(active)}
              onPreview={() => handlePreview(active)}
              onSendTest={() => handleSendTest(active)}
              saving={savingKey === `${active.arc}|${active.week_idx}`}
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

// ─── Editor sub-components ──────────────────────────────────────────────

function JourneyEditor(props: {
  t: JourneyEmailTemplate
  onChange: (patch: Partial<JourneyEmailTemplate>) => void
  onSave: () => void
  onPreview: () => void
  onSendTest: () => void
  saving: boolean
  testStatus: string
  founderEmail: string
}) {
  const { t, onChange, onSave, onPreview, onSendTest, saving, testStatus, founderEmail } = props

  function updateAction(idx: number, value: string) {
    const next = [...t.action_items]
    next[idx] = value
    onChange({ action_items: next })
  }

  return (
    <div>
      <EditorHeader
        eyebrow={`${t.arc === 'pre' ? 'Preparation' : 'Integration'} · Week ${t.week_idx + 1}`}
        title={t.principle_name}
        onSave={onSave}
        onPreview={onPreview}
        onSendTest={onSendTest}
        saving={saving}
        testStatus={testStatus}
      />

      <Field label="Hawaiian principle name" value={t.principle_name} onChange={(v) => onChange({ principle_name: v })} />
      <Field label="Principle quote" value={t.principle} onChange={(v) => onChange({ principle: v })} />
      <Field label="Theme" value={t.theme} onChange={(v) => onChange({ theme: v })} />
      <Field label="Email subject" value={t.subject} onChange={(v) => onChange({ subject: v })} />
      <Field label="Week intro" value={t.intro} onChange={(v) => onChange({ intro: v })} multiline />

      <label style={labelStyle}>Action items ({t.action_items.length})</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {t.action_items.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: C.gold, marginTop: 12, fontSize: 14 }}>○</span>
            <textarea
              style={{ ...inputStyle, minHeight: 44, resize: 'vertical', flex: 1 }}
              value={a}
              onChange={(e) => updateAction(i, e.target.value)}
            />
            <button
              onClick={() => onChange({ action_items: t.action_items.filter((_, j) => j !== i) })}
              style={removeBtnStyle}
              aria-label="Remove action"
            >×</button>
          </div>
        ))}
        <button
          onClick={() => onChange({ action_items: [...t.action_items, ''] })}
          style={addBtnStyle}
        >+ Add action item</button>
      </div>

      <FooterNote founderEmail={founderEmail}>
        Every email follows the same shape: principle block, week intro, action items, and a button to <strong style={{ color: C.text }}>Open the Member Portal</strong>. Sent automatically the morning a member enters this week.
      </FooterNote>
    </div>
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
