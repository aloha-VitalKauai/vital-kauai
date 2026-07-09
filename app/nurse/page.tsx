import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type NurseMember = {
  id: string;
  full_name: string;
  status: string | null;
  ceremony_date: string | null;
  arrival_date: string | null;
  medical_cleared: boolean | null;
  cardiac_cleared: boolean | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function NurseHomePage() {
  const supabase = await createClient();

  // The view is scoped by RLS-style logic inside the DB: it only returns
  // members assigned to the signed-in nurse.
  const { data: members } = await supabase
    .from("nurse_member_medical")
    .select("id, full_name, status, ceremony_date, arrival_date, medical_cleared, cardiac_cleared")
    .order("ceremony_date", { ascending: true, nullsFirst: false });

  const list = (members ?? []) as NurseMember[];

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <h1
        style={{
          fontFamily: "var(--font-display, serif)",
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: "#1A1A18",
          marginBottom: 6,
        }}
      >
        Members in your care
      </h1>
      <p style={{ fontSize: 13, color: "#6B6B67", maxWidth: 640, marginBottom: "1.5rem" }}>
        Each member&rsquo;s page has their medical profile, intake form, lab documents,
        and the shared notes log.
      </p>

      {list.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "1.5rem",
          }}
        >
          <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
            No members are assigned to you yet. Assignments come from the Vital Kaua&#699;i team.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/nurse/${m.id}`}
              style={{
                background: "#fff",
                border: "0.5px solid rgba(0,0,0,0.1)",
                borderRadius: 10,
                padding: "1.1rem 1.25rem",
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 500, color: "#1A1A18", margin: "0 0 4px" }}>
                {m.full_name}
              </p>
              <p style={{ fontSize: 12, color: "#6B6B67", margin: "0 0 10px" }}>
                {m.status || "—"} · Ceremony {fmtDate(m.ceremony_date)}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "Medical", ok: !!m.medical_cleared },
                  { label: "Cardiac", ok: !!m.cardiac_cleared },
                ].map((c) => (
                  <span
                    key={c.label}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "2px 9px",
                      borderRadius: 99,
                      background: c.ok ? "#E1F5EE" : "#FAEEDA",
                      color: c.ok ? "#085041" : "#854F0B",
                    }}
                  >
                    {c.label} {c.ok ? "cleared" : "pending"}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
