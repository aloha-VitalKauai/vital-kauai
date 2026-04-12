import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Support Person Guide — Vital Kauaʻi" };

export default async function SupportPersonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cream = "#F7F3EE";
  const ink = "#1C1814";
  const inkMid = "#3A3330";
  const textMid = "#5A504A";
  const textLight = "#8A7E78";
  const sage = "#7A9E7E";
  const sageLt = "rgba(122,158,126,0.12)";
  const rose = "#C4826A";
  const roseLt = "rgba(196,130,106,0.10)";
  const gold = "#B8974A";
  const goldLt = "rgba(184,151,74,0.10)";
  const border = "rgba(60,48,40,0.10)";
  const borderWarm = "rgba(184,151,74,0.18)";

  const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 400, lineHeight: 1.2 };
  const prose: React.CSSProperties = { fontSize: 15.5, color: textMid, lineHeight: 1.9, marginBottom: 22 };

  return (
    <div style={{ minHeight: "100vh", background: cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, lineHeight: 1.75, fontSize: 15, color: ink }}>
      {/* Header */}
      <header style={{ padding: "28px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}`, position: "sticky", top: 0, background: cream, zIndex: 100 }}>
        <a href="/portal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 400, letterSpacing: "0.12em", color: ink, textDecoration: "none" }}>Vital Kaua<span style={{ color: sage }}>&#699;</span>i</a>
        <span style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: textLight }}>Support Person Guide</span>
        <a href="/portal" style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: textLight, textDecoration: "none" }}>&larr; Return to Portal</a>
      </header>

      {/* Hero */}
      <section style={{ padding: "100px 40px 80px", maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
        <span style={{ display: "inline-block", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: sage, marginBottom: 28 }}>For the People Who Love Them</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(38px, 6vw, 62px)", fontWeight: 300, lineHeight: 1.15, marginBottom: 28 }}>
          You are part of <em style={{ fontStyle: "italic", color: rose }}>this journey</em> too.
        </h1>
        <p style={{ fontSize: 16, color: textMid, maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.85 }}>
          Someone you love is doing something courageous. This guide is here to help you understand what to expect &mdash; and how to show up well, before and after they return.
        </p>
        <div style={{ width: 48, height: 1, background: gold, margin: "0 auto", opacity: 0.5 }} />
      </section>

      {/* Section Nav */}
      <nav style={{ maxWidth: 900, margin: "0 auto", padding: "0 40px 72px", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {["Understanding Iboga", "Before They Leave", "During the Ceremony", "When They Return", "Caring for Yourself"].map((label) => (
          <span key={label} style={{ display: "inline-block", padding: "10px 22px", border: `1px solid ${borderWarm}`, borderRadius: 40, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: textMid }}>{label}</span>
        ))}
      </nav>

      {/* Section 1: Understanding Iboga */}
      <Section num="01" label="The Foundation" title="Understanding" titleEm="Iboga" rose={rose} border={border} sage={sage}>
        <p style={prose}>Iboga is a sacred root medicine from the Bwiti tradition of Central Africa. At Vital Kaua&#699;i, ceremonies are held with deep reverence &mdash; rooted in lineage, conducted by trained guides, within a carefully prepared container on the North Shore of Kaua&#699;i.</p>
        <p style={prose}>Iboga works on a profound level &mdash; moving through the nervous system, the emotional body, and the unconscious over a ceremony that typically spans 24 to 36 hours. People come for many reasons: to release addiction, to metabolize grief or trauma, to step into a new chapter.</p>
        <p style={prose}>The medicine&rsquo;s work does not end with ceremony. In the days and weeks that follow, it continues &mdash; reorganizing how a person relates to themselves and the world. This is called integration, and your role during this time matters enormously.</p>
      </Section>

      <Divider />

      {/* Section 2: Before They Leave */}
      <Section num="02" label="Preparation" title="Before" titleEm="They Leave" rose={rose} border={border} sage={sage}>
        <p style={prose}>Your person is following a rigorous preparation protocol &mdash; dietary changes, emotional introspection, physical preparation. They may already feel quieter or more inward than usual. A steady, calm presence from you is one of the most meaningful things you can offer.</p>
        <Callout color={sage} bg={sageLt} label="How You Might Support">
          Lighten their logistical load where you can. If they want to talk, listen without needing to fix anything. If they are pulling inward, let that be okay. Your genuine send-off &mdash; a simple expression of love and support as they leave &mdash; becomes part of the container they carry into ceremony.
        </Callout>
      </Section>

      <Divider />

      {/* Section 3: During the Ceremony */}
      <Section num="03" label="The Ceremony Days" title="While They Are" titleEm="in Ceremony" rose={rose} border={border} sage={sage}>
        <p style={prose}>Ceremony typically begins in the evening and continues through the night and into the following day. During this time, your person will have no access to their phone and will be in a fully darkened ceremonial space. You will hear nothing from them &mdash; and that silence is by design.</p>
        <Callout color={rose} bg={roseLt} label="For You, While You Wait">
          The waiting is its own experience. You may feel restless, concerned, or simply aware of an open space. This is a meaningful time to hold them in your heart, to pray or set an intention for their wellbeing, or simply to go about your life knowing they are cared for.
        </Callout>
        <p style={prose}>After ceremony concludes, there is typically a period of profound stillness and rest before your person is ready to connect. They will most likely reach out after 48 hours have passed &mdash; please allow that timeline to unfold naturally.</p>
      </Section>

      <Divider />

      {/* Section 4: When They Return */}
      <Section num="04" label="Integration" title="When They" titleEm="Return Home" rose={rose} border={border} sage={sage}>
        <p style={prose}>This is the phase that calls most upon your patience and understanding. In the days and weeks after ceremony, the person who returns is genuinely tender &mdash; rebuilding from a more honest foundation. They may seem slower, quieter, and less available for ordinary connection.</p>
        <Callout color={gold} bg={goldLt} label="The Most Important Thing to Know">
          If your person seems unreachable or less relational than usual, that is not a reflection of their love for you, or of something going wrong. It is temporary, and it is not personal.
        </Callout>
        <p style={prose}>What tends to support them most: clean food, rest, low stimulation, gentle nature, and space to be quiet without explanation.</p>
        <Callout color={sage} bg={sageLt} label="Questions Worth Asking">
          <span>When the time feels right, these simple invitations open space without pressure:</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {["\u201CWhat are you noticing?\u201D", "\u201CHow can I support you best right now?\u201D", "\u201CIs there anything you need from me today \u2014 or anything you need less of?\u201D", "\u201CI\u2019m here. There\u2019s no rush.\u201D", "\u201CWould you like company, or would space feel better?\u201D"].map((q) => (
              <p key={q} style={{ paddingLeft: 18, borderLeft: `1px solid ${sage}`, fontSize: 14.5, color: inkMid, lineHeight: 1.75, margin: 0 }}>{q}</p>
            ))}
          </div>
        </Callout>

        {/* Timeline */}
        <div style={{ margin: "40px 0" }}>
          {[
            { time: "Days 1\u20133", title: "Stillness & Landing", text: "Rest, sleep, minimal stimulation. Quiet presence is the greatest gift." },
            { time: "Week 1\u20132", title: "Emergence", text: "Gradual return of presence, appetite, and speech. Emotions may move unexpectedly. Let them share at their own pace." },
            { time: "Weeks 2\u20138", title: "Active Integration", text: "Insights become changes \u2014 in habits, relationships, perspective. Witnessing without judgment is everything." },
            { time: "Months 2\u20136", title: "Stabilization", text: "The new ground becomes the new normal. Relationships often grow richer, more honest, and more present." },
          ].map((item, i, arr) => (
            <div key={item.title} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0 32px", padding: "28px 0", borderBottom: i < arr.length - 1 ? `1px solid ${border}` : "none" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: "italic", color: gold, paddingTop: 3, lineHeight: 1.5 }}>{item.time}</div>
              <div>
                <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, marginBottom: 8 }}>{item.title}</h4>
                <p style={{ fontSize: 14.5, color: textMid, lineHeight: 1.85, margin: 0 }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* Section 5: Caring for Yourself */}
      <Section num="05" label="Your Inner Experience" title="Caring for" titleEm="Yourself" rose={rose} border={border} sage={sage}>
        <p style={prose}>Supporting someone through this process is its own journey. You may feel proud and nervous and quietly left out all at once. When your person returns and is not yet available in the ways you are used to, confusion, disconnection, or even resentment can surface. These feelings are real, valid, and human.</p>
        <Callout color={rose} bg={roseLt} label="This Is Worth Naming">
          Tending to your own needs during this time is not a distraction from supporting them &mdash; it is what makes sustained support possible. Stay close to the people and practices that help you feel grounded.
        </Callout>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, margin: "36px 0" }}>
          {[
            { title: "Ground Yourself", body: "Nature, movement, breath \u2014 the practices that help you feel like yourself are essential right now." },
            { title: "Find Your People", body: "Let your own network hold your needs so they have somewhere to land." },
            { title: "Reach Out to Us", body: "Rachel and Josh are available to you too \u2014 for clarity, reassurance, or simply a conversation." },
          ].map((card) => (
            <div key={card.title} style={{ padding: 28, border: `1px solid ${border}`, borderRadius: 4, background: "rgba(247,243,238,0.6)" }}>
              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{card.title}</h4>
              <p style={{ fontSize: 13.5, color: textMid, lineHeight: 1.8 }}>{card.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* Section 6: Other Offerings */}
      <Section num="06" label="Other Vital Kauaʻi Journeys" title="A Note on Our" titleEm="Other Offerings" rose={rose} border={border} sage={sage}>
        <p style={prose}>Vital Kaua&#699;i also holds Sacred Intimacy & Tantra journeys and Vitality & Detox programs. Someone returning from Sacred Intimacy work may be more emotionally open and self-aware in relationship. Someone returning from a Vitality program may have changed appetites and a heightened sensitivity.</p>
        <Callout color={sage} bg={sageLt} label="For All Journeys">
          Whatever brought your person to Vital Kaua&#699;i, your role is the same: patient, loving witness. You do not have to understand everything to be a profound source of support.
        </Callout>
      </Section>

      {/* Closing */}
      <section style={{ background: ink, color: cream, padding: "80px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <span style={{ display: "inline-block", fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: gold, opacity: 0.8, marginBottom: 28 }}>We Are Here for You Too</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: 300, lineHeight: 1.25, marginBottom: 20 }}>You do not have to navigate this alone.</h2>
          <p style={{ fontSize: 15, color: "rgba(247,243,238,0.65)", lineHeight: 1.85, marginBottom: 40 }}>
            Questions, concerns, or simply need to talk &mdash; we are here for you at any point in this journey.
          </p>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: gold, opacity: 0.7 }}>Reach Rachel & Josh</span>
            <a href="mailto:aloha@vitalkauai.com" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: "italic", color: cream, textDecoration: "none", borderBottom: "1px solid rgba(247,243,238,0.2)", paddingBottom: 4 }}>aloha@vitalkauai.com</a>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "28px 40px", borderTop: `1px solid ${border}`, fontSize: 11, letterSpacing: "0.12em", color: textLight }}>
        &copy; Vital Kaua&#699;i &middot; North Shore, Kaua&#699;i, Hawai&#699;i
      </footer>
    </div>
  );
}

