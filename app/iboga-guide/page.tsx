"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function IbogaGuidePage() {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem("guide_access") === "true") {
      setAllowed(true);
    } else {
      router.replace("/iboga-journey");
    }
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove("hidden"); e.target.classList.add("visible"); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => { el.classList.add("hidden"); observer.observe(el); });
    return () => observer.disconnect();
  }, [allowed]);

  if (!allowed) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENT }} />
      <div dangerouslySetInnerHTML={{ __html: BODY_CONTENT }} />
    </>
  );
}

const CSS_CONTENT = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --forest: #1C2B1E;
  --deep: #0E1A10;
  --sage: #7A9E7E;
  --sage-light: #A8C5AC;
  --gold: #C8A96E;
  --gold-light: #E2CFA0;
  --cream: #F5F0E8;
  --warm-white: #FDFBF7;
  --stone: #8B8070;
  --text-dark: #1A1A18;
  --text-mid: #3D3D38;
  --border: rgba(28,43,30,0.09);
}
html { scroll-behavior: smooth; }
body { font-family: 'Jost', sans-serif; font-weight: 300; background: var(--warm-white); color: var(--text-dark); overflow-x: hidden; }

.cover {
  min-height: 100vh; background: var(--deep);
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 64px 80px; position: relative; overflow: hidden;
}
.cover::before { content: ''; position: absolute; top: -240px; right: -200px; width: 720px; height: 720px; background: radial-gradient(circle, rgba(122,158,126,0.07) 0%, transparent 65%); pointer-events: none; }
.cover::after { content: ''; position: absolute; bottom: -80px; left: -80px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(200,169,110,0.05) 0%, transparent 70%); pointer-events: none; }
.cover-header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.cover-logo { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-weight: 300; letter-spacing: 0.32em; text-transform: uppercase; color: rgba(245,240,232,0.6); text-decoration: none; }
.cover-tag { font-size: 8.5px; letter-spacing: 0.4em; text-transform: uppercase; color: var(--gold); border: 1px solid rgba(200,169,110,0.2); padding: 7px 18px; text-decoration: none; transition: border-color 0.3s; cursor: pointer; }
.cover-tag:hover { border-color: var(--gold); }
.cover-main { position: relative; z-index: 1; padding: 48px 0 0; }
.cover-eyebrow { font-size: 9px; letter-spacing: 0.44em; text-transform: uppercase; color: var(--sage-light); display: block; margin-bottom: 28px; }
.cover-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(72px, 11vw, 136px); font-weight: 300; color: var(--cream); line-height: 0.88; letter-spacing: -0.015em; margin-bottom: 40px; }
.cover-title em { font-style: italic; color: var(--sage-light); display: block; }
.cover-subtitle { font-size: 16px; color: rgba(245,240,232,0.52); line-height: 1.9; max-width: 520px; font-weight: 300; }
.cover-footer { display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 1; padding-top: 56px; border-top: 1px solid rgba(200,169,110,0.1); }
.cover-botanical { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-style: italic; color: rgba(245,240,232,0.55); }
.cover-footer-right { text-align: right; }
.cover-footer-right p { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(245,240,232,0.6); line-height: 1.9; }

.section { padding: 64px 80px; border-bottom: 1px solid var(--border); }
.section-cream { background: #F3EEE6; }
.section-warm { background: var(--warm-white); }
.section-forest { background: var(--forest); border-bottom-color: rgba(255,255,255,0.04); }
.section-deep { background: var(--deep); border-bottom-color: rgba(255,255,255,0.03); }

.eyebrow { font-size: 8.5px; letter-spacing: 0.44em; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 16px; }
.section-heading { font-family: 'Cormorant Garamond', serif; font-size: clamp(34px, 4vw, 54px); font-weight: 300; color: var(--text-dark); line-height: 1.05; margin-bottom: 12px; }
.section-heading em { font-style: italic; color: var(--sage); }
.section-forest .section-heading, .section-deep .section-heading { color: var(--cream); }
.section-forest .section-heading em, .section-deep .section-heading em { color: var(--sage-light); }
.section-intro { font-size: 15.5px; color: var(--text-mid); line-height: 1.95; max-width: 680px; margin-bottom: 32px; }
.section-forest .section-intro, .section-deep .section-intro { color: rgba(245,240,232,0.58); }
.body-text { font-size: 14.5px; color: var(--text-mid); line-height: 2.0; max-width: 700px; margin-bottom: 22px; }
.section-forest .body-text, .section-deep .body-text { color: rgba(245,240,232,0.62); }

.pull-quote { border-left: 2px solid var(--gold); padding: 16px 28px; margin: 16px 0; max-width: 640px; }
.pull-quote p { font-family: 'Cormorant Garamond', serif; font-size: 21px; font-weight: 300; font-style: italic; color: var(--text-dark); line-height: 1.5; margin-bottom: 8px; }
.pull-quote cite { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-mid); font-style: normal; font-weight: 500; }
.section-forest .pull-quote p, .section-deep .pull-quote p { color: var(--cream); }
.section-forest .pull-quote cite, .section-deep .pull-quote cite { color: var(--sage-light); }

.whom-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.whom-card { background: white; border: 1px solid var(--border); padding: 16px 18px; position: relative; }
.whom-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--sage); }
.whom-num { display: none; }
.whom-title { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 400; color: var(--text-dark); margin-bottom: 4px; line-height: 1.2; }
.whom-body { font-size: 12px; color: var(--stone); line-height: 1.7; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
.two-col-wide { display: grid; grid-template-columns: 1.2fr 1fr; gap: 72px; align-items: start; }

.research-block { background: rgba(122,158,126,0.06); border: 1px solid rgba(122,158,126,0.18); padding: 36px 40px; max-width: 760px; margin: 0 0 16px 0; }
.research-label { font-size: 8px; letter-spacing: 0.38em; text-transform: uppercase; color: var(--sage); display: block; margin-bottom: 10px; }
.research-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; color: var(--text-dark); margin-bottom: 14px; }
.research-stat { display: flex; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(28,43,30,0.06); }
.research-stat:last-child { border-bottom: none; }
.research-stat-num { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 300; color: var(--sage); flex-shrink: 0; line-height: 1; }
.research-stat-label { font-size: 13px; color: var(--text-mid); line-height: 1.6; }

