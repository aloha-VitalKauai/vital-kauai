import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Guide · Week 5, Vital Kauaʻi" };

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

  .pne-companion-w5-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-w5-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-w5-page .vk-section { padding: 64px 0; }
  .pne-companion-w5-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-w5-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-w5-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-w5-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-w5-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-w5-page p.vk-lede, .pne-companion-w5-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-w5-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-w5-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-w5-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w5-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-w5-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-w5-page .gentle-pull {
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
  .pne-companion-w5-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w5-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-w5-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-w5-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-w5-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-w5-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w5-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  /* Belief grid — 6 suffering-based beliefs, 2 cols x 3 rows */
  .pne-companion-w5-page .belief-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-w5-page .belief-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 28px 28px;
    border-left: 2px solid rgba(201, 168, 106, 0.45);
  }
  .pne-companion-w5-page .belief-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .belief-card h4 {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    line-height: 1.25;
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .belief-card p {
    color: var(--ink-body);
    font-size: 14.5px;
    line-height: 1.6;
    margin: 0;
  }

  /* Pattern chain — for the trauma imprint example */
  .pne-companion-w5-page .pattern-chain {
    margin-top: 32px;
    padding: 32px 36px;
    background: var(--bg-card);
    border-radius: 8px;
    border-left: 3px solid var(--accent-warm);
  }
  .pne-companion-w5-page .pattern-chain .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .pattern-chain h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 14px;
  }
  .pne-companion-w5-page .pattern-chain h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w5-page .pattern-chain p.scenario {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 22px;
  }
  .pne-companion-w5-page .chain-link {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 18px;
    align-items: start;
    padding: 14px 0;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w5-page .chain-link:first-of-type { border-top: none; padding-top: 4px; }
  .pne-companion-w5-page .chain-link .step-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-warm);
    letter-spacing: 0.04em;
    line-height: 1.3;
    padding-top: 2px;
  }
  .pne-companion-w5-page .chain-link .link-text {
    font-family: var(--serif);
    font-size: 17px;
    color: var(--ink-dark);
    line-height: 1.45;
  }
  .pne-companion-w5-page .chain-link .link-text em {
    font-style: italic;
    color: var(--accent-sage);
  }

  /* Sub-heading inside a section */
  .pne-companion-w5-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-w5-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w5-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  /* Iboga panel */
  .pne-companion-w5-page .iboga-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-w5-page .iboga-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-w5-page .iboga-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-w5-page .iboga-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w5-page .iboga-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w5-page .iboga-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w5-page .iboga-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w5-page .iboga-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-w5-page .iboga-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w5-page .iboga-list li:first-child { border-top: none; }
  .pne-companion-w5-page .iboga-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  /* Question panel — for the 4 exploration questions */
  .pne-companion-w5-page .question-panel {
    margin-top: 36px;
    padding: 40px 44px;
    background: var(--bg-card);
    border-radius: 8px;
  }
  .pne-companion-w5-page .question-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w5-page .question-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    line-height: 1.15;
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .question-panel h3 em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w5-page .question-panel > p {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w5-page .question-list {
    padding-top: 4px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w5-page .question-item {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 18px;
    align-items: start;
    padding: 22px 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .pne-companion-w5-page .question-item:last-child { border-bottom: none; }
  .pne-companion-w5-page .question-item .q-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 17px;
    color: var(--accent-warm);
    letter-spacing: 0.06em;
    line-height: 1.3;
    padding-top: 6px;
  }
  .pne-companion-w5-page .question-item .q-text {
    font-family: var(--serif);
    font-size: 20px;
    color: var(--ink-dark);
    line-height: 1.4;
  }

  /* Homework panel */
  .pne-companion-w5-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-w5-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-w5-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-w5-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w5-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-w5-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-w5-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-w5-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-w5-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-w5-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-w5-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-w5-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-w5-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-w5-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-w5-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-w5-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-w5-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-w5-page .vk-section { padding: 48px 0; }
    .pne-companion-w5-page .vk-wrap, .pne-companion-w5-page .vk-narrow { padding: 0 24px; }
    .pne-companion-w5-page header.hero { padding: 64px 0 72px; }
    .pne-companion-w5-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w5-page .def-card { padding: 24px 22px; }
    .pne-companion-w5-page .belief-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-companion-w5-page .belief-card { padding: 22px 22px; }
    .pne-companion-w5-page .pattern-chain { padding: 26px 22px; }
    .pne-companion-w5-page .chain-link { grid-template-columns: 36px 1fr; gap: 14px; }
    .pne-companion-w5-page .iboga-panel { padding: 28px 22px; }
    .pne-companion-w5-page .iboga-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-w5-page .question-panel { padding: 28px 22px; }
    .pne-companion-w5-page .question-item { grid-template-columns: 40px 1fr; gap: 14px; padding: 18px 0; }
    .pne-companion-w5-page .question-item .q-text { font-size: 17.5px; }
    .pne-companion-w5-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function SomaticCompanionWeek5Page() {
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

      <div className="pne-companion-w5-page">
        <span id="top" />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week Five <em>PNE Guide</em></h1>
            <p className="hero-subtitle">The Architecture of Belief</p>
            <p className="hero-lede">Beliefs live in the body. Long before they are thoughts, they are sensations, emotions, and patterns the nervous system has learned to call home. The work of this week is to see them, gently, and to begin to remember who you are beneath them.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">Asking the Truest <em>Question</em></h2>
            <p className="vk-lede">Belief work, especially before iboga, opens one of the most important questions of the journey. The beliefs that hold suffering in place are often the ones we cannot see, because they have shaped how we see.</p>
            <p className="vk-body">When a limiting belief becomes visible, the body can begin to soften its grip. What lived below awareness becomes something you can meet, and something you can choose differently.</p>

            <div className="gentle-pull">What beliefs are you carrying that keep you tied to suffering, and who might you become without them?</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">How the Body Holds a Belief</div>
            <h2 className="vk-title">Beliefs as <em>Embodied Patterns</em></h2>
            <p className="vk-lede">In PNE, beliefs are understood as more than ideas in the mind. They are patterns the body has learned, encompassing sensation, emotion, and the nervous system&apos;s whole way of meeting the world.</p>
            <p className="vk-body">This is why a belief can be hard to think your way out of. The thought is the surface. Beneath it lives a felt experience the body has come to know as true. To shift the belief, the body has to feel something different first.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Quality One</div>
                <h3>Embodied</h3>
                <p>A belief lives as a felt pattern in the body, woven from sensation, emotion, and meaning. Thought is only the most visible layer.</p>
              </div>
              <div className="def-card">
                <div className="label">Quality Two</div>
                <h3>Below Awareness</h3>
                <p>Most beliefs were laid down long before words could question them. They show themselves in how we move through the world more than in what we think.</p>
              </div>
            </div>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>A belief is a sensation, an emotion, and a story, woven together by a body that was trying to keep you safe.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Survival Truths That Outstayed Their Time</div>
            <h2 className="vk-title">Beliefs and the <em>Addiction to Suffering</em></h2>
            <p className="vk-lede">The beliefs that keep someone tied to suffering are rarely chosen. They are learned survival truths that may have once protected you, helped you belong, or made sense of pain. Over time, they become patterns that organize limitation, long after the moment that made them needed has passed.</p>

            <p className="vk-body" style={{ marginTop: 20 }}>Some of the most common are these.</p>

            <div className="belief-grid">
              <div className="belief-card">
                <div className="num">Belief One</div>
                <h4>&ldquo;I am not enough.&rdquo;</h4>
                <p>Can create constant striving, self-criticism, perfectionism, or the need to prove worth. Peace can feel undeserved.</p>
              </div>
              <div className="belief-card">
                <div className="num">Belief Two</div>
                <h4>&ldquo;My pain gives me meaning.&rdquo;</h4>
                <p>Suffering can become a way to be seen, understood, or felt as significant, especially when emotional needs went unmet.</p>
              </div>
              <div className="belief-card">
                <div className="num">Belief Three</div>
                <h4>&ldquo;I deserve pain.&rdquo;</h4>
                <p>Sometimes formed through trauma, shame, neglect, or repeated criticism. Can link suffering to identity, punishment, or redemption.</p>
              </div>
              <div className="belief-card">
                <div className="num">Belief Four</div>
                <h4>&ldquo;Love requires sacrifice.&rdquo;</h4>
                <p>When early love was inconsistent or conditional, the nervous system can come to confuse struggle with connection.</p>
              </div>
              <div className="belief-card">
                <div className="num">Belief Five</div>
                <h4>&ldquo;I must stay vigilant to be safe.&rdquo;</h4>
                <p>When the body has learned danger, calm can feel unfamiliar. The system stays attached to alertness, anxiety, or intensity.</p>
              </div>
              <div className="belief-card">
                <div className="num">Belief Six</div>
                <h4>&ldquo;Change is dangerous.&rdquo;</h4>
                <p>Familiar pain can feel safer than the unknown. The body chooses what it knows, even when what it knows is hurting.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Beneath the Belief, the Charge</div>
            <h2 className="vk-title">Unwinding a <em>Trauma Imprint</em></h2>
            <p className="vk-lede">Unwinding a belief is the work of dissolving the trauma imprint underneath it. A trauma imprint forms in a moment of unsafety, when the body links together a sensation, an emotion, and a meaning. Once linked, the body returns to that pattern whenever something in the present brushes against the original moment.</p>

            <div className="pattern-chain">
              <div className="label">An Example</div>
              <h3>How an Imprint <em>Forms</em></h3>
              <p className="scenario">A small moment can carry a long imprint. Here is one familiar shape.</p>

              <div className="chain-link">
                <div className="step-num">I</div>
                <div className="link-text">A child speaks up and is met with shame</div>
              </div>
              <div className="chain-link">
                <div className="step-num">II</div>
                <div className="link-text">The body feels tightness in the chest, heat in the face, fear in the belly</div>
              </div>
              <div className="chain-link">
                <div className="step-num">III</div>
                <div className="link-text">The mind takes a meaning from the moment: <em>&ldquo;It is unsafe to express myself.&rdquo;</em></div>
              </div>
              <div className="chain-link">
                <div className="step-num">IV</div>
                <div className="link-text">The imprint is laid down, sensation, emotion, and meaning woven together</div>
              </div>
              <div className="chain-link">
                <div className="step-num">V</div>
                <div className="link-text">As an adult, even a small pause from others after speaking can summon the same sensations</div>
              </div>
              <div className="chain-link">
                <div className="step-num">VI</div>
                <div className="link-text">The fear returns. The belief speaks again. The pattern repeats.</div>
              </div>
            </div>

            <p className="vk-body" style={{ marginTop: 32 }}>In PNE, the work goes beneath the belief, meeting the charge that holds it in place. The body comes to know, gently and over time, that <em>that was then, this is now</em>. When the system feels safe enough, a new truth can emerge from a more regulated state, and a healthier way of believing becomes possible.</p>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>This is why nervous system safety matters so deeply in preparation and integration. A belief shifts when the body feels safe enough to know something new.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In the Medicine</div>
            <h2 className="vk-title">Belief Work and Your <em>Iboga Journey</em></h2>
            <p className="vk-lede">Understanding beliefs before iboga lets you recognize how trauma, dysregulation, and inherited identity structures may have shaped your life. With that ground in place, iboga becomes more than an interrupter of suffering. It becomes a catalyst for transforming the blueprint underneath.</p>

            <div className="iboga-panel">
              <div className="label">What May Arise</div>
              <h3>Beliefs Becoming <em>Visible</em></h3>
              <p className="intro">Exploring your beliefs before ceremony gives you the steadiness to witness what arises in the journey with greater openness, and to recognize an imprint when it shows itself.</p>

              <div className="iboga-cols">
                <div className="iboga-col">
                  <h4>What you may see</h4>
                  <ul className="iboga-list">
                    <li>The original moments where beliefs were laid down</li>
                    <li>The patterns of suffering those beliefs have organized</li>
                    <li>The body&apos;s long-held charge softening as it is met</li>
                    <li>A more spacious sense of who you are beneath the imprint</li>
                  </ul>
                </div>
                <div className="iboga-col">
                  <h4>Why preparation matters</h4>
                  <ul className="iboga-list">
                    <li>A regulated system can meet what arises with steadiness</li>
                    <li>Familiar beliefs become recognizable, rather than unconscious</li>
                    <li>Insight can land in the body, not only in the mind</li>
                    <li>The blueprint can shift, gently, in the days that follow</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="gentle-pull">Iboga can interrupt the patterns of addiction and suffering. The deeper gift is the chance to transform the blueprint that has held those patterns in place.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Sitting With What is True</div>
            <h2 className="vk-title">Questions to <em>Carry</em></h2>
            <p className="vk-lede">These are an invitation. Read slowly. Notice which question stirs something in the body. There is no urgency to answer, only to let the questions begin their quiet work.</p>

            <div className="question-panel">
              <div className="label">Exploration Questions</div>
              <h3>Four Questions for the <em>Body to Answer</em></h3>
              <p>Let each one rest in you. The body will speak when it is ready.</p>

              <div className="question-list">
                <div className="question-item">
                  <div className="q-num">I</div>
                  <div className="q-text">What do you believe about yourself, others, pain, love, and safety that has made suffering feel necessary?</div>
                </div>
                <div className="question-item">
                  <div className="q-num">II</div>
                  <div className="q-text">What do you believe you have to do or be in order to be loved, accepted, or safe?</div>
                </div>
                <div className="question-item">
                  <div className="q-num">III</div>
                  <div className="q-text">What parts of yourself do you feel you need to hide? Why?</div>
                </div>
                <div className="question-item">
                  <div className="q-num">IV</div>
                  <div className="q-text">What did you decide about yourself, life, the divine, or others during painful moments of your childhood?</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Five · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three invitations to bring belief work into the body. Approach each with curiosity. The patterns have waited a long time to be seen.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Continue your regulation, sensation, and emotion practices.</h3>
                <div className="hw-tags">Breathing &nbsp;·&nbsp; Grounding &nbsp;·&nbsp; Felt-Sense Tracking &nbsp;·&nbsp; The Three-Step Inner Practice</div>
                <p className="reflection">Return to the practices of Weeks One through Four. They are the soil that lets a belief soften when it surfaces.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Sit with one Exploration Question.</h3>
                <p className="reflection">Choose the question that stirred something in the body and write about it in this week&apos;s PNE Reflection.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Notice when a familiar belief speaks.</h3>
                <p className="reflection">When you catch a thought like &ldquo;I am not enough&rdquo; or &ldquo;I have to earn this,&rdquo; pause. Bring your attention to the body. Notice the sensation underneath the thought. Breathe with it. The pattern often begins to soften the moment it is seen.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Heart of the Practice</div>
            <h2>You are more than the beliefs you have inherited. <em>You are learning to choose.</em></h2>
            <p>Every belief that surfaces is an invitation to see what the body has been carrying on your behalf. The work of this week is to meet those beliefs with curiosity, to thank them for what they once made possible, and to begin to remember the self that lives beneath them.</p>
          </div>
        </section>
      </div>
    </>
  );
}
