import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PneGuidePrintButton, PneGuideFooter } from "@/components/portal/PneGuidePrint";

export const metadata = { title: "The PsychoNeuroEnergetics (PNE) Guide · Week 4, Vital Kauaʻi" };

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

  .pne-companion-w4-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .pne-companion-w4-page {
    background: var(--bg-cream);
    color: var(--ink-body);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  .pne-companion-w4-page .vk-section { padding: 64px 0; }
  .pne-companion-w4-page .vk-wrap   { max-width: 1080px; margin: 0 auto; padding: 0 40px; }
  .pne-companion-w4-page .vk-narrow { max-width: 880px;  margin: 0 auto; padding: 0 40px; }

  .pne-companion-w4-page .vk-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 24px;
    font-weight: 500;
  }

  .pne-companion-w4-page h2.vk-title {
    font-family: var(--serif);
    font-weight: 400;
    color: var(--ink-dark);
    letter-spacing: -0.005em;
    line-height: 1.05;
    margin-bottom: 20px;
    font-size: clamp(34px, 4.6vw, 54px);
  }
  .pne-companion-w4-page h2.vk-title em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }

  .pne-companion-w4-page p.vk-lede, .pne-companion-w4-page p.vk-body {
    max-width: 760px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink-body);
    margin-bottom: 16px;
  }

  .pne-companion-w4-page header.hero {
    background: var(--bg-dark);
    padding: 96px 0 112px;
  }
  .pne-companion-w4-page .hero h1 {
    color: var(--ink-light);
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 4.6vw, 56px);
    line-height: 1.1;
    margin-bottom: 14px;
    letter-spacing: -0.005em;
  }
  .pne-companion-w4-page .hero h1 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w4-page .hero p.hero-subtitle {
    font-family: var(--serif);
    font-style: italic;
    font-size: clamp(17px, 1.8vw, 20px);
    color: var(--accent-sage);
    margin-bottom: 28px;
    letter-spacing: 0.005em;
  }
  .pne-companion-w4-page .hero p.hero-lede {
    color: #C9C2A8;
    font-size: 16px;
    line-height: 1.7;
    max-width: 680px;
    margin-bottom: 0;
  }

  .pne-companion-w4-page .gentle-pull {
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
  .pne-companion-w4-page .gentle-pull-light {
    margin-top: 28px;
    padding: 20px 26px;
    background: var(--bg-card);
    color: var(--ink-dark);
    border-left: 3px solid var(--accent-gold);
    max-width: 760px;
  }
  .pne-companion-w4-page .gentle-pull-light .label {
    font-family: var(--body);
    font-weight: 600;
    color: var(--accent-warm);
    letter-spacing: 0.18em;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .pne-companion-w4-page .gentle-pull-light p {
    font-family: var(--serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1.5;
    color: var(--ink-dark);
    margin: 0;
  }

  .pne-companion-w4-page .def-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-w4-page .def-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 30px 28px;
  }
  .pne-companion-w4-page .def-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .def-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 12px;
  }
  .pne-companion-w4-page .def-card p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin: 0;
  }

  .pne-companion-w4-page .five-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-top: 32px;
  }
  .pne-companion-w4-page .emotion-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 28px 22px;
    text-align: center;
    display: flex;
    flex-direction: column;
  }
  .pne-companion-w4-page .emotion-card .name-label {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 10px;
  }
  .pne-companion-w4-page .emotion-card h4 {
    font-family: var(--serif);
    font-weight: 400;
    font-style: italic;
    font-size: 26px;
    color: var(--accent-sage);
    line-height: 1.1;
    margin-bottom: 12px;
  }
  .pne-companion-w4-page .emotion-card p {
    color: var(--ink-body);
    font-size: 13.5px;
    line-height: 1.55;
    margin: 0;
  }

  .pne-companion-w4-page .dual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 32px;
  }
  .pne-companion-w4-page .dual-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 32px 30px;
    display: flex;
    flex-direction: column;
  }
  .pne-companion-w4-page .dual-card .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .dual-card.healthy .label { color: var(--accent-sage); }
  .pne-companion-w4-page .dual-card.unhealthy .label { color: var(--accent-warm); }
  .pne-companion-w4-page .dual-card h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .dual-card > p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 22px;
  }
  .pne-companion-w4-page .quote-pair + .quote-pair { margin-top: 16px; }
  .pne-companion-w4-page .quote-pair .quote-tag {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink-mute);
    margin-bottom: 6px;
    padding-left: 16px;
  }
  .pne-companion-w4-page .quote-pair .quote-body {
    font-family: var(--serif);
    font-style: italic;
    font-size: 17px;
    color: var(--ink-dark);
    line-height: 1.5;
    padding: 0 0 0 16px;
    border-left: 2px solid var(--line);
  }

  .pne-companion-w4-page .secondary-panel {
    margin-top: 36px;
    padding: 36px 40px;
    background: var(--bg-card);
    border-radius: 8px;
  }
  .pne-companion-w4-page .secondary-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .secondary-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    line-height: 1.15;
    margin-bottom: 12px;
  }
  .pne-companion-w4-page .secondary-panel h3 em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w4-page .secondary-panel > p {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w4-page .secondary-rows {
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w4-page .secondary-row {
    display: grid;
    grid-template-columns: 1fr auto 1.4fr;
    gap: 24px;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--line-soft);
  }
  .pne-companion-w4-page .secondary-row .primary {
    font-family: var(--serif);
    font-size: 19px;
    color: var(--ink-dark);
    font-weight: 400;
  }
  .pne-companion-w4-page .secondary-row .arrow {
    color: var(--accent-gold);
    font-size: 18px;
    line-height: 1;
  }
  .pne-companion-w4-page .secondary-row .secondary {
    font-family: var(--serif);
    font-style: italic;
    font-size: 17px;
    color: var(--ink-body);
    line-height: 1.4;
  }

  .pne-companion-w4-page .pattern-chain {
    margin-top: 32px;
    padding: 32px 36px;
    background: var(--bg-card);
    border-radius: 8px;
    border-left: 3px solid var(--accent-warm);
  }
  .pne-companion-w4-page .pattern-chain .label {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent-warm);
    margin-bottom: 12px;
  }
  .pne-companion-w4-page .pattern-chain h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    line-height: 1.2;
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .pattern-chain h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w4-page .pattern-chain p.scenario {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.65;
    margin-bottom: 22px;
  }
  .pne-companion-w4-page .chain-link {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 18px;
    align-items: start;
    padding: 12px 0;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w4-page .chain-link:first-of-type { border-top: none; padding-top: 4px; }
  .pne-companion-w4-page .chain-link .step-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-warm);
    letter-spacing: 0.04em;
    line-height: 1.3;
    padding-top: 2px;
  }
  .pne-companion-w4-page .chain-link .link-text {
    font-family: var(--serif);
    font-size: 17px;
    color: var(--ink-dark);
    line-height: 1.4;
  }

  .pne-companion-w4-page .symptom-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 28px;
  }
  .pne-companion-w4-page .symptom-card {
    background: var(--bg-card);
    border-radius: 6px;
    padding: 18px 16px;
    text-align: center;
    font-family: var(--serif);
    font-size: 16.5px;
    color: var(--ink-dark);
    line-height: 1.35;
  }

  .pne-companion-w4-page .flow {
    margin-top: 32px;
  }
  .pne-companion-w4-page .flow-step {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 24px;
    padding: 28px 0;
    border-top: 1px solid var(--line);
    align-items: start;
  }
  .pne-companion-w4-page .flow-step:last-child {
    border-bottom: 1px solid var(--line);
  }
  .pne-companion-w4-page .flow-step .roman {
    font-family: var(--serif);
    font-style: italic;
    font-size: 22px;
    color: var(--accent-warm);
    line-height: 1;
    padding-top: 4px;
    letter-spacing: 0.05em;
  }
  .pne-companion-w4-page .flow-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 24px;
    color: var(--ink-dark);
    margin-bottom: 6px;
    line-height: 1.2;
  }
  .pne-companion-w4-page .flow-step .prompt {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    margin-bottom: 8px;
  }
  .pne-companion-w4-page .flow-step p {
    color: var(--ink-body);
    font-size: 15px;
    line-height: 1.6;
    margin: 0;
  }

  .pne-companion-w4-page .sub-heading {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 26px;
    color: var(--ink-dark);
    margin-top: 48px;
    margin-bottom: 8px;
    line-height: 1.15;
  }
  .pne-companion-w4-page .sub-heading em {
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
  }
  .pne-companion-w4-page .sub-sub {
    color: var(--ink-mute);
    font-size: 15px;
    margin-bottom: 0;
  }

  .pne-companion-w4-page .iboga-panel {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 36px 40px;
    margin-top: 36px;
  }
  .pne-companion-w4-page .iboga-panel .label {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 16px;
  }
  .pne-companion-w4-page .iboga-panel h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 28px;
    color: var(--ink-dark);
    margin-bottom: 12px;
    line-height: 1.1;
  }
  .pne-companion-w4-page .iboga-panel h3 em { font-style: italic; color: var(--accent-sage); font-weight: 400; }
  .pne-companion-w4-page .iboga-panel > p.intro {
    color: var(--ink-body);
    font-size: 15.5px;
    line-height: 1.65;
    margin-bottom: 24px;
    max-width: 680px;
  }
  .pne-companion-w4-page .iboga-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 36px;
    padding-top: 16px;
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w4-page .iboga-col h4 {
    font-family: var(--serif);
    font-style: italic;
    font-size: 19px;
    font-weight: 400;
    color: var(--accent-sage);
    margin-bottom: 14px;
  }
  .pne-companion-w4-page .iboga-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pne-companion-w4-page .iboga-list li {
    position: relative;
    padding: 9px 0 9px 22px;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-body);
    border-top: 1px solid var(--line-soft);
  }
  .pne-companion-w4-page .iboga-list li:first-child { border-top: none; }
  .pne-companion-w4-page .iboga-list li::before {
    content: '\\2192';
    position: absolute;
    left: 0;
    top: 9px;
    color: var(--accent-gold);
    font-size: 13px;
  }

  .pne-companion-w4-page .homework-panel {
    background: var(--bg-dark);
    color: var(--ink-light);
    border-radius: 6px;
    padding: 48px 44px;
    margin-top: 12px;
  }
  .pne-companion-w4-page .homework-panel .hp-eyebrow {
    color: var(--accent-gold);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .pne-companion-w4-page .homework-panel h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(32px, 4vw, 44px);
    line-height: 1.1;
    color: #F4EDD6;
    margin-bottom: 12px;
  }
  .pne-companion-w4-page .homework-panel h2 em { font-style: italic; color: var(--accent-sage); }
  .pne-companion-w4-page .homework-panel .lede {
    font-size: 16px;
    line-height: 1.65;
    color: #C9C2A8;
    max-width: 640px;
    margin-bottom: 24px;
  }
  .pne-companion-w4-page .hw-step {
    padding: 24px 0;
    border-top: 1px solid var(--line-light);
  }
  .pne-companion-w4-page .hw-step:last-child { border-bottom: 1px solid var(--line-light); }
  .pne-companion-w4-page .hw-num {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }
  .pne-companion-w4-page .hw-step h3 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 22px;
    line-height: 1.3;
    color: #F4EDD6;
    margin-bottom: 10px;
  }
  .pne-companion-w4-page .hw-tags {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    color: var(--accent-sage);
    line-height: 1.65;
  }
  .pne-companion-w4-page .reflection {
    font-size: 15.5px;
    color: #D9D1B5;
    line-height: 1.7;
    margin-top: 8px;
  }
  .pne-companion-w4-page .reflection + .reflection {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px dashed var(--line-light);
  }

  .pne-companion-w4-page .closing-band {
    background: var(--bg-dark);
    color: var(--ink-light);
    padding: 96px 0 104px;
    text-align: center;
  }
  .pne-companion-w4-page .closing-band .closing-eyebrow {
    font-family: var(--body);
    font-size: 12px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent-sage);
    margin-bottom: 36px;
    font-weight: 500;
  }
  .pne-companion-w4-page .closing-band h2 {
    font-family: var(--serif);
    font-weight: 400;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 1.15;
    color: #F4EDD6;
    margin: 0 auto 36px;
    max-width: 880px;
  }
  .pne-companion-w4-page .closing-band h2 em {
    display: block;
    font-style: italic;
    color: var(--accent-sage);
    font-weight: 400;
    margin-top: 4px;
  }
  .pne-companion-w4-page .closing-band p {
    font-size: 16px;
    line-height: 1.75;
    color: #B8B19A;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 880px) {
    .pne-companion-w4-page .vk-section { padding: 48px 0; }
    .pne-companion-w4-page .vk-wrap, .pne-companion-w4-page .vk-narrow { padding: 0 24px; }
    .pne-companion-w4-page header.hero { padding: 64px 0 72px; }
    .pne-companion-w4-page .def-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w4-page .def-card { padding: 24px 22px; }
    .pne-companion-w4-page .five-grid { grid-template-columns: 1fr; gap: 12px; }
    .pne-companion-w4-page .emotion-card { padding: 22px 20px; }
    .pne-companion-w4-page .dual-grid { grid-template-columns: 1fr; gap: 14px; }
    .pne-companion-w4-page .dual-card { padding: 26px 22px; }
    .pne-companion-w4-page .secondary-panel { padding: 28px 22px; }
    .pne-companion-w4-page .secondary-row { grid-template-columns: 1fr; gap: 4px; padding: 14px 0; }
    .pne-companion-w4-page .secondary-row .arrow { display: none; }
    .pne-companion-w4-page .pattern-chain { padding: 26px 22px; }
    .pne-companion-w4-page .chain-link { grid-template-columns: 36px 1fr; gap: 14px; }
    .pne-companion-w4-page .symptom-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .pne-companion-w4-page .symptom-card { padding: 14px 12px; font-size: 15px; }
    .pne-companion-w4-page .iboga-panel { padding: 28px 22px; }
    .pne-companion-w4-page .iboga-cols { grid-template-columns: 1fr; gap: 24px; }
    .pne-companion-w4-page .flow-step { grid-template-columns: 1fr; gap: 8px; }
    .pne-companion-w4-page .flow-step .roman { font-size: 18px; }
    .pne-companion-w4-page .homework-panel { padding: 32px 22px; }
  }
