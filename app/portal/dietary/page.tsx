import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dietary Preparation — Vital Kauaʻi" };

export default async function DietaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <DietaryContent />;
}

function SectionHeader({ dot, title }: { dot: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, letterSpacing: "0.03em" }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: "#DDD5C5" }} />
    </div>
  );
}

function DietaryContent() {
  const sage = "#6B8C6E";
  const sageBg = "#EDF2EC";
  const sageSoft = "#C8DAC9";
  const universal = "#8C7B5E";
  const universalBg = "#F2EDE4";
  const gold = "#8B6914";
  const goldBg = "#F5F0E4";
  const goldSoft = "#DEC98A";
  const border = "#DDD5C5";
  const ink = "#2C2416";
  const inkLight = "#5C5040";
  const warmWhite = "#FDFAF6";

  return (
    <div style={{ minHeight: "100vh", background: "#F7F3ED", fontFamily: "'Jost', sans-serif", color: ink, fontSize: 15, lineHeight: 1.75 }}>
      {/* Nav */}
      <nav style={{ background: "rgba(14,26,16,0.97)", backdropFilter: "blur(14px)", padding: "0 48px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(200,169,110,0.08)" }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 300, letterSpacing: "0.2em", color: "#F5F0E8", textTransform: "uppercase", textDecoration: "none" }}>Vital Kauaʻi</a>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="/portal" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,240,232,0.75)", textDecoration: "none" }}>Dashboard</a>
          <div className="nav-dropdown-wrap" style={{ position: "relative", cursor: "pointer" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,240,232,0.75)" }}>Integration</span>
            <div className="nav-dropdown" style={{ left: "50%", transform: "translateX(-50%)" }}>
              <a href="/portal/integration/pre-ceremony" style={{ borderBottom: "none", borderRadius: "4px 4px 0 0" }}>Pre-Ceremony</a>
              <a href="/portal/integration/post-ceremony" style={{ borderTop: "1px solid rgba(200,169,110,0.1)", borderRadius: "0 0 4px 4px" }}>Post-Ceremony</a>
            </div>
          </div>
        </div>
        <a href="/portal" style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,232,0.4)", textDecoration: "none" }}>&larr; Return to Portal</a>
      </nav>
      {/* Header */}
      <div style={{ background: ink, color: "#F7F3ED", padding: "70px 40px 60px", textAlign: "center" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(247,243,237,0.4)", marginBottom: 18 }}>Vital Kaua&#699;i — Client Portal</p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 50, fontWeight: 300, letterSpacing: "0.03em", lineHeight: 1.1, marginBottom: 10 }}>
          Dietary<br /><em style={{ fontStyle: "italic", color: "rgba(247,243,237,0.55)" }}>Preparation</em>
        </h1>
        <p style={{ fontSize: 13, color: "rgba(247,243,237,0.45)", letterSpacing: "0.08em", marginTop: 6 }}>Nourishing your body for the work ahead</p>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 32px 100px" }}>
        {/* Intro */}
        <div style={{ textAlign: "center", marginBottom: 56, paddingBottom: 48, borderBottom: `1px solid ${border}` }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, lineHeight: 1.8, maxWidth: 640, margin: "0 auto 18px" }}>
            What you feed your body in the weeks before you arrive shapes how deeply you can open, how clearly you can receive, and how smoothly you can integrate. This guide is simple by design. Eat close to the earth, reduce what taxes the system, and let the food itself become part of your preparation.
          </p>
          <p style={{ fontSize: 13, color: inkLight, letterSpacing: "0.03em" }}>
            Begin as early as feels right. Four weeks before your arrival is a strong foundation. Two weeks of clean eating still makes a meaningful difference. The sooner, the better.
          </p>
        </div>

        {/* Foundation Principles */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader dot={universal} title="Foundation Principles" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Whole & Unprocessed", title: "Eat as close to the earth as possible", desc: "Vegetables, fruits, legumes, whole grains, nuts, seeds, quality proteins. If it has an ingredient list longer than a few words, set it aside." },
              { label: "Organic & Local", title: "Source with intention", desc: "Farmers markets, farm stands, and local growers where possible. Organic produce, pasture-raised eggs, and free-range or wild-caught animal proteins when you eat them." },
              { label: "Alkaline-Leaning", title: "Build an alkaline foundation", desc: "Dark leafy greens, cucumber, celery, sprouts, avocado, citrus, and fresh herbs. An alkaline-rich diet supports detoxification and nervous system function." },
              { label: "Sprouted & Fermented", title: "Support digestion and bioavailability", desc: "Sprouted grains, sprouted legumes, sauerkraut, kimchi, kefir, and miso. These reduce anti-nutrients and populate the gut with beneficial bacteria." },
            ].map((c) => (
              <div key={c.label} style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 8, padding: "22px 24px" }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: universal, fontWeight: 600, marginBottom: 8 }}>{c.label}</p>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, letterSpacing: "0.02em", marginBottom: 8, lineHeight: 1.25 }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: inkLight, lineHeight: 1.65 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nourish & Release */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader dot={universal} title="Nourish & Release" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            {/* Lean Into */}
            <div style={{ background: sageBg, border: `1px solid ${sageSoft}`, borderRadius: 8, padding: "26px 28px" }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, letterSpacing: "0.03em", marginBottom: 16, color: sage }}>Lean Into</h3>
              <div style={{ display: "grid", gap: 9 }}>
                {["Dark leafy greens \u2014 kale, chard, spinach, arugula", "Colorful vegetables and seasonal fruits", "Sprouts and microgreens", "Beans, lentils, and legumes", "Whole and sprouted grains \u2014 quinoa, millet, brown rice, oats", "Quality fats \u2014 avocado, coconut, olive oil, raw nuts and seeds", "Free-range eggs and wild-caught fish", "Fermented foods \u2014 sauerkraut, kimchi, miso, kefir", "Fresh herbs and medicinal teas", "Clean water and coconut water \u2014 hydrate generously"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: sage, flexShrink: 0, marginTop: 7 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Step Away From */}
            <div style={{ background: universalBg, border: `1px solid ${border}`, borderRadius: 8, padding: "26px 28px" }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, letterSpacing: "0.03em", marginBottom: 16, color: universal }}>Step Away From</h3>
              <div style={{ display: "grid", gap: 9 }}>
                {[
                  { text: "Refined sugar and sweetened beverages", note: "This includes fruit juice, sodas, sweetened coffees and teas" },
                  { text: "Processed and packaged foods", note: "Anything with artificial ingredients, preservatives, or seed oils" },
                  { text: "Alcohol" },
                  { text: "Coffee and caffeinated beverages", note: "Minimize early, and eliminate in the final 1\u20132 weeks before arrival" },
                  { text: "Conventional dairy", note: "Particularly inflammatory for most; opt for fermented or skip entirely" },
                  { text: "Factory-farmed meats" },
                  { text: "Fried foods and fast food" },
                  { text: "Recreational substances" },
                ].map((item) => (
                  <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: universal, flexShrink: 0, marginTop: 7 }} />
                    <span>{item.text}{item.note && <span style={{ display: "block", fontSize: 11.5, color: inkLight, fontStyle: "italic", marginTop: 2 }}>{item.note}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Proper Preparation */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader dot={universal} title="Proper Preparation of Whole Foods" />
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: inkLight, lineHeight: 1.75, maxWidth: 680 }}>
              Beans, grains, nuts, and seeds are deeply nourishing &mdash; and they carry natural compounds called phytic acid, lectins, and enzyme inhibitors that block mineral absorption and cause gas and bloating when left unprepared. Traditional food cultures have always soaked, sprouted, or fermented these foods before eating them.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { dot: sage, title: "Beans & Legumes", note: "Chickpeas, black beans, kidney beans, navy beans, cannellini", steps: ["Rinse thoroughly under cold water", "Soak in filtered water for 12\u201324 hours", "Add 1 tbsp apple cider vinegar or lemon juice per cup", "Change soaking water at least once mid-soak", "Drain, rinse well, and cook in fresh water", "Discard any beans that float"], tip: "Kidney beans require the full 24-hour soak and a vigorous rolling boil for at least 10 minutes." },
              { dot: sage, title: "Lentils & Split Peas", note: "Red, green, black, and French lentils; yellow and green split peas", steps: ["Rinse thoroughly, removing any debris", "Soak in filtered water for 4\u20138 hours", "Add a splash of apple cider vinegar to the soaking water", "Drain, rinse well, and cook in fresh water"], tip: "Even a 4-hour soak significantly reduces gas-producing oligosaccharides. Adding kombu seaweed during cooking further aids digestibility." },
              { dot: universal, title: "Whole Grains & Rice", note: "Brown rice, millet, oats, quinoa, barley, farro", steps: ["Rinse under cold water until water runs clear", "Soak in warm filtered water for 8\u201324 hours", "Add 1 tbsp apple cider vinegar or lemon juice per cup", "Drain, rinse, and cook in fresh water", "Quinoa: rinse vigorously to remove saponins, then soak 4\u20138 hours"], tip: "Sprouted grains go straight to cooking \u2014 their phytic acid has already been significantly reduced." },
              { dot: universal, title: "Nuts & Seeds", note: "Almonds, walnuts, cashews, pumpkin seeds, sunflower seeds", steps: ["Place raw nuts or seeds in a bowl with filtered water to cover", "Add a generous pinch of sea salt", "Soak for 7\u201312 hours (softer nuts like cashews: 4\u20136 hours)", "Drain, rinse well, and use immediately or refrigerate up to 3 days"], tip: "Soaked and dried nuts have a noticeably lighter, creamier quality and are far easier to digest." },
            ].map((card) => (
              <div key={card.title} style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 8, padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: card.dot, flexShrink: 0 }} />
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, letterSpacing: "0.02em" }}>{card.title}</h3>
                </div>
                <p style={{ fontSize: 11.5, color: inkLight, fontStyle: "italic", marginBottom: 14, paddingLeft: 17 }}>{card.note}</p>
                <ul style={{ listStyle: "none", display: "grid", gap: 6, marginBottom: 14 }}>
                  {card.steps.map((s) => (
                    <li key={s} style={{ fontSize: 13, lineHeight: 1.55, paddingLeft: 14, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: sage, fontWeight: 700 }}>&middot;</span>
                      {s}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12, color: inkLight, fontStyle: "italic", borderTop: `1px solid ${border}`, paddingTop: 12, lineHeight: 1.6 }}>{card.tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Iboga Supplement Protocol */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader dot={gold} title="Iboga Journey \u2014 Supplement Protocol" />
          <div style={{ background: goldBg, border: `1px solid ${goldSoft}`, borderRadius: 10, padding: "36px 40px" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: gold, fontWeight: 600, marginBottom: 6 }}>Iboga Preparation</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400, letterSpacing: "0.03em", marginBottom: 14, lineHeight: 1.15 }}>
              Supporting the Vessel<br /><em style={{ fontStyle: "italic", fontWeight: 300 }}>Before Ceremony</em>
            </h2>
            <p style={{ fontSize: 13.5, color: inkLight, lineHeight: 1.75, marginBottom: 28, maxWidth: 580 }}>
              The following supplements support cardiac function, liver health, nervous system integrity, and gut microbiome in the weeks before your Iboga journey. Begin approximately four weeks before your ceremony date.
            </p>
            <div style={{ background: "rgba(139,105,20,0.08)", borderLeft: `3px solid ${gold}`, borderRadius: 4, padding: "14px 18px", fontSize: 12.5, color: inkLight, lineHeight: 1.65, marginBottom: 28, fontStyle: "italic" }}>
              All dosing is guided by your physician. Bring this list to your healthcare provider and follow their recommendations.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {[
                [{ name: "Magnesium Glycinate", purpose: "Cardiac and nervous system support. Reduces excitability and supports deeper sleep.", timing: "Begin 4 weeks before" }, { name: "CoQ10", purpose: "Cardiac-protective antioxidant. Supports mitochondrial function and energy production.", timing: "Begin 4 weeks before" }],
                [{ name: "Vitamin C", purpose: "Immune and adrenal support. Powerful antioxidant that supports detoxification.", timing: "Begin 4 weeks before" }, { name: "DHA + EPA (Omega-3)", purpose: "Brain and nervous system support. Supports membrane integrity.", timing: "Begin 4 weeks before" }],
                [{ name: "B Complex", purpose: "Nervous system and energy support. Supports methylation and mood stability.", timing: "Begin 4 weeks before" }, { name: "NAC (N-Acetyl Cysteine)", purpose: "Liver support and antioxidant. Precursor to glutathione.", timing: "Begin 4 weeks \u2014 discontinue 72 hrs before" }],
                [{ name: "Milk Thistle", purpose: "Liver support and gentle detoxification.", timing: "Begin 4 weeks \u2014 discontinue 1 week before" }, { name: "Probiotics", purpose: "Gut microbiome support. A healthy gut supports mood, immunity, and integration.", timing: "Begin 4 weeks before" }],
              ].map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {row.map((s) => (
                    <div key={s.name} style={{ background: "white", border: `1px solid rgba(222,201,138,0.5)`, borderRadius: 7, padding: "16px 18px" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4, letterSpacing: "0.01em" }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: inkLight, lineHeight: 1.55, marginBottom: 6 }}>{s.purpose}</p>
                      <p style={{ fontSize: 11, color: gold, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.timing}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, background: "rgba(139,105,20,0.06)", border: `1px solid rgba(222,201,138,0.6)`, borderRadius: 7, padding: "18px 20px" }}>
              <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 400, marginBottom: 10, letterSpacing: "0.02em" }}>Medications & Contraindicated Substances</h4>
              <div style={{ display: "grid", gap: 7 }}>
                {[
                  "All medications that require a washout period \u2014 including SSRIs, MAOIs, antipsychotics, and other psychiatric medications \u2014 must be discontinued well in advance of ceremony.",
                  "Recreational substances: discontinue as early as possible. At minimum, step away completely four weeks before your ceremony date.",
                  "Full details on contraindications and medical screening requirements are in your Iboga Preparedness Guide.",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: inkLight, lineHeight: 1.5 }}>
                    <span style={{ color: gold, flexShrink: 0 }}>&mdash;</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Arrival Note */}
        <div style={{ background: warmWhite, border: `1px solid ${border}`, borderRadius: 8, padding: "28px 32px", textAlign: "center" }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, marginBottom: 12, letterSpacing: "0.03em" }}>The Day You Arrive</h3>
          <p style={{ fontSize: 13.5, color: inkLight, maxWidth: 540, margin: "0 auto", lineHeight: 1.75 }}>
            On your arrival day and the day of ceremony, eat lightly &mdash; easy-to-digest whole foods, fresh fruit, soups, or broths. Give your digestive system space to rest. You will be fully nourished and cared for throughout your stay. Arrive as clear, hydrated, and rested as you can.
          </p>
        </div>
      </div>
    </div>
  );
}
