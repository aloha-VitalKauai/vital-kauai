import DownloadItineraryButton from '@/components/dashboard/DownloadItineraryButton'

const FONTS = "'Cormorant Garamond', var(--font-cormorant-garamond), serif"
const BODY = "'Jost', var(--font-jost), sans-serif"

const STYLES = `
.aftercare { background:#f5f0e8; color:#2a2a26; font-family:${BODY}; font-weight:300; line-height:1.7; letter-spacing:.01em; -webkit-font-smoothing:antialiased; min-height:100vh; position:relative; }
.aftercare * { box-sizing:border-box; margin:0; padding:0; }
.aftercare .wrapper { max-width:880px; margin:0 auto; padding:80px 48px 120px; position:relative; }
.aftercare .download-btn { position:absolute; top:24px; right:24px; display:inline-flex; align-items:center; gap:6px; font-family:${BODY}; font-size:10px; font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:#b08d5a; background:rgba(176,141,90,.08); border:1px solid rgba(176,141,90,.35); border-radius:4px; padding:8px 14px; cursor:pointer; transition:background .15s ease, border-color .15s ease; z-index:10; }
.aftercare .download-btn:hover { background:rgba(176,141,90,.16); border-color:rgba(176,141,90,.6); }
.aftercare .download-btn svg { stroke:#b08d5a; }

.aftercare header { text-align:center; padding-bottom:56px; border-bottom:1px solid rgba(42,42,38,.14); margin-bottom:64px; }
.aftercare .eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.32em; text-transform:uppercase; color:#b08d5a; font-weight:500; margin-bottom:22px; }
.aftercare h1 { font-family:${FONTS}; font-weight:400; font-size:56px; line-height:1.05; letter-spacing:-.01em; color:#28301f; margin-bottom:18px; }
.aftercare h1 em { font-style:italic; color:#b08d5a; font-weight:400; }
.aftercare .lede { font-family:${FONTS}; font-style:italic; font-size:19px; color:rgba(42,42,38,.62); max-width:560px; margin:0 auto; line-height:1.55; }
.aftercare .meta-row { display:flex; gap:32px; justify-content:center; margin-top:34px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#8a9a85; font-weight:500; flex-wrap:wrap; }

.aftercare section.block { margin-bottom:64px; }
.aftercare .section-eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:#8a9a85; font-weight:500; margin-bottom:12px; }
.aftercare h2 { font-family:${FONTS}; font-weight:400; font-size:34px; color:#28301f; margin-bottom:18px; letter-spacing:-.005em; }
.aftercare h2 em { font-style:italic; color:#b08d5a; }
.aftercare p.body { font-size:15px; color:#3d3d38; line-height:1.85; margin-bottom:16px; max-width:680px; }
.aftercare p.body strong { color:#28301f; font-weight:500; }

.aftercare .intro-card { background:#ebe4d6; border-radius:2px; padding:40px 44px; }
.aftercare .intro-card p:last-child { margin-bottom:0; }

.aftercare .value { padding:22px 0; border-top:1px solid rgba(42,42,38,.14); }
.aftercare .value:first-of-type { border-top:none; padding-top:4px; }
.aftercare .value h3 { font-family:${FONTS}; font-size:24px; font-weight:400; color:#28301f; margin-bottom:6px; }
.aftercare .value p { font-size:14px; color:#3d3d38; line-height:1.8; max-width:660px; }

.aftercare .principle { display:grid; grid-template-columns:44px 1fr; gap:20px; padding:18px 0; border-top:1px dashed rgba(42,42,38,.16); }
.aftercare .principle:first-of-type { border-top:none; padding-top:6px; }
.aftercare .principle .num { font-family:${FONTS}; font-style:italic; font-size:30px; color:#b08d5a; line-height:1; }
.aftercare .principle .p-title { font-family:${FONTS}; font-size:20px; color:#28301f; margin-bottom:4px; }
.aftercare .principle .p-text { font-size:13.5px; color:#3d3d38; line-height:1.75; }

.aftercare .duty { margin-bottom:26px; }
.aftercare .duty h4 { font-family:${BODY}; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#085041; font-weight:600; margin-bottom:10px; }
.aftercare .duty p.duty-intro { font-size:14px; color:#3d3d38; line-height:1.75; margin-bottom:10px; max-width:660px; }
.aftercare ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.aftercare ul li { font-size:14px; color:#3d3d38; line-height:1.65; padding-left:18px; position:relative; max-width:680px; }
.aftercare ul li::before { content:''; position:absolute; left:0; top:9px; width:5px; height:5px; border-radius:50%; background:#b08d5a; }

.aftercare .emergency { background:rgba(162,58,42,.06); border:1px solid rgba(162,58,42,.3); border-left:3px solid #a33a2a; border-radius:2px; padding:40px 44px; }
.aftercare .emergency .section-eyebrow { color:#a33a2a; }
.aftercare .emergency h2 { color:#8f2f21; }
.aftercare .emergency p.body { color:#4a352f; }
.aftercare .emergency ul li { color:#4a352f; }
.aftercare .emergency ul li::before { background:#a33a2a; }

.aftercare .closing { text-align:center; margin-top:80px; padding-top:40px; border-top:1px solid rgba(42,42,38,.14); }
.aftercare .closing p { font-family:${FONTS}; font-style:italic; font-size:20px; color:#28301f; line-height:1.6; max-width:560px; margin:0 auto 12px; }
.aftercare .closing .mahalo { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:#8a9a85; font-style:normal; font-family:${BODY}; }

@media print {
  .aftercare { background:white; }
  .aftercare .wrapper { padding:32px; }
  .aftercare .download-btn { display:none !important; }
  .aftercare .intro-card, .aftercare .principle, .aftercare .duty, .aftercare .emergency, .aftercare .value { page-break-inside:avoid; }
  nav.pn, nav.vk-dock, header[role="banner"] { display:none !important; }
}
@media (max-width:720px) {
  .aftercare .wrapper { padding:48px 22px; }
  .aftercare h1 { font-size:40px; }
  .aftercare .download-btn { top:12px; right:12px; padding:6px 10px; font-size:9px; letter-spacing:.14em; }
  .aftercare .principle { grid-template-columns:32px 1fr; gap:14px; }
  .aftercare .intro-card, .aftercare .emergency { padding:28px 24px; }
  .aftercare .meta-row { flex-direction:column; gap:10px; }
}
`

