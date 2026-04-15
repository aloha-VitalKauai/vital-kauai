"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const PHASES = [
  {
    eyebrow: "Phase One",
    title: ["Before the ", "Threshold"],
    desc: "These prompts are for the weeks before your ceremony.",
    prompts: [
      { q: "What do I want? What is my intention?" },
      { q: "What are my greatest gifts? What is my purpose and mission in this life?", hint: "Even a partial, uncertain answer is welcome here." },
      { q: "After this journey, what becomes possible?", hint: "Let yourself dream beyond what currently feels realistic." },
      { q: "What changes in my life are being asked of me? What do I need to let go of?" },
      { q: "What am I most afraid of?", hint: "Fear named loses half its power. Let it be seen here." },
      { q: "Where am I resisting?", hint: "In my body. In my life. In my willingness to change." },
      { q: "Where am I lying to myself? What truth am I aware of somewhere that I have been choosing to look past?", hint: "Iboga is a mirror medicine \u2014 it shows what is needed. This is the invitation to find it first." },
      { q: "Where am I out of integrity? With whom or what am I called to grow in right relationship?", hint: "Iboga sees everything. You may as well arrive having already looked." },
      { q: "What shadows are showing up right now? What patterns keep returning?" },
      { q: "What is my relationship to shame? Where does it show up \u2014 or where has it shaped me?" },
      { q: "Where do I go when I feel dysregulated? What is my dominant pattern \u2014 fight, flight, freeze, or fawn?", hint: "Observe without judgment. This is self-knowledge, not self-criticism." },
      { q: "How do I create safety within myself? What brings me back to center?" },
      { q: "Who do I need to forgive in order to feel free?", hint: "Forgiveness is releasing the weight you carry on their behalf." },
      { q: "Where do I need to forgive myself?" },
      { q: "How will I connect with my support team \u2014 and what specific support do I need from them?" },
    ],
  },
  {
    eyebrow: "Post-Ceremony",
    title: ["The Days ", "After"],
    desc: "The first three days after ceremony are sacred and tender. The medicine is still moving. Rest in the body. Let impressions surface in their own time.",
    isPhaseHeader: true,
    prompts: [
      { q: "What is present in my body right now? Where do I feel the most sensation, heaviness, lightness, or aliveness?", hint: "Stay in the body. Stay with sensation.", placeholder: "Describe sensations, feelings, impressions..." },
      { q: "What images, impressions, or moments from ceremony keep returning? What feels most alive \u2014 or most unresolved?", hint: "Record them without needing to understand them yet. They will speak more clearly in time.", placeholder: "Images, scenes, symbols, feelings \u2014 anything that surfaces..." },
      { q: "What was shown to me that I already knew, but had been unwilling or unable to see?" },
      { q: "What is one thing I feel called to do, release, or begin?", hint: "Trust the impulse. Write it down before the mind catches up." },
      { q: "What did the medicine show me about my own nature \u2014 who I truly am beneath the patterns, stories, and defenses?" },
      { q: "What relationships, dynamics, or patterns were illuminated? What did I see about how I show up with others?" },
      { q: "Where did I feel the most resistance during the journey? What was I holding onto \u2014 and what happened when I let go?" },
      { q: "What do I feel grateful for today \u2014 in my body, in this moment, in having said yes to this?", hint: "Let gratitude be specific. The smaller the detail, the more real it lands." },
      { q: "Looking back at the intentions I set before ceremony \u2014 what was answered, exceeded, or transformed beyond what I could have imagined? What is still emerging or calling for attention?" },
      { q: "What do I know now that I did not know three days ago?", hint: "About yourself, your life, your relationships, your body, your purpose. Be specific." },
      { q: "What one commitment am I making to myself as I begin the return home?", hint: "Make it concrete. Make it something you can hold yourself to." },
      { q: "What do I want to say to the version of me who arrived here \u2014 the one who was afraid, uncertain, or carrying so much?", hint: "Write them a letter if you wish. You know things now they needed to hear.", placeholder: "Dear [your name]...", tall: true },
    ],
  },
  {
    eyebrow: "Phase Three",
    title: ["The Work of ", "Integration"],
    desc: "Integration is where ceremony becomes life. These prompts are designed to be worked with slowly, over weeks \u2014 returned to as new layers surface and as you encounter yourself in the ordinary world with new eyes. You have all the time you need. The medicine continues working long after the journey ends.",
    prompts: [
      { q: "Where am I meeting myself differently in daily life? What have I noticed about the way I move through the world since returning home?", hint: "Small shifts count. A changed reaction. A pause before responding. A new feeling in the body. Name them." },
      { q: "What old patterns, reactions, or beliefs have I noticed returning \u2014 and how am I choosing to meet them now?", hint: "Return is part of the spiral. What matters is how you respond when the familiar appears." },
      { q: "What relationships in my life are shifting as I change? Who is meeting me in my growth \u2014 and where am I feeling friction or distance?" },
      { q: "What commitments did I make \u2014 to myself, to a new way of being \u2014 and how am I honoring them? Where do I need more support or structure?" },
      { q: "What does my body need right now in this integration phase? How is it speaking to me \u2014 and am I listening?", hint: "Sleep, nourishment, movement, stillness, touch, nature. Let the body lead." },
      { q: "What is still alive and in process? What is still seeking form in words, understanding, or action?", hint: "Name the open edges. The most important material sometimes takes the longest to land." },
      { q: "What forgiveness work is still alive in me? Who or what am I still in the process of releasing?", hint: "Forgiveness is rarely a single moment. It is a practice. Be honest about where you are in it." },
      { q: "What is the medicine still teaching me? What insights continue to surface \u2014 in dreams, synchronicities, or the quiet moments?", placeholder: "Dreams, symbols, moments of knowing..." },
      { q: "How has my sense of purpose shifted or clarified? What am I called to create, offer, or become in this next chapter?" },
      { q: "Who am I now? How would I describe the person who arrived \u2014 and the person standing here today?", hint: "Write this one without holding back. You have earned the right to see yourself clearly.", tall: true },
    ],
  },
];

