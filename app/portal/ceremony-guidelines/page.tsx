import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
  const sage = "#7A8C6E";
  const sageLt = "#D4DBCE";
  const rose = "#C4897A";
  const rule = "rgba(184,149,106,0.25)";
  const cardBg = "#FEFCF8";

  function Card({ accent, icon, title, children }: { accent: string; icon: string; title: string; children: React.ReactNode }) {
    return (
      <div style={{ background: cardBg, border: `1px solid ${rule}`, borderRadius: 2, padding: "2.25rem 2.5rem", marginBottom: "1.75rem", position: "relative", borderLeft: `3px solid ${accent}` }}>
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
    <div style={{ minHeight: "100vh", background: cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, lineHeight: 1.75, color: ink }}>
      {/* Nav */}

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <span style={{ display: "block", fontWeight: 400, fontSize: "0.7rem", letterSpacing: "0.22em", textTransform: "uppercase", color: gold, marginBottom: "0.75rem" }}>Member Portal</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(2rem, 5vw, 2.75rem)", lineHeight: 1.2, marginBottom: "1.25rem" }}>Ceremony Guidelines</h2>
          <p style={{ fontSize: "0.95rem", color: inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.8 }}>
            These guidelines exist to support your deepest transformation. They are a living invitation &mdash; held with care by your facilitators and by each person who enters this space.
          </p>
          <div style={{ width: 48, height: 1, background: gold, margin: "1.5rem auto 0" }} />
        </div>

        {/* 1. Sacred Agreements */}
        <Card accent={gold} icon="&#9671;" title="Sacred Agreements">
          <p style={p}>Entering this container is an act of sacred commitment &mdash; to yourself, to those sharing the space with you, and to the work we are here to do together.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
            {[
              "I align with my highest positive intention for the good of all.",
              "I arrive on time, having eaten lightly and remained free of alcohol and substances.",
              "I honor and protect the confidentiality of this group.",
              "I respect all practices, protocols, and teachings as proprietary to Vital Kaua\u02BBi and hold them within this container.",
              "I take full responsibility for my own experience, using \u201CI\u201D statements and owning my own process.",
              "I ask before offering support \u2014 making sure those around me are seeking help before extending it.",
              "I allow at least two weeks after any point-holding or ceremony work before making major life decisions or shifts.",
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

        {/* 2. Confidentiality */}
        <Card accent={sage} icon="&#9711;" title="Confidentiality & the Sacred Container">
          <p style={p}>Everything shared and experienced within this space is sacred. We ask that you hold complete confidentiality — the identities of those present, the details of their experiences, processes, and private shares.</p>
          <p style={p}>You are welcome to speak about your own personal feelings and insights. We ask that you keep the specific practices and exercises within this container.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              "When sharing with a partner or loved one, focus on your own experience rather than what others shared or did in the space.",
              "Within any group container, keep each participant\u2019s experience in confidence — even with others from the same group.",
              "Ceremony and session spaces are photo-free, video-free, and social-media-free.",
            ].map((item) => (
              <li key={item} style={listItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontWeight: 400 }}>&mdash;</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>

        {/* 3. Caring for Yourself */}
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

        {/* 4. Presence Within the Space */}
        <Card accent={inkSoft} icon="&#10022;" title="Presence Within the Space">
          <p style={p}>Ceremony and deep work call for a quality of awareness &mdash; a sustained turning inward, even when held in the company of others.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              { bold: "Alone Together:", text: " Imagine a soft energy bubble around you. Stay anchored in your own process." },
              { bold: "Body Wisdom:", text: " Relax and be present. Your body holds intelligence that the thinking mind cannot access." },
              { bold: "Heart Guardians:", text: " You are always held and protected within this container. Surrender is safe here." },
              { bold: "Everything is a suggestion:", text: " The invitations we offer are exactly that. Your body\u2019s wisdom always takes precedence." },
              { bold: "Trauma and activation:", text: " When your body activates, breath, sound, and gentle movement are your guides back to presence." },
              { bold: "Save questions:", text: " Hold questions until the designated Q&A time so the space stays open for everyone." },
              { bold: "Gentleness:", text: " Be gentle with yourself and with one another. This is the most important thing." },
            ].map((item) => (
              <li key={item.bold} style={listItem}>
                <span style={{ position: "absolute", left: 0, color: gold, fontWeight: 400 }}>&mdash;</span>
                <strong style={{ fontWeight: 500, color: ink }}>{item.bold}</strong>{item.text}
              </li>
            ))}
          </ul>
        </Card>

        {/* 5. Facilitator Presence */}
        <Card accent={gold} icon="&#9672;" title="Facilitator Presence & Boundaries">
          <p style={p}>Your facilitators hold this space as mirrors, guides, and fellow travelers &mdash; never as authority over your experience.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
            {[
              { bold: "Healer as Mirror:", text: " Your facilitators are human. When personal material arises in us, we name it internally and return our full presence to you." },
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

        {/* 6. Tantric Attitude */}
        <Card accent={sage} icon="&#8734;" title="Tantric Attitude">
          <p style={{ ...p, marginBottom: 0 }}>
            <span style={{ fontFamily: "'Jost'", fontSize: "0.75rem", fontWeight: 300, color: sage, letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: "0.6rem" }}>Sacred Intimacy & Tantra Work</span>
          </p>
          <p style={{ ...p, marginTop: "0.75rem" }}>For those entering Sacred Intimacy & Tantra offerings, these principles form the energetic orientation of our work together.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
            {["Cultivate self-love", "Release guilt", "Enjoy spontaneity", "Cultivate pleasure & relaxation", "Be fully present", "Discover meditation in the body", "Release goal orientation", "Allow surrender", "Trust the body\u2019s wisdom over the mind"].map((principle) => (
              <div key={principle} style={{ background: sageLt, borderRadius: 2, padding: "0.6rem 0.9rem", fontSize: "0.8rem", color: ink, letterSpacing: "0.03em", lineHeight: 1.4 }}>{principle}</div>
            ))}
          </div>

          <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: sage }}>The Four Foundations</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginTop: "1.25rem" }}>
            {[{ num: "1", name: "Breath" }, { num: "2", name: "Movement" }, { num: "3", name: "Sound" }, { num: "4", name: "Visualization" }].map((f) => (
              <div key={f.name} style={{ textAlign: "center", padding: "1rem 0.5rem", border: `1px solid ${rule}`, borderRadius: 2 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 300, color: gold, display: "block", lineHeight: 1, marginBottom: "0.4rem" }}>{f.num}</span>
                <span style={{ fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: inkSoft }}>{f.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Closing */}
        <div style={{ textAlign: "center", marginTop: "3rem", padding: "2.5rem", border: `1px solid ${goldLight}`, borderRadius: 2, background: "linear-gradient(135deg, rgba(184,149,106,0.06), rgba(122,140,110,0.06))" }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(1.05rem, 2.5vw, 1.3rem)", color: inkSoft, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            Be on purpose. Align with your highest intention for the good of all &mdash; and trust that this space, these guides, and the wisdom of your own body will carry you exactly where you need to go.
          </p>
        </div>
      </div>
    </div>
  );
}
