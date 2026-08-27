import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PneGuidePrintButton, PneGuideFooter } from "@/components/portal/PneGuidePrint";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Integration Guide · Week 1, Vital Kauaʻi" };

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

  .pne-companion-integration-w1-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-integration-w1-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-integration-w1-page .vk-section { padding: 64px 0; }
  .pne-companion-integration-w1-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-integration-w1-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-integration-w1-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-integration-w1-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-integration-w1-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-integration-w1-page p.vk-lede, .pne-companion-integration-w1-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-integration-w1-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-integration-w1-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-integration-w1-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-integration-w1-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-integration-w1-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }
  .pne-companion-integration-w1-page .hero p.hero-attrib {
    margin-top: 28px;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.85);
    line-height: 1.6;
    max-width: 620px;
  }

  .pne-companion-integration-w1-page .gentle-pull {
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
  .pne-companion-integration-w1-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-integration-w1-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-integration-w1-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-integration-w1-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-integration-w1-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-integration-w1-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w1-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-integration-w1-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  /* Practice grid—three-up cards (the binary frame, core dynamics, capacities) */
  .pne-companion-integration-w1-page .practice-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 28px;
  }
  .pne-companion-integration-w1-page .practice-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 22px;
    text-align: center;
  }
  .pne-companion-integration-w1-page .practice-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w1-page .practice-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-style: italic;
    font-size: 22px;
    color: var(--accent-sage);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w1-page .practice-card p {
    color: var(--ink-body);
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }

  /* Phrase panels—the three paradigm shifts */
  .pne-companion-integration-w1-page .phrase-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-integration-w1-page .phrase-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 34px 36px;
    border-left: 3px solid var(--accent-gold);
  }
  .pne-companion-integration-w1-page .phrase-card .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w1-page .phrase-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .pne-companion-integration-w1-page .phrase-card h4 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-integration-w1-page .phrase-card > p.intro {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 18px;
  }
  .pne-companion-integration-w1-page .phrase-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-integration-w1-page .phrase-list li {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--ink-dark);
    line-height: 1.5;
    padding: 10px 0 10px 18px;
    border-left: 2px solid var(--line);
  }
  /* Paradigm shifts—the frame being set down vs the one picked up */
  .pne-companion-integration-w1-page .phrase-list li.shift-from { color: var(--ink-mute); }
  .pne-companion-integration-w1-page .phrase-list li.shift-to {
    color: var(--ink-dark);
    border-left-color: var(--accent-gold);
  }
  .pne-companion-integration-w1-page .shift-tag {
    display: block;
    font-family: var(--body);
    font-style: normal;
    font-size: 10px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .pne-companion-integration-w1-page li.shift-from .shift-tag { color: var(--ink-mute); }
  .pne-companion-integration-w1-page li.shift-to .shift-tag { color: var(--accent-warm); }

  .pne-companion-integration-w1-page .phrase-card p.phrase-note {
    color: var(--ink-mute);
    font-size: 14px;
    line-height: 1.55;
    margin: 18px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }

  /* Large contemplative callout */
  .pne-companion-integration-w1-page .script-callout {
    margin-top: 28px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
    text-align: center;
  }
  .pne-companion-integration-w1-page .script-callout .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w1-page .script-callout p {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 28px);
    color: var(--ink-dark);
    line-height: 1.4;
    max-width: 720px;
    margin: 0 auto;
  }

  /* Two-column panel—cost / repair */
  .pne-companion-integration-w1-page .body-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-integration-w1-page .body-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-integration-w1-page .body-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-integration-w1-page .body-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-integration-w1-page .body-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-integration-w1-page .body-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-integration-w1-page .body-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w1-page .arrow-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-integration-w1-page .arrow-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-integration-w1-page .arrow-list li:first-child { border-top: none; }
  .pne-companion-integration-w1-page .arrow-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  /* Listening errors—numbered cards, two columns */
  .pne-companion-integration-w1-page .error-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 32px;
  }
  .pne-companion-integration-w1-page .error-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 26px;
    border-top: 3px solid rgba(201, 152, 94, 0.4);
  }
  .pne-companion-integration-w1-page .error-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w1-page .error-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w1-page .error-card p {
    color: var(--ink-body);
    font-size: 14.5px;
    line-height: 1.6;
    margin: 0;
  }
  .pne-companion-integration-w1-page .error-card p.sounds-like {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--ink-mute);
    line-height: 1.5;
  }
  .pne-companion-integration-w1-page .error-card p.body-hears {
    margin-top: 10px;
    font-size: 13.5px;
    color: var(--accent-sage);
    line-height: 1.55;
  }

  .pne-companion-integration-w1-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-integration-w1-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-integration-w1-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  /* Homework panel */
  .pne-companion-integration-w1-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-integration-w1-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-integration-w1-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-integration-w1-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-integration-w1-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-integration-w1-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-integration-w1-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-integration-w1-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w1-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w1-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-integration-w1-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-integration-w1-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-integration-w1-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-integration-w1-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-integration-w1-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-integration-w1-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-integration-w1-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-integration-w1-page .vk-section { padding: 48px 0; }
    .pne-companion-integration-w1-page .vk-wrap, .pne-companion-integration-w1-page .vk-narrow { padding: 0 24px; }
    .pne-companion-integration-w1-page header.hero { padding: 64px 0 72px; }
    .pne-companion-integration-w1-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-integration-w1-page .def-card { padding: 24px 22px; }
    .pne-companion-integration-w1-page .practice-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .pne-companion-integration-w1-page .practice-card { padding: 22px 18px; }
    .pne-companion-integration-w1-page .phrase-card { padding: 26px 22px; }
    .pne-companion-integration-w1-page .script-callout { padding: 28px 22px; }
    .pne-companion-integration-w1-page .body-panel { padding: 28px 22px; }
    .pne-companion-integration-w1-page .body-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-integration-w1-page .error-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-companion-integration-w1-page .error-card { padding: 22px 20px; }
    .pne-companion-integration-w1-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function PneIntegrationGuideWeek1Page() {
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

      <div className="pne-companion-integration-w1-page">
        <span id="top" />
        <PneGuidePrintButton />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week One <em>PNE (PsychoNeuroEnergetics) Integration Guide</em></h1>
            <p className="hero-subtitle">The Right&ndash;Wrong Paradigm</p>
            <p className="hero-lede">The binary lens people fall into during conflict, what it protects, what it costs a family across generations, and the inquiry that opens in its place.</p>
            <p className="hero-attrib">Judith Johnson &middot; Founder of PsychoNeuroEnergetics &middot; Developer of the PNE Practitioner Training Programs</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">A <em>Binary Lens</em></h2>
            <p className="vk-lede">The right&ndash;wrong paradigm is a lens people often fall into when navigating conflict, relationships, or decision-making. It frames every interaction in one of three ways.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Right or Wrong</h4>
                <p>One person is right. The other is wrong. The frame allows for a single verdict.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Win or Lose</h4>
                <p>One side wins, the other loses. The exchange becomes a contest with a scoreboard.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Absolute Truth</h4>
                <p>Truth, responsibility, and morality are treated as fixed, and must be proven or defended.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What Drives It</div>
            <h2 className="vk-title">Core <em>Dynamics</em></h2>
            <p className="vk-lede">Three forces hold the paradigm in place. Each one feels like clarity from the inside.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Polarity Thinking</h4>
                <p>Reduces the complexity of human experience to black-and-white categories. Nuance, multiple truths, and shared responsibility fall away.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Ego Protection</h4>
                <p>Arguing from right&ndash;wrong usually defends a sense of self or worth. Being wrong can feel like shame, failure, or rejection.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Power and Control</h4>
                <p>Creates hierarchy: the right person gains authority while the wrong person is diminished. Domination stands where collaboration could.</p>
              </div>
            </div>

            <div className="gentle-pull">Being &ldquo;right&rdquo; offers validation, control, and moral superiority. That is what makes it so difficult to set down.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What It Costs</div>
            <h2 className="vk-title">The <em>Consequences</em></h2>
            <p className="vk-lede">The paradigm promises resolution and delivers the opposite. Three patterns follow it everywhere.</p>

            <div className="error-grid">
              <div className="error-card">
                <div className="num">One</div>
                <h4>Stalemates &amp; Defensiveness</h4>
                <p>Arguments stay unresolved because both sides dig in. Each round of proving deepens the position rather than the understanding.</p>
              </div>
              <div className="error-card">
                <div className="num">Two</div>
                <h4>Blame Cycles</h4>
                <p>Focus shifts from understanding to fault-finding. The question becomes who caused this rather than what is happening here.</p>
              </div>
              <div className="error-card">
                <div className="num">Three</div>
                <h4>Disconnection</h4>
                <p>Relationships weaken as curiosity and empathy give way to judgment. Distance grows in the space where contact used to be.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Healthy Alternative</div>
            <h2 className="vk-title">The <em>Inquiry Paradigm</em></h2>
            <p className="vk-lede">Growth comes from shifting into a learning stance. Four movements carry the shift.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Movement One</div>
                <h3>Curiosity</h3>
                <p>What is behind each perspective? The question replaces the verdict, and the conversation opens.</p>
              </div>
              <div className="def-card">
                <div className="label">Movement Two</div>
                <h3>Shared Responsibility</h3>
                <p>Both parties contribute to the dynamic. Ownership becomes something held together rather than assigned.</p>
              </div>
              <div className="def-card">
                <div className="label">Movement Three</div>
                <h3>Multiple Truths</h3>
                <p>More than one perspective can hold validity. Two people can each be describing something real.</p>
              </div>
              <div className="def-card">
                <div className="label">Movement Four</div>
                <h3>Needs-Based Communication</h3>
                <p>Moving from who is right to what is needed. Needs are workable in a way that verdicts never are.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In Practice</div>
            <h2 className="vk-title">The Same Moment, <em>Two Ways</em></h2>
            <p className="vk-lede">The shift is audible. Listen for where each sentence places the other person.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Right&ndash;Wrong Response</div>
                <h3>The Verdict</h3>
                <p>&ldquo;You never listen! You&rsquo;re wrong for ignoring me.&rdquo;</p>
              </div>
              <div className="def-card">
                <div className="label">Transformational Response</div>
                <h3>The Need</h3>
                <p>&ldquo;When I don&rsquo;t feel heard, I get frustrated. Can we pause so I can express what I need?&rdquo;</p>
              </div>
            </div>

            <div className="gentle-pull">This shift opens a pathway for connection, accountability, and healing, where blame would have kept the cycle turning.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In Families</div>
            <h2 className="vk-title">Inherited <em>Roles</em></h2>
            <p className="vk-lede">In many families someone is cast as the right one, and someone else as the wrong one. These roles serve the system rather than the truth.</p>

            <div className="body-panel">
              <div className="label">The Casting</div>
              <h3>Who the Family <em>Assigns</em></h3>
              <p className="intro">The roles arrive early and hold for decades. They protect the family system from facing deeper pain.</p>

              <div className="body-cols">
                <div className="body-col">
                  <h4>Cast as right</h4>
                  <ul className="arrow-list">
                    <li>The responsible child</li>
                    <li>The moral parent</li>
                    <li>The hero</li>
                  </ul>
                </div>
                <div className="body-col">
                  <h4>Cast as wrong</h4>
                  <ul className="arrow-list">
                    <li>The scapegoat</li>
                    <li>The black sheep</li>
                    <li>The one who names what others avoid</li>
                  </ul>
                </div>
              </div>
            </div>

            <h3 className="sub-heading">Avoidance and <em>Escalation</em></h3>
            <p className="sub-sub">Families tend toward one of two responses, and both keep the paradigm intact.</p>
            <p className="vk-body" style={{ marginTop: 16 }}>Some avoid difficult conversations entirely, because being wrong feels dangerous: it could mean rejection, punishment, or the loss of belonging. Others escalate into endless battles where listening has stopped and only proving remains.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Deeper Injury</div>
            <h2 className="vk-title">Trauma Bonds and <em>Inherited Patterns</em></h2>
            <p className="vk-lede">For a child in a home with abuse, neglect, or addiction, siding with the parent&rsquo;s rightness can be a survival strategy.</p>

            <div className="gentle-pull-light">
              <div className="label">What the Child Concludes</div>
              <p>&ldquo;If Mom says it didn&rsquo;t happen, I must be wrong. My feelings can&rsquo;t be trusted.&rdquo;</p>
            </div>

            <p className="vk-body" style={{ marginTop: 28 }}>This internalized right&ndash;wrong split leads to self-doubt, shame, and difficulty trusting one&rsquo;s own experience later in life. The verdict reached at six years old goes on being enforced from the inside.</p>

            <h3 className="sub-heading">Across the <em>Generations</em></h3>
            <p className="sub-sub">A parent raised in a punitive right&ndash;wrong household may recreate it without ever choosing to.</p>
            <p className="vk-body" style={{ marginTop: 16 }}>Healing requires breaking this cycle by allowing multiple truths and holding complexity. What one generation can hold, the next inherits as room to breathe.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In Recovery</div>
            <h2 className="vk-title">Effects on <em>Trauma Healing</em></h2>
            <p className="vk-lede">Survivors of trauma often internalize a single sentence: <em>&ldquo;Something must be wrong with me.&rdquo;</em> In recovery, the paradigm frequently flips between two poles without leaving the frame.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">One Pole</div>
                <h3>Self-Blame</h3>
                <p>&ldquo;I&rsquo;m wrong. I&rsquo;m broken.&rdquo; The verdict turns inward and becomes identity.</p>
              </div>
              <div className="def-card">
                <div className="label">The Other Pole</div>
                <h3>Other-Blame</h3>
                <p>&ldquo;They&rsquo;re wrong. They&rsquo;re at fault.&rdquo; The verdict turns outward, and the frame stays exactly the same.</p>
              </div>
            </div>

            <p className="vk-body" style={{ marginTop: 32 }}>Healing begins when the paradigm itself softens. Three capacities take its place.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Compassion</h4>
                <p>What happened was harmful, and it does not define me.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Integration</h4>
                <p>I can hold both my truth and someone else&rsquo;s, even when they clash.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Agency</h4>
                <p>Moving beyond blame into choice and action.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Shift</div>
            <h2 className="vk-title">Shifting the Paradigm in <em>Family Healing</em></h2>
            <p className="vk-lede">Three exchanges, each one a door out of the frame. Keep them close enough to reach for mid-conversation.</p>

            <div className="phrase-stack">
              <div className="phrase-card">
                <div className="label">Shift One</div>
                <h4>From Blame to <em>Shared Understanding</em></h4>
                <ul className="phrase-list">
                  <li className="shift-from"><span className="shift-tag">From</span>&ldquo;Who&rsquo;s at fault?&rdquo;</li>
                  <li className="shift-to"><span className="shift-tag">To</span>&ldquo;What shaped us this way, and how do we grow?&rdquo;</li>
                </ul>
              </div>
              <div className="phrase-card">
                <div className="label">Shift Two</div>
                <h4>From Judgment to <em>Needs</em></h4>
                <ul className="phrase-list">
                  <li className="shift-from"><span className="shift-tag">From</span>&ldquo;You&rsquo;re wrong for yelling.&rdquo;</li>
                  <li className="shift-to"><span className="shift-tag">To</span>&ldquo;I need calm and safety when we talk.&rdquo;</li>
                </ul>
              </div>
              <div className="phrase-card">
                <div className="label">Shift Three</div>
                <h4>From Proving to <em>Listening</em></h4>
                <ul className="phrase-list">
                  <li className="shift-from"><span className="shift-tag">From</span>&ldquo;Here&rsquo;s why I&rsquo;m right.&rdquo;</li>
                  <li className="shift-to"><span className="shift-tag">To</span>&ldquo;Tell me how you see it, and I&rsquo;ll share how I see it.&rdquo;</li>
                </ul>
              </div>
            </div>

            <div className="script-callout">
              <div className="label">The Question to Carry</div>
              <p>&ldquo;What is needed here?&rdquo;</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week One &middot; Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three invitations to notice the paradigm while it is running, and to step out of it once a day.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Catch the frame as it forms.</h3>
                <div className="hw-tags">Polarity &nbsp;&middot;&nbsp; Ego Protection &nbsp;&middot;&nbsp; Power and Control</div>
                <p className="reflection">Once each day, notice the moment you begin building a case. Name it quietly: <em>I am about to be right.</em> Simply catching it is the whole exercise this week.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Trade one verdict for one need.</h3>
                <p className="reflection">Take a sentence you would normally say as a judgment and rebuild it as a need. &ldquo;You&rsquo;re wrong for yelling&rdquo; becomes &ldquo;I need calm and safety when we talk.&rdquo; Notice what happens in your body when you say the second one.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Look at the role you were cast in.</h3>
                <p className="reflection">Consider your family of origin. Were you the responsible one, the hero, the scapegoat, the one who named what others avoided? Ask what that role protected the family from facing, and what it cost you to carry it.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">Beyond Right and Wrong</div>
            <h2>Moving beyond right&ndash;wrong creates a sacred space. <em>Healing replaces defending.</em></h2>
            <p>In families, this is where everyone can reclaim dignity, voice, and belonging. More than one perspective can hold validity, and holding that complexity is what breaks the cycle for the generation that comes next.</p>
          </div>
        </section>

        <PneGuideFooter />
      </div>
    </>
  );
}