const PRINCIPLES: { title: string; text: string }[] = [
  { title: 'The Sacred Nature of Healing', text: 'We believe that healing, of body, mind, and spirit, is a sacred act. The restoration of wholeness in a human being is among the most holy endeavors a community can undertake together.' },
  { title: 'Direct Spiritual Experience', text: 'We believe that direct, personal encounter with the divine is the birthright of every human being. Ceremony, intention, and sacred plant sacraments are vessels through which such encounter becomes possible.' },
  { title: 'The Sanctity of Consciousness', text: 'We hold that consciousness itself is sacred. The exploration and expansion of consciousness through sincere spiritual practice is a protected and deeply meaningful human activity.' },
  { title: 'Community as Practice', text: 'We believe that a genuine spiritual community, people in covenant with one another, committed to mutual growth and accountability, is itself a form of worship and a source of healing.' },
  { title: 'Sovereignty of the Individual', text: 'We hold that each person carries an innate wisdom and an inviolable right to seek their own healing and spiritual truth. Our role is to create conditions for that sovereignty to be fully expressed.' },
  { title: 'The Earth as Sacred Ground', text: 'We believe the natural world is an active participant in spiritual life. Kauaʻi’s land, waters, and living systems are part of our congregation.' },
  { title: 'Reciprocity & Right Relationship', text: 'Our practice lives in right relationship with the lineages, lands, and peoples who carry this medicine, met with humility, acknowledgment, and tangible support.' },
  { title: 'Safety as Sacred', text: 'We hold that depth and care are inseparable. Every ceremony rests on thorough preparation, honest screening, and attentive presence, so that the deepest work unfolds within the safest container.' },
  { title: 'Integration as the Work', text: 'We believe transformation is completed in daily living. What opens in ceremony takes root through sustained integration, held in community over time.' },
  { title: 'Sacred Trust', text: 'We hold what is shared in this community as sacred trust. Confidentiality and discretion protect the vulnerability that genuine healing requires.' },
]

export const metadata = { title: 'Aftercare Guide — Vital Kauaʻi' }

