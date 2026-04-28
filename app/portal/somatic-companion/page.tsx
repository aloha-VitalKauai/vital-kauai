import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Companion · Week 1 — Vital Kauaʻi" };

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
  .pne-companion-page .pv-footer {
    margin-top: 48px;
    text-align: center;
    color: var(--accent-gold);
    font-size: 11px;
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
            <p className="hero-subtitle">PsychoNeuroEnergetics (PNE)</p>
            <p className="hero-lede">A foundational guide prepared for Iboga Journey participants — polyvagal theory, somatic self-resourcing, and breath practices to support your preparation, ceremony, and integration.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-wrap">
            <div className="vk-eyebrow">Understanding Your Inner Landscape</div>
            <h2 className="vk-title">Polyvagal Theory: <em>The Map of Your States</em></h2>
            <p className="vk-lede">Developed by neuroscientist Dr. Stephen Porges, polyvagal theory illuminates something your body already knows: your nervous system is constantly reading your environment, scanning for safety, and shifting between states that shape how you think, feel, and relate to the world around you.</p>
            <div className="pv-rule"></div>
            <div className="pv-states">
              <article className="pv-card ventral">
                <div className="label">State One</div>
                <h3>Ventral Vagal</h3>
                <div className="state-tag">Safe &amp; Social</div>
                <p>Your home base. Here, your body feels settled, your heart is open, connection feels natural, and creative thought flows easily.</p>
                <p className="feel">You may feel: ease, warmth in the chest, a soft belly, bright eyes, an open throat, a desire to connect.</p>
              </article>
              <article className="pv-card sympathetic">
                <div className="label">State Two</div>
                <h3>Sympathetic</h3>
                <div className="state-tag">Mobilized</div>
                <p>Your system has detected a signal of danger and is preparing you to act — fight or flee. This state is your protection activating.</p>
                <p className="feel">You may feel: racing heart, tight jaw, shallow breath, heat, restlessness, urgency, irritability, or fear.</p>
              </article>
              <article className="pv-card dorsal">
                <div className="label">State Three</div>
                <h3>Dorsal Vagal</h3>
                <div className="state-tag">Shutdown</div>
                <p>When overwhelm exceeds what can be mobilized, the system collapses into stillness. This is an ancient form of protection.</p>
                <p className="feel">You may feel: heaviness, numbness, flatness, disconnection, fog, collapse, or a wish to disappear.</p>
              </article>
            </div>
            <div className="pv-quote">&ldquo;Your body is always doing its best with the information it has. Every state you have ever moved through has been a form of intelligence — a faithful attempt to keep you alive and whole.&rdquo;</div>
            <div className="pv-footer">Week 1 · The Language of the Body</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Felt Sense of Home</div>
            <h2 className="vk-title">What Is <em>Internal Safety</em></h2>
            <p className="vk-lede">A sense of peace inside the body — that all is good. Not a thought, not a conclusion. A felt quality the nervous system can rest into.</p>
            <p className="vk-body">When you are connected to internal safety, you are:</p>
            <ul className="safety-signs">
              <li>Present in the moment, meeting what is happening now rather than living in the past or future.</li>
              <li>Grounded in your body, connected to your breath, sensations, and surroundings.</li>
              <li>Calm enough to pause and respond, instead of reacting from fear or urgency.</li>
              <li>Able to feel emotions without becoming overwhelmed or shutting down.</li>
              <li>Trusting that you can handle what arises, and that you are okay right now.</li>
            </ul>
            <div className="safety-question">
              <span>Beneath all of this, the subconscious is always asking one quiet question:</span>
              &ldquo;Am I safe, or am I not safe?&rdquo;
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why It Matters</div>
            <h2 className="vk-title">Safety Shapes <em>Everything</em></h2>
            <p className="vk-lede">A foundational sense of safety touches every aspect of our being — from how we think to how we connect. When safety is compromised, the system shifts into protection mode, altering our cognitive and emotional landscape.</p>
            <div className="why-grid">
              <div className="why-col">
                <h3>When We Do Not Feel Safe</h3>
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

        <section className="vk-section" id="week-1" style={{ scrollMarginTop: 80 }}>
          <div className="vk-narrow">
            <div className="vk-eyebrow">Week 1 · The Language of the Body</div>
            <h2 className="vk-title">Tracking Sensations <em>in the Body</em></h2>
            <p className="vk-lede">In somatic therapy, tracking means turning your attention inward to notice what the body is doing, without needing to change or fix anything. It is the doorway to every other practice in this guide. The nervous system speaks in a language older than words: sensation, image, feeling, impulse. Learning to listen is the work of a lifetime, and every moment of listening is enough.</p>
            <div className="sibam-panel">
              <div className="label">The Five Channels · SIBAM</div>
              <h3>How <em>Experience</em> Arrives</h3>
              <p>Peter Levine, the founder of Somatic Experiencing, teaches that everything we live through unfolds across five interwoven channels. Any moment of tracking may move through several of them.</p>
              <div className="sibam-row"><div className="sibam-letter">S</div><div><h4>Sensation</h4><p>The physical: warmth, coolness, tingling, pressure, weight, density, pulsing, streaming. The raw felt sense of the body itself.</p></div></div>
              <div className="sibam-row"><div className="sibam-letter">I</div><div><h4>Image</h4><p>The visual: pictures, memories, colors, symbols, shapes that arrive in the mind&apos;s eye. Sometimes clear, sometimes fleeting.</p></div></div>
              <div className="sibam-row"><div className="sibam-letter">B</div><div><h4>Behavior</h4><p>The expressive: gestures, postures, micro-movements, breath rhythms, facial expressions. The body&apos;s own choreography of meaning.</p></div></div>
              <div className="sibam-row"><div className="sibam-letter">A</div><div><h4>Affect</h4><p>The emotional: tones of feeling — joy, grief, fear, tenderness, anger — moving through you with their own colors and currents.</p></div></div>
              <div className="sibam-row"><div className="sibam-letter">M</div><div><h4>Meaning</h4><p>The narrative: the stories, beliefs, and interpretations the mind weaves around what is being experienced. Held lightly, it becomes wisdom.</p></div></div>
            </div>
            <div className="practice-eyebrow">The Practice</div>
            <h2 className="vk-title">How to <em>Listen</em></h2>
            <div className="listen-steps">
              <div className="listen-step"><div className="roman">I</div><h3>Arrive</h3><p>Settle the body. Place your feet. Soften your gaze or close your eyes. Take one slower exhale. You do not need to find anything; you are simply here.</p></div>
              <div className="listen-step"><div className="roman">II</div><h3>Scan</h3><p>Let your attention move slowly through the body — head, throat, chest, belly, pelvis, arms, legs, feet. Not searching, not diagnosing. Just passing through like a gentle light.</p></div>
              <div className="listen-step"><div className="roman">III</div><h3>Notice What Calls</h3><p>Rest your attention wherever there is the most presence — whatever has weight, warmth, tension, movement. The body always has something it is asking you to meet.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Working from the Inside Out</div>
            <h2 className="vk-title">Somatic Self-Resourcing: <em>Coming Back to the Body</em></h2>
            <p className="vk-lede">Somatic means &ldquo;of the body.&rdquo; Somatic self-resourcing is the practice of using your own body — its sensations, its breath, its contact with gravity and the ground — to create a felt sense of safety within yourself.</p>
            <div className="listen-steps">
              <div className="listen-step"><div className="roman">I</div><h3>Orienting</h3><p>Slowly allow your gaze to move through the space around you — as if you are a gentle animal arriving somewhere new. Let your eyes rest on something stable, something soft, something that carries a sense of safety. When you find it, let your gaze settle and breathe there.</p></div>
              <div className="listen-step"><div className="roman">II</div><h3>Grounding</h3><p>Feel the weight of your body making contact with whatever is beneath you — a chair, the floor, the earth. Press your feet into the ground. Let the ground meet you back. Notice how it holds you without effort.</p></div>
              <div className="listen-step"><div className="roman">III</div><h3>Containment</h3><p>Wrap your arms around yourself, or place a hand over your heart and another on your belly. Feel the warmth of your own touch. Let your body know it is held — by no one other than you, and that is enough.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <h2 className="vk-title">The Breath: <em>Always Available, Always Yours</em></h2>
            <p className="vk-lede">Of all the tools available to your nervous system, the breath is the most immediate and the most democratic. When you slow and deepen your breath, you activate the vagus nerve. A longer exhale relative to your inhale communicates directly to your brain that you are safe.</p>
            <div className="breath-panel" id="coherent-heart-breath">
              <div className="label">Foundational Practice</div>
              <h3>The Coherent <em>Heart Breath</em></h3>
              <p className="sub">A complete cycle of breath that fills, stills, and releases.</p>
              <p className="placement">Begin with placement. Bring one hand to rest over your heart and the other over your belly. Feel the warmth of your palms meeting your body. This contact establishes presence.</p>
              <div className="breath-step"><div className="pill">7 sec</div><div><h4>Inhale — Fill the Belly, Then the Chest</h4><p>Begin by allowing the breath to flow into the belly first — feel your lower hand rise as your diaphragm descends. Then continue upward into the chest. Take the full seven seconds to complete this wave of breath, moving from low to high.</p></div></div>
              <div className="breath-step"><div className="pill">7 sec</div><div><h4>Hold — Rest at the Top</h4><p>At the fullness of your inhale, pause. Hold gently, with presence. Feel the aliveness in your body at this moment. This pause is full. Simply be here for seven seconds.</p></div></div>
              <div className="breath-step"><div className="pill">7 sec</div><div><h4>Exhale — Release from the Chest, Then the Belly</h4><p>Let the breath fall from the chest first, then empty fully from the belly. The exhale is where the vagus nerve listens most closely. Let it be slow, soft, and complete.</p></div></div>
              <div className="breath-step"><div className="pill">7 sec</div><div><h4>Pause — Rest in the Empty</h4><p>Before the next inhale, pause again at the bottom. Let the body rest in stillness. Allow the next breath to arrive on its own, when it is ready.</p></div></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <h2 className="vk-title">Additional Practices <em>to Keep Close</em></h2>
            <div className="practices-grid">
              <div className="practice-card"><h3>Orienting Gaze</h3><p>Slowly allow your gaze to sweep the room. Let your eyes rest briefly on objects that feel neutral or pleasant. This slow, deliberate visual scan signals safety to the subcortical brain.</p></div>
              <div className="practice-card"><h3>Feet on the Earth</h3><p>Stand or sit with bare feet on the ground, or imagine roots extending from the soles of your feet into the earth below. Press down. Feel the earth pressing back.</p></div>
              <div className="practice-card"><h3>Temperature Anchor</h3><p>Hold something warm — a mug of tea, a warm cloth, your own palms pressed together. Temperature is one of the fastest pathways to the present-moment body.</p></div>
              <div className="practice-card"><h3>Name What You Notice</h3><p>Gently label the sensations you experience with openness and curiosity: tingling, warmth, tightness, expansion. This practice activates the prefrontal cortex and creates stabilizing distance.</p></div>
              <div className="practice-card"><h3>Sound &amp; Tone</h3><p>Humming, chanting, or toning directly vibrates the vagus nerve. A simple sustained hum activates your parasympathetic system and creates resonance in the body.</p></div>
              <div className="practice-card"><h3>The Inner Witness</h3><p>When activation rises, invite the quiet, steady part of yourself to simply observe. Say inwardly: <em>I see what is happening. I am here with it.</em> The witness accompanies, it holds space.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Safety Through Connection</div>
            <h2 className="vk-title">Relational <em>Practices</em></h2>
            <p className="vk-lede">The body learns safety not only from itself, but from other safe bodies. These four practices weave the work outward — into your relationships, your speech, the way you show up with others.</p>
            <div className="practices-grid">
              <div className="practice-card"><h3>Co-Regulation</h3><p>Connect with a safe person. Borrow calm through their grounded presence — talking, sitting quietly together, or simply being near someone who feels steady. The nervous system regulates fastest in the company of another.</p></div>
              <div className="practice-card"><h3>Compassionate Listening</h3><p>Listen to others with presence and curiosity, without judgment. Allow yourself to be truly heard by someone safe. Feeling witnessed — without correction or advice — creates deep, embodied safety.</p></div>
              <div className="practice-card"><h3>Positive Affirmations</h3><p>Speak kindly to yourself. Use gentle, affirming words that counter negative self-talk and reinforce your inherent worth. The voice you use with yourself is a voice your nervous system listens to all day.</p></div>
              <div className="practice-card"><h3>Boundaries</h3><p>Honor your own limits and respect others&apos;. Clear boundaries create safety by protecting your energy and autonomy. Saying no to what depletes you is a way of saying yes to your own ground.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Working from the Outside In</div>
            <h2 className="vk-title">External Safety: <em>People &amp; Place</em></h2>
            <p className="vk-lede">As internal safety deepens, you naturally seek external structures that reflect this newfound calm. A robust support system means consciously choosing both your people and your places.</p>
            <div className="practices-grid">
              <div className="practice-card"><h3>Your Chosen People</h3><p>Identify two or three individuals who help you feel authentically yourself, respect your boundaries without question, and leave you feeling steadier after connection. These are your anchors during difficult moments.</p></div>
              <div className="practice-card"><h3>A Sacred Place in Nature</h3><p>Find one specific, accessible place near you — a park bench, a quiet trail, a riverbank, a stretch of beach. This personal sanctuary becomes a reliable anchor for grounding your nervous system regularly.</p></div>
              <div className="practice-card"><h3>A Resilient Web</h3><p>By weaving together safe people and nurturing natural spaces, you create a living support network that sustains you far beyond any one professional relationship. The web itself becomes the medicine.</p></div>
              <div className="practice-card"><h3>An Organized Life</h3><p>Reduce clutter where you can. Create devoted places for your belongings. An organized home reduces cognitive load and offers the nervous system a calm, predictable environment to soften into.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Safety in the Medicine</div>
            <h2 className="vk-title">In Your <em>Iboga Journey</em></h2>
            <p className="vk-lede">Your journey into deeper self-discovery is profoundly personal — and you are not alone. Building and trusting your support system is essential to navigating the experience with greater ease, safety, and integration.</p>
            <div className="iboga-grid">
              <div className="iboga-col"><h3>Your Steadfast Team</h3><p>Trust the dedicated people around you. They are there to guide you, hold space, and ensure a foundation of external safety throughout your experience.</p></div>
              <div className="iboga-col"><h3>Anchor in Your Breath</h3><p>If a moment feels overwhelming or uncertain, gently bring your awareness back to your breath. It is always available — a reliable pathway home to yourself.</p></div>
              <div className="iboga-col"><h3>Co-Regulation with Your Coach</h3><p>Do not hesitate to ask your coach or team for support. They can offer grounded presence and help you draw on the safety practices you are building now.</p></div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week One · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">A simple invitation to live this week&apos;s teaching in your body and your life. There is nothing to perform here. Only noticing.</p>
              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Explore the regulation practices in the portal — find what works best for you.</h3>
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
