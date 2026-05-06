'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JourneyArc, JourneyEmailTemplate } from '@/lib/journey-emails'

type LogRow = {
  id: string
  arc: string
  week_idx: number
  recipient_email: string
  subject: string
  sent_at: string
}

type Props = {
  templates: JourneyEmailTemplate[]
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

function arcLabel(arc: string) {
  return arc === 'pre' ? 'Preparation' : 'Integration'
}

function relativeWeekDay(arc: JourneyArc, weekIdx: number) {
  // e.g. "Sent 42 days before ceremony" / "Sent 7 days after ceremony"
  if (arc === 'pre') {
    const days = 42 - weekIdx * 7
    return `${days} days before ceremony`
  }
  const days = weekIdx * 7
  return days === 0 ? 'On ceremony day' : `${days} days after ceremony`
}

export default function AutomaticEmailsPanel({ templates, recentLog, founderEmail }: Props) {
  const [items, setItems] = useState<JourneyEmailTemplate[]>(templates)
  const [activeKey, setActiveKey] = useState<string>(`${templates[0]?.arc}|${templates[0]?.week_idx}`)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<string>('')

  const active = useMemo(
    () => items.find((t) => `${t.arc}|${t.week_idx}` === activeKey) ?? items[0],
    [items, activeKey],
  )

  function update(key: string, patch: Partial<JourneyEmailTemplate>) {
    setItems((prev) =>
      prev.map((t) => (`${t.arc}|${t.week_idx}` === key ? { ...t, ...patch } : t)),
    )
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
      if (error) {
        alert(`Save failed: ${error.message}`)
      }
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
    if (!res.ok) {
      alert('Preview failed')
      return
    }
    const { html } = await res.json()
    setPreviewHtml(html)
  }

  async function handleSendTest(t: JourneyEmailTemplate) {
    setTestStatus('Sending...')
    try {
      const res = await fetch('/api/automatic-emails/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: t, to: founderEmail }),
      })
      const body = await res.json()
      if (!res.ok) {
        setTestStatus(`Error: ${body.error || res.statusText}`)
      } else {
        setTestStatus(`Sent to ${founderEmail}`)
      }
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setTimeout(() => setTestStatus(''), 4000)
  }

  function updateAction(t: JourneyEmailTemplate, idx: number, value: string) {
    const next = [...t.action_items]
    next[idx] = value
    update(`${t.arc}|${t.week_idx}`, { action_items: next })
  }

  function addAction(t: JourneyEmailTemplate) {
    update(`${t.arc}|${t.week_idx}`, { action_items: [...t.action_items, ''] })
  }

  function removeAction(t: JourneyEmailTemplate, idx: number) {
    const next = t.action_items.filter((_, i) => i !== idx)
    update(`${t.arc}|${t.week_idx}`, { action_items: next })
  }

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
          12 weekly emails sent to active members — six during preparation, six during integration.
          Cron runs daily at 6am Hawaii. Each email is sent the morning the member enters that week.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, alignItems: 'stretch' }}>
        {/* ── Sidebar: list of 12 ── */}
        <aside
          style={{
            borderRight: `0.5px solid ${C.border}`,
            padding: '16px 12px',
            background: C.bg,
            position: 'sticky',
            top: 56,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 56px)',
            overflowY: 'auto',
          }}
        >
          {(['pre', 'post'] as JourneyArc[]).map((arc) => (
            <div key={arc} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 12px 6px' }}>
                {arcLabel(arc)} — 6 weeks
              </div>
              {items
                .filter((t) => t.arc === arc)
                .map((t) => {
                  const k = `${t.arc}|${t.week_idx}`
                  const isActive = k === activeKey
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveKey(k)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: isActive ? C.goldBg : 'transparent',
                        border: isActive ? `0.5px solid ${C.gold}66` : '0.5px solid transparent',
                        borderRadius: 8,
                        padding: '10px 12px',
                        marginBottom: 4,
                        cursor: 'pointer',
                        color: C.text,
                      }}
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
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Recent sends
              </div>
              {recentLog.slice(0, 8).map((row) => (
                <div key={row.id} style={{ fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 1.4 }}>
                  <div style={{ color: C.text }}>{row.recipient_email}</div>
                  <div style={{ color: C.dim }}>
                    {arcLabel(row.arc)} W{row.week_idx + 1} · {new Date(row.sent_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Editor ── */}
        <main style={{ padding: '24px 28px', maxWidth: 820 }}>
          {active && (
            <Editor
              key={`${active.arc}|${active.week_idx}`}
              t={active}
              onChange={(patch) => update(`${active.arc}|${active.week_idx}`, patch)}
              onUpdateAction={(i, v) => updateAction(active, i, v)}
              onAddAction={() => addAction(active)}
              onRemoveAction={(i) => removeAction(active, i)}
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

      {/* Preview modal */}
      {previewHtml && (
        <div
          onClick={() => setPreviewHtml(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
            zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 8, width: '100%', maxWidth: 720,
              maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#222', fontFamily: 'var(--font-jost,sans-serif)' }}>Preview</span>
              <button
                onClick={() => setPreviewHtml(null)}
                style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                Close
              </button>
            </div>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              style={{ width: '100%', flex: 1, border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor sub-component ──────────────────────────────────────

function Editor(props: {
  t: JourneyEmailTemplate
  onChange: (patch: Partial<JourneyEmailTemplate>) => void
  onUpdateAction: (i: number, v: string) => void
  onAddAction: () => void
  onRemoveAction: (i: number) => void
  onSave: () => void
  onPreview: () => void
  onSendTest: () => void
  saving: boolean
  testStatus: string
  founderEmail: string
}) {
  const { t, onChange, onUpdateAction, onAddAction, onRemoveAction, onSave, onPreview, onSendTest, saving, testStatus, founderEmail } = props

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            {t.arc === 'pre' ? 'Preparation' : 'Integration'} · Week {t.week_idx + 1}
          </div>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-cormorant-garamond,serif)', fontWeight: 400, margin: '6px 0 0' }}>
            {t.principle_name}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onPreview} style={btnSecondary}>Preview</button>
          <button onClick={onSendTest} style={btnSecondary}>Test → me</button>
          <button onClick={onSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {testStatus && (
        <div style={{ marginTop: 12, fontSize: 12, color: testStatus.startsWith('Error') ? C.terra : C.gold }}>
          {testStatus}
        </div>
      )}

      <label style={labelStyle}>Hawaiian principle name</label>
      <input
        style={inputStyle}
        value={t.principle_name}
        onChange={(e) => onChange({ principle_name: e.target.value })}
      />

      <label style={labelStyle}>Principle quote</label>
      <input
        style={inputStyle}
        value={t.principle}
        onChange={(e) => onChange({ principle: e.target.value })}
      />

      <label style={labelStyle}>Theme</label>
      <input
        style={inputStyle}
        value={t.theme}
        onChange={(e) => onChange({ theme: e.target.value })}
      />

      <label style={labelStyle}>Email subject</label>
      <input
        style={inputStyle}
        value={t.subject}
        onChange={(e) => onChange({ subject: e.target.value })}
      />

      <label style={labelStyle}>Week intro</label>
      <textarea
        style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.6 }}
        value={t.intro}
        onChange={(e) => onChange({ intro: e.target.value })}
      />

      <label style={labelStyle}>Action items ({t.action_items.length})</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {t.action_items.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: C.gold, marginTop: 12, fontSize: 14 }}>○</span>
            <textarea
              style={{ ...inputStyle, minHeight: 44, resize: 'vertical', flex: 1 }}
              value={a}
              onChange={(e) => onUpdateAction(i, e.target.value)}
            />
            <button
              onClick={() => onRemoveAction(i)}
              style={{
                background: 'transparent',
                border: `0.5px solid ${C.border}`,
                borderRadius: 6,
                color: C.muted,
                padding: '8px 10px',
                cursor: 'pointer',
                fontSize: 12,
              }}
              aria-label="Remove action"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={onAddAction}
          style={{
            background: 'transparent',
            border: `0.5px dashed ${C.border}`,
            borderRadius: 6,
            color: C.muted,
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 12,
            marginTop: 4,
            alignSelf: 'flex-start',
          }}
        >
          + Add action item
        </button>
      </div>

      <div style={{ marginTop: 28, padding: '12px 14px', background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <div style={{ color: C.dim, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 10, marginBottom: 4 }}>How this gets sent</div>
        Every email follows the same shape: principle block, week intro, action items, and a button to <strong style={{ color: C.text }}>Open the Member Portal</strong>. Sent automatically on the day each member enters this week. &ldquo;Test → me&rdquo; sends a copy to <span style={{ color: C.text }}>{founderEmail}</span>.
      </div>
    </div>
  )
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
}
