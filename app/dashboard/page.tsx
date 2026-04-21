import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Overview — Vital Kauaʻi" };

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed — Awaiting Intake": { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Intake Complete": { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Ceremony Scheduled": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  "Ceremony Complete": { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Integration Phase": { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  Alumni: { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
};
const fallback = { bg: "#F1EFE8", text: "#444441", dot: "#888780" };

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: members },
    { data: profiles },
    { data: leads },
    { data: ceremonies },
    { data: overview },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, status, assigned_partner, membership_tier, medical_cleared, cardiac_cleared, ceremony_date")
      .order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, deposit_amount, membership_agreement_signed, medical_disclaimer_signed, deposit_paid"),
    supabase.from("leads").select("id, full_name, welcome_video_sent, discovery_call_booked, converted_to_member"),
    supabase.from("ceremony_records").select("id, member_id, ceremony_date, status, guides_present, medicine_form").order("ceremony_date", { ascending: true }),
    supabase.from("financials_overview").select("*").single(),
  ]);

  const rows = members ?? [];

  const totalLeads = (leads ?? []).length;
  const videoSent = (leads ?? []).filter((l) => l.welcome_video_sent).length;
  const callsBooked = (leads ?? []).filter((l) => l.discovery_call_booked).length;
  const converted = (leads ?? []).filter((l) => l.converted_to_member).length;
  const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

  // Revenue & margin pulled from the same source as /dashboard/financials
  const totalRevenueCents = overview?.total_revenue_cents ?? 0;
  const totalExpensesCents = overview?.total_expenses_cents ?? 0;
  const activePayoutsCents =
    (overview?.payouts_pending_cents ?? 0) +
    (overview?.payouts_scheduled_cents ?? 0) +
    (overview?.payouts_paid_cents ?? 0);
  const marginCents = totalRevenueCents - totalExpensesCents - activePayoutsCents;
  const hasRevenue = totalRevenueCents > 0;
  const marginPct =
    hasRevenue ? Math.round((marginCents / totalRevenueCents) * 100) : null;

  const medCleared = rows.filter((r) => r.medical_cleared).length;
  const cardiacCleared = rows.filter((r) => r.cardiac_cleared).length;

  const stageCounts: Record<string, number> = {};
  for (const r of rows) {
    const s = r.status ?? "Unknown";
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  const profileList = profiles ?? [];
  const agreementSigned = profileList.filter((p) => p.membership_agreement_signed).length;
  const disclaimerSigned = profileList.filter((p) => p.medical_disclaimer_signed).length;
  const depositPaid = profileList.filter((p) => p.deposit_paid).length;

  const upcomingCeremonies = (ceremonies ?? []).filter(
    (c) => c.status !== "Complete" && c.ceremony_date
  );
  const memberMap: Record<string, string> = {};
  for (const m of members ?? []) memberMap[m.id] = m.full_name;

  const LABEL: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#6B6B67",
    marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18" }}>
          Overview
        </h1>
      </div>

      {/* KPI Cards — 6 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total members", value: String(rows.length), sub: "active members" },
          { label: "Total leads", value: String(totalLeads), up: totalLeads > 0 ? `${totalLeads} tracked` : undefined },
          { label: "Conversion", value: `${conversionRate}%`, sub: "leads → members" },
          { label: "Total revenue", value: fmt(totalRevenueCents / 100, "$"), sub: "Collected to date" },
          { label: "Gross margin", value: fmt(marginCents / 100, "$"), up: marginPct != null ? `${marginPct}% margin` : undefined },
          { label: "Medically cleared", value: `${medCleared}/${rows.length}`, sub: `cardiac screened: ${cardiacCleared}/${rows.length}` },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 10, color: "#9E9E9A", marginTop: 5 }}>{c.sub}</p>}
            {c.up && <p style={{ fontSize: 11, color: "#085041", marginTop: 5 }}>{c.up}</p>}
          </div>
        ))}
      </div>

      {/* Two-column: Stage breakdown + Upcoming ceremonies */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.25rem" }}>
        {/* Stage breakdown */}
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ ...LABEL, margin: 0 }}>Stage breakdown</p>
            <Link href="/dashboard/clients" style={{ fontSize: 12, color: "#1D6B4A", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(stageCounts).sort((a, b) => b[1] - a[1]).map(([stage, count]) => {
              const c = STATUS_COLORS[stage] ?? fallback;
              return (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 6, background: c.bg, borderRadius: 99, padding: "5px 12px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: c.text }}>{stage}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.text, marginLeft: 2 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming ceremonies */}
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ ...LABEL, margin: 0 }}>Upcoming ceremonies</p>
            <Link href="/dashboard/ceremonies" style={{ fontSize: 12, color: "#1D6B4A", textDecoration: "none" }}>View all →</Link>
          </div>
          {upcomingCeremonies.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9E9E9A" }}>No upcoming ceremonies</p>
          ) : (
            upcomingCeremonies.slice(0, 3).map((cer) => {
              const d = cer.ceremony_date ? new Date(cer.ceremony_date) : null;
              return (
                <div key={cer.id} style={{ padding: "12px 0", borderBottom: "0.5px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ background: "#E1F5EE", borderRadius: 8, padding: "8px 12px", textAlign: "center", minWidth: 52, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: "#085041", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {d ? d.toLocaleDateString("en-US", { month: "short" }) : "—"}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: "#085041", lineHeight: 1.1 }}>
                      {d ? d.getDate() : "—"}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{memberMap[cer.member_id] ?? "Unknown"}</div>
                    <div style={{ fontSize: 11, color: "#6B6B67", marginTop: 2 }}>
                      {cer.guides_present ? `Guide: ${cer.guides_present}` : "Guide: TBD"} · {cer.medicine_form ?? "Whole Root Bark"}
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FAEEDA", color: "#633806", fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF9F27", display: "inline-block" }} />
                    {cer.status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lead pipeline */}
      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ ...LABEL, margin: 0 }}>Lead pipeline</p>
          <Link href="/dashboard/leads" style={{ fontSize: 12, color: "#1D6B4A", textDecoration: "none" }}>View leads →</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Total leads", count: totalLeads, pct: 100, bg: "#E6F1FB", color: "#0C447C" },
            { label: "Video sent", count: videoSent, pct: totalLeads > 0 ? Math.round((videoSent / totalLeads) * 100) : 0, bg: "#EEEDFE", color: "#3C3489" },
            { label: "Discovery call booked", count: callsBooked, pct: totalLeads > 0 ? Math.round((callsBooked / totalLeads) * 100) : 0, bg: "#FAEEDA", color: "#633806" },
            { label: "Converted to member", count: converted, pct: conversionRate, bg: "#E1F5EE", color: "#085041" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: "#6B6B67", width: 160, flexShrink: 0 }}>{f.label}</div>
              <div style={{ flex: 1, background: "#F5F4F1", borderRadius: 4, height: 24, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(f.pct, 2)}%`, background: f.bg, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 11, fontWeight: 500, color: f.color }}>
                  {f.count > 0 ? f.count : ""}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, width: 24, textAlign: "right", flexShrink: 0 }}>{f.count}</div>
              <div style={{ fontSize: 11, color: "#9E9E9A", width: 36, flexShrink: 0 }}>{f.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onboarding status */}
      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ ...LABEL, margin: 0 }}>Onboarding status</p>
          <Link href="/dashboard/clients" style={{ fontSize: 12, color: "#1D6B4A", textDecoration: "none" }}>Full view →</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Agreement signed", count: agreementSigned, total: rows.length },
            { label: "Medical disclaimer", count: disclaimerSigned, total: rows.length },
            { label: "Deposit paid", count: depositPaid, total: rows.length },
          ].map((item) => (
            <div key={item.label} style={{ background: "#FAFAF8", borderRadius: 8, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 500 }}>
                {item.count}<span style={{ fontSize: 11, color: "#9E9E9A" }}>/{item.total}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6B6B67", marginTop: 6 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
