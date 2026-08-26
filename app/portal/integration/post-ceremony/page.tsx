'use client'

import { Fragment, Suspense, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { POST_CEREMONY_WEEKS, POST_PNE_DETAILS } from '@/lib/journal-prompts'
import { companionsFor } from '@/lib/pne-companions'
import SectionIndex, { type SectionIndexItem } from '@/components/portal/SectionIndex'
import HeroCountdown from '@/components/portal/HeroCountdown'
import SessionBookingCard from '@/components/portal/SessionBookingCard'
import {
  WEEKS,
  actionsForWeek,
  type ActionLinkArr,
  type ActionCard,
} from '@/lib/integration-content/post-ceremony-weeks'

// Section index per week, same six entries every week, plus a Completion
// anchor on Week 6 (the integration-statement + checklist + monthly-arc
// block is rendered there).
const BASE_SECTIONS: SectionIndexItem[] = [
  { label: 'Principle', anchor: '#principle' },
  { label: 'Video',     anchor: '#week-video' },
  { label: 'Actions',   anchor: '#action-items' },
  { label: 'Journal',   anchor: '#journal-prompts' },
  { label: 'PNE',       anchor: '#pne-perspective' },
  { label: 'Community', anchor: '#community' },
]
const sectionsForWeek = (_weekIdx: number): SectionIndexItem[] => BASE_SECTIONS

// Render an action's text with optional inline links. Each link matches a
// substring in `text` and is replaced with an anchor tag in place.
function renderActionText(
  text: string,
  links?: { text: string; href: string; external?: boolean }[],
) {
  if (!links || links.length === 0) return text
  type Seg = string | { text: string; href: string; external?: boolean }
  let segments: Seg[] = [text]
  for (const link of links) {
    const next: Seg[] = []
    for (const seg of segments) {
      if (typeof seg !== 'string') { next.push(seg); continue }
      const idx = seg.indexOf(link.text)
      if (idx === -1) { next.push(seg); continue }
      if (idx > 0) next.push(seg.slice(0, idx))
      next.push(link)
      const rest = seg.slice(idx + link.text.length)
      if (rest) next.push(rest)
    }
    segments = next
  }
  return segments.map((seg, i) => {
    if (typeof seg === 'string') return <Fragment key={i}>{seg}</Fragment>
    // Hash-only links scroll the current page — keep them in the same tab.
    // Everything else (internal route or external URL) opens in a new tab so
    // members don't lose their place on the week page.
    const isHashOnly = seg.href.startsWith('#')
    return (
      <a
        key={i}
        href={seg.href}
        target={isHashOnly ? undefined : '_blank'}
        rel={isHashOnly ? undefined : 'noopener noreferrer'}
        onClick={
          isHashOnly
            ? (e) => {
                const target = document.querySelector(`.pc-panel.active ${seg.href}`)
                if (target) {
                  e.preventDefault()
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }
            : undefined
        }
        style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed rgba(200,169,110,.55)' }}
      >
        {seg.text}
      </a>
    )
  })
}

// ─── Return-practice calendar helpers ─────────────────────
function returnDates(): { months: number; label: string; date: Date }[] {
  const base = new Date()
  base.setHours(9, 0, 0, 0)
  const add = (m: number) => {
    const d = new Date(base)
    d.setMonth(d.getMonth() + m)
    return d
  }
  return [
    { months: 3,  label: '3-month integration return',  date: add(3)  },
    { months: 6,  label: '6-month integration return',  date: add(6)  },
    { months: 12, label: '1-year integration return',   date: add(12) },
  ]
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function downloadReturnICS() {
  if (typeof window === 'undefined') return
  const now = new Date()
  const stamp = toICSDate(now)
  const desc = 'Return to your Vital Kauaʻi integration portal. Notice what has moved, what has deepened, what still asks for attention.\\n\\nhttps://vitalkauai.com/portal/integration/post-ceremony'
  const events = returnDates().map((r, i) => {
    const end = new Date(r.date.getTime() + 30 * 60 * 1000)
    return [
      'BEGIN:VEVENT',
      `UID:vk-return-${i}-${Date.now()}@vitalkauai`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toICSDate(r.date)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:Vital Kauaʻi · ${r.label}`,
      `DESCRIPTION:${desc}`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vital Kauaʻi//Integration Returns//EN',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vital-kauai-integration-returns.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function returnMailto(): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const lines = returnDates().map((r) => `• ${r.label}, ${fmt(r.date)}`).join('\n')
  const body =
    'A gentle reminder to return to your Vital Kauaʻi integration portal at these three markers:\n\n' +
    lines +
    '\n\nWhen each arrives, return and notice what has moved.\n\n' +
    'https://vitalkauai.com/portal/integration/post-ceremony'
  return `mailto:?subject=${encodeURIComponent('Vital Kauaʻi · Integration return dates')}&body=${encodeURIComponent(body)}`
}

// ─── Types ────────────────────────────────────────────────
type WeekTracking = {
  regulation: number        // 1–10
  practice_days: number     // 0–7
  patterns_returned: boolean
  patterns_intensity: number // 1–10, only if patterns_returned
  completed: boolean
}

type MonthlyTracking = {
  alignment: number         // 1–10
  patterns_returned: boolean
  practice_maintained: boolean
}

// Per-week PNE Companion theme + URL, filtered from the shared companion
// registry. Live weeks get a hash-anchored deep-link to #top; coming-soon
// weeks render their theme as plain text.
const POST_PNE_COMPANION: ReadonlyArray<{ theme: string; url: string; videoUrl?: string }> =
  companionsFor('post').map((c) => ({
    theme: c.title,
    url: c.status === 'live' ? `${c.href}#top` : '',
    videoUrl: c.videoUrl,
  }))

const DOT: Record<string, string> = {
  blue: '#4A7FA5', green: '#7A9E7E', gold: '#C8A96E', sage: '#7A9E7E', amber: '#B8956A',
}

// ─── Weekly Check-in Modal ────────────────────────────────
function WeeklyCheckIn({
  weekIdx, onComplete, onCancel, previousTracking
}: {
  weekIdx: number
  onComplete: (data: Omit<WeekTracking, 'completed'>) => void
  onCancel: () => void
  previousTracking: WeekTracking | null
}) {
  const [regulation, setRegulation] = useState(7)
  const [practiceDays, setPracticeDays] = useState(4)
  const [patternsReturned, setPatternsReturned] = useState(false)
  const [patternsIntensity, setPatternsIntensity] = useState(5)
  const [honest, setHonest] = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(14,26,16,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#FDFBF7', borderRadius: 6, maxWidth: 520, width: '100%',
        padding: '40px 44px', border: '0.5px solid rgba(200,169,110,0.25)'
      }}>
        <div style={{ fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: 8 }}>
          Before you complete Week {weekIdx + 1}
        </div>
        <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: '#1A1A18', marginBottom: 6, lineHeight: 1.2 }}>
          Weekly check-in
        </h3>
        <p style={{ fontSize: 12.5, color: '#8B8070', marginBottom: 28, lineHeight: 1.7 }}>
          A short reflection to help you notice what is moving and surface anything that wants more support. Be honest, this is for you.
        </p>

        {/* Previous week context */}
        {previousTracking && (
          <div style={{
            background: 'rgba(28,43,30,0.04)', border: '0.5px solid rgba(28,43,30,0.1)',
            borderRadius: 4, padding: '12px 16px', marginBottom: 22,
            display: 'flex', gap: 20, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B8070', alignSelf: 'center', flexShrink: 0 }}>Last week</span>
            <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
              Regulation <strong style={{ color: '#C8A96E' }}>{previousTracking.regulation}/10</strong>
            </span>
            <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
              Practice <strong style={{ color: '#C8A96E' }}>{previousTracking.practice_days}/7 days</strong>
            </span>
            {previousTracking.patterns_returned && (
              <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
                Patterns <strong style={{ color: '#A85555' }}>returned ({previousTracking.patterns_intensity}/10)</strong>
              </span>
            )}
          </div>
        )}

        {/* Regulation */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            How regulated do you feel this week? <span style={{ color: '#C8A96E', fontWeight: 500 }}>{regulation}/10</span>
          </label>
          <input type="range" min={1} max={10} value={regulation}
            onChange={e => setRegulation(+e.target.value)}
            style={{ width: '100%', accentColor: '#C8A96E' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8B8070', marginTop: 4 }}>
            <span>Dysregulated</span><span>Fully grounded</span>
          </div>
        </div>

        {/* Practice days */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            Days you completed your daily practice this week: <span style={{ color: '#C8A96E', fontWeight: 500 }}>{practiceDays}/7</span>
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2,3,4,5,6,7].map(d => (
              <button key={d} onClick={() => setPracticeDays(d)} style={{
                width: 36, height: 36, borderRadius: 4, border: '1px solid',
                borderColor: practiceDays === d ? '#C8A96E' : 'rgba(28,43,30,0.15)',
                background: practiceDays === d ? 'rgba(200,169,110,0.12)' : 'white',
                color: practiceDays === d ? '#C8A96E' : '#8B8070',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Jost, sans-serif',
                fontWeight: practiceDays === d ? 500 : 300,
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Patterns */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            Did old patterns return this week?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{label: 'Yes', val: true}, {label: 'No', val: false}].map(({label, val}) => (
              <button key={label} onClick={() => setPatternsReturned(val)} style={{
                padding: '8px 22px', borderRadius: 3, border: '1px solid',
                borderColor: patternsReturned === val ? '#C8A96E' : 'rgba(28,43,30,0.15)',
                background: patternsReturned === val ? 'rgba(200,169,110,0.1)' : 'white',
                color: patternsReturned === val ? '#C8A96E' : '#8B8070',
                fontSize: 12, cursor: 'pointer', fontFamily: 'Jost, sans-serif',
              }}>{label}</button>
            ))}
          </div>
          {patternsReturned && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 8 }}>
                Intensity: <span style={{ color: '#C8A96E', fontWeight: 500 }}>{patternsIntensity}/10</span>
              </label>
              <input type="range" min={1} max={10} value={patternsIntensity}
                onChange={e => setPatternsIntensity(+e.target.value)}
                style={{ width: '100%', accentColor: '#A85555' }} />
            </div>
          )}
        </div>

        {/* Honest confirmation */}
        <div style={{
          background: 'rgba(200,169,110,0.06)', border: '0.5px solid rgba(200,169,110,0.2)',
          borderRadius: 4, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 12, alignItems: 'flex-start'
        }}>
          <input type="checkbox" id="honest" checked={honest}
            onChange={e => setHonest(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#C8A96E', flexShrink: 0 }} />
          <label htmlFor="honest" style={{ fontSize: 12.5, color: '#3D3D38', lineHeight: 1.65, cursor: 'pointer' }}>
            I completed this week honestly, including the actions that were most difficult, and the parts I would rather have skipped.
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px 0', background: 'none',
            border: '0.5px solid rgba(28,43,30,0.2)', borderRadius: 3,
            fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: '#8B8070', cursor: 'pointer', fontFamily: 'Jost, sans-serif',
          }}>Go back</button>
          <button
            disabled={!honest}
            onClick={() => onComplete({ regulation, practice_days: practiceDays, patterns_returned: patternsReturned, patterns_intensity: patternsIntensity })}
            style={{
              flex: 2, padding: '12px 0',
              background: honest ? '#C8A96E' : 'rgba(200,169,110,0.25)',
              border: 'none', borderRadius: 3,
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: honest ? '#0E1A10' : '#8B8070',
              cursor: honest ? 'pointer' : 'not-allowed', fontFamily: 'Jost, sans-serif',
              fontWeight: 500, transition: 'all 0.2s',
            }}>
            Complete Week {weekIdx + 1}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Progress Insights ───────────────────────────────────
function ProgressInsights({ tracking }: { tracking: Record<number, WeekTracking> }) {
  const entries = Object.entries(tracking)
    .filter(([, t]) => t.completed)
    .sort(([a], [b]) => +a - +b)
    .map(([, t]) => t)

  if (entries.length < 1) return null

  const first = entries[0]
  const latest = entries[entries.length - 1]
  const hasMultiple = entries.length >= 2

  // Regulation
  const regFirst = first.regulation
  const regLatest = latest.regulation
  const regDelta = hasMultiple ? regLatest - regFirst : null
  const regUp = regDelta !== null && regDelta > 0
  const regDown = regDelta !== null && regDelta < 0

  // Practice average across all completed weeks
  const avgPractice = Math.round(entries.reduce((s, t) => s + t.practice_days, 0) / entries.length * 10) / 10

  // Pattern intensity trend
  const withPatterns = entries.filter(t => t.patterns_returned)
  const patternDelta = withPatterns.length >= 2
    ? withPatterns[withPatterns.length - 1].patterns_intensity - withPatterns[0].patterns_intensity
    : null
  const patternsEasing = patternDelta !== null && patternDelta < 0

  const Arrow = ({ up }: { up: boolean }) => (
    <span style={{ fontSize: 11, marginLeft: 4, color: up ? '#7A9E7E' : '#A85555' }}>
      {up ? '↑' : '↓'}
    </span>
  )

  return (
    <div style={{
      background: 'rgba(28,43,30,0.03)',
      borderBottom: '0.5px solid rgba(28,43,30,0.08)',
      padding: '12px 48px',
      display: 'flex', alignItems: 'center', gap: 0,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase',
        color: '#8B8070', marginRight: 28, flexShrink: 0,
      }}>Your progress</span>

      {/* Regulation */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 28, gap: 0 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Regulation</span>
        {hasMultiple ? (
          <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            {regFirst}
            <span style={{ color: '#C8A96E', margin: '0 5px', fontSize: 11 }}>→</span>
            {regLatest}
            {regDelta !== 0 && <Arrow up={regUp} />}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            {regLatest}/10
          </span>
        )}
      </div>

      {/* Practice */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 28, gap: 0 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Practice</span>
        <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
          {avgPractice}
          <span style={{ fontSize: 10, color: '#8B8070', marginLeft: 2 }}>/7 days avg</span>
          {avgPractice >= 5 && <span style={{ fontSize: 11, color: '#7A9E7E', marginLeft: 4 }}>↑</span>}
        </span>
      </div>

      {/* Patterns easing */}
      {patternsEasing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Patterns</span>
          <span style={{ fontSize: 13, color: '#7A9E7E', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            easing ↓
          </span>
        </div>
      )}

      {/* Encouragement line, contextual */}
      {hasMultiple && (
        <span style={{
          marginLeft: 'auto', fontSize: 11.5, color: '#8B8070',
          fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
          fontWeight: 300,
        }}>
          {regUp && regDelta! >= 2
            ? `Regulation improved by ${regDelta} points.`
            : regDown
            ? 'Harder weeks are part of the arc.'
            : avgPractice >= 5
            ? 'Consistency is showing.'
            : 'Keep going.'}
        </span>
      )}
    </div>
  )
}

// ─── Journal sync map: post-ceremony key → member_journals key ───────────────
const POST_TO_JOURNAL_MAP: Record<string, string> = {
  'w1-p2': 'p1-4',  // "What did the medicine show me about my own nature..."
  'w2-p2': 'p1-8',  // "Looking back at the intentions I set before ceremony..."
  'w4-p4': 'p2-6',  // "Where is forgiveness still alive..."
  'w5-p0': 'p2-9',  // "Who am I now, compared to who I was when I arrived at ceremony?"
  'w5-p2': 'p2-8',  // "How has my sense of purpose or direction shifted?"
}

// ─── Main component ───────────────────────────────────────
function PostCeremonyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [activeWeek, setActiveWeek] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [weeklyTracking, setWeeklyTracking] = useState<Record<number, WeekTracking>>({})
  const [journal, setJournal] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [checkInWeek, setCheckInWeek] = useState<number | null>(null)

  // ── Sync activeWeek with #week-N hash so dropdown links can deep-link.
  useEffect(() => {
    const applyHash = () => {
      const m = /^#week-([1-6])$/.exec(window.location.hash)
      if (m) setActiveWeek(Number(m[1]) - 1)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  // ── Re-apply ?week=N whenever the query changes. The Journey wayfinder
  // soft-navigates here with a fresh token each tap; the App Router keeps
  // this component mounted across a search-param-only change, so the mount
  // effect below never re-runs. Subscribing to searchParams lets a repeat
  // tap re-snap to the current calendar week even if the member had browsed
  // to a different week in the meantime.
  useEffect(() => {
    const n = parseInt(searchParams.get('week') ?? '', 10)
    if (Number.isInteger(n) && n >= 1 && n <= 6) {
      setActiveWeek(n - 1)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      // ?week=N (1–6) forces a specific week and skips the resume-where-you-
      // left-off behavior. Used by the /portal/journey wayfinder so the
      // Journey tab lands on the member's current calendar week.
      const params = new URLSearchParams(window.location.search)
      const weekParam = parseInt(params.get('week') ?? '', 10)
      const forcedWeek =
        Number.isInteger(weekParam) && weekParam >= 1 && weekParam <= 6
          ? weekParam - 1
          : null

      // #week-N (from the nav dropdown) forces a specific week so the resume
      // logic below doesn't overwrite the deep-link selection.
      const hashMatch = /^#week-([1-6])$/.exec(window.location.hash)
      const hashWeek = hashMatch ? Number(hashMatch[1]) - 1 : null
      const explicitWeek = forcedWeek ?? hashWeek

      const { data } = await supabase
        .from('post_ceremony_progress')
        .select('*')
        .eq('member_id', user.id)
        .single()
      if (data) {
        const done = new Set<number>(data.weeks_completed ?? [])
        setCompleted(done)
        setChecklist(data.checklist_items ?? {})
        setWeeklyTracking(data.weekly_tracking ?? {})
        setJournal(data.journal_responses ?? {})
        if (explicitWeek !== null) {
          setActiveWeek(explicitWeek)
        } else {
          const next = [0,1,2,3,4,5].find(w => !done.has(w))
          setActiveWeek(next !== undefined ? next : 5)
        }
      } else if (explicitWeek !== null) {
        setActiveWeek(explicitWeek)
      }

      if (forcedWeek !== null) {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }

      setLoading(false)
    }
    load()
  }, [])

  const save = useCallback(async (
    newCompleted: Set<number>,
    newChecklist: Record<string, boolean>,
    newTracking: Record<number, WeekTracking>,
    newJournal?: Record<string, string>
  ) => {
    if (!userId) return
    setSaveStatus('saving')
    await supabase.from('post_ceremony_progress').upsert({
      member_id: userId,
      weeks_completed: [...newCompleted],
      checklist_items: newChecklist,
      weekly_tracking: newTracking,
      journal_responses: newJournal ?? journal,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2200)
  }, [userId, journal])

  const syncToMainJournal = useCallback(async (integJournal: Record<string, string>, changedKey: string) => {
    if (!userId || !POST_TO_JOURNAL_MAP[changedKey]) return
    const updates: Record<string, string> = {}
    for (const [integKey, journalKey] of Object.entries(POST_TO_JOURNAL_MAP)) {
      if (integJournal[integKey]) updates[journalKey] = integJournal[integKey]
    }
    if (Object.keys(updates).length === 0) return
    const { data } = await supabase.from('member_journals').select('responses').eq('member_id', userId).maybeSingle()
    const merged = { ...((data?.responses as Record<string, string>) ?? {}), ...updates }
    await supabase.from('member_journals').upsert({ member_id: userId, responses: merged, last_saved_at: new Date().toISOString() }, { onConflict: 'member_id' })
  }, [userId])

  // Journal auto-save with debounce
  const journalTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const updateJournal = (key: string, value: string) => {
    const next = { ...journal, [key]: value }
    setJournal(next)
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current)
    journalTimerRef.current = setTimeout(() => {
      save(completed, checklist, weeklyTracking, next)
      syncToMainJournal(next, key)
    }, 1500)
  }

  const handleCheckInComplete = async (weekIdx: number, data: Omit<WeekTracking, 'completed'>) => {
    setCheckInWeek(null)
    const newTracking = { ...weeklyTracking, [weekIdx]: { ...data, completed: true } }
    const newCompleted = new Set(completed)
    newCompleted.add(weekIdx)
    setWeeklyTracking(newTracking)
    setCompleted(newCompleted)
    setTimeout(() => {
      setActiveWeek(Math.min(weekIdx + 1, 5))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 350)
    await save(newCompleted, checklist, newTracking)
  }

  const toggleCheck = async (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next)
    await save(completed, next, weeklyTracking)
  }

  const progress = Math.round((completed.size / 6) * 100)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E1A10', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8A96E', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      <style>{`@keyframes pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )

  return (
    <>
      {checkInWeek !== null && (
        <WeeklyCheckIn
          weekIdx={checkInWeek}
          onComplete={(data) => handleCheckInComplete(checkInWeek, data)}
          onCancel={() => setCheckInWeek(null)}
          previousTracking={checkInWeek > 0 ? (weeklyTracking[checkInWeek - 1] ?? null) : null}
        />
      )}

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--forest:#1C2B1E;--deep:#0E1A10;--sage:#7A9E7E;--sage-lt:#A8C5AC;--gold:#C8A96E;--cream:#F5F0E8;--warm:#FDFBF7;--stone:#8B8070;--ink:#1A1A18;--ink-mid:#3D3D38;--border:rgba(28,43,30,0.12);--border-lt:rgba(28,43,30,0.06)}
        html{scroll-behavior:smooth}body{font-family:'Jost',sans-serif;font-weight:300;background:var(--warm);color:var(--ink)}
        .pc-nav{position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-bottom:1px solid rgba(200,169,110,.08)}
        .pc-nav-left{display:flex;align-items:center;gap:32px}.pc-logo{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:var(--cream);text-decoration:none}.pc-logo em{font-style:italic;color:var(--sage-lt)}
        .pc-nav-links{display:flex;align-items:center;gap:4px}.pc-nav-link{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border:none;background:none;font-family:inherit;cursor:pointer;transition:color .2s}.pc-nav-link:hover{color:var(--cream)}
        .pc-dropdown{position:relative}.pc-dropdown-trigger{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--sage-lt);padding:6px 14px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px}.pc-dropdown-trigger::after{content:'▾';font-size:8px;color:var(--gold)}
        .pc-dropdown-menu{display:none;position:absolute;top:calc(100% + 10px);left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:190px;padding:8px 0;box-shadow:0 16px 40px rgba(0,0,0,.4)}.pc-dropdown:hover .pc-dropdown-menu{display:block}
        .pc-dropdown-item{display:block;padding:10px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.55);text-decoration:none;transition:color .15s,background .15s;border-left:2px solid transparent}.pc-dropdown-item:hover{color:var(--cream);background:rgba(122,158,126,.06)}.pc-dropdown-item.current{color:var(--sage-lt);border-left-color:var(--sage)}
        .pc-nav-right{display:flex;align-items:center;gap:14px}.pc-nav-email{font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc-nav-out{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.5);background:none;border:none;cursor:pointer;font-family:inherit;transition:color .2s}.pc-nav-out:hover{color:var(--gold)}
        .pc-prog{background:rgba(28,43,30,.06);border-bottom:1px solid var(--border-lt);padding:14px 48px;display:flex;align-items:center;gap:18px}.pc-prog-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--stone);font-weight:500}.pc-prog-track{flex:1;height:4px;background:var(--border);border-radius:3px;max-width:340px}.pc-prog-fill{height:100%;background:var(--gold);border-radius:3px;transition:width .6s ease}.pc-prog-week{font-size:12px;letter-spacing:.1em;color:var(--gold);font-weight:500}
        .pc-hero{background:linear-gradient(135deg,#1C2B1E 0%,#2E4231 60%,#1a3020 100%);padding:80px 60px 72px;position:relative;overflow:hidden}.pc-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 60%,rgba(200,169,110,.07) 0%,transparent 65%);pointer-events:none}
        .pc-hero-inner{position:relative;z-index:1;max-width:1140px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:56px;align-items:start}.pc-hero-text{min-width:0}.pc-hero-aside{justify-self:end}@media(max-width:880px){.pc-hero-inner{grid-template-columns:1fr;gap:32px}.pc-hero-aside{justify-self:start}}.pc-hero-eyebrow{font-size:9px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:18px}.pc-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5vw,62px);font-weight:300;color:var(--cream);line-height:1.06;margin-bottom:22px}.pc-hero h1 em{font-style:italic;color:var(--gold)}.pc-hero-desc{font-size:14.5px;color:rgba(245,240,232,.55);line-height:1.95;max-width:600px;margin-bottom:32px}.pc-hero-meta{display:flex;gap:32px;flex-wrap:wrap}.hm-num{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--cream);line-height:1}.hm-lbl{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,240,232,.35);margin-top:4px}
        .pc-week-nav{position:sticky;top:calc(60px + env(safe-area-inset-top));z-index:90;background:rgba(253,251,247,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 48px;display:flex;overflow-x:auto}.pc-week-nav::-webkit-scrollbar{display:none}
        .wbtn{font-family:inherit;font-size:9px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;padding:0 20px;height:52px;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--stone);background:transparent;white-space:nowrap;transition:all .2s}.wbtn:hover{color:var(--ink)}.wbtn.active{color:var(--forest);border-bottom-color:var(--gold);font-weight:500}.wbtn.done::after{content:' ✓';font-size:8px;color:var(--gold);margin-left:4px}
        .pc-main{max-width:860px;margin:0 auto;padding:0 48px 100px}.pc-panel{display:none;padding-top:56px}.pc-panel.active{display:block}
        .continuity{display:flex;gap:12px;align-items:flex-start;background:rgba(122,158,126,.06);border-left:2px solid var(--sage-lt);padding:14px 18px;margin-bottom:32px}.ct-arrow{font-size:13px;color:var(--sage);flex-shrink:0;margin-top:1px}.ct-text{font-size:12.5px;color:var(--stone);line-height:1.75}.ct-text strong{color:var(--ink-mid);font-weight:500}
        .wh-eyebrow{font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px}.wh-title{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4vw,46px);font-weight:300;line-height:1.1;margin-bottom:16px;color:var(--ink);white-space:pre-line}.wh-title em{font-style:italic;color:var(--gold)}.wh-sub{font-size:14px;color:var(--stone);line-height:1.9;max-width:640px;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:36px}
        /* Week 1 shared layout (matched to pre-ceremony so the 12-week arc reads as one piece) */
        .w1-section { margin-bottom:52px;scroll-margin-top:130px; }
        .w1-h3 { font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.6vw,30px);font-weight:300;line-height:1.2;color:var(--ink);margin-bottom:16px; }
        .w1-h3 em { font-style:italic;color:var(--gold); }
        .w1-body { font-size:14px;color:var(--ink-mid);line-height:1.9;max-width:640px; }
        .w1-companion-link { display:inline-block;margin-top:20px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);text-decoration:none;border-bottom:1px dashed rgba(200,169,110,.55);padding-bottom:2px; }
        .w1-companion-link:hover { color:var(--sage); }
        .w1-autosave { font-size:14px;color:var(--stone);font-style:italic;margin:4px 0 20px; }
        .w1-prompt { padding:22px 0;border-bottom:1px solid var(--border); }
        .w1-prompt:first-child { border-top:1px solid var(--border); }
        .w1-prompt-num { font-size:13px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px; }
        .w1-prompt-q { font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;color:var(--ink);line-height:1.4;margin-bottom:10px; }
        .w1-prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .w1-actions { display:flex;flex-direction:column;gap:10px; }
        .w1-action { display:flex;align-items:stretch;border:.5px solid var(--border);border-radius:4px;background:white;transition:border-color .2s,background .2s; }
        .w1-action:hover { border-color:var(--gold);background:rgba(200,169,110,.05); }
        .w1-action.is-checked { background:rgba(200,169,110,.08);border-color:rgba(200,169,110,.5); }
        .w1-action.is-checked .w1-action-text { color:var(--ink-soft);text-decoration:line-through;text-decoration-color:rgba(200,169,110,.55);text-decoration-thickness:1px; }
        .w1-action.is-child { margin-left:32px;background:rgba(200,169,110,.04);border-color:rgba(200,169,110,.22); }
        .w1-action.is-child.is-checked { background:rgba(200,169,110,.10); }
        .w1-action-body { flex:1;min-width:0;display:flex;align-items:flex-start;gap:14px;padding:16px 18px;text-decoration:none;color:var(--ink); }
        .w1-action-dot { width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:7px; }
        .w1-action-text { font-size:13.5px;color:var(--ink);line-height:1.55; }
        .w1-action-check { flex-shrink:0;display:flex;align-items:center;justify-content:center;width:54px;background:none;border:none;border-left:.5px solid var(--border);cursor:pointer;font-family:inherit;padding:0;color:var(--gold);transition:background .15s; }
        .w1-action-check:hover { background:rgba(200,169,110,.1); }
        .w1-action-check-box { width:22px;height:22px;border:1.5px solid rgba(200,169,110,.6);border-radius:4px;display:flex;align-items:center;justify-content:center;background:white;transition:background .2s,border-color .2s; }
        .w1-action-check:hover .w1-action-check-box { border-color:var(--gold); }
        .w1-action-check.checked .w1-action-check-box { background:var(--gold);border-color:var(--gold); }
        .w1-action-check-mark { color:white;font-size:14px;font-weight:700;line-height:1; }
        /* Week 1 principle display, scaled up so the principle reads as the theme */
        .w1p-eyebrow { font-size:12px;font-weight:600;letter-spacing:.36em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:18px; }
        .w1p-principle-name { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(64px,9vw,108px);font-weight:400;line-height:1;color:var(--gold);margin:0 0 28px;letter-spacing:-.01em; }
        @media (max-width:640px) { .w1p-principle-name { font-size:clamp(56px,18vw,80px);margin-bottom:22px; } }
        .w1p-title { font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5.2vw,58px);font-weight:300;line-height:1.06;margin:0 0 18px;color:var(--ink); }
        .w1p-title em { font-style:italic;color:var(--gold); }
        .w1p-pull { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(17px,1.8vw,21px);color:var(--gold);line-height:1.55;margin:0 0 26px;letter-spacing:.015em; }
        .w1p-body { font-size:15.5px;color:var(--stone);line-height:1.95;max-width:680px;padding-bottom:40px;border-bottom:1px solid var(--border);margin:0; }
        /* Save & continue secondary button */
        .btn-save-exit { padding:12px 26px;background:transparent;border:1px solid var(--gold);border-radius:3px;color:var(--forest);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s;white-space:nowrap; }
        .btn-save-exit:hover { background:rgba(200,169,110,.08); }
        .wc-actions { display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end; }
        .section{margin-bottom:44px}.section-label{font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;display:block}
        .video-frame{border:.5px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px}.video-embed{position:relative;width:100%;padding-bottom:56.25%;background:var(--forest)}.video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.video-primer{background:var(--forest);padding:24px 28px;display:flex;align-items:center;gap:20px}.vp-play{width:44px;height:44px;border-radius:50%;border:1px solid rgba(200,169,110,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}.vp-play-icon{color:var(--gold);font-size:14px;margin-left:3px}.vp-label{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}.vp-text{font-size:13.5px;color:rgba(245,240,232,.75);line-height:1.7}.vp-coming-soon{margin-top:12px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;letter-spacing:.04em;color:var(--gold)}.pne-detail{margin-top:10px;background:var(--forest);border:.5px solid var(--border);border-radius:4px;padding:18px 24px}.pne-detail .vp-coming-soon{margin-top:6px}.pne-reflection{margin-top:18px;padding:26px 28px;background:var(--forest);border:.5px solid var(--border);border-left:3px solid var(--sage);border-radius:4px}.pne-reflection-label{font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--sage-lt);display:block;margin-bottom:12px}.pne-reflection-q{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;color:var(--cream);line-height:1.4;margin:0}.pne-reflection .pne-reflection-textarea{margin-top:16px;background:rgba(245,240,232,0.96);border:1px solid rgba(168,197,172,0.35);border-left:2px solid var(--sage-lt);color:var(--ink)}.pne-reflection .pne-reflection-textarea:focus{background:#fff;border-color:var(--sage-lt)}.pne-reflection-pending{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;color:var(--sage-lt);margin:6px 0 0}.pne-companion-read{display:inline-flex;align-items:center;gap:8px;margin:14px 0 4px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--sage);text-decoration:none;border-bottom:1px solid rgba(122,158,126,0.35);padding-bottom:2px;transition:color .15s,border-color .15s}.pne-companion-read:hover{color:var(--ink);border-color:var(--sage)}.pne-companion-read-static{color:var(--stone);border-bottom:1px dashed rgba(122,158,126,0.25);cursor:default}
        .box{margin-top:0;border-radius:2px;padding:16px 20px;margin-bottom:28px}.box-label{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;font-weight:500}.box-text{font-size:13px;line-height:1.8;color:var(--ink-mid)}.box-gold{background:rgba(200,169,110,.08);border:.5px solid rgba(200,169,110,.28)}.box-gold .box-label{color:var(--gold)}.box-sage{background:rgba(122,158,126,.07);border:.5px solid rgba(122,158,126,.25)}.box-sage .box-label{color:var(--sage)}
        .reentry{background:rgba(200,169,110,.05);border:.5px solid rgba(200,169,110,.2);border-radius:2px;padding:14px 20px;margin-bottom:24px;display:flex;gap:14px;align-items:flex-start}.reentry-icon{font-size:13px;color:var(--gold);flex-shrink:0;margin-top:1px}.reentry-text{font-size:12.5px;color:var(--stone);line-height:1.75}
        .dataset-note{background:rgba(200,169,110,.07);border:1px solid rgba(200,169,110,.32);border-left:3px solid var(--gold);border-radius:3px;padding:18px 22px;margin-top:18px;font-size:13px;color:var(--ink-mid);line-height:1.75}
        .dataset-note .dn-label{display:block;font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:10px}
        .dataset-note .dn-body{font-style:italic}
        .dataset-note .dn-cta{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);text-decoration:none;font-weight:500;padding:8px 14px;border:1px solid rgba(200,169,110,.5);border-radius:2px;transition:all .2s}
        .dataset-note .dn-cta:hover{background:rgba(200,169,110,.1);border-color:var(--gold)}
        .dataset-note .dn-header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap}
        .dataset-note .dn-header .dn-label{margin-bottom:0}
        .dataset-note .dn-footer{margin-top:14px;display:flex;justify-content:flex-end}
        .actions-list{display:flex;flex-direction:column;gap:10px}.action-item{display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:.5px solid var(--border);border-radius:4px;background:white}.action-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}.action-text{font-size:13.5px;color:var(--ink);line-height:1.5}.action-note{font-size:12px;color:var(--stone);line-height:1.6;margin-top:5px;font-style:italic}
        .prompts-list{border-top:1px solid var(--border)}.prompt-item{padding:22px 0;border-bottom:1px solid var(--border)}.prompt-num{font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px}.prompt-q{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px}.prompt-hint{font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic}
        .journal-textarea{width:100%;margin-top:14px;padding:14px 16px;border:1px solid rgba(200,169,110,0.2);border-left:2px solid var(--gold);background:rgba(200,169,110,0.03);font-family:'Jost',sans-serif;font-size:13.5px;font-weight:300;color:var(--ink);line-height:1.7;resize:vertical;outline:none;min-height:100px;transition:border-color .2s,background .2s}
        .journal-textarea:focus{border-color:var(--gold);background:rgba(200,169,110,0.06)}
        .journal-textarea::placeholder{color:rgba(28,43,30,0.5);font-style:italic}
        .integration-qs{margin-top:28px;border:.5px solid rgba(200,169,110,.2);border-radius:4px;overflow:hidden}.iq-header{background:rgba(200,169,110,.06);padding:14px 20px;border-bottom:.5px solid rgba(200,169,110,.15)}.iq-label{font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}.iq-item{padding:18px 20px;border-bottom:.5px solid var(--border-lt)}.iq-item:last-of-type{border-bottom:none}.iq-q{font-size:13px;color:var(--ink-mid);font-weight:500;margin-bottom:6px}.iq-hint{font-size:12px;color:var(--stone);font-style:italic;line-height:1.65}
        .rg-wrap{margin-top:40px;border:.5px solid rgba(200,169,110,.35);border-radius:4px;overflow:hidden}.rg-header{background:var(--forest);padding:18px 24px;display:flex;align-items:center;gap:12px}.rg-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0}.rg-title{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}.rg-body{padding:20px 24px}.rg-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid var(--border)}.rg-item:last-of-type{border-bottom:none}.rg-check{width:18px;height:18px;border-radius:2px;border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}.rg-check.checked{background:var(--gold);border-color:var(--gold)}.rg-check-icon{font-size:10px;color:white;opacity:0}.rg-check.checked .rg-check-icon{opacity:1}.rg-item-text{font-size:13px;color:var(--ink-mid);line-height:1.5}
        .monthly-arc{margin-top:48px;background:linear-gradient(135deg,rgba(28,43,30,.04) 0%,rgba(200,169,110,.04) 100%);border:.5px solid rgba(200,169,110,.18);border-radius:4px;padding:32px 36px}.ma-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;display:block;font-weight:500}.ma-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:var(--ink);line-height:1.2;margin-bottom:14px}.ma-title em{font-style:italic;color:var(--gold)}.ma-text{font-size:13.5px;color:var(--stone);line-height:1.9;margin-bottom:20px}.ma-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.ma-card{background:white;border:.5px solid var(--border);border-radius:4px;padding:18px 20px}.ma-card-label{font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;display:block}.ma-card-text{font-size:13px;color:var(--ink-mid);line-height:1.7}.ma-question{margin-top:20px;background:rgba(200,169,110,.06);border:.5px solid rgba(200,169,110,.2);border-radius:4px;padding:16px 20px}.ma-q-label{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;display:block}.ma-q-text{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:300;color:var(--ink);line-height:1.4}
        .return-practice{margin-top:40px;background:rgba(200,169,110,.06);border:.5px solid rgba(200,169,110,.25);border-left:3px solid var(--gold);border-radius:4px;padding:28px 32px}.rp-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;display:block;font-weight:500}.rp-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:var(--ink);line-height:1.2;margin-bottom:14px}.rp-text{font-size:13.5px;color:var(--ink-mid);line-height:1.85;margin-bottom:12px}.rp-text:last-of-type{margin-bottom:20px}.rp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}.rp-btn{font-family:inherit;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);background:transparent;border:1px solid var(--gold);border-radius:2px;padding:10px 16px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;transition:all .2s;font-weight:500}.rp-btn:hover{background:rgba(200,169,110,.1)}.rp-btn-alt{background:rgba(200,169,110,.06)}
        .bridge{margin-top:28px;background:var(--forest);padding:32px 36px;border-radius:2px}.bridge-eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;display:block;font-weight:500}.bridge-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--cream);line-height:1.2;margin-bottom:14px}.bridge-title em{font-style:italic;color:var(--gold)}.bridge-text{font-size:13.5px;color:rgba(245,240,232,.62);line-height:1.9}
        .wc-wrap{margin-top:48px;padding-top:36px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}.wc-text{font-size:12.5px;color:var(--stone);line-height:1.65}.wc-text strong{color:var(--ink-mid);font-weight:500}
        .btn-complete{padding:12px 28px;background:var(--gold);border:none;border-radius:3px;color:var(--deep);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap}.btn-complete:hover{background:#d4b87a}.btn-complete.done{background:rgba(200,169,110,.12);border:.5px solid var(--gold);color:var(--gold);cursor:default}
        .save-pill{position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:4px;font-size:11px;letter-spacing:.1em;font-family:inherit;background:rgba(28,43,30,.9);color:var(--gold);opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}.save-pill.visible{opacity:1}
        @media(max-width:640px){.pc-nav{padding:0 20px}.pc-nav-links{display:none}.pc-hero{padding:56px 24px 52px}.pc-main{padding:0 24px 80px}.pc-week-nav{padding:0 12px}.pc-prog{padding:10px 24px}.ma-grid{grid-template-columns:1fr}}
      `}</style>

      {/* NAV provided by portal layout */}

      {/* PROGRESS */}
      <div className="pc-prog">
        <span className="pc-prog-label">Integration Progress</span>
        <div className="pc-prog-track"><div className="pc-prog-fill" style={{ width: `${progress}%` }} /></div>
        <span className="pc-prog-week">{completed.size === 6 ? 'Integration Complete ✓' : `Week ${Math.min(completed.size + 1, 6)} of 6`}</span>
      </div>

      {/* PROGRESS INSIGHTS, only renders when ≥1 week tracked */}
      <ProgressInsights tracking={weeklyTracking} />

      {/* HERO */}
      <div className="pc-hero">
        <div className="pc-hero-inner">
          <div className="pc-hero-text">
            <h1>Six Weeks of<br /><em>Integration</em></h1>
            <p className="pc-hero-desc">Integration is how you build from what the medicine opened. As with your preparation, each week draws on a Hawaiian principle, paired with a teaching from psychoneuroenergetics (PNE) to support the body, mind, and spirit. You&apos;ll find journal prompts, action items, and voices from the Vital Kauaʻi community to support your homecoming.</p>
          </div>
          <div className="pc-hero-aside">
            <HeroCountdown mode="post" />
            <SessionBookingCard />
          </div>
        </div>
      </div>

      {/* WEEK NAV */}
      <div className="pc-week-nav">
        {WEEKS.map((w, i) => (
          <button key={w.id} className={`wbtn${activeWeek===i?' active':''}${completed.has(i)?' done':''}`} onClick={() => setActiveWeek(i)}>
            Week {i+1} · {w.code}
          </button>
        ))}
      </div>

      {/* SECTION INDEX, sticky under the week-tabs so members can jump between
          Principle / Video / Actions / PNE / Journal / Community (+ Completion
          on Week 6) while they scroll. */}
      <SectionIndex sections={sectionsForWeek(activeWeek)} stickyTop={112} scrollOffset={170} />

      <main className="pc-main">
        {WEEKS.map((w, i) => (
          <div key={w.id} className={`pc-panel${activeWeek===i?' active':''}`}>

            {/* PRINCIPLE */}
            <section className="w1-section" id="principle">
              <span className="w1p-eyebrow">Week {i + 1} · {w.theme}</span>
              <div className="w1p-principle-name">{w.principleName}</div>
              <p className="w1p-pull">&ldquo;{w.principle}&rdquo;</p>
              <h2 className="w1p-title">{w.title}{w.subtitle && <><br /><em>{w.subtitle}</em></>}</h2>
              <p className="w1p-body">{w.intro}</p>
            </section>

            {/* VIDEO, Message from the Founders */}
            <section className="w1-section" id="week-video">
              <span className="section-label">Message from the Founders</span>
              <div className="video-frame">
                {'url' in w.video && w.video.url ? (
                  <>
                    <div className="video-embed">
                      <iframe
                        src={w.video.url}
                        title={w.video.label}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="vp-text" style={{ background: 'var(--forest)', padding: '18px 22px' }}>
                      {w.video.text}
                    </div>
                  </>
                ) : (
                  <div className="video-primer">
                    <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                    <div>
                      <div className="vp-label">{w.video.label}</div>
                      <div className="vp-text">{w.video.text}</div>
                      <div className="vp-coming-soon">Coming Soon</div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ACTIONS */}
            <section className="w1-section" id="action-items">
              <h3 className="w1-h3">Action Items</h3>
              <div className="w1-actions">
                {actionsForWeek(w.actions).map((card, ai) => {
                  // PNE Practice + Reflection are folded into the single
                  // "Read … PNE Integration Guide, complete the practice and PNE
                  // reflection" action. They remain in the data array so saved
                  // checkbox positions (post-w{i}-a{ai}) stay stable for members
                  // already in integration; we just don't render them as rows.
                  if (card.text.startsWith("Complete this week's PNE")) return null
                  const checkId = `post-w${i}-${card.key}`
                  const isChecked = !!checklist[checkId]
                  const decorateHref = (href: string): string => {
                    if (!href.startsWith('/iboga-preparedness-guide.html')) return href
                    const hashIdx = href.indexOf('#')
                    const base = hashIdx === -1 ? href : href.slice(0, hashIdx)
                    const hash = hashIdx === -1 ? '' : href.slice(hashIdx)
                    const sep = base.includes('?') ? '&' : '?'
                    const rt = encodeURIComponent(`/portal/integration/post-ceremony#week-${i + 1}`)
                    return `${base}${sep}returnTo=${rt}${hash}`
                  }
                  const checkbox = (
                    <button
                      type="button"
                      className={`w1-action-check${isChecked ? ' checked' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCheck(checkId) }}
                      aria-label={isChecked ? 'Mark as not done' : 'Mark as done'}
                      aria-pressed={isChecked}
                    >
                      <span className="w1-action-check-box">
                        {isChecked && <span className="w1-action-check-mark">✓</span>}
                      </span>
                    </button>
                  )
                  let body
                  const pneScrollTarget = card.kind === 'static' && card.text === "Complete this week's PNE Practice"
                    ? '.pne-detail'
                    : card.kind === 'static' && card.text === "Complete this week's PNE Reflection"
                      ? '.pne-reflection'
                      : null
                  if (pneScrollTarget) {
                    body = (
                      <a
                        href="#"
                        className="w1-action-body"
                        onClick={(e) => {
                          e.preventDefault()
                          const target = document.querySelector(`.pc-panel.active ${pneScrollTarget}`)
                          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                      >
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  } else if (card.kind === 'static') {
                    body = (
                      <div className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{renderActionText(card.text, card.links)}</span>
                      </div>
                    )
                  } else if (card.kind === 'hash') {
                    body = (
                      <a
                        href={card.href}
                        className="w1-action-body"
                        onClick={(e) => {
                          const target = document.querySelector(`.pc-panel.active ${card.href}`)
                          if (target) {
                            e.preventDefault()
                            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }}
                      >
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  } else if (card.kind === 'external') {
                    body = (
                      <a href={decorateHref(card.href)} target="_blank" rel="noopener noreferrer" className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  } else {
                    body = (
                      <Link href={decorateHref(card.href)} target="_blank" rel="noopener noreferrer" className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </Link>
                    )
                  }
                  return (
                    <div
                      key={ai}
                      className={`w1-action${isChecked ? ' is-checked' : ''}${card.text.startsWith("Complete this week's PNE") ? ' is-child' : ''}`}
                    >
                      {body}
                      {checkbox}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* JOURNAL PROMPTS */}
            <section className="w1-section" id="journal-prompts">
              <h3 className="w1-h3">Journal Prompts</h3>
              {w.prompts.map((p, pi) => {
                const jKey = `w${i}-p${pi}`
                return (
                  <div className="w1-prompt" key={pi}>
                    <span className="w1-prompt-num">0{pi + 1}</span>
                    <p className="w1-prompt-q">{p.q}</p>
                    {p.hint && <p className="w1-prompt-hint">{p.hint}</p>}
                    <textarea
                      className="journal-textarea"
                      value={journal[jKey] ?? ''}
                      onChange={(e) => updateJournal(jKey, e.target.value)}
                      placeholder="Write freely..."
                      rows={4}
                    />
                  </div>
                )
              })}
            </section>

            {/* PNE GUIDE (placeholder until per-week content ships) */}
            <section className="w1-section" id="pne-perspective">
              <h3 className="w1-h3">PNE (PsychoNeuroEnergetics) Guide</h3>
              {(() => {
                const c = POST_PNE_COMPANION[i]
                const label = `Read Week ${i + 1} in The PsychoNeuroEnergetics (PNE) Integration Guide${c?.theme ? `: ${c.theme}` : ''}`
                return c?.url ? (
                  <Link href={c.url} target="_blank" rel="noopener noreferrer" className="pne-companion-read">
                    {label} <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <p className="pne-companion-read pne-companion-read-static">{label}</p>
                )
              })()}
              {POST_PNE_COMPANION[i]?.videoUrl ? (
                <div className="video-frame" style={{ marginTop: 18 }}>
                  <div className="video-embed">
                    <iframe
                      src={POST_PNE_COMPANION[i].videoUrl}
                      title={`PNE Integration Guide: ${POST_PNE_COMPANION[i].theme}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  {POST_PNE_DETAILS[i]?.teaching && (
                    <div className="vp-text" style={{ background: 'var(--forest)', padding: '18px 22px' }}>
                      {POST_PNE_DETAILS[i].teaching}
                    </div>
                  )}
                </div>
              ) : (
                <div className="video-frame" style={{ marginTop: 18 }}>
                  <div className="video-primer">
                    <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                    <div>
                      <div className="vp-label">PNE Teaching · Week {i + 1}</div>
                      <div className="vp-text">
                        {POST_PNE_DETAILS[i]?.teaching
                          ?? 'A short teaching paired with this week’s principle and the body’s lived response to it.'}
                      </div>
                      <div className="vp-coming-soon">Coming Soon</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="pne-detail">
                <div className="vp-label">This Week&apos;s PNE Practice</div>
                {POST_PNE_DETAILS[i]?.practice
                  ? <div className="vp-text">{POST_PNE_DETAILS[i].practice}</div>
                  : <div className="vp-coming-soon">Coming Soon</div>}
              </div>
              <div className="pne-reflection">
                <span className="pne-reflection-label">This Week&apos;s PNE Reflection</span>
                {POST_PNE_DETAILS[i]?.reflection ? (
                  <>
                    <p className="pne-reflection-q">{POST_PNE_DETAILS[i].reflection}</p>
                    <textarea
                      className="journal-textarea pne-reflection-textarea"
                      value={journal[`post-pne-reflection-w${i}`] ?? ''}
                      onChange={(e) => updateJournal(`post-pne-reflection-w${i}`, e.target.value)}
                      placeholder="Write freely..."
                      rows={4}
                    />
                    {POST_PNE_DETAILS[i].reflectionFollowUp && (
                      <>
                        <p className="pne-reflection-q" style={{ marginTop: 24 }}>{POST_PNE_DETAILS[i].reflectionFollowUp}</p>
                        <textarea
                          className="journal-textarea pne-reflection-textarea"
                          value={journal[`post-pne-reflection-w${i}-2`] ?? ''}
                          onChange={(e) => updateJournal(`post-pne-reflection-w${i}-2`, e.target.value)}
                          placeholder="Write freely..."
                          rows={4}
                        />
                      </>
                    )}
                    {POST_PNE_DETAILS[i].reflectionThird && (
                      <>
                        <p className="pne-reflection-q" style={{ marginTop: 24 }}>{POST_PNE_DETAILS[i].reflectionThird}</p>
                        <textarea
                          className="journal-textarea pne-reflection-textarea"
                          value={journal[`post-pne-reflection-w${i}-3`] ?? ''}
                          onChange={(e) => updateJournal(`post-pne-reflection-w${i}-3`, e.target.value)}
                          placeholder="Write freely..."
                          rows={4}
                        />
                      </>
                    )}
                    {POST_PNE_DETAILS[i].reflectionFourth && (
                      <>
                        <p className="pne-reflection-q" style={{ marginTop: 24 }}>{POST_PNE_DETAILS[i].reflectionFourth}</p>
                        <textarea
                          className="journal-textarea pne-reflection-textarea"
                          value={journal[`post-pne-reflection-w${i}-4`] ?? ''}
                          onChange={(e) => updateJournal(`post-pne-reflection-w${i}-4`, e.target.value)}
                          placeholder="Write freely..."
                          rows={4}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <p className="pne-reflection-pending">Coming Soon</p>
                )}
              </div>
            </section>

            {/* VOICES FROM THE VITAL KAUAʻI COMMUNITY */}
            <section className="w1-section" id="community">
              <h3 className="w1-h3">Voices from the Vital Kauaʻi Community</h3>
              <div className="video-frame">
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">A Reflection from the Vital Kauaʻi Community · Week {i + 1}</div>
                    <div className="vp-text">A short transmission from someone who has walked this path.</div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
            </section>

            {/* COMPLETION, Week 6 only: monthly arc + return-practice + closing bridge. */}
            {w.monthlyArc && (
              <div className="monthly-arc">
                <span className="ma-eyebrow">What comes next, months 2 &amp; 3</span>
                <h3 className="ma-title">After the <em>Six Weeks</em></h3>
                <p className="ma-text">The arc settles into a rhythm. Stay connected to your guide, your community, and the practices you have built.</p>
                <div className="ma-grid">
                  <div className="ma-card">
                    <span className="ma-card-label">Continue with your integration guide</span>
                    <div className="ma-card-text">Your integration guide is available beyond the six-week arc. Reach out to set a continuing cadence that supports you.</div>
                  </div>
                  <div className="ma-card">
                    <span className="ma-card-label">Stay in community</span>
                    <div className="ma-card-text">You are part of our ongoing Vital Kauaʻi community. Join the monthly calls to stay connected with the people who walked this alongside you.</div>
                  </div>
                  <div className="ma-card">
                    <span className="ma-card-label">Return to your practices</span>
                    <div className="ma-card-text">Come back to your daily practice and to these journal prompts often. Reinforcement is how the new ways of being settle into how you live.</div>
                  </div>
                </div>
              </div>
            )}

            {w.monthlyArc && (
              <div className="return-practice">
                <span className="rp-eyebrow">A practice of return</span>
                <h3 className="rp-title">Mark the returns.</h3>
                <p className="rp-text">Integration happens in waves. Place three gentle markers on your own calendar, three months, six months, and one year from today. When each arrives, return here. Notice what has moved, what has deepened, and what still asks for attention.</p>
                <p className="rp-text">You are welcome to return for another ceremony whenever you feel called. The medicine often offers more than one passage to support who you are becoming.</p>
              </div>
            )}

            {w.monthlyArc && (
              <div className="bridge">
                <span className="bridge-eyebrow">You are held</span>
                <h3 className="bridge-title">The work continues.<br /><em>So do we.</em></h3>
                <p className="bridge-text">Vital Kauaʻi is always here for you. Your integration guide, your care team, and this portal remain with you. If something arises six weeks from now or six months from now, reach out and stay connected. <strong style={{ color: 'var(--gold)' }}>aloha@vitalkauai.com</strong></p>
              </div>
            )}

            {/* Mark complete */}
            <div className="wc-wrap">
              <div className="wc-text">
                <strong>{i===5 ? 'Six weeks complete.' : `Finished with Week ${i+1}?`}</strong><br />
                {i===5 ? 'Complete your check-in to close the integration arc.' : 'Complete your weekly check-in before marking this week done.'}
              </div>
              {completed.has(i) ? (
                <button className="btn-complete done">✓ Complete</button>
              ) : (
                <button className="btn-complete" onClick={() => setCheckInWeek(i)}>
                  {i===5 ? 'Complete Integration' : `Complete Week ${i+1}`}
                </button>
              )}
            </div>

          </div>
        ))}
      </main>

      <div className={`save-pill${saveStatus!=='idle'?' visible':''}`}>
        {saveStatus==='saving' ? 'Saving…' : 'Saved ✓'}
      </div>
    </>
  )
}

// useSearchParams requires a Suspense boundary for static prerendering.
export default function PostCeremonyPage() {
  return (
    <Suspense>
      <PostCeremonyPageInner />
    </Suspense>
  )
}
