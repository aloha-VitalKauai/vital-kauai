"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TIMEPOINTS = [
  { key: "baseline", label: "Baseline" },
  { key: "1_week", label: "1 week" },
  { key: "1_month", label: "1 month" },
  { key: "3_months", label: "3 months" },
  { key: "6_months", label: "6 months" },
  { key: "12_months", label: "12 months" },
] as const;

type Timepoint = (typeof TIMEPOINTS)[number]["key"];

function phq9Color(score: number | null) {
  if (score == null) return { bg: "", color: "#9E9E9A" };
  if (score <= 4) return { bg: "#E1F5EE", color: "#085041" };
  if (score <= 9) return { bg: "#EAF3DE", color: "#27500A" };
  if (score <= 14) return { bg: "#FAEEDA", color: "#633806" };
  return { bg: "#FCEBEB", color: "#A32D2D" };
}

function gad7Color(score: number | null) {
  if (score == null) return { bg: "", color: "#9E9E9A" };
  if (score <= 4) return { bg: "#E1F5EE", color: "#085041" };
  if (score <= 9) return { bg: "#EAF3DE", color: "#27500A" };
  if (score <= 14) return { bg: "#FAEEDA", color: "#633806" };
  return { bg: "#FCEBEB", color: "#A32D2D" };
}

function deltaDisplay(val: number | null) {
  if (val == null) return <span style={{ color: "#9E9E9A" }}>—</span>;
  const color = val < 0 ? "#1D9E75" : val > 0 ? "#A32D2D" : "#9E9E9A";
  const prefix = val > 0 ? "+" : "";
  return <span style={{ color, fontWeight: 500 }}>{prefix}{val}</span>;
}

function taskDue(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, bg: "#FCEBEB", color: "#A32D2D" };
  if (diff <= 7) return { label: `Due in ${diff}d`, bg: "#FAEEDA", color: "#633806" };
  return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, bg: "#E1F5EE", color: "#085041" };
}

