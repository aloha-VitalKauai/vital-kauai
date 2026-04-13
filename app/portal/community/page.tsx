"use client";

import { useEffect } from "react";

export default function CommunityPage() {
  useEffect(() => {
    // Reveal on scroll
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove("hidden"); e.target.classList.add("visible"); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => { el.classList.add("hidden"); observer.observe(el); });

    // FAQ accordion
    document.querySelectorAll(".faq-q").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.parentElement;
        if (item) item.classList.toggle("open");
      });
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENT }} />
      <div dangerouslySetInnerHTML={{ __html: BODY_CONTENT }} />
    </>
  );
}

const CSS_CONTENT = `
:root {
  --nav-bg:     #171411;
  --hero-bg:    #243820;
  --page-bg:    #f5f1e6;
  --surface:    #faf7f0;
  --surface-2:  #f0ece0;
  --surface-3:  #e8e2d0;
  --border:     rgba(0,0,0,.09);
  --border-2:   rgba(0,0,0,.06);
  --gold:       #c4995c;
  --gold-lt:    #d4aa72;
  --gold-dim:   #8a6e3e;
  --gold-faint: rgba(196,153,92,.12);
  --ink:        #1e1c18;
  --ink-mid:    #4e4a42;
  --ink-mute:   #8a8278;
  --cream:      #e8e2d0;
  --cream-dim:  #a09484;
  --cream-mute: #6a6058;
  --sage:       #6a8c65;
  --sage-dim:   #4a6445;
  --sage-faint: rgba(106,140,101,.15);
  --serif: 'Cormorant Garamond', Georgia, serif;
  --sans:  'Jost', sans-serif;
}
html { font-size: 16px; }
body { background: var(--page-bg); color: var(--ink); font-family: var(--sans); font-weight: 300; line-height: 1.7; min-height: 100vh; }

/* NAV */
.nav { background: var(--nav-bg); height: 52px; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
.nav-brand { font-family: var(--serif); font-size: .95rem; font-weight: 400; letter-spacing: .14em; color: #e8e2d0; text-decoration: none; text-transform: uppercase; }
.nav-brand em { font-style: italic; color: var(--gold-lt); }
.nav-links { display: flex; gap: 2rem; list-style: none; }
.nav-links a { font-size: .64rem; letter-spacing: .2em; text-transform: uppercase; color: var(--cream-dim); text-decoration: none; font-weight: 400; transition: color .2s; }
.nav-links a.active { color: var(--cream); font-weight: 500; }
.nav-right { display: flex; align-items: center; gap: 1.2rem; font-size: .64rem; letter-spacing: .12em; color: var(--cream-dim); }
.btn-so { border: 1px solid var(--cream-mute); color: var(--cream-dim); font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; padding: .3rem .9rem; border-radius: 1px; background: transparent; cursor: pointer; font-family: var(--sans); transition: all .2s; }
.btn-so:hover { border-color: var(--cream-dim); color: var(--cream); }

/* PROGRESS */
.prog { background: var(--surface-2); border-bottom: 1px solid var(--border); padding: 0 2rem; height: 40px; display: flex; align-items: center; gap: 1.5rem; }
.prog-lbl { font-size: .6rem; letter-spacing: .22em; text-transform: uppercase; color: var(--ink-mute); white-space: nowrap; font-weight: 400; }
.prog-track { flex: 1; height: 2px; background: rgba(0,0,0,.1); border-radius: 2px; overflow: hidden; max-width: 360px; }
.prog-fill { height: 100%; background: var(--gold); border-radius: 2px; }
.prog-week { font-size: .66rem; letter-spacing: .14em; color: var(--gold); white-space: nowrap; font-weight: 400; }

/* HERO */
.hero { background: var(--hero-bg); padding: 3.5rem 2rem 3rem; }
.hero-in { max-width: 880px; margin: 0 auto; }
.hero-eye { font-size: .6rem; letter-spacing: .26em; text-transform: uppercase; color: var(--cream-mute); margin-bottom: 1.2rem; font-weight: 400; }
.hero-eye span { color: var(--gold-dim); }
.hero-h1 { font-family: var(--serif); font-size: clamp(2.4rem, 5vw, 3.8rem); font-weight: 300; line-height: 1.1; color: var(--cream); margin-bottom: .5rem; }
.hero-h1 em { font-style: italic; color: var(--gold-lt); }
.hero-p { font-size: .88rem; color: var(--cream-dim); max-width: 540px; line-height: 1.8; margin-top: 1rem; }

/* BODY */
.bd { max-width: 880px; margin: 0 auto; padding: 3rem 2rem 7rem; }

/* SECTION LABEL */
.sec { display: flex; align-items: center; gap: .9rem; margin-bottom: 1.3rem; margin-top: 3.4rem; }
.sec:first-of-type { margin-top: 0; }
.sec span { font-size: .58rem; letter-spacing: .26em; text-transform: uppercase; color: var(--gold-dim); white-space: nowrap; font-weight: 400; }
.sec::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* CARD */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 2px; }

/* ━━━━━━━━━━━━━━━━━━━
   01  YOUR PLACE
━━━━━━━━━━━━━━━━━━━ */
.yp { padding: 2rem 2.4rem; }
.continuity { background: var(--surface-2); border: 1px solid var(--border-2); border-radius: 1px; padding: .75rem 1rem; display: flex; align-items: baseline; gap: .75rem; margin-bottom: 1.4rem; flex-wrap: wrap; }
.cont-lbl { font-size: .58rem; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-mute); font-weight: 400; white-space: nowrap; }
.cont-txt { font-size: .8rem; color: var(--ink-mid); font-style: italic; font-family: var(--serif); }
.cont-txt strong { font-weight: 400; color: var(--ink); }
.yp-grid { display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: start; margin-bottom: 1.6rem; }
.yp-lbl { font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; color: var(--gold-dim); margin-bottom: .5rem; font-weight: 400; }
.yp-h2 { font-family: var(--serif); font-size: clamp(1.3rem, 3vw, 1.9rem); font-weight: 300; color: var(--ink); line-height: 1.2; margin-bottom: .2rem; }
.yp-h2 em { font-style: italic; color: var(--gold); }
.yp-sub { font-size: .78rem; color: var(--ink-mute); font-style: italic; }
.phase-badge { background: var(--hero-bg); color: var(--cream-dim); font-size: .58rem; letter-spacing: .18em; text-transform: uppercase; padding: .4rem .9rem; border-radius: 1px; font-weight: 400; white-space: nowrap; }
.arc { margin-bottom: 1.5rem; }
.arc-track { display: flex; align-items: center; }
.arc-seg { flex: 1; height: 2px; background: rgba(0,0,0,.1); }
.arc-seg.done { background: var(--gold-dim); }
.arc-dot { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid rgba(0,0,0,.15); background: var(--surface-2); }
.arc-dot.done { border-color: var(--gold-dim); background: var(--gold-dim); }
.arc-dot.cur  { border-color: var(--gold); background: var(--gold); box-shadow: 0 0 0 3px rgba(196,153,92,.2); }
.arc-dot.cer  { border-color: var(--gold-dim); background: var(--surface-2); width: 13px; height: 13px; }
.arc-row { display: flex; justify-content: space-between; position: relative; margin-top: .5rem; height: 1.2rem; }
.arc-lbl { font-size: .58rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); font-weight: 400; }
.arc-clbl { position: absolute; left: 50%; transform: translateX(-50%); font-size: .58rem; letter-spacing: .14em; text-transform: uppercase; color: var(--gold-dim); font-weight: 400; }
.yp-note { font-size: .82rem; color: var(--ink-mid); line-height: 1.8; padding-top: 1.2rem; border-top: 1px solid var(--border-2); }
.yp-note strong { font-weight: 400; font-family: var(--serif); font-style: italic; font-size: .9rem; color: var(--ink); }
.yp-callout { background: var(--surface-2); border-left: 2px solid var(--gold-dim); padding: .8rem 1rem; margin-top: 1.2rem; font-size: .76rem; color: var(--ink-mid); line-height: 1.7; font-style: italic; border-radius: 0; }

/* ━━━━━━━━━━━━━━━━━━━
   02  THEME + PRACTICE
━━━━━━━━━━━━━━━━━━━ */
.theme-card { overflow: hidden; }
.t-dark { background: var(--hero-bg); padding: 2.2rem 2.4rem 2rem; }
.t-tag { font-size: .58rem; letter-spacing: .24em; text-transform: uppercase; color: var(--sage); margin-bottom: .9rem; font-weight: 400; display: flex; align-items: center; gap: .5rem; }
.t-tag::before { content:''; width: 5px; height: 5px; border-radius: 50%; background: var(--sage); display: inline-block; opacity: .7; }
.t-h2 { font-family: var(--serif); font-size: clamp(1.7rem, 4vw, 2.7rem); font-weight: 300; color: var(--cream); line-height: 1.15; margin-bottom: .3rem; }
.t-h2 em { font-style: italic; color: var(--gold-lt); }
.t-meaning { font-size: .78rem; color: var(--cream-dim); font-style: italic; margin-bottom: 1.5rem; }
.t-plbl { font-size: .58rem; letter-spacing: .2em; text-transform: uppercase; color: var(--cream-mute); margin-bottom: .5rem; font-weight: 400; }
.t-prompt { font-family: var(--serif); font-size: 1.2rem; font-style: italic; font-weight: 300; color: var(--gold-lt); line-height: 1.55; }
.pips { display: flex; gap: 3px; margin-top: 1.5rem; }
.pip { flex: 1; height: 2px; background: rgba(255,255,255,.1); border-radius: 2px; }
.pip.done { background: var(--gold-dim); }
.pip.now  { background: var(--gold); }
.t-light { padding: 1.8rem 2.4rem; }
.lens-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 1px; overflow: hidden; margin-bottom: 1.8rem; }
.lens { background: var(--surface); padding: 1.2rem 1.3rem; }
.lens-tag { font-size: .56rem; letter-spacing: .2em; text-transform: uppercase; color: var(--gold-dim); margin-bottom: .4rem; font-weight: 400; }
.lens-txt { font-size: .8rem; color: var(--ink-mid); line-height: 1.75; font-style: italic; }
.practice-box { background: var(--surface-2); border: 1px solid var(--border); border-radius: 1px; padding: 1.5rem 1.6rem; }
.prac-lbl { font-size: .58rem; letter-spacing: .22em; text-transform: uppercase; color: var(--sage-dim); margin-bottom: .8rem; font-weight: 400; display: flex; align-items: center; gap: .5rem; }
.prac-lbl::before { content:''; width: 5px; height: 5px; border-radius: 50%; background: var(--sage); display: inline-block; }
.prac-title { font-family: var(--serif); font-size: 1.05rem; font-weight: 400; color: var(--ink); margin-bottom: 1rem; }
.prac-steps { list-style: none; display: flex; flex-direction: column; gap: .55rem; margin-bottom: 1.2rem; }
.prac-steps li { font-size: .82rem; color: var(--ink-mid); display: flex; align-items: baseline; gap: .7rem; line-height: 1.6; }
.prac-steps li::before { content: '—'; color: var(--gold-dim); flex-shrink: 0; }
.prac-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 1.1rem; border-top: 1px solid var(--border-2); gap: 1rem; flex-wrap: wrap; }
.prac-stat { font-size: .74rem; color: var(--ink-mute); font-style: italic; }
.prac-stat strong { font-weight: 400; color: var(--sage-dim); font-style: normal; }
.btn-didit { background: transparent; border: 1px solid var(--border); color: var(--ink-mid); font-family: var(--sans); font-size: .62rem; letter-spacing: .18em; text-transform: uppercase; padding: .55rem 1.2rem; border-radius: 1px; cursor: pointer; transition: all .2s; font-weight: 400; white-space: nowrap; }
.btn-didit:hover { border-color: var(--sage-dim); color: var(--sage-dim); }
.btn-didit.on { background: var(--sage-faint); border-color: var(--sage-dim); color: var(--sage-dim); cursor: default; }

/* ━━━━━━━━━━━━━━━━━━━
   03  FROM THE TEAM
━━━━━━━━━━━━━━━━━━━ */
.team { padding: 2rem 2.4rem; }
.team-lbl { font-size: .58rem; letter-spacing: .22em; text-transform: uppercase; color: var(--gold-dim); margin-bottom: .7rem; font-weight: 400; }
.team-layout { display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: start; }
.team-note { font-family: var(--serif); font-size: 1.05rem; font-style: italic; font-weight: 300; color: var(--ink-mid); line-height: 1.78; margin-bottom: .75rem; }
.team-sig { font-size: .68rem; letter-spacing: .12em; color: var(--gold-dim); }
.team-anchor { font-size: .78rem; color: var(--ink-mid); font-style: italic; margin-top: 1.1rem; padding-top: 1rem; border-top: 1px solid var(--border-2); line-height: 1.7; }
.team-anchor strong { font-weight: 400; color: var(--ink); font-style: normal; }
.btn-reach { background: transparent; border: 1px solid var(--border); color: var(--ink-mute); font-family: var(--sans); font-size: .62rem; letter-spacing: .18em; text-transform: uppercase; padding: .6rem 1.2rem; border-radius: 1px; cursor: pointer; white-space: nowrap; transition: all .2s; font-weight: 400; }
.btn-reach:hover { border-color: var(--gold-dim); color: var(--ink); }

/* ━━━━━━━━━━━━━━━━━━━
   04  REFLECTIONS
━━━━━━━━━━━━━━━━━━━ */
.ref-intro { font-size: .82rem; color: var(--ink-mid); font-style: italic; line-height: 1.8; margin-bottom: 1.3rem; border-left: 2px solid var(--border); padding-left: 1rem; }
.ref-toolbar { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: .75rem; }
.ref-tabs { display: flex; }
.ref-tab { font-size: .6rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-mute); padding: .55rem 1.2rem; background: var(--surface-2); border: 1px solid var(--border); cursor: pointer; font-weight: 400; font-family: var(--sans); transition: all .15s; }
.ref-tab:first-child { border-radius: 2px 0 0 0; }
.ref-tab:last-child  { border-radius: 0 2px 0 0; }
.ref-tab.active { background: var(--surface); color: var(--ink); font-weight: 500; border-bottom: 2px solid var(--gold); padding-bottom: .45rem; }
.ref-sort { display: flex; }
.rsb { font-size: .58rem; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-mute); padding: .4rem .9rem; background: var(--surface-2); border: 1px solid var(--border); cursor: pointer; font-weight: 400; font-family: var(--sans); transition: all .15s; }
.rsb:first-child { border-radius: 1px 0 0 1px; }
.rsb:last-child  { border-radius: 0 1px 1px 0; }
.rsb.active { background: var(--surface); color: var(--ink); font-weight: 500; }
.ref-stack { border: 1px solid var(--border); border-top: none; border-radius: 0 2px 2px 2px; overflow: hidden; }
.ref-panel { display: none; }
.ref-panel.on { display: block; }
.ref-card { background: var(--surface); padding: 1.6rem 2rem; border-bottom: 1px solid var(--border-2); position: relative; }
.ref-card:last-child { border-bottom: none; }
.ref-card::before { content: '\\201C'; font-family: var(--serif); font-size: 4.5rem; line-height: .9; color: var(--gold); opacity: .12; position: absolute; top: .6rem; left: 1.6rem; }
.ref-q { font-family: var(--serif); font-size: 1.08rem; font-style: italic; font-weight: 300; color: var(--ink-mid); line-height: 1.78; padding-left: .4rem; position: relative; z-index: 1; }
.ref-meta { margin-top: .6rem; font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); padding-left: .4rem; display: flex; align-items: center; gap: .6rem; }
.ref-theme { color: var(--sage-dim); }
.ref-new { background: var(--sage-faint); color: var(--sage-dim); font-size: .54rem; padding: .15rem .5rem; border-radius: 20px; letter-spacing: .12em; }
.ref-note { font-size: .68rem; color: var(--ink-mute); font-style: italic; margin-top: .75rem; }

/* ━━━━━━━━━━━━━━━━━━━
   05  COME GATHER  ← dominant
━━━━━━━━━━━━━━━━━━━ */
.call-wrap { background: var(--hero-bg); border: 1px solid rgba(196,153,92,.22); border-radius: 2px; overflow: hidden; position: relative; }
.call-wrap::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: .55; }
.call-main { padding: 2.8rem 2.6rem 2.4rem; }
.call-social { display: flex; flex-direction: row; align-items: center; gap: 0; margin-bottom: 2.2rem; padding-bottom: 1.6rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.call-stat { display: flex; flex-direction: column; gap: .3rem; padding: 0 2rem; }
.call-stat:first-child { padding-left: 0; }
.call-num { font-family: var(--serif); font-size: 1.9rem; font-weight: 300; color: var(--gold-lt); line-height: 1; }
.call-stat-lbl { font-size: .58rem; letter-spacing: .16em; text-transform: uppercase; color: var(--cream-mute); font-weight: 400; white-space: nowrap; }
.call-div { width: 1px; height: 36px; background: rgba(255,255,255,.12); align-self: center; flex-shrink: 0; }
.call-lbl { font-size: .58rem; letter-spacing: .22em; text-transform: uppercase; color: var(--sage); margin-bottom: .7rem; font-weight: 400; }
.call-h3 { font-family: var(--serif); font-size: clamp(1.8rem, 4vw, 2.7rem); font-weight: 300; color: var(--cream); margin-bottom: .35rem; }
.call-theme-ln { font-size: .85rem; color: var(--cream-dim); font-style: italic; margin-bottom: 1.5rem; }
.call-why { font-size: .88rem; color: var(--cream-dim); line-height: 1.85; border-left: 2px solid rgba(196,153,92,.3); padding-left: 1rem; margin-bottom: 2rem; }
.call-details { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 2rem; }
.call-dt { font-size: .8rem; color: var(--cream-dim); display: flex; align-items: baseline; gap: .6rem; }
.call-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--gold-dim); flex-shrink: 0; margin-top: .6rem; }
.call-cta { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.btn-rsvp { background: var(--gold); color: var(--nav-bg); font-family: var(--sans); font-size: .7rem; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; padding: .9rem 2.2rem; border: none; border-radius: 1px; cursor: pointer; transition: background .2s, transform .12s; }
.btn-rsvp:hover { background: var(--gold-lt); transform: translateY(-1px); }
.btn-rsvp.on { background: var(--sage); cursor: default; transform: none; }
.btn-cal { background: transparent; border: 1px solid rgba(255,255,255,.2); color: var(--cream-dim); font-family: var(--sans); font-size: .68rem; font-weight: 300; letter-spacing: .18em; text-transform: uppercase; padding: .9rem 1.5rem; border-radius: 1px; cursor: pointer; text-decoration: none; display: inline-block; transition: all .2s; }
.btn-cal:hover { border-color: rgba(255,255,255,.4); color: var(--cream); }
.call-count-txt { font-size: .66rem; letter-spacing: .1em; color: var(--cream-mute); }
.call-past { font-size: .72rem; color: var(--cream-mute); font-style: italic; margin-top: 1.2rem; }

/* ━━━━━━━━━━━━━━━━━━━
   06  LIVE WINDOW
━━━━━━━━━━━━━━━━━━━ */
.live-wrap { border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
.live-hdr { background: var(--surface-2); padding: 1.2rem 1.8rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border); }
.live-hdr-l { display: flex; align-items: center; gap: .85rem; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-mute); flex-shrink: 0; }
.live-dot.live { background: var(--sage); box-shadow: 0 0 0 3px var(--sage-faint); animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 3px var(--sage-faint)} 50%{box-shadow:0 0 0 6px rgba(106,140,101,.06)} }
.live-hdr-title { font-size: .75rem; font-weight: 500; color: var(--ink); letter-spacing: .06em; }
.live-hdr-sub { font-size: .7rem; color: var(--ink-mute); font-style: italic; }
.live-status { font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-mute); font-weight: 400; }
.live-status.live { color: var(--sage-dim); }
.live-closed-view { background: var(--surface); padding: 2.2rem; text-align: center; }
.live-cl-icon { font-family: var(--serif); font-size: 1.5rem; font-style: italic; color: var(--ink-mute); margin-bottom: .75rem; }
.live-cl-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 300; color: var(--ink); margin-bottom: .35rem; }
.live-cl-sub { font-size: .8rem; color: var(--ink-mute); font-style: italic; line-height: 1.7; max-width: 400px; margin: 0 auto; }
.live-opens { display: inline-block; margin-top: 1rem; font-size: .7rem; letter-spacing: .12em; color: var(--gold-dim); border: 1px solid var(--gold-faint); padding: .4rem .9rem; border-radius: 1px; }
.live-open-view { background: var(--surface); padding: 1.8rem 2rem; }
.live-prompt-q { font-family: var(--serif); font-size: 1.05rem; font-style: italic; color: var(--gold); margin-bottom: 1.4rem; line-height: 1.55; padding: .85rem 1rem; background: var(--surface-2); border-left: 2px solid var(--gold-dim); }
.live-rules { display: flex; gap: 1.5rem; margin-bottom: 1.4rem; flex-wrap: wrap; }
.live-rule { font-size: .65rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mute); display: flex; align-items: center; gap: .4rem; }
.live-rule::before { content: '·'; color: var(--gold-dim); }
.live-voices { display: flex; flex-direction: column; gap: 1px; background: var(--border-2); border: 1px solid var(--border-2); border-radius: 1px; margin-bottom: 1.4rem; overflow: hidden; }
.live-voice { background: var(--surface); padding: 1rem 1.2rem; }
.lv-txt { font-family: var(--serif); font-size: .95rem; font-style: italic; color: var(--ink-mid); line-height: 1.65; }
.lv-meta { font-size: .6rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mute); margin-top: .4rem; }
.live-input { display: flex; flex-direction: column; gap: .75rem; }
.live-ta { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 1px; color: var(--ink); font-family: var(--serif); font-size: .95rem; font-weight: 300; padding: .8rem 1rem; line-height: 1.6; resize: none; height: 80px; transition: border-color .2s; }
.live-ta:focus { outline: none; border-color: var(--gold-dim); }
.live-ta::placeholder { color: var(--ink-mute); font-style: italic; }
.live-ta:disabled { opacity: .5; cursor: not-allowed; }
.live-send-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; }
.live-chr { font-size: .64rem; color: var(--ink-mute); }
.btn-lsend { background: transparent; border: 1px solid var(--border); color: var(--ink-mid); font-family: var(--sans); font-size: .62rem; letter-spacing: .18em; text-transform: uppercase; padding: .55rem 1.4rem; border-radius: 1px; cursor: pointer; transition: all .2s; font-weight: 400; }
.btn-lsend:hover { border-color: var(--gold-dim); color: var(--ink); }
.live-sent { font-size: .78rem; color: var(--sage-dim); font-style: italic; padding: .6rem 0; }

/* ━━━━━━━━━━━━━━━━━━━
   07  THE FIELD
━━━━━━━━━━━━━━━━━━━ */
.field { padding: 2rem 2.4rem; }
.field-open { font-family: var(--serif); font-size: 1.05rem; font-style: italic; font-weight: 300; color: var(--ink-mid); line-height: 1.75; margin-bottom: 1.8rem; }
.f-row { display: flex; align-items: center; gap: .9rem; margin-bottom: 1.1rem; }
.f-txt { font-size: .82rem; color: var(--ink-mid); flex: 1; line-height: 1.6; }
.f-txt em { font-style: italic; color: var(--ink); font-family: var(--serif); font-size: .88rem; }
.f-bar-col { width: 120px; flex-shrink: 0; }
.f-track { height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; }
.f-fill { height: 100%; background: var(--gold-dim); border-radius: 2px; }
.f-pct { font-size: .62rem; letter-spacing: .08em; color: var(--gold-dim); text-align: right; margin-top: .3rem; font-family: var(--serif); font-style: italic; }
.f-trend { flex-shrink: 0; width: 56px; text-align: right; }
.trend-up   { font-size: .68rem; font-weight: 400; letter-spacing: .04em; color: var(--sage-dim); }
.trend-dn   { font-size: .68rem; font-weight: 400; letter-spacing: .04em; color: var(--ink-mute); }
.trend-lbl  { font-size: .56rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-mute); }
.field-close { margin-top: 1.5rem; padding-top: 1.3rem; border-top: 1px solid var(--border-2); font-size: .8rem; color: var(--ink-mute); font-style: italic; line-height: 1.8; }

/* ━━━━━━━━━━━━━━━━━━━
   08  OFFER YOUR VOICE
━━━━━━━━━━━━━━━━━━━ */
.submit { padding: 2.2rem 2.4rem; }
.s-title { font-family: var(--serif); font-size: 1.45rem; font-weight: 300; color: var(--ink); margin-bottom: .4rem; }
.s-sub { font-size: .82rem; color: var(--ink-mid); font-style: italic; line-height: 1.8; margin-bottom: 1.6rem; }
.s-prompt { font-family: var(--serif); font-size: 1.05rem; font-style: italic; color: var(--gold); line-height: 1.55; padding: 1rem 1.2rem; background: var(--surface-2); border-left: 2px solid var(--gold-dim); margin-bottom: 1.5rem; }
.f-label { display: block; font-size: .58rem; letter-spacing: .2em; text-transform: uppercase; color: var(--gold-dim); margin-bottom: .5rem; font-weight: 400; }
.f-ta { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 1px; color: var(--ink); font-family: var(--serif); font-size: 1rem; font-weight: 300; padding: .85rem 1rem; line-height: 1.65; resize: vertical; min-height: 110px; transition: border-color .2s; }
.f-ta:focus { outline: none; border-color: var(--gold-dim); }
.f-ta::placeholder { color: var(--ink-mute); font-style: italic; }
.s-footer { display: flex; justify-content: space-between; align-items: center; margin-top: .9rem; flex-wrap: wrap; gap: .75rem; }
.s-assur { font-size: .68rem; color: var(--ink-mute); font-style: italic; max-width: 380px; line-height: 1.6; }
.btn-sub { background: transparent; border: 1px solid var(--border); color: var(--ink-mid); font-family: var(--sans); font-size: .64rem; font-weight: 400; letter-spacing: .18em; text-transform: uppercase; padding: .72rem 1.6rem; border-radius: 1px; cursor: pointer; transition: all .2s; }
.btn-sub:hover { border-color: var(--gold-dim); color: var(--ink); }
.s-confirm { display: none; background: var(--surface-2); border: 1px solid var(--border-2); border-left: 2px solid var(--sage-dim); padding: 1.4rem 1.5rem; border-radius: 0 1px 1px 0; }
.s-confirm.show { display: block; }
.s-conf-title { font-family: var(--serif); font-size: 1.1rem; font-weight: 300; color: var(--ink); margin-bottom: .4rem; }
.s-conf-txt { font-size: .8rem; color: var(--ink-mid); font-style: italic; line-height: 1.75; }

/* RESPONSIVE */
@media (max-width: 640px) {
  .nav-links, .nav-right { display: none; }
  .bd { padding: 2rem 1.2rem 5rem; }
  .hero { padding: 2.5rem 1.2rem 2.2rem; }
  .prog { padding: 0 1.2rem; }
  .yp-grid, .team-layout { grid-template-columns: 1fr; }
  .lens-grid { grid-template-columns: 1fr; }
  .call-cta { flex-direction: column; align-items: flex-start; }
  .call-main { padding: 2rem 1.5rem; }
  .s-footer, .ref-toolbar { flex-direction: column; align-items: flex-start; }
  .f-trend { display: none; }
}
`;