.works-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.works-card { background: white; border: 1px solid var(--border); padding: 30px 28px; }
.works-card-eyebrow { font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 8px; }
.works-card-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; color: var(--text-dark); margin-bottom: 10px; line-height: 1.2; }
.works-card-body { font-size: 13px; color: var(--stone); line-height: 1.85; }

.resource-list { display: flex; flex-direction: column; }
.resource-item { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(28,43,30,0.06); align-items: start; }
.resource-item:last-child { border-bottom: none; }
.resource-label { font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--stone); padding-top: 2px; }
.resource-title { font-size: 13px; color: var(--text-dark); font-weight: 400; margin-bottom: 2px; }
.resource-desc { font-size: 11.5px; color: var(--stone); line-height: 1.6; }

.cta-block { max-width: 680px; margin: 0 auto; text-align: center; }
.cta-heading { font-family: 'Cormorant Garamond', serif; font-size: clamp(38px, 4.5vw, 60px); font-weight: 300; color: var(--cream); line-height: 1.05; margin-bottom: 20px; }
.cta-heading em { font-style: italic; color: var(--sage-light); }
.cta-body { font-size: 15px; color: rgba(245,240,232,0.55); line-height: 1.9; margin-bottom: 40px; }
.cta-btn { display: inline-block; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--forest); background: var(--gold); padding: 18px 52px; text-decoration: none; transition: background 0.3s; }
.cta-btn:hover { background: var(--gold-light); }
.cta-sub { display: block; margin-top: 18px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(245,240,232,0.55); }

.guide-footer { background: var(--deep); padding: 48px 80px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(200,169,110,0.07); }
.footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 17px; letter-spacing: 0.18em; color: var(--cream); text-transform: uppercase; font-weight: 300; }
.guide-footer p { font-size: 11.5px; color: rgba(245,240,232,0.55); line-height: 1.85; text-align: right; }
.guide-footer a { color: rgba(200,169,110,0.35); text-decoration: none; }
.disclaimer { background: var(--deep); border-top: 1px solid rgba(200,169,110,0.06); padding: 28px 80px; }
.disclaimer p { font-size: 11.5px; color: rgba(245,240,232,0.55); line-height: 1.85; max-width: 860px; }

.reveal { opacity: 1; }
.reveal.visible { opacity: 1; }

