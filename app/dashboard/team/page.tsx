import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";
import { paperworkStatus, type Practitioner, type PaperworkStatus } from "@/lib/practitioners";

export const metadata = { title: "Team — Vital Kauaʻi" };

export default async function TeamPage() {
  const supabase = await createClient();

  const [{ data: practitioners }, { data: docRows }] = await Promise.all([
    supabase
      .from("practitioners")
      .select("id, full_name, email, phone, role, engagement_type, active, notes, created_at")
      .order("active", { ascending: false })
      .order("full_name", { ascending: true }),
    supabase.from("practitioner_documents").select("practitioner_id, doc_type, expires_at"),
  ]);

  const docCounts: Record<string, number> = {};
  const docsByPractitioner: Record<string, Array<{ doc_type: string; expires_at: string | null }>> = {};
  for (const d of docRows ?? []) {
    docCounts[d.practitioner_id] = (docCounts[d.practitioner_id] ?? 0) + 1;
    (docsByPractitioner[d.practitioner_id] ??= []).push(d);
  }

  const today = new Date().toISOString().slice(0, 10);
  const paperwork: Record<string, PaperworkStatus> = {};
  for (const p of practitioners ?? []) {
    paperwork[p.id] = paperworkStatus(docsByPractitioner[p.id] ?? [], today);
  }

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
        Team
      </h1>
      <p style={{ fontSize: 13, color: "#6B6B67", maxWidth: 640, marginBottom: "1.5rem" }}>
        Practitioners, contractors, and staff — with their signed paperwork on file.
        Click a person to view or upload their documents.
      </p>
      <TeamClient
        practitioners={(practitioners ?? []) as Practitioner[]}
        docCounts={docCounts}
        paperwork={paperwork}
      />
    </div>
  );
}