export default function JournalClient() {
  const [mode, setMode] = useState<"write" | "read">("write");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, string>>({});
  const userIdRef = useRef<string | null>(null);

  const flushToSupabase = useCallback(async (data: Record<string, string>) => {
    if (!userIdRef.current) return;
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("member_journals")
        .upsert({
          member_id: userIdRef.current,
          responses: data,
          last_saved_at: new Date().toISOString(),
        }, { onConflict: "member_id" });
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // Load from Supabase on mount, fall back to localStorage
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;

      const { data } = await supabase
        .from("member_journals")
        .select("responses")
        .eq("member_id", user.id)
        .maybeSingle();

      if (data?.responses && typeof data.responses === "object") {
        setValues(data.responses as Record<string, string>);
        try { localStorage.setItem("vk-journal-data", JSON.stringify(data.responses)); } catch {}
      } else {
        // Migrate from localStorage if exists
        try {
          const local = JSON.parse(localStorage.getItem("vk-journal-data") || "{}");
          if (typeof local === "object" && Object.keys(local).length > 0) {
            setValues(local);
            flushToSupabase(local); // Migrate to Supabase
          }
        } catch {}
      }
    }
    load();
  }, [flushToSupabase]);

  // Flush on tab close / visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden" && Object.keys(pendingRef.current).length > 0) {
        flushToSupabase(pendingRef.current);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [flushToSupabase]);

  function updateField(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      pendingRef.current = next;
      try { localStorage.setItem("vk-journal-data", JSON.stringify(next)); } catch {}

      // Debounced save to Supabase
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushToSupabase(next), 1500);

      return next;
    });
  }

  let promptIndex = 0;

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
      {/* Nav */}

      {/* Hero */}
      <div style={{ background: "#1C2B1E", padding: "72px 60px 68px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 780 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.42em", textTransform: "uppercase", color: "#C8A96E", display: "block", marginBottom: 16 }}>Member Portal &middot; Iboga Journey</span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 58px)", fontWeight: 300, color: "#F5F0E8", lineHeight: 1.06, marginBottom: 20 }}>
            Your Journey<br /><em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Journal</em>
          </h1>
          <p style={{ fontSize: 14.5, color: "rgba(245,240,232,0.58)", lineHeight: 1.95, maxWidth: 580, marginBottom: 28 }}>
            This journal is a companion for the full arc of your iboga journey &mdash; from the questions you carry in, to the tender silence after ceremony, to the long, sacred work of integration. There are no right answers here. Only honest ones.
          </p>
          <p style={{ fontSize: 12, color: "rgba(245,240,232,0.3)", borderLeft: "2px solid rgba(168,197,172,0.2)", paddingLeft: 14, lineHeight: 1.7 }}>
            Everything here is an invitation, not a requirement. Take what serves you. Leave the rest.
          </p>
        </div>
      </div>

      {/* Mode bar */}
      <div style={{ position: "sticky", top: 60, zIndex: 40, background: "white", borderBottom: "1px solid rgba(28,43,30,0.1)", padding: "0 60px", display: "flex", alignItems: "center", height: 54, gap: 24 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "#8B8070", whiteSpace: "nowrap" }}>How would you like to use this journal?</span>
        <div style={{ display: "flex", border: "1px solid rgba(28,43,30,0.1)" }}>
          {(["write", "read"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", background: mode === m ? "#1C2B1E" : "transparent", color: mode === m ? "#F5F0E8" : "#8B8070", transition: "all 0.25s", whiteSpace: "nowrap" }}>
              {m === "write" ? "Write Here" : "Use in My Journal"}
            </button>
          ))}
        </div>
        {saveStatus && (
          <span style={{ fontSize: 9, letterSpacing: "0.12em", color: saveStatus === "saved" ? "#4e7250" : saveStatus === "saving" ? "#8a7250" : "#c4846a", marginLeft: "auto", whiteSpace: "nowrap" }}>
            {saveStatus === "saving" ? "Saving\u2026" : saveStatus === "saved" ? "Saved" : "Not saved"}
          </span>
        )}
        <button onClick={() => window.print()} style={{ marginLeft: saveStatus ? 0 : "auto", fontFamily: "'Jost', sans-serif", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: "10px 16px", border: "1px solid rgba(28,43,30,0.1)", cursor: "pointer", background: "transparent", color: "#8B8070" }}>Print Journal</button>
      </div>

      {/* Journal content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 60px 120px" }}>
        {/* How to use */}
        <div style={{ background: "#1C2B1E", padding: "40px 44px", marginTop: 64, marginBottom: 64, borderLeft: "3px solid #7A9E7E" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: "#F5F0E8", marginBottom: 16 }}>How to Use This Journal</h3>
          <div style={{ fontSize: 13.5, color: "rgba(245,240,232,0.62)", lineHeight: 1.9 }}>
            <p>This journal moves through three phases: the questions you arrive with, the rawness of the days immediately after ceremony, and the integration weeks where the real work takes root. You do not need to move through it in order &mdash; let the prompts find you when they are ready.</p>
            <p style={{ marginTop: 12 }}>In <strong style={{ color: "#F5F0E8", fontWeight: 400 }}>Write Here</strong> mode, your responses are saved privately to your browser. In <strong style={{ color: "#F5F0E8", fontWeight: 400 }}>Use in My Journal</strong> mode, prompts display cleanly for you to work with in your own notebook.</p>
            <p style={{ marginTop: 12 }}>Some prompts will land immediately. Others may take days to open. Return to these pages as often as you wish &mdash; they will meet you differently each time.</p>
          </div>
        </div>

        {PHASES.map((phase, pi) => {
          const phaseStartIndex = promptIndex;
          return (
            <div key={pi}>
              {pi > 0 && <div style={{ height: 1, background: "linear-gradient(90deg, #A8C5AC, transparent)", margin: "64px 0", opacity: 0.4 }} />}

              {/* Phase header */}
              {phase.isPhaseHeader ? (
                <div style={{ background: "rgba(122,158,126,0.06)", border: "1px solid rgba(122,158,126,0.15)", padding: "28px 32px", marginBottom: 40 }}>
                  <span style={{ fontSize: 8.5, letterSpacing: "0.4em", textTransform: "uppercase", color: "#7A9E7E", display: "block", marginBottom: 8 }}>{phase.eyebrow}</span>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 300, color: "#1A1A18", marginBottom: 8 }}>{phase.title[0]}<em style={{ fontStyle: "italic", color: "#7A9E7E" }}>{phase.title[1]}</em></p>
                  <p style={{ fontSize: 13, color: "#8B8070", lineHeight: 1.8 }}>{phase.desc}</p>
                </div>
              ) : (
                <div style={{ paddingTop: 72 }}>
                  <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: "#C8A96E", display: "block", marginBottom: 10 }}>{phase.eyebrow}</span>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 300, color: "#1A1A18", lineHeight: 1.1, marginBottom: 12 }}>
                    {phase.title[0]}<em style={{ fontStyle: "italic", color: "#7A9E7E" }}>{phase.title[1]}</em>
                  </h2>
                  <p style={{ fontSize: 13.5, color: "#8B8070", lineHeight: 1.85, maxWidth: 640, paddingBottom: 48, borderBottom: "1px solid rgba(28,43,30,0.1)", marginBottom: 48 }}>{phase.desc}</p>
                </div>
              )}

              {/* Prompts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 64 }}>
                {phase.prompts.map((prompt, j) => {
                  const key = `p${pi}-${j}`;
                  promptIndex++;
                  return (
                    <div key={j} style={{ padding: "36px 0", borderBottom: j < phase.prompts.length - 1 ? "1px solid rgba(28,43,30,0.1)" : "none" }}>
                      <span style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "#7A9E7E", display: "block", marginBottom: 10 }}>
                        {String(j + 1).padStart(2, "0")}
                      </span>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 300, color: "#1A1A18", lineHeight: 1.35, marginBottom: 18 }}>
                        {prompt.q}
                      </p>
                      {prompt.hint && (
                        <p style={{ fontSize: 12, color: "#8B8070", lineHeight: 1.7, marginBottom: 16, fontStyle: "italic" }}>{prompt.hint}</p>
                      )}
                      {mode === "write" && (
                        <textarea
                          value={values[key] ?? ""}
                          onChange={(e) => updateField(key, e.target.value)}
                          placeholder={prompt.placeholder ?? "Write freely..."}
                          style={{
                            width: "100%",
                            minHeight: prompt.tall ? 180 : 130,
                            background: "rgba(122,158,126,0.04)",
                            border: "1px solid rgba(122,158,126,0.18)",
                            borderLeft: "2px solid #A8C5AC",
                            padding: "16px 18px",
                            fontFamily: "'Jost', sans-serif",
                            fontSize: 13.5,
                            fontWeight: 300,
                            color: "#1A1A18",
                            lineHeight: 1.85,
                            resize: "vertical",
                            outline: "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Closing */}
        <div style={{ background: "#1C2B1E", padding: "60px 56px", textAlign: "center", marginTop: 64, borderRadius: 0 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 300, color: "#F5F0E8", marginBottom: 16, lineHeight: 1.2 }}>
            A Hui Hou &mdash;<br /><em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Until We Meet Again</em>
          </h2>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.55)", lineHeight: 1.95, maxWidth: 500, margin: "0 auto 20px" }}>
            You walked through something real. The medicine chose you as much as you chose it. Whatever continues to unfold &mdash; we are here. Your integration team remains available, and this journal is always open.
          </p>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.55)", lineHeight: 1.95, maxWidth: 500, margin: "0 auto 20px" }}>
            Return to these pages whenever you need to remember who you are.
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: "italic", color: "rgba(245,240,232,0.38)", letterSpacing: "0.05em" }}>
            With deep reverence &mdash; Rachel & Josh &middot; Vital Kaua&#699;i
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: "#0E1A10", padding: "40px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(200,169,110,0.07)" }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, letterSpacing: "0.15em", color: "#F5F0E8", textTransform: "uppercase", fontWeight: 300 }}>Vital Kaua&#699;i</p>
        <p style={{ fontSize: 11, color: "rgba(245,240,232,0.22)", lineHeight: 1.7, textAlign: "right" }}>
          Iboga Journey Journal &middot; Confidential<br />
          <a href="/portal" style={{ color: "rgba(200,169,110,0.38)", textDecoration: "none" }}>Return to Portal</a>
        </p>
      </footer>
    </div>
  );
}