export default function AftercareGuidePage() {
  return (
    <div style={{ margin: '-1.75rem -2rem' }}>
      <style>{STYLES}</style>
      <div className="aftercare">
        <div className="wrapper">
          <DownloadItineraryButton />

          <header>
            <div className="eyebrow">Founders Dashboard · Aftercare</div>
            <h1>Aftercare <em>Guide</em></h1>
            <p className="lede">Values &amp; responsibilities for the guides who hold space for members through integration and recovery.</p>
            <div className="meta-row">
              <span>For Aftercare Guides</span>
              <span>Hanalei · Kauaʻi</span>
              <span>Presence · Service · Unconditional Love</span>
            </div>
          </header>

          <section className="block">
            <div className="intro-card">
              <div className="section-eyebrow">Mahalo for Your Kokua</div>
              <p className="body"><strong>Purpose.</strong> The Aftercare Guide holds space for members during their integration and recovery. The work is quiet, attentive, and deeply human.</p>
              <p className="body">You&rsquo;re here because we know you are a grounded, centered, calm, and loving presence.</p>
            </div>
          </section>

          <section className="block">
            <div className="section-eyebrow">Our Core Values</div>
            <h2>The Ground We <em>Stand On</em></h2>
            <div className="value">
              <h3>Presence</h3>
              <p>Be fully here. Set aside your phone and distractions, and offer your steady, calm attention. A grounded, centered presence is the single most important thing you bring to this role.</p>
            </div>
            <div className="value">
              <h3>Service</h3>
              <p>Attend to needs humbly and without ego. Anticipate what a member may need before they ask, and offer it freely. Service is love in action, expressed through small, consistent, caring acts.</p>
            </div>
            <div className="value">
              <h3>Unconditional Love</h3>
              <p>Hold every member with acceptance and warmth, and without judgment. Whatever arises, meet it with compassion.</p>
            </div>
          </section>

          <section className="block">
            <div className="section-eyebrow">Guiding Principles of Our Practice</div>
            <h2>Ten Principles That <em>Guide Us</em></h2>
            <p className="body">These ten principles guide everything we do at Vital Kauaʻi.</p>
            {PRINCIPLES.map((p, i) => (
              <div className="principle" key={p.title}>
                <div className="num">{i + 1}</div>
                <div>
                  <div className="p-title">{p.title}</div>
                  <div className="p-text">{p.text}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="block">
            <div className="section-eyebrow">Role &amp; Responsibilities</div>
            <h2>The Work <em>Itself</em></h2>
            <p className="body">The Aftercare Guide supports members through their rest and recovery with attentive care. Core responsibilities include:</p>

            <div className="duty">
              <h4>Comfort &amp; Basic Needs</h4>
              <ul>
                <li>Bring tea, water, and food to the member as needed.</li>
                <li>Assist the member to and from the bathroom.</li>
                <li>Help the member walk and move safely when needed.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>Monitoring &amp; Check-Ins</h4>
              <ul>
                <li>Check on the member every 30 minutes to 1 hour while they are sleeping.</li>
                <li>Note if the member purges, and record how many times.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>Stay in Communication</h4>
              <ul>
                <li>Keep the team text thread updated in real time: who purged and when, who is sleeping, who is eating or not eating, and each member&rsquo;s general mental, emotional, and physical state.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>Presence &amp; Supervision</h4>
              <ul>
                <li>Never leave a member alone.</li>
                <li>Encourage them to rest on the lanai, watch the breeze, and take in the water and surroundings.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>If Signs of Dysregulation Arise</h4>
              <p className="duty-intro">If a member shows signs of dysregulation, such as dissociation, anxiety, or fear, respond gently and simply:</p>
              <ul>
                <li>Offer a warm mug of tea and a cool compress.</li>
                <li>Guide them to breathe slowly: in for 4 seconds, out for 7 seconds. Repeat a few times together.</li>
                <li>Simply be with them. Keep words few: listen, empathize, and stay calm.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>Electrolyte Protocol (If Needed)</h4>
              <ul>
                <li>Mix 10 drops of Trace Minerals concentrate into 8 oz of water, with a pinch of salt and a splash of fresh juice.</li>
                <li>Have the member take small sips, 1&ndash;2 tbsp every 10&ndash;15 minutes.</li>
                <li>Sip the whole glass slowly over 30&ndash;60 minutes.</li>
              </ul>
            </div>

            <div className="duty">
              <h4>Managing the Environment</h4>
              <ul>
                <li>If mowers or blowers start, close all windows and play binaural beats (no words) on the sound system.</li>
                <li>Turn on the AC or fans as needed to keep members comfortable.</li>
              </ul>
            </div>
          </section>

          <section className="block">
            <div className="emergency">
              <div className="section-eyebrow">When to Call 911</div>
              <h2>Know the Signs</h2>
              <p className="body">We do not anticipate emergencies. With proper intake and screening, Iboga is extremely safe. Still, every guide should know the signs that warrant immediate emergency care. Call 911 immediately if any of the following occur:</p>
              <ul>
                <li>Loss of consciousness, unresponsiveness, or inability to be woken.</li>
                <li>Difficulty breathing, very slow or irregular breathing, or a bluish tint to lips or skin.</li>
                <li>Chest pain, or a heartbeat that is very fast, very slow, or clearly irregular.</li>
                <li>Seizure or uncontrolled convulsions.</li>
                <li>Repeated vomiting with signs of severe dehydration, or vomiting they cannot stop.</li>
                <li>Severe confusion, inability to recognize surroundings, or behavior that endangers themselves or others.</li>
                <li>Any situation where a guide feels a member&rsquo;s life or safety may be at risk. When in doubt, call.</li>
              </ul>
            </div>
          </section>

          <div className="closing">
            <p>Throughout every task, return to the three values: presence, service, and unconditional love.</p>
            <p className="mahalo">Mahalo nui for your service</p>
          </div>
        </div>
      </div>
    </div>
  )
}
