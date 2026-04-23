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

export const metadata = { title: 'Reference Itinerary — Vital Kauaʻi' }

export default function ReferenceItineraryPage() {
  return (
    <div style={{margin:'-1.75rem -2rem'}}>
      <style>{STYLES}</style>
      <div className="ref-itinerary">
        <div className="wrapper">
          <DownloadItineraryButton />
          <header>
            <div className="eyebrow">Founders Dashboard · Ceremony Arc</div>
            <h1>The Seven-Day <em>Ceremony Arc</em></h1>
            <p className="lede">Each ceremony is a small, held gathering — six members, seven days, one sacred arc. Every phase guided. Every step supported.</p>
            <div className="meta-row">
              <span>Hanalei · Kauaʻi</span>
              <span>Up to 6 Members</span>
              <span>Working Draft</span>
            </div>
          </header>

          <div className="day">
            <div className="day-marker"><div className="day-number">01</div><div className="day-label">Arrival</div></div>
            <div className="day-content">
              <h3>Day One</h3>
              <div className="day-title">Weaving the <em>Container</em></div>
              <div className="time-row"><div className="time">2:00 PM</div><div className="activity"><strong>Arrivals. Pūpūs served.</strong> Members settle in, meet the team, and begin to feel the land.</div></div>
              <div className="time-row"><div className="time">3:30 PM</div><div className="activity"><strong>Welcome ceremony &amp; opening circle with Rachel &amp; Josh.</strong> Name game and introductions. Container agreements, consent, confidentiality, how to ask for support. Overview of the week ahead. Brief medical and medication confirmation.<span className="note">Phones are turned off and put away. No phones or devices in group spaces.</span></div></div>
              <div className="time-row"><div className="time">~ 4:30 PM</div><div className="activity"><strong>Paired somatic practice.</strong> A first threshold of intimacy and coherence in the group. Practice to be determined.</div></div>
              <div className="time-row"><div className="time">5:30 PM</div><div className="activity"><strong>Welcome meal.</strong> Grounding, nourishing, prepared by the culinary team. The first gathering at the table.</div></div>
              <div className="time-row"><div className="time">~ 6:45 PM</div><div className="activity"><strong>Movement journey with Dr. Liz Esalen.</strong> Dropping out of the head and into the body. Arriving fully on the land.</div></div>
              <div className="time-row"><div className="time">By 8:30 PM</div><div className="activity">Complete. Tea. Early sleep so the body is rested for the day ahead.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">02</div><div className="day-label">Release</div></div>
            <div className="day-content">
              <h3>Day Two</h3>
              <div className="day-title">Laying Down <em>the Old</em></div>
              <div className="day-subtitle">What is being released. What is being called in.</div>
              <div className="time-row"><div className="time">6:30 AM</div><div className="activity"><strong>Yoga + breathwork.</strong> A gentle practice meeting the body before the day.</div></div>
              <div className="time-row"><div className="time">7:45 AM</div><div className="activity"><strong>Breakfast.</strong> Nourishing, prepared by the culinary team. Fueling for the trail.</div></div>
              <div className="time-row"><div className="time">8:45 AM</div><div className="activity">Prepare for the walk — hydration, nourishment for the trail, layers, sunscreen.</div></div>
              <div className="time-row"><div className="time">9:15 AM</div><div className="activity">Depart for the trailhead.</div></div>
              <div className="time-row"><div className="time">9:45 AM</div><div className="activity"><strong>The Nā Pali silent walk to Hanakāpīʻai.</strong> A ceremonial walk along the Nā Pali coast to release, invoke, and arrive ready for what you&apos;re calling in. Held in silence from trailhead to return. Elements ceremony at the water — laying to rest what is being released, calling forward what is being invoked.</div></div>
              <div className="time-row"><div className="time">~ 3:30 PM</div><div className="activity">Return to the home. Shower, rest, rehydrate.</div></div>
              <div className="time-row"><div className="time">4:30 PM</div><div className="activity"><strong>Therapeutic bodywork or energy work — open slot.</strong> Pre-scheduled by the Sacred Hospitality Coordinator. Matched to each member&apos;s needs. Receiving what the body is asking for after the walk — settling, integrating, preparing for ceremony.<div className="modality-slots"><span>Reiki</span><span>Craniosacral</span><span>Massage</span><span>Acupuncture</span><span>PNE</span><span>BioGeometry</span></div><span className="note">Practitioners trained in PNE (PsychoNeuroEnergetics) integrate jaw and base point holding into their sessions — supporting vagal regulation and the settling of held patterns in the nervous system before ceremony.</span></div></div>
              <div className="time-row"><div className="time">6:30 PM</div><div className="activity">Dinner. Nourishing, easy to digest — preparing the system.</div></div>
              <div className="time-row"><div className="time">8:00 PM</div><div className="activity">Quiet evening. Early sleep.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">03</div><div className="day-label">Ceremony</div></div>
            <div className="day-content">
              <h3>Day Three</h3>
              <div className="day-title">The <em>Medicine</em></div>
              <div className="day-subtitle">The door, walked through together.</div>
              <div className="time-row"><div className="time">Gentle Morning</div><div className="activity">Optional light yoga or breath. Morning nourishment if the body is asking: banana, eggs, coconut water, electrolytes, fresh ginger root tea. Light, easy to digest.</div></div>
              <div className="time-row"><div className="time">Midday</div><div className="activity"><strong>Nervous system treatments.</strong> One per member. Pre-scheduled, matched to what the body needs before ceremony.<div className="modality-slots"><span>Shen Po Acupuncture</span><span>Deep Tissue</span><span>BioGeometry</span><span>Craniosacral</span><span>Reiki</span><span>PNE</span><span>Somatic Bodywork</span></div><span className="note">Practitioners trained in PNE integrate jaw and base point holding into their sessions — deep vagal regulation to settle the system in the hours before ceremony begins.</span></div></div>
              <div className="time-row"><div className="time">After Midday</div><div className="activity">Minimal food. The system clears for the medicine. Food and drink pause fully in the six hours before ceremony begins.</div></div>
              <div className="time-row"><div className="time">Late Afternoon</div><div className="activity"><strong>Dress in all white.</strong> The traditional color of ceremony, clarity, and openness to what arrives.</div></div>
              <div className="time-row"><div className="time">Fire</div><div className="activity"><strong>Fire ceremony.</strong> Rachel and Josh invoke and hold the space, supported by Paul, Dr. Liz, and another female sitter. Members speak what they are releasing, their intentions, their prayers. Ritual water bathing — the beginning of the container opening.</div></div>
              <div className="time-row"><div className="time">~ 5:00 PM</div><div className="activity"><strong>Return to temple space.</strong> Titrated dosing begins. Bwiti music flowing into medicine music at low volume.</div></div>
              <div className="time-row"><div className="time">Overnight</div><div className="activity"><strong>Josh and Paul hold overnight as sitters</strong>, with another female sitter and a nurse or physician present as needed per each member&apos;s medical context. Rachel and Dr. Liz hold the container into the evening and depart by 8–9 PM, returning at 7 AM.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">04</div><div className="day-label">Long Day</div></div>
            <div className="day-content">
              <h3>Day Four</h3>
              <div className="day-title">The <em>Emergence</em></div>
              <div className="day-subtitle">Sleep is the greatest medicine.</div>
              <div className="time-row"><div className="time">Dawn</div><div className="activity">Most members are still journeying. The container continues — held, quiet, protected. Rachel and Dr. Liz return at 7 AM to hold the integration space. Josh, Paul, and the overnight team transition out as members come through.</div></div>
              <div className="time-row"><div className="time">Midday — Early Evening</div><div className="activity"><strong>Emergence.</strong> Members come out of the medicine gradually, each at their own pace.</div></div>
              <div className="time-row"><div className="time">All Day</div><div className="activity"><strong>Integration support on-site.</strong> Rachel and Dr. Liz hold the integration container throughout the day, available for 1:1 support as members begin to move. Soft presence. Members are not left alone.</div></div>
              <div className="time-row"><div className="time">Nourishment</div><div className="activity">Very light through the day: broth, fruit, coconut water, electrolytes. Ginger tea if settling is needed.</div></div>
              <div className="time-row"><div className="time">Late Afternoon</div><div className="activity">Optional light movement or nature time for those who have emerged. Bare feet on the earth. Soft presence.</div></div>
              <div className="time-row"><div className="time">Evening Meal</div><div className="activity"><strong>A nourishing meal for those who are ready.</strong> Congee, a simple soup, lean protein, lightly steamed vegetables. Warm, gentle, restorative.</div></div>
              <div className="time-row"><div className="time">Close</div><div className="activity">Silent hours protocol. The field is protected. Early sleep.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">05</div><div className="day-label">Integration</div></div>
            <div className="day-content">
              <h3>Day Five</h3>
              <div className="day-title">Making <em>Right</em></div>
              <div className="day-subtitle">What arose in the night finds its place in the day.</div>
              <div className="time-row"><div className="time">Morning</div><div className="activity"><strong>Light meditation and gentle breath.</strong></div></div>
              <div className="time-row"><div className="time">Breakfast</div><div className="activity">Nourishing, restorative.</div></div>
              <div className="time-row"><div className="time">Late Morning</div><div className="activity"><strong>Hoʻoponopono with Mahina.</strong> Our Director of Culture and Kuleana guides the group through a traditional practice of reconciliation and release — honoring the land, the ancestors, and the inner process before the work of the day.</div></div>
              <div className="time-row"><div className="time">Midday</div><div className="activity"><strong>Group sharing circle.</strong> Held by Rachel and Dr. Liz. What the medicine showed. What is asking to be named.</div></div>
              <div className="time-row"><div className="time">Lunch</div><div className="activity">Full meal.</div></div>
              <div className="time-row"><div className="time">Afternoon</div><div className="activity"><strong>1:1 integration session — session 1 of 6 suggested.</strong> Each member meets with their assigned integration guide. Nature time and journaling around the session.</div></div>
              <div className="time-row"><div className="time">Late Afternoon</div><div className="activity"><strong>Integration bodywork — open slot.</strong> Nervous system support while everything is still moving.<div className="modality-slots"><span>Reiki</span><span>Craniosacral</span><span>Massage</span><span>Acupuncture</span><span>PNE</span><span>BioGeometry</span></div></div></div>
              <div className="time-row"><div className="time">Evening</div><div className="activity"><strong>Optional second dose.</strong> Not a full flood. Titrated low, for members who want to go further. Held in sacred space with the care team present. Members who take it have Days 6 and 7 to integrate.</div></div>
              <div className="time-row"><div className="time">Dinner</div><div className="activity">Full meal for those not dosing.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">06</div><div className="day-label">Embodiment</div></div>
            <div className="day-content">
              <h3>Day Six</h3>
              <div className="day-title">Back Into <em>the World</em></div>
              <div className="day-subtitle">The body remembers. The land holds.</div>
              <div className="time-row"><div className="time">Morning</div><div className="activity"><strong>Yoga + breathwork.</strong> Moving fuller now. The system is landing.</div></div>
              <div className="time-row"><div className="time">Breakfast</div><div className="activity">Full, nourishing.</div></div>
              <div className="time-row"><div className="time">Midmorning to Afternoon</div><div className="activity"><strong>Land and water connection — choice of:</strong><span className="note">Visit to Hui Makaʻāinana o Makana at Limahuli or Hāʻena (coordinated in advance) · Tunnels Beach · Hanalei Bay — swim, rest, be.</span></div></div>
              <div className="time-row"><div className="time">Late Afternoon</div><div className="activity"><strong>Sound healing.</strong> Held by Dorothea or Samantha. The nervous system integrating at the deepest frequency.</div></div>
              <div className="time-row"><div className="time">Dinner</div><div className="activity">Gathered, full meal.</div></div>
              <div className="time-row"><div className="time">Evening</div><div className="activity"><strong>Movement or dance session.</strong> Held by Dr. Liz or Rachel. A celebration of what has moved through.</div></div>
            </div>
          </div>

          <div className="day">
            <div className="day-marker"><div className="day-number">07</div><div className="day-label">Closing</div></div>
            <div className="day-content">
              <h3>Day Seven</h3>
              <div className="day-title">Carrying It <em>Home</em></div>
              <div className="day-subtitle">The real work is the life that follows.</div>
              <div className="time-row"><div className="time">Morning</div><div className="activity">Meditation or gentle movement.</div></div>
              <div className="time-row"><div className="time">Breakfast</div><div className="activity">The final shared meal.</div></div>
              <div className="time-row"><div className="time">Late Morning</div><div className="activity"><strong>Closing circle with Rachel, Josh, and Dr. Liz.</strong> What you are carrying home. Integration commitments. How the remaining integration sessions and aftercare unfold from here.</div></div>
              <div className="time-row"><div className="time">Midday</div><div className="activity">Departures with aloha.</div></div>
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

          <div className="reference" style={{background:'#2d3529'}}>
            <div className="eyebrow">Team Reference · Hoʻoponopono</div>
            <h2>Making <em>Right</em></h2>
            <p><strong>Hoʻoponopono</strong> means <em>to make right</em> or <em>to correct</em>. It is a traditional Hawaiian practice of reconciliation and release — held within families, between individuals, or within oneself. A kahu or respected elder facilitates. <strong>Mahina</strong> guides what form is appropriate for our members in the context of each ceremony.</p>
            <div className="pillar">
              <div className="pillar-label">The Traditional Arc</div>
              <p><strong>Pule</strong> — opening prayer, invoking ancestors and the divine.<br/><strong>Kūkulu kumuhana</strong> — gathering of intention, pooling of spiritual strength.<br/><strong>Mihi</strong> — honest acknowledgment of what has been held, said, done, or carried. Each person speaks their truth.<br/><strong>Kala</strong> — the letting go. Releasing the hold that grievance, guilt, or entanglement has on the spirit. Cutting the cord.<br/><strong>Oki</strong> — severing. The completion of release.<br/><strong>Pani</strong> — closing, often with a shared offering.</p>
            </div>
            <div className="pillar">
              <div className="pillar-label">Why Day Five</div>
              <p>Members have moved through ceremony. Emotions and memories have been stirred. Hoʻoponopono offers a structured, sacred way to name what arose and release it — before the group sharing circle that follows. It honors the land, the ancestors, and the inner process all at once.</p>
            </div>
          </div>

          <div className="sensations-block">
            <div className="eyebrow">Team &amp; Member Reference · Somatic Tracking</div>
            <h2>How to Track Sensations <em>in the Body</em></h2>
            <div className="sub">Simple protocols from Somatic Experiencing and PsychoNeuroEnergetics.</div>
            <p className="intro">Tracking sensation is the heart of somatic work. When a member — or guide — names what is alive in the body (warmth, tightness, tingling, expansion), the nervous system begins to metabolize what has been held. These are the core practices we teach, return to, and carry into ceremony. Simple, repeatable, always available.</p>

            <div className="practice-grid">
              <div className="practice-card">
                <span className="tag">Somatic Experiencing</span>
                <h4>Orient</h4>
                <p>Let your gaze move slowly through the space — as if you are a gentle animal arriving somewhere new. Rest your eyes on something stable, something soft. When you find it, breathe there.</p>
              </div>
              <div className="practice-card">
                <span className="tag">Somatic Experiencing</span>
                <h4>Ground</h4>
                <p>Feel the weight of your body meeting whatever is beneath you. Press your feet into the ground. Sense the steady support that is always there. Gravity is holding you. The earth is holding you.</p>
              </div>
              <div className="practice-card">
                <span className="tag">Somatic Experiencing</span>
                <h4>Name What You Notice</h4>
                <p>Out loud or silently, label sensation with curiosity: <em>tingling, warmth, tightness, openness.</em> Naming activates the prefrontal cortex and creates a stabilizing distance from the sensation itself.</p>
              </div>
              <div className="practice-card">
                <span className="tag">Somatic Experiencing</span>
                <h4>Titrate</h4>
                <p>Contact a difficult sensation in small doses. A little, then return to a resource — a warm palm, the breath, the earth. Small steps are deep steps.</p>
              </div>
              <div className="practice-card">
                <span className="tag">Somatic Experiencing</span>
                <h4>Pendulate</h4>
                <p>Swing awareness between what feels difficult and what feels resourced. The nervous system heals through this rhythm — activation and rest, contraction and ease.</p>
              </div>
              <div className="practice-card">
                <span className="tag">SE · PNE</span>
                <h4>Self-Hold</h4>
                <p>Place your hands on your own body — over your heart, across your belly, or in a gentle self-embrace. Warm, steady touch activates the same co-regulation pathways as loving human contact.</p>
              </div>
              <div className="practice-card">
                <span className="tag">PsychoNeuroEnergetics</span>
                <h4>Jaw &amp; Base Point Hold</h4>
                <p>One hand gently holds the jaw; the other rests at the base point (occiput, where the skull meets the neck). Maintain light, steady contact. Breath softens. This is the PNE vagal-regulation protocol we return to before and after ceremony.</p>
              </div>
              <div className="practice-card">
                <span className="tag">Breath</span>
                <h4>Longer Exhale</h4>
                <p>Any time the system quickens, lengthen the exhale. Let it carry an audible sigh — an &ldquo;ahhh.&rdquo; A longer exhale relative to the inhale signals safety directly to the brainstem.</p>
              </div>
            </div>

            <p className="full-guide">For the full guide — polyvagal theory, the three nervous-system states, the Coherent Heart Breath, and the complete practice kit — see <a href="/portal/nervous-system">the Nervous System Safety Guide</a>.</p>
          </div>

          <div className="team-block">
            <h2>Ceremony Team · <em>Roles</em></h2>
            <div className="team-role">
              <div className="role-name">Rachel Nelson &amp; Josh Perdue<em>Co-Founders · Medicine Keepers</em></div>
              <div className="role-desc">Leading throughout. Opening circle, fire ceremony, ceremony container, closing circle. The through-line of the week.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Dr. Liz Esalen<em>Director of Integration</em></div>
              <div className="role-desc">On-island for the ceremony week. Movement journey on Day 1. Primary integration presence across Days 4–7. Group sharing and 1:1 integration sessions.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Judith Johnson<em>Director &amp; Overseer of Somatic Integration</em></div>
              <div className="role-desc">Guiding the somatic integration framework across the week. On-site for the post-ceremony long day and beyond. Judith&apos;s team provides on-island PNE (PsychoNeuroEnergetics) training in jaw and base point holding for Rachel, Dr. Liz, and any practitioner in the Healing Circle who wishes to be trained — integrating vagal regulation into Vital Kauaʻi&apos;s therapeutic care.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Mahina<em>Director of Culture &amp; Kuleana</em></div>
              <div className="role-desc">Morning of Day 5. Hoʻoponopono and cultural stewardship. Holding the Hawaiian thread of the container.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Jon Allen, PA-C<em>Medical Advisor</em></div>
              <div className="role-desc">Medical review before the week. Available or on-call during ceremony night per each member&apos;s medical context.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Healing Circle Practitioners<em>Rotating · Scheduled Pre-Week</em></div>
              <div className="role-desc">Bodywork, acupuncture, sound, yoga, breathwork, Reiki, craniosacral, BioGeometry, PNE. The Sacred Hospitality Coordinator schedules practitioners ahead of each ceremony — one practitioner may hold multiple sessions across the week based on availability and member needs.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Sacred Hospitality Coordinator<em>Scheduling · Care</em></div>
              <div className="role-desc">Matching practitioners to members and sessions. Holding the logistics so the ceremony team can hold the container.</div>
            </div>
            <div className="team-role">
              <div className="role-name">Culinary Team<em>Nourishment</em></div>
              <div className="role-desc">Meals prepared across the arc. Ceremony-day meals follow a dedicated light protocol. Day 4 evening and beyond return to full nourishment.</div>
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
