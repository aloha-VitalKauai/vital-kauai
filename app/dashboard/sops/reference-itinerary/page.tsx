import DownloadItineraryButton from '@/components/dashboard/DownloadItineraryButton'

const FONTS = "'Cormorant Garamond', var(--font-cormorant-garamond), serif"
const BODY = "'Jost', var(--font-jost), sans-serif"

const STYLES = `
.ref-itinerary { background:#f5f0e8; color:#2a2a26; font-family:${BODY}; font-weight:300; line-height:1.7; letter-spacing:.01em; -webkit-font-smoothing:antialiased; min-height:100vh; position:relative; }
.ref-itinerary * { box-sizing:border-box; margin:0; padding:0; }
.ref-itinerary .wrapper { max-width:920px; margin:0 auto; padding:80px 48px 120px; position:relative; }
.ref-itinerary .download-btn { position:absolute; top:24px; right:24px; display:inline-flex; align-items:center; gap:6px; font-family:${BODY}; font-size:10px; font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:#b08d5a; background:rgba(176,141,90,.08); border:1px solid rgba(176,141,90,.35); border-radius:4px; padding:8px 14px; cursor:pointer; transition:background .15s ease, border-color .15s ease; z-index:10; }
.ref-itinerary .download-btn:hover { background:rgba(176,141,90,.16); border-color:rgba(176,141,90,.6); }
.ref-itinerary .download-btn svg { stroke:#b08d5a; }
@media print { .ref-itinerary .download-btn { display:none !important; } }
@media (max-width:720px) { .ref-itinerary .download-btn { top:12px; right:12px; padding:6px 10px; font-size:9px; letter-spacing:.14em; } }

.ref-itinerary header { text-align:center; padding-bottom:64px; border-bottom:1px solid rgba(42,42,38,.14); margin-bottom:72px; }
.ref-itinerary .eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.32em; text-transform:uppercase; color:#b08d5a; font-weight:500; margin-bottom:24px; }
.ref-itinerary h1 { font-family:${FONTS}; font-weight:400; font-size:58px; line-height:1.05; letter-spacing:-.01em; color:#28301f; margin-bottom:20px; }
.ref-itinerary h1 em { font-style:italic; color:#b08d5a; font-weight:400; }
.ref-itinerary .lede { font-family:${FONTS}; font-style:italic; font-size:19px; color:rgba(42,42,38,.62); max-width:560px; margin:0 auto; line-height:1.55; }
.ref-itinerary .meta-row { display:flex; gap:32px; justify-content:center; margin-top:36px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#8a9a85; font-weight:500; }

.ref-itinerary h2 { font-family:${FONTS}; font-weight:400; font-size:32px; color:#28301f; margin-bottom:8px; letter-spacing:-.005em; }
.ref-itinerary h2 em { font-style:italic; color:#b08d5a; }
.ref-itinerary h3 { font-family:${BODY}; font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#8a9a85; font-weight:500; margin-bottom:12px; }

.ref-itinerary .day { margin-bottom:56px; display:grid; grid-template-columns:120px 1fr; gap:40px; padding-bottom:48px; border-bottom:1px solid rgba(42,42,38,.14); }
.ref-itinerary .day:last-of-type { border-bottom:none; }
.ref-itinerary .day-marker { padding-top:4px; }
.ref-itinerary .day-number { font-family:${FONTS}; font-size:48px; font-weight:300; color:#b08d5a; line-height:1; font-style:italic; }
.ref-itinerary .day-label { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#8a9a85; font-weight:500; margin-top:6px; }
.ref-itinerary .day-title { font-family:${FONTS}; font-size:28px; font-weight:400; color:#28301f; margin-bottom:4px; line-height:1.2; }
.ref-itinerary .day-title em { font-style:italic; color:#b08d5a; font-weight:400; }
.ref-itinerary .day-subtitle { font-family:${FONTS}; font-style:italic; font-size:15px; color:rgba(42,42,38,.62); margin-bottom:24px; }

.ref-itinerary .time-row { display:grid; grid-template-columns:130px 1fr; gap:24px; padding:14px 0; border-top:1px dashed rgba(42,42,38,.14); }
.ref-itinerary .time-row:first-of-type { border-top:none; padding-top:6px; }
.ref-itinerary .time { font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:#8a9a85; font-weight:500; padding-top:2px; }
.ref-itinerary .activity { font-size:14px; color:#2a2a26; line-height:1.65; }
.ref-itinerary .activity strong { font-weight:500; color:#28301f; }
.ref-itinerary .activity .note { display:block; margin-top:4px; font-size:13px; color:rgba(42,42,38,.62); font-style:italic; }

.ref-itinerary .reference { background:#28301f; color:#f5f0e8; padding:56px; margin:72px 0; border-radius:2px; }
.ref-itinerary .reference .eyebrow { color:#c9a876; margin-bottom:20px; }
.ref-itinerary .reference h2 { color:#f5f0e8; font-size:36px; margin-bottom:28px; }
.ref-itinerary .reference h2 em { color:#c9a876; }
.ref-itinerary .reference p { color:rgba(245,240,232,.78); font-size:14px; line-height:1.8; margin-bottom:16px; max-width:700px; }
.ref-itinerary .reference p strong { color:#f5f0e8; font-weight:500; }
.ref-itinerary .reference .pillar { margin-top:32px; padding-top:24px; border-top:1px solid rgba(201,168,118,.28); }
.ref-itinerary .reference .pillar-label { font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:#c9a876; font-weight:500; margin-bottom:10px; }
.ref-itinerary .reference .pillar p { font-family:${FONTS}; font-style:italic; font-size:17px; color:#f5f0e8; line-height:1.55; }

.ref-itinerary .team-block { background:#ebe4d6; padding:48px; margin:56px 0; border-radius:2px; }
.ref-itinerary .team-block h2 { font-size:30px; margin-bottom:28px; }
.ref-itinerary .team-role { display:grid; grid-template-columns:240px 1fr; gap:24px; padding:16px 0; border-top:1px solid rgba(42,42,38,.14); }
.ref-itinerary .team-role:first-of-type { border-top:none; }
.ref-itinerary .role-name { font-family:${FONTS}; font-size:19px; font-weight:500; color:#28301f; }
.ref-itinerary .role-name em { display:block; font-size:11px; font-weight:400; color:#b08d5a; letter-spacing:.18em; text-transform:uppercase; margin-top:4px; font-style:normal; }
.ref-itinerary .role-desc { font-size:13px; color:rgba(42,42,38,.62); line-height:1.7; padding-top:4px; }

.ref-itinerary .sensations-block { background:rgba(122,158,126,.09); border:1px solid rgba(122,158,126,.18); padding:56px; margin:56px 0; border-radius:2px; }
.ref-itinerary .sensations-block .eyebrow { color:#7a9e7e; margin-bottom:20px; }
.ref-itinerary .sensations-block h2 { margin-bottom:10px; }
.ref-itinerary .sensations-block h2 em { color:#7a9e7e; }
.ref-itinerary .sensations-block .sub { font-family:${FONTS}; font-style:italic; font-size:16px; color:rgba(42,42,38,.58); margin-bottom:28px; }
.ref-itinerary .sensations-block .intro { font-size:14px; color:#3d3d38; line-height:1.85; max-width:680px; margin-bottom:32px; }
.ref-itinerary .practice-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:28px; }
.ref-itinerary .practice-card { background:rgba(255,255,255,.6); border:1px solid rgba(122,158,126,.14); border-radius:8px; padding:22px 26px; }
.ref-itinerary .practice-card h4 { font-family:${FONTS}; font-size:19px; font-weight:400; color:#28301f; margin-bottom:6px; }
.ref-itinerary .practice-card .tag { font-size:9px; letter-spacing:.22em; text-transform:uppercase; color:#7a9e7e; font-weight:500; margin-bottom:10px; display:block; }
.ref-itinerary .practice-card p { font-size:13px; color:#3d3d38; line-height:1.75; }
.ref-itinerary .sensations-block .full-guide { font-size:12px; color:rgba(42,42,38,.58); font-style:italic; line-height:1.8; border-top:1px solid rgba(122,158,126,.18); padding-top:20px; margin-top:8px; }
.ref-itinerary .sensations-block .full-guide a { color:#b08d5a; text-decoration:none; font-weight:500; border-bottom:1px solid rgba(176,141,90,.4); }

.ref-itinerary .modality-slots { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.ref-itinerary .modality-slots span { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#8a9a85; padding:4px 10px; border:1px solid rgba(42,42,38,.14); border-radius:20px; font-weight:500; }

.ref-itinerary footer { margin-top:96px; padding-top:32px; border-top:1px solid rgba(42,42,38,.14); text-align:center; font-size:11px; letter-spacing:.14em; color:#8a9a85; text-transform:uppercase; }
.ref-itinerary footer em { font-family:${FONTS}; font-style:italic; text-transform:none; letter-spacing:0; color:#b08d5a; font-size:15px; display:block; margin-bottom:14px; }

@media print { .ref-itinerary { background:white; } .ref-itinerary .wrapper { padding:32px; } .ref-itinerary .day, .ref-itinerary .reference, .ref-itinerary .team-block { page-break-inside:avoid; } header, nav { display:none !important; } }
@media (max-width:720px) { .ref-itinerary .wrapper { padding:48px 24px; } .ref-itinerary h1 { font-size:40px; } .ref-itinerary .day { grid-template-columns:1fr; gap:12px; } .ref-itinerary .time-row { grid-template-columns:1fr; gap:4px; } .ref-itinerary .team-role { grid-template-columns:1fr; gap:4px; } .ref-itinerary .reference { padding:36px 28px; } .ref-itinerary .team-block { padding:32px 24px; } .ref-itinerary .meta-row { flex-direction:column; gap:10px; } }
`

