"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const SECTIONS = [
  {
    num: "1",
    label: "Healing & the Body",
    title: "What do you want to heal?",
    subtitle: "Physical, emotional, relational, what are you carrying that is ready to be released?",
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
    subtitle: "What patterns, beliefs, or truths are ready to come into the light, about yourself, others, or the life you are living?",
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
    subtitle: "Toward yourself and others, where is there unresolved pain, resentment, or grief that is ready to be met with grace?",
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
    subtitle: "Beyond healing, what are you moving toward? What life, version of yourself, or quality of being are you called to step into?",
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
    subtitle: "Any question that arises from your own knowing, trust it. Write it down exactly as it comes.",
    examples: [],
    count: 6,
  },
];

const STORAGE_KEY = "vk-questions-data";
// Timestamp of the last local write, used on load to decide whether the
// device copy or the server copy is more recent.
const SAVED_AT_KEY = "vk-questions-saved-at";
// Prefix used for Questions-for-the-Medicine keys inside the shared
// `member_journals.responses` JSONB blob, so they don't collide with the
// pre/post-ceremony journal prompt keys.
const QFTM_PREFIX = "qftm-";

function AutoTextarea({ value, onChange, onBlur, placeholder }: { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder: string }) {
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
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        width: "100%", border: "none", borderBottom: "1px solid #D6CEBC", background: "transparent",
        fontFamily: "'Jost', sans-serif", fontSize: 16, fontWeight: 300, color: "#1A1A18",
        resize: "none", outline: "none", minHeight: 40, lineHeight: 1.7, padding: "8px 0 10px",
        overflow: "hidden", transition: "border-color 0.2s",
      }}
    />
  );
}