`;

export default async function SomaticCompanionWeek4Page() {
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

      <div className="pne-companion-w4-page">
        <span id="top" />
        <PneGuidePrintButton />
        <header className="hero">
          <div className="vk-wrap">
            <h1>Week Four <em>PNE Guide</em></h1>
            <p className="hero-subtitle">The Language of Emotion</p>
            <p className="hero-lede">Emotions are signals. Before they become stories, they are information rising through the body, telling us what is safe, what nourishes us, what asks to be protected, and what is asking to be honored.</p>
          </div>
        </header>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Why This Matters</div>
            <h2 className="vk-title">Identifying What is <em>Truly Here</em></h2>
            <p className="vk-lede">The work of this week is to identify and fully express emotions in a healthy way. When you know what you are feeling, you have more choice in how you respond. Awareness creates space, and space creates the possibility of meeting yourself and others with care.</p>
            <p className="vk-body">Healthy emotional expression begins with noticing the sensations, thoughts, and impulses that arise with a feeling, then choosing how to express or act on it in a grounded way. The work is to build enough awareness and capacity that the emotion can move through the body, supporting you rather than becoming a pattern that creates suffering.</p>

            <div className="gentle-pull">Emotions move through. The work is to let them be felt, heard, and honored as they pass.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">The Body&apos;s First Signals</div>
            <h2 className="vk-title">What Is a <em>Primary Emotion</em></h2>
            <p className="vk-lede">Primary emotions are signals that draw us toward what is safe, nourishing, and life-giving, and that move us to protect what matters. They are regulated by the limbic system, arising in the body before the mind has formed a single thought about them.</p>
            <p className="vk-body">Primary emotions exist before social conditioning or belief systems. They are innate, biological, body-based, and pre-verbal. They help us communicate needs, know ourselves, and orient to life. Understanding them helps us tell authentic feeling from conditioned reaction.</p>

            <div className="def-grid">
              <div className="def-card">
                <div className="label">Quality One</div>
                <h3>Innate</h3>
                <p>Primary emotions are inherited, woven into the body from the beginning. They are part of how the human system has always met the world.</p>
              </div>
              <div className="def-card">
                <div className="label">Quality Two</div>
                <h3>Pre-Verbal</h3>
                <p>They rise in the body before language. A child reaches toward a flame and the body pulls back in fear, long before any thought has formed. The body knew first.</p>
              </div>
            </div>

            <h3 className="sub-heading">The Five Primary <em>Emotions</em></h3>
            <p className="sub-sub">Each carries its own intelligence. Each is part of how you orient and care for yourself.</p>

            <div className="five-grid">
              <div className="emotion-card">
                <div className="name-label">One</div>
                <h4>Joy</h4>
                <p>Signals what nourishes and enlivens. Moves us toward connection, play, and what is life-giving.</p>
              </div>
              <div className="emotion-card">
                <div className="name-label">Two</div>
                <h4>Anger</h4>
                <p>Signals a crossed boundary. Gives us the energy to protect, set limits, and meet injustice.</p>
              </div>
              <div className="emotion-card">
                <div className="name-label">Three</div>
                <h4>Sadness</h4>
                <p>Signals loss, disappointment, or unmet longing. Helps us slow down, grieve, and reach for support.</p>
              </div>
              <div className="emotion-card">
                <div className="name-label">Four</div>
                <h4>Fear</h4>
                <p>Signals a present threat. Awakens the energy needed to fight, flee, freeze, or fawn.</p>
              </div>
              <div className="emotion-card">
                <div className="name-label">Five</div>
                <h4>Disgust</h4>
                <p>Signals what feels harmful, violating, or misaligned. Helps us turn away from what is unsafe.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Choosing How to Meet It</div>
            <h2 className="vk-title">Healthy and Unhealthy <em>Expression</em></h2>
            <p className="vk-lede">Every emotion has a purpose. Emotions themselves are messengers. The way we express them is where the difference lies, either creating connection, clarity, and movement, or creating harm, confusion, and disconnection.</p>
            <p className="vk-body">When we can identify what we are feeling, we have more choice in how we respond. Instead of reacting automatically, we can listen to the emotion, understand what it is communicating, and express it in a way that honors both ourselves and others.</p>

            <div className="dual-grid">
              <div className="dual-card healthy">
                <div className="label">Healthy Expression</div>
                <h3>Felt, named, and honored</h3>
                <p>The emotion is noticed, the underlying need understood, and a clear, grounded response chosen.</p>
                <div className="quote-pair">
                  <div className="quote-tag">Anger sounds like</div>
                  <div className="quote-body">&ldquo;That crossed a boundary for me, and I need to talk about it.&rdquo;</div>
                </div>
                <div className="quote-pair">
                  <div className="quote-tag">Sadness sounds like</div>
                  <div className="quote-body">&ldquo;I feel hurt, and I need support.&rdquo;</div>
                </div>
              </div>
              <div className="dual-card unhealthy">
                <div className="label">Unhealthy Expression</div>
                <h3>Reactive, before being met</h3>
                <p>The emotion goes unseen, the need unspoken, and the energy moves outward as harm or inward as collapse.</p>
                <div className="quote-pair">
                  <div className="quote-tag">Anger may become</div>
                  <div className="quote-body">Yelling, blaming, shaming, or punishing.</div>
                </div>
                <div className="quote-pair">
                  <div className="quote-tag">Sadness may become</div>
                  <div className="quote-body">Collapse, helplessness, withdrawal, or using pain to ask for care.</div>
                </div>
              </div>
            </div>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>The work is to build enough awareness and capacity that the emotion can move through the body, in its own time, without unnecessary harm or drama.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">When One Emotion Hides Another</div>
            <h2 className="vk-title">Understanding <em>Secondary Emotions</em></h2>
            <p className="vk-lede">Secondary emotions are emotions that arise in response to another emotion. Instead of being the raw feeling, they are layered on top, often shaped by inherited social conditioning. Phrases like &ldquo;girls don&apos;t get angry,&rdquo; &ldquo;don&apos;t be sad,&rdquo; or &ldquo;stay positive&rdquo; teach the body which emotions are welcome and which to cover.</p>

            <div className="secondary-panel">
              <div className="label">A Familiar Pattern</div>
              <h3>What Lives <em>Beneath the Surface</em></h3>
              <p>Below are common pairings, where a primary emotion is met with a learned secondary one. Read slowly, and notice which ones the body recognizes.</p>

              <div className="secondary-rows">
                <div className="secondary-row">
                  <div className="primary">Sadness</div>
                  <div className="arrow">&rarr;</div>
                  <div className="secondary">Shame about being sad</div>
                </div>
                <div className="secondary-row">
                  <div className="primary">Fear</div>
                  <div className="arrow">&rarr;</div>
                  <div className="secondary">Anger because you feel scared</div>
                </div>
                <div className="secondary-row">
                  <div className="primary">Grief</div>
                  <div className="arrow">&rarr;</div>
                  <div className="secondary">Numbness in response to grief</div>
                </div>
                <div className="secondary-row">
                  <div className="primary">Anger</div>
                  <div className="arrow">&rarr;</div>
                  <div className="secondary">Guilt for feeling angry</div>
                </div>
                <div className="secondary-row">
                  <div className="primary">Joy</div>
                  <div className="arrow">&rarr;</div>
                  <div className="secondary">Embarrassment in response to your own desire</div>
                </div>
              </div>
            </div>

            <div className="gentle-pull-light">
              <div className="label">A Reflection</div>
              <p>What emotions had no safe place in your home as you were growing up?</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">Learned Strategies of Protection</div>
            <h2 className="vk-title">Emotional <em>Coping Patterns</em></h2>
            <p className="vk-lede">Emotional coping patterns are learned dynamics where we express one emotion in place of another. Over time, they become repetitive ways we protect ourselves, get our needs met, or influence others, often without realizing it.</p>
            <p className="vk-body">When sadness had no safe place to land growing up, the body may have learned to lead with anger instead, because that felt safer or gave a sense of control. In adulthood, the original emotion remains unmet, and the pattern repeats.</p>

            <div className="pattern-chain">
              <div className="label">An Example</div>
              <h3>How a Pattern <em>Repeats</em></h3>
              <p className="scenario">Someone feels sad that their partner has been distant. Their internal experience may surface as anger and criticism, rather than the vulnerability of sadness and the longing for closeness underneath.</p>

              <div className="chain-link">
                <div className="step-num">I</div>
                <div className="link-text">Sadness arises in the body</div>
              </div>
              <div className="chain-link">
                <div className="step-num">II</div>
                <div className="link-text">Sadness feels unsafe to feel directly</div>
              </div>
              <div className="chain-link">
                <div className="step-num">III</div>
                <div className="link-text">Anger or irritation appears in its place</div>
              </div>
              <div className="chain-link">
                <div className="step-num">IV</div>
                <div className="link-text">Criticism reaches outward, toward the partner</div>
              </div>
              <div className="chain-link">
                <div className="step-num">V</div>
                <div className="link-text">Connection is missed</div>
              </div>
              <div className="chain-link">
                <div className="step-num">VI</div>
                <div className="link-text">Sadness remains unmet, and the pattern repeats</div>
              </div>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">When the Body Carries Too Much</div>
            <h2 className="vk-title">When Emotion <em>Stays Held</em></h2>
            <p className="vk-lede">When emotions are chronically held in, the system stays in the language of protection longer than is needed. Over time, this prolonged stress can shape both physical and mental wellbeing.</p>

            <p className="vk-body" style={{ marginTop: 20 }}>Emotions held over time may show themselves as:</p>

            <div className="symptom-grid">
              <div className="symptom-card">Addiction</div>
              <div className="symptom-card">Depression</div>
              <div className="symptom-card">Anxiety</div>
              <div className="symptom-card">Lethargy</div>
              <div className="symptom-card">Sleeping problems</div>
              <div className="symptom-card">Immune dysfunction</div>
              <div className="symptom-card">Hormone dysregulation</div>
              <div className="symptom-card">Cardiovascular strain</div>
              <div className="symptom-card">Compulsive behaviors</div>
              <div className="symptom-card">Chronic fatigue</div>
              <div className="symptom-card">Emotional outbursts</div>
              <div className="symptom-card">Less access to joy and intimacy</div>
            </div>

            <h3 className="sub-heading">A Three-Step <em>Inner Practice</em></h3>
            <p className="sub-sub">A progression for meeting an emotion that has been waiting to be heard.</p>

            <div className="flow">
              <div className="flow-step">
                <div className="roman">I</div>
                <div>
                  <h3>Identify the Sensation</h3>
                  <div className="prompt">&ldquo;What is happening in my body right now?&rdquo;</div>
                  <p>Pause. Turn inward. Let the body show you where the feeling lives, before the mind names it.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">II</div>
                <div>
                  <h3>Identify the Emotion</h3>
                  <div className="prompt">&ldquo;Which primary emotion is asking to be felt?&rdquo;</div>
                  <p>Notice which of the five is closest. Sometimes more than one is present. Let yourself land on what is truest.</p>
                </div>
              </div>
              <div className="flow-step">
                <div className="roman">III</div>
                <div>
                  <h3>Show the Body It Is Safe</h3>
                  <div className="prompt">&ldquo;I am here. You are safe to feel this.&rdquo;</div>
                  <p>Stay in regulation and safe connection while the emotion moves. The body learns, gently, that this feeling is something it can hold.</p>
                </div>
              </div>
            </div>

            <div className="gentle-pull-light">
              <div className="label">A PNE Reframe</div>
              <p>Held emotion is a body waiting to be heard. When repressed emotion can be safely felt and expressed, the system completes what it has been holding all along.</p>
            </div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="vk-eyebrow">In the Medicine</div>
            <h2 className="vk-title">Emotions in Your <em>Iboga Journey</em></h2>
            <p className="vk-lede">Iboga has a way of softening the patterns and strategies that have kept certain feelings buried. Emotional layers, memories, and long-held beliefs become more visible. Grief, fear, anger, tenderness, love, or insight that have been waiting may rise into the light.</p>

            <div className="iboga-panel">
              <div className="label">What May Arise</div>
              <h3>Emotions Becoming <em>Visible</em></h3>
              <p className="intro">For someone whose system has relied on substances, compulsive patterns, or other forms of distance to hold pain at bay, iboga can create an opening where the feeling beneath the pattern finally has space to be met.</p>

              <div className="iboga-cols">
                <div className="iboga-col">
                  <h4>During the experience</h4>
                  <ul className="iboga-list">
                    <li>Long-held emotion rising with clarity and depth</li>
                    <li>Defensive patterns softening, allowing what was held to be felt</li>
                    <li>Memories, beliefs, and old wounds becoming more visible</li>
                    <li>Primary emotions emerging from beneath habitual reactions</li>
                  </ul>
                </div>
                <div className="iboga-col">
                  <h4>What this can feel like</h4>
                  <ul className="iboga-list">
                    <li>Waves of grief, fear, tenderness, or relief</li>
                    <li>Insight into the patterns you have been carrying</li>
                    <li>An openness that can surprise you</li>
                    <li>An invitation to meet what has been waiting</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="gentle-pull">Iboga acts less as an emotional eraser and more as a revealer. The somatic awareness you are building now becomes the ground that lets these revelations land in a way that creates lasting change.</div>
          </div>
        </section>

        <section className="vk-section">
          <div className="vk-narrow">
            <div className="homework-panel">
              <div className="hp-eyebrow">Week Four · Living Practice</div>
              <h2>This Week&apos;s <em>Practice</em></h2>
              <p className="lede">Three invitations to deepen your relationship with emotion. Approach each with curiosity. The body has been waiting to be heard.</p>

              <div className="hw-step">
                <div className="hw-num">One</div>
                <h3>Continue your regulation and sensation practices.</h3>
                <div className="hw-tags">4 / 7 / 8 Breath &nbsp;·&nbsp; Grounding &nbsp;·&nbsp; Felt-Sense Tracking</div>
                <p className="reflection">Return to the practices of Weeks One through Three. They are the soil in which emotional awareness can grow.</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Two</div>
                <h3>Reflection</h3>
                <p className="reflection">When you feel anger, what sensations arise in your body? When you feel sadness? When you feel fear?</p>
                <p className="reflection">What emotions had no safe place at home as you were growing up?</p>
                <p className="reflection">What did your parents, directly or indirectly, teach you about feeling?</p>
              </div>

              <div className="hw-step">
                <div className="hw-num">Three</div>
                <h3>Practice naming the layers.</h3>
                <p className="reflection">When a strong reaction arises this week, pause. Name the sensation, then the emotion, then the story. Notice which primary emotion sits beneath the secondary one. The pattern often softens once it has been seen.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-band">
          <div className="vk-wrap">
            <div className="closing-eyebrow">The Heart of the Practice</div>
            <h2>Emotions are messengers. <em>You are learning to listen.</em></h2>
            <p>Every feeling that arises is the body speaking. The work of this week is to meet emotion as it is, to let it move, and to trust that the more clearly you hear yourself, the more truly you can live.</p>
          </div>
        </section>

        <PneGuideFooter />
      </div>
    </>
  );
}