export const metadata = { title: 'Standard Itinerary — Vital Kauaʻi' }

export default function ReferenceItineraryPage() {
  return (
    <div style={{margin:'-1.75rem -2rem'}}>
      <style>{STYLES}</style>
      <div className="ref-itinerary">
        <div className="wrapper">
          <DownloadItineraryButton />
          <header>
            <div className="eyebrow">Founders Dashboard · Standard Itinerary</div>
            <h1>The Eight-Day <em>Standard Itinerary</em></h1>
            <p className="lede">Eight days in Hanalei: arrival, two ceremonies held with rest and integration between, embodiment, and a closing departure.</p>
            <div className="meta-row">
              <span>Hanalei · Kauaʻi</span>
              <span>Up to 6 Members</span>
              <span>Two Ceremonies</span>
            </div>
          </header>

          <div className="day">
            <div className="day-marker"><div className="day-number">01</div><div className="day-label">Arrival</div></div>
            <div className="day-content">
              <h3>Day One</h3>
              <div className="day-title">Arriving on the <em>Land</em></div>
              <div className="day-subtitle">Settling in, meeting the team, feeling the ground.</div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Welcome orientation &amp; paperwork.</strong> Members settle in, meet the team, and begin to feel the land.</div></div>
              <div className="time-row"><div className="time">5:00 PM</div><div className="activity"><strong>Jeffersonian-style dinner.</strong> The first gathering at the table, one shared conversation.</div></div>
              <div className="time-row"><div className="time">6:30 PM</div><div className="activity"><strong>Welcome baptism &amp; fire ceremony with Rachel &amp; Josh.</strong> Opening the container.</div></div>
              <div className="time-row"><div className="time">7:00 PM</div><div className="activity"><strong>Talk story.</strong> A gentle evening circle to arrive together.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">02</div><div className="day-label">Ceremony</div></div>
            <div className="day-content">
              <h3>Day Two</h3>
              <div className="day-title">The First <em>Door</em></div>
              <div className="day-subtitle">Release, the Nā Pali hike, and the first ceremony.</div>
              <div className="time-row"><div className="time">7:15 AM</div><div className="activity"><strong>Breakfast to go; silent Nā Pali Coast hike &amp; spiritual shower.</strong> Held with Rachel &amp; Josh, in silence from trailhead to return.</div></div>
              <div className="time-row"><div className="time">12:00 PM</div><div className="activity"><strong>Light lunch.</strong> Review of the ceremony guidelines and what to expect, with Rachel &amp; Josh.</div></div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Massage &amp; bodywork.</strong> Settling the system before ceremony.</div></div>
              <div className="time-row"><div className="time">5:00 PM</div><div className="activity">Rest, journal, review intentions and questions for the medicine.</div></div>
              <div className="time-row"><div className="time">7:30 PM</div><div className="activity"><strong>Ceremony.</strong></div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">03</div><div className="day-label">Rest</div></div>
            <div className="day-content">
              <h3>Day Three</h3>
              <div className="day-title">Rest, Silence, <em>Stillness</em></div>
              <div className="day-subtitle">Sleep is the greatest medicine. Members are accompanied throughout.</div>
              <div className="time-row"><div className="time">All Day</div><div className="activity"><strong>On-site care present.</strong> A guide is with members through the day and overnight.</div></div>
              <div className="time-row"><div className="time">10:00 AM</div><div className="activity"><strong>Meditation.</strong> Recordings and seed sounds.</div></div>
              <div className="time-row"><div className="time">12:15 PM</div><div className="activity">Vegetarian lunch.</div></div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Acupuncture.</strong></div></div>
              <div className="time-row"><div className="time">5:30 PM</div><div className="activity">Jeffersonian dinner.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">04</div><div className="day-label">Integration</div></div>
            <div className="day-content">
              <h3>Day Four</h3>
              <div className="day-title">Letting It <em>Land</em></div>
              <div className="day-subtitle">Meeting what moved, in the light of day.</div>
              <div className="time-row"><div className="time">7:15 AM</div><div className="activity"><strong>Beach breath, meditation, yoga + swim.</strong> Held with Rachel.</div></div>
              <div className="time-row"><div className="time">9:00 AM</div><div className="activity">Breakfast.</div></div>
              <div className="time-row"><div className="time">11:00 AM</div><div className="activity"><strong>Personal meetings.</strong></div></div>
              <div className="time-row"><div className="time">1:00 PM</div><div className="activity">Lunch.</div></div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Breath + sound bath with Dorothea.</strong></div></div>
              <div className="time-row"><div className="time">5:30 PM</div><div className="activity"><strong>Sharing circle</strong> + Jeffersonian dinner.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">05</div><div className="day-label">Ceremony</div></div>
            <div className="day-content">
              <h3>Day Five</h3>
              <div className="day-title">The Second <em>Door</em></div>
              <div className="day-subtitle">Going deeper, held in the same care.</div>
              <div className="time-row"><div className="time">7:15 AM</div><div className="activity"><strong>Breath &amp; yoga, or a Tunnels swim.</strong> Held with Rachel.</div></div>
              <div className="time-row"><div className="time">9:00 AM</div><div className="activity">Light breakfast.</div></div>
              <div className="time-row"><div className="time">12:00 PM</div><div className="activity">Lunch.</div></div>
              <div className="time-row"><div className="time">2:00 PM</div><div className="activity"><strong>Creative or energy practice.</strong> Art, Reiki, craniosacral, or hypnotherapy, with Rachel.</div></div>
              <div className="time-row"><div className="time">4:30 PM</div><div className="activity">Rest, journal, intentions.</div></div>
              <div className="time-row"><div className="time">7:30 PM</div><div className="activity"><strong>Ceremony.</strong></div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">06</div><div className="day-label">Rest</div></div>
            <div className="day-content">
              <h3>Day Six</h3>
              <div className="day-title">Rest, Silence, <em>Stillness</em></div>
              <div className="day-subtitle">The body integrates. Members are accompanied throughout.</div>
              <div className="time-row"><div className="time">All Day</div><div className="activity"><strong>On-site care present.</strong> A guide is with members through the day.</div></div>
              <div className="time-row"><div className="time">12:15 PM</div><div className="activity">Vegetarian lunch.</div></div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Massage &amp; bodywork.</strong></div></div>
              <div className="time-row"><div className="time">5:15 PM</div><div className="activity">Jeffersonian dinner.</div></div>
              <div className="time-row"><div className="time">7:00 PM</div><div className="activity"><strong>Yoga Nidra + sound.</strong> Held with Rachel.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">07</div><div className="day-label">Embodiment</div></div>
            <div className="day-content">
              <h3>Day Seven</h3>
              <div className="day-title">Back Into <em>the World</em></div>
              <div className="day-subtitle">The body remembers. The land holds.</div>
              <div className="time-row"><div className="time">7:15 AM</div><div className="activity"><strong>Gentle yoga, breathwork &amp; meditation.</strong></div></div>
              <div className="time-row"><div className="time">9:00 AM</div><div className="activity">Breakfast.</div></div>
              <div className="time-row"><div className="time">11:00 AM</div><div className="activity"><strong>Land offering &amp; Hapé ceremony.</strong></div></div>
              <div className="time-row"><div className="time">12:30 PM</div><div className="activity">Lunch.</div></div>
              <div className="time-row"><div className="time">3:00 PM</div><div className="activity"><strong>Breath + sound bath with Dorothea.</strong></div></div>
              <div className="time-row"><div className="time">5:30 PM</div><div className="activity"><strong>Closing sharing circle.</strong> Final Jeffersonian dinner celebration, beach bonfire, and swim.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">08</div><div className="day-label">Departure</div></div>
            <div className="day-content">
              <h3>Day Eight</h3>
              <div className="day-title">Carrying It <em>Home</em></div>
              <div className="day-subtitle">The work is the life that follows.</div>
              <div className="time-row"><div className="time">7:00 AM</div><div className="activity"><strong>Gentle swim or snorkel at Makua.</strong> Integrating new beliefs.</div></div>
              <div className="time-row"><div className="time">8:30 AM</div><div className="activity">Breakfast.</div></div>
              <div className="time-row"><div className="time">9:30 AM</div><div className="activity">Departures with aloha.</div></div>
            </div>
          </div>

          <div className="reference">
            <div className="eyebrow">Team Reference · Internal</div>
            <h2>Nā Pali <em>Cultural Protocol</em></h2>
            <p>The Nā Pali coast is one of the most culturally significant landscapes in all of Hawaiʻi — the cliffs where Hawaiian ancestors lived, fished, birthed, buried their dead, and held ceremony for generations before contact. <strong>Hanakāpīʻai</strong> means <em>sprinkling of food</em> — a valley of offering, abundance, and reverence. The entire coast is <strong>wahi pana</strong>: a storied, sacred place.</p>
            <p>We walk this coast in silence with our members because the land itself does the work. Mama Kauaʻi holds what the body cannot yet name. The elements witness what is released. The path from the trailhead to Hanakāpīʻai is a threshold — we walk members to a place where release is possible, and we walk them back changed.</p>
            <p>This is a silent hike, ceremonial in every step. We carry ourselves the way we would walk into a cathedral, because that is what it is.</p>
            <div className="pillar">
              <div className="pillar-label">What We Carry</div>
              <p>Gratitude for the ʻāina that is holding us. Respect for the iwi kūpuna — the ancestors whose bones are in this land. Awareness that we are guests. Silence from trailhead to return. Care for the members we are guiding, and for every soul walking this coast.</p>
            </div>
            <div className="pillar">
              <div className="pillar-label">What We Say to Members</div>
              <p>That this is ceremonial. That the coast has held release and transformation for thousands of years. That we are entering as guests, with reverence. That what they lay down here will be received by the land, by the water, and by the ancestors who came before. That we walk in silence — so the land can speak.</p>
            </div>
            <div className="pillar">
              <div className="pillar-label">Practical Reverence</div>
              <p>We take nothing from the land. We leave nothing behind. We honor stones, plants, and sacred sites. We pause at the water&apos;s edge and let the ocean witness what is being released. We stay out of the water at Hanakāpīʻai and honor the currents that run there. And then we walk back.</p>
            </div>
          </div>

          <footer>
            <em>&ldquo;The medicine shows you the door. We walk through it with you.&rdquo;</em>
            Vital Kauaʻi · PO Box 932, Hanalei, HI 96714 · Working Draft
          </footer>
        </div>
      </div>
    </div>
  )
}
