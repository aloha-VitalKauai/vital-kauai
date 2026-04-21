import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Members — Vital Kauaʻi" };

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

function Dot({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  const done = !!ok;
  return (
    <span
      title={`${label}: ${done ? "done" : "pending"}`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: done ? "#1D9E75" : "#D8D7D1",
        flexShrink: 0,
      }}
    />
  );
}

function DotGroup({ items }: { items: { label: string; ok: boolean | null | undefined }[] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {items.map((i) => (
        <Dot key={i.label} ok={i.ok} label={i.label} />
      ))}
    </span>
  );
}

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }, { data: intakes }] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, status, assigned_partner, membership_tier, journey_focus, ceremony_date, arrival_date, medical_cleared, cardiac_cleared, portal_unlocked, integration_unlocked, program_price, cost_of_service")
      .order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, membership_agreement_signed, medical_disclaimer_signed, deposit_paid, deposit_amount"),
    supabase.from("intake_forms").select("member_id"),
  ]);

  const profileMap: Record<string, any> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;
  const intakeSet = new Set((intakes ?? []).map((i) => i.member_id));

  const rows = (members ?? []).map((m) => {
    const price = m.program_price != null ? Number(m.program_price) : null;
    const cost = m.cost_of_service != null ? Number(m.cost_of_service) : null;
    const profit = price != null && cost != null ? price - cost : null;
    const p = profileMap[m.id];
    const hasIntake = intakeSet.has(m.id);

    const paperwork = [
      { label: "Agreement signed", ok: p?.membership_agreement_signed },
      { label: "Medical disclaimer signed", ok: p?.medical_disclaimer_signed },
      { label: `Deposit paid${p?.deposit_amount ? ` ($${p.deposit_amount})` : ""}`, ok: p?.deposit_paid },
      { label: "Intake form submitted", ok: hasIntake },
    ];
    const clearances = [
      { label: "Medical cleared", ok: m.medical_cleared },
      { label: "Cardiac cleared", ok: m.cardiac_cleared },
      { label: "Portal unlocked", ok: m.portal_unlocked },
      { label: "Integration unlocked", ok: m.integration_unlocked },
    ];

    const doneCount = [...paperwork, ...clearances].filter((x) => !!x.ok).length;
    const readinessLabel = doneCount === 8 ? "Complete" : doneCount === 0 ? "Not started" : "In progress";
    const readinessStyle =
      doneCount === 8
        ? { bg: "#E1F5EE", text: "#085041" }
        : doneCount === 0
          ? { bg: "#FCEBEB", text: "#A32D2D" }
          : { bg: "#FAEEDA", text: "#633806" };

    return { ...m, price, cost, profit, paperwork, clearances, readinessLabel, readinessStyle, doneCount };
  });

  const TH: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 500,
    color: "#6B6B67",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "0.5px solid rgba(0,0,0,0.09)",
    background: "#FAFAF8",
    whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Members</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Members</h1>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>All members</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Partner", "Stage", "Readiness", "Tier", "Journey focus", "Ceremony", "Arrival", "Paperwork", "Clearances", "Price", "Cost", "Profit"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members yet</td></tr>
              ) : rows.map((r) => {
                const c = STATUS_COLORS[r.status ?? ""] ?? fallback;
                return (
                  <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <td style={TD}>
                      <Link href={`/dashboard/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</div>
                        <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 1 }}>{r.email}</div>
                      </Link>
                    </td>
                    <td style={{ ...TD, color: r.assigned_partner ? "#1A1A18" : "#9E9E9A" }}>{r.assigned_partner ?? "—"}</td>
                    <td style={TD}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, display: "inline-block", flexShrink: 0 }} />
                        {r.status ?? "Unknown"}
                      </span>
                    </td>
                    <td style={TD}>
                      <span
                        title={`${r.doneCount} of 8 steps complete`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: r.readinessStyle.bg, color: r.readinessStyle.text, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}
                      >
                        {r.readinessLabel}
                        <span style={{ opacity: 0.6, fontSize: 10 }}>{r.doneCount}/8</span>
                      </span>
                    </td>
                    <td style={{ ...TD, color: r.membership_tier ? "#1A1A18" : "#9E9E9A" }}>{r.membership_tier ?? "—"}</td>
                    <td style={{ ...TD, color: "#6B6B67", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.journey_focus ?? "—"}</td>
                    <td style={{ ...TD, color: r.ceremony_date ? "#1A1A18" : "#9E9E9A" }}>{fmtDate(r.ceremony_date)}</td>
                    <td style={{ ...TD, color: r.arrival_date ? "#1A1A18" : "#9E9E9A" }}>{fmtDate(r.arrival_date)}</td>
                    <td style={TD}><DotGroup items={r.paperwork} /></td>
                    <td style={TD}><DotGroup items={r.clearances} /></td>
                    <td style={{ ...TD, color: r.price != null ? "#1A1A18" : "#9E9E9A" }}>{fmt(r.price, "$")}</td>
                    <td style={{ ...TD, color: r.cost != null ? "#1A1A18" : "#9E9E9A" }}>{fmt(r.cost, "$")}</td>
                    <td style={{ ...TD, fontWeight: r.profit != null ? 500 : 400, color: r.profit == null ? "#9E9E9A" : r.profit >= 0 ? "#085041" : "#A32D2D" }}>{fmt(r.profit, "$")}</td>
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
