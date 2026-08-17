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

  .pne-integration-w1-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-integration-w1-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-integration-w1-page .vk-section { padding: 64px 0; }
  .pne-integration-w1-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-integration-w1-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-integration-w1-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-integration-w1-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-integration-w1-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-integration-w1-page p.vk-lede, .pne-integration-w1-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-integration-w1-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-integration-w1-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-integration-w1-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-integration-w1-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-integration-w1-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }
  .pne-integration-w1-page .hero p.hero-attrib {
    margin-top: 28px;
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.85);
    line-height: 1.6;
    max-width: 620px;
  }

  .pne-integration-w1-page .gentle-pull {
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
  .pne-integration-w1-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-integration-w1-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-integration-w1-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-integration-w1-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-integration-w1-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-integration-w1-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-integration-w1-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-integration-w1-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  /* Practice grid — the six core elements of mindful listening */
  .pne-integration-w1-page .practice-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 28px;
  }
  .pne-integration-w1-page .practice-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 22px;
    text-align: center;
  }
  .pne-integration-w1-page .practice-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-integration-w1-page .practice-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-style: italic;
    font-size: 22px;
    color: var(--accent-sage);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-integration-w1-page .practice-card p {
    color: var(--ink-body);
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }

  /* Phrase panels — reflective listening and naming feelings */
  .pne-integration-w1-page .phrase-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 32px;
  }
  .pne-integration-w1-page .phrase-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 34px 36px;
    border-left: 3px solid var(--accent-gold);
  }
  .pne-integration-w1-page .phrase-card .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 14px;
  }
  .pne-integration-w1-page .phrase-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .pne-integration-w1-page .phrase-card h4 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-integration-w1-page .phrase-card > p.intro {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 18px;
  }
  .pne-integration-w1-page .phrase-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-integration-w1-page .phrase-list li {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--ink-dark);
    line-height: 1.5;
    padding: 10px 0 10px 18px;
    border-left: 2px solid var(--line);
  }
  .pne-integration-w1-page .phrase-card p.phrase-note {
    color: var(--ink-mute);
    font-size: 14px;
    line-height: 1.55;
    margin: 18px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }

  /* Large contemplative callout */
  .pne-integration-w1-page .script-callout {
    margin-top: 28px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
    text-align: center;
  }
  .pne-integration-w1-page .script-callout .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-integration-w1-page .script-callout p {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 28px);
    color: var(--ink-dark);
    line-height: 1.4;
    max-width: 720px;
    margin: 0 auto;
  }

  /* Two-column panel — cost / repair */
  .pne-integration-w1-page .body-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-integration-w1-page .body-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-integration-w1-page .body-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-integration-w1-page .body-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-integration-w1-page .body-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-integration-w1-page .body-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-integration-w1-page .body-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-integration-w1-page .arrow-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-integration-w1-page .arrow-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-integration-w1-page .arrow-list li:first-child { border-top: none; }
  .pne-integration-w1-page .arrow-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  /* Listening errors — numbered cards, two columns */
  .pne-integration-w1-page .error-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 32px;
  }
  .pne-integration-w1-page .error-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 26px;
    border-top: 3px solid rgba(201, 152, 94, 0.4);
  }
  .pne-integration-w1-page .error-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-integration-w1-page .error-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-integration-w1-page .error-card p {
    color: var(--ink-body);
    font-size: 14.5px;
    line-height: 1.6;
    margin: 0;
  }
  .pne-integration-w1-page .error-card p.sounds-like {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line-soft);
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--ink-mute);
    line-height: 1.5;
  }
  .pne-integration-w1-page .error-card p.body-hears {
    margin-top: 10px;
    font-size: 13.5px;
    color: var(--accent-sage);
    line-height: 1.55;
  }

  .pne-integration-w1-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-integration-w1-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-integration-w1-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  /* Homework panel */
  .pne-integration-w1-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-integration-w1-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-integration-w1-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-integration-w1-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-integration-w1-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-integration-w1-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-integration-w1-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-integration-w1-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-integration-w1-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-integration-w1-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-integration-w1-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-integration-w1-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-integration-w1-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-integration-w1-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-integration-w1-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-integration-w1-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-integration-w1-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-integration-w1-page .vk-section { padding: 48px 0; }
    .pne-integration-w1-page .vk-wrap, .pne-integration-w1-page .vk-narrow { padding: 0 24px; }
    .pne-integration-w1-page header.hero { padding: 64px 0 72px; }
    .pne-integration-w1-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-integration-w1-page .def-card { padding: 24px 22px; }
    .pne-integration-w1-page .practice-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .pne-integration-w1-page .practice-card { padding: 22px 18px; }
    .pne-integration-w1-page .phrase-card { padding: 26px 22px; }
    .pne-integration-w1-page .script-callout { padding: 28px 22px; }
    .pne-integration-w1-page .body-panel { padding: 28px 22px; }
    .pne-integration-w1-page .body-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-integration-w1-page .error-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-integration-w1-page .error-card { padding: 22px 20px; }
    .pne-integration-w1-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function PneIntegrationCompanionWeek1Page() {
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

      <div className="pne-integration-w1-page">
        <span id="top" />
        <PneGuidePrintButton />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week One <em>PNE (PsychoNeuroEnergetics) Integration Guide</em></h1>
            <p className="hero-subtitle">Mindful Listening</p>
            <p className="hero-lede">How another person&apos;s inner experience is received, what the body learns in the moments it is overridden, and the listening practices that return a person to their own authority.</p>
            <p className="hero-attrib">Judith Johnson · Founder of PsychoNeuroEnergetics · Developer of the PNE Practitioner Training Programs</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">When Experience Is <em>Received</em></h2>
            <p className="vk-lede">One of the earliest and most subtle forms of soul betrayal occurs when a person&apos;s inner experience goes unreceived. Argued with. Corrected. Improved. Anything other than simply received.</p>
            <p className="vk-body">When a child, partner, or family member speaks from their lived experience and is met instead with advice, dismissal, interpretation, or decisions made without them, the body learns something quietly but powerfully:</p>

            <div className="gentle-pull">&ldquo;My inner truth is not welcome here.&rdquo;</div>

            <p className="vk-body" style={{ marginTop: 28 }}>This lives deeper than communication. It is a relational rupture, one that settles into the nervous system and shapes belief systems about worth, safety, and belonging.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Betrayal of the Soul</div>
            <h2 className="vk-title">When Experience Is <em>Replaced</em></h2>
            <p className="vk-lede">In <em>Betrayal of the Soul</em>, betrayal extends well beyond dramatic events. It includes every moment a person abandons their own knowing in order to hold onto attachment, approval, or safety.</p>
            <p className="vk-body">Advice given too soon, especially in moments of vulnerability, replaces the speaker&apos;s felt truth with someone else&apos;s interpretation. Even well-intended responses can communicate:</p>

            <div className="body-panel">
              <div className="label">What the Body Hears</div>
              <h3>Four Quiet <em>Messages</em></h3>
              <p className="intro">Each of these arrives beneath the words, and each one teaches the same lesson in a different form.</p>

              <div className="body-cols">
                <div className="body-col">
                  <h4>About the experience</h4>
                  <ul className="arrow-list">
                    <li>&ldquo;Your experience is not sufficient.&rdquo;</li>
                    <li>&ldquo;Your feelings are excessive.&rdquo;</li>
                  </ul>
                </div>
                <div className="body-col">
                  <h4>About the authority</h4>
                  <ul className="arrow-list">
                    <li>&ldquo;You cannot trust your own process.&rdquo;</li>
                    <li>&ldquo;Someone else knows better than you.&rdquo;</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="vk-body" style={{ marginTop: 32 }}>Over time, the body adapts by silencing sensation, muting emotion, and deferring to external authority. This is the betrayal of self, learned in relationship.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Body&apos;s Response</div>
            <h2 className="vk-title">The Nervous System Cost of Being <em>Fixed</em></h2>
            <p className="vk-lede">From a body perspective, being advised without being understood activates threat. The autonomic nervous system reads premature fixing as loss of agency, absence of attunement, and emotional abandonment.</p>
            <p className="vk-body">The body tightens. Breath shortens. Sensation retreats. The soul pulls back.</p>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>What is needed in these moments is contact rather than correction.</p>
            </div>

            <h3 className="sub-heading">Mindful Listening as <em>Repair</em></h3>
            <p className="sub-sub">Mindful listening is a reparative act. It restores what was lost when inner experience was overridden.</p>
            <p className="vk-body" style={{ marginTop: 16 }}>To listen mindfully is to say: <em>&ldquo;Your experience is real. You are the authority on your inner world.&rdquo;</em> This is how trust in self begins to return.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Core Elements</div>
            <h2 className="vk-title">Six Movements of <em>Mindful Listening</em></h2>
            <p className="vk-lede">Each one meets a specific injury left by betrayal. Together they make a room the soul can enter without defending itself.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Presence</h4>
                <p>Full attention, free of distraction, tells the speaker&apos;s nervous system: I am not alone. Soft eye contact, relaxed posture, attuned pacing.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Non-Judgment</h4>
                <p>Allowing the experience to exist exactly as it is, free of evaluation. Safety returns when there is nothing to edit or defend.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Empathy</h4>
                <p>Resonance rather than agreement. The willingness to feel into what it was like for the other person. Then the soul can stop hiding.</p>
              </div>
              <div className="practice-card">
                <div className="num">Four</div>
                <h4>Patience</h4>
                <p>Betrayal lives in the body and unfolds at the body&apos;s pace. Patience allows the body to complete what was once interrupted.</p>
              </div>
              <div className="practice-card">
                <div className="num">Five</div>
                <h4>Validation</h4>
                <p>Recognition that the person&apos;s inner experience makes sense given their history and nervous system. This repairs the internal split.</p>
              </div>
              <div className="practice-card">
                <div className="num">Six</div>
                <h4>Permission</h4>
                <p>Asking before offering restores autonomy. &ldquo;Would you like me to just listen, or would ideas help?&rdquo;</p>
              </div>
            </div>

            <div className="gentle-pull">Presence is the antidote to abandonment. Sometimes it helps to name it out loud: &ldquo;I&apos;m here with you. I&apos;m listening.&rdquo;</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Practices</div>
            <h2 className="vk-title">Returning Authority to the <em>Speaker</em></h2>
            <p className="vk-lede">Three practices carry most of the repair. Each one hands authority back to the speaker rather than claiming it for the listener.</p>

            <div className="phrase-stack">
              <div className="phrase-card">
                <div className="label">Practice One</div>
                <h4>Reflective <em>Listening</em></h4>
                <p className="intro">Say back what you heard, then let the speaker be the one who decides whether you got it right.</p>
                <ul className="phrase-list">
                  <li>&ldquo;What I hear you saying is…&rdquo;</li>
                  <li>&ldquo;It sounds like the most painful part was…&rdquo;</li>
                  <li>&ldquo;You felt ___ when ___ happened.&rdquo;</li>
                  <li>&ldquo;Did I get that right?&rdquo;</li>
                </ul>
                <p className="phrase-note">That last question matters most. It says: <em>You decide what is true.</em></p>
              </div>

              <div className="phrase-card">
                <div className="label">Practice Two</div>
                <h4>Naming <em>Feelings</em></h4>
                <p className="intro">When feelings are named, sensation organizes. The body feels recognized.</p>
                <ul className="phrase-list">
                  <li>&ldquo;That sounds painful.&rdquo;</li>
                  <li>&ldquo;I hear how frustrated you are.&rdquo;</li>
                  <li>&ldquo;That must have felt lonely.&rdquo;</li>
                  <li>&ldquo;Does it feel more like grief… or more like anger?&rdquo;</li>
                </ul>
                <p className="phrase-note">Being wrong is safe here. It is dismissal that does the harm.</p>
              </div>

              <div className="phrase-card">
                <div className="label">Practice Three</div>
                <h4>Validation and <em>Permission</em></h4>
                <p className="intro">Validation recognizes that the response makes sense. Permission restores the choice that betrayal took away.</p>
                <ul className="phrase-list">
                  <li>&ldquo;That makes sense.&rdquo;</li>
                  <li>&ldquo;I can understand why you&apos;d feel that way.&rdquo;</li>
                  <li>&ldquo;Given what you lived through, of course your body responded like that.&rdquo;</li>
                  <li>&ldquo;Would it be okay if I shared a thought?&rdquo;</li>
                </ul>
                <p className="phrase-note">If the answer is no, listening continues. That alone can be profoundly healing.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What Interrupts Contact</div>
            <h2 className="vk-title">Ten Listening <em>Errors</em></h2>
            <p className="vk-lede">Listening errors are rarely intentional. Most arise from anxiety, habit, or a desire to help. Yet from the body&apos;s perspective, these moments register as ruptures of safety. The speaker feels unwelcome in their own experience.</p>
            <p className="vk-body">Over time they accumulate into beliefs: <em>My feelings are wrong. I should stay quiet. I can&apos;t trust my own knowing. Others decide what matters.</em> These are the building blocks of the betrayal of the soul.</p>

            <div className="error-grid">
              <div className="error-card">
                <div className="num">One</div>
                <h4>Interrupting</h4>
                <p>Cuts off the natural completion of sensation, emotion, and meaning.</p>
                <p className="body-hears">The body hears: your timing is inconvenient, and what I have to say matters more. It responds by tightening, withdrawing, or going blank.</p>
              </div>
              <div className="error-card">
                <div className="num">Two</div>
                <h4>Advising Too Quickly</h4>
                <p>Premature advice replaces the speaker&apos;s inner authority with external control.</p>
                <p className="sounds-like">&ldquo;You should just…&rdquo; &nbsp;·&nbsp; &ldquo;Have you tried…&rdquo; &nbsp;·&nbsp; &ldquo;What you need to do is…&rdquo;</p>
                <p className="body-hears">Even when loving: your experience is a problem to be solved rather than a truth to be honored.</p>
              </div>
              <div className="error-card">
                <div className="num">Three</div>
                <h4>Minimizing</h4>
                <p>Minimization invalidates lived experience and leads to self-silencing and emotional numbing.</p>
                <p className="sounds-like">&ldquo;It&apos;s not that bad.&rdquo; &nbsp;·&nbsp; &ldquo;You&apos;re overreacting.&rdquo; &nbsp;·&nbsp; &ldquo;Others have it worse.&rdquo;</p>
                <p className="body-hears">The body hears: your pain is inconvenient or excessive.</p>
              </div>
              <div className="error-card">
                <div className="num">Four</div>
                <h4>Correcting Feelings</h4>
                <p>One of the most common listening errors, and an essential step in self-betrayal.</p>
                <p className="sounds-like">&ldquo;You shouldn&apos;t feel that way.&rdquo; &nbsp;·&nbsp; &ldquo;That doesn&apos;t make sense.&rdquo; &nbsp;·&nbsp; &ldquo;You&apos;re taking it the wrong way.&rdquo;</p>
                <p className="body-hears">This teaches the speaker to mistrust their own sensations and emotions.</p>
              </div>
              <div className="error-card">
                <div className="num">Five</div>
                <h4>Making It About Yourself</h4>
                <p>Shifting focus to one&apos;s own story may feel empathic, and it moves the speaker out of the center of their experience.</p>
                <p className="sounds-like">&ldquo;That happened to me too…&rdquo; &nbsp;·&nbsp; &ldquo;When I went through something similar…&rdquo;</p>
                <p className="body-hears">The unspoken message: your experience must be shared or compared to be valid.</p>
              </div>
              <div className="error-card">
                <div className="num">Six</div>
                <h4>Getting Distracted</h4>
                <p>Partial attention — checking phones, multitasking, scanning the room — registers as abandonment at a nervous-system level.</p>
                <p className="body-hears">The body experiences it as: I am not important enough to be fully here for. Even brief disengagement can reopen old attachment wounds.</p>
              </div>
              <div className="error-card">
                <div className="num">Seven</div>
                <h4>Rushing</h4>
                <p>Finishing sentences, pushing toward resolution, moving on too quickly.</p>
                <p className="body-hears">Trauma and betrayal resolve through completion rather than speed. Rushing interrupts the body&apos;s natural rhythm of integration.</p>
              </div>
              <div className="error-card">
                <div className="num">Eight</div>
                <h4>Intellectualizing</h4>
                <p>Turning emotional experience into theory, logic, or interpretation pulls the speaker out of the body. Analyzing motives, reframing before feeling, explaining why something happened.</p>
                <p className="body-hears">The soul learns: my experience must be translated to be acceptable.</p>
              </div>
              <div className="error-card">
                <div className="num">Nine</div>
                <h4>Deciding Without the Person</h4>
                <p>A profound relational violation. When families or systems decide <em>about</em> someone rather than <em>with</em> them, the message is that their voice is optional and their inner authority irrelevant.</p>
                <p className="body-hears">This pattern deeply reinforces betrayal of self.</p>
              </div>
              <div className="error-card">
                <div className="num">Ten</div>
                <h4>Listening to Respond</h4>
                <p>When the listener is preparing their reply rather than receiving the speaker, attunement is lost.</p>
                <p className="body-hears">The speaker feels unseen, misunderstood, emotionally alone. The body notices immediately.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In Families</div>
            <h2 className="vk-title">Invisible <em>Violations</em></h2>
            <p className="vk-lede">In families, betrayal often appears as decisions made about someone without them present, conversations <em>about</em> rather than <em>with</em>, advice replacing curiosity, and protection replacing inclusion.</p>
            <p className="vk-body">Even when motivated by love, these patterns communicate: <em>&ldquo;Your voice is not required.&rdquo;</em></p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Agreement One</div>
                <h3>Everyone Is Present</h3>
                <p>No decisions about someone without them in the room. Presence restores the voice that these patterns quietly remove.</p>
              </div>
              <div className="def-card">
                <div className="label">Agreement Two</div>
                <h3>Listening Comes First</h3>
                <p>Listening precedes problem-solving. The solution arrives more cleanly once the experience has been received.</p>
              </div>
            </div>

            <h3 className="sub-heading">The Sentences That <em>Heal</em></h3>
            <p className="sub-sub">Certain statements directly counter the belief systems formed through betrayal. These land in the body rather than the mind.</p>

            <div className="phrase-stack">
              <div className="phrase-card">
                <div className="label">Words to Carry</div>
                <h4>Four <em>Repairs</em></h4>
                <ul className="phrase-list">
                  <li>&ldquo;I believe you.&rdquo;</li>
                  <li>&ldquo;Thank you for telling me.&rdquo;</li>
                  <li>&ldquo;I&apos;m here to be with you.&rdquo;</li>
                  <li>&ldquo;Your experience matters.&rdquo;</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">When Language Is Hard to Find</div>
            <h2 className="vk-title">A Reparative Listening <em>Script</em></h2>
            <p className="vk-lede">This simple structure supports re-inhabiting the self. Keep it close until it becomes your own.</p>

            <div className="script-callout">
              <div className="label">Say This</div>
              <p>&ldquo;I&apos;m listening. What you&apos;re saying is ____. It makes sense you feel ____. Is that right?&rdquo;</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What Listening Restores</div>
            <h2 className="vk-title">Listening as <em>Prevention</em></h2>
            <p className="vk-lede">Each listening failure teaches the same lesson in a different form: <em>it is safe to bring only part of my experience here.</em> Over time the soul adapts by withholding truth, disconnecting from sensation, deferring to external authority, and abandoning inner knowing.</p>
            <p className="vk-body">This is adaptation rather than pathology. And adaptation can be met.</p>

            <div className="body-panel">
              <div className="label">The Exchange</div>
              <h3>What Mindful Listening <em>Restores</em></h3>
              <p className="intro">Mindful listening interrupts these patterns by offering the opposite of each one.</p>

              <div className="body-cols">
                <div className="body-col">
                  <h4>In place of</h4>
                  <ul className="arrow-list">
                    <li>Distraction</li>
                    <li>Judgment</li>
                    <li>Control</li>
                    <li>Exclusion</li>
                  </ul>
                </div>
                <div className="body-col">
                  <h4>It restores</h4>
                  <ul className="arrow-list">
                    <li>Presence</li>
                    <li>Curiosity</li>
                    <li>Permission</li>
                    <li>Inclusion</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="gentle-pull">When listening is clean, the soul can rest instead of defend. To listen well is to make room. And in that room, healing begins.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week One · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three invitations to bring mindful listening into the relationships you are returning to. Begin with one conversation a day.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Practice the reparative script once each day.</h3>
                <div className="hw-tags">I&apos;m listening &nbsp;·&nbsp; What you&apos;re saying is ____ &nbsp;·&nbsp; It makes sense you feel ____ &nbsp;·&nbsp; Is that right?</div>
                <p className="reflection">Choose one conversation each day and use the structure exactly as written. Notice what happens in your own body when you hand the authority back. Notice what happens in theirs.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Ask permission before offering.</h3>
                <p className="reflection">This week, before any advice leaves your mouth, ask: <em>&ldquo;Would you like me to just listen, or would ideas help?&rdquo;</em> Honor the answer completely. Track how often the impulse to fix arrives, and what it feels like in the body to let it pass.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Notice your own listening errors with compassion.</h3>
                <p className="reflection">Read the ten errors again and find the one or two that are most yours. They came from anxiety, habit, or love. Watch for them this week without self-judgment. Each time you catch one, simply return to presence. The noticing is the practice.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">From Betrayal to Belonging</div>
            <h2>Mindful listening is a relational stance. <em>Your inner world is welcome here.</em></h2>
            <p>When people are listened to in this way, they find their own clarity, strength, and direction. Healing the betrayal of the soul begins when experience is met rather than managed. To listen mindfully is to restore the most essential truth: nothing is wrong with you. Your body remembers. Your soul knows. And you are allowed to speak.</p>
          </div>
        </section>

        <PneGuideFooter />
      </div>
    </>
  );
}