@media print {
  html, body { background: #F3EEE6; }
  .cover { page-break-after: always; min-height: 100vh; }
  .section { page-break-before: always; padding-top: 52px !important; padding-bottom: 52px !important; }
  .section-forest { padding-top: 64px; padding-bottom: 64px; }
  .two-col { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 40px !important; }
  .two-col-wide { display: grid !important; grid-template-columns: 1.2fr 1fr !important; gap: 40px !important; }
  .works-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
  .works-card { padding: 18px 20px !important; }
  .works-card-title { font-size: 18px !important; margin-bottom: 6px !important; }
  .works-card-body { font-size: 12px !important; line-height: 1.7 !important; }
  .whom-card, .works-card, .research-block, .pull-quote, .resource-item { page-break-inside: avoid; }
  .guide-footer, .disclaimer { page-break-before: auto; }
  .choosing-section { padding-top: 32px !important; padding-bottom: 32px !important; }
  .choosing-section .section-intro { font-size: 13px !important; line-height: 1.75 !important; margin-bottom: 20px !important; }
  .choosing-section h3 { font-size: 17px !important; margin-bottom: 6px !important; }
  .choosing-section .body-text { font-size: 12px !important; line-height: 1.7 !important; margin-bottom: 14px !important; }
  .choosing-section > div { gap: 32px !important; }
  .choosing-section .choosing-col > div { margin-bottom: 16px !important; }
}

@media (max-width: 1024px) {
  .cover { padding: 48px 44px; }
  .section { padding: 72px 44px; }
  .whom-grid { grid-template-columns: 1fr 1fr; }
  .two-col, .two-col-wide { grid-template-columns: 1fr; gap: 40px; }
  .works-grid { grid-template-columns: 1fr; }
  .guide-footer { padding: 40px 44px; flex-direction: column; gap: 18px; }
  .guide-footer p { text-align: center; }
  .disclaimer { padding: 24px 44px; }
}
@media (max-width: 640px) {
  .cover { padding: 36px 28px; }
  .section { padding: 60px 28px; }
  .whom-grid { grid-template-columns: 1fr; }
  .resource-item { grid-template-columns: 1fr; gap: 6px; }
  .guide-footer, .disclaimer { padding: 32px 28px; }
}
`;

const BODY_CONTENT = `

<div class="cover">
  <div class="cover-header">
    <a href="/" class="cover-logo">Vital Kauaʻi</a>
    <a href="/iboga-guide-free.pdf" download class="cover-tag">Download Free Resource</a>
  </div>
  <div class="cover-main">
    <span class="cover-eyebrow">Africa's Sacred Healing Plant · An Introduction</span>
    <h1 class="cover-title">Iboga<em>& You</em></h1>
    <p class="cover-subtitle">An honest, grounded introduction to iboga, what it is, where it comes from, what it heals, and what it asks of you.</p>
  </div>
  <div class="cover-footer">
    <span class="cover-botanical">Tabernanthe iboga</span>
    <div class="cover-footer-right">
      <p>Prepared by Vital Kauaʻi<br>Kauaʻi, Hawaiʻi · 2026<br>For educational purposes</p>
    </div>
  </div>
</div>

<!-- IS THIS FOR YOU -->
<section class="section section-warm">
  <span class="eyebrow" style="margin-bottom:8px;">A Note Before You Begin</span>
  <h2 class="section-heading" style="margin-bottom:8px;">This Guide Is <em>For You</em></h2>
  <p class="section-intro" style="margin-bottom:16px;font-size:14.5px;line-height:1.75;">Iboga is often spoken about in the context of deep healing and personal transformation. That conversation matters, and it reaches only a fraction of what this plant offers. The people most called to work with iboga at Vital Kauaʻi tend to recognize themselves here.</p>

  <div class="whom-grid reveal">
    <div class="whom-card">
      <p class="whom-num">01</p>
      <h3 class="whom-title">Feeling the ceiling</h3>
      <p class="whom-body">Life is good on the surface, and something essential is still missing. A sense of living below your full capacity, circling the same patterns, knowing there is more.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">02</p>
      <h3 class="whom-title">Anxiety &amp; depression</h3>
      <p class="whom-body">Carrying weight that conventional approaches have partially addressed. A readiness to go to the root and resolve it completely, and to come home to yourself on the other side.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">03</p>
      <h3 class="whom-title">Loops ready to break</h3>
      <p class="whom-body">Relational patterns, ways of thinking, coping strategies that once served and have long since run their course. A genuine desire to step out of the story and into something new.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">04</p>
      <h3 class="whom-title">Creative stagnation</h3>
      <p class="whom-body">Artists, entrepreneurs, and visionaries who sense their deepest creative source has been inaccessible, and who want to reclaim it. Iboga opens channels that have been closed for years.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">05</p>
      <h3 class="whom-title">Coming into alignment</h3>
      <p class="whom-body">A felt sense that your life as it is and your life as it is meant to be are out of step. A deep pull toward clarity, purpose, and living from a truer version of yourself.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">06</p>
      <h3 class="whom-title">Ready for a real reset</h3>
      <p class="whom-body">The ordinary tools, therapy, retreats, practices, have moved the needle and a deeper intervention is calling. A willingness to go somewhere most people leave unexplored.</p>
    </div>
    <div class="whom-card">
      <p class="whom-num">07</p>
      <h3 class="whom-title">Neurogenesis &amp; cognitive enhancement</h3>
      <p class="whom-body">Those seeking to sharpen clarity, expand cognitive capacity, and stimulate new neural growth. Iboga is one of the most potent known stimulators of BDNF and GDNF, the brain's primary regenerative proteins, opening a neuroplasticity window that continues deepening for weeks after ceremony.</p>
    </div>
  </div>

  <div class="pull-quote">
    <p>"Imagine waking up on the other side, clearer, freer, more yourself than you have ever been."</p>
    <cite>Vital Kauaʻi · The Iboga Journey</cite>
  </div>
</section>

<!-- WHAT IS IBOGA -->
<section class="section section-cream">
  <span class="eyebrow">The Plant</span>
  <h2 class="section-heading">What Is <em>Iboga?</em></h2>

  <div class="two-col-wide">
    <div>
      <p class="body-text">Iboga, formally known as <em>Tabernanthe iboga</em>, is a perennial rainforest shrub native to the equatorial forests of Gabon, Cameroon, and Central West Africa. Its root bark contains a rich constellation of alkaloids that produce profound effects on the human brain, nervous system, and psyche. A whole plant with a living intelligence, it has been worked with by traditional practitioners across hundreds of generations.</p>
      <p class="body-text">At Vital Kauaʻi, we work exclusively with whole-plant iboga root bark, the full living intelligence of the plant, titrated consciously and in continuous dialogue with your body. Your ceremony is held in living relationship with the land, water, and forest of Kauaʻi's North Shore, nature as active participant.</p>
    </div>
    <div>
      <div class="pull-quote" style="margin-top:0;">
        <p>"Iboga gives you what you need."</p>
        <cite>Bwiti saying · Gabon</cite>
      </div>
      <p class="body-text" style="margin-top:20px;">The Pygmy tribes of Gabon and Cameroon are widely recognized as the original discoverers of iboga's healing and visionary properties, passing this knowledge to the Bwiti across countless generations. The Bwiti understand the plant as a being, a teacher with intelligence and the capacity to perceive exactly what each person needs. The medicine shows you the truth of your life. The clearer you arrive, the deeper it goes.</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;">
    <div style="background:rgba(122,158,126,0.07);border:1px solid rgba(122,158,126,0.18);border-left:3px solid var(--sage);padding:16px 20px;">
      <span style="font-size:7.5px;letter-spacing:0.34em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:8px;">What We Work With</span>
      <p style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:400;color:var(--text-dark);margin-bottom:6px;">Whole-Plant Root Bark</p>
      <p style="font-size:12.5px;color:var(--text-mid);line-height:1.8;">The full inner bark contains over 12 identified alkaloids working in concert, ibogaine, noribogaine, ibogamine, tabernanthine, and others. Together they create an entourage effect no isolated compound can replicate. The onset is slower, more titrated, and the spirit of the plant arrives whole. This is a deliberate choice rooted in deep respect for the tradition.</p>
    </div>
    <div style="background:rgba(122,158,126,0.07);border:1px solid rgba(122,158,126,0.18);border-left:3px solid var(--sage);padding:16px 20px;">
      <span style="font-size:7.5px;letter-spacing:0.34em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:8px;">For Context</span>
      <p style="font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:400;color:var(--text-dark);margin-bottom:6px;">Isolated Ibogaine</p>
      <p style="font-size:12.5px;color:var(--text-mid);line-height:1.8;">The single primary alkaloid extracted from the root bark, used in Western clinical settings, including the landmark Stanford study. Measurable and standardized. We honor this research fully. Its onset is faster and more intense, requiring the highest level of cardiac monitoring. What it carries is the alkaloid. What it leaves behind is everything else the plant holds.</p>
    </div>
  </div>
</section>

<!-- BWITI -->
<section class="section section-forest">
  <span class="eyebrow">The Tradition</span>
  <h2 class="section-heading">Iboga &amp; <em>The Bwiti</em></h2>
  <p class="section-intro">To understand iboga fully, one must understand the Bwiti, the spiritual tradition within which iboga has been held for centuries as its central sacrament. It is a living tradition of initiation, healing, community, and connection to the spirit world and one's ancestors.</p>

  <div class="two-col">
    <div>
      <p class="body-text">The Bwiti is practiced primarily by the Fang, Mitsogo, and Punu peoples of Gabon and Cameroon. Iboga ceremonies are serious, structured, and held within a rich container of music, ritual, community, and the guidance of trained healers called Ngangas, who spend years or decades working with the plant before guiding others.</p>
      <p class="body-text">Gabon is the only country in the world where iboga is legally protected as national heritage and cultural treasure. The Gabonese government recognizes the Bwiti tradition and iboga's sacred status in law.</p>
      <p class="body-text">Perhaps the most essential thing to understand: the Bwiti experience iboga as a being, a plant teacher with intelligence and intention. It shows the truth of your life. The clearer you arrive, the deeper it goes. The more open your hands, the more the medicine can place in them.</p>
    </div>
    <div>
      <p class="body-text">Josh Perdue, co-founder of Vital Kauaʻi, has spent time in Gabon in deep relationship with the plant and the people who have carried it for generations. That reverence, for the land, the medicine, and the wisdom traditions that have held iboga across millennia, is woven into everything we do.</p>
      <p class="body-text">We bring this reverence into our work on the North Shore of Kauaʻi, allowing African initiatory wisdom to inspire the container while remaining grounded in our own ceremonial path. The ceremony opens around the fire. The medicine meets you in the dark. And the land of Kauaʻi holds everything.</p>
      <div class="pull-quote" style="border-left-color:var(--sage-light);">
        <p>"Ceremony opens around a sacred fire, drawing on the wisdom of those who have carried iboga for thousands of years, where fire illuminates what is ready to be released and calls in what wants to arrive."</p>
        <cite>Vital Kauaʻi · The Iboga Journey</cite>
      </div>
    </div>
  </div>

</section>

<!-- WHAT IT WORKS ON -->
<section class="section section-warm">
  <span class="eyebrow">The Healing</span>
  <h2 class="section-heading">What Iboga <em>Works On</em></h2>
  <p class="section-intro" style="margin-bottom:16px;">Iboga works across the full architecture of the self, neural, somatic, emotional, and spiritual. These are the domains where people experience the most profound and lasting change.</p>

  <div class="works-grid reveal">
    <div class="works-card">
      <span class="works-card-eyebrow">Depression &amp; Anxiety</span>
      <h3 class="works-card-title">Going to the Root</h3>
      <p class="works-card-body">Participants frequently describe emerging from ceremony with a sense that heavy emotional weight has genuinely lifted, resolved at the root. Many people report a fundamental shift in how they relate to longstanding patterns of heaviness, worry, or disconnection.</p>
    </div>
    <div class="works-card">
      <span class="works-card-eyebrow">Neuroplasticity &amp; Rewiring</span>
      <h3 class="works-card-title">The Brain's Reset Window</h3>
      <p class="works-card-body">In the weeks following ceremony, iboga opens a critical window of heightened neuroplasticity, a period when the brain is exceptionally receptive to new patterns, habits, and perspectives. Iboga stimulates BDNF and GDNF, two key brain-repair proteins that drive neural growth and connectivity. This is where lasting change takes root.</p>
    </div>
    <div class="works-card">
      <span class="works-card-eyebrow">Loops &amp; Patterns</span>
      <h3 class="works-card-title">Breaking the Cycle</h3>
      <p class="works-card-body">Iboga surfaces the emotional and psychological patterns driving repetitive behavior, and creates the conditions for them to be directly encountered, processed, and released. People often describe seeing their patterns with clarity and compassion for the first time, and finding them simply lose their grip.</p>
    </div>
    <div class="works-card">
      <span class="works-card-eyebrow">Creativity &amp; Purpose</span>
      <h3 class="works-card-title">The Source Reopened</h3>
      <p class="works-card-body">Artists, entrepreneurs, and visionaries consistently report that iboga restored access to a creative source they had lost contact with. The medicine dissolves the stories we tell ourselves about what is possible, and in the space that opens, genuine vision returns. Many people describe reconnecting with the self they always were.</p>
    </div>
    <div class="works-card">
      <span class="works-card-eyebrow">Somatic Healing</span>
      <h3 class="works-card-title">What Lives in the Body</h3>
      <p class="works-card-body">Iboga reaches into the somatic layer, where unprocessed experience lives in the body, and supports the release of long-held emotional and energetic imprints. This is why we weave somatic support throughout every phase of your journey, before, during, and after ceremony.</p>
    </div>
    <div class="works-card">
      <span class="works-card-eyebrow">Alignment &amp; Clarity</span>
      <h3 class="works-card-title">Coming Home to Yourself</h3>
      <p class="works-card-body">Perhaps the most universal report from iboga participants: a felt sense of return. A reconnection, to self, to others, to life itself, that those living below their potential describe as profoundly reorienting. The medicine restores the thread back to who you actually are.</p>
    </div>
  </div>
</section>

<!-- THE RESEARCH -->
<section class="section section-cream" style="page-break-after:always;">
  <span class="eyebrow">The Science</span>
  <h2 class="section-heading">What the Research <em>Shows</em></h2>
  <p class="section-intro">Iboga has attracted serious scientific attention in recent years, and the results emerging from clinical research represent paradigm shifts. What follows is some of the most significant data in the history of plant medicine science, signaling a fundamental change in how medicine understands what is possible for the human brain and nervous system.</p>

  <p class="body-text" style="max-width:760px;">The clinical research on iboga stands apart in modern psychiatry, remarkable for the magnitude of its results. These are fundamental shifts in how human beings experience themselves. The study below, led by Stanford neuropsychiatrist Dr. Nolan Williams, has become a landmark in the emerging science of plant medicine.</p>

  <div class="research-block reveal" style="page-break-after:always;">
    <span class="research-label">Stanford University · Nature Medicine · 2023</span>
    <h3 class="research-title">Special Operations Forces Veterans · Treatment-Resistant PTSD &amp; TBI</h3>
    <p class="body-text" style="margin-bottom:20px;max-width:100%;">In a landmark 2023 study published in <em>Nature Medicine</em>, Special Operations Forces veterans with treatment-resistant PTSD, traumatic brain injury, or both received iboga-assisted treatment. The outcomes were extraordinary, and the lead researcher's response said everything.</p>
    <div class="research-stat"><span class="research-stat-num">88%</span><span class="research-stat-label">average reduction in PTSD symptom severity at one-month follow-up</span></div>
    <div class="research-stat"><span class="research-stat-num">80%</span><span class="research-stat-label">reduction in depression scores across the participant group</span></div>
    <div class="research-stat"><span class="research-stat-num">↑</span><span class="research-stat-label">Measurable improvement in cognitive performance, suggesting genuine neurological restoration, alongside psychological effects</span></div>
    <div class="research-stat"><span class="research-stat-num" style="font-size:22px;">"</span><span class="research-stat-label" style="font-style:italic;">This is the most dramatic thing I have ever seen in a clinical trial.<br><span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--stone);font-style:normal;">— Dr. Nolan Williams, Stanford University School of Medicine</span></span></div>
    <p style="font-size:12px;color:var(--stone);line-height:1.8;margin-top:18px;font-style:italic;">Dr. Nolan Williams, triple board-certified neuropsychiatrist, Director of the Stanford Brain Stimulation Lab, and the pioneering force behind ibogaine's most significant clinical research, passed away in 2025. His work changed what medicine believes is possible. We honor him here.</p>
  </div>

  <div class="two-col" style="margin-top:24px;">
    <div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--text-dark);margin-bottom:12px;">Memory <em style="font-style:italic;color:var(--sage);">Reconsolidation</em></h3>
      <p class="body-text">Iboga appears to facilitate memory reconsolidation, the neurological process by which memories, when re-accessed, become briefly malleable and can be restructured. This is why the experience frequently surfaces buried memories in a way that is vivid and yet somehow more workable than before, allowing genuine processing and integration to occur at depth. The memory integrates fully; it loses its charge.</p>
    </div>
    <div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--text-dark);margin-bottom:12px;">The Research <em style="font-style:italic;color:var(--sage);">Landscape</em></h3>
      <p class="body-text">A 2022 systematic review published in peer-reviewed literature analyzed 24 studies involving 705 participants and found consistent evidence that ibogaine and noribogaine hold significant potential, noting effects on mood, patterns of compulsion, psychological wellbeing, and long-term neurological function.</p>
      <p class="body-text">In 2025, the state of Texas allocated $50 million to fund dedicated clinical ibogaine research, one of the largest public investments in plant medicine science in history.</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px;">
    <div style="background:var(--warm-white);border:1px solid var(--border);border-top:2px solid var(--sage);padding:52px 22px;">
      <span style="font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:8px;">Noribogaine</span>
      <h4 style="font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:400;color:var(--text-dark);margin-bottom:10px;line-height:1.2;">The Medicine That Keeps Working</h4>
      <p style="font-size:12.5px;color:var(--stone);line-height:1.8;">Iboga's primary metabolite, noribogaine, remains detectable in body tissue for 2–3 months post-ceremony, continuing its neurological repair and mood-stabilizing work throughout. It stands singular among plant medicines and psychedelics in this sustained residual mechanism of duration and depth.</p>
    </div>
    <div style="background:var(--warm-white);border:1px solid var(--border);border-top:2px solid var(--sage);padding:52px 22px;">
      <span style="font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:8px;">Brain States</span>
      <h4 style="font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:400;color:var(--text-dark);margin-bottom:10px;line-height:1.2;">The Fetal Brain State</h4>
      <p style="font-size:12.5px;color:var(--stone);line-height:1.8;">EEG research has documented that iboga produces brainwave patterns characteristic of fetal sleep, the most neuroplastic state the brain ever occupies. Researchers describe this as a recreation of fetal brain states in waking adults, opening a window of neurological possibility that is unprecedented in any known medicine.</p>
    </div>
    <div style="background:var(--warm-white);border:1px solid var(--border);border-top:2px solid var(--sage);padding:52px 22px;">
      <span style="font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:8px;">Durability · Schenberg 2014</span>
      <h4 style="font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:400;color:var(--text-dark);margin-bottom:10px;line-height:1.2;">Single-Dose, Lasting Change</h4>
      <p style="font-size:12.5px;color:var(--stone);line-height:1.8;">A clinical study of 75 participants found that a single iboga ceremony shifted the average time free of unwanted patterns from 88 days before ceremony to 299 days after, and 419 days across all sessions. From one experience.</p>
    </div>
  </div>
