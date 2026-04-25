"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vk-packing-checks";

const PRACTICAL_ITEMS = [
  { label: "Sarongs", note: "Versatile for the beach, lounging, and ceremony spaces" },
  { label: "Eye mask and earplugs", note: "The island roosters are enthusiastic \u2014 earplugs make for deeper rest" },
  { label: "Notebook or journal" },
  { label: "Swimwear" },
  { label: "Flip-flops or sandals" },
  { label: "Comfortable hiking shoes", note: "Winter (Oct\u2013Apr): waterproof or trail shoes strongly recommended. Summer (May\u2013Sep): sturdy trail shoes or sneakers work well." },
  { label: "Movement and yoga attire" },
  { label: "Warm layers", note: "Winter: sweatshirt, sweatpants, and socks. Summer: a light sweater for cooler evenings." },
  { label: "Enough clothing for the full duration of your stay", note: "Laundry facilities available on property." },
  { label: "Rain jacket" },
  { label: "Zinc-based reef-safe sunscreen", note: "Required for ocean activities. Non-reef-safe sunscreen is banned in Hawai\u02BBi." },
  { label: "Organic mosquito repellent and/or lavender essential oil" },
  { label: "Personal toiletries \u2014 shampoo, conditioner, and your favorites", note: "We provide hand soap. Bring everything else you love and rely on." },
  { label: "Yoga mat (optional)", note: "We have loaners available \u2014 bring your own if you prefer." },
  { label: "Alarm clock or phone for waking", note: "For those on a digital detox, a simple travel alarm clock keeps mornings device-free." },
  { label: "Musical instruments, costumes, special poetry, readings, songs (optional)", note: "If something calls to you to bring and offer \u2014 trust that. There will be space for it." },
  { label: "Any comfort items that help you feel safe and held" },
];

const SACRED_ITEMS = [
  { label: "Crystals or other sacred power objects", note: "Anything that carries meaning, memory, or protective energy for you" },
  { label: "Altar items \u2014 photos, talismans, or objects that hold personal significance" },
  { label: "Anything that helps you feel connected, grounded, and held" },
];

const ALL_ITEMS = [...PRACTICAL_ITEMS, ...SACRED_ITEMS];

const ink = "#2C2416";
const inkLight = "#5C5040";
const border = "#DDD5C5";
const sage = "#6B8C6E";
const sageBg = "#EDF2EC";
const sageSoft = "#C8DAC9";
const gold = "#8B6914";
const goldBg = "#F5F0E4";
const rose = "#B56B5A";
const warmWhite = "#FDFAF6";

