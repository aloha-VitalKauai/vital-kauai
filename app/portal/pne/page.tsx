import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  PNE_ADDITIONAL_RESOURCES,
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
      <section style={{ background: FOREST, color: CREAM, padding: "78px 48px 72px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <p style={{ fontSize: 9.5, letterSpacing: "0.42em", textTransform: "uppercase", color: GOLD, marginBottom: 20 }}>
            Member Portal · Resources
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(38px, 4.4vw, 62px)", fontWeight: 300, lineHeight: 1.06, marginBottom: 22 }}>
            PsychoNeuroEnergetics
            <br />
            <em style={{ fontStyle: "italic", color: SAGE_LT }}>(PNE) Resources</em>
          </h1>
          <p style={{ fontSize: 15, color: CREAM_SOFT, lineHeight: 1.95, maxWidth: 640, marginBottom: 38 }}>
            A library of body-led teachings paired with each week of your journey. Start with the orientation video, then move through the weekly companions before and after ceremony.
          </p>

          {/* Hero video */}
          <div style={{ border: `1px solid ${GOLD_DIM}`, borderRadius: 6, overflow: "hidden", maxWidth: 760 }}>
            <div style={{ background: FOREST_DEEP, padding: "32px 36px", display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: `1px solid rgba(200,169,110,0.32)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: GOLD, fontSize: 16, marginLeft: 4 }}>▶</span>
              </div>
              <div>
                <p style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
                  Orientation · What PNE Is
                </p>
                <p style={{ fontSize: 14, color: CREAM_SOFT, lineHeight: 1.75, maxWidth: 520 }}>
                  An introduction to PsychoNeuroEnergetics from Judith Johnson, and why this body-led work is the foundation of preparation and integration on the journey.
                </p>
                <p style={{ marginTop: 12, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: GOLD }}>
                  Coming Soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "72px 48px 120px" }}>
        {/* Weekly Companion */}
        <section style={{ marginBottom: 88 }}>
          <SectionHead eyebrow="Weekly Companion" title={["The PNE ", "Companion"]} />
          <p style={{ fontSize: 14.5, color: "#3D4D3F", lineHeight: 1.85, maxWidth: 680, marginBottom: 32 }}>
            Twelve weeks of teaching, paired with the Hawaiian principle of each week. Read alongside your integration work or return when something asks for a slower listen.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <CompanionColumn label="Before the Threshold · Weeks 1–6" companions={pre} />
            <CompanionColumn label="Integration · Weeks 1–6" companions={post} />
          </div>
        </section>

        {/* Video Library */}
        <section style={{ marginBottom: 88 }}>
          <SectionHead eyebrow="Video Library" title={["Teachings, ", "by Week"]} />
          <p style={{ fontSize: 14.5, color: "#3D4D3F", lineHeight: 1.85, maxWidth: 680, marginBottom: 32 }}>
            Each week's PNE teaching, gathered in one place. Click into a card to play inline once a video is ready, or to open the full weekly companion.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <VideoColumn label="Pre-Ceremony" companions={pre} />
            <VideoColumn label="Post-Ceremony" companions={post} />
          </div>
        </section>

        {/* Additional Resources */}
        <section>
          <SectionHead eyebrow="Vital Kauaʻi Guides" title={["Additional ", "Resources"]} />
          <p style={{ fontSize: 14.5, color: "#3D4D3F", lineHeight: 1.85, maxWidth: 680, marginBottom: 32 }}>
            Companion guides that sit alongside the PNE library. Use them as the journey unfolds.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {PNE_ADDITIONAL_RESOURCES.map((r) => (
              <ResourceCard key={r.title} title={r.title} description={r.description} href={r.href} comingSoon={r.status === "coming-soon"} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: [string, string] }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 9, letterSpacing: "0.36em", textTransform: "uppercase", color: SAGE, marginBottom: 10, fontWeight: 500 }}>{eyebrow}</p>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(28px, 3.2vw, 40px)", fontWeight: 300, lineHeight: 1.1, color: "#1A1A18" }}>
        {title[0]}<em style={{ fontStyle: "italic", color: SAGE }}>{title[1]}</em>
      </h2>
    </div>
  );
}

function CompanionColumn({ label, companions }: { label: string; companions: ReadonlyArray<PneCompanion> }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: SAGE, marginBottom: 14, fontWeight: 500 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {companions.map((c) => (
          <CompanionCard key={`${c.phase}-${c.weekIdx}`} companion={c} />
        ))}
      </div>
    </div>
  );
}

function CompanionCard({ companion }: { companion: PneCompanion }) {
  const isLive = companion.status === "live";
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: SAGE, fontWeight: 500 }}>
          Week {companion.weekIdx + 1} · {companion.code} · {companion.theme}
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
  const baseCard: React.CSSProperties = {
    display: "block",
    background: "#FFFFFF",
    border: `1px solid ${isLive ? "rgba(122,158,126,0.25)" : "rgba(28,43,30,0.08)"}`,
    borderLeft: `3px solid ${isLive ? SAGE : "rgba(200,169,110,0.35)"}`,
    borderRadius: 6,
    padding: "18px 22px",
    textDecoration: "none",
    transition: "border-color .15s, transform .15s",
  };
  return isLive ? (
    <Link href={companion.href} style={baseCard}>
      {inner}
    </Link>
  ) : (
    <div style={{ ...baseCard, background: "rgba(245,240,232,0.5)" }}>{inner}</div>
  );
}

function VideoColumn({ label, companions }: { label: string; companions: ReadonlyArray<PneCompanion> }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: SAGE, marginBottom: 14, fontWeight: 500 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {companions.map((c) => (
          <VideoCard key={`${c.phase}-${c.weekIdx}`} companion={c} />
        ))}
      </div>
    </div>
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
    padding: "18px 22px",
    textDecoration: "none",
    transition: "border-color .15s",
  };
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid rgba(200,169,110,0.32)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: GOLD, fontSize: 11, marginLeft: 2 }}>▶</span>
        </div>
        <span style={{ fontSize: 9, letterSpacing: "0.26em", textTransform: "uppercase", color: GOLD }}>
          Week {companion.weekIdx + 1} · {companion.code}
        </span>
      </div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 300, color: CREAM, lineHeight: 1.3, marginBottom: 6 }}>
        {companion.title}
      </p>
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
    <Link href={`${companion.href}#pne-perspective`} style={card}>
      {inner}
    </Link>
  ) : (
    <div style={{ ...card, opacity: 0.85 }}>{inner}</div>
  );
}

function ResourceCard({ title, description, href, comingSoon }: { title: string; description: string; href: string; comingSoon: boolean }) {
  const card: React.CSSProperties = {
    display: "block",
    background: "#FFFFFF",
    border: `1px solid rgba(28,43,30,0.1)`,
    borderRadius: 6,
    padding: "20px 22px",
    textDecoration: "none",
    color: "#1A1A18",
  };
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: comingSoon ? "#6A655B" : "#1A1A18" }}>
          {title}
        </p>
        {comingSoon && (
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: GOLD }}>Coming Soon</span>
        )}
      </div>
      <p style={{ fontSize: 13.5, color: "#3D4D3F", lineHeight: 1.7 }}>
        {description}
      </p>
    </>
  );
  return comingSoon ? (
    <div style={{ ...card, background: "rgba(245,240,232,0.5)" }}>{inner}</div>
  ) : (
    <Link href={href} style={card}>
      {inner}
    </Link>
  );
}