</section>

<!-- COMPARISON -->
<section class="section section-cream" style="page-break-before:always;">
  <span class="eyebrow">How Iboga Differs</span>
  <h2 class="section-heading">Iboga, Ayahuasca, Psilocybin<br>&amp; <em>Ketamine</em></h2>
  <p class="section-intro">Interest in plant medicine and expanded states of consciousness is growing rapidly. People often arrive curious about how iboga compares to other medicines they've heard of, and the differences are significant. Understanding them helps you know whether iboga is the right threshold for you.</p>

  <div style="overflow-x:auto;margin-bottom:36px;">
    <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:12.5px;">
      <thead>
        <tr style="border-bottom:2px solid rgba(28,43,30,0.12);">
          <th style="text-align:left;padding:12px 16px;font-size:8.5px;letter-spacing:0.32em;text-transform:uppercase;color:var(--stone);font-weight:400;width:18%;"></th>
          <th style="text-align:left;padding:12px 16px;font-size:8.5px;letter-spacing:0.32em;text-transform:uppercase;color:var(--gold);font-weight:400;width:22%;">Iboga</th>
          <th style="text-align:left;padding:12px 16px;font-size:8.5px;letter-spacing:0.32em;text-transform:uppercase;color:var(--stone);font-weight:400;width:20%;">Ayahuasca</th>
          <th style="text-align:left;padding:12px 16px;font-size:8.5px;letter-spacing:0.32em;text-transform:uppercase;color:var(--stone);font-weight:400;width:20%;">Psilocybin</th>
          <th style="text-align:left;padding:12px 16px;font-size:8.5px;letter-spacing:0.32em;text-transform:uppercase;color:var(--stone);font-weight:400;width:20%;">Ketamine</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Origin</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Root bark · Central West Africa</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Vine brew · Amazon Basin</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Mushroom · Global</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Synthetic · Lab-derived</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);background:rgba(28,43,30,0.02);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Duration</td>
          <td style="padding:12px 16px;color:var(--text-mid);font-weight:400;">12 – 36 hours</td>
          <td style="padding:12px 16px;color:var(--text-mid);">4 – 8 hours</td>
          <td style="padding:12px 16px;color:var(--text-mid);">4 – 6 hours</td>
          <td style="padding:12px 16px;color:var(--text-mid);">1 – 2 hours</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Primary Mechanism</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Multiple receptor systems, serotonin, NMDA, opioid, sigma, dopamine</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Serotonin (5-HT2A) via DMT + MAO inhibition</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Serotonin (5-HT2A)</td>
          <td style="padding:12px 16px;color:var(--text-mid);">NMDA antagonist · dissociative anesthetic</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);background:rgba(28,43,30,0.02);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Consciousness</td>
          <td style="padding:12px 16px;color:var(--text-dark);font-weight:400;">Fully awake and present, you remain yourself throughout</td>
          <td style="padding:12px 16px;color:var(--text-mid);">The medicine takes you where it chooses, often intense and surrendered</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Ego boundaries dissolve, reality reshapes around you</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Dissociative, you leave ordinary awareness entirely</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Inner Experience</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Observer of your own life, vivid memories, life review, insight with clarity</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Vivid visions, emotional purging, often symbolic and non-personal</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Perceptual distortion, mystical states, identity dissolution</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Detachment from self and surroundings, dream-like floating</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);background:rgba(28,43,30,0.02);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Physical Experience</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Ataxia (loss of coordination) and dizziness common; nausea and vomiting possible; lying still is essential throughout, movement worsens symptoms significantly</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Nausea, vomiting, and diarrhea ("the purge") are a defining feature; participants can generally sit and move</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Mild nausea possible early on; generally physically mobile throughout</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Dizziness; reclined but mobile; repeated use can affect the bladder</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Neuroplasticity</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Deep and extended, weeks of heightened neural growth following ceremony</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Present, shorter integration window</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Present, multiple sessions often needed</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Short-lived, effects require ongoing infusions to sustain</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(28,43,30,0.06);background:rgba(28,43,30,0.02);">
          <td style="padding:12px 16px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:var(--stone);">Ceremony Count</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Typically one ceremony holds the full arc</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Multiple ceremonies over weeks or months</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Multiple sessions typically recommended</td>
          <td style="padding:12px 16px;color:var(--text-mid);">Ongoing infusions required to maintain effects</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="background:var(--forest);padding:40px 44px;max-width:860px;page-break-inside:avoid;">
    <span style="font-size:8.5px;letter-spacing:0.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px;">The Most Important Distinction</span>
    <h3 style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--cream);line-height:1.15;margin-bottom:14px;">With iboga, <em style="font-style:italic;color:var(--sage-light);">you remain yourself.</em></h3>
    <p style="font-size:14px;color:rgba(245,240,232,0.68);line-height:1.95;margin-bottom:12px;">Ayahuasca, psilocybin, and ketamine each, in their own way, move you away from ordinary consciousness. They dissolve the ego, reshape perception, or carry you somewhere else entirely. You surrender the wheel. The medicine decides where you go.</p>
    <p style="font-size:14px;color:rgba(245,240,232,0.68);line-height:1.95;margin-bottom:12px;">Iboga is classified by researchers as an <strong style="color:var(--sage-light);font-weight:400;">oneirogen</strong>, a substance that produces dream-like states while the person remains fully awake. EEG studies confirm that iboga generates REM-sleep brainwave signatures in waking participants, a neurological phenomenon found in no other known medicine. Psychiatrist Claudio Naranjo coined the term <em style="color:rgba(245,240,232,0.82);">oneirophrenic state</em> to describe it: a conscious dreamy state where individuals remain fully open, remember everything, and possess heightened capacity for self-reflection.</p>
    <p style="font-size:14px;color:rgba(245,240,232,0.68);line-height:1.95;">You close your eyes and visions arise. Memories surface with extraordinary clarity. You witness your own life as if watching it unfold before you, scenes, patterns, moments, truths. But throughout all of it, you remain lucid, coherent, and present. Your identity stays intact. You are the observer, clear-eyed, awake, and very much yourself. This is what makes iboga unlike anything else available.</p>
    <p style="font-size:14px;color:rgba(245,240,232,0.68);line-height:1.95;margin-top:12px;">What makes iboga singular is precisely this quality of retained selfhood. You do not lose yourself in the experience, you find yourself in it. The visions and insights feel sovereign and wholly owned. You return by the clarity of what was always inside you.</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;">
    <div style="background:white;border:1px solid rgba(28,43,30,0.08);border-top:2px solid var(--sage);padding:28px 30px;">
      <span style="font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px;">What Sets Iboga Apart</span>
      <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">The physical demands of iboga, the stillness required, the body's effort to metabolize the medicine, the long hours of sustained awareness, are precisely what make it transformative. It is a medicine you meet with your full presence, and one that meets you with equal precision in return.</p>
    </div>
    <div style="background:white;border:1px solid rgba(28,43,30,0.08);border-top:2px solid var(--sage);padding:28px 30px;">
      <span style="font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px;">Who It Calls To</span>
      <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">People who have done the inner work, therapy, meditation, plant medicine, and sense that something deeper remains untouched. People ready to see themselves clearly. People willing to be still for a long time, and to meet what arises with honesty and courage.</p>
    </div>
  </div>
