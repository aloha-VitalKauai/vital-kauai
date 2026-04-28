import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Companion · Week 2, Vital Kauaʻi" };

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

  .pne-companion-w2-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-w2-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-w2-page .vk-section { padding: 64px 0; }
  .pne-companion-w2-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-w2-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-w2-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-w2-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-w2-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-w2-page p.vk-lede, .pne-companion-w2-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-w2-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
    border-top: 4px solid #3A2418;
  }
  .pne-companion-w2-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-w2-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w2-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-w2-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-w2-page .gentle-pull {
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
  .pne-companion-w2-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w2-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-w2-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-w2-page .pv-rule { width: 100%; height: 1px; background: var(--line); margin: 28px 0 0; }
  .pne-companion-w2-page .pv-states {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 36px;
  }
  .pne-companion-w2-page .pv-card {
    border-radius: 6px;
    padding: 36px 32px;
    min-height: 460px;
    display: flex;
    flex-direction: column;
  }
  .pne-companion-w2-page .pv-card.ventral     { background: var(--vagal-mint); }
  .pne-companion-w2-page .pv-card.sympathetic { background: var(--vagal-peach); }
  .pne-companion-w2-page .pv-card.dorsal      { background: var(--vagal-blue); }
  .pne-companion-w2-page .pv-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: rgba(31, 38, 32, 0.5);
    margin-bottom: 22px;
  }
  .pne-companion-w2-page .pv-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    line-height: 1.1;
    margin-bottom: 6px;
  }
  .pne-companion-w2-page .pv-card .state-tag {
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 18px;
  }
  .pne-companion-w2-page .pv-card.ventral .state-tag    { color: #2F7A4D; }
  .pne-companion-w2-page .pv-card.sympathetic .state-tag { color: #B47A28; }
  .pne-companion-w2-page .pv-card.dorsal .state-tag     { color: #4D6A99; }
  .pne-companion-w2-page .pv-card p { color: var(--ink-body); font-size: 15px; line-height: 1.6; margin-bottom: 16px; }
  .pne-companion-w2-page .pv-card ul {
    list-style: none;
    padding: 0;
    margin-top: auto;
  }
  .pne-companion-w2-page .pv-card li {
    position: relative;
    padding: 6px 0 6px 18px;
    font-size: 14.5px;
    line-height: 1.5;
    color: var(--ink-body);
  }
  .pne-companion-w2-page .pv-card li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    width: 8px;
    height: 1px;
    background: rgba(31, 38, 32, 0.35);
  }

  .pne-companion-w2-page .pattern-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-top: 32px;
  }
  .pne-companion-w2-page .pattern-grid.two {
    grid-template-columns: repeat(2, 1fr);
  }
  .pne-companion-w2-page .pattern-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
    display: flex;
    flex-direction: column;
  }
  .pne-companion-w2-page .pattern-card .tag {
    align-self: flex-start;
    font-size: 11px;
    letter-spacing: 0.28em;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--accent-warm);
    padding: 5px 11px;
    background: rgba(201, 152, 94, 0.12);
    border-radius: 3px;
    margin-bottom: 16px;
  }
  .pne-companion-w2-page .pattern-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    margin-bottom: 10px;
    line-height: 1.2;
  }
  .pne-companion-w2-page .pattern-card > p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 14px;
  }
  .pne-companion-w2-page .pattern-card ul {
    list-style: none;
    padding: 0;
    margin-top: auto;
  }
  .pne-companion-w2-page .pattern-card li {
    position: relative;
    padding: 5px 0 5px 14px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-body);
  }
  .pne-companion-w2-page .pattern-card li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 13px;
    width: 6px;
    height: 1px;
    background: var(--accent-warm);
    opacity: 0.6;
  }

  .pne-companion-w2-page .flex-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 32px;
  }
  .pne-companion-w2-page .flex-col {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 32px 30px;
  }
  .pne-companion-w2-page .flex-col .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w2-page .flex-col h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.2;
  }
  .pne-companion-w2-page .flex-col p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  .pne-companion-w2-page .iboga-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-w2-page .iboga-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-w2-page .iboga-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-w2-page .iboga-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w2-page .iboga-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w2-page .iboga-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w2-page .iboga-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w2-page .iboga-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-w2-page .iboga-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w2-page .iboga-list li:first-child { border-top: none; }
  .pne-companion-w2-page .iboga-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  .pne-companion-w2-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-w2-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-w2-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-w2-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w2-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-w2-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-w2-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-w2-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-w2-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-w2-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-w2-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-w2-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-w2-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-w2-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-w2-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-w2-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-w2-page .vk-section { padding: 48px 0; }
    .pne-companion-w2-page .vk-wrap, .pne-companion-w2-page .vk-narrow { padding: 0 24px; }
    .pne-companion-w2-page header.hero { padding: 64px 0 72px; }
    .pne-companion-w2-page .pv-states { grid-template-columns: 1fr; gap: 16px; }
    .pne-companion-w2-page .pv-card { min-height: auto; padding: 28px 24px; }
    .pne-companion-w2-page .pattern-grid, .pne-companion-w2-page .pattern-grid.two { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w2-page .pattern-card { padding: 24px 22px; }
    .pne-companion-w2-page .flex-grid { grid-template-columns: 1fr; gap: 16px; }
    .pne-companion-w2-page .flex-col { padding: 26px 22px; }
    .pne-companion-w2-page .iboga-panel { padding: 28px 22px; }
    .pne-companion-w2-page .iboga-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-w2-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function SomaticCompanionWeek2Page() {
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

      <div className="pne-companion-w2-page">
        <span id="top" />
        <header className="hero">
          <div className="vk-wrap">
            <div className="vk-eyebrow">Iboga Journey · Member Resource</div>
            <h1>Week Two <em>PNE Companion</em></h1>
            <p className="hero-subtitle">Nervous System Regulation</p>
            <p className="hero-lede">A Polyvagal Neuroscience-Informed framework for understanding how your body moves between states of safety, protection, and rest, and how to support its natural return to balance.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Returning to Balance</div>
            <h2 className="vk-title">What Is <em>Regulation</em></h2>
            <p className="vk-lede">Regulation is the nervous system&apos;s capacity to return to safety, flexibility, and connection. It is the body&apos;s quiet skill of moving through stress and finding its way home again.</p>
            <p className="vk-body">The triune brain, our most ancient inheritance, holds the regulation of thought, emotion, and sensation. When all three are working together, we can understand what we feel, express it clearly, and think with steadiness.</p>

            <div className="gentle-pull">A regulated body is not a quiet body. It is a body that knows how to come back.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">When the System Holds On</div>
            <h2 className="vk-title">What Is <em>Dysregulation</em></h2>
            <p className="vk-lede">Sometimes, after challenge or threat, the body&apos;s protective systems take longer to find their way back to balance. The system stays in the language of protection a little longer, holding more activation, more stillness, or moving between the two as it waits for signals of safety to return.</p>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>The system is always whole. It is doing its best to keep you safe, working with the safety signals it has.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-wrap">
            <div className="vk-eyebrow">The Three Nervous System States</div>
            <h2 className="vk-title">Reading the <em>Body&apos;s Weather</em></h2>
            <p className="vk-lede">Your nervous system is always sensing whether the moment is safe. This automatic awareness shapes how you think, feel, relate, and respond. Each of the three states below is intelligent. Each of them is your body taking care of you.</p>

            <div className="pv-rule"></div>

            <div className="pv-states">
              <article className="pv-card ventral">
                <div className="label">State One</div>
                <h3>Ventral Vagal</h3>
                <div className="state-tag">Safe &amp; Connected</div>
                <p>Your home base. Here the body feels open, the heart is steady, and the world feels approachable. This is where presence, creativity, and connection naturally arise.</p>
                <ul>
                  <li>Calm, easy breathing</li>
                  <li>Clear thinking</li>
                  <li>Social connection</li>
                  <li>Creativity, gratitude, compassion</li>
                </ul>
              </article>

              <article className="pv-card sympathetic">
                <div className="label">State Two</div>
                <h3>Sympathetic</h3>
                <div className="state-tag">Mobilized</div>
                <p>When the system senses something to attend to, it gathers energy for action. This is the body preparing to move, to advocate, to protect. Quick and protective by design.</p>
                <ul>
                  <li>Urgency, tension, alertness</li>
                  <li>Restlessness, irritability</li>
                  <li>Quickened heartbeat</li>
                  <li>Heightened vigilance</li>
                </ul>
              </article>

              <article className="pv-card dorsal">
                <div className="label">State Three</div>
                <h3>Dorsal Vagal</h3>
                <div className="state-tag">Conserving</div>
                <p>When activation alone is not enough, the system softens inward to conserve. This is an ancient, protective stillness, one of the body&apos;s oldest forms of care.</p>
                <ul>
                  <li>Quietness, low energy</li>
                  <li>Inwardness, withdrawal</li>
                  <li>A sense of slowness or fog</li>
                  <li>Wanting to rest or be alone</li>
                </ul>
              </article>
            </div>

            <div className="gentle-pull-light" style={{ marginTop: 32 }}>
              <div className="label">Remember</div>
              <p>These states are intelligent, adaptive responses. Your nervous system is always doing its best to keep you safe.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Mobilized Patterns in Daily Life</div>
            <h2 className="vk-title">Fight, Flight, <em>Fawn</em></h2>
            <p className="vk-lede">When the body senses something to attend to, it can call on different protective strategies to keep you safe. These show up not only in emergencies, but in everyday interactions, often quietly.</p>

            <div className="pattern-grid">
              <div className="pattern-card">
                <div className="tag">Fight</div>
                <h3>Protection through intensity</h3>
                <p>The body reaches for control, firmness, or assertion to meet what feels like a threat.</p>
                <ul>
                  <li>Snapping, impatience</li>
                  <li>Defensiveness, needing control</li>
                  <li>Argumentative reactions</li>
                </ul>
              </div>
              <div className="pattern-card">
                <div className="tag">Flight</div>
                <h3>Protection through distance</h3>
                <p>The body seeks space from what feels overwhelming, whether physically or in the mind.</p>
                <ul>
                  <li>Constant busyness, overworking</li>
                  <li>Racing thoughts, hard to rest</li>
                  <li>Avoiding difficult conversations</li>
                </ul>
              </div>
              <div className="pattern-card">
                <div className="tag">Fawn</div>
                <h3>Protection through pleasing</h3>
                <p>The body softens toward others to maintain safety and avoid friction.</p>
                <ul>
                  <li>Saying yes when you mean no</li>
                  <li>Over-accommodating others</li>
                  <li>Setting your own needs aside</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Conserving Patterns in Daily Life</div>
            <h2 className="vk-title">Freeze, Withdraw, <em>Soften Inward</em></h2>
            <p className="vk-lede">When activation alone cannot meet the moment, the body draws inward. These patterns are wisdom in stillness, the body&apos;s most ancient form of survival, slowing everything down to protect what matters.</p>

            <div className="pattern-grid two">
              <div className="pattern-card">
                <div className="tag">Freeze</div>
                <h3>Stillness as protection</h3>
                <p>The body becomes very still, conserving energy until it senses it is safe to move again.</p>
                <ul>
                  <li>Procrastination, indecision</li>
                  <li>Staring, unable to begin tasks</li>
                </ul>
              </div>
              <div className="pattern-card">
                <div className="tag">Withdraw</div>
                <h3>Resting through retreat</h3>
                <p>The body conserves resources, stepping back from the world while it gathers itself.</p>
                <ul>
                  <li>Wanting solitude, low energy</li>
                  <li>A flat or quiet inner landscape</li>
                </ul>
              </div>
              <div className="pattern-card">
                <div className="tag">Soften Inward</div>
                <h3>Distance from the moment</h3>
                <p>The body creates a gentle space between you and an experience that feels like too much.</p>
                <ul>
                  <li>Feeling far away or dreamlike</li>
                  <li>Time becoming softer, less defined</li>
                </ul>
              </div>
              <div className="pattern-card">
                <div className="tag">Living in the Mind</div>
                <h3>Thought as a soft place to land</h3>
                <p>The body sometimes leans into thinking and analysis as a way to gently sidestep what feels too tender to feel directly.</p>
                <ul>
                  <li>Endless analyzing or researching</li>
                  <li>Talking about feelings without quite touching them</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">A Healthy Nervous System</div>
            <h2 className="vk-title">The Capacity to <em>Move Through</em></h2>
            <p className="vk-lede">A healthy nervous system is one that moves. It flows flexibly between activation, protection, connection, and rest. It can meet challenge, respond to it, and return to balance when the moment has passed.</p>

            <div className="flex-grid">
              <div className="flex-col">
                <div className="label">Flexibility</div>
                <h3>The body that can return</h3>
                <p>A regulated system rises into action when needed and softens back into rest when the moment ends. It moves like weather, never staying in any one season for long.</p>
              </div>
              <div className="flex-col">
                <div className="label">Holding On</div>
                <h3>When patterns linger</h3>
                <p>Sometimes the body holds a protective pattern long after the moment has passed. This is the body still listening for the all-clear, waiting to feel safe enough to soften.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In the Medicine</div>
            <h2 className="vk-title">The Nervous System in <em>Your Iboga Journey</em></h2>
            <p className="vk-lede">Iboga has a way of reaching what is held below the surface. It can gently activate and reorganize stored memory, emotion, and sensation, opening a window for the body to revisit what it has been carrying.</p>

            <div className="iboga-panel">
              <div className="label">What May Arise</div>
              <h3>Two ways of <em>knowing</em></h3>
              <p className="intro">During the experience, the body and the inner landscape may move in ways that feel new. Below are some of the patterns participants commonly meet.</p>

              <div className="iboga-cols">
                <div className="iboga-col">
                  <h4>During the experience</h4>
                  <ul className="iboga-list">
                    <li>Stored sensory, emotional, and memory material gently rising</li>
                    <li>The system moving between activation and stillness</li>
                    <li>Deep inward focus, with less attention to the outer world</li>
                    <li>Familiar patterns of thought softening or pausing</li>
                  </ul>
                </div>
                <div className="iboga-col">
                  <h4>What this can feel like</h4>
                  <ul className="iboga-list">
                    <li>Moments of clarity or sudden understanding</li>
                    <li>Emotional waves: grief, fear, tenderness</li>
                    <li>Physical stillness or a sense of profound weight</li>
                    <li>Dream-like reviews of one&apos;s own life</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="gentle-pull">Iboga can bring the body into intense moments. Your practitioners are present to support you. The practices you are building now give your body the capacity to meet whatever arises with greater ease.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Two · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">A gentle invitation to notice your own patterns, with curiosity rather than judgment. The body has been carrying you all along. This is simply meeting it with awareness.</p>

              <div className="hw-step">
                <div className="hw-num">Reflection</div>
                <h3>When stress arises, which pattern do you most often lean toward?</h3>
                <p className="reflection">Notice gently. Fight, flight, fawn, freeze, or softening inward. Whatever comes is welcome. Your body has chosen what has helped it survive.</p>
                <p className="reflection">What situations tend to call these patterns forward most quickly in your life?</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Practice</div>
                <h3>Continue the regulation practices from Week One.</h3>
                <p className="reflection">Breath, grounding, orienting, and felt-sense practices. Visit the materials section of the portal for the full Regulation Practices guide, with practices tailored to each nervous system state.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Heart of the Practice</div>
            <h2>Your body is wise. <em>You are whole.</em></h2>
            <p>Every state your nervous system has ever moved through has been a faithful attempt to keep you safe. The work of this week is simply to meet those patterns with curiosity, and to remember that the body always knows how to come home.</p>
          </div>
        </section>
      </div>
    </>
  );
}
