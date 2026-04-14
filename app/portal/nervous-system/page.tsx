import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Nervous System Safety Guide — Vital Kauaʻi" };

export default async function NervousSystemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const forest = "#1C2B1E";
  const deep = "#0E1A10";
  const sage = "#7A9E7E";
  const sageLt = "#A8C5AC";
  const gold = "#C8A96E";
  const cream = "#F5F0E8";
  const warmWhite = "#FDFBF7";
  const stone = "#8B8070";
  const ink = "#1A1A18";
  const inkMid = "#3D3D38";
  const border = "rgba(28,43,30,0.1)";

  return (
    <div style={{ minHeight: "100vh", background: warmWhite, fontFamily: "'Jost', sans-serif", fontWeight: 300, color: ink }}>
      {/* Nav */}

      {/* Hero */}
      <div style={{ background: forest, padding: "72px 60px 68px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 780 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.42em", textTransform: "uppercase", color: gold, display: "block", marginBottom: 16 }}>Iboga Journey &middot; Member Resource</span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(36px, 4vw, 54px)", fontWeight: 300, color: cream, lineHeight: 1.06, marginBottom: 20 }}>
            Your Nervous System<br /><em style={{ fontStyle: "italic", color: sageLt }}>is Wise</em>
          </h1>
          <p style={{ fontSize: 14.5, color: "rgba(245,240,232,0.58)", lineHeight: 1.95, maxWidth: 620, marginBottom: 28 }}>
            A foundational guide prepared for Iboga Journey participants &mdash; polyvagal theory, somatic self-resourcing, and breath practices to support your preparation, ceremony, and integration.
          </p>
          <p style={{ fontSize: 12, color: "rgba(245,240,232,0.3)", borderLeft: "2px solid rgba(168,197,172,0.2)", paddingLeft: 14, lineHeight: 1.7 }}>
            The Iboga journey asks everything of you &mdash; and it gives back more than you can imagine. This guide offers you a foundation before, during, and after ceremony.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 60px 120px" }}>

        {/* ── Polyvagal Theory ── */}
        <div style={{ paddingTop: 72 }}>
          <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: gold, display: "block", marginBottom: 10 }}>Understanding Your Inner Landscape</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 300, lineHeight: 1.1, marginBottom: 12 }}>
            Polyvagal Theory: <em style={{ fontStyle: "italic", color: sage }}>The Map of Your States</em>
          </h2>
          <p style={{ fontSize: 13.5, color: stone, lineHeight: 1.85, maxWidth: 640, paddingBottom: 48, borderBottom: `1px solid ${border}`, marginBottom: 48 }}>
            Developed by neuroscientist Dr. Stephen Porges, polyvagal theory illuminates something your body already knows: your nervous system is constantly reading your environment, scanning for safety, and shifting between states that shape how you think, feel, and relate to the world around you.
          </p>
        </div>

        {/* Three States */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 48 }}>
          {[
            { label: "State One", title: "Ventral Vagal", subtitle: "Safe & Social", desc: "Your home base. Here, your body feels settled, your heart is open, connection feels natural, and creative thought flows easily.", feel: "ease, warmth in the chest, a soft belly, bright eyes, an open throat, a desire to connect.", color: "#1D9E75", bg: "#E1F5EE" },
            { label: "State Two", title: "Sympathetic", subtitle: "Mobilized", desc: "Your system has detected a signal of danger and is preparing you to act \u2014 fight or flee. This state is your protection activating.", feel: "racing heart, tight jaw, shallow breath, heat, restlessness, urgency, irritability, or fear.", color: "#EF9F27", bg: "#FAEEDA" },
            { label: "State Three", title: "Dorsal Vagal", subtitle: "Shutdown", desc: "When overwhelm exceeds what can be mobilized, the system collapses into stillness. This is an ancient form of protection.", feel: "heaviness, numbness, flatness, disconnection, fog, collapse, or a wish to disappear.", color: "#378ADD", bg: "#E6F1FB" },
          ].map((state) => (
            <div key={state.title} style={{ background: state.bg, borderRadius: 10, padding: "24px", border: `0.5px solid ${border}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: stone, marginBottom: 6 }}>{state.label}</p>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: ink, marginBottom: 2 }}>{state.title}</h3>
              <p style={{ fontSize: 11, color: state.color, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{state.subtitle}</p>
              <p style={{ fontSize: 13, color: inkMid, lineHeight: 1.7, marginBottom: 12 }}>{state.desc}</p>
              <p style={{ fontSize: 12, color: stone, fontStyle: "italic", lineHeight: 1.6 }}>You may feel: {state.feel}</p>
            </div>
          ))}
        </div>

        <div style={{ background: forest, padding: "28px 36px", borderLeft: `3px solid ${sageLt}`, marginBottom: 64 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: "italic", color: "rgba(245,240,232,0.7)", lineHeight: 1.8 }}>
            &ldquo;Your body is always doing its best with the information it has. Every state you have ever moved through has been a form of intelligence &mdash; a faithful attempt to keep you alive and whole.&rdquo;
          </p>
        </div>

        {/* ── Somatic Self-Resourcing ── */}
        <div style={{ height: 1, background: `linear-gradient(90deg, ${sageLt}, transparent)`, margin: "64px 0", opacity: 0.4 }} />

        <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: gold, display: "block", marginBottom: 10 }}>Working From the Inside Out</span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 300, lineHeight: 1.1, marginBottom: 12 }}>
          Somatic Self-Resourcing: <em style={{ fontStyle: "italic", color: sage }}>Coming Back to the Body</em>
        </h2>
        <p style={{ fontSize: 13.5, color: stone, lineHeight: 1.85, maxWidth: 640, paddingBottom: 48, borderBottom: `1px solid ${border}`, marginBottom: 48 }}>
          Somatic means &ldquo;of the body.&rdquo; Somatic self-resourcing is the practice of using your own body &mdash; its sensations, its breath, its contact with gravity and the ground &mdash; to create a felt sense of safety within yourself.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 64 }}>
          {[
            { num: "I", title: "Orienting", text: "Slowly allow your gaze to move through the space around you \u2014 as if you are a gentle animal arriving somewhere new. Let your eyes rest on something stable, something soft, something that carries a sense of safety. When you find it, let your gaze settle and breathe there." },
            { num: "II", title: "Grounding", text: "Feel the weight of your body making contact with whatever is beneath you \u2014 a chair, the floor, the earth. Press your feet into the ground. Sense the steady, unwavering support that is always there. Gravity is holding you. The earth is holding you." },
            { num: "III", title: "Titration", text: "You can process in small doses. Titration means coming into contact with a difficult experience in manageable amounts \u2014 allowing a little sensation, a little feeling, and then returning to a resource. Small steps are deep steps." },
            { num: "IV", title: "Pendulation", text: "The nervous system heals through rhythm \u2014 through the natural movement between activation and rest. Pendulation means consciously swinging your awareness between what feels difficult and what feels resourced and safe." },
            { num: "V", title: "Self-Hold", text: "Place your hands on your own body \u2014 over your heart, across your belly, on your upper arms in a gentle self-embrace. Warm, steady touch activates the same co-regulation pathways that are activated in loving human contact. Your own touch is real." },
          ].map((practice) => (
            <div key={practice.num} style={{ padding: "36px 0", borderBottom: `1px solid ${border}` }}>
              <span style={{ fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: sage, display: "block", marginBottom: 10 }}>{practice.num}</span>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 300, lineHeight: 1.35, marginBottom: 14 }}>{practice.title}</p>
              <p style={{ fontSize: 13.5, color: inkMid, lineHeight: 1.85 }}>{practice.text}</p>
            </div>
          ))}
        </div>

        {/* ── The Breath ── */}
        <div style={{ height: 1, background: `linear-gradient(90deg, ${sageLt}, transparent)`, margin: "64px 0", opacity: 0.4 }} />

        <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: gold, display: "block", marginBottom: 10 }}>Your First and Most Faithful Resource</span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 300, lineHeight: 1.1, marginBottom: 12 }}>
          The Breath: <em style={{ fontStyle: "italic", color: sage }}>Always Available, Always Yours</em>
        </h2>
        <p style={{ fontSize: 13.5, color: stone, lineHeight: 1.85, maxWidth: 640, paddingBottom: 48, borderBottom: `1px solid ${border}`, marginBottom: 48 }}>
          Of all the tools available to your nervous system, the breath is the most immediate and the most democratic. When you slow and deepen your breath, you activate the vagus nerve. A longer exhale relative to your inhale communicates directly to your brain that you are safe.
        </p>

        {/* Coherent Heart Breath */}
        <div style={{ background: "rgba(122,158,126,0.06)", border: "1px solid rgba(122,158,126,0.15)", borderRadius: 12, padding: "36px 40px", marginBottom: 48 }}>
          <span style={{ fontSize: 8.5, letterSpacing: "0.4em", textTransform: "uppercase", color: sage, display: "block", marginBottom: 8 }}>Foundational Practice</span>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 300, marginBottom: 8 }}>The Coherent <em style={{ fontStyle: "italic", color: sage }}>Heart Breath</em></h3>
          <p style={{ fontSize: 13, color: stone, lineHeight: 1.8, marginBottom: 28 }}>A complete cycle of breath that fills, stills, and releases</p>

          <p style={{ fontSize: 13, color: inkMid, lineHeight: 1.8, marginBottom: 24, fontStyle: "italic" }}>
            Begin with placement &mdash; Bring one hand to rest over your heart and the other over your belly. Feel the warmth of your palms meeting your body. This contact establishes presence.
          </p>

          {[
            { time: "7 sec", label: "Inhale \u2014 Fill the Belly, Then the Chest", text: "Begin by allowing the breath to flow into the belly first \u2014 feel your lower hand rise as your diaphragm descends. Then continue upward into the chest. Take the full seven seconds to complete this wave of breath, moving from low to high." },
            { time: "7 sec", label: "Hold \u2014 Rest at the Top", text: "At the fullness of your inhale, pause. Hold gently, with presence. Feel the aliveness in your body at this moment. This pause is full. Simply be here for seven seconds." },
            { time: "7 sec", label: "Exhale \u2014 Sound, Soften, Release", text: "Open your mouth and allow the exhale to carry an audible sound \u2014 a sigh, an \u201Cahhh.\u201D Let the chest soften and collapse naturally. Allow the belly to draw gently inward. Take the full seven seconds to empty." },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
              <div style={{ background: forest, color: sageLt, padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", flexShrink: 0, marginTop: 2 }}>{step.time}</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 400, marginBottom: 6 }}>{step.label}</p>
                <p style={{ fontSize: 13, color: inkMid, lineHeight: 1.8 }}>{step.text}</p>
              </div>
            </div>
          ))}

          <p style={{ fontSize: 12, color: stone, fontStyle: "italic", lineHeight: 1.8, borderTop: `1px solid ${border}`, paddingTop: 20, marginTop: 12 }}>
            Repeat for three to five rounds. Allow the practice to complete itself naturally. Return to it whenever you need to remember: your breath is always here, and so are you.
          </p>
        </div>

        {/* ── Additional Practices ── */}
        <div style={{ height: 1, background: `linear-gradient(90deg, ${sageLt}, transparent)`, margin: "64px 0", opacity: 0.4 }} />

        <span style={{ fontSize: 8.5, letterSpacing: "0.44em", textTransform: "uppercase", color: gold, display: "block", marginBottom: 10 }}>More Tools for Your Inner Kit</span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(28px, 3vw, 38px)", fontWeight: 300, lineHeight: 1.1, marginBottom: 32 }}>
          Additional Practices <em style={{ fontStyle: "italic", color: sage }}>to Keep Close</em>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
          {[
            { title: "Orienting Gaze", text: "Slowly allow your gaze to sweep the room. Let your eyes rest briefly on objects that feel neutral or pleasant. This slow, deliberate visual scan signals safety to the subcortical brain." },
            { title: "Feet on the Earth", text: "Stand or sit with bare feet on the ground, or imagine roots extending from the soles of your feet into the earth below. Press down. Feel the earth pressing back." },
            { title: "Temperature Anchor", text: "Hold something warm \u2014 a mug of tea, a warm cloth, your own palms pressed together. Temperature is one of the fastest pathways to the present-moment body." },
            { title: "Name What You Notice", text: "Gently label the sensations you experience with openness and curiosity: tingling, warmth, tightness, expansion. This practice activates the prefrontal cortex and creates stabilizing distance." },
            { title: "Sound & Tone", text: "Humming, chanting, or toning directly vibrates the vagus nerve. A simple sustained hum activates your parasympathetic system and creates resonance in the body." },
            { title: "The Inner Witness", text: "When activation rises, invite the quiet, steady part of yourself to simply observe. Say inwardly: I see what is happening. I am here with it. The witness accompanies — it holds space." },
          ].map((p) => (
            <div key={p.title} style={{ background: "rgba(122,158,126,0.04)", border: `1px solid rgba(122,158,126,0.12)`, borderRadius: 8, padding: "24px 28px" }}>
              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, marginBottom: 10 }}>{p.title}</h4>
              <p style={{ fontSize: 13, color: inkMid, lineHeight: 1.75 }}>{p.text}</p>
            </div>
          ))}
        </div>

        {/* Closing */}
        <div style={{ background: forest, padding: "60px 56px", textAlign: "center", borderRadius: 0 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: sageLt, marginBottom: 16 }}>The Core of Every Practice</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 300, color: cream, marginBottom: 20, lineHeight: 1.2 }}>
            Remember your breath.<br /><em style={{ fontStyle: "italic", color: sageLt }}>You are safe.</em>
          </h2>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.55)", lineHeight: 1.95, maxWidth: 540, margin: "0 auto 20px" }}>
            Every practice in this guide is pointing toward the same place: the living intelligence that already exists within you. The Iboga medicine will meet you exactly where you are.
          </p>
          <p style={{ fontSize: 14, color: "rgba(245,240,232,0.45)", lineHeight: 1.95, maxWidth: 500, margin: "0 auto 20px" }}>
            If you remember one thing, remember your breath.
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: "italic", color: "rgba(245,240,232,0.38)", letterSpacing: "0.05em" }}>
            With deep reverence &mdash; Rachel & Josh &middot; Vital Kaua&#699;i
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: deep, padding: "40px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(200,169,110,0.07)" }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, letterSpacing: "0.15em", color: cream, textTransform: "uppercase", fontWeight: 300 }}>Vital Kaua&#699;i</p>
        <p style={{ fontSize: 11, color: "rgba(245,240,232,0.22)", lineHeight: 1.7, textAlign: "right" }}>
          Nervous System Safety Guide &middot; Confidential<br />
          <a href="/portal" style={{ color: "rgba(200,169,110,0.38)", textDecoration: "none" }}>Return to Portal</a>
        </p>
      </footer>
    </div>
  );
}