function CheckSvg() {
  return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function WhatToBringClient() {
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length === ALL_ITEMS.length) setChecked(saved);
      else setChecked(Array(ALL_ITEMS.length).fill(false));
    } catch { setChecked(Array(ALL_ITEMS.length).fill(false)); }
  }, []);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function resetAll() {
    const next = Array(ALL_ITEMS.length).fill(false);
    setChecked(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  const total = ALL_ITEMS.length;
  const done = checked.filter(Boolean).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function renderItem(item: { label: string; note?: string }, idx: number) {
    const isChecked = checked[idx];
    return (
      <li key={idx} onClick={() => toggle(idx)} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "10px 14px", borderRadius: 5, cursor: "pointer", opacity: isChecked ? 0.4 : 1, transition: "background 0.15s" }}>
        <div style={{ width: 20, height: 20, border: `1.5px solid ${isChecked ? ink : border}`, borderRadius: 4, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", background: isChecked ? ink : "white", transition: "all 0.15s" }}>
          {isChecked && <CheckSvg />}
        </div>
        <div style={{ flex: 1, fontSize: 14.5, lineHeight: 1.55, textDecoration: isChecked ? "line-through" : "none" }}>
          {item.label}
          {item.note && <span style={{ display: "block", fontSize: 12, color: inkLight, fontStyle: "italic", marginTop: 2 }}>{item.note}</span>}
        </div>
      </li>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F3ED", fontFamily: "'Jost', sans-serif", color: ink, fontSize: 15, lineHeight: 1.75 }}>
      {/* Nav */}

      {/* Header */}
      <div style={{ background: ink, color: "#F7F3ED", padding: "70px 40px 60px", textAlign: "center" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(247,243,237,0.4)", marginBottom: 18 }}>Vital Kaua&#699;i, Member Portal</p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 50, fontWeight: 300, letterSpacing: "0.03em", lineHeight: 1.1, marginBottom: 10 }}>
          What to Bring<br /><em style={{ fontStyle: "italic", color: "rgba(247,243,237,0.55)" }}>to Kaua&#699;i</em>
        </h1>
        <p style={{ fontSize: 13, color: "rgba(247,243,237,0.45)", letterSpacing: "0.08em", marginTop: 6 }}>Your packing guide for your journey with us</p>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 32px 100px" }}>
        {/* Intro */}
        <div style={{ textAlign: "center", marginBottom: 56, paddingBottom: 48, borderBottom: `1px solid ${border}` }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, lineHeight: 1.8, maxWidth: 640, margin: "0 auto 18px" }}>
            Your time here is an invitation to arrive fully, body, spirit, and the things that make you feel most like yourself. Pack lightly and intentionally.
          </p>
          <p style={{ fontSize: 13, color: inkLight, letterSpacing: "0.03em" }}>
            Kaua&#699;i&rsquo;s North Shore is warm and lush, with afternoon rain and everything in between. Pack accordingly.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 8, padding: "16px 20px", marginBottom: 48, display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: inkLight, whiteSpace: "nowrap" }}>Packed</span>
          <div style={{ flex: 1, height: 4, background: border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: ink, borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: 12, color: inkLight, whiteSpace: "nowrap" }}>{done} / {total}</span>
          <button onClick={resetAll} style={{ background: "none", border: `1px solid ${border}`, color: inkLight, fontFamily: "'Jost', sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap" }}>Reset</button>
        </div>

        {/* Practical Items */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8C7B5E", flexShrink: 0 }} />
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, letterSpacing: "0.03em" }}>Practical Items</h2>
            <div style={{ flex: 1, height: 1, background: border }} />
          </div>
          <ul style={{ listStyle: "none", display: "grid", gap: 2 }}>
            {PRACTICAL_ITEMS.map((item, i) => renderItem(item, i))}
          </ul>
        </div>

        {/* Sacred Items */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: rose, flexShrink: 0 }} />
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, letterSpacing: "0.03em" }}>Sacred Items</h2>
            <div style={{ flex: 1, height: 1, background: border }} />
          </div>
          <ul style={{ listStyle: "none", display: "grid", gap: 2 }}>
            {SACRED_ITEMS.map((item, i) => renderItem(item, PRACTICAL_ITEMS.length + i))}
          </ul>
        </div>

        {/* Journey-Specific */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: rose, flexShrink: 0 }} />
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, letterSpacing: "0.03em" }}>Journey-Specific Items</h2>
            <div style={{ flex: 1, height: 1, background: border }} />
          </div>

          <div style={{ background: goldBg, borderLeft: `3px solid ${gold}`, borderRadius: 8, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, marginBottom: 10, letterSpacing: "0.02em" }}>Iboga Journey</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: inkLight }}>Please bring all-white clothing for ceremony. White is worn as a reflection of openness and intention, bring enough for the full ceremony period.</p>
            <div style={{ marginTop: 16, background: "rgba(139,105,20,0.1)", borderLeft: `3px solid ${gold}`, borderRadius: 4, padding: "12px 16px", fontSize: 13.5, lineHeight: 1.65 }}>
              Iboga is a stimulant and sleep in the days following ceremony can be challenging. Before your arrival, consult with your doctor about a sleep aid or prescription sleep support, and fill it in advance so you have it on hand.
            </div>
          </div>
        </div>

        {/* Leave at Home */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ background: sageBg, border: `1px solid ${sageSoft}`, borderRadius: 8, padding: "28px 32px" }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, marginBottom: 6, letterSpacing: "0.02em" }}>For the Integrity of Your Journey</h3>
            <p style={{ fontSize: 13, color: inkLight, marginBottom: 18, lineHeight: 1.6 }}>We ask that you leave the following at home. These items interfere with the depth and safety of the work.</p>
            <ul style={{ listStyle: "none", display: "grid", gap: 8 }}>
              {[
                { text: "Processed or ceremonially-restricted foods", note: "All meals are lovingly provided and tailored to your journey. You\u2019re welcome to bring healthy snacks or shop for additional foods you love at Hanalei Market \u2014 it\u2019s just minutes away." },
                { text: "Alcohol" },
                { text: "Plant medicines", note: "If you have questions about this, please reach out before you arrive" },
                { text: "Additional supplements", note: "Unless essential to your health \u2014 let us know in advance" },
                { text: "Unnecessary medications", note: "For Iboga journeys especially \u2014 please discuss all medications with Rachel and Josh before your arrival" },
              ].map((item) => (
                <li key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14, lineHeight: 1.5 }}>
                  <span style={{ color: sage, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>&mdash;</span>
                  <span>{item.text}{item.note && <span style={{ display: "block", fontSize: 12, color: inkLight, fontStyle: "italic", marginTop: 2 }}>{item.note}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Digital Detox */}
        <div style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 8, padding: "28px 32px", textAlign: "center" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, marginBottom: 12, letterSpacing: "0.03em" }}>A Note on Devices</h3>
          <p style={{ fontSize: 13.5, color: inkLight, maxWidth: 540, margin: "0 auto", lineHeight: 1.75 }}>
            We warmly encourage a digital detox for as much of your stay as feels right. The less you carry from the outside world, the more space opens for what you came here to receive.
          </p>
        </div>
      </div>
    </div>
  );
}