</section>

<!-- THE VITAL KAUAI APPROACH -->
<section class="section section-forest">
  <span class="eyebrow">How We Work</span>
  <h2 class="section-heading">The Vital Kauaʻi <em>Approach</em></h2>
  <p class="section-intro">The medicine shows you the door. We walk through it with you. This is what distinguishes deeply held ceremonial iboga work from any other healing modality available.</p>

  <div class="two-col">
    <div>
      <p class="body-text">The Vital Kauaʻi Iboga Journey begins with six weeks of dedicated preparation, body, nervous system, and inner landscape, followed by your ceremony in week seven. Integration support continues for months afterward. Every phase is held with full guidance and care. You are in ongoing relationship with your care team from the moment you say yes through the full arc of your integration.</p>
      <p class="body-text">Your ceremony is held on the sacred North Shore of Kauaʻi, in living relationship with the mana of the land, the water, and the forest. The medicine is whole-plant iboga root bark, titrated, conscious, and responsive. Sacred fire, water, music, and ancestral honoring open and hold the container, drawing on the wisdom traditions that have carried this plant for thousands of years.</p>
      <p class="body-text">This work is nature-based, somatic, and psycho-spiritual. We offer a living ceremonial container, held by people who have walked this path themselves, in a place that is itself a healer.</p>
    </div>
    <div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(200,169,110,0.12);padding:36px 32px;">
        <span style="font-size:8.5px;letter-spacing:0.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:20px;">The Journey Arc</span>
        <div style="display:flex;flex-direction:column;gap:20px;">
          <div style="display:flex;gap:18px;align-items:flex-start;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:rgba(200,169,110,0.3);line-height:1;flex-shrink:0;">01</span>
            <div><p style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--sage-light);margin-bottom:5px;">Weeks 1–6 · Preparation</p><p style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.7;">Body preparation, dietary protocol, medical screening, daily practices, and preparation calls with your care team.</p></div>
          </div>
          <div style="display:flex;gap:18px;align-items:flex-start;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:rgba(200,169,110,0.3);line-height:1;flex-shrink:0;">02</span>
            <div><p style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--sage-light);margin-bottom:5px;">Week 7 · Kauaʻi · Ceremony</p><p style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.7;">Opened at the fire, held in sacred indoor space in harmony with the land. 12–36 hours of deep work with your care team present throughout. Integration in the days that follow happens in nature, on the land, in the water, under the sky.</p></div>
          </div>
          <div style="display:flex;gap:18px;align-items:flex-start;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:28px;color:rgba(200,169,110,0.3);line-height:1;flex-shrink:0;">03</span>
            <div><p style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--sage-light);margin-bottom:5px;">Months Following · Integration</p><p style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.7;">The neuroplasticity window. Ongoing calls, somatic support, and the steady work of embodying everything that arose.</p></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- RESOURCES -->
