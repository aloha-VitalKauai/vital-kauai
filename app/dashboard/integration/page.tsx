import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import GuideAssignCell from "./GuideAssignCell";

export const metadata = { title: "Integration — Vital Kauaʻi" };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function IntegrationPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }, { data: preProgress }, { data: postProgress }, { data: specialists }] = await Promise.all([
    supabase.from("members").select("id, full_name, email, status, ceremony_date, assigned_partner").order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, email"),
    supabase.from("pre_ceremony_progress").select("member_id, weeks_completed, checklist_items, journal_responses, last_updated"),
    supabase.from("post_ceremony_progress").select("member_id, weeks_completed, checklist_items, weekly_tracking, journal_responses, last_updated"),
    supabase.from("integration_specialists").select("id, name").eq("active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  const specialistList = (specialists ?? []) as { id: string; name: string }[];

  const emailToAuthId: Record<string, string> = {};
  for (const p of profiles ?? []) if (p.email) emailToAuthId[p.email] = p.id;

  const preMap: Record<string, any> = {};
  for (const p of preProgress ?? []) preMap[p.member_id] = p;
  const postMap: Record<string, any> = {};
  for (const p of postProgress ?? []) postMap[p.member_id] = p;

  const rows = (members ?? []).map((m) => {
    const authId = emailToAuthId[m.email];
    const pre = authId ? preMap[authId] : null;
    const post = authId ? postMap[authId] : null;
    const preWeeks = pre?.weeks_completed?.length ?? 0;
    const postWeeks = post?.weeks_completed?.length ?? 0;
    const preJournal = pre?.journal_responses ? Object.keys(pre.journal_responses).filter((k: string) => pre.journal_responses[k]?.trim()).length : 0;
    const postJournal = post?.journal_responses ? Object.keys(post.journal_responses).filter((k: string) => post.journal_responses[k]?.trim()).length : 0;
    const lastActive = pre?.last_updated && post?.last_updated
      ? (new Date(pre.last_updated) > new Date(post.last_updated) ? pre.last_updated : post.last_updated)
      : pre?.last_updated || post?.last_updated;
    return { ...m, pre, post, preWeeks, postWeeks, preJournal, postJournal, lastActive };
  });

  // Summary stats
  const totalPre = rows.filter((r) => r.preWeeks > 0).length;
  const completedPre = rows.filter((r) => r.preWeeks === 6).length;
  const totalPost = rows.filter((r) => r.postWeeks > 0).length;
  const completedPost = rows.filter((r) => r.postWeeks === 6).length;
  const activeThisWeek = rows.filter((r) => {
    if (!r.lastActive) return false;
    const d = new Date(r.lastActive);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 86400000;
  }).length;

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };
  const TH: React.CSSProperties = { padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Member journey tracking</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1.5rem", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", margin: 0 }}>Integration</h1>
        <Link href="/dashboard/integration/specialists" style={{ fontSize: 12, color: "#6B6B67", textDecoration: "none", borderBottom: "0.5px solid #C8C8C4", paddingBottom: 1 }}>
          Manage specialists →
        </Link>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Pre-Ceremony Active", value: String(totalPre), sub: `${completedPre} completed` },
          { label: "Post-Ceremony Active", value: String(totalPost), sub: `${completedPost} completed` },
          { label: "Active This Week", value: String(activeThisWeek), sub: "logged in past 7 days" },
          { label: "Journal Entries", value: String(rows.reduce((s, r) => s + r.preJournal + r.postJournal, 0)), sub: "across all members" },
          { label: "Total Members", value: String(rows.length) },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 10, color: "#9E9E9A", marginTop: 5 }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>Pre & post-ceremony progress — all members</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} members</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Guide", "Status", "Pre-Ceremony", "Pre Journals", "Post-Ceremony", "Post Journals", "Ceremony Date", "Last Active"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members yet</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <td style={TD}>
                    <Link href={`/dashboard/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</div>
                      <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 1 }}>{r.email}</div>
                    </Link>
                  </td>
                  <td style={TD}>
                    <GuideAssignCell memberId={r.id} current={r.assigned_partner} specialists={specialistList} />
                  </td>
                  <td style={TD}>
                    <span style={{ fontSize: 11, color: "#6B6B67" }}>{r.status ?? "—"}</span>
                  </td>
                  {/* Pre-ceremony */}
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 5, background: "#E1F5EE", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((r.preWeeks / 6) * 100)}%`, background: "#1D9E75", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: r.preWeeks > 0 ? "#085041" : "#9E9E9A", fontWeight: 500 }}>{r.preWeeks}/6</span>
                      {r.preWeeks === 6 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "#E1F5EE", color: "#085041", fontWeight: 600 }}>Done</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, color: r.preJournal > 0 ? "#085041" : "#9E9E9A", fontWeight: r.preJournal > 0 ? 500 : 300 }}>
                    {r.preJournal > 0 ? `${r.preJournal} entries` : "—"}
                  </td>
                  {/* Post-ceremony */}
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 5, background: "#FAEEDA", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((r.postWeeks / 6) * 100)}%`, background: "#C8A96E", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: r.postWeeks > 0 ? "#633806" : "#9E9E9A", fontWeight: 500 }}>{r.postWeeks}/6</span>
                      {r.postWeeks === 6 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 600 }}>Done</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, color: r.postJournal > 0 ? "#633806" : "#9E9E9A", fontWeight: r.postJournal > 0 ? 500 : 300 }}>
                    {r.postJournal > 0 ? `${r.postJournal} entries` : "—"}
                  </td>
                  <td style={{ ...TD, color: r.ceremony_date ? "#1A1A18" : "#9E9E9A" }}>{fmtDate(r.ceremony_date)}</td>
                  <td style={{ ...TD, fontSize: 11, color: r.lastActive ? "#6B6B67" : "#9E9E9A" }}>
                    {r.lastActive ? new Date(r.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
