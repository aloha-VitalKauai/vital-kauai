'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRE_CEREMONY_WEEKS } from '@/lib/journal-prompts'

// ─── Types ────────────────────────────────────────────────
type Progress = {
  weeks_completed: number[]
  checklist_items: Record<string, boolean>
  last_updated: string
}

const STRIPE_LOVE_OFFERING_URL = 'https://buy.stripe.com/test_cNi4gzcoG3ZBeQUcmZbo400'

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
  return segments.map((seg, i) =>
    typeof seg === 'string' ? (
      <Fragment key={i}>{seg}</Fragment>
    ) : (
      <a
        key={i}
        href={seg.href}
        target={seg.external ? '_blank' : undefined}
        rel={seg.external ? 'noopener noreferrer' : undefined}
        style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed rgba(200,169,110,.55)' }}
      >
        {seg.text}
      </a>
    ),
  )
}

// ─── Week data ────────────────────────────────────────────
const WEEKS = [
  {
    id: 0,
    code: 'IKE',
    theme: 'Perception',
    title: 'Seeing clearly.',
    subtitle: 'This is the beginning of something real.',
    sub: 'Iboga asks for your presence, your honesty, and your full participation. What you do in these six weeks matters. The way you prepare becomes part of the experience itself.',
    italic: 'This week calls for presence. Just begin.',
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'A real conversation about what you are walking into, why the next six weeks matter, and the one thing that protects you more than any lab result or dietary protocol. Watch this before you read anything else this week.' },
    box: { type: 'info', label: 'The most important safety factor is your honesty.', text: 'Your labs, your diet, and your supplement plan all matter—but it\'s your willingness to see yourself clearly that shapes how the medicine meets you. Iboga brings truth to the surface. When you arrive having already begun that process with yourself, the experience becomes something you can move through with awareness. This is how the medicine meets you.' },
    actionLabel: 'Actions this week — 3 only',
    actions: [
      {
        color: 'blue',
        text: 'Sign both required documents — Membership Agreement, Medical Disclaimer',
        note: 'Each document is an act of commitment. Read them with care.',
        links: [
          { text: 'Membership Agreement', href: '/portal#agreement-card' },
          { text: 'Medical Disclaimer', href: '/portal#medical-card' },
        ],
      },
      {
        color: 'blue',
        text: 'Submit your love offering',
        note: 'Your donation completes the container. It signals to your nervous system: I have chosen this. I am in.',
        links: [
          { text: 'Submit your love offering', href: STRIPE_LOVE_OFFERING_URL, external: true },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
        note: 'Begin an honest relationship with what you\'re stepping into.',
        links: [
          {
            text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html',
            external: true,
          },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[0].prompts,
    thread: 'Your answers here are the raw material of your Questions for the Medicine — the specific questions you\'ll bring into ceremony. Write honestly. Over the coming weeks, these words will sharpen into something you can carry in. This is where that conversation begins.',
  },
  {
    id: 1,
    code: 'MAKIA',
    theme: 'Focus',
    title: 'The person who arrives at ceremony',
    subtitle: 'is being shaped right now.',
    carryForward: 'You named what you want and what is asking to change. That honesty is already in motion. This week you begin aligning your whole life — your body, your choices, your attention — toward what\'s coming.',
    sub: 'Makia means energy flows where attention goes. This week is about the quiet recognition that everything you do between now and ceremony — every choice, every conversation, every moment of honesty or avoidance — is preparation. You are already in the work.',
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'Something shifts the moment you say yes. This week Rachel and Josh talk about what that shift means, how the preparation window works as active medicine, and the question that matters more than "what do I need to learn?" — who am I becoming?' },
    box: { type: 'info', label: 'The identity shift', text: 'You are no longer the person who was considering this. The moment you committed, something changed. This week\'s job is to feel that shift — as a lived, embodied orientation. The portal, this video, and the prompts below all serve one thing: moving you from "I signed up for something" to "I am inside a process."' },
    actionLabel: 'Actions this week — 3 only',
    actionIntro: 'Identity shifts happen in the noticing. This week your job is to begin seeing clearly — the changes will follow.',
    actions: [
      {
        color: 'blue',
        text: 'Call with your integration guide',
        note: 'Come with your intentions from Week 1. Come with your questions. Come as you are. This call is the beginning of a relationship that will hold you through the hardest parts of what\'s ahead.',
        links: [
          { text: 'Call with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'amber', text: 'Begin noticing your daily habits', note: 'Observe alcohol, sleep, screens, food, substances. Honest observation is all that\u2019s asked. What you notice this week becomes data for your body to begin working with.' },
      {
        color: 'blue',
        text: 'Schedule your required medical appointments and labs',
        note: 'EKG and labs must be completed before Week 5. Schedule now — medical appointments take time. This protects you.',
        links: [
          { text: 'Schedule your required medical appointments and labs', href: '/portal/physician-guide' },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[1].prompts,
    thread: '"What must change" becomes the spine of your Week 4 shadow work and your Week 6 ceremony questions. Start a running list anywhere — the specific questions you want to bring to the medicine will take shape over the next four weeks. You\'ll draft them formally in Week 4.',
  },
  {
    id: 2,
    code: 'MANAWA',
    theme: 'Presence',
    title: 'The body is the experience.',
    subtitle: 'This is where the medicine lands.',
    carryForward: 'You named what must change and what you\'re committing to. This week the work moves from mind into body. The clarity you found last week needs a regulated nervous system to land in. That\'s what this week builds.',
    reentry: { strong: 'Arriving at this week behind?', text: ' If you haven\'t yet completed Week 2\'s integration call, do that first — before starting anything here. One real conversation with your guide is worth more than moving forward alone. If you\'re behind on journaling, write just five minutes on Week 1\'s prompts before opening Week 3. Start here: one integration call scheduled, one journal prompt written.' },
    sub: 'Iboga works through the body — the gut, the heart, the nervous system, the tissue where unresolved experience lives. The more regulated and resourced your nervous system is when you arrive, the more cleanly the medicine can do its work. This week, you begin building that foundation.',
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'Something may already be coming up — old feelings, vivid dreams, unexpected heaviness. This is the medicine already in relationship with you. In this week\'s transmission, Rachel and Josh explain why this happens, what it means, and how to stay with what arises without being swept away by it.' },
    box: { type: 'info', label: 'If something surfaces this week', text: 'Iboga is intelligent and relational. It begins its work the moment you say yes. If difficult material arises — old grief, anxiety, somatic intensity — here is what to do: slow down deliberately. Bring your attention to one physical sensation at a time. Breathe. Place both feet on the floor. Be with what is arising — presence is enough. Your integration guide is available between sessions. Reach out whenever you need support.\n\nSome days will feel harder to begin. Noticing that — naming it honestly — is itself the practice.' },
    actionLabel: 'Actions this week — 4 only',
    actions: [
      {
        color: 'green',
        text: 'Read the Nervous System Safety Guide',
        note: 'Understanding your polyvagal states before ceremony is one of the most valuable things you can do. It gives you a map for what you\'ll encounter in your own body during the experience.',
        links: [
          { text: 'Read the Nervous System Safety Guide', href: '/portal/nervous-system' },
        ],
      },
      {
        color: 'green',
        text: 'Begin Coherent Heart Breath — 10 minutes, every morning',
        note: 'This single practice does more for your ceremony readiness than almost anything else on this list. It is the minimum. Do it every day.',
        links: [
          { text: 'Begin Coherent Heart Breath — 10 minutes, every morning', href: '/portal/nervous-system#coherent-heart-breath' },
        ],
      },
      {
        color: 'amber',
        text: 'Begin dietary protocol — you are now 4 weeks out',
        note: 'Read the Dietary Preparation guide. The body you bring to ceremony is built in these four weeks. This is about arriving as a clear vessel — prepared, open, and ready to receive.',
        links: [
          { text: 'Begin dietary protocol — you are now 4 weeks out', href: '/portal/dietary' },
        ],
      },
      {
        color: 'red',
        text: 'Begin DHA/EPA and magnesium glycinate supplementation daily',
        note: 'DHA/EPA: 2–4g daily with food. Magnesium glycinate: 300–400mg before bed. Confirm with your physician if you are on any medications.',
        links: [
          { text: 'Begin DHA/EPA and magnesium glycinate supplementation daily', href: '/portal/dietary#supplement-protocol' },
        ],
      },
    ],
    safetyBox: { label: 'Physiological preparation — safety note', text: 'Magnesium is cardiac-critical for iboga. Adequate magnesium levels directly affect cardiac function during the medicine, particularly QT interval regulation. This supplementation is cardiac-critical preparation — part of your physiological safety protocol. If you have any cardiac history, confirm dosing with your physician and inform the Vital Kauaʻi team before proceeding.' },
    prompts: PRE_CEREMONY_WEEKS[2].prompts,
    thread: 'The body awareness you\'re building this week is what carries you through ceremony. When the medicine is at its most intense, your capacity to track sensation without being consumed by it is the skill that matters most. You are practicing it now.',
  },
  {
    id: 3,
    code: 'KALA',
    theme: 'Release',
    title: 'Iboga sees everything.',
    subtitle: '',
    carryForward: 'Your nervous system is more regulated. Your body has begun its preparation. You have a map of your own inner states. You are ready for what this week asks — trust what you\'ve built.',
    reentry: { strong: 'A note on pacing:', text: ' Let the Coherent Heart Breath be with you this week. Return to it before each journal prompt — let it settle you before you begin, and steady you when the material goes deep.' },
    sub: 'Kala means release — and release requires honesty. Kala also means that there are no limits, and the boundaries you experience are essentially self-imposed — as you untie those blocks you realize your ultimate, unlimited potential. This week asks more of you than any previous week. The medicine will meet whatever you bring. Participants who do this work before ceremony tend to have cleaner, more navigable experiences — and arrive with something to work with from the first moment.',
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'Rachel and Josh designed this week to hold you. In this transmission they explain why the shadow work you do here changes what ceremony will ask of you, and how to go slow while staying grounded.' },
    box: { type: 'warn', label: 'Pacing permission — read this before you begin', text: 'This week\'s journaling may bring up old grief, anger, shame, or material you haven\'t touched in years. That is appropriate. It is a sign the process is working. Write for ten minutes. Stop. Breathe. Come back tomorrow. Go slow on purpose. If something feels too large to hold alone, reach out to your integration guide before your next scheduled call.\n\nAnd know this: this process moves in waves. Feeling more unsettled now than you did in Week 1 — more uncertain, more raw — is often a sign something is genuinely moving. Regression before breakthrough is real.' },
    actionLabel: 'Actions this week — 4 only',
    actions: [
      { color: 'red', text: 'Deep journaling — this is the primary work of this week', note: 'An act of honesty. Approach the prompts below as if the medicine is already in the room with you — because in a real sense, it is.' },
      {
        color: 'blue',
        text: 'Call with your integration guide',
        note: 'Bring the material that is surfacing. Your guide is trained to hold exactly this territory.',
        links: [
          { text: 'Call with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'blue',
        text: 'Draft your Questions for the Medicine — first version',
        note: 'You\'ve been gathering the raw material for four weeks. What do you most want to ask? What do you most need to be shown? Write freely. These will be refined in Week 6.',
        links: [
          { text: 'Draft your Questions for the Medicine — first version', href: '/portal/questions' },
        ],
      },
      {
        color: 'amber',
        text: 'Begin clearing contraindicated substances per your protocol timeline',
        note: 'Cannabis: clear fully 2 weeks before ceremony. All other substances: review the Preparedness Guide. Questions about specific medications — reach out to the team now, not later.',
        links: [
          { text: 'Begin clearing contraindicated substances per your protocol timeline', href: '/iboga-preparedness-guide.html#safety', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[3].prompts,
    thread: 'What you name here, you are no longer carrying unconsciously. Iboga surfaces what we hold in the dark. You are turning on a light before you arrive. Next week you turn toward your people.',
  },
  {
    id: 4,
    code: 'ALOHA',
    theme: 'Connection',
    title: 'You walk this with others.',
    subtitle: 'You always have.',
    carryForward: 'You looked at the shadow. You named what you\'ve been avoiding. That took courage. This week the work moves outward — into your relationships, your home, and the people who will hold you from a distance while you\'re in ceremony.',
    reentry: { strong: 'Arriving at this week without having done Week 4\'s journaling?', text: ' Do one prompt from Week 4 — just one — before you move forward. The shadow work and the relational work are connected. Ten minutes of Week 4 journaling is where to begin.' },
    sub: 'Aloha is a way of being in relationship. This week, you turn outward. Even as the inner work continues — because transformation that touches your relationships is transformation that lands. The people who love you are part of this process. Let them be.',
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'The ceremony container is powerful. But the integration that follows lives or dies in your relationships and your home environment. This week Rachel and Josh talk about the most common reason people lose their ceremony gains after returning home — and what you can do right now to protect against it.' },
    box: { type: 'info', label: 'Why the relational field is the foundation of your return', text: 'The relational preparation you do this week is a structural protection for integration. The weeks and months after ceremony are when the insights are tender and the old world is asking you to return to who you were. The relational preparation you do this week is a structural protection against that pull. Share the Support Person Guide. Have the real conversations. Let your circle know you\'re asking for something from them — and be specific about what.' },
    actionLabel: 'Actions this week — 4 only',
    actions: [
      { color: 'green', text: 'Share the Support Person Guide with your home circle — this week', note: 'Not after ceremony. Now. So they have time to read it, ask questions, and show up prepared for your return.' },
      { color: 'blue', text: 'Second call with your integration guide', note: 'Bring the shadow material from Week 4 if it feels ready. Bring your Questions for the Medicine draft. Bring whatever is alive.' },
      { color: 'amber', text: 'Begin preparing your home environment for your return', note: 'Clean it. Simplify it. Stock what will nourish you. The space you return to is part of integration. Prepare it now, before you\'re altered by what\'s coming.' },
      { color: 'blue', text: 'Complete the What to Bring packing checklist', note: 'Practical, yes — and also a ritualized act of arrival. Let the packing be intentional.' },
    ],
    prompts: PRE_CEREMONY_WEEKS[4].prompts,
    thread: 'The forgiveness work you begin here continues in ceremony and for months afterward. Begin it this week — the medicine will carry it forward from wherever you start. One week remains.',
  },
  {
    id: 5,
    code: 'MANA + PONO',
    theme: 'Sovereignty & Integrity',
    title: 'You have done the work.',
    subtitle: 'Trust your preparation.',
    carryForward: 'You have opened to your people. You have begun the forgiveness work. You have tended your home. This final week calls for completion, alignment, and the willingness to arrive.',
    sub: 'Mana is the power that comes from within. Pono is right relationship — with yourself, with others, with what\'s coming. This week you are being asked to arrive. The work of preparation is complete. What remains is alignment: finishing what is unfinished, confirming what is confirmed, and meeting yourself honestly about what you are ready to receive.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'Five weeks ago you were a person who was thinking about doing this. Today you are a person who has done the preparation. Rachel and Josh want to mark that — and to meet you exactly where you are before you come through our door.' },
    box: { type: 'close', label: 'Emotional closure — the arc completes here', text: 'Five weeks ago this process asked you to see clearly. Then to commit. Then to tend your body. Then to meet your shadow. Then to open to your people. You have done all of that. Whatever remains unresolved — the medicine will meet it. Your job this week is to arrive with openness, trust your team, and let yourself be held. That is enough. That is everything.\n\nIf you feel uncertain right now — more unsettled than you expected to feel at the end of six weeks of preparation — that feeling often means you have done real work. Uncertainty is a form of readiness.' },
    actionLabel: 'Actions this week — 5 operational completions',
    actions: [
      { color: 'red', text: 'Confirm labs are submitted and reviewed by the medical team', note: 'If you haven\'t received confirmation, reach out now and confirm directly. This is a safety step — it directly affects whether your ceremony proceeds as planned.' },
      { color: 'red', text: 'Complete your Baseline Wellbeing Check-in', note: 'A 5-minute survey covering mood, anxiety, sleep, and quality of life. This creates your before-picture.' },
      { color: 'blue', text: 'Preparation call with Rachel & Josh', note: 'Bring your finalized Questions for the Medicine. Bring anything still alive. Speak everything that is ready to be said.' },
      { color: 'blue', text: 'Confirm travel and send arrival details to aloha@vitalkauai.com' },
      { color: 'green', text: 'Finalize your Questions for the Medicine — land on what feels most true', note: 'The truest question — that is the one. Hold it with open hands.' },
    ],
    prompts: PRE_CEREMONY_WEEKS[5].prompts,
    thread: 'In Week 1 you named what is asking to change. In Week 2 you named what must change. In Week 4 you looked at what you were hiding. In Week 5 you opened to your people. Now you state what you are ready for and what you are committing to. You built this. Carry it in.',
    readinessGate: true,
  },
]

const DOT_COLORS: Record<string, string> = {
  blue: '#4A7FA5',
  green: '#7A9E7E',
  amber: '#C8A96E',
  red: '#A85555',
}

// ─── Journal sync map: pre-ceremony key → member_journals key ────────────────
const PRE_TO_JOURNAL_MAP: Record<string, string> = {
  'w0-p0': 'p0-0',  // "What do I want? What is my intention?"
  'w3-p0': 'p0-6',  // "Where am I lying to myself?"
  'w4-p0': 'p0-12', // "Who do I need to forgive..."
}

// ─── Component ────────────────────────────────────────────
export default function PreCeremonyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [activeWeek, setActiveWeek] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [journal, setJournal] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // ── Auth + data load
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const { data } = await supabase
        .from('pre_ceremony_progress')
        .select('*')
        .eq('member_id', user.id)
        .single()

      if (data) {
        setCompleted(new Set(data.weeks_completed ?? []))
        setChecklist(data.checklist_items ?? {})
        setJournal(data.journal_responses ?? {})
        // Resume at last uncompleted week
        const done = new Set<number>(data.weeks_completed ?? [])
        const next = [0,1,2,3,4,5].find(w => !done.has(w))
        if (next !== undefined) setActiveWeek(next)
        else setActiveWeek(5)
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Hash navigation: deep-link to a specific week's journal section
  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    const match = hash.match(/^#journal-w(\d)$/)
    if (!match) return
    const weekNum = parseInt(match[1], 10)
    if (weekNum < 1 || weekNum > 6) return
    setActiveWeek(weekNum - 1)
    setTimeout(() => {
      document.getElementById(`journal-w${weekNum}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
  }, [loading])

  // ── Save
  const save = useCallback(async (newCompleted: Set<number>, newChecklist: Record<string, boolean>, newJournal?: Record<string, string>) => {
    if (!userId) return
    setSaveStatus('saving')
    await supabase.from('pre_ceremony_progress').upsert({
      member_id: userId,
      weeks_completed: [...newCompleted],
      checklist_items: newChecklist,
      journal_responses: newJournal ?? journal,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [userId, journal])

  const syncToMainJournal = useCallback(async (integJournal: Record<string, string>, changedKey: string) => {
    if (!userId || !PRE_TO_JOURNAL_MAP[changedKey]) return
    const updates: Record<string, string> = {}
    for (const [integKey, journalKey] of Object.entries(PRE_TO_JOURNAL_MAP)) {
      if (integJournal[integKey]) updates[journalKey] = integJournal[integKey]
    }
    if (Object.keys(updates).length === 0) return
    const { data } = await supabase.from('member_journals').select('responses').eq('member_id', userId).maybeSingle()
    const merged = { ...((data?.responses as Record<string, string>) ?? {}), ...updates }
    await supabase.from('member_journals').upsert({ member_id: userId, responses: merged, last_saved_at: new Date().toISOString() }, { onConflict: 'member_id' })
  }, [userId])

  const journalTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const updateJournal = (key: string, value: string) => {
    const next = { ...journal, [key]: value }
    setJournal(next)
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current)
    journalTimerRef.current = setTimeout(() => {
      save(completed, checklist, next)
      syncToMainJournal(next, key)
    }, 1500)
  }

  const markComplete = async (weekIdx: number) => {
    if (completed.has(weekIdx)) return
    const next = new Set(completed)
    next.add(weekIdx)
    setCompleted(next)
    setTimeout(() => setActiveWeek(Math.min(weekIdx + 1, 5)), 300)
    await save(next, checklist)
  }

  const toggleCheck = async (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next)
    await save(completed, next)
  }

  const progress = Math.round((completed.size / 6) * 100)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E1A10', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#7A9E7E', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
        <style>{`@keyframes pulse { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --forest: #1C2B1E; --deep: #0E1A10;
          --sage: #7A9E7E; --sage-lt: #A8C5AC;
          --gold: #C8A96E; --cream: #F5F0E8; --warm: #FDFBF7;
          --stone: #8B8070; --ink: #1A1A18; --ink-mid: #3D3D38;
          --border: rgba(28,43,30,0.12); --border-lt: rgba(28,43,30,0.06);
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'Jost', sans-serif; font-weight: 300; background: var(--warm); color: var(--ink); }

        /* NAV */
        .pc-nav { position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-bottom:1px solid rgba(200,169,110,.08); }
        .pc-nav-left { display:flex;align-items:center;gap:32px; }
        .pc-logo { font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:var(--cream);text-decoration:none; }
        .pc-logo em { font-style:italic;color:var(--sage-lt); }
        .pc-nav-links { display:flex;align-items:center;gap:4px; }
        .pc-nav-link { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border-radius:3px;transition:color .2s;border:none;background:none;font-family:inherit;cursor:pointer; }
        .pc-nav-link:hover { color:var(--cream); }

        /* DROPDOWN */
        .pc-dropdown { position:relative; }
        .pc-dropdown-trigger { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--sage-lt);padding:6px 14px;border-radius:3px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px; }
        .pc-dropdown-trigger::after { content:'▾';font-size:8px;color:var(--gold); }
        .pc-dropdown-menu { display:none;position:absolute;top:calc(100% + 10px);left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:180px;padding:8px 0;box-shadow:0 16px 40px rgba(0,0,0,.4); }
        .pc-dropdown:hover .pc-dropdown-menu { display:block; }
        .pc-dropdown-item { display:block;padding:10px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.55);text-decoration:none;transition:color .15s,background .15s;border-left:2px solid transparent; }
        .pc-dropdown-item:hover { color:var(--cream);background:rgba(122,158,126,.06); }
        .pc-dropdown-item.current { color:var(--sage-lt);border-left-color:var(--sage); }
        .pc-dropdown-item.soon { color:rgba(245,240,232,.22);cursor:default;pointer-events:none; }
        .pc-dropdown-item.soon::after { content:' — soon';font-size:8px;color:rgba(200,169,110,.4); }

        .pc-nav-right { display:flex;align-items:center;gap:14px; }
        .pc-nav-email { font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .pc-nav-out { font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.5);background:none;border:none;cursor:pointer;font-family:inherit;transition:color .2s; }
        .pc-nav-out:hover { color:var(--gold); }

        /* PROGRESS */
        .pc-prog { background:rgba(28,43,30,.06);border-bottom:1px solid var(--border-lt);padding:10px 48px;display:flex;align-items:center;gap:16px; }
        .pc-prog-label { font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--stone); }
        .pc-prog-track { flex:1;height:2px;background:var(--border);border-radius:2px;max-width:300px; }
        .pc-prog-fill { height:100%;background:var(--sage);border-radius:2px;transition:width .6s ease; }
        .pc-prog-week { font-size:8.5px;letter-spacing:.1em;color:var(--sage); }

        /* HERO */
        .pc-hero { background:var(--forest);padding:80px 60px 72px;position:relative;overflow:hidden; }
        .pc-hero::before { content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(122,158,126,.08) 0%,transparent 70%);pointer-events:none; }
        .pc-hero-inner { position:relative;z-index:1;max-width:860px;margin:0 auto; }
        .pc-hero-eyebrow { font-size:9px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:18px; }
        .pc-hero h1 { font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5vw,62px);font-weight:300;color:var(--cream);line-height:1.06;margin-bottom:22px; }
        .pc-hero h1 em { font-style:italic;color:var(--sage-lt); }
        .pc-hero-desc { font-size:14.5px;color:rgba(245,240,232,.55);line-height:1.95;max-width:600px;margin-bottom:32px; }
        .pc-hero-meta { display:flex;gap:32px;flex-wrap:wrap; }
        .hm-num { font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--cream);line-height:1; }
        .hm-lbl { font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,240,232,.35);margin-top:4px; }

        /* WEEK NAV */
        .pc-week-nav { position:sticky;top:60px;z-index:90;background:rgba(253,251,247,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 48px;display:flex;overflow-x:auto; }
        .pc-week-nav::-webkit-scrollbar { display:none; }
        .wbtn { font-family:inherit;font-size:9px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;padding:0 20px;height:52px;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--stone);background:transparent;white-space:nowrap;transition:all .2s; }
        .wbtn:hover { color:var(--ink); }
        .wbtn.active { color:var(--forest);border-bottom-color:var(--sage);font-weight:500; }
        .wbtn.done::after { content:' ✓';font-size:8px;color:var(--sage);margin-left:4px; }

        /* MAIN */
        .pc-main { max-width:860px;margin:0 auto;padding:0 48px 100px; }
        .pc-panel { display:none;padding-top:56px; }
        .pc-panel.active { display:block; }

        /* CONTINUITY */
        .continuity { display:flex;gap:12px;align-items:flex-start;background:rgba(122,158,126,.06);border-left:2px solid var(--sage-lt);padding:14px 18px;margin-bottom:32px; }
        .ct-arrow { font-size:13px;color:var(--sage);flex-shrink:0;margin-top:1px; }
        .ct-text { font-size:12.5px;color:var(--stone);line-height:1.75; }
        .ct-text strong { color:var(--ink-mid);font-weight:500; }

        /* WEEK HEADER */
        .wh-eyebrow { font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px; }
        .wh-title { font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4vw,46px);font-weight:300;line-height:1.1;margin-bottom:16px;color:var(--ink); }
        .wh-title em { font-style:italic;color:var(--sage); }
        .wh-sub { font-size:14px;color:var(--stone);line-height:1.9;max-width:640px;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:36px; }
        .wh-italic { font-size:13px;color:var(--sage);font-style:italic;margin-top:16px;letter-spacing:.02em; }

        /* SECTION */
        .section { margin-bottom:44px; }
        .section-label { font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--sage);margin-bottom:16px;display:block; }

        /* VIDEO */
        .video-frame { border:.5px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px; }
        .video-primer { background:var(--forest);padding:24px 28px;display:flex;align-items:center;gap:20px; }
        .vp-play { width:44px;height:44px;border-radius:50%;border:1px solid rgba(168,197,172,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer; }
        .vp-play-icon { color:var(--sage-lt);font-size:14px;margin-left:3px; }
        .vp-coming-soon { margin-top:12px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;letter-spacing:.04em;color:var(--gold); }
        .vp-label { font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:6px; }
        .vp-text { font-size:13.5px;color:rgba(245,240,232,.75);line-height:1.7; }
        .vp-text em { font-style:italic;color:var(--cream); }

        /* BOXES */
        .box { margin-top:14px;border-radius:2px;padding:16px 20px; }
        .box-label { font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;font-weight:500; }
        .box-text { font-size:13px;line-height:1.8;color:var(--ink-mid);white-space:pre-line; }
        .box-info { background:rgba(122,158,126,.07);border:.5px solid rgba(122,158,126,.25); }
        .box-info .box-label { color:var(--sage); }
        .box-warn { background:rgba(200,169,110,.08);border:.5px solid rgba(200,169,110,.28); }
        .box-warn .box-label { color:var(--gold); }
        .box-close { background:rgba(122,158,126,.06);border:.5px solid rgba(122,158,126,.2); }
        .box-close .box-label { color:var(--sage); }
        .box-safe { background:rgba(168,85,85,.06);border:.5px solid rgba(168,85,85,.22); }
        .box-safe .box-label { color:#A85555; }

        /* REENTRY */
        .reentry { background:rgba(200,169,110,.05);border:.5px solid rgba(200,169,110,.2);border-radius:2px;padding:14px 20px;margin-bottom:24px;display:flex;gap:14px;align-items:flex-start; }
        .reentry-icon { font-size:13px;color:var(--gold);flex-shrink:0;margin-top:1px; }
        .reentry-text { font-size:12.5px;color:var(--stone);line-height:1.75; }

        /* ACTIONS */
        .actions-intro { font-size:13px;color:var(--stone);line-height:1.8;font-style:italic;margin-bottom:14px;padding-bottom:14px;border-bottom:.5px solid var(--border-lt); }
        .actions-list { display:flex;flex-direction:column;gap:10px; }
        .action-item { display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:.5px solid var(--border);border-radius:4px;background:white; }
        .action-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px; }
        .action-text { font-size:13.5px;color:var(--ink);line-height:1.5; }
        .action-note { font-size:12px;color:var(--stone);line-height:1.6;margin-top:5px;font-style:italic; }

        /* PROMPTS */
        .prompts-list { border-top:1px solid var(--border); }
        .prompt-item { padding:22px 0;border-bottom:1px solid var(--border); }
        .prompt-num { font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--sage);display:block;margin-bottom:10px; }
        .prompt-q { font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px; }
        .prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .journal-textarea{width:100%;margin-top:14px;padding:14px 16px;border:1px solid rgba(122,158,126,0.2);border-left:2px solid var(--sage-lt);background:rgba(122,158,126,0.04);font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:var(--ink);line-height:1.85;resize:vertical;outline:none;min-height:100px;transition:border-color .2s,background .2s}
        .journal-textarea:focus{border-color:var(--sage);background:rgba(122,158,126,0.07)}
        .journal-textarea::placeholder{color:rgba(28,43,30,0.2);font-style:italic}

        /* READINESS GATE */
        .rg-wrap { margin-top:40px;border:.5px solid rgba(122,158,126,.35);border-radius:4px;overflow:hidden; }
        .rg-header { background:var(--forest);padding:18px 24px;display:flex;align-items:center;gap:12px; }
        .rg-dot { width:8px;height:8px;border-radius:50%;background:var(--sage);flex-shrink:0; }
        .rg-title { font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--sage-lt); }
        .rg-body { padding:20px 24px; }
        .rg-item { display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid var(--border); }
        .rg-item:last-of-type { border-bottom:none; }
        .rg-check { width:18px;height:18px;border-radius:2px;border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s; }
        .rg-check.checked { background:var(--sage);border-color:var(--sage); }
        .rg-check-icon { font-size:10px;color:white;opacity:0; }
        .rg-check.checked .rg-check-icon { opacity:1; }
        .rg-item-text { font-size:13px;color:var(--ink-mid);line-height:1.5; }
        .rg-note { margin-top:16px;font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic;border-top:.5px solid var(--border);padding-top:14px; }

        /* BRIDGE */
        .bridge { margin-top:40px;background:var(--forest);padding:32px 36px;border-radius:2px; }
        .bridge-eyebrow { font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block; }
        .bridge-title { font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--cream);line-height:1.2;margin-bottom:14px; }
        .bridge-title em { font-style:italic;color:var(--sage-lt); }
        .bridge-text { font-size:13.5px;color:rgba(245,240,232,.62);line-height:1.9; }

        /* COMPLETE */
        .wc-wrap { margin-top:48px;padding-top:36px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px; }
        .wc-text { font-size:12.5px;color:var(--stone);line-height:1.65; }
        .wc-text strong { color:var(--ink-mid);font-weight:500; }
        .btn-complete { padding:12px 28px;background:var(--sage);border:none;border-radius:3px;color:var(--deep);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap; }
        .btn-complete:hover { background:var(--sage-lt); }
        .btn-complete.done { background:rgba(122,158,126,.12);border:.5px solid var(--sage);color:var(--sage);cursor:default; }

        /* SAVE STATUS */
        .save-pill { position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:4px;font-size:11px;letter-spacing:.1em;font-family:inherit;background:rgba(28,43,30,.9);color:var(--sage);opacity:0;transition:opacity .3s;pointer-events:none;z-index:200; }
        .save-pill.visible { opacity:1; }

        @media (max-width: 640px) {
          .pc-nav { padding:0 20px; }
          .pc-nav-links { display:none; }
          .pc-hero { padding:56px 24px 52px; }
          .pc-main { padding:0 24px 80px; }
          .pc-week-nav { padding:0 12px; }
          .pc-prog { padding:10px 24px; }
        }
      `}</style>

      {/* NAV provided by portal layout */}

      {/* PROGRESS */}
      <div className="pc-prog">
        <span className="pc-prog-label">Your Progress</span>
        <div className="pc-prog-track">
          <div className="pc-prog-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="pc-prog-week">
          {completed.size === 6 ? 'Preparation Complete ✓' : `Week ${Math.min(completed.size + 1, 6)} of 6`}
        </span>
      </div>

      {/* HERO */}
      <div className="pc-hero">
        <div className="pc-hero-inner">
          <span className="pc-hero-eyebrow">Member Portal · Iboga Journey · Confidential</span>
          <h1>Six Weeks of<br /><em>Preparation</em></h1>
          <p className="pc-hero-desc">
            What you do in these six weeks is part of the medicine itself.
            The preparation is the first dose. Each week has one theme, one video transmission, and a small number of clear actions.
            Move through them in order. Trust the arc.
          </p>
        </div>
      </div>

      {/* WEEK NAV */}
      <div className="pc-week-nav">
        {WEEKS.map((w, i) => (
          <button
            key={w.id}
            className={`wbtn${activeWeek === i ? ' active' : ''}${completed.has(i) ? ' done' : ''}`}
            onClick={() => setActiveWeek(i)}
          >
            Week {i + 1} · {w.code}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <main className="pc-main">
        {WEEKS.map((w, i) => (
          <div key={w.id} className={`pc-panel${activeWeek === i ? ' active' : ''}`}>

            {/* Carry forward thread */}
            {w.carryForward && (
              <div className="continuity">
                <div className="ct-arrow">↩</div>
                <div className="ct-text"><strong>Carrying forward from Week {i}:</strong> {w.carryForward}</div>
              </div>
            )}

            {/* Week header */}
            <div>
              <span className="wh-eyebrow">Week {i + 1} · {w.code} · {w.theme}</span>
              <h2 className="wh-title">{w.title}{w.subtitle && <><br /><em>{w.subtitle}</em></>}</h2>
              <p className="wh-sub">{w.sub}</p>
              {w.italic && <p className="wh-italic">{w.italic}</p>}
            </div>

            {/* Re-entry */}
            {w.reentry && (
              <div className="reentry" style={{ marginTop: 24 }}>
                <div className="reentry-icon">◎</div>
                <div className="reentry-text"><strong>{w.reentry.strong}</strong>{w.reentry.text}</div>
              </div>
            )}

            {/* Video */}
            <div className="section" style={{ marginTop: 36 }}>
              <span className="section-label">Video transmission{i === 0 ? ' — watch before anything else' : ''}</span>
              <div className="video-frame">
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">{w.video.label}</div>
                    <div className="vp-text">{w.video.text}</div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
              {w.box && (
                <div className={`box box-${w.box.type}`}>
                  <div className="box-label">{w.box.label}</div>
                  <div className="box-text">{w.box.text}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="section">
              <span className="section-label">{w.actionLabel}</span>
              {w.actionIntro && <p className="actions-intro">{w.actionIntro}</p>}
              <div className="actions-list">
                {w.actions.map((a, ai) => (
                  <div className="action-item" key={ai}>
                    <div className="action-dot" style={{ background: DOT_COLORS[a.color] }} />
                    <div>
                      <div className="action-text">{renderActionText(a.text, (a as { links?: { text: string; href: string; external?: boolean }[] }).links)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {w.safetyBox && (
                <div className="box box-safe" style={{ marginTop: 14 }}>
                  <div className="box-label">{w.safetyBox.label}</div>
                  <div className="box-text">{w.safetyBox.text}</div>
                </div>
              )}
            </div>

            {/* Journal prompts */}
            <div className="section" id={`journal-w${i + 1}`}>
              <span className="section-label">Journal prompts</span>
              <div className="prompts-list">
                {w.prompts.map((p, pi) => {
                  const jKey = `w${i}-p${pi}`
                  return (
                    <div className="prompt-item" key={pi}>
                      <span className="prompt-num">0{pi + 1}</span>
                      <p className="prompt-q">{p.q}</p>
                      <p className="prompt-hint">{p.hint}</p>
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
              </div>
              <div className="continuity" style={{ marginTop: 20, marginBottom: 0 }}>
                <div className="ct-arrow">→</div>
                <div className="ct-text"><strong>What this builds:</strong> {w.thread}</div>
              </div>
            </div>

            {/* Week 6 readiness gate */}
            {w.readinessGate && (
              <>
                <div className="rg-wrap">
                  <div className="rg-header">
                    <div className="rg-dot" />
                    <div className="rg-title">Readiness confirmation — complete before arrival</div>
                  </div>
                  <div className="rg-body">
                    {['Lab results submitted and confirmed reviewed by medical team','Baseline Wellbeing Check-in completed','Preparation call completed with Rachel & Josh'].map((txt, ri) => (
                      <div className="rg-item" key={ri}>
                        <div className={`rg-check${checklist[`rg-${ri}`] ? ' checked' : ''}`} onClick={() => toggleCheck(`rg-${ri}`)}>
                          <span className="rg-check-icon">✓</span>
                        </div>
                        <div className="rg-item-text">{txt}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bridge">
                  <span className="bridge-eyebrow">What comes next</span>
                  <h3 className="bridge-title">The preparation is complete.</h3>
                  <p className="bridge-text">In the weeks following ceremony, this portal will continue to guide you through integration — with the same rhythm, the same depth, and the same care you've experienced here. You will be held through every phase of what comes next.</p>
                </div>
              </>
            )}

            {/* Mark complete */}
            <div className="wc-wrap">
              <div className="wc-text">
                <strong>{i === 5 ? 'You\'ve completed all six weeks.' : `Finished with Week ${i + 1}?`}</strong><br />
                {i === 5 ? 'Mark your preparation complete. You are ready.' : 'Mark it complete and your progress is saved. You can return any time.'}
              </div>
              <button
                className={`btn-complete${completed.has(i) ? ' done' : ''}`}
                onClick={() => markComplete(i)}
                disabled={completed.has(i)}
              >
                {completed.has(i) ? '✓ Completed' : i === 5 ? 'Mark Preparation Complete' : `Mark Week ${i + 1} Complete`}
              </button>
            </div>

          </div>
        ))}
      </main>

      {/* Save status */}
      <div className={`save-pill${saveStatus !== 'idle' ? ' visible' : ''}`}>
        {saveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
      </div>
    </>
  )
}
