import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PneGuidePrintButton, PneGuideFooter } from "@/components/portal/PneGuidePrint";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Integration Guide · Week 3, Vital Kauaʻi" };

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

  .pne-companion-integration-w3-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-integration-w3-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-integration-w3-page .vk-section { padding: 64px 0; }
  .pne-companion-integration-w3-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-integration-w3-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-integration-w3-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-integration-w3-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-integration-w3-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-integration-w3-page p.vk-lede, .pne-companion-integration-w3-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-integration-w3-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-integration-w3-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-integration-w3-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-integration-w3-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-integration-w3-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }
  .pne-companion-integration-w3-page .hero p.hero-attrib {
    margin-top: 28px;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.85);
    line-height: 1.6;
    max-width: 620px;
  }

  .pne-companion-integration-w3-page .gentle-pull {
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
  .pne-companion-integration-w3-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-integration-w3-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-integration-w3-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-integration-w3-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-integration-w3-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-integration-w3-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w3-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-integration-w3-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  /* Practice grid—the six core elements of mindful listening */
  .pne-companion-integration-w3-page .practice-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 28px;
  }
  .pne-companion-integration-w3-page .practice-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 22px;
    text-align: center;
  }
  .pne-companion-integration-w3-page .practice-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w3-page .practice-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-style: italic;
    font-size: 22px;
    color: var(--accent-sage);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w3-page .practice-card p {
    color: var(--ink-body);
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }

  /* Phrase panels—reflective listening and naming feelings */
  .pne-companion-integration-w3-page .phrase-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-integration-w3-page .phrase-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 34px 36px;
    border-left: 3px solid var(--accent-gold);
  }
  .pne-companion-integration-w3-page .phrase-card .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w3-page .phrase-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .pne-companion-integration-w3-page .phrase-card h4 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-integration-w3-page .phrase-card > p.intro {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 18px;
  }
  .pne-companion-integration-w3-page .phrase-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-integration-w3-page .phrase-list li {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--ink-dark);
    line-height: 1.5;
    padding: 10px 0 10px 18px;
    border-left: 2px solid var(--line);
  }
  .pne-companion-integration-w3-page .phrase-card p.phrase-note {
    color: var(--ink-mute);
    font-size: 14px;
    line-height: 1.55;
    margin: 18px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }

  /* Large contemplative callout */
  .pne-companion-integration-w3-page .script-callout {
    margin-top: 28px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
    text-align: center;
  }
  .pne-companion-integration-w3-page .script-callout .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w3-page .script-callout p {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 28px);
    color: var(--ink-dark);
    line-height: 1.4;
    max-width: 720px;
    margin: 0 auto;
  }

  /* Two-column panel—cost / repair */
  .pne-companion-integration-w3-page .body-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-integration-w3-page .body-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-integration-w3-page .body-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-integration-w3-page .body-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-integration-w3-page .body-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-integration-w3-page .body-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-integration-w3-page .body-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-integration-w3-page .arrow-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-integration-w3-page .arrow-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-integration-w3-page .arrow-list li:first-child { border-top: none; }
  .pne-companion-integration-w3-page .arrow-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  /* Listening errors—numbered cards, two columns */
  .pne-companion-integration-w3-page .error-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 32px;
  }
  .pne-companion-integration-w3-page .error-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 26px;
    border-top: 3px solid rgba(201, 152, 94, 0.4);
  }
  .pne-companion-integration-w3-page .error-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w3-page .error-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w3-page .error-card p {
    color: var(--ink-body);
    font-size: 14.5px;
    line-height: 1.6;
    margin: 0;
  }
  .pne-companion-integration-w3-page .error-card p.sounds-like {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--ink-mute);
    line-height: 1.5;
  }
  .pne-companion-integration-w3-page .error-card p.body-hears {
    margin-top: 10px;
    font-size: 13.5px;
    color: var(--accent-sage);
    line-height: 1.55;
  }

  .pne-companion-integration-w3-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-integration-w3-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-integration-w3-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  /* Homework panel */
  .pne-companion-integration-w3-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-integration-w3-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-integration-w3-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-integration-w3-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-integration-w3-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-integration-w3-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-integration-w3-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-integration-w3-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-integration-w3-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-integration-w3-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-integration-w3-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-integration-w3-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-integration-w3-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-integration-w3-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-integration-w3-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-integration-w3-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-integration-w3-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-integration-w3-page .vk-section { padding: 48px 0; }
    .pne-companion-integration-w3-page .vk-wrap, .pne-companion-integration-w3-page .vk-narrow { padding: 0 24px; }
    .pne-companion-integration-w3-page header.hero { padding: 64px 0 72px; }
    .pne-companion-integration-w3-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-integration-w3-page .def-card { padding: 24px 22px; }
    .pne-companion-integration-w3-page .practice-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .pne-companion-integration-w3-page .practice-card { padding: 22px 18px; }
    .pne-companion-integration-w3-page .phrase-card { padding: 26px 22px; }
    .pne-companion-integration-w3-page .script-callout { padding: 28px 22px; }
    .pne-companion-integration-w3-page .body-panel { padding: 28px 22px; }
    .pne-companion-integration-w3-page .body-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-integration-w3-page .error-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-companion-integration-w3-page .error-card { padding: 22px 20px; }
    .pne-companion-integration-w3-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function PneIntegrationGuideWeek3Page() {
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

      <div className="pne-companion-integration-w3-page">
        <span id="top" />
        <PneGuidePrintButton />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week Three <em>PNE (PsychoNeuroEnergetics) Integration Guide</em></h1>
            <p className="hero-subtitle">Tending What Was Revealed</p>
            <p className="hero-lede">Beliefs as embodied patterns held in sensation, emotion, and nervous system memory, the survival truths that organize suffering, and how a belief unwinds when the body feels safe enough to know something new.</p>
            <p className="hero-attrib">Judith Johnson · Founder of PsychoNeuroEnergetics · Developer of the PNE Practitioner Training Programs</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">Beliefs Live in the <em>Body</em></h2>
            <p className="vk-lede">In PsychoNeuroEnergetics, beliefs are embodied patterns held in sensation, emotion, and nervous system responses, rather than abstract thoughts alone.</p>
            <p className="vk-body">Working with beliefs lets a person recognize how trauma, dysregulation, and inherited identity structures have shaped a life. It creates the ground where the root serves as more than an interrupter of addiction. It becomes a catalyst for transforming the blueprint of suffering itself.</p>

            <div className="gentle-pull">&ldquo;What beliefs am I carrying that keep me tied to pain, and who might I become without them?&rdquo;</div>

            <p className="vk-body" style={{ marginTop: 28 }}>The beliefs that keep a person tied to suffering are rarely conscious choices. They are deeply learned survival truths that once protected you, helped you belong, or made sense of pain. Over time they become an internal blueprint that organizes suffering again and again, long after survival has stopped asking for it.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Opening Question</div>
            <h2 className="vk-title">A Different Place to <em>Begin</em></h2>
            <p className="vk-lede">The question that opens this work moves past &ldquo;What is wrong with me?&rdquo; and asks something more precise.</p>

            <div className="gentle-pull">&ldquo;What did I come to believe about myself, others, pain, love, and safety that made suffering feel necessary?&rdquo;</div>

            <p className="vk-body" style={{ marginTop: 28 }}>The aim here is compassionate awareness. When a belief becomes visible, it begins to loosen on its own. Healing often starts the moment you recognize that suffering has been familiar, and that familiarity is a different thing from truth.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Blueprint</div>
            <h2 className="vk-title">Common Suffering-Based <em>Beliefs</em></h2>
            <p className="vk-lede">Each of these began as an intelligent adaptation. Read them slowly and notice which ones your body recognizes before your mind agrees.</p>

            <div className="error-grid">
              <div className="error-card">
                <h4>&ldquo;I am not enough.&rdquo;</h4>
                <p>Creates constant striving, self-criticism, perfectionism, and the need to prove worth. Peace can come to feel undeserved.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;I deserve pain.&rdquo;</h4>
                <p>Formed through trauma, shame, neglect, or repeated criticism. This belief links suffering with identity, punishment, or redemption.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;Love requires sacrifice or suffering.&rdquo;</h4>
                <p>Where love was inconsistent, painful, or conditional, the nervous system learns to confuse struggle with connection.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;If I let go of pain, I will lose who I am.&rdquo;</h4>
                <p>Suffering can become so familiar that it feels like identity. Healing then asks for a new self-definition, which the system may meet with fear.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;I must stay hypervigilant to be safe.&rdquo;</h4>
                <p>When the body has learned danger, calm can feel unfamiliar. The system stays attached to anxiety, chaos, or emotional intensity.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;My pain gives me meaning, belonging, or significance.&rdquo;</h4>
                <p>Suffering can become the way a person is seen, understood, or validated, especially where emotional needs went unmet.</p>
              </div>
              <div className="error-card">
                <h4>&ldquo;Change is dangerous.&rdquo;</h4>
                <p>Even a painful pattern can feel safer than the unknown. The body chooses the familiar because it has already survived it.</p>
              </div>
            </div>

            <p className="vk-body" style={{ marginTop: 32 }}>In PNE terms, these beliefs live in the body as much as in thought. They sit in sensation, posture, emotional reflex, and nervous system response. They become embodied stories that shape perception automatically, before a single word is spoken.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">How a Belief Forms</div>
            <h2 className="vk-title">Sensation, Charge, <em>Interpretation</em></h2>
            <p className="vk-lede">A belief is often formed when a sensation, an emotional charge, and an interpretation become linked together, creating a protective pattern that once served survival.</p>
            <p className="vk-body">Over time these patterns come to feel like truth. Unwinding them is less about changing your mind and more about gently dissolving the pattern where it actually lives: in the body, the nervous system, and the meaning-making process.</p>
            <p className="vk-body">True unwinding happens when the original emotional and physiological charge beneath a belief is safely felt, processed, and released. Arguing with a belief or forcing a positive thought leaves the charge in place. Meeting the charge lets the whole structure soften.</p>

            <div className="gentle-pull">This is where suffering can begin to transform from identity into information, from imprisonment into awakening.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Process</div>
            <h2 className="vk-title">Six Movements of <em>Unwinding</em></h2>
            <p className="vk-lede">The body leads, emotion moves, and thought reorganizes. Each movement makes room for the next.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Name It Gently</h4>
                <p>Begin with <em>&ldquo;Something in me believes…&rdquo;</em> This phrasing creates observation in place of shame, and observation is what makes the pattern workable.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Move to Sensation</h4>
                <p>Shift away from the story and toward the body. Where is this belief felt physically? Tightness, heaviness, numbness, or pressure. Sensation opens the deeper roots.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Let the Charge Surface</h4>
                <p>As sensation is witnessed, the emotional charge connected to it begins to rise. Fear, grief, anger, or shame arriving here is the pattern becoming reachable.</p>
              </div>
              <div className="practice-card">
                <div className="num">Four</div>
                <h4>Allow the Reorganizing</h4>
                <p>When emotion is allowed at a pace the body can hold, the nervous system takes its opportunity to reorganize and discharge what it has been carrying.</p>
              </div>
              <div className="practice-card">
                <div className="num">Five</div>
                <h4>Let the Thought Loosen</h4>
                <p>As stored tension releases, the belief softens on its own. The thought stops feeling absolute, urgent, or defining. It becomes one idea among others.</p>
              </div>
              <div className="practice-card">
                <div className="num">Six</div>
                <h4>Let the New Truth Arrive</h4>
                <p>Rather than forcing a replacement belief, a new truth emerges organically from a more regulated state. It arrives already believed, because the body found it.</p>
              </div>
            </div>

            <div className="gentle-pull-light" style={{ marginTop: 32 }}>
              <div className="label">A PNE Reframe</div>
              <p>In this process, the body leads, emotion moves, and thought reorganizes. This reflects integration of the reptilian brain&apos;s survival patterns, the limbic brain&apos;s emotional charge, and the neocortex&apos;s interpretations.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Ground It Rests On</div>
            <h2 className="vk-title">Safety Is What Lets a Belief <em>Release</em></h2>
            <p className="vk-lede">Beliefs unwind most effectively when the body senses enough internal or relational safety to set down old survival strategies.</p>
            <p className="vk-body">Every belief here began as an intelligent adaptation to an earlier experience. Unwinding honors the protective role a belief once played while allowing the system to recognize that its work is complete.</p>

            <div className="gentle-pull">Healing occurs when the body no longer needs the old belief to survive.</div>

            <p className="vk-body" style={{ marginTop: 28 }}>Beliefs shift through safety, awareness, and embodied presence that let the underlying pattern finish itself. Through this, a person moves from inherited and trauma-shaped beliefs into more conscious, flexible, and life-giving ways of living.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters Now</div>
            <h2 className="vk-title">Meeting What Ceremony <em>Revealed</em></h2>
            <p className="vk-lede">Belief awareness creates psychological and nervous system safety. The root brings profound insight, memory retrieval, and direct confrontation with self.</p>
            <p className="vk-body">A person who has begun exploring their beliefs can witness what surfaces with far more steadiness. This is the shift from fear to curiosity, from shame to understanding, and from self-punishment to self-reclamation.</p>
            <p className="vk-body">This week you tend what ceremony revealed. The material is already moving. Your work is to meet it in the body, at the pace the body sets.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Three · Living Practice</div>
              <h2>A Deeper <em>Inquiry</em></h2>
              <p className="lede">Sit with one question a day. Write from the body rather than the analysis. Notice where each question lands before you reach for an answer.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>What pain feels familiar to me?</h3>
                <p className="reflection">Familiar pain has a shape and a location. Find it in the body first. Notice whether it arrives as tightness, heaviness, numbness, or pressure, and let it be seen exactly as it is.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>What identity do I protect through suffering?</h3>
                <p className="reflection">Suffering often holds a self-definition in place. Name who you get to be while the suffering continues, and write it plainly, with the same grace you would offer someone you love.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>What would I fear losing if I no longer organized my life around pain?</h3>
                <p className="reflection">Let the honest answer come. Belonging, meaning, attention, a role in the family, a reason. Whatever surfaces here is information about what the belief has been protecting.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Four</div>
                <h3>What would safety, joy, or peace require me to believe instead?</h3>
                <p className="reflection">Write the new belief in your own words. Then notice what moves in your body when you say it aloud. That response tells you how much ground the new truth has so far, and where the work continues.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What Replaces It</div>
            <h2 className="vk-title">The Shift That <em>Emerges</em></h2>
            <p className="vk-lede">Often the shift begins when an old belief such as <em>&ldquo;I have to suffer to survive&rdquo;</em> is gradually replaced with something the body can now hold.</p>

            <div className="phrase-stack">
              <div className="phrase-card">
                <div className="phrase-list">
                  <div>&ldquo;I can be safe without suffering.&rdquo;</div>
                  <div>&ldquo;I am worthy without proving.&rdquo;</div>
                  <div>&ldquo;Peace is safe to feel.&rdquo;</div>
                  <div>&ldquo;I can exist beyond pain.&rdquo;</div>
                </div>
              </div>
            </div>

            <p className="vk-body" style={{ marginTop: 32 }}>Read these slowly. Say the one that meets the most resistance, and stay with what the body does in response. That resistance marks the exact place the old pattern still lives, and the place this week&apos;s work belongs.</p>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">Week Three · Mālama</div>
            <h2>Suffering may be familiar. <em>Truth is something else entirely.</em></h2>
            <p>When a belief becomes visible, it begins to loosen. No belief here is inherently wrong. Each one began as an intelligent adaptation, and each one can complete itself when the body feels safe enough to know something new. Let the body lead, let the emotion move, and let the thought reorganize in its own time.</p>
          </div>
        </section>

        <PneGuideFooter />
      </div>
    </>
  );
}
