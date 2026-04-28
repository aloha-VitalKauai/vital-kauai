import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Companion · Week 1, Vital Kauaʻi" };

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
    --vagal-mint:   #D9EBDF;
    --vagal-peach:  #F4E5D2;
    --vagal-blue:   #DCE5F0;
  }

  .pne-companion-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-page .vk-section { padding: 64px 0; }
  .pne-companion-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-page h1.vk-display, .pne-companion-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
  }
  .pne-companion-page h1.vk-display { font-size: clamp(48px, 6.6vw, 80px); }
  .pne-companion-page h2.vk-title   { font-size: clamp(34px, 4.6vw, 54px); }
  .pne-companion-page h1.vk-display em, .pne-companion-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-page p.vk-lede, .pne-companion-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-page .pv-rule { width: 100%; height: 1px; background: var(--line); margin: 28px 0 0; }
  .pne-companion-page .pv-states {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 36px;
  }
  .pne-companion-page .pv-card {
    border-radius: 6px;
    padding: 36px 32px;
    min-height: 440px;
    display: flex;
    flex-direction: column;
  }
  .pne-companion-page .pv-card.ventral     { background: var(--vagal-mint); }
  .pne-companion-page .pv-card.sympathetic { background: var(--vagal-peach); }
  .pne-companion-page .pv-card.dorsal      { background: var(--vagal-blue); }
  .pne-companion-page .pv-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: rgba(31, 38, 32, 0.5);
    margin-bottom: 22px;
  }
  .pne-companion-page .pv-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 32px;
    color: var(--ink-dark);
    line-height: 1.05;
    margin-bottom: 14px;
  }
  .pne-companion-page .pv-card .state-tag {
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 22px;
  }
  .pne-companion-page .pv-card.ventral .state-tag    { color: #2F7A4D; }
  .pne-companion-page .pv-card.sympathetic .state-tag { color: #B47A28; }
  .pne-companion-page .pv-card.dorsal .state-tag     { color: #4D6A99; }
  .pne-companion-page .pv-card p { color: var(--ink-body); font-size: 15.5px; line-height: 1.6; margin-bottom: 18px; }
  .pne-companion-page .pv-card .feel { font-style: italic; color: var(--ink-mute); font-size: 14.5px; line-height: 1.55; margin-top: auto; }

  .pne-companion-page .pv-quote {
    margin-top: 36px;
    background: var(--bg-dark);
    color: var(--ink-light);
    border-left: 4px solid var(--accent-sage);
    padding: 40px 44px;
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.5;
    border-radius: 2px;
  }
  .pne-companion-page .pv-quote-text { margin: 0; }
  .pne-companion-page .pv-cite {
    display: block;
    margin-top: 18px;
    font-style: normal;
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-gold);
    text-align: right;
  }
  .pne-companion-page .pv-footer {
    margin-top: 48px;
    text-align: center;
    color: var(--accent-gold);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
  }

  .pne-companion-page .safety-signs { list-style: none; margin: 24px 0 0; padding: 0; max-width: 760px; }
  .pne-companion-page .safety-signs li {
    position: relative;
    padding: 14px 0 14px 40px;
    border-top: 1px solid var(--line-soft);
    font-size: 15.5px;
    line-height: 1.55;
    color: var(--ink-body);
  }
  .pne-companion-page .safety-signs li:last-child { border-bottom: 1px solid var(--line-soft); }
  .pne-companion-page .safety-signs li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 23px;
    width: 22px;
    height: 1px;
    background: var(--accent-gold);
  }
  .pne-companion-page .safety-question {
    margin-top: 28px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 22px;
    line-height: 1.4;
    color: var(--accent-sage);
    max-width: 760px;
  }
  .pne-companion-page .safety-question span {
    display: block;
    margin-bottom: 8px;
    color: var(--ink-dark);
    font-style: normal;
    font-family: var(--body);
    font-size: 15px;
    line-height: 1.55;
  }

  .pne-companion-page .why-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 36px;
    margin-top: 36px;
  }
  .pne-companion-page .why-col h3 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: 21px;
    line-height: 1.25;
    color: var(--ink-dark);
    margin-bottom: 14px;
    padding-top: 16px;
    border-top: 2px solid var(--accent-gold);
    max-width: 280px;
  }
  .pne-companion-page .why-col ul { list-style: none; padding: 0; }
  .pne-companion-page .why-col li {
    padding: 9px 0;
    font-size: 14.5px;
    line-height: 1.5;
    color: var(--ink-body);
  }
  .pne-companion-page .why-col li + li { border-top: 1px solid var(--line-soft); }
  .pne-companion-page .why-conclude {
    margin-top: 36px;
    padding: 22px 28px;
    background: var(--bg-dark);
    color: var(--ink-light);
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    line-height: 1.45;
    border-left: 3px solid var(--accent-sage);
  }

  .pne-companion-page .sibam-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px 32px;
    margin-top: 36px;
  }
  .pne-companion-page .sibam-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-page .sibam-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 30px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-page .sibam-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-page .sibam-panel > p {
    color: var(--ink-body);
    margin-bottom: 22px;
    max-width: 700px;
    font-size: 15.5px;
    line-height: 1.6;
  }
  .pne-companion-page .sibam-row {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: 18px;
    padding: 20px 0;
    border-top: 1px solid var(--line-soft);
    align-items: start;
  }
  .pne-companion-page .sibam-letter {
    font-family: var(--serif);
    font-style: italic;
    font-size: 28px;
    color: var(--accent-warm);
    line-height: 1;
    padding-top: 2px;
  }
  .pne-companion-page .sibam-row h4 { font-family: var(--body); font-weight: 600; font-size: 16px; color: var(--ink-dark); margin-bottom: 6px; }
  .pne-companion-page .sibam-row p  { color: var(--ink-body); font-size: 15px; line-height: 1.6; margin: 0; }

  .pne-companion-page .practice-eyebrow {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 12px;
    margin-top: 48px;
  }
  .pne-companion-page .listen-steps { margin-top: 28px; }
  .pne-companion-page .listen-step {
    padding: 32px 0;
    border-top: 1px solid var(--line);
  }
  .pne-companion-page .listen-step:first-child { border-top: none; padding-top: 8px; }
  .pne-companion-page .listen-step .roman {
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
    color: var(--accent-warm);
    letter-spacing: 0.14em;
    margin-bottom: 18px;
  }
  .pne-companion-page .listen-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 30px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-page .listen-step p {
    font-size: 15.5px;
    line-height: 1.7;
    color: var(--ink-body);
    max-width: 720px;
  }

  .pne-companion-page .breath-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
    scroll-margin-top: 80px;
  }
  .pne-companion-page .breath-panel .label { font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--accent-sage); margin-bottom: 16px; }
  .pne-companion-page .breath-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 30px;
    color: var(--ink-dark);
    margin-bottom: 10px;
    line-height: 1.1;
  }
  .pne-companion-page .breath-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-page .breath-panel .sub { color: var(--ink-mute); font-size: 15.5px; margin-bottom: 22px; }
  .pne-companion-page .breath-panel .placement {
    font-style: italic;
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 720px;
  }
  .pne-companion-page .breath-step {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 18px;
    padding: 20px 0;
    border-top: 1px solid var(--line-soft);
    align-items: start;
  }
  .pne-companion-page .breath-step .pill {
    background: var(--bg-dark);
    color: var(--ink-light);
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 4px;
    text-align: center;
    letter-spacing: 0.04em;
  }
  .pne-companion-page .breath-step h4 { font-family: var(--body); font-weight: 600; font-size: 16px; color: var(--ink-dark); margin-bottom: 6px; }
  .pne-companion-page .breath-step p  { color: var(--ink-body); font-size: 15px; line-height: 1.6; margin: 0; }

  .pne-companion-page .practices-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-page .practice-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 30px;
  }
  .pne-companion-page .practice-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    margin-bottom: 10px;
    line-height: 1.2;
  }
  .pne-companion-page .practice-card p { color: var(--ink-body); font-size: 15px; line-height: 1.6; margin: 0; }

  .pne-companion-page .iboga-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    margin-top: 32px;
  }
  .pne-companion-page .iboga-col {
    padding-top: 16px;
    border-top: 2px solid var(--accent-gold);
  }
  .pne-companion-page .iboga-col h3 {
    font-family: var(--serif);
    font-weight: 500;
    font-size: 21px;
    color: var(--ink-dark);
    margin-bottom: 10px;
    line-height: 1.2;
  }
  .pne-companion-page .iboga-col p { font-size: 15px; line-height: 1.6; color: var(--ink-body); }

  .pne-companion-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }
  .pne-companion-page .reflection .example {
    display: block;
    margin-top: 6px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 14.5px;
    color: var(--ink-mute);
    line-height: 1.55;
  }

  .pne-companion-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto 24px;
  }
  .pne-companion-page .closing-band .closing-signoff {
    margin-top: 36px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 17px;
    color: var(--ink-mute);
  }

  @media (max-width: 880px) {
    .pne-companion-page .vk-section { padding: 48px 0; }
    .pne-companion-page .vk-wrap, .pne-companion-page .vk-narrow { padding: 0 24px; }
    .pne-companion-page header.hero { padding: 64px 0 72px; }
    .pne-companion-page .pv-states { grid-template-columns: 1fr; gap: 16px; }
    .pne-companion-page .pv-card { min-height: auto; padding: 28px 24px; }
    .pne-companion-page .pv-quote { padding: 28px 24px; }
    .pne-companion-page .why-grid { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-page .practices-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-page .practice-card { padding: 26px 22px; }
    .pne-companion-page .sibam-panel, .pne-companion-page .breath-panel { padding: 28px 22px; }
    .pne-companion-page .iboga-grid { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-page .homework-panel { padding: 32px 22px; }
    .pne-companion-page .breath-step, .pne-companion-page .sibam-row { grid-template-columns: 1fr; gap: 6px; }
  }
`;

export default async function SomaticCompanionPage() {
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

      <div className="pne-companion-page">
        <span id="top" />
        <header className="hero">
          <div className="vk-wrap">
            <div className="vk-eyebrow">Iboga Journey · Member Resource</div>
            <h1>Week One <em>PNE (PsychoNeuroEnergetics) Companion</em></h1>
            <p className="hero-lede">A foundational guide prepared for Iboga Journey participants, polyvagal theory, somatic self-resourcing, and breath practices to support your preparation, ceremony, and integration.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Felt Sense of Home</div>
            <h2 className="vk-title">What Is <em>Internal Safety</em></h2>
            <p className="vk-lede">A felt sense of peace inside the body, the embodied knowing that all is good. It arrives as a quality the nervous system can rest into.</p>
            <p className="vk-body">When you are connected to internal safety, you are:</p>
            <ul className="safety-signs">
              <li>Present in the moment, meeting what is happening now rather than living in the past or future.</li>
              <li>Grounded in your body, connected to your breath, sensations, and surroundings.</li>
              <li>Calm enough to pause and respond, instead of reacting from fear or urgency.</li>
              <li>Able to feel emotions while staying present and steady.</li>
              <li>Trusting that you can handle what arises, and that you are okay right now.</li>
            </ul>
            <div className="safety-question">
              <span>Beneath all of this, the subconscious is always asking one quiet question:</span>
              &ldquo;Am I safe?&rdquo;
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why It Matters</div>
            <h2 className="vk-title">Safety Shapes <em>Everything</em></h2>
            <p className="vk-lede">A foundational sense of safety touches every aspect of our being, from how we think to how we connect. When safety is compromised, the system shifts into protection mode, altering our cognitive and emotional landscape.</p>
            <div className="why-grid">
              <div className="why-col">
                <h3>When the System Senses Threat</h3>
                <ul>
                  <li>Thinking becomes ineffective</li>
                  <li>The prefrontal lobes are less engaged, impairing logic and clarity</li>
                  <li>Energy redirects to self-protection and survival</li>
                  <li>A sense of needing to &ldquo;walk on eggshells&rdquo;</li>
                </ul>
              </div>
              <div className="why-col">
                <h3>This Tends to Lead To</h3>
                <ul>
                  <li>Reduced creativity and critical thinking</li>
                  <li>Making enemies instead of friends</li>
                  <li>Living in defense instead of openness</li>
                </ul>
              </div>
              <div className="why-col">
                <h3>Emotional &amp; Relational State</h3>
                <ul>
                  <li>Less connected to the heart</li>
                  <li>Reduced compassion and gratitude</li>
                  <li>More scarcity-based thinking</li>
                </ul>
              </div>
            </div>
            <div className="why-conclude">Safety creates the conditions for clarity, connection, and growth.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Safety Through Connection</div>
            <h2 className="vk-title">Relational <em>Practices</em></h2>
            <p className="vk-lede">The body learns safety from itself and, equally, from other safe bodies. These four practices weave the work outward, into your relationships, your speech, the way you show up with others.</p>
            <div className="practices-grid">
              <div className="practice-card"><h3>Co-Regulation</h3><p>Connect with a safe person. Borrow calm through their grounded presence, talking, sitting quietly together, or simply being near someone who feels steady. The nervous system regulates fastest in the company of another.</p></div>
              <div className="practice-card"><h3>Compassionate Listening</h3><p>Listen to others with presence and curiosity, holding space for whatever arises. Allow yourself to be truly heard by someone safe. Feeling witnessed, simply received, creates deep, embodied safety.</p></div>
              <div className="practice-card"><h3>Positive Affirmations</h3><p>Speak kindly to yourself. Use gentle, affirming words that reinforce your inherent worth. The voice you use with yourself is a voice your nervous system listens to all day.</p></div>
              <div className="practice-card"><h3>Boundaries</h3><p>Honor your own limits and respect others&apos;. Clear boundaries create safety by protecting your energy and autonomy. Saying yes to what nourishes you is how you stand on your own ground.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Working from the Outside In</div>
            <h2 className="vk-title">External Safety: <em>People &amp; Place</em></h2>
            <p className="vk-lede">As internal safety deepens, you naturally seek external structures that reflect this newfound calm. A robust support system means consciously choosing both your people and your places.</p>
            <div className="practices-grid">
              <div className="practice-card"><h3>Your Chosen People</h3><p>Identify two or three individuals who help you feel authentically yourself, honor your boundaries fully, and leave you feeling steadier after connection. These are your anchors during difficult moments.</p></div>
              <div className="practice-card"><h3>A Sacred Place in Nature</h3><p>Find one specific, accessible place near you, a park bench, a quiet trail, a riverbank, a stretch of beach. This personal sanctuary becomes a reliable anchor for grounding your nervous system regularly.</p></div>
              <div className="practice-card"><h3>A Resilient Web</h3><p>By weaving together safe people and nurturing natural spaces, you create a living support network that sustains you far beyond any one professional relationship. The web itself becomes the medicine.</p></div>
              <div className="practice-card"><h3>An Organized Life</h3><p>Reduce clutter where you can. Create devoted places for your belongings. An organized home reduces cognitive load and offers the nervous system a calm, predictable environment to soften into.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Safety in the Medicine</div>
            <h2 className="vk-title">In Your <em>Iboga Journey</em></h2>
            <p className="vk-lede">Your journey into deeper self-discovery is profoundly personal, and held by community. Building and trusting your support system is essential to navigating the experience with greater ease, safety, and integration.</p>
            <div className="iboga-grid">
              <div className="iboga-col"><h3>Your Steadfast Team</h3><p>Trust the dedicated people around you. They are there to guide you, hold space, and ensure a foundation of external safety throughout your experience.</p></div>
              <div className="iboga-col"><h3>Anchor in Your Breath</h3><p>If a moment feels overwhelming or uncertain, gently bring your awareness back to your breath. It is always available, a reliable pathway home to yourself.</p></div>
              <div className="iboga-col"><h3>Co-Regulation with Your Integration Guide</h3><p>Reach out to your integration guide, or to Rachel and Josh, whenever you need support. They can offer grounded presence and help you draw on the safety practices you are building now.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week One · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">A simple invitation to live this week&apos;s teaching in your body and your life. The practice is simply to notice.</p>
              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Explore the regulation practices in the portal, find what works best for you.</h3>
                <div className="hw-tags">Breathing &nbsp;·&nbsp; Grounding &nbsp;·&nbsp; 4 / 7 / 8 Breath &nbsp;·&nbsp; PNE (PsychoNeuroEnergetics) Breath (Belly / Heart) &nbsp;·&nbsp; Orienting &nbsp;·&nbsp; Felt-Sense Regulation</div>
              </div>
              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Reflection</h3>
                <p className="reflection">What do I notice differently in my body after using some of these practices throughout my day?</p>
                <p className="reflection">What is one action I can take this week to create a deeper sense of external safety in my life?
                  <span className="example">For example: spend time with one trusted friend and share about your upcoming Iboga journey · declutter one room in your home · find one place in nature you would like to visit.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Core of Every Practice</div>
            <h2>Remember your breath. <em>You are safe.</em></h2>
            <p>Every practice in this guide is pointing toward the same place: the living intelligence that already exists within you. The Iboga medicine will meet you exactly where you are.</p>
            <p>If you remember one thing, remember your breath.</p>
          </div>
        </section>
      </div>
    </>
  );
}
