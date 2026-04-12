"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly — or being fidgety and restless",
  "Thoughts that you would be better off dead or of hurting yourself",
];

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

const FREQ_LABELS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

function SurveyContent() {
  const params = useSearchParams();
  const taskId = params.get("task");
  const timepoint = params.get("tp");
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [phq9, setPhq9] = useState<number[]>(Array(9).fill(-1));
  const [gad7, setGad7] = useState<number[]>(Array(7).fill(-1));
  const [craving, setCraving] = useState<number | null>(null);
  const [abstinent, setAbstinent] = useState("");
  const [relapse, setRelapse] = useState<boolean | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not logged in"); setSubmitting(false); return; }

    const { error: err } = await supabase.from("outcome_assessments").upsert({
      member_id: user.id,
      timepoint: timepoint ?? "1_month",
      assessment_date: new Date().toISOString().split("T")[0],
      phq9_q1: phq9[0], phq9_q2: phq9[1], phq9_q3: phq9[2],
      phq9_q4: phq9[3], phq9_q5: phq9[4], phq9_q6: phq9[5],
      phq9_q7: phq9[6], phq9_q8: phq9[7], phq9_q9: phq9[8],
      gad7_q1: gad7[0], gad7_q2: gad7[1], gad7_q3: gad7[2],
      gad7_q4: gad7[3], gad7_q5: gad7[4], gad7_q6: gad7[5],
      gad7_q7: gad7[6],
      craving_intensity: craving,
      days_abstinent: abstinent ? parseInt(abstinent) : null,
      relapse_occurred: relapse,
      sleep_quality: sleep,
      completed_by: "member",
    }, { onConflict: "member_id,ceremony_id,timepoint" });

    if (err) { setError(err.message); setSubmitting(false); return; }

    if (taskId) {
      await supabase
        .from("followup_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", taskId);
    }
    setStep(3);
    setSubmitting(false);
  }

  const btnBase: React.CSSProperties = {
    flex: 1, minWidth: 80, padding: "8px 10px", borderRadius: 7,
    border: "0.5px solid rgba(0,0,0,0.15)", fontSize: 12, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
  };

  if (step === 3) return (
    <div style={{ maxWidth: 540, margin: "4rem auto", padding: "0 2rem", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>&#10003;</div>
      <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, marginBottom: 12 }}>Thank you</h2>
      <p style={{ fontSize: 15, color: "#6B6B67", lineHeight: 1.7 }}>Your responses have been received. We hold this data with care and use it to support your integration.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem", fontFamily: "var(--font-body, sans-serif)" }}>
      <a href="/portal" style={{ fontSize: 12, color: "#6B6B67", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>&larr; Return to Portal</a>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9E9E9A", marginBottom: 8 }}>
        Check-in &middot; Step {step + 1} of 3
      </p>
      <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 24, fontWeight: 400, marginBottom: "1.5rem" }}>
        {step === 0 ? "How have you been feeling?" : step === 1 ? "Anxiety & worry" : "Lifestyle & recovery"}
      </h2>

      {step === 0 && (
        <div>
          <p style={{ fontSize: 13, color: "#6B6B67", marginBottom: "1rem", lineHeight: 1.6 }}>Over the past 2 weeks, how often have you been bothered by any of the following?</p>
          {PHQ9_QUESTIONS.map((q, i) => (
            <div key={i} style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: 14, marginBottom: 10, lineHeight: 1.5 }}>{q}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FREQ_LABELS.map((l, v) => (
                  <button key={v} onClick={() => setPhq9((prev) => { const n = [...prev]; n[i] = v; return n; })}
                    style={{ ...btnBase, background: phq9[i] === v ? "#1C2B1E" : "#fff", color: phq9[i] === v ? "#F5F0E8" : "#6B6B67" }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setStep(1)} disabled={phq9.some((v) => v === -1)}
            style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "#1C2B1E", color: "#F5F0E8", fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: phq9.some((v) => v === -1) ? 0.4 : 1 }}>Continue &rarr;</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <p style={{ fontSize: 13, color: "#6B6B67", marginBottom: "1rem", lineHeight: 1.6 }}>Over the past 2 weeks, how often were you bothered by these feelings?</p>
          {GAD7_QUESTIONS.map((q, i) => (
            <div key={i} style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: 14, marginBottom: 10, lineHeight: 1.5 }}>{q}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FREQ_LABELS.map((l, v) => (
                  <button key={v} onClick={() => setGad7((prev) => { const n = [...prev]; n[i] = v; return n; })}
                    style={{ ...btnBase, background: gad7[i] === v ? "#1C2B1E" : "#fff", color: gad7[i] === v ? "#F5F0E8" : "#6B6B67" }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setStep(2)} disabled={gad7.some((v) => v === -1)}
            style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "#1C2B1E", color: "#F5F0E8", fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: gad7.some((v) => v === -1) ? 0.4 : 1 }}>Continue &rarr;</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <div>
            <p style={{ fontSize: 14, marginBottom: 10 }}>Craving intensity right now (0 = none, 10 = overwhelming)</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <button key={v} onClick={() => setCraving(v)}
                  style={{ width: 44, height: 44, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: craving === v ? "#1C2B1E" : "#fff", color: craving === v ? "#F5F0E8" : "#6B6B67", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, marginBottom: 10 }}>Days since last use of any substance (if applicable)</p>
            <input type="number" value={abstinent} onChange={(e) => setAbstinent(e.target.value)} placeholder="e.g. 30"
              style={{ width: "100%", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 7, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, marginBottom: 10 }}>Any relapse since your last check-in?</p>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ v: false, l: "No" }, { v: true, l: "Yes" }].map((opt) => (
                <button key={opt.l} onClick={() => setRelapse(opt.v)}
                  style={{ flex: 1, padding: 10, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: relapse === opt.v ? "#1C2B1E" : "#fff", color: relapse === opt.v ? "#F5F0E8" : "#6B6B67", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{opt.l}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, marginBottom: 10 }}>Sleep quality this past week (0 = very poor, 10 = excellent)</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <button key={v} onClick={() => setSleep(v)}
                  style={{ width: 44, height: 44, borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: sleep === v ? "#1C2B1E" : "#fff", color: sleep === v ? "#F5F0E8" : "#6B6B67", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
              ))}
            </div>
          </div>
          {error && <p style={{ color: "#A32D2D", fontSize: 13 }}>{error}</p>}
          <button onClick={submit} disabled={submitting}
            style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: "#1C2B1E", color: "#F5F0E8", fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Submitting..." : "Submit check-in"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem", textAlign: "center", color: "#9E9E9A" }}>Loading...</div>}>
      <SurveyContent />
    </Suspense>
  );
}