export default function QuestionsClient() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const supabaseRef = useRef(createClient());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs mirror the latest state so the flush handlers (registered once) and
  // the in-flight save queue always act on current data, not a stale closure.
  const valuesRef = useRef<Record<string, string>>({});
  const userIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef<Record<string, string> | null>(null);

  // Write the current answers to Supabase. Single-flight: if a save is already
  // in progress, the latest payload is queued and written right after, so the
  // most recent edit always wins and concurrent upserts can't clobber it.
  async function persist(next: Record<string, string>) {
    const userId = userIdRef.current;
    if (!userId) return;
    if (savingRef.current) { pendingRef.current = next; return; }
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const supabase = supabaseRef.current;
      const { data } = await supabase
        .from("member_journals")
        .select("responses")
        .eq("member_id", userId)
        .maybeSingle();
      const existing = (data?.responses as Record<string, string>) ?? {};
      // Keep non-QFTM keys (pre/post journal answers); replace all QFTM keys
      // with the current set so emptied questions are cleared, not left behind.
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries(existing)) {
        if (!k.startsWith(QFTM_PREFIX)) merged[k] = v;
      }
      for (const [k, v] of Object.entries(next)) merged[`${QFTM_PREFIX}${k}`] = v;
      const savedAt = new Date().toISOString();
      const { error } = await supabase
        .from("member_journals")
        .upsert(
          { member_id: userId, responses: merged, last_saved_at: savedAt },
          { onConflict: "member_id" },
        );
      if (error) throw error;
      try { localStorage.setItem(SAVED_AT_KEY, savedAt); } catch {}
      dirtyRef.current = false;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1800);
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        const queued = pendingRef.current;
        pendingRef.current = null;
        void persist(queued);
      }
    }
  }

  // Write whatever is pending immediately, cancelling the debounce. Called when
  // the field blurs, the tab is hidden, the page closes, or the component
  // unmounts — so an edit is never lost to a navigation that beats the timer.
  function flushNow() {
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    void persist(valuesRef.current);
  }

  // Load: localStorage first (instant), then reconcile with Supabase. Whichever
  // copy was written most recently wins — so a dropped save on this device is
  // not overwritten by an older server copy (the cause of edits "reverting"),
  // while a newer copy saved on another device still syncs in.
  useEffect(() => {
    let localSavedAt: string | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved && typeof saved === "object") { setValues(saved); valuesRef.current = saved; }
      localSavedAt = localStorage.getItem(SAVED_AT_KEY);
    } catch {}

    let cancelled = false;
    (async () => {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userIdRef.current = user.id;
      const { data } = await supabase
        .from("member_journals")
        .select("responses, last_saved_at")
        .eq("member_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const responses = (data?.responses as Record<string, string>) ?? {};
      const fromServer: Record<string, string> = {};
      for (const [k, v] of Object.entries(responses)) {
        if (k.startsWith(QFTM_PREFIX) && typeof v === "string") {
          fromServer[k.slice(QFTM_PREFIX.length)] = v;
        }
      }
      const serverSavedAt = (data?.last_saved_at as string | undefined) ?? undefined;
      const serverNewer =
        !!serverSavedAt && (!localSavedAt || new Date(serverSavedAt) >= new Date(localSavedAt));

      if (serverNewer && Object.keys(fromServer).length > 0) {
        setValues((prev) => { const m = { ...prev, ...fromServer }; valuesRef.current = m; return m; });
      } else if (!serverNewer && localSavedAt && Object.keys(valuesRef.current).length > 0) {
        // Local edits are newer than the server (a save was likely dropped) —
        // push them up so the server is current again.
        void persist(valuesRef.current);
      }
    })();
    return () => { cancelled = true };
  }, []);

  // Flush pending saves when the page is hidden, closed, or unmounted.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushNow(); };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onHide);
      flushNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key: string, val: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      valuesRef.current = next;
      dirtyRef.current = true;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
      } catch {}
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persist(next);
      }, 1000);
      return next;
    });
  }

  function handlePrint() {
    flushNow();
    window.print();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300, color: "#1A1A18" }}>
      <style>{`
        .qftm-print { display: none; }
        @media print {
          .qftm-screen { display: none !important; }
          .qftm-print { display: block !important; }
          @page { margin: 0.75in; }
        }
      `}</style>

      <div className="qftm-screen">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 48px 96px" }}>
        {/* Print */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={handlePrint}
            style={{
              fontFamily: "'Jost', sans-serif", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase",
              fontWeight: 500, color: "#1C2B1E", background: "transparent", border: "1px solid #C8A96E",
              borderRadius: 999, padding: "10px 22px", cursor: "pointer",
            }}
          >
            Print
          </button>
        </div>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #C8A96E", paddingBottom: 40, marginBottom: 48 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase", color: "#7A9E7E", marginBottom: 18, fontWeight: 500 }}>Iboga Ceremony Preparation</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 300, color: "#1C2B1E", lineHeight: 1.1, marginBottom: 24 }}>
            Questions for<br /><em style={{ fontStyle: "italic", color: "#8B8070" }}>the Medicine</em>
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: "#3D3D38", maxWidth: 660 }}>
            Iboga listens. Before you arrive, take time to clarify what you are truly asking, both what you hope to resolve and what you are willing to see, feel, and be shown. These questions are seeds. Write them with sincerity and as much specificity as you can. The medicine will meet you exactly where you are.
          </p>
          <p style={{ fontSize: 12.5, fontStyle: "italic", color: "#8B8070", marginTop: 16 }}>
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved."}
            {saveStatus === "error" && "Couldn’t save just now — your writing is kept on this device."}
            {saveStatus === "idle" && "Your writing saves automatically as you type. Return any time to continue."}
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map((section, si) => (
          <div key={si}>
            {si > 0 && <hr style={{ border: "none", borderTop: "1px solid #D6CEBC", margin: "56px 0" }} />}

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 72, fontWeight: 300, color: "#D6CEBC", lineHeight: 1, flexShrink: 0 }}>{section.num}</span>
              <div>
                <p style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", color: "#C8A96E", marginBottom: 8, fontWeight: 500 }}>{section.label}</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400, color: "#1C2B1E", marginBottom: 8 }}>{section.title}</h2>
                <p style={{ fontSize: 15.5, color: "#5C5A4F", marginTop: 4, lineHeight: 1.65 }}>{section.subtitle}</p>
              </div>
            </div>

            {/* Examples */}
            {section.examples.length > 0 && (
              <div style={{ background: "#F5F0E8", padding: "24px 28px", marginBottom: 32, borderLeft: "2px solid #A8C5AC" }}>
                <p style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#7A7466", marginBottom: 14, fontWeight: 500 }}>Examples to inspire you</p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {section.examples.map((ex, i) => (
                    <li key={i} style={{ position: "relative", paddingLeft: 18, fontSize: 17, fontStyle: "italic", color: "#5C5A4F", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.5 }}>
                      <span aria-hidden style={{ position: "absolute", left: 0, top: 0, color: "#A8C5AC" }}>·</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Question rows */}
            <div style={{ marginBottom: 56 }}>
              {Array.from({ length: section.count }, (_, qi) => {
                const key = `s${si}-q${qi}`;
                return (
                  <div key={qi} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 16, alignItems: "start", marginBottom: 28 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: "#C8A96E", paddingTop: 10, textAlign: "right" }}>{qi + 1}.</span>
                    <AutoTextarea
                      value={values[key] ?? ""}
                      onChange={(v) => update(key, v)}
                      onBlur={flushNow}
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
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontStyle: "italic", lineHeight: 1.75, color: "#8B8070", maxWidth: 520, margin: "0 auto" }}>
            Bring these questions with you, written, held, and felt in your body.<br />
            The medicine already knows. You are simply learning to ask.
          </p>
        </div>
      </div>
      </div>{/* /qftm-screen */}

      {/* Print-only view: just the prompts and the full answers */}
      <div className="qftm-print" style={{ padding: "0.25in 0", color: "#111", fontFamily: "'Jost', sans-serif" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400, color: "#1C2B1E", marginBottom: 2 }}>Questions for the Medicine</h1>
        <p style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7A7466", marginBottom: 28 }}>Iboga Ceremony Preparation</p>
        {SECTIONS.map((section, si) => {
          const answers = Array.from({ length: section.count }, (_, qi) => (values[`s${si}-q${qi}`] ?? "").trim()).filter(Boolean);
          if (answers.length === 0) return null;
          return (
            <div key={si} style={{ marginBottom: 24, pageBreakInside: "avoid", breakInside: "avoid" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, color: "#1C2B1E", marginBottom: 10 }}>{section.title}</h2>
              <ol style={{ margin: 0, paddingLeft: 22 }}>
                {answers.map((a, i) => (
                  <li key={i} style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 8, whiteSpace: "pre-wrap" }}>{a}</li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