<section class="section section-cream">
  <span class="eyebrow">Go Deeper</span>
  <h2 class="section-heading">Podcasts, Films &amp; <em>Resources</em></h2>
  <p class="section-intro" style="margin-bottom:16px;">For those who want to go deeper, these are the resources we recommend most for grounded, thoughtful exploration of iboga and its healing potential.</p>

  <div class="two-col" style="gap:40px;">
    <div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:10px;">Podcasts &amp; YouTube</h3>
      <div class="resource-list">
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Huberman Lab</span>
          <div><p class="resource-title">Dr. Andrew Huberman with Dr. Nolan Williams</p><p class="resource-desc" style="font-size:10.5px;">The Stanford PTSD study in depth. Search: "Huberman Lab ibogaine"</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">The Dr. Hyman Show</span>
          <div><p class="resource-title">One Dose That Heals Addiction, PTSD, and Brain Injury?</p><p class="resource-desc" style="font-size:10.5px;">Dr. Mark Hyman and Dr. Nolan Williams on ibogaine's brain-resetting potential.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Tim Ferriss Show</span>
          <div><p class="resource-title">Plant Medicine &amp; Veterans</p><p class="resource-desc" style="font-size:10.5px;">Multiple episodes on iboga with researchers, clinicians, and veterans. Search: "Tim Ferriss iboga"</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Keeping It Real · Jillian Michaels</span>
          <div><p class="resource-title">The Psychedelic That's Changing Lives</p><p class="resource-desc" style="font-size:10.5px;">Jillian Michaels and Bryan Hubbard on ibogaine, neuroplasticity, and healing.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Ibogaine Uncovered</span>
          <div><p class="resource-title">Dr. Alejandro Junger: Ibogaine, Neuroplasticity, and Gut Health</p><p class="resource-desc" style="font-size:10.5px;">Talia Eisenberg with Dr. Junger on the nervous system, gut-brain connection, and ibogaine.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">One-Degree Shifts · YouTube</span>
          <div><p class="resource-title">Rooted in Healing: Iboga, Bwiti, and the Path of Transformation</p><p class="resource-desc" style="font-size:10.5px;">Pascal Tremblay with Troy Valencia, Bwiti initiate and founder of Root &amp; Wisdom.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Psychedelics Today</span>
          <div><p class="resource-title">The Leading Psychedelic Science Podcast</p><p class="resource-desc" style="font-size:10.5px;">Multiple iboga episodes. psychedelicstoday.com/podcast</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Aubrey Marcus</span>
          <div><p class="resource-title">Iboga, Plant Medicine &amp; Bwiti Voices</p><p class="resource-desc" style="font-size:10.5px;">Wide-ranging conversations including voices from within the Bwiti tradition.</p></div>
        </div>
      </div>
    </div>
    <div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:10px;">Films</h3>
      <div class="resource-list">
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Documentary · 2014</span>
          <div><p class="resource-title">Ibogaine: Rite of Passage</p><p class="resource-desc" style="font-size:10.5px;">Traditional Bwiti ceremonial use alongside modern applications. Essential for understanding the cultural roots.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Documentary · 2022</span>
          <div><p class="resource-title">Dosed 2: The Trip of a Lifetime</p><p class="resource-desc" style="font-size:10.5px;">Real individuals through iboga and other plant medicines. Profoundly human and honest.</p></div>
        </div>
        <div class="resource-item" style="padding:7px 0;">
          <span class="resource-label">Documentary · 2018</span>
          <div><p class="resource-title">From Shock to Awe</p><p class="resource-desc" style="font-size:10.5px;">Combat veterans seeking healing through iboga and ayahuasca.</p></div>
        </div>
      </div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-top:20px;margin-bottom:10px;">Organizations</h3>
      <p class="body-text" style="max-width:100%;font-size:12px;line-height:1.8;">MAPS · maps.org<br>Global Ibogaine Therapy Alliance · globalibogaine.org<br>VETS · vetsolutions.org</p>
    </div>
  </div>