/* ── Helper Components ── */
function Section({ num, label, title, titleEm, rose, border, sage, children }: { num: string; label: string; title: string; titleEm: string; rose: string; border: string; sage: string; children: React.ReactNode }) {
  return (
    <section style={{ maxWidth: 820, margin: "0 auto", padding: "0 40px 96px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 28, marginBottom: 48, paddingBottom: 32, borderBottom: `1px solid ${border}` }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 300, lineHeight: 1, color: "rgba(184,151,74,0.18)", flexShrink: 0, marginTop: -6 }}>{num}</div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.38em", textTransform: "uppercase", color: sage, display: "block", marginBottom: 10 }}>{label}</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 400, lineHeight: 1.2 }}>
            {title} <em style={{ fontStyle: "italic", color: rose }}>{titleEm}</em>
          </h2>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Callout({ color, bg, label, children }: { color: string; bg: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `2px solid ${color}`, background: bg, padding: "24px 28px", margin: "36px 0", borderRadius: "0 6px 6px 0" }}>
      <span style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color, marginBottom: 10, display: "block" }}>{label}</span>
      <div style={{ color: "#3A3330", fontSize: 15, lineHeight: 1.85 }}>{children}</div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto 80px", padding: "0 40px" }}>
      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,151,74,0.18), transparent)" }} />
    </div>
  );
}
