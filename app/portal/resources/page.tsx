import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PNE_ADDITIONAL_RESOURCES } from "@/lib/pne-companions";

export const metadata = { title: "Resources — Vital Kauaʻi" };

const FOREST = "#0E1A10";
const CREAM = "#F5F0E8";
const SAGE_LT = "#A8C5AC";
const GOLD = "#C8A96E";

type ResourceCard = {
  title: string;
  description: string;
  href: string;
  status?: "live" | "coming-soon";
};

const JOURNAL_RESOURCES: ResourceCard[] = [
  {
    title: "Open Your Journal",
    description: "Your weekly prompts and PNE reflections across the six weeks of preparation and six weeks of integration.",
    href: "/portal/journal",
    status: "live",
  },
];

function ResourceCardLink({ r }: { r: ResourceCard }) {
  const comingSoon = r.status === "coming-soon";
  const card: React.CSSProperties = {
    display: "block",
    background: comingSoon ? "rgba(245,240,232,0.5)" : "#FFFFFF",
    border: `1px solid rgba(28,43,30,0.1)`,
    borderRadius: 6,
    padding: "22px 24px",
    textDecoration: "none",
    color: "#1A1A18",
  };
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: comingSoon ? "#6A655B" : "#1A1A18" }}>
          {r.title}
        </p>
        {comingSoon && (
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: GOLD }}>Coming Soon</span>
        )}
      </div>
      <p style={{ fontSize: 13.5, color: "#3D4D3F", lineHeight: 1.7 }}>{r.description}</p>
    </>
  );
  return comingSoon ? (
    <div key={r.title} style={card}>{inner}</div>
  ) : (
    <Link key={r.title} href={r.href} style={card}>{inner}</Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, letterSpacing: "0.34em", textTransform: "uppercase", color: GOLD, fontWeight: 600, margin: "44px 0 14px" }}>
      {children}
    </p>
  );
}

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/resources");

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300, color: "#1A1A18" }}>
      <section style={{ background: FOREST, color: CREAM, padding: "60px 48px 56px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
            Member Portal
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 58px)", fontWeight: 300, lineHeight: 1.06 }}>
            <em style={{ fontStyle: "italic", color: SAGE_LT }}>Resources</em>
          </h1>
        </div>
      </section>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "12px 48px 120px" }}>
        <style>{`
          @media (max-width: 640px) {
            .res-grid { grid-template-columns: 1fr !important; }
            main { padding-left: 20px !important; padding-right: 20px !important; }
          }
        `}</style>
        <SectionLabel>Comprehensive Journal</SectionLabel>
        <div className="res-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {JOURNAL_RESOURCES.map((r) => <ResourceCardLink key={r.title} r={r} />)}
        </div>

        <SectionLabel>Vital Kauaʻi Guides</SectionLabel>
        <div className="res-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {PNE_ADDITIONAL_RESOURCES.map((r) => <ResourceCardLink key={r.title} r={r} />)}
        </div>
      </main>
    </div>
  );
}