</section>

<!-- SAFETY -->
<section class="section section-warm">
  <span class="eyebrow">Safety &amp; Screening</span>
  <h2 class="section-heading">Iboga Asks for <em>Preparation</em></h2>
  <p class="section-intro">Iboga is a powerful and intelligent plant medicine. It asks to be approached with full preparation, thorough screening, and qualified guidance. This is part of what makes it so effective, and what we take the most seriously.</p>

  <div class="two-col">
    <div>
      <p class="body-text">Every Vital Kauaʻi Iboga Journey begins with a thorough review of your health history, current medications, and medical context. We suggest an EKG and electrolyte panel as part of your preparation, what your physician ultimately recommends based on your individual health picture guides the full screening. Our Iboga Preparedness Guide, shared with all enrolled members, walks through this in detail.</p>
      <p class="body-text">Iboga works with the heart, both literally and spiritually. Certain medications require a clearance period before ceremony. Our preparation process ensures you arrive ready, in body, nervous system, and inner landscape.</p>
      <p class="body-text">With proper preparation, qualified facilitation, and a sacred container, iboga's profile is extraordinary. We spare nothing in making sure yours is safe, held, and deeply meaningful.</p>
    </div>
    <div>
      <div style="background:var(--forest);padding:40px 36px;">
        <span style="font-size:8.5px;letter-spacing:0.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:20px;">What We Suggest · Your Doctor Guides the Rest</span>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:2px;">—</span><p style="font-size:13.5px;color:rgba(245,240,232,0.72);line-height:1.7;">EKG, cardiac function and QT interval assessment (suggested)</p></div>
          <div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:2px;">—</span><p style="font-size:13.5px;color:rgba(245,240,232,0.72);line-height:1.7;">Electrolyte panel, potassium and magnesium levels (suggested)</p></div>
          <div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:2px;">—</span><p style="font-size:13.5px;color:rgba(245,240,232,0.72);line-height:1.7;">Full medical review with your physician, additional labs as they advise</p></div>
          <div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:2px;">—</span><p style="font-size:13.5px;color:rgba(245,240,232,0.72);line-height:1.7;">Medication and supplement review, with appropriate clearance periods</p></div>
          <div style="display:flex;gap:14px;align-items:flex-start;"><span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:2px;">—</span><p style="font-size:13.5px;color:rgba(245,240,232,0.72);line-height:1.7;">Preparation calls with your care team, intention, readiness, and inner landscape work</p></div>
          <div style="display:flex;gap:14px;align-items:flex-start;margin-top:8px;"><span style="font-size:11px;color:var(--gold);flex-shrink:0;margin-top:2px;">→</span><p style="font-size:12.5px;color:rgba(245,240,232,0.45);line-height:1.7;font-style:italic;">Full detail in our Iboga Preparedness Guide, shared with all enrolled members.</p></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CHOOSING A PROVIDER -->
