import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  companionsFor,
  type PneCompanion,
} from "@/lib/pne-companions";

export const metadata = { title: "PsychoNeuroEnergetics (PNE) Resources — Vital Kauaʻi" };

const FOREST = "#0E1A10";
const FOREST_DEEP = "#0A130C";
const CREAM = "#F5F0E8";
const CREAM_SOFT = "rgba(245,240,232,0.65)";
const CREAM_DIM = "rgba(245,240,232,0.42)";
const SAGE = "#7A9E7E";
const SAGE_LT = "#A8C5AC";
const GOLD = "#C8A96E";
const GOLD_DIM = "rgba(200,169,110,0.18)";

export default async function PnePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/pne");

  const pre = companionsFor("pre");
  const post = companionsFor("post");

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF7", fontFamily: "'Jost', sans-serif", fontWeight: 300, color: "#1A1A18" }}>
      {/* ── HERO ── */}
      <section style={{ background: FOREST, color: CREAM, padding: "70px 48px 64px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 56, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 9.5, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, marginBottom: 20 }}>
              Member Portal · Resources
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4.2vw, 58px)", fontWeight: 300, lineHeight: 1.06, marginBottom: 20 }}>
              PsychoNeuroEnergetics
              <br />
              <em style={{ fontStyle: "italic", color: SAGE_LT }}>(PNE) Resources</em>
            </h1>
            <p style={{ fontSize: 15, color: CREAM_SOFT, lineHeight: 1.9, maxWidth: 480 }}>
              A library of body-led teachings paired with each week of your journey. Start with the orientation video, then move through the weekly PNE Guide chapters before and after ceremony.
            </p>
          </div>

          {/* Hero video */}
          <div style={{ border: `1px solid ${GOLD_DIM}`, borderRadius: 6, overflow: "hidden", background: FOREST_DEEP, padding: "28px 30px", display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", border: `1px solid rgba(200,169,110,0.32)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: GOLD, fontSize: 16, marginLeft: 4 }}>▶</span>
            </div>
            <div>
              <p style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
                Orientation · What PNE Is
              </p>
              <p style={{ fontSize: 13.5, color: CREAM_SOFT, lineHeight: 1.7 }}>
                An introduction to PsychoNeuroEnergetics from Judith Johnson, and why this body-led work is the foundation of preparation and integration on the journey.
              </p>
              <p style={{ marginTop: 10, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: GOLD }}>
                Coming Soon
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 48px 120px" }}>
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.36em", textTransform: "uppercase", color: SAGE, marginBottom: 10, fontWeight: 500 }}>Weekly Guide</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 300, lineHeight: 1.1, color: "#1A1A18" }}>
            The PNE <em style={{ fontStyle: "italic", color: SAGE }}>Guide</em>
          </h2>
        </div>

        <PhaseBlock label="Pre Ceremony Weeks 1–6" companions={pre} />
        <div style={{ height: 56 }} />
        <PhaseBlock label="Post Ceremony Weeks 1–6" companions={post} />
      </main>
    </div>
  );
}

function PhaseBlock({ label, companions }: { label: string; companions: ReadonlyArray<PneCompanion> }) {
  return (
    <section>
      <p style={{ fontSize: 9.5, letterSpacing: "0.32em", textTransform: "uppercase", color: SAGE, marginBottom: 18, fontWeight: 600 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {companions.map((c) => (
          <WeekRow key={`${c.phase}-${c.weekIdx}`} companion={c} />
        ))}
      </div>
    </section>
  );
}

function WeekRow({ companion }: { companion: PneCompanion }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
      <CompanionCard companion={companion} />
      <VideoCard companion={companion} />
    </div>
  );
}

function CompanionCard({ companion }: { companion: PneCompanion }) {
  const isLive = companion.status === "live";
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: SAGE, fontWeight: 600 }}>
          Week {companion.weekIdx + 1}
        </span>
        {!isLive && (
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: GOLD }}>Coming Soon</span>
        )}
      </div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 300, lineHeight: 1.3, color: isLive ? "#1A1A18" : "#6A655B" }}>
        {companion.title}
      </p>
    </>
  );
  const card: React.CSSProperties = {
    display: "block",
    background: isLive ? "#FFFFFF" : "rgba(245,240,232,0.5)",
    border: `1px solid ${isLive ? "rgba(122,158,126,0.25)" : "rgba(28,43,30,0.08)"}`,
    borderLeft: `3px solid ${isLive ? SAGE : "rgba(200,169,110,0.35)"}`,
    borderRadius: 6,
    padding: "20px 22px",
    textDecoration: "none",
    transition: "border-color .15s, transform .15s",
  };
  return isLive ? (
    <Link href={companion.href} style={card}>{inner}</Link>
  ) : (
    <div style={card}>{inner}</div>
  );
}

function VideoCard({ companion }: { companion: PneCompanion }) {
  const isLive = companion.status === "live";
  const card: React.CSSProperties = {
    display: "block",
    background: FOREST,
    color: CREAM,
    border: `1px solid ${GOLD_DIM}`,
    borderRadius: 6,
    padding: "20px 22px",
    textDecoration: "none",
    transition: "border-color .15s",
    opacity: isLive ? 1 : 0.85,
  };
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid rgba(200,169,110,0.32)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: GOLD, fontSize: 11, marginLeft: 2 }}>▶</span>
        </div>
        <span style={{ fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: GOLD, fontWeight: 600 }}>
          Week {companion.weekIdx + 1} · Video
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: CREAM_DIM, lineHeight: 1.7 }}>
        {companion.videoSummary}
      </p>
      {!isLive && (
        <p style={{ marginTop: 10, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: GOLD }}>
          Coming Soon
        </p>
      )}
    </>
  );
  return isLive ? (
    <Link href={`${companion.href}#pne-perspective`} style={card}>{inner}</Link>
  ) : (
    <div style={card}>{inner}</div>
  );
}
