import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Onboarding — Vital Kauaʻi" };

function Check({ ok }: { ok: boolean | null | undefined }) {
  return ok ? (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700 }}>✓</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", fontSize: 10 }}>—</span>
  );
}

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function OnboardingPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }, { data: intakes }, { data: preProgress }, { data: postProgress }] = await Promise.all([
    supabase.from("members").select("id, full_name, email, medical_cleared, cardiac_cleared, portal_unlocked, integration_unlocked, status, ceremony_date").order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, email, membership_agreement_signed, medical_disclaimer_signed, deposit_paid, deposit_amount"),
    supabase.from("intake_forms").select("member_id"),
    supabase.from("pre_ceremony_progress").select("member_id, weeks_completed, last_updated"),
    supabase.from("post_ceremony_progress").select("member_id, weeks_completed, last_updated"),
  ]);

  const profileMap: Record<string, any> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;
  const intakeSet = new Set((intakes ?? []).map((i) => i.member_id));

  // Map auth user IDs to member emails for progress lookup
  const emailToAuthId: Record<string, string> = {};
  for (const p of profiles ?? []) if (p.email) emailToAuthId[p.email] = p.id;

  const preMap: Record<string, any> = {};
  for (const p of preProgress ?? []) preMap[p.member_id] = p;
  const postMap: Record<string, any> = {};
  for (const p of postProgress ?? []) postMap[p.member_id] = p;

  const rows = (members ?? []).map((m) => {
    const p = profileMap[m.id];
    const hasIntake = intakeSet.has(m.id);
    const checks = [
      p?.membership_agreement_signed,
      p?.medical_disclaimer_signed,
      p?.deposit_paid,
      hasIntake,
      m.medical_cleared,
      m.cardiac_cleared,
      m.portal_unlocked,
      m.integration_unlocked,
    ];
    const doneCount = checks.filter(Boolean).length;
    const statusLabel = doneCount === 8 ? "Complete" : doneCount === 0 ? "Not started" : "In progress";
    const statusStyle = doneCount === 8
      ? { background: "#E1F5EE", color: "#085041" }
      : doneCount === 0
        ? { background: "#FCEBEB", color: "#A32D2D" }
        : { background: "#FAEEDA", color: "#633806" };
    return { ...m, profile: p, hasIntake, statusLabel, statusStyle };
  });

  const TH: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Member readiness</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Onboarding</h1>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>Onboarding checklist — all members</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} members</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Agreement", "Medical disclaimer", "Deposit paid", "Deposit amt", "Intake form", "Med cleared", "Cardiac", "Portal", "Integration", "Status"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members yet</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <td style={TD}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</div>
                    <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 1 }}>{r.email}</div>
                  </td>
                  <td style={TD}><Check ok={r.profile?.membership_agreement_signed} /></td>
                  <td style={TD}><Check ok={r.profile?.medical_disclaimer_signed} /></td>
                  <td style={TD}><Check ok={r.profile?.deposit_paid} /></td>
                  <td style={{ ...TD, color: r.profile?.deposit_amount ? "#1A1A18" : "#9E9E9A" }}>{fmt(r.profile?.deposit_amount, "$")}</td>
                  <td style={TD}><Check ok={r.hasIntake} /></td>
                  <td style={TD}><Check ok={r.medical_cleared} /></td>
                  <td style={TD}><Check ok={r.cardiac_cleared} /></td>
                  <td style={TD}><Check ok={r.portal_unlocked} /></td>
                  <td style={TD}><Check ok={r.integration_unlocked} /></td>
                  <td style={TD}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, ...r.statusStyle }}>{r.statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration Progress */}
      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden", marginTop: "1.25rem" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>Integration progress — pre & post ceremony</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Status", "Pre-Ceremony", "", "Post-Ceremony", "", "Last Active"].map((h, i) => (
                  <th key={`${h}-${i}`} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(members ?? []).length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members yet</td></tr>
              ) : (members ?? []).map((m) => {
                const authId = emailToAuthId[m.email];
                const pre = authId ? preMap[authId] : null;
                const post = authId ? postMap[authId] : null;
                const preWeeks = pre?.weeks_completed?.length ?? 0;
                const postWeeks = post?.weeks_completed?.length ?? 0;
                const prePct = Math.round((preWeeks / 6) * 100);
                const postPct = Math.round((postWeeks / 6) * 100);
                const lastActive = pre?.last_updated || post?.last_updated;
                return (
                  <tr key={m.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <td style={TD}>
                      <a href={`/dashboard/${m.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{m.full_name}</div>
                      </a>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize: 11, color: "#6B6B67" }}>{m.status ?? "—"}</span>
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: "#E1F5EE", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${prePct}%`, background: "#1D9E75", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: preWeeks > 0 ? "#085041" : "#9E9E9A", fontWeight: 500 }}>{preWeeks}/6</span>
                      </div>
                    </td>
                    <td style={TD}>
                      {preWeeks === 6 ? (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#E1F5EE", color: "#085041", fontWeight: 500 }}>Complete</span>
                      ) : preWeeks > 0 ? (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 500 }}>Week {preWeeks + 1}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#9E9E9A" }}>Not started</span>
                      )}
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: "#FAEEDA", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${postPct}%`, background: "#C8A96E", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: postWeeks > 0 ? "#633806" : "#9E9E9A", fontWeight: 500 }}>{postWeeks}/6</span>
                      </div>
                    </td>
                    <td style={TD}>
                      {postWeeks === 6 ? (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 500 }}>Complete</span>
                      ) : postWeeks > 0 ? (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 500 }}>Week {postWeeks + 1}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#9E9E9A" }}>Not started</span>
                      )}
                    </td>
                    <td style={{ ...TD, fontSize: 11, color: lastActive ? "#6B6B67" : "#9E9E9A" }}>
                      {lastActive ? new Date(lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
