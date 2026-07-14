// Pre-ceremony Integration page content. Plain TS module so server code
// (the journey-emails cron, the founder dashboard's auto-derived email
// preview) can import the data — Next.js refuses to expose constants from
// 'use client' modules to Server Components, so the data lives here and the
// page imports from this file.

import { PRE_CEREMONY_WEEKS } from '@/lib/journal-prompts'

export type ActionLinkArr = { text: string; href: string; external?: boolean }[]
export type ActionCard =
  | { kind: 'internal'; href: string; text: string; key: string }
  | { kind: 'hash';     href: string; text: string; key: string }
  | { kind: 'external'; href: string; text: string; key: string }
  | { kind: 'static';   text: string; links?: ActionLinkArr; key: string }

// Member-facing contribution destination. Both the portal home docCard and
// the pre-ceremony week content route here; the page itself picks the right
// payment provider (Stripe today, Square once PAYMENT_PROVIDER=square).
export const STRIPE_LOVE_OFFERING_URL = '/portal/donate'

export const actionsForWeek = (
  weekIdx: number,
  actions: ReadonlyArray<{ text: string; links?: ActionLinkArr; key?: string }>,
): ActionCard[] => {
  if (weekIdx === 0) {
    return [
      { kind: 'hash',     href: '#journal-prompts',                    text: 'Respond to this week’s journal prompts', key: 'a0' },
      { kind: 'external', href: '/iboga-preparedness-guide.html#iboga', text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide', key: 'a1' },
      { kind: 'internal', href: '/portal/somatic-companion#top',    text: 'Read Week 1 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', key: 'a2' },
      { kind: 'static',                                              text: "Complete this week's PNE Practice", key: 'a3' },
      { kind: 'static',                                              text: "Complete this week's PNE Reflection", key: 'a4' },
      { kind: 'internal', href: '/portal#integration-specialist',      text: 'Schedule three or four of your six integration-guide calls up front', key: 'a5' },
    ]
  }
  return actions.map((a, idx) => {
    const key = a.key ?? `a${idx}`
    const links = a.links ?? []
    if (links.length === 0) return { kind: 'static', text: a.text, key }
    if (links.length > 1)   return { kind: 'static', text: a.text, links, key }
    const lnk = links[0]
    if (lnk.external)              return { kind: 'external', href: lnk.href, text: a.text, key }
    if (lnk.href.startsWith('#'))  return { kind: 'hash',     href: lnk.href, text: a.text, key }
    return { kind: 'internal', href: lnk.href, text: a.text, key }
  })
}

export const WEEKS = [
  {
    id: 0,
    code: 'IKE',
    principleName: 'Ike',
    principle: 'I create my reality.',
    theme: 'Perception',
    title: 'Seeing clearly.',
    subtitle: 'This is the beginning of something real.',
    sub: 'You are the creator of your life. This first week is an invitation to honestly look at the reality you have created for yourself. It’s an opportunity to notice the patterns, environments, relationships, thoughts, and beliefs that have shaped your current experience, and from that awareness begin creating in a way that is more aligned with who you truly are.',
    italic: 'This week calls for presence. Just begin.',
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'In this opening session of the Vital Kauaʻi series, we explore ʻIke — the Hawaiian principle of seeing, knowing, and perceiving — and how your awareness shapes the reality you experience. We move from the science of the mind and body as one system, through epigenetics and neuroplasticity, to what it means to live beyond the senses.', url: 'https://www.youtube.com/embed/_qdr02dq_NU' },
    box: { type: 'info', label: 'The most important safety factor is your honesty.', text: 'Your labs, your diet, and your supplement plan all matter—but it\'s your willingness to see yourself clearly that shapes how the medicine meets you. Iboga brings truth to the surface. When you arrive having already begun that process with yourself, the experience becomes something you can move through with awareness. This is how the medicine meets you.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Sign both required documents, Membership Agreement, Medical Disclaimer',
        note: 'Each document is an act of commitment. Read them with care.',
        links: [
          { text: 'Membership Agreement', href: '/portal#agreement-card' },
          { text: 'Medical Disclaimer', href: '/portal#medical-card' },
        ],
      },
      {
        key: 'a1',
        color: 'blue',
        text: 'Submit your contribution',
        note: 'Your donation completes the container. It signals to your nervous system: I have chosen this. I am in.',
        links: [
          { text: 'Submit your contribution', href: STRIPE_LOVE_OFFERING_URL },
        ],
      },
      {
        key: 'a2',
        color: 'blue',
        text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
        note: 'Begin an honest relationship with what you\'re stepping into.',
        links: [
          {
            text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#iboga',
            external: true,
          },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[0].prompts,
    thread: 'Your answers here are the raw material of your Questions for the Medicine, the specific questions you\'ll bring into ceremony. Write honestly. Over the coming weeks, these words will sharpen into something you can carry in. This is where that conversation begins.',
  },
  {
    id: 1,
    code: 'MAKIA',
    principleName: 'Makia',
    principle: 'Energy flows where attention goes.',
    theme: 'Focus',
    title: 'What you turn toward,',
    subtitle: 'turns toward you.',
    carryForward: 'You named what you want and what is asking to change. That honesty is already in motion. This week you begin aligning your whole life, your body, your choices, your attention, toward what\'s coming.',
    sub: 'Makia means energy flows where attention goes. Where is your attention going? This week asks you to look at what you are feeding with your focus, and what that is growing.',
    video: { label: 'A Message from Rachel · Week 2', text: 'This week we explore Makia, the Hawaiian principle of focus and aim. Last week we looked at the lens of perception. This week we choose where to point it. Rachel shares the science behind attention and how Iboga can help us rewire new habits. She shares a story from her own experience and how reinforcing and redirecting attention can help us grow.', url: 'https://www.youtube.com/embed/Zstm7cLyEHE' },
    box: { type: 'info', label: 'The identity shift', text: 'You are no longer the person who was considering this. The moment you committed, something changed. This week\'s job is to feel that shift, as a lived, embodied orientation. The portal, this video, and the prompts below all serve one thing: moving you from "I signed up for something" to "I am inside a process."' },
    actionLabel: 'Actions this week, 3 only',
    actionIntro: 'Identity shifts happen in the noticing. This week your job is to begin seeing clearly, the changes will follow.',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'blue',
        text: 'Read "Iboga & Ibogaine" and "Medical Preparation & Contraindications" in your Preparedness Guide',
        note: 'Two short sections. The first names what we work with; the second is the safety frame your physician will use.',
        links: [
          {
            text: 'Read "Iboga & Ibogaine" and "Medical Preparation & Contraindications" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#medicine-forms',
            external: true,
          },
        ],
      },
      {
        key: 'a2',
        color: 'green',
        text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection',
        links: [
          { text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', href: '/portal/somatic-companion/week-2#top' },
        ],
      },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a4', color: 'green', text: "Complete this week's PNE Reflection" },
      {
        key: 'a5',
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Come with your intentions from Week 1. Come with your questions. Come as you are. This call is the beginning of a relationship that will hold you through the hardest parts of what\'s ahead.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        key: 'a6',
        color: 'blue',
        text: 'Schedule your required medical appointments and labs',
        note: 'EKG and labs must be completed before Week 5. Schedule now, medical appointments take time. This protects you.',
        links: [
          { text: 'Schedule your required medical appointments and labs', href: '/portal/physician-guide' },
        ],
      },
      {
        key: 'a7',
        color: 'amber',
        text: 'Schedule next week\'s call with Rachel & Josh',
        links: [
          { text: 'Schedule next week\'s call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[1].prompts,
    thread: '"What must change" becomes the spine of your Week 4 shadow work and your Week 6 ceremony questions. Start a running list anywhere, the specific questions you want to bring to the medicine will take shape over the next four weeks. You\'ll draft them formally in Week 4.',
  },
  {
    id: 2,
    code: 'MANAWA',
    principleName: 'Manawa',
    principle: 'The moment of power is now.',
    theme: 'Presence',
    title: 'Presence is the practice.',
    subtitle: '',
    carryForward: 'You named what must change and what you\'re committing to. This week the work moves from mind into body. The clarity you found last week needs a regulated nervous system to land in. That\'s what this week builds.',
    reentry: { strong: 'Arriving at this week behind?', text: ' If you haven\'t yet completed your first integration call with your guide, do that first, before starting anything here. One real conversation with your guide is worth more than moving forward alone. If you\'re behind on journaling, write just five minutes on Week 1\'s prompts before opening Week 3. Start here: one integration call scheduled, one journal prompt written.' },
    sub: 'You have everything you need, right here, in this moment. The past is memory; the future is imaginary. Now is the only ground that is true, and the only place where change and choice can happen.\n\nMany of us have learned to leave the present moment because it is how our bodies keep us safe. Presence means meeting the past or future anxieties with care.\n\nWeek 3 is about remembering the power of the present moment. Through simple practices of breath, body awareness, and sensation, you build the muscle of presence, and the capacity to be with what is.',
    video: { label: 'A Message from Rachel · Week 3', text: 'In this week’s video, Rachel shares what Manawa has meant in her own life and how returning to the body has shaped the way she meets what each day brings.', url: 'https://www.youtube.com/embed/PeJ96KqpsiA' },
    box: { type: 'info', label: 'If something surfaces this week', text: 'Iboga is intelligent and relational. It begins its work the moment you say yes. If difficult material arises, old grief, anxiety, somatic intensity, here is what to do: slow down deliberately. Bring your attention to one physical sensation at a time. Breathe. Place both feet on the floor. Be with what is arising, presence is enough. Your integration guide is available between sessions. Reach out whenever you need support.\n\nSome days will feel harder to begin. Noticing that, naming it honestly, is itself the practice.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'blue',
        text: 'Read "Body, Mind, Spirit Preparation" in your Preparedness Guide',
        note: 'A short orientation to how the body lands into ceremony, paired with the Dietary Guide you\'re beginning this week.',
        links: [
          {
            text: 'Read "Body, Mind, Spirit Preparation" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#preparing-body',
            external: true,
          },
        ],
      },
      {
        key: 'a2',
        color: 'green',
        text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection',
        links: [
          { text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', href: '/portal/somatic-companion/week-3#top' },
        ],
      },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a4', color: 'green', text: "Complete this week's PNE Reflection" },
      {
        key: 'a5',
        color: 'blue',
        text: 'Begin writing your questions for the medicine',
        note: 'Open the questions document and let the first lines arrive. You\'ll keep adding to it as the weeks unfold; Week 4 is when you draft the first version, and Week 6 is when you finalize.',
        links: [
          { text: 'Begin writing your questions for the medicine', href: '/portal/questions-for-the-medicine' },
        ],
      },
      {
        key: 'a6',
        color: 'blue',
        text: 'Connect with Rachel & Josh',
        links: [
          { text: 'Connect with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
      {
        key: 'a7',
        color: 'amber',
        text: 'Begin dietary protocol',
        note: 'Read the Dietary Preparation guide. The body you bring to ceremony is built in these four weeks. This is about arriving as a clear vessel, prepared, open, and ready to receive.',
        links: [
          { text: 'Begin dietary protocol', href: '/portal/dietary' },
        ],
      },
    ],
    safetyBox: { label: 'Physiological preparation, a note on magnesium', text: 'Magnesium supports your heart through ceremony. Healthy magnesium and potassium levels help your heart move smoothly with the medicine. We confirm both with bloodwork before you arrive, and a four-week magnesium glycinate ramp is one of the gentlest ways to arrive well-resourced. If you have any cardiac history, confirm dosing with your physician and let the Vital Kauaʻi team know.' },
    prompts: PRE_CEREMONY_WEEKS[2].prompts,
    thread: 'The body awareness you\'re building this week is what carries you through ceremony. When the medicine is at its most intense, your capacity to track sensation without being consumed by it is the skill that matters most. You are practicing it now.',
  },
  {
    id: 3,
    code: 'KALA',
    principleName: 'Kala',
    principle: 'You are unlimited.',
    theme: 'Release',
    title: 'Kala means to free',
    subtitle: '',
    carryForward: 'Your nervous system is more regulated. Your body has begun its preparation. You have a map of your own inner states. You are ready for what this week asks, trust what you\'ve built.',
    reentry: { strong: 'A note on pacing:', text: ' Let the Coherent Heart Breath be with you this week. Return to it before each journal prompt, let it settle you before you begin, and steady you when the material goes deep.' },
    sub: 'Kala means to free, to loosen, or to release. In the Hawaiian practice of hoʻoponopono, kala is the step where people release one another from old grudges and loosen the emotional ties that keep them bound. This week, PNE turns that same idea toward our emotions. When we allow emotion to move through us in a healthy way, we let go of what keeps us contracted and create more freedom. When we feel more free, we return to our unlimited nature.',
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'In this week’s video, Rachel and Josh share what Kala has meant in their own lives and how letting go has shaped what they are now able to carry.' },
    box: { type: 'warn', label: 'Pacing permission, read this before you begin', text: 'This week\'s journaling may bring up old grief, anger, shame, or material you haven\'t touched in years. That is appropriate. It is a sign the process is working. Write for ten minutes. Stop. Breathe. Come back tomorrow. Go slow on purpose. If something feels too large to hold alone, reach out to your integration guide before your next scheduled call.\n\nAnd know this: this process moves in waves. Feeling more unsettled now than you did in Week 1, more uncertain, more raw, is often a sign something is genuinely moving. Regression before breakthrough is real.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 4 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection',
        links: [
          { text: 'Read Week 4 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', href: '/portal/somatic-companion/week-4#top' },
        ],
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      {
        key: 'a4',
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Bring the material that is surfacing. Your guide is trained to hold exactly this territory.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        key: 'a5',
        color: 'amber',
        text: 'Begin clearing contraindicated substances per your protocol timeline',
        note: 'Cannabis: clear fully 2 weeks before ceremony. All other substances: review the Preparedness Guide. Questions about specific medications, reach out to the team now, not later.',
        links: [
          { text: 'Begin clearing contraindicated substances per your protocol timeline', href: '/iboga-preparedness-guide.html#contraindications', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[3].prompts,
    thread: 'What you name here, you are no longer carrying unconsciously. Iboga surfaces what we hold in the dark. You are turning on a light before you arrive. Next week you turn toward your people.',
  },
  {
    id: 4,
    code: 'ALOHA',
    principleName: 'Aloha',
    principle: 'To love is to be happy with.',
    theme: 'Connection',
    title: 'You walk this with others.',
    subtitle: '',
    carryForward: 'You looked at the shadow. You named what you\'ve been avoiding. That took courage. This week the work moves outward, into your relationships, your home, and the people who will hold you from a distance while you\'re in ceremony.',
    reentry: { strong: 'Arriving at this week without having done Week 4\'s journaling?', text: ' Do one prompt from Week 4, just one, before you move forward. The shadow work and the relational work are connected. Ten minutes of Week 4 journaling is where to begin.' },
    sub: 'Aloha is mutual respect, kindness, and harmony, often interpreted as the “presence of breath” or “breath of life.” It is the alignment of mind and heart. It is how you meet a stranger, how you care for the land, how you hold the people closest to you, and how you return to yourself.\n\nThe Hawaiian teaching holds that to love is to be happy with: to be with what is, with who is, exactly as they are. Without trying to fix, change, or rearrange. This is the practice of relationship.',
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'In this week’s video, Rachel and Josh share what Aloha has meant in their own lives and how it has shaped the way they show up for each other and for this community.' },
    box: { type: 'info', label: 'Why the relational field is the foundation of your return', text: 'The relational preparation you do this week is a structural protection for integration. The weeks and months after ceremony are when the insights are tender and the old world is asking you to return to who you were. The relational preparation you do this week is a structural protection against that pull. Share the Support Person Guide. Have the real conversations. Let your circle know you\'re asking for something from them, and be specific about what.' },
    actionLabel: 'Actions this week, 3 only',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'blue',
        text: 'Read "Ceremony Day" and "The Days After" in your Preparedness Guide',
        note: 'A walkthrough of the ceremony arc and the days that follow, share what feels useful with your support people.',
        links: [
          {
            text: 'Read "Ceremony Day" and "The Days After" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#ceremony-day',
            external: true,
          },
        ],
      },
      {
        key: 'a2',
        color: 'green',
        text: 'Read Week 5 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection',
        links: [
          { text: 'Read Week 5 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', href: '/portal/somatic-companion/week-5#top' },
        ],
      },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a4', color: 'green', text: "Complete this week's PNE Reflection" },
      {
        key: 'a5',
        color: 'green',
        text: 'Share the Support Person Guide with your home circle',
        note: 'Not after ceremony. Now. So they have time to read it, ask questions, and show up prepared for your return.',
        links: [
          { text: 'Share the Support Person Guide with your home circle', href: '/portal/support-person' },
        ],
      },
      {
        key: 'a6',
        color: 'blue',
        text: 'Start packing',
        note: 'Practical, yes, and also a ritualized act of arrival. Let the packing be intentional.',
        links: [
          { text: 'Start packing', href: '/portal/what-to-bring' },
        ],
      },
      {
        key: 'a7',
        color: 'amber',
        text: 'Schedule next week\'s call with Rachel & Josh',
        links: [
          { text: 'Schedule next week\'s call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[4].prompts,
    thread: 'The forgiveness work you begin here continues in ceremony and for months afterward. Begin it this week, the medicine will carry it forward from wherever you start. One week remains.',
  },
  {
    id: 5,
    code: 'MANA',
    principleName: 'Mana',
    principle: 'the power is within you',
    theme: 'Sovereignty',
    title: 'You answer to no one but your own knowing.',
    subtitle: '',
    carryForward: 'You have opened to your people. You have begun the forgiveness work. You have tended your home. This final week calls for completion, alignment, and the willingness to arrive.',
    sub: 'Mana is life force. It is the energy that moves through all things, the current that connects you to the land, to the people around you, and to something greater than yourself. To live with mana is to remember that you are guided, sourced, and held, and that your own authority arises from that alignment.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'In this week’s video, Rachel and Josh share what Mana has meant in their own lives and how standing in their own truth has shaped the way they walk into ceremony.' },
    box: { type: 'close', label: 'Emotional closure, the arc completes here', text: 'Five weeks ago this process asked you to see clearly. Then to commit. Then to tend your body. Then to meet your shadow. Then to open to your people. You have done all of that. Whatever remains unresolved, the medicine will meet it. Your job this week is to arrive with openness, trust your team, and let yourself be held. That is enough. That is everything.\n\nIf you feel uncertain right now, more unsettled than you expected to feel at the end of six weeks of preparation, that feeling often means you have done real work. Uncertainty is a form of readiness.' },
    actionLabel: 'Actions this week, 5 operational completions',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'blue',
        text: 'Read "Integration, The Real Work" in your Preparedness Guide',
        note: 'A simple orientation to the integration arc that begins the moment ceremony ends.',
        links: [
          {
            text: 'Read "Integration, The Real Work" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#integration',
            external: true,
          },
        ],
      },
      {
        key: 'a2',
        color: 'blue',
        text: 'Read the Ceremony Day Guide and Ceremony Guidelines',
        note: 'A walkthrough of how the day itself unfolds, and the agreements that hold the container.',
        links: [
          { text: 'Ceremony Day Guide', href: '/ceremony-day-guide.html', external: true },
          { text: 'Ceremony Guidelines', href: '/portal/ceremony-guidelines' },
        ],
      },
      {
        key: 'a3',
        color: 'green',
        text: 'Read Week 6 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection',
        links: [
          { text: 'Read Week 6 in The PsychoNeuroEnergetics (PNE) Guide, complete the practice and PNE reflection', href: '/portal/somatic-companion/week-6#top' },
        ],
      },
      { key: 'a4', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a5', color: 'green', text: "Complete this week's PNE Reflection" },
      {
        key: 'a6',
        color: 'green',
        text: 'Finalize your Questions for the Medicine',
        note: 'The truest question, that is the one. Hold it with open hands.',
        links: [
          { text: 'Finalize your Questions for the Medicine', href: '/portal/questions' },
        ],
      },
      {
        key: 'a7',
        color: 'red',
        text: 'Confirm labs are submitted',
        note: 'If you haven\'t received confirmation, reach out now and confirm directly. This is a safety step, it directly affects whether your ceremony proceeds as planned.',
        links: [
          { text: 'Confirm labs are submitted', href: '/portal/labs' },
        ],
      },
      {
        key: 'a8',
        color: 'blue',
        text: 'Review your arrival packet',
        note: 'Everything you need for the days right before ceremony, in one place.',
        links: [
          { text: 'Review your arrival packet', href: '/portal/arrival-packet' },
        ],
      },
      {
        key: 'a9',
        color: 'blue',
        text: 'Finish packing',
        links: [
          { text: 'Finish packing', href: '/portal/what-to-bring' },
        ],
      },
      {
        key: 'a10',
        color: 'blue',
        text: 'Connect with Rachel & Josh',
        note: 'Bring your finalized Questions for the Medicine. Bring anything still alive. Speak everything that is ready to be said.',
        links: [
          { text: 'Connect with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[5].prompts,
    thread: 'In Week 1 you named what is asking to change. In Week 2 you named what must change. In Week 4 you looked at what you were hiding. In Week 5 you opened to your people. Now you state what you are ready for and what you are committing to.',
  },
]
