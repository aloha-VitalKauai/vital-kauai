import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Guide · Week 6, Vital Kauaʻi" };

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

  .pne-companion-w6-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-w6-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-w6-page .vk-section { padding: 64px 0; }
  .pne-companion-w6-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-w6-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-w6-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-w6-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-w6-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-w6-page p.vk-lede, .pne-companion-w6-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-w6-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-w6-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-w6-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w6-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-w6-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-w6-page .gentle-pull {
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
  .pne-companion-w6-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w6-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-w6-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-w6-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-w6-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-w6-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w6-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-w6-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  /* Practice grid — six practices of personal spiritual connection */
  .pne-companion-w6-page .practice-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 28px;
  }
  .pne-companion-w6-page .practice-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 26px 22px;
    text-align: center;
  }
  .pne-companion-w6-page .practice-card .num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 8px;
  }
  .pne-companion-w6-page .practice-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-style: italic;
    font-size: 22px;
    color: var(--accent-sage);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .pne-companion-w6-page .practice-card p {
    color: var(--ink-body);
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }

  /* Prayer stack — two prayer cards */
  .pne-companion-w6-page .prayer-stack {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-w6-page .prayer-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 34px 36px;
    border-left: 3px solid var(--accent-gold);
  }
  .pne-companion-w6-page .prayer-card .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 14px;
  }
  .pne-companion-w6-page .prayer-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    margin-bottom: 16px;
    line-height: 1.25;
  }
  .pne-companion-w6-page .prayer-card h4 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w6-page .prayer-card .prayer-body {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    color: var(--ink-dark);
    line-height: 1.55;
    margin: 0 0 14px;
    padding: 0 0 0 18px;
    border-left: 2px solid var(--line);
  }
  .pne-companion-w6-page .prayer-card p.prayer-note {
    color: var(--ink-mute);
    font-size: 14px;
    line-height: 1.55;
    margin: 14px 0 0;
  }

  /* Discernment question — large contemplative callout */
  .pne-companion-w6-page .discern-question {
    margin-top: 28px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
    text-align: center;
  }
  .pne-companion-w6-page .discern-question .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w6-page .discern-question p {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 28px);
    color: var(--ink-dark);
    line-height: 1.4;
    margin: 0;
    max-width: 720px;
    margin: 0 auto;
  }

  /* Iboga panel */
  .pne-companion-w6-page .iboga-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-w6-page .iboga-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-w6-page .iboga-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-w6-page .iboga-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w6-page .iboga-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w6-page .iboga-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w6-page .iboga-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w6-page .iboga-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-w6-page .iboga-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w6-page .iboga-list li:first-child { border-top: none; }
  .pne-companion-w6-page .iboga-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  .pne-companion-w6-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-w6-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w6-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  /* Homework panel */
  .pne-companion-w6-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-w6-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-w6-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-w6-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w6-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-w6-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-w6-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-w6-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-w6-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-w6-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-w6-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-w6-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-w6-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-w6-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-w6-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-w6-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-w6-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-w6-page .vk-section { padding: 48px 0; }
    .pne-companion-w6-page .vk-wrap, .pne-companion-w6-page .vk-narrow { padding: 0 24px; }
    .pne-companion-w6-page header.hero { padding: 64px 0 72px; }
    .pne-companion-w6-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w6-page .def-card { padding: 24px 22px; }
    .pne-companion-w6-page .practice-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .pne-companion-w6-page .practice-card { padding: 22px 18px; }
    .pne-companion-w6-page .prayer-card { padding: 26px 22px; }
    .pne-companion-w6-page .discern-question { padding: 28px 22px; }
    .pne-companion-w6-page .iboga-panel { padding: 28px 22px; }
    .pne-companion-w6-page .iboga-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-w6-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function SomaticCompanionWeek6Page() {
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

      <div className="pne-companion-w6-page">
        <span id="top" />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week Six <em>PNE Guide</em></h1>
            <p className="hero-subtitle">Spirit and the Sacred</p>
            <p className="hero-lede">Spirituality is the ongoing process of living what the medicine reveals. The work of this week is to begin cultivating the connection that will hold you in ceremony and become the daily ground of your life beyond it.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">A Spiritual <em>Encounter</em></h2>
            <p className="vk-lede">Iboga is a profound encounter that reveals the deeper roots of suffering, identity, purpose, and your spiritual nature. The medicine can temporarily soften the conditioned belief systems and survival patterns that have shaped your life, allowing you to see beyond addiction, trauma, and pain.</p>
            <p className="vk-body">In this expanded state of awareness, old beliefs like unworthiness, fear, or the need to suffer may become visible, creating an opportunity to witness and gently question the &ldquo;false self&rdquo; built from past wounds.</p>

            <div className="gentle-pull">Iboga may open the door to the soul. Spirituality is the ongoing process of living what that door reveals.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">What May Arise in Ceremony</div>
            <h2 className="vk-title">A <em>Life Review</em></h2>
            <p className="vk-lede">Many who journey with iboga describe an intense life review, where memories, relationships, choices, and unresolved trauma surface with remarkable clarity. This process can resemble a spiritual reckoning, bringing remorse, forgiveness, compassion, and sometimes a renewed sense of life purpose.</p>

            <div className="iboga-panel">
              <div className="label">In the Medicine</div>
              <h3>Iboga as <em>Sacred Teacher</em></h3>
              <p className="intro">In traditional indigenous Bwiti practice, Iboga is regarded as a sacred spiritual teacher that supports healing, initiation, and connection to ancestors and divine intelligence. Modern participants describe similar experiences in their own language and tradition.</p>

              <div className="iboga-cols">
                <div className="iboga-col">
                  <h4>What may be revealed</h4>
                  <ul className="iboga-list">
                    <li>Memories, relationships, and choices surfacing with clarity</li>
                    <li>Old beliefs becoming visible and softening</li>
                    <li>Unresolved trauma rising to be met and tended</li>
                    <li>A renewed sense of life purpose</li>
                  </ul>
                </div>
                <div className="iboga-col">
                  <h4>What may be felt</h4>
                  <ul className="iboga-list">
                    <li>Remorse, forgiveness, and compassion moving through</li>
                    <li>Connection to God, universal consciousness, or nature</li>
                    <li>Communion with ancestors or divine intelligence</li>
                    <li>A deeper inner truth becoming knowable</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Cultivating What is Yours</div>
            <h2 className="vk-title">Your Relationship to <em>Higher Power</em></h2>
            <p className="vk-lede">Your experience of spirituality is your own. Whether your connection moves toward God, Love, Jesus, your Higher Self, the ancestors, or the living world, these relationships are yours to cultivate. You are encouraged to begin a spiritual connection practice in the weeks leading up to your journey.</p>
            <p className="vk-body">There are many ways to meet the sacred. Below are six. The right one is the one that opens you.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <div className="num">One</div>
                <h4>Prayer</h4>
                <p>Speak inwardly or aloud. Offer what is alive in you, and ask for what is needed.</p>
              </div>
              <div className="practice-card">
                <div className="num">Two</div>
                <h4>Meditation</h4>
                <p>Sit in stillness. Let the mind settle until the deeper listening becomes available.</p>
              </div>
              <div className="practice-card">
                <div className="num">Three</div>
                <h4>Song</h4>
                <p>Sing, chant, or hum. The voice is a doorway between the body and what is beyond it.</p>
              </div>
              <div className="practice-card">
                <div className="num">Four</div>
                <h4>Dance</h4>
                <p>Let the body move as prayer. Movement bypasses the mind and meets spirit directly.</p>
              </div>
              <div className="practice-card">
                <div className="num">Five</div>
                <h4>Time in Nature</h4>
                <p>Walk slowly. Sit with a tree, a stream, or the sky. The natural world remembers you.</p>
              </div>
              <div className="practice-card">
                <div className="num">Six</div>
                <h4>Daily Rituals</h4>
                <p>A morning candle. An evening breath. A small act done with care becomes sacred ground.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Generational Lens</div>
            <h2 className="vk-title">PNE and Your <em>Spiritual Evolution</em></h2>
            <p className="vk-lede">Through the spiritual lens of PNE, the trauma imprints you are working with can be understood as the ancestral healing you came here to complete. Trauma imprints are often the unfinished emotional, moral, or energetic patterns that have traveled through the generations of your family.</p>
            <p className="vk-body">These ancestral imprints can live as guilt that was never reconciled, love that was never spoken, or pain never fully metabolized. The unmet energy can continue to shape the body, the nervous system, the relationships, and the sense of self that arrives in you today.</p>
            <p className="vk-body">Through your work with PNE, iboga, and the ongoing integration, you have the opportunity to complete and release what is no longer yours to carry, and to transform pain into wisdom. This is the deep work of spiritual evolution.</p>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>What you heal in yourself is the greatest gift you can offer to the generations before and after you. This work brings you into a deeper felt connection with the Divine.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Hearing the True Voice</div>
            <h2 className="vk-title">Discerning <em>Divine Guidance</em></h2>
            <p className="vk-lede">The voice of inherited programming and the voice of the Divine can sound similar at first. With time, the body learns to tell them apart by how they feel.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Inherited Programming</div>
                <h3>Urgent and Demanding</h3>
                <p>Often arrives as urgency, judgment, demand, or frantic certainty. Creates fear in the body and confusion in the mind.</p>
              </div>
              <div className="def-card">
                <div className="label">The Divine</div>
                <h3>Steady and Spacious</h3>
                <p>Brings lasting peace and inner wisdom. Honors your timing, your discernment, and your free will. Leaves the body more open than it found it.</p>
              </div>
            </div>

            <div className="discern-question">
              <div className="label">A Question to Ask</div>
              <p>&ldquo;Is this aligned with Truth, Humility, Healing, and Compassion?&rdquo;</p>
            </div>

            <p className="vk-body" style={{ marginTop: 24 }}>If a guidance is aligned with those four, follow it. If it is not, you may simply pray that energy be sent forward into the light of love, and let it pass.</p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Words to Carry</div>
            <h2 className="vk-title">Prayers and <em>Mantras</em></h2>
            <p className="vk-lede">Two prayers to offer before or after your PNE sessions, and to carry into ceremony. Let them rest in you. Speak them softly, or hold them silently in the heart.</p>

            <div className="prayer-stack">
              <div className="prayer-card">
                <div className="label">Prayer One</div>
                <h4>For the <em>Lineage</em></h4>
                <p className="prayer-body">&ldquo;Let every spirit of our lineage find its rest. Where pain or fear has echoed through generations, let mercy close the circle in Love. May we carry forward only what serves life, and release the rest into your eternal peace.&rdquo;</p>
              </div>
              <div className="prayer-card">
                <div className="label">Prayer Two</div>
                <h4>To Bless the <em>Ancestors</em></h4>
                <p className="prayer-body">&ldquo;I honor your journey. I release you into God&apos;s light. I carry forward only the love.&rdquo;</p>
                <p className="prayer-note">A mantra that blesses your own nervous system and the generational field.</p>
              </div>
            </div>

            <h3 className="sub-heading">The Coherent <em>Heart Breath</em></h3>
            <p className="sub-sub">A practice that builds the connection between heart and brain. Let it be with you this week.</p>
            <p className="vk-body" style={{ marginTop: 16 }}>
              Return to the full Coherent Heart Breath in <em>The Somatic Companion</em>: hand on heart, hand on belly, a seven-second wave of inhale, hold, exhale, and pause. Use it before each prayer, before journaling, and as a daily way of arriving in yourself.
            </p>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In the Days That Follow</div>
            <h2 className="vk-title">Integration as <em>Spiritual Practice</em></h2>
            <p className="vk-lede">From a PNE perspective, iboga can interrupt the neurological and emotional loops that have organized your life, creating space for expanded awareness. In that space, your survival identity becomes distinguishable from your essential self. The door opens.</p>
            <p className="vk-body">Lasting transformation depends on integration. When beliefs are restructured, the nervous system regulated, trauma met, and daily life aligned with the new awareness, the spiritual revelations of ceremony settle into the body and remain. With conscious integration, iboga becomes a catalyst for profound personal and spiritual awakening.</p>

            <div className="gentle-pull">Iboga opens the door to the soul. Spirituality is the ongoing process of living what the door reveals.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Six · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three invitations to begin cultivating the spiritual connection you will carry into ceremony, and into the life that follows it.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Begin a daily connection practice.</h3>
                <div className="hw-tags">Prayer &nbsp;·&nbsp; Meditation &nbsp;·&nbsp; Song &nbsp;·&nbsp; Dance &nbsp;·&nbsp; Time in Nature &nbsp;·&nbsp; Coherent Heart Breath</div>
                <p className="reflection">Choose one practice that opens you. Do it once each day this week. The form matters less than the consistency. The body learns to expect the sacred when you arrive at it on the same shore each morning.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Carry the prayers.</h3>
                <p className="reflection">Read both prayers slowly. Notice which one stirs something in the body. Speak that prayer aloud or silently before your PNE sessions, before journaling, and at any moment this week when you feel called.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Practice the discernment question.</h3>
                <p className="reflection">When guidance arises this week, whether as a thought, an urge, or a felt sense, pause and ask: <em>Is this aligned with Truth, Humility, Healing, and Compassion?</em> Notice what your body answers. Trust what brings peace.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Heart of the Practice</div>
            <h2>You are walking yourself home. <em>The sacred has been walking with you all along.</em></h2>
            <p>What you complete in yourself, you release for the generations. The spiritual life is the ongoing practice of meeting what arises with Truth, Humility, Healing, and Compassion, until the meeting becomes the way you live.</p>
          </div>
        </section>
      </div>
    </>
  );
}
