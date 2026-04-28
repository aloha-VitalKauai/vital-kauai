import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Companion · Week 3, Vital Kauaʻi" };

const PAGE_CSS = `
  :root {
    --bg-cream:     #FAF6EC;
    --bg-card:      #F1ECDD;
    --bg-dark:      #1F3A2E;
    --ink-dark:     #1F2620;
    --ink-body:     #5C5A4F;
    --ink-mute:     #8B8770;
    --ink-light:    #E8E2CF;
    --accent-gold:  #C9A86A;
    --accent-sage:  #8FA68A;
    --accent-warm:  #C9985E;
    --line:         rgba(31, 38, 32, 0.10);
    --line-soft:    rgba(31, 38, 32, 0.06);
    --line-light:   rgba(244, 237, 214, 0.16);
    --serif: 'Cormorant Garamond', 'Hoefler Text', Georgia, serif;
    --body:  'Lora', 'Iowan Old Style', Georgia, serif;
  }

  .pne-companion-w3-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-w3-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-w3-page .vk-section { padding: 64px 0; }
  .pne-companion-w3-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-w3-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-w3-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-w3-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-w3-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-w3-page p.vk-lede, .pne-companion-w3-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-w3-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
    border-top: 4px solid #3A2418;
  }
  .pne-companion-w3-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-w3-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w3-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-w3-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-w3-page .gentle-pull {
    margin-top: 28px;
    padding: 22px 28px;
    background: var(--bg-dark);
    color: var(--ink-light);
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    line-height: 1.45;
    border-left: 3px solid var(--accent-sage);
    max-width: 760px;
  }
  .pne-companion-w3-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w3-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-w3-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-w3-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-w3-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-w3-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w3-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-w3-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  .pne-companion-w3-page .deer-panel {
    margin-top: 36px;
    padding: 40px 44px;
    background: var(--bg-card);
    border-radius: 8px;
    text-align: center;
  }
  .pne-companion-w3-page .deer-panel .deer-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 20px;
    color: var(--accent-warm);
    opacity: 0.8;
  }
  .pne-companion-w3-page .deer-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w3-page .deer-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    line-height: 1.15;
    margin-bottom: 16px;
  }
  .pne-companion-w3-page .deer-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w3-page .deer-panel p {
    color: var(--ink-body);
    font-size: 16px;
    line-height: 1.7;
    max-width: 660px;
    margin: 0 auto 14px;
  }
  .pne-companion-w3-page .deer-panel p:last-of-type { margin-bottom: 0; }

  .pne-companion-w3-page .holding-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-top: 28px;
  }
  .pne-companion-w3-page .holding-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 24px 22px;
    text-align: center;
  }
  .pne-companion-w3-page .holding-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 10px;
  }
  .pne-companion-w3-page .holding-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 19px;
    color: var(--ink-dark);
    line-height: 1.25;
    margin-bottom: 8px;
  }
  .pne-companion-w3-page .holding-card p {
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-body);
    margin: 0;
  }

  .pne-companion-w3-page .vocab-panel {
    margin-top: 36px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
  }
  .pne-companion-w3-page .vocab-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w3-page .vocab-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    line-height: 1.15;
    margin-bottom: 12px;
  }
  .pne-companion-w3-page .vocab-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w3-page .vocab-panel > p {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w3-page .vocab-cols {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w3-page .vocab-cols ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-w3-page .vocab-cols li {
    padding: 6px 0;
    font-family: var(--serif);
    font-style: italic;
    font-size: 16.5px;
    color: var(--ink-body);
    line-height: 1.4;
  }

  .pne-companion-w3-page .felt-example {
    margin-top: 28px;
    padding: 28px 32px;
    background: var(--bg-card);
    border-radius: 6px;
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w3-page .felt-example .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 10px;
  }
  .pne-companion-w3-page .felt-example p {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.7;
    margin: 0 0 12px;
  }
  .pne-companion-w3-page .felt-example p:last-child { margin-bottom: 0; }
  .pne-companion-w3-page .felt-example em {
    font-family: var(--serif);
    font-style: italic;
    color: var(--accent-sage);
  }

  .pne-companion-w3-page .flow {
    margin-top: 32px;
  }
  .pne-companion-w3-page .flow-step {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 24px;
    padding: 28px 0;
    border-top: 1px solid var(--line);
    align-items: start;
  }
  .pne-companion-w3-page .flow-step:last-child {
    border-bottom: 1px solid var(--line);
  }
  .pne-companion-w3-page .flow-step .roman {
    font-family: var(--serif);
    font-style: italic;
    font-size: 22px;
    color: var(--accent-warm);
    line-height: 1;
    padding-top: 4px;
    letter-spacing: 0.05em;
  }
  .pne-companion-w3-page .flow-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    margin-bottom: 6px;
    line-height: 1.2;
  }
  .pne-companion-w3-page .flow-step .prompt {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    margin-bottom: 8px;
  }
  .pne-companion-w3-page .flow-step p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.6;
    margin: 0;
  }

  .pne-companion-w3-page .six-step-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-w3-page .six-step-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w3-page .six-step-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  .pne-companion-w3-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-w3-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-w3-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-w3-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w3-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-w3-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-w3-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-w3-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-w3-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-w3-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-w3-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-w3-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-w3-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-w3-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-w3-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-w3-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-w3-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-w3-page .vk-section { padding: 48px 0; }
    .pne-companion-w3-page .vk-wrap, .pne-companion-w3-page .vk-narrow { padding: 0 24px; }
    .pne-companion-w3-page header.hero { padding: 64px 0 72px; }
    .pne-companion-w3-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w3-page .def-card { padding: 24px 22px; }
    .pne-companion-w3-page .deer-panel { padding: 32px 24px; }
    .pne-companion-w3-page .holding-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-companion-w3-page .vocab-panel { padding: 28px 22px; }
    .pne-companion-w3-page .vocab-cols { grid-template-columns: 1fr 1fr; gap: 14px; }
    .pne-companion-w3-page .felt-example { padding: 22px 24px; }
    .pne-companion-w3-page .flow-step { grid-template-columns: 1fr; gap: 8px; }
    .pne-companion-w3-page .flow-step .roman { font-size: 18px; }
    .pne-companion-w3-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function SomaticCompanionWeek3Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      <div className="pne-companion-w3-page">
        <span id="top" />
        <header className="hero">
          <div className="vk-wrap">
            <div className="vk-eyebrow">Iboga Journey · Member Resource</div>
            <h1>Week Three <em>PNE Companion</em></h1>
            <p className="hero-subtitle">Building Somatic Awareness</p>
            <p className="hero-lede">Somatic awareness is the gentle skill of noticing the body from the inside. Of letting the body&apos;s quiet language become familiar, so that what arises can be met with steadiness rather than alarm.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">A Foundation of <em>Inner Safety</em></h2>
            <p className="vk-lede">Building somatic awareness before your Iboga journey gives the body a foundation of inner safety. It supports you in understanding what your body is communicating, and in learning to relate to sensations as messengers rather than something to escape.</p>
            <p className="vk-body">If something intense arises during ceremony, somatic awareness allows you to recognize it as a sensation moving through the body. You can stay with it, breathe with it, and let it pass through. The same skill supports you in PNE sessions, where tender memories and sensations may rise as part of the healing.</p>

            <div className="gentle-pull">Do not fear the fear. It is only a sensation, moving through.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Body&apos;s Quiet Language</div>
            <h2 className="vk-title">What Is a <em>Sensation</em></h2>
            <p className="vk-lede">A sensation is a basic physical experience in the body. Unlike thoughts or emotions, sensations do not tell a story. They are the body&apos;s raw, present signals, arriving before the mind has interpreted them.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Quality One</div>
                <h3>Neutral</h3>
                <p>A sensation is simply itself. Warmth, tightness, tingling. The body offers it without judgment, and we can meet it the same way.</p>
              </div>
              <div className="def-card">
                <div className="label">Quality Two</div>
                <h3>Locatable</h3>
                <p>A sensation often has a place. A flutter in the chest. A pressure in the throat. A heaviness in the legs. The body shows you where to look.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Lesson From the Wild</div>
            <h2 className="vk-title">What Deer Teach Us About <em>Release</em></h2>

            <div className="deer-panel">
              <svg className="deer-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 18 L14 8 M20 18 L24 10 M44 18 L50 8 M44 18 L40 10"/>
                <ellipse cx="32" cy="28" rx="14" ry="10"/>
                <circle cx="28" cy="26" r="1" fill="currentColor"/>
                <path d="M32 38 Q28 44 28 52 M32 38 Q36 44 36 52 M22 36 Q18 42 18 50 M42 36 Q46 42 46 50"/>
              </svg>
              <div className="label">A Story From Nature</div>
              <h3>The body knows how to <em>shake it off</em></h3>
              <p>After escaping a predator, deer in the wild shake vigorously. Their bodies tremble, their legs quiver, and they physically discharge the survival energy that gathered in the moment of danger.</p>
              <p>Then, having moved that energy through, they return to grazing. They live free of chronic patterns because they complete the cycle. Humans often hold the energy in instead. Building somatic awareness is how we begin to gently complete what the body has been holding.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why Tracking Sensations Heals</div>
            <h2 className="vk-title">The Body&apos;s <em>Held Energy</em></h2>
            <p className="vk-lede">When the body has carried a fight, flight, fawn, or freeze response without completing it, the survival energy stays with us. Tracking sensations is how we gently invite that energy to move, allowing the body to soften and return to flow.</p>

            <p className="vk-body" style={{ marginTop: 20 }}>Energy that has been held may show itself as:</p>

            <div className="holding-grid">
              <div className="holding-card">
                <div className="num">One</div>
                <h4>Quietness</h4>
                <p>Numbness, low energy, feeling far from yourself</p>
              </div>
              <div className="holding-card">
                <div className="num">Two</div>
                <h4>Care for Others</h4>
                <p>Attending to others&apos; needs first, smoothing over conflict</p>
              </div>
              <div className="holding-card">
                <div className="num">Three</div>
                <h4>Mental Holding</h4>
                <p>Looping thoughts, rigid patterns, hyper-vigilance</p>
              </div>
              <div className="holding-card">
                <div className="num">Four</div>
                <h4>Tender Reactivity</h4>
                <p>Quick responses, heightened sensitivity, easily startled</p>
              </div>
              <div className="holding-card">
                <div className="num">Five</div>
                <h4>Bodily Tiredness</h4>
                <p>Recurring physical symptoms, fatigue, illness</p>
              </div>
              <div className="holding-card">
                <div className="num">Six</div>
                <h4>Worried Thinking</h4>
                <p>A sense of unease that travels with you</p>
              </div>
            </div>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>These are signs of a body carrying something faithfully, waiting for the chance to release what it has held.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Learning the Vocabulary</div>
            <h2 className="vk-title">Words for What the <em>Body Feels</em></h2>
            <p className="vk-lede">When we have language for sensation, the body can be heard. Below is a small library of words to draw from. Use whatever fits, or find your own. The right word is the one that makes the body say yes, that is it.</p>

            <div className="vocab-panel">
              <div className="label">A Sensation Library</div>
              <h3>Words to Describe <em>What You Feel</em></h3>
              <p>Read slowly. Notice which words your body recognizes. There is no right or wrong list, only what is true in this moment.</p>

              <div className="vocab-cols">
                <ul>
                  <li>Radiating</li>
                  <li>Tremulous</li>
                  <li>Shudder</li>
                  <li>Sharp</li>
                  <li>Numb</li>
                  <li>Breathless</li>
                  <li>Pounding</li>
                  <li>Tremble</li>
                  <li>Energized</li>
                  <li>Electric</li>
                </ul>
                <ul>
                  <li>Blocked</li>
                  <li>Airy</li>
                  <li>Goose-bump</li>
                  <li>Clammy</li>
                  <li>Jumbled</li>
                  <li>Damp</li>
                  <li>Heavy</li>
                  <li>Shivery</li>
                  <li>Tight</li>
                  <li>Flushed</li>
                </ul>
                <ul>
                  <li>Throbbing</li>
                  <li>Dull</li>
                  <li>Quivery</li>
                  <li>Pulsing</li>
                  <li>Buzzy</li>
                  <li>Flutter</li>
                  <li>Pressure</li>
                  <li>Tense</li>
                  <li>Wobbly</li>
                  <li>Tingly</li>
                </ul>
                <ul>
                  <li>Faint</li>
                  <li>Dizzy</li>
                  <li>Achy</li>
                  <li>Light</li>
                  <li>Fuzzy</li>
                  <li>Dense</li>
                  <li>Cool</li>
                  <li>Chills</li>
                  <li>Wavy</li>
                  <li>Spinning</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In Your PNE Sessions</div>
            <h2 className="vk-title">Working With <em>Sensation</em></h2>
            <p className="vk-lede">During PNE sessions, you will track sensations together with your practitioner. The body scanning and regulation practices from Week One are quietly building the capacity that makes this work feel steady and possible.</p>

            <div className="felt-example">
              <div className="label">An Example</div>
              <p>You feel anxious about an upcoming conversation. You pause and turn inward, and you notice a tight knot in your stomach.</p>
              <p>As you stay with it, the knot begins to soften and reveal itself. You notice it carries a fear of being misunderstood, and beneath that, a longing to be seen. That deepening, evolving awareness is the <em>felt sense</em>.</p>
            </div>

            <h3 className="six-step-heading">A Six-Step <em>Inner Practice</em></h3>
            <p className="six-step-sub">A gentle progression you can return to whenever a sensation calls for attention.</p>

            <div className="flow">
              <div className="flow-step">
                <div className="roman">I</div>
                <div>
                  <h3>Notice the Sensation</h3>
                  <div className="prompt">&ldquo;What am I feeling right now in my body?&rdquo;</div>
                  <p>Pause. Bring your attention inward. Let the body show you where it is asking to be met.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">II</div>
                <div>
                  <h3>Name It Without Judgment</h3>
                  <div className="prompt">&ldquo;Tightness.&rdquo; &ldquo;Heaviness.&rdquo; &ldquo;Warmth.&rdquo;</div>
                  <p>Use simple, descriptive language. The naming itself begins to create gentle space between you and the sensation.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">III</div>
                <div>
                  <h3>Make Space for It</h3>
                  <div className="prompt">&ldquo;Can I welcome it? Can I breathe into it?&rdquo;</div>
                  <p>Allow the sensation to be there. Let your breath move toward it, the way you would draw close to something tender.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">IV</div>
                <div>
                  <h3>Follow Its Movement</h3>
                  <div className="prompt">&ldquo;Notice any shifts. Stay curious.&rdquo;</div>
                  <p>Sensations are alive. They expand, contract, soften, move. Stay with what unfolds, with the patience of someone watching weather change.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">V</div>
                <div>
                  <h3>Ask Gently</h3>
                  <div className="prompt">&ldquo;What might this be about?&rdquo;</div>
                  <p>Without forcing an answer, let the question rest near the sensation. Sometimes meaning arises. Sometimes the sensation simply softens. Both are gifts.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">VI</div>
                <div>
                  <h3>Offer Compassion</h3>
                  <div className="prompt">&ldquo;I am here with you.&rdquo;</div>
                  <p>Speak inwardly to the part of you holding this. Let your presence be the warmth that lets the body know it is safe to release.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Three · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three gentle invitations to deepen your relationship with sensation. Approach each with curiosity. The body has been waiting to be heard.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Continue your regulation practices.</h3>
                <div className="hw-tags">Breathing &nbsp;·&nbsp; Grounding &nbsp;·&nbsp; 4 / 7 / 8 Breath &nbsp;·&nbsp; PNE Breath (Belly / Heart) &nbsp;·&nbsp; Orienting &nbsp;·&nbsp; Felt-Sense Regulation</div>
                <p className="reflection">Return to your regulation worksheet in the portal. These practices are the soil. Sensation work grows from them.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Reflection</h3>
                <p className="reflection">How easily can you feel sensation in your body?</p>
                <p className="reflection">When sensation arrives, do you tend to feel it in one place, or in many?</p>
                <p className="reflection">When you are stressed, what sensations do you notice most?</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Practice the six-step inner practice once this week.</h3>
                <p className="reflection">Choose any sensation that calls to you. Walk it gently through the six steps. Notice what shifts, and what simply asks to be witnessed.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Heart of the Practice</div>
            <h2>Sensation is the body speaking. <em>You are learning to listen.</em></h2>
            <p>Every moment of awareness is a small homecoming. The body has been patient, faithful, and wise. The work of this week is simply to turn toward it with curiosity, and to trust that the body always knows the way.</p>
          </div>
        </section>
      </div>
    </>
  );
}
