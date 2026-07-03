import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PrintBar } from "./PrintBar";

export const metadata = { title: "Ceremony Guidelines — Vital Kauaʻi" };

export default async function CeremonyGuidelinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cream = "#FAF6F0";
  const ink = "#2C2416";
  const inkSoft = "#5C5043";
  const gold = "#B8956A";
  const goldLight = "#E6D5BF";
  const rose = "#C4897A";
  const rule = "rgba(184,149,106,0.25)";
  const cardBg = "#FEFCF8";

  function Card({ accent, icon, title, children }: { accent: string; icon: string; title: string; children: React.ReactNode }) {
    return (
      <div className="cg-card" style={{ background: cardBg, border: `1px solid ${rule}`, borderRadius: 2, padding: "2.25rem 2.5rem", marginBottom: "1.75rem", position: "relative", borderLeft: `3px solid ${accent}` }}>
        <span style={{ fontSize: "1.3rem", marginBottom: "0.6rem", display: "block" }}>{icon}</span>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: "1.45rem", marginBottom: "1rem", lineHeight: 1.2 }}>{title}</h3>
        {children}
      </div>
    );
  }

  const p: React.CSSProperties = { fontSize: "0.9rem", color: inkSoft, marginBottom: "0.9rem", lineHeight: 1.8 };
  const listItem: React.CSSProperties = { fontSize: "0.875rem", color: inkSoft, padding: "0.45rem 0 0.45rem 1.5rem", position: "relative", borderBottom: "1px solid rgba(184,149,106,0.12)", lineHeight: 1.65 };
  const agreementItem: React.CSSProperties = { fontSize: "0.875rem", color: ink, padding: "0.55rem 0 0.55rem 2rem", position: "relative", borderBottom: "1px solid rgba(184,149,106,0.12)", lineHeight: 1.65 };

  return (
    <div className="cg-page" style={{ minHeight: "100vh", background: cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, lineHeight: 1.75, color: ink }}>
      {/* Print / download bar — matches the static portal guides */}
      <PrintBar />

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "block", fontWeight: 400, fontSize: "0.7rem", letterSpacing: "0.22em", textTransform: "uppercase", color: gold, marginBottom: "0.75rem" }}>Member Portal</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(2rem, 5vw, 2.75rem)", lineHeight: 1.2, marginBottom: "1.25rem" }}>Ceremony Guidelines</h2>
          <p style={{ fontSize: "0.95rem", color: inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.8 }}>
            These guidelines exist to support your deepest transformation. They are an invitation, held with care by your facilitators and by each person who enters this space.
          </p>
          <div style={{ width: 48, height: 1, background: gold, margin: "1.5rem auto 0" }} />
        </div>

        {/* 1. Sacred Agreements */}
        <Card accent={gold} icon="&#9671;" title="Sacred Agreements">
          <p style={p}>Entering this container is an act of sacred commitment, to yourself, to those sharing the space with you, and to the work we are here to do together.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
            {[
              "I align with my highest positive intention for the good of all.",
              "I arrive on time, and I remain free of caffeine, alcohol, and substances.",
              "I hold complete confidentiality, the identities, experiences, and private shares of those in this space stay within it.",
              "I keep ceremony and session spaces photo-free, video-free, and social-media-free.",
              "I respect all practices, protocols, and teachings as proprietary to Vital Kaua\u02BBi and hold them within this container.",
              "I take full responsibility for my own experience, using \u201CI\u201D statements and owning my own process.",
              "I ask before offering support \u2014 making sure those around me are seeking help before extending it.",
              "I allow at least two weeks after ceremony before making major life decisions or shifts.",
              "I drive or travel home only when I feel fully grounded and safe to do so.",
              "I honor the purpose of this gathering and the trust it requires.",
            ].map((item) => (
              <li key={item} style={agreementItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontSize: "0.7rem", top: "0.75rem" }}>&#9671;</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* 2. Caring for Yourself */}
        <Card accent={rose} icon="&#9825;" title="Caring for Yourself">
          <p style={p}>Your wellbeing is the foundation of the work. You are the most important variable in your own healing.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              "Drink water, use the restroom freely, move your body, and have a snack as needed.",
              "Stay attuned to your comfort \u2014 physical, emotional, and energetic.",
              "Know your yes\u2019s and your no\u2019s, and trust them. Everything offered is an invitation.",
              "Notice the protective voice in your mind \u2014 the impulse toward fight, flight, freeze, numbing, or dissociation \u2014 and meet it with curiosity and breath.",
              "When in doubt, do less. Less is always honored here.",
              "When difficult material arises, return to breath, sound, and movement as your anchors.",
              "Give your full 100% \u2014 understanding that everyone\u2019s 100% looks beautifully different.",
            ].map((item) => (
              <li key={item} style={listItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontWeight: 400 }}>&mdash;</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* 3. Presence Within the Space */}
        <Card accent={inkSoft} icon="&#10022;" title="Presence Within the Space">
          <p style={p}>Ceremony and deep work call for a quality of awareness, a sustained turning inward, even when held in the company of others.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              { bold: "Alone Together:", text: " Imagine a soft energy bubble around you. Stay anchored in your own process." },
              { bold: "Body Wisdom:", text: " Relax and be present. Your body holds intelligence that the thinking mind cannot access." },
              { bold: "Facilitators as Heart Guardians:", text: " You are always held and protected within this container. Surrender is safe here." },
              { bold: "Everything we offer is a suggestion.", text: "" },
              { bold: "Trauma and activation:", text: " When your body activates, breath, sound, and gentle movement are your guides back to presence." },
              { bold: "Gentleness:", text: " Be gentle with yourself and with one another." },
            ].map((item) => (
              <li key={item.bold} style={listItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontWeight: 400 }}>&mdash;</span>
                <strong style={{ fontWeight: 500, color: ink }}>{item.bold}</strong>{item.text}
              </li>
            ))}
          </ul>
        </Card>

        {/* 4. Facilitator Presence */}
        <Card accent={gold} icon="&#9672;" title="Facilitator Presence & Boundaries">
          <p style={p}>Your facilitators hold this space as mirrors, guides, and fellow travelers, never as authority over your experience.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              { bold: "Facilitator as Mirror:", text: " Your facilitators are human. When personal material arises in us, we name it internally and return our full presence to you." },
              { bold: "Empathic Presence:", text: " We meet you in your experience — accompanying rather than absorbing, witnessing rather than fixing." },
              { bold: "Unconditional Love:", text: " There is nothing you can bring into this space that will be met with anything other than compassionate presence." },
              { bold: "Trust & Sovereignty:", text: " We hold structure and safety \u2014 and within that, we honor your process fully." },
              { bold: "Ask before offering:", text: " Facilitators will always check in before extending physical support or energy work." },
            ].map((item) => (
              <li key={item.bold} style={listItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontWeight: 400 }}>&mdash;</span>
                <strong style={{ fontWeight: 500, color: ink }}>{item.bold}</strong>{item.text}
              </li>
            ))}
          </ul>
        </Card>

        {/* Closing */}
        <div style={{ textAlign: "center", marginTop: "3rem", padding: "2.5rem", border: `1px solid ${goldLight}`, borderRadius: 2, background: "linear-gradient(135deg, rgba(184,149,106,0.06), rgba(122,140,110,0.06))" }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(1.05rem, 2.5vw, 1.3rem)", color: inkSoft, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            Be on purpose. Align with your highest intention for the good of all, and trust that this space, these guides, and the wisdom of your own body will carry you exactly where you need to go.
          </p>
        </div>
      </div>
    </div>
  );
}