<section class="section section-cream choosing-section" style="page-break-inside:avoid;">
  <span class="eyebrow">Discernment</span>
  <h2 class="section-heading">Choosing the <em>Right Space</em></h2>
  <p class="section-intro">Iboga is a profound and powerful medicine. The container it is held in matters enormously. As interest in iboga grows, so does the range of people offering to hold this work. Some are deeply trained and genuinely called, others are not. Asking clear questions before you commit is an act of self-care and personal integrity.</p>

  <div class="two-col" style="gap:48px;">
    <div class="choosing-col">
      <div style="margin-bottom:28px;">
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:var(--text-dark);margin-bottom:10px;">Safety &amp; Medical Care</h3>
        <p class="body-text">A qualified provider requires full medical screening, at minimum an EKG and bloodwork, before your ceremony. Cardiac monitoring should be available throughout. Ask whether a medical professional is on-site or on-call. If a provider tells you medical screening is unnecessary, that is the answer you need.</p>
      </div>
      <div style="margin-bottom:28px;">
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:var(--text-dark);margin-bottom:10px;">Experience &amp; Lineage</h3>
        <p class="body-text">Ask how long they have worked with iboga specifically, not ibogaine, not other medicines, but this plant. Ask about their training, their lineage, their relationship with the tradition. Ask whether they work with whole-plant root bark or isolated ibogaine. A provider rooted in genuine relationship with this medicine will welcome these questions.</p>
      </div>
      <div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:400;color:var(--text-dark);margin-bottom:10px;">Preparation &amp; Integration</h3>
        <p class="body-text">Iboga without preparation and integration is incomplete. Ask what their preparation process looks like and how long it runs. Ask what integration support looks like after you return home. A ceremony is a beginning, what follows is where transformation takes root.</p>
      </div>
    </div>
    <div>
      <div style="background:var(--forest);padding:36px 32px;">
        <span style="font-size:8.5px;letter-spacing:0.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:20px;">What to Pay Attention To</span>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:11px;color:rgba(220,168,152,0.5);flex-shrink:0;margin-top:3px;">—</span>
            <p style="font-size:13px;color:rgba(245,240,232,0.68);line-height:1.75;">Pressure to commit quickly</p>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:11px;color:rgba(220,168,152,0.5);flex-shrink:0;margin-top:3px;">—</span>
            <p style="font-size:13px;color:rgba(245,240,232,0.68);line-height:1.75;">No preparation process offered</p>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:11px;color:rgba(220,168,152,0.5);flex-shrink:0;margin-top:3px;">—</span>
            <p style="font-size:13px;color:rgba(245,240,232,0.68);line-height:1.75;">Large group ceremonies with minimal individual attention</p>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:11px;color:rgba(220,168,152,0.5);flex-shrink:0;margin-top:3px;">—</span>
            <p style="font-size:13px;color:rgba(245,240,232,0.68);line-height:1.75;">No medical screening required</p>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <span style="font-size:11px;color:rgba(220,168,152,0.5);flex-shrink:0;margin-top:3px;">—</span>
            <p style="font-size:13px;color:rgba(245,240,232,0.68);line-height:1.75;">Unwillingness to answer direct questions about safety protocols</p>
          </div>
          <div style="display:flex;gap:14px;align-items:flex-start;margin-top:8px;">
            <span style="font-size:11px;color:var(--sage-light);flex-shrink:0;margin-top:3px;">→</span>
            <p style="font-size:12px;color:rgba(245,240,232,0.4);line-height:1.75;font-style:italic;">These are signals worth honoring. Trust what you notice.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CLOSING CTA -->
<section class="section section-deep" style="text-align:center;border-bottom:none;">
  <div class="cta-block reveal">
    <span class="eyebrow" style="display:block;text-align:center;margin-bottom:24px;">Kauaʻi, Hawaiʻi</span>
    <h2 class="cta-heading">The Medicine Shows<br>You the Door.<br><em>We Walk Through It With You.</em></h2>
    <p class="cta-body">If you feel called, we encourage you to book a discovery session with us through our website.</p>
    <span class="cta-sub">vitalkauai.com · aloha&#64;vitalkauai.com</span>
  </div>
</section>

<footer class="guide-footer">
  <p class="footer-logo">Vital Kauaʻi</p>
  <p>© 2026 Vital Kauai Church · PO Box 932, Hanalei, HI 96714<br>
  All original content is protected by U.S. copyright law.<br>
  Reproduction without written permission prohibited.</p>
</footer>

<div class="disclaimer">
  <p>This guide is for educational and informational purposes only. It does not constitute medical, legal, or therapeutic advice. Iboga is a powerful plant medicine that requires careful screening and qualified facilitation. Consult a qualified healthcare professional before making any health decisions. Vital Kauaʻi operates as a legally established church, holding medicine work within a sacred and protected religious context.</p>
`;