const s = {
  card: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" as const },
  cardHd: { padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  label: { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 },
  statCard: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.25rem" },
  th: { padding: "9px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.1)", whiteSpace: "nowrap" as const, background: "#FAFAF8" },
  td: { padding: "10px 14px", fontSize: 13, color: "#1A1A18", borderBottom: "0.5px solid rgba(0,0,0,0.06)", verticalAlign: "middle" as const },
};

const TIMEPOINT_ORDER = ["baseline", "1_week", "1_month", "3_months", "6_months", "12_months"];

export default function OutcomesClient({
  cohort, trajectory, doseOutcome, followups,
  profileMap, memberMap, summaryStats, overdueCount,
}: {
  cohort: any[]; trajectory: any[]; doseOutcome: any[]; followups: any[];
  profileMap: Record<string, any>; memberMap: Record<string, any>;
  summaryStats: any; overdueCount: number;
}) {
  const [activeTP, setActiveTP] = useState<Timepoint>("baseline");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const supabase = createClient();

  const tpRows = trajectory.filter((r) => r.timepoint === activeTP);
  const baselineMap = Object.fromEntries(
    trajectory.filter((r) => r.timepoint === "baseline").map((r) => [r.member_id, r])
  );

  async function sendFollowup(taskId: string) {
    setSendingId(taskId);
    await supabase
      .from("followup_tasks")
      .update({ status: "sent", sent_at: new Date().toISOString(), reminder_count: 1 })
      .eq("id", taskId);
    setSendingId(null);
    window.location.reload();
  }

  // Chart data
  const chartPoints = TIMEPOINT_ORDER.map((tp) => cohort.find((r) => r.timepoint === tp)).filter(Boolean);
  const xPos = [80, 152, 224, 296, 368, 440];
  const yFromScore = (score: number, max: number) => 180 - (score / max) * 160;

  const phq9Points = chartPoints
    .map((r, i) => (r?.phq9_mean ? `${xPos[i]},${yFromScore(r.phq9_mean, 27).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");
  const gad7Points = chartPoints
    .map((r, i) => (r?.gad7_mean ? `${xPos[i]},${yFromScore(r.gad7_mean, 21).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Research &middot; Longitudinal data</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1rem" }}>Outcomes</h1>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0E1A10", color: "#E2CFA0", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 4, marginBottom: "1.25rem" }}>
        &#9673; Research dataset &middot; PHQ-9 &middot; GAD-7 &middot; Dose linkage &middot; 6 timepoints
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: "1.25rem" }}>
        {[
          { label: "Participants", value: String(summaryStats.totalParticipants), sub: "with baseline assessment" },
          { label: "PHQ-9 at 1 month", value: summaryStats.phq9OneMonthMean ?? "—", color: summaryStats.phq9OneMonthMean != null ? "#1D9E75" : undefined, delta: summaryStats.phq9Delta },
          { label: "GAD-7 at 1 month", value: summaryStats.gad7OneMonthMean ?? "—", color: summaryStats.gad7OneMonthMean != null ? "#1D9E75" : undefined, delta: summaryStats.gad7Delta },
          { label: "Relapse rate (3 mo)", value: summaryStats.relapseRate3m != null ? `${summaryStats.relapseRate3m}%` : "—", color: summaryStats.relapseRate3m ? "#EF9F27" : undefined },
          { label: "Abstinent days (1 mo)", value: summaryStats.abstinentDays1m ?? "—", sub: "addiction cohort only" },
        ].map((c) => (
          <div key={c.label} style={s.statCard}>
            <p style={{ ...s.label, marginBottom: 6 }}>{c.label}</p>
            <p style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: c.color ?? "#1A1A18", margin: 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 4 }}>{c.sub}</p>}
            {c.delta != null && (
              <p style={{ fontSize: 12, color: c.delta < 0 ? "#1D9E75" : "#A32D2D", fontWeight: 500, marginTop: 4 }}>
                {c.delta > 0 ? "+" : ""}{c.delta} from baseline
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Cohort Table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
        {/* SVG Chart */}
        <div style={s.card}>
          <div style={s.cardHd}><span style={s.label}>PHQ-9 & GAD-7 trajectory — cohort mean</span></div>
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
              {[{ color: "#1D6B4A", label: "PHQ-9 Depression" }, { color: "#378ADD", label: "GAD-7 Anxiety" }].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B6B67" }}>
                  <div style={{ width: 10, height: 3, background: l.color, borderRadius: 2 }} />
                  {l.label}
                </div>
              ))}
            </div>
            {chartPoints.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No outcome data yet — assessments appear here as members complete surveys.</div>
            ) : (
              <svg viewBox="0 0 460 200" style={{ width: "100%", overflow: "visible" }}>
                {[20, 60, 100, 140, 180].map((y) => <line key={y} x1="48" y1={y} x2="440" y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />)}
                {[{ y: 20, v: 27 }, { y: 60, v: 20 }, { y: 100, v: 14 }, { y: 140, v: 7 }, { y: 180, v: 0 }].map((l) => (
                  <text key={l.v} x="38" y={l.y + 3} fontSize="10" fill="#9E9E9A" fontFamily="Jost,sans-serif" textAnchor="end">{l.v}</text>
                ))}
                {chartPoints.map((r, i) => (
                  <text key={r.timepoint} x={xPos[i]} y="198" fontSize="10" fill="#9E9E9A" fontFamily="Jost,sans-serif" textAnchor="middle">
                    {TIMEPOINTS.find((t) => t.key === r.timepoint)?.label ?? r.timepoint}
                  </text>
                ))}
                <line x1="80" y1="20" x2="80" y2="182" stroke="#C8A96E" strokeWidth="1" strokeDasharray="3,3" />
                <text x="84" y="32" fontSize="9" fill="#C8A96E" fontFamily="Jost,sans-serif" letterSpacing="0.05em">CEREMONY</text>
                {phq9Points && <polyline points={phq9Points} stroke="#1D6B4A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                {gad7Points && <polyline points={gad7Points} stroke="#378ADD" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
                {chartPoints.map((r, i) => (
                  <g key={r.timepoint}>
                    {r.phq9_mean && <circle cx={xPos[i]} cy={yFromScore(r.phq9_mean, 27)} r="4" fill="#1D6B4A" />}
                    {r.gad7_mean && <circle cx={xPos[i]} cy={yFromScore(r.gad7_mean, 21)} r="4" fill="#378ADD" />}
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Cohort summary table */}
        <div style={s.card}>
          <div style={s.cardHd}><span style={s.label}>Cohort summary by timepoint</span></div>
          <div style={{ overflowX: "auto" }}>
            {cohort.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No data yet</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["Timepoint", "n", "PHQ-9", "GAD-7", "Relapse%", "Abstinent d"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {TIMEPOINT_ORDER.map((tp) => cohort.find((r) => r.timepoint === tp)).filter(Boolean).map((r) => {
                    const p = phq9Color(r.phq9_mean);
                    const g = gad7Color(r.gad7_mean);
                    return (
                      <tr key={r.timepoint}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{TIMEPOINTS.find((t) => t.key === r.timepoint)?.label ?? r.timepoint}</td>
                        <td style={s.td}>{r.n}</td>
                        <td style={s.td}>{r.phq9_mean != null ? <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: p.bg, color: p.color }}>{r.phq9_mean}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}</td>
                        <td style={s.td}>{r.gad7_mean != null ? <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: g.bg, color: g.color }}>{r.gad7_mean}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}</td>
                        <td style={{ ...s.td, color: r.relapse_rate_pct > 0 ? "#EF9F27" : "#9E9E9A", fontWeight: r.relapse_rate_pct > 0 ? 500 : 300 }}>{r.relapse_rate_pct != null ? `${r.relapse_rate_pct}%` : "—"}</td>
                        <td style={{ ...s.td, color: r.abstinent_days_mean ? "#1A1A18" : "#9E9E9A" }}>{r.abstinent_days_mean ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Participant table */}
      <div style={{ ...s.card, marginBottom: "1.25rem" }}>
        <div style={{ ...s.cardHd, flexWrap: "wrap", gap: 12 }}>
          <span style={s.label}>Individual participant outcomes</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIMEPOINTS.map((tp) => (
              <button key={tp.key} onClick={() => setActiveTP(tp.key)} style={{
                padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                border: "0.5px solid rgba(0,0,0,0.1)", fontFamily: "inherit",
                background: activeTP === tp.key ? "#1C2B1E" : "#fff",
                color: activeTP === tp.key ? "#F5F0E8" : "#6B6B67",
                fontWeight: activeTP === tp.key ? 500 : 300,
                transition: "all 0.15s",
              }}>{tp.label}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {tpRows.length === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No assessments at this timepoint yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Member", "Guide", "PHQ-9", "\u0394 PHQ-9", "GAD-7", "\u0394 GAD-7", "Craving", "Abstinent d", "Relapse", "QoL", "PGI-S"].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {tpRows.map((row) => {
                  const profile = profileMap[row.member_id];
                  const member = memberMap[profile?.email ?? ""];
                  const bl = baselineMap[row.member_id];
                  const phq9D = row.phq9_total != null && bl?.phq9_total != null ? row.phq9_total - bl.phq9_total : null;
                  const gad7D = row.gad7_total != null && bl?.gad7_total != null ? row.gad7_total - bl.gad7_total : null;
                  const p = phq9Color(row.phq9_total);
                  const g = gad7Color(row.gad7_total);
                  return (
                    <tr key={row.member_id}>
                      <td style={s.td}>
                        <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{profile?.full_name ?? profile?.email ?? "Unknown"}</p>
                        <p style={{ fontSize: 11, color: "#9E9E9A", margin: "2px 0 0" }}>{member?.journey_focus ?? ""}</p>
                      </td>
                      <td style={{ ...s.td, color: "#6B6B67" }}>{member?.assigned_partner ?? "—"}</td>
                      <td style={s.td}>{row.phq9_total != null ? <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: p.bg, color: p.color }}>{row.phq9_total}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}</td>
                      <td style={s.td}>{deltaDisplay(phq9D)}</td>
                      <td style={s.td}>{row.gad7_total != null ? <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: g.bg, color: g.color }}>{row.gad7_total}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}</td>
                      <td style={s.td}>{deltaDisplay(gad7D)}</td>
                      <td style={{ ...s.td, color: row.craving_intensity != null ? (row.craving_intensity >= 7 ? "#A32D2D" : "#1A1A18") : "#9E9E9A" }}>{row.craving_intensity != null ? `${row.craving_intensity}/10` : "—"}</td>
                      <td style={{ ...s.td, color: row.days_abstinent != null ? "#1A1A18" : "#9E9E9A" }}>{row.days_abstinent ?? "—"}</td>
                      <td style={s.td}>{row.relapse_occurred === true ? <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "#FCEBEB", color: "#A32D2D", fontWeight: 500 }}>Yes</span> : row.relapse_occurred === false ? <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "#E1F5EE", color: "#085041", fontWeight: 500 }}>No</span> : <span style={{ color: "#9E9E9A" }}>—</span>}</td>
                      <td style={{ ...s.td, color: row.qol_total != null ? "#1A1A18" : "#9E9E9A" }}>{row.qol_total != null ? `${row.qol_total}/25` : "—"}</td>
                      <td style={{ ...s.td, color: row.pgis_score != null ? "#1A1A18" : "#9E9E9A" }}>{row.pgis_score ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Follow-up queue + Dose linkage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Follow-up queue */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <span style={s.label}>Follow-up queue</span>
            {overdueCount > 0 && <span style={{ background: "#FCEBEB", color: "#A32D2D", fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 500 }}>{overdueCount} overdue</span>}
          </div>
          <div style={{ padding: "1rem" }}>
            {followups.length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No pending follow-ups — tasks auto-create when a ceremony is marked Complete.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {followups.map((task) => {
                  const due = taskDue(task.due_date);
                  const tp = TIMEPOINTS.find((t) => t.key === task.timepoint)?.label ?? task.timepoint;
                  return (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FAFAF8", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1A18" }}>{task.member_id}</div>
                        <div style={{ fontSize: 11, color: "#9E9E9A" }}>{tp} survey</div>
                      </div>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, fontWeight: 500, background: due.bg, color: due.color, whiteSpace: "nowrap" }}>{due.label}</span>
                      <button onClick={() => sendFollowup(task.id)} disabled={sendingId === task.id || task.status === "sent"} style={{
                        fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.12)",
                        background: task.status === "sent" ? "#E1F5EE" : "#fff",
                        color: task.status === "sent" ? "#085041" : "#6B6B67",
                        cursor: task.status === "sent" ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>{sendingId === task.id ? "..." : task.status === "sent" ? "Sent \u2713" : "Send \u2192"}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dose linkage */}
        <div style={s.card}>
          <div style={s.cardHd}>
            <span style={s.label}>Dose → outcome linkage</span>
            <span style={{ fontSize: 11, color: "#9E9E9A" }}>mg/kg &middot; PHQ-9 \u0394 at 1 month</span>
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            {doseOutcome.length === 0 ? (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>Dose + outcome data appears here once dosing records and 1-month assessments are entered.</div>
            ) : (
              <div>
                {doseOutcome.filter((r) => r.timepoint === "1_month" && r.dose_mg != null).map((r) => (
                  <div key={`${r.member_id}-${r.timepoint}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "0.5px solid rgba(0,0,0,0.06)", padding: "12px 0", alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.member_id}</div>
                      <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 2 }}>{r.batch_code ?? "No batch"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { label: "Dose mg", val: r.dose_mg },
                        { label: "mg/kg", val: r.dose_mg_per_kg },
                        { label: "Ibogaine%", val: r.ibogaine_pct ? `${r.ibogaine_pct}%` : null },
                        { label: "PHQ-9 \u0394", val: r.phq9_change, color: r.phq9_change < 0 ? "#1D9E75" : "#A32D2D" },
                        { label: "QTc peak", val: r.qtc_peak ? `${r.qtc_peak}ms` : null, color: r.qtc_peak > 450 ? "#A32D2D" : undefined },
                      ].filter((m) => m.val != null).map((m) => (
                        <div key={m.label} style={{ background: "#FAFAF8", border: "0.5px solid rgba(0,0,0,0.07)", borderRadius: 6, padding: "6px 10px", minWidth: 70 }}>
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9E9E9A", marginBottom: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: m.color ?? "#1A1A18" }}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