const BODY_CONTENT = `
<!-- PROGRESS — personal only -->
<div class="prog">
  <span class="prog-lbl">Your journey progress</span>
  <div class="prog-track"><div class="prog-fill" style="width:33%"></div></div>
  <span class="prog-week">Week 3 of 9 · Pre-Ceremony</span>
</div>

<!-- HERO -->
<div class="hero">
  <div class="hero-in">
    <p class="hero-eye">Member Portal · <span>Community</span> · April 13, 2026</p>
    <h1 class="hero-h1">The Shared<br><em>Field</em></h1>
    <p class="hero-p">Each person here is walking their own arc — at different weeks, in different phases, carrying different things. Once a week, the community gathers around a shared theme. Not to synchronize the journeys, but to remember that no one is walking alone.</p>
  </div>
</div>

<div class="bd">

  <!-- ━━ 01  YOUR PLACE ━━ -->
  <div class="sec"><span>Your place in your journey</span></div>
  <div class="card yp">
    <div class="continuity">
      <span class="cont-lbl">Last week</span>
      <span class="cont-txt">You were sitting with <strong>Lōkahi — Unity.</strong> What did you carry forward from that?</span>
    </div>
    <div class="yp-grid">
      <div>
        <p class="yp-lbl">Your arc, this week</p>
        <h2 class="yp-h2">Week 3 · <em>The Preparation</em></h2>
        <p class="yp-sub">Pre-ceremony phase · 6 weeks remaining before ceremony</p>
      </div>
      <div class="phase-badge">Pre-Ceremony</div>
    </div>
    <div class="arc">
      <div class="arc-track">
        <div class="arc-dot done"></div>
        <div class="arc-seg done"></div>
        <div class="arc-dot done"></div>
        <div class="arc-seg done"></div>
        <div class="arc-dot cur"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg" style="flex:.3;opacity:.5;"></div>
        <div class="arc-dot cer"></div>
        <div class="arc-seg" style="flex:.3;opacity:.5;"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
        <div class="arc-seg"></div>
        <div class="arc-dot"></div>
      </div>
      <div class="arc-row">
        <span class="arc-lbl">Preparation</span>
        <span class="arc-clbl">Ceremony</span>
        <span class="arc-lbl">Integration</span>
      </div>
    </div>
    <div class="yp-note">
      You are three weeks into preparation. The medicine is already listening. This is the time when patterns begin to surface — not from the plant, but from the awareness that something is arriving. <strong>What you are noticing right now is real preparation.</strong> Trust what is rising.
    </div>
    <div class="yp-callout">
      The community theme below belongs to everyone — regardless of where each person is in their own journey. Others here are in Week 1 of integration, Week 6 of preparation, or anywhere in between. The shared theme is not about your week number. It is about what the community is sitting with together right now.
    </div>
  </div>

  <!-- ━━ 02  THEME + PRACTICE ━━ -->
  <div class="sec"><span>This week's community theme</span></div>
  <div class="card theme-card">
    <div class="t-dark">
      <p class="t-tag">Community rhythm · Week of April 13, 2026</p>
      <h2 class="t-h2">HAʻAHAʻA — <em>Meeting What Returns</em></h2>
      <p class="t-meaning">Humility in the presence of what comes back</p>
      <p class="t-plbl">This week's reflection prompt</p>
      <p class="t-prompt">"What has returned for you this week — and what might it be asking of you?"</p>
      <div class="pips">
        <div class="pip done"></div><div class="pip done"></div><div class="pip done"></div>
        <div class="pip done"></div><div class="pip done"></div><div class="pip done"></div>
        <div class="pip now"></div>
      </div>
    </div>
    <div class="t-light">
      <div class="lens-grid">
        <div class="lens">
          <p class="lens-tag">If you are preparing</p>
          <p class="lens-txt">Old patterns are returning not as failure, but as inventory. The medicine does not remove them — it asks you to know them. Notice what keeps showing up this week without trying to fix it yet.</p>
        </div>
        <div class="lens">
          <p class="lens-tag">If you are integrating</p>
          <p class="lens-txt">The ceremony showed you something. What has quietly returned in the weeks since? The question is not why it came back — it is whether you can meet it differently now than you could before.</p>
        </div>
      </div>
      <div class="practice-box">
        <p class="prac-lbl">This week's collective practice</p>
        <p class="prac-title">What the community is doing together this week</p>
        <ul class="prac-steps">
          <li>When a pattern returns, pause before responding — even for thirty seconds</li>
          <li>Do not immediately interrupt or resolve what arises; let it complete its movement</li>
          <li>Return to your practice at least once after noticing — even briefly</li>
        </ul>
        <div class="prac-footer">
          <p class="prac-stat"><strong id="prac-count">11</strong> members have marked this practice today</p>
          <button class="btn-didit" id="prac-btn" onclick="markPrac()">I did this today ✓</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ━━ 03  FROM THE TEAM ━━ -->
  <div class="sec"><span>From Rachel &amp; Josh</span></div>
  <div class="card team">
    <p class="team-lbl">This week's holding</p>
    <div class="team-layout">
      <div>
        <p class="team-note">"This theme always arrives like a quiet tide — you may not notice it until the water is already at your feet. This week, we are less interested in what you are doing in your practice, and more in what you are simply allowing yourself to notice. You do not have to resolve anything yet. Just see it clearly."</p>
        <p class="team-sig">— Rachel &amp; Josh · Vital Kauaʻi</p>
        <p class="team-anchor">This week, <strong>stay with what arises rather than resolve it.</strong> The impulse to fix or explain is the thing to notice. Let the pattern show itself fully before you decide what to do with it.</p>
      </div>
      <button class="btn-reach">Reach the team →</button>
    </div>
  </div>

  <!-- ━━ 04  OTHERS ON THIS PATH ━━ -->
  <div class="sec"><span>Others on this path</span></div>
  <p class="ref-intro">Curated, anonymized reflections from members sitting with this same theme — some preparing, some integrating, each at their own place in the arc. Shared not as advice, but as resonance.</p>
  <div class="ref-toolbar">
    <div class="ref-tabs">
      <button class="ref-tab active" onclick="switchTab('pre',this)">Those preparing</button>
      <button class="ref-tab" onclick="switchTab('post',this)">Those integrating</button>
    </div>
    <div class="ref-sort">
      <button class="rsb active" onclick="switchSort(this)">Curated</button>
      <button class="rsb" onclick="switchSort(this)">Most recent</button>
    </div>
  </div>
  <div class="ref-stack">
    <div class="ref-panel on" id="tab-pre">
      <div class="ref-card">
        <p class="ref-q">I thought I was past this pattern. It surfaced again this week — quieter than before, but unmistakably itself. There was something almost tender in recognizing it without the old urgency to push it away.</p>
        <p class="ref-meta">Preparing · <span class="ref-theme">HAʻAHAʻA</span></p>
      </div>
      <div class="ref-card">
        <p class="ref-q">I have been avoiding the evening sitting practice. Not dramatically — just sliding past it each night. Today I sat anyway and the first thing I felt was relief. I had not realized how much I was carrying the avoidance itself.</p>
        <p class="ref-meta">Preparing · <span class="ref-theme">HAʻAHAʻA</span> <span class="ref-new">Today</span></p>
      </div>
      <div class="ref-card">
        <p class="ref-q">The thing that keeps returning is an old story about not being enough. I keep waiting to have resolved it before I arrive. I am starting to think the ceremony wants to meet me with it still in my hands.</p>
        <p class="ref-meta">Preparing · <span class="ref-theme">HAʻAHAʻA</span></p>
      </div>
    </div>
    <div class="ref-panel" id="tab-post">
      <div class="ref-card">
        <p class="ref-q">The ceremony showed me something I thought I understood about my father. Three weeks out, it has returned — but now I can sit in front of it without the heat. That is new for me.</p>
        <p class="ref-meta">Integrating · <span class="ref-theme">HAʻAHAʻA</span> <span class="ref-new">Today</span></p>
      </div>
      <div class="ref-card">
        <p class="ref-q">My nervous system has been louder this week. Old states I thought I had moved through. What is different now is I do not believe the story the state is telling. I can feel it and stay.</p>
        <p class="ref-meta">Integrating · <span class="ref-theme">HAʻAHAʻA</span></p>
      </div>
      <div class="ref-card">
        <p class="ref-q">More emotion than I expected. The medicine keeps showing me the same door. I am beginning to understand it is not asking me to break it down — it wants me to learn to stand in front of it differently.</p>
        <p class="ref-meta">Integrating · <span class="ref-theme">HAʻAHAʻA</span></p>
      </div>
    </div>
  </div>
  <p class="ref-note">Reflections are reviewed and anonymized by the Vital Kauaʻi team before being shared.</p>

  <!-- ━━ 05  COME GATHER ━━ -->
  <div class="sec"><span>Come gather</span></div>
  <div class="call-wrap">
    <div class="call-main">

      <p class="call-lbl">This week's community gathering</p>
      <h3 class="call-h3">Community Integration Circle</h3>
      <p class="call-theme-ln">HAʻAHAʻA — Meeting What Returns</p>
      <p class="call-why">The call is the real center. Not because anything will be fixed or explained, but because there is something that only happens when voices come together around the same theme in the same moment — regardless of where each person is in their own arc. What you are carrying this week, bring it. You do not need to have it sorted.</p>
      <div class="call-details">
        <div class="call-dt"><div class="call-dot"></div><span>Thursday, April 17 · 5:00 PM HST · 60–75 minutes</span></div>
        <div class="call-dt"><div class="call-dot"></div><span>Held by Rachel &amp; Josh · Zoom link sent to your email 24 hours prior</span></div>
        <div class="call-dt"><div class="call-dot"></div><span>Open to all members — wherever you are in your journey</span></div>
      </div>
      <div class="call-cta">
        <button class="btn-rsvp" id="rsvp-btn" onclick="doRSVP()">I'll be there →</button>
        <a href="#" class="btn-cal">Add to Calendar</a>
        <span class="call-count-txt" id="rsvp-txt">9 attending so far</span>
      </div>
      <p class="call-past">Can't make it? Past calls are recorded and available in Resources.</p>
    </div>
  </div>

  <!-- ━━ 06  LIVE WINDOW ━━ -->
  <div class="sec"><span>Live window</span></div>
  <div class="live-wrap">
    <div class="live-hdr">
      <div class="live-hdr-l">
        <div class="live-dot" id="ldot"></div>
        <div>
          <div class="live-hdr-title">Shared Reflection Space</div>
          <div class="live-hdr-sub">Opens around the weekly call — a quiet, prompt-locked room</div>
        </div>
      </div>
      <span class="live-status" id="lstat">Opens Thursday · 3:30 PM HST</span>
    </div>
    <div id="lv-closed" class="live-closed-view">
      <div class="live-cl-icon">◦ ◦ ◦</div>
      <div class="live-cl-title">The space is not yet open</div>
      <div class="live-cl-sub">This room opens 90 minutes before the Thursday call and remains open for 90 minutes after. It is a ritual space — not an ongoing chat. When it opens: one prompt, one response per person, no threads.</div>
      <div class="live-opens">Opens in 3 days, 5 hours, 30 minutes</div>
    </div>
    <div id="lv-open" class="live-open-view" style="display:none;">
      <p class="live-prompt-q">"What has returned for you this week — and what might it be asking of you?"</p>
      <div class="live-rules">
        <span class="live-rule">One reflection per person</span>
        <span class="live-rule">240 characters max</span>
        <span class="live-rule">No replies or threads</span>
        <span class="live-rule">Closes 6:30 PM HST</span>
      </div>
      <div class="live-voices" id="lv-voices">
        <div class="live-voice"><div class="lv-txt">The same impatience I thought I had moved past. It arrived on Tuesday. I sat with it longer than I wanted to.</div><div class="lv-meta">Preparing · 4 min ago</div></div>
        <div class="live-voice"><div class="lv-txt">An old grief. Different texture this time — softer. The ceremony changed how I can hold it even when it returns.</div><div class="lv-meta">Integrating · 11 min ago</div></div>
      </div>
      <div class="live-input" id="lv-input">
        <textarea class="live-ta" id="lv-ta" placeholder="Respond to the prompt…" maxlength="240"></textarea>
        <div class="live-send-row">
          <span class="live-chr"><span id="lv-chr">0</span> / 240</span>
          <button class="btn-lsend" onclick="sendLive()">Offer into the room →</button>
        </div>
      </div>
      <div class="live-sent" id="lv-sent" style="display:none;">Your reflection has entered the room. It is held here with everyone else who is present.</div>
    </div>
  </div>
  <div style="margin-top:.65rem;font-size:.68rem;color:var(--ink-mute);font-style:italic;padding-left:.25rem;">
    Preview the live state: <button onclick="toggleDemo()" id="demo-btn" style="background:none;border:none;color:var(--gold-dim);font-size:.68rem;cursor:pointer;font-family:var(--sans);text-decoration:underline;padding:0;">Open live window →</button>
  </div>

  <!-- ━━ 07  THE FIELD ━━ -->
  <div class="sec"><span>The field this week</span></div>
  <div class="card field">
    <p class="field-open">Across all members — at every stage, every week of their own arc — this is what the community is collectively moving through under this theme.</p>
    <div class="f-row">
      <p class="f-txt">Members encountering <em>returning patterns</em></p>
      <div class="f-bar-col"><div class="f-track"><div class="f-fill" style="width:68%"></div></div><div class="f-pct">68%</div></div>
      <div class="f-trend"><div class="trend-up">↑ +12%</div><div class="trend-lbl">vs last wk</div></div>
    </div>
    <div class="f-row">
      <p class="f-txt">Members maintaining <em>daily practice</em></p>
      <div class="f-bar-col"><div class="f-track"><div class="f-fill" style="width:74%"></div></div><div class="f-pct">74%</div></div>
      <div class="f-trend"><div class="trend-up">↑ +6%</div><div class="trend-lbl">vs last wk</div></div>
    </div>
    <div class="f-row">
      <p class="f-txt">Members with <em>elevated emotional intensity</em></p>
      <div class="f-bar-col"><div class="f-track"><div class="f-fill" style="width:52%"></div></div><div class="f-pct">52%</div></div>
      <div class="f-trend"><div class="trend-dn">↓ −8%</div><div class="trend-lbl">vs last wk</div></div>
    </div>
    <div class="f-row">
      <p class="f-txt">Members feeling <em>supported by their practice</em></p>
      <div class="f-bar-col"><div class="f-track"><div class="f-fill" style="width:81%"></div></div><div class="f-pct">81%</div></div>
      <div class="f-trend"><div class="trend-up">↑ +4%</div><div class="trend-lbl">vs last wk</div></div>
    </div>
    <p class="field-close">If you are feeling the intensity of this week — you are not alone in it. Two thirds of the community are encountering the same return, from all different places in their own arc. And the field is moving in the right direction: practice is up, emotional intensity is easing.</p>
  </div>

  <!-- ━━ 08  OFFER YOUR VOICE ━━ -->
  <div class="sec"><span>Offer your voice</span></div>
  <div class="card submit">
    <div id="s-form">
      <h3 class="s-title">Add your reflection</h3>
      <p class="s-sub">Your words, offered here, may become the line someone else needed to read. Nothing is required. If something is alive in you around this week's theme, this is a place to set it down.</p>
      <p class="s-prompt">"What has returned for you this week — and what might it be asking of you?"</p>
      <div style="margin-bottom:1.4rem;">
        <label class="f-label" for="s-ta">Your reflection</label>
        <textarea class="f-ta" id="s-ta" placeholder="Write freely. There is no right way to say it…" maxlength="480"></textarea>
      </div>
      <div class="s-footer">
        <p class="s-assur">Your name is never attached. The team reads and curates before anything is shared. You may also keep this only for yourself — it still counts.</p>
        <button class="btn-sub" onclick="doSubmit()">Offer This →</button>
      </div>
    </div>
    <div class="s-confirm" id="s-confirm">
      <div class="s-conf-title">Your reflection has been received.</div>
      <div class="s-conf-txt">It has been passed to Rachel and Josh. If it resonates with others walking this path, it may be shared anonymously in a future week — as a thread in the shared weaving. Either way, it is held.</div>
    </div>
  </div>

</div>

<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script>
function switchTab(s,el){document.querySelectorAll('.ref-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.ref-panel').forEach(p=>p.classList.remove('on'));el.classList.add('active');document.getElementById('tab-'+s).classList.add('on');}
function switchSort(el){document.querySelectorAll('.rsb').forEach(b=>b.classList.remove('active'));el.classList.add('active');}
var rsvpd=false;
function doRSVP(){if(rsvpd)return;rsvpd=true;var b=document.getElementById('rsvp-btn');b.textContent="You're on the list ✓";b.classList.add('on');document.getElementById('rsvp-txt').textContent='10 attending — including you';document.getElementById('attend-num').textContent='10';}
var pracd=false;
function markPrac(){if(pracd)return;pracd=true;var b=document.getElementById('prac-btn');b.textContent='Marked for today ✓';b.classList.add('on');document.getElementById('prac-count').textContent='12';}
var lopen=false;
function toggleDemo(){lopen=!lopen;document.getElementById('lv-closed').style.display=lopen?'none':'block';document.getElementById('lv-open').style.display=lopen?'block':'none';document.getElementById('ldot').classList.toggle('live',lopen);var s=document.getElementById('lstat');s.textContent=lopen?'Live now · Closes 6:30 PM HST':'Opens Thursday · 3:30 PM HST';s.classList.toggle('live',lopen);document.getElementById('demo-btn').textContent=lopen?'← Close live window':'Open live window →';}
`;
