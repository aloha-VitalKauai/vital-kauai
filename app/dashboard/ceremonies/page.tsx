import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CeremoniesTable from "./CeremoniesTable";

export const metadata = { title: "Ceremonies — Vital Kauaʻi" };

export default async function CeremoniesPage() {
  const supabase = await createClient();

  const [{ data: ceremonies }, { data: members }] = await Promise.all([
    supabase
      .from("ceremony_records")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("*, journey:journeys(id, schedule_type)" as any)
      .order("ceremony_date", { ascending: false }),
    supabase.from("members").select("id, full_name"),
  ]);

  const memberMap: Record<string, string> = {};
  for (const m of members ?? []) memberMap[m.id] = m.full_name;

  type RawRow = Record<string, unknown> & {
    id: string;
    member_id: string;
    journey_id?: string | null;
    journey?: { id: string; schedule_type: string | null } | null;
  };
  const rows = ((ceremonies ?? []) as unknown as RawRow[]).map((r) => ({
    id:                String(r.id),
    member_id:         String(r.member_id),
    ceremony_date:     (r.ceremony_date as string | null) ?? null,
    medicine_form:     (r.medicine_form as string | null) ?? null,
    guides_present:    (r.guides_present as string | null) ?? null,
    status:            (r.status as string | null) ?? null,
    integration_calls: (r.integration_calls as number | null) ?? null,
    pre_notes:         (r.pre_notes as string | null) ?? null,
    post_notes:        (r.post_notes as string | null) ?? null,
    journey_id:        r.journey?.id ?? r.journey_id ?? null,
    schedule_type:     r.journey?.schedule_type ?? null,
  }));

  const completed = rows.filter((c) => c.status === "Complete").length;
  const upcoming = rows.filter((c) => c.status !== "Complete").length;
  const totalCalls = rows.reduce((s, c) => s + (c.integration_calls ?? 0), 0);
  const completedWithCalls = rows.filter((c) => c.status === "Complete" && c.integration_calls != null);
  const avgCalls = completedWithCalls.length > 0 ? (totalCalls / completedWithCalls.length).toFixed(1) : "—";

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Ceremony records</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", margin: 0 }}>Ceremonies</h1>
        <Link href="/dashboard/ceremonies/audit" style={{ fontSize: 12, fontWeight: 500, color: "#1D6B4A", textDecoration: "underline", textUnderlineOffset: 2 }}>
          Alignment audit →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total ceremonies", value: String(rows.length) },
          { label: "Completed", value: String(completed) },
          { label: "Upcoming", value: String(upcoming) },
          { label: "Avg integration calls", value: String(avgCalls) },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>All ceremony records</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <CeremoniesTable rows={rows} memberMap={memberMap} />
        </div>
      </div>
    </div>
  );
}
