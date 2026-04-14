"use client";

import { useState, useEffect, useRef } from "react";

const SECTIONS = [
  {
    num: "1",
    label: "Healing & the Body",
    title: "What do you want to heal?",
    subtitle: "Physical, emotional, relational — what are you carrying that is ready to be released?",
    examples: [
      "How can I heal my chronic pain?",
      "What is the root of my anxiety, and how do I release it?",
      "Where is my grief living in my body, and what does it need from me?",
    ],
    count: 4,
  },
  {
    num: "2",
    label: "Blind Spots & Shadows",
    title: "What do I most need to see?",
    subtitle: "What patterns, beliefs, or truths are ready to come into the light — about yourself, others, or the life you are living?",
    examples: [
      "What do I most need to see right now?",
      "Where am I lying to myself?",
      "What shadows are alive in me that I have been unwilling to face?",
    ],
    count: 4,
  },
  {
    num: "3",
    label: "Forgiveness & Relationships",
    title: "Who do you need to forgive?",
    subtitle: "Toward yourself and others — where is there unresolved pain, resentment, or grief that is ready to be met with grace?",
    examples: [
      "How can I forgive myself for _____?",
      "What do I need to understand about _____ in order to release what happened between us?",
      "Where am I out of integrity, and what needs to be made right?",
    ],
    count: 4,
  },
  {
    num: "4",
    label: "Purpose & Becoming",
    title: "Who are you becoming?",
    subtitle: "Beyond healing — what are you moving toward? What life, version of yourself, or quality of being are you called to step into?",
    examples: [
      "What is my purpose, and am I living it fully?",
      "What do I need to let go of in order to live a more whole and vital life?",
      "After this journey, what becomes possible for me?",
    ],
    count: 4,
  },
  {
    num: "5",
    label: "Your Own Voice",
    title: "What else is in your heart?",
    subtitle: "Any question that arises from your own knowing — trust it. Write it down exactly as it comes.",
    examples: [],
    count: 6,
  },
];

const STORAGE_KEY = "vk-questions-data";

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", border: "none", borderBottom: "1px solid #D6CEBC", background: "transparent",
        fontFamily: "'Jost', sans-serif", fontSize: 14, fontWeight: 300, color: "#1A1A18",
        resize: "none", outline: "none", minHeight: 36, lineHeight: 1.7, padding: "6px 0 8px",
        overflow: "hidden", transition: "border-color 0.2s",
      }}
    />
  );
}

export default function QuestionsClient() {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (typeof saved === "object") setValues(saved);
    } catch {}
  }, []);

  function update(key: string, val: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300, color: "#1A1A18" }}>
      {/* Nav */}

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 48px 96px" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #C8A96E", paddingBottom: 40, marginBottom: 48 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: "#7A9E7E", marginBottom: 16 }}>Iboga Ceremony Preparation</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 300, color: "#1C2B1E", lineHeight: 1.1, marginBottom: 24 }}>
            Questions for<br /><em style={{ fontStyle: "italic", color: "#8B8070" }}>the Medicine</em>
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, color: "#3D3D38", maxWidth: 620 }}>
            Iboga listens. Before you arrive, take time to clarify what you are truly asking — both what you hope to resolve and what you are willing to see, feel, and be shown. These questions are seeds. Write them with sincerity and as much specificity as you can. The medicine will meet you exactly where you are.
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map((section, si) => (
          <div key={si}>
            {si > 0 && <hr style={{ border: "none", borderTop: "1px solid #D6CEBC", margin: "56px 0" }} />}

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 300, color: "#D6CEBC", lineHeight: 1, flexShrink: 0 }}>{section.num}</span>
              <div>
                <p style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "#C8A96E", marginBottom: 6 }}>{section.label}</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: "#1C2B1E" }}>{section.title}</h2>
                <p style={{ fontSize: 12, color: "#8B8070", marginTop: 4, lineHeight: 1.6 }}>{section.subtitle}</p>
              </div>
            </div>

            {/* Examples */}
            {section.examples.length > 0 && (
              <div style={{ background: "#F5F0E8", padding: "24px 28px", marginBottom: 32, borderLeft: "2px solid #A8C5AC" }}>
                <p style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "#8B8070", marginBottom: 12 }}>Examples to inspire you</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.examples.map((ex, i) => (
                    <p key={i} style={{ fontSize: 12, fontStyle: "italic", color: "#8B8070", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.5 }}>
                      &mdash; {ex}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Question rows */}
            <div style={{ marginBottom: 56 }}>
              {Array.from({ length: section.count }, (_, qi) => {
                const key = `s${si}-q${qi}`;
                return (
                  <div key={qi} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 16, alignItems: "start", marginBottom: 28 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 300, color: "#C8A96E", paddingTop: 10, textAlign: "right" }}>{qi + 1}.</span>
                    <AutoTextarea
                      value={values[key] ?? ""}
                      onChange={(v) => update(key, v)}
                      placeholder="Write your question here..."
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Closing */}
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: "#C8A96E", marginBottom: 16 }}>&#10022;</div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: "italic", lineHeight: 2, color: "#8B8070", maxWidth: 480, margin: "0 auto" }}>
            Bring these questions with you &mdash; written, held, and felt in your body.<br />
            The medicine already knows. You are simply learning to ask.
          </p>
        </div>
      </div>
    </div>
  );
}
