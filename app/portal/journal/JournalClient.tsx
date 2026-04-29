"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PRE_CEREMONY_WEEKS,
  POST_CEREMONY_WEEKS,
  PRE_PNE_DETAILS,
  POST_PNE_DETAILS,
  type JournalWeek,
  type PneWeekDetails,
} from "@/lib/journal-prompts";

type Phase = "pre" | "post";

const PHASES: {
  key: Phase;
  eyebrow: string;
  title: [string, string];
  weeks: JournalWeek[];
  pne: ReadonlyArray<PneWeekDetails>;
  pneKey: (weekIdx: number) => string;
}[] = [
  {
    key: "pre",
    eyebrow: "Pre-Ceremony · Weeks 1–6",
    title: ["Before the ", "Threshold"],
    weeks: PRE_CEREMONY_WEEKS,
    pne: PRE_PNE_DETAILS,
    pneKey: (w) => `pre-pne-reflection-w${w}`,
  },
  {
    key: "post",
    eyebrow: "Post-Ceremony · Weeks 1–6",
    title: ["The Work of ", "Integration"],
    weeks: POST_CEREMONY_WEEKS,
    pne: POST_PNE_DETAILS,
    pneKey: (w) => `post-pne-reflection-w${w}`,
  },
];

export default function JournalClient() {
  const [mode, setMode] = useState<"write" | "read">("write");
  const [preResponses, setPreResponses] = useState<Record<string, string>>({});
  const [postResponses, setPostResponses] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const userIdRef = useRef<string | null>(null);
  const preTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load both progress tables on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;

      const [preRes, postRes] = await Promise.all([
        supabase.from("pre_ceremony_progress").select("journal_responses").eq("member_id", user.id).maybeSingle(),
        supabase.from("post_ceremony_progress").select("journal_responses").eq("member_id", user.id).maybeSingle(),
      ]);

      if (preRes.data?.journal_responses && typeof preRes.data.journal_responses === "object") {
        setPreResponses(preRes.data.journal_responses as Record<string, string>);
      }
      if (postRes.data?.journal_responses && typeof postRes.data.journal_responses === "object") {
        setPostResponses(postRes.data.journal_responses as Record<string, string>);
      }
    }
    load();
  }, []);

  // ── Save helpers (one upsert per phase, debounced)
  const flushPre = useCallback(async (data: Record<string, string>) => {
    if (!userIdRef.current) return;
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("pre_ceremony_progress").upsert({
        member_id: userIdRef.current,
        journal_responses: data,
        last_updated: new Date().toISOString(),
      }, { onConflict: "member_id" });
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const flushPost = useCallback(async (data: Record<string, string>) => {
    if (!userIdRef.current) return;
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("post_ceremony_progress").upsert({
        member_id: userIdRef.current,
        journal_responses: data,
        last_updated: new Date().toISOString(),
      }, { onConflict: "member_id" });
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // ── Flush on tab close / visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        if (preTimerRef.current) { clearTimeout(preTimerRef.current); flushPre(preResponses); }
        if (postTimerRef.current) { clearTimeout(postTimerRef.current); flushPost(postResponses); }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [flushPre, flushPost, preResponses, postResponses]);

  function updatePre(key: string, value: string) {
    setPreResponses((prev) => {
      const next = { ...prev, [key]: value };
      if (preTimerRef.current) clearTimeout(preTimerRef.current);
      preTimerRef.current = setTimeout(() => flushPre(next), 1500);
      return next;
    });
  }

  function updatePost(key: string, value: string) {
    setPostResponses((prev) => {
      const next = { ...prev, [key]: value };
      if (postTimerRef.current) clearTimeout(postTimerRef.current);
      postTimerRef.current = setTimeout(() => flushPost(next), 1500);
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
      {/* Hero */}
      <div style={{ background: "#1C2B1E", padding: "60px 60px 56px" }}>
        <div style={{ maxWidth: 780 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.42em", textTransform: "uppercase", color: "#C8A96E", display: "block", marginBottom: 16 }}>Member Portal · Comprehensive Journal</span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 58px)", fontWeight: 300, color: "#F5F0E8", lineHeight: 1.06 }}>
            Your Journey <em style={{ fontStyle: "italic", color: "#A8C5AC" }}>Journal</em>
          </h1>
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

      {/* Body */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 60px 120px" }}>
        {PHASES.map((phase, pi) => {
          const responses = phase.key === "pre" ? preResponses : postResponses;
          const update = phase.key === "pre" ? updatePre : updatePost;

          return (
            <div key={phase.key}>
              {pi > 0 && <div style={{ height: 1, background: "linear-gradient(90deg, #C8A96E, transparent)", margin: "80px 0 0", opacity: 0.35 }} />}

              {/* Phase header */}
              <div style={{ paddingTop: 72, paddingBottom: 28, borderBottom: "1px solid rgba(28,43,30,0.12)" }}>
                <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: "#C8A96E", display: "block", marginBottom: 10 }}>{phase.eyebrow}</span>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 300, color: "#1A1A18", lineHeight: 1.1 }}>
                  {phase.title[0]}<em style={{ fontStyle: "italic", color: "#7A9E7E" }}>{phase.title[1]}</em>
                </h2>
              </div>

              {/* Weeks */}
              {phase.weeks.map((week, wi) => {
                const pneDetail = phase.pne[wi];
                const pneKey = phase.pneKey(wi);
                const pneEntry = responses[pneKey] ?? "";
                const showPne = !!(pneDetail?.reflection || pneEntry);
                return (
                <div key={wi} style={{ marginTop: 56 }}>
                  {/* Week header */}
                  <div style={{ background: "rgba(122,158,126,0.06)", borderLeft: "3px solid #7A9E7E", padding: "20px 24px", marginBottom: 28 }}>
                    <span style={{ fontSize: 8.5, letterSpacing: "0.32em", textTransform: "uppercase", color: "#7A9E7E", display: "block", marginBottom: 6 }}>
                      Week {wi + 1} &middot; {week.code} &middot; {week.theme}
                    </span>
                    {week.title && (
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 300, color: "#1A1A18", fontStyle: "italic", lineHeight: 1.3 }}>{week.title}</p>
                    )}
                  </div>

                  {/* Journal Prompts */}
                  <span style={{ fontSize: 8.5, letterSpacing: "0.36em", textTransform: "uppercase", color: "#5A5046", display: "block", marginBottom: 4, fontWeight: 500 }}>
                    Journal Prompts
                  </span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {week.prompts.map((prompt, pj) => {
                      const key = prompt.key ?? `w${wi}-p${pj}`;
                      return (
                        <div key={key} style={{ padding: "28px 0", borderBottom: pj < week.prompts.length - 1 ? "1px solid rgba(28,43,30,0.08)" : "none" }}>
                          <span style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "#7A9E7E", display: "block", marginBottom: 10, fontWeight: 600 }}>
                            {String(pj + 1).padStart(2, "0")}
                          </span>
                          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: "#1A1A18", lineHeight: 1.35, marginBottom: 12 }}>
                            {prompt.q}
                          </p>
                          {prompt.hint && (
                            <p style={{ fontSize: 13, color: "#3D4D3F", lineHeight: 1.7, marginBottom: 14, fontStyle: "italic" }}>{prompt.hint}</p>
                          )}
                          {mode === "write" ? (
                            <textarea
                              value={responses[key] ?? ""}
                              onChange={(e) => update(key, e.target.value)}
                              placeholder="Write freely..."
                              style={{
                                width: "100%",
                                minHeight: 130,
                                background: "rgba(122,158,126,0.04)",
                                border: "1px solid rgba(122,158,126,0.18)",
                                borderLeft: "2px solid #A8C5AC",
                                padding: "14px 16px",
                                fontFamily: "'Jost', sans-serif",
                                fontSize: 13.5,
                                fontWeight: 300,
                                color: "#1A1A18",
                                lineHeight: 1.85,
                                resize: "vertical",
                                outline: "none",
                              }}
                            />
                          ) : (
                            responses[key] && (
                              <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#1A1A18", lineHeight: 1.85, padding: "14px 16px", background: "rgba(122,158,126,0.04)", borderLeft: "2px solid #A8C5AC" }}>
                                {responses[key]}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* PNE Reflection */}
                  {showPne && (
                    <div style={{ marginTop: 28, padding: "26px 28px", background: "rgba(122,158,126,0.05)", border: "1px solid rgba(122,158,126,0.18)", borderLeft: "3px solid #7A9E7E" }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.32em", textTransform: "uppercase", color: "#7A9E7E", display: "block", marginBottom: 12 }}>
                        PNE Reflection
                      </span>
                      {pneDetail?.reflection ? (
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 300, color: "#1A1A18", lineHeight: 1.35, marginBottom: 12 }}>
                          {pneDetail.reflection}
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: "#3D4D3F", lineHeight: 1.7, marginBottom: 12, fontStyle: "italic" }}>
                          Your earlier PNE reflection.
                        </p>
                      )}
                      {mode === "write" ? (
                        <textarea
                          value={pneEntry}
                          onChange={(e) => update(pneKey, e.target.value)}
                          placeholder="Write freely..."
                          style={{
                            width: "100%",
                            minHeight: 130,
                            background: "rgba(245,240,232,0.96)",
                            border: "1px solid rgba(168,197,172,0.35)",
                            borderLeft: "2px solid #A8C5AC",
                            padding: "14px 16px",
                            fontFamily: "'Jost', sans-serif",
                            fontSize: 13.5,
                            fontWeight: 300,
                            color: "#1A1A18",
                            lineHeight: 1.85,
                            resize: "vertical",
                            outline: "none",
                          }}
                        />
                      ) : (
                        pneEntry && (
                          <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, color: "#1A1A18", lineHeight: 1.85 }}>{pneEntry}</p>
                        )
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          );
        })}

      </div>
    </div>
  );
}
