import Link from "next/link";
import { auditCeremonyAlignment } from "@/app/actions/journeys";
import CeremonyAuditPanel from "@/components/dashboard/CeremonyAuditPanel";

export const metadata = { title: "Ceremony alignment audit — Vital Kauaʻi" };

export default async function CeremonyAuditPage() {
  const result = await auditCeremonyAlignment();
  const initial = result.ok && result.data ? result.data : null;

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>
        Data integrity
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", margin: 0 }}>
          Ceremony alignment audit
        </h1>
        <Link href="/dashboard/ceremonies" style={{ fontSize: 12, fontWeight: 500, color: "#1D6B4A", textDecoration: "underline", textUnderlineOffset: 2 }}>
          ← Back to ceremonies
        </Link>
      </div>

      <p style={{ fontSize: 13, color: "#6B6B67", lineHeight: 1.5, margin: "0 0 1.5rem 0", maxWidth: 720 }}>
        <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>journeys</code> is the canonical scheduling table. <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>members.ceremony_date</code> and <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>ceremony_records</code> are mirrors that the dashboard reads. This audit finds drift between them — and the heal buttons re-run the sync helpers so portal and dashboard agree.
      </p>

      {result.ok ? (
        <CeremonyAuditPanel initial={initial} />
      ) : (
        <div style={{ background: "#FBE7E1", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem", color: "#7A1F0A", fontSize: 13 }}>
          Audit failed: {result.error ?? "unknown error"}
        </div>
      )}
    </div>
  );
}
