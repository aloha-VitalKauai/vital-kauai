import DownloadItineraryButton from '@/components/dashboard/DownloadItineraryButton'

const FONTS = "'Cormorant Garamond', var(--font-cormorant-garamond), serif"
const BODY = "'Jost', var(--font-jost), sans-serif"

const STYLES = `
.hosp { background:#f5f0e8; color:#2a2a26; font-family:${BODY}; font-weight:300; line-height:1.7; letter-spacing:.01em; -webkit-font-smoothing:antialiased; min-height:100vh; position:relative; }
.hosp * { box-sizing:border-box; margin:0; padding:0; }
.hosp .wrapper { max-width:880px; margin:0 auto; padding:80px 48px 120px; position:relative; }
.hosp .download-btn { position:absolute; top:24px; right:24px; display:inline-flex; align-items:center; gap:6px; font-family:${BODY}; font-size:10px; font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:#b08d5a; background:rgba(176,141,90,.08); border:1px solid rgba(176,141,90,.35); border-radius:4px; padding:8px 14px; cursor:pointer; transition:background .15s ease, border-color .15s ease; z-index:10; }
.hosp .download-btn:hover { background:rgba(176,141,90,.16); border-color:rgba(176,141,90,.6); }
.hosp .download-btn svg { stroke:#b08d5a; }

.hosp header { text-align:center; padding-bottom:56px; border-bottom:1px solid rgba(42,42,38,.14); margin-bottom:64px; }
.hosp .eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.32em; text-transform:uppercase; color:#b08d5a; font-weight:500; margin-bottom:22px; }
.hosp h1 { font-family:${FONTS}; font-weight:400; font-size:56px; line-height:1.05; letter-spacing:-.01em; color:#28301f; margin-bottom:18px; }
.hosp h1 em { font-style:italic; color:#b08d5a; font-weight:400; }
.hosp .lede { font-family:${FONTS}; font-style:italic; font-size:19px; color:rgba(42,42,38,.62); max-width:580px; margin:0 auto; line-height:1.55; }
.hosp .meta-row { display:flex; gap:32px; justify-content:center; margin-top:34px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#8a9a85; font-weight:500; flex-wrap:wrap; }

.hosp section.block { margin-bottom:60px; }
.hosp .section-eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:#8a9a85; font-weight:500; margin-bottom:12px; }
.hosp h2 { font-family:${FONTS}; font-weight:400; font-size:34px; color:#28301f; margin-bottom:18px; letter-spacing:-.005em; }
.hosp h2 em { font-style:italic; color:#b08d5a; }
.hosp p.body { font-size:15px; color:#3d3d38; line-height:1.85; margin-bottom:16px; max-width:700px; }
.hosp p.body strong { color:#28301f; font-weight:500; }

.hosp .intro-card { background:#ebe4d6; border-radius:2px; padding:40px 44px; }
.hosp .intro-card p:last-child { margin-bottom:0; }

.hosp .quality-tags { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0 16px; }
.hosp .quality-tags span { font-size:12px; letter-spacing:.04em; color:#28301f; padding:6px 14px; border:1px solid rgba(176,141,90,.35); border-radius:20px; background:rgba(176,141,90,.06); }
.hosp .quality-close { font-family:${FONTS}; font-style:italic; font-size:18px; color:#3d3d38; line-height:1.6; }

.hosp .duty { margin-bottom:24px; }
.hosp .duty h4 { font-family:${BODY}; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#085041; font-weight:600; margin-bottom:10px; }
.hosp .duty p.duty-intro { font-size:14px; color:#3d3d38; line-height:1.75; margin-bottom:10px; max-width:680px; }
.hosp .duty p.duty-note { font-size:13.5px; color:rgba(42,42,38,.6); font-style:italic; line-height:1.7; margin-top:10px; max-width:680px; }
.hosp ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:7px; }
.hosp ul li { font-size:14px; color:#3d3d38; line-height:1.6; padding-left:18px; position:relative; max-width:700px; }
.hosp ul li::before { content:''; position:absolute; left:0; top:9px; width:5px; height:5px; border-radius:50%; background:#b08d5a; }

.hosp .temple { background:rgba(122,158,126,.08); border:1px solid rgba(122,158,126,.2); border-left:3px solid #7a9e7e; border-radius:2px; padding:36px 40px; }
.hosp .temple .section-eyebrow { color:#5f7d63; }
.hosp .temple h2 em { color:#5f7d63; }

.hosp .closing { text-align:center; margin-top:72px; padding-top:38px; border-top:1px solid rgba(42,42,38,.14); }
.hosp .closing p { font-family:${FONTS}; font-style:italic; font-size:20px; color:#28301f; line-height:1.6; max-width:560px; margin:0 auto; }

@media print {
  .hosp { background:white; }
  .hosp .wrapper { padding:32px; }
  .hosp .download-btn { display:none !important; }
  .hosp .intro-card, .hosp .duty, .hosp .temple { page-break-inside:avoid; }
  nav.pn, nav.vk-dock, header[role="banner"] { display:none !important; }
}
@media (max-width:720px) {
  .hosp .wrapper { padding:48px 22px; }
  .hosp h1 { font-size:40px; }
  .hosp .download-btn { top:12px; right:12px; padding:6px 10px; font-size:9px; letter-spacing:.14em; }
  .hosp .intro-card, .hosp .temple { padding:28px 24px; }
  .hosp .meta-row { flex-direction:column; gap:10px; }
}
`

const QUALITIES = [
  'Plans ahead', 'Moves quietly', 'Communicates clearly', 'Pays attention to detail',
  'Creates beauty', 'Protects the schedule', 'Supports the facilitators',
  'Anticipates needs', 'Finds joy in service',
]

function Duty({ title, intro, items, note }: { title: string; intro?: string; items: string[]; note?: string }) {
  return (
    <div className="duty">
      <h4>{title}</h4>
      {intro && <p className="duty-intro">{intro}</p>}
      <ul>{items.map((it) => <li key={it}>{it}</li>)}</ul>
      {note && <p className="duty-note">{note}</p>}
    </div>
  )
}

export const metadata = { title: 'Sacred Hospitality Guide — Vital Kauaʻi' }

export default function SacredHospitalityPage() {
  return (
    <div style={{ margin: '-1.75rem -2rem' }}>
      <style>{STYLES}</style>
      <div className="hosp">
        <div className="wrapper">
          <DownloadItineraryButton />

          <header>
            <div className="eyebrow">Founders Dashboard · Standard Operating Procedures</div>
            <h1>Sacred Hospitality <em>Guide</em></h1>
            <p className="lede">Orchestrating the daily experience behind the scenes, so members can devote themselves fully to their journey.</p>
            <div className="meta-row">
              <span>Sacred Hospitality Guide</span>
              <span>Hanalei · Kauaʻi</span>
            </div>
          </header>

          <section className="block">
            <div className="intro-card">
              <div className="section-eyebrow">Purpose</div>
              <p className="body">The Sacred Hospitality Guide is responsible for ensuring every member feels deeply welcomed, supported, and cared for throughout their stay. This role orchestrates the daily experience behind the scenes so members can fully devote themselves to their journey.</p>
              <p className="body">The guide oversees hospitality, logistics, communication, property presentation, scheduling, and operational flow.</p>
            </div>
          </section>

          <section className="block">
            <div className="section-eyebrow">The Standard We Hold</div>
            <h2>An Exceptional <em>Sacred Hospitality Guide</em></h2>
            <div className="quality-tags">{QUALITIES.map((q) => <span key={q}>{q}</span>)}</div>
            <p className="quality-close">Creates an environment where members feel deeply welcomed.</p>
          </section>

          <section className="block">
            <div className="section-eyebrow">Before Arrival</div>
            <h2>Preparing the <em>Container</em></h2>
            <Duty
              title="Transport & Coordination"
              items={['Confirm transport, timing, and driver coordination (usually Josh or Ben).']}
              note="The full team gathers in coherence before every immersion."
            />
            <Duty
              title="Team Check-In"
              intro="Every team member briefly shares:"
              items={[
                'How they’re arriving mentally, emotionally, and/or physically.',
                'Anything the team should know.',
                'Any support they need — needs, desires, boundaries, fears, concerns.',
              ]}
            />
            <Duty
              title="Member Review"
              intro="Review every participant individually. Discuss:"
              items={[
                'Primary intention', 'Relevant life history', 'Current challenges',
                'Medical considerations', 'Medications', 'Dietary preferences',
                'Practitioner assignments', 'Room assignment', 'Transportation',
                'Any special accommodations',
              ]}
              note="Everyone on the team should understand each member before they arrive."
            />
          </section>

          <section className="block">
            <div className="section-eyebrow">Property Preparation</div>
            <h2>Readying the <em>Home</em></h2>
            <Duty
              title="Guest Rooms"
              intro="Before members arrive, confirm:"
              items={[
                'Fresh linens; bed made', 'Closet clear, hangers ready, drawers clear', 'Fresh towels',
                'Welcome gift (Vital Kauaʻi journal, pen, palo santo stick, eye mask, ear plugs)',
                'Welcome letter (personal hand-written note)', 'Bathroom cleaned', 'Trash emptied',
                'Comfortable lighting',
              ]}
            />
            <Duty
              title="Shared Spaces"
              intro="Prepare the living room, dining room, kitchen, bathrooms, outdoor seating, and entryway."
              items={['Living room', 'Dining room', 'Kitchen', 'Bathrooms', 'Outdoor seating', 'Entryway']}
              note="Everything should feel peaceful, uncluttered, and welcoming."
            />
            <Duty
              title="Kitchen"
              intro="Confirm:"
              items={[
                'Fresh-squeezed juices in pitchers in the fridge — green juice, watermelon, seasonal (coordinate with chef)',
                'Tea station stocked with mugs, teas, etc.', 'Hot water available', 'Filtered water',
                'Fresh coconut water in fridge from Daniel (808-634-2980)',
                'Seasonal fruit prepared, cut, and always available in the fridge (papaya, mango, lychee, rambutan, watermelon)',
                'Confirm daily meal plan and dietary needs with chef',
                'Help put away dishes, run dishwasher, clean mugs',
              ]}
            />
          </section>

          <section className="block">
            <div className="section-eyebrow">Welcoming Members</div>
            <h2>The First <em>Aloha</em></h2>
            <Duty
              title="On Arrival"
              items={[
                'Welcome each member personally.',
                'Assist with luggage.',
                'Escort them to their room.',
                'Give a brief orientation of the property (a fuller orientation follows before dinner).',
                'Allow time for them to settle before dinner.',
                'Maintain presence, kindness, and aloha.',
              ]}
            />
            <Duty
              title="Yoga, Meditation, Sound & Breathwork Setup"
              intro="Confirm setup for the day (inside, beach park, or outside):"
              items={[
                'Yoga mat, bolster, block',
                'Speaker charged and set up',
                'Incense',
                'Assist the sound healer with setup',
                'Assist practitioners with setup',
              ]}
            />
          </section>

          <section className="block">
            <div className="temple">
              <div className="section-eyebrow">Temple Ceremony Nights · Typically Nights 2 &amp; 5</div>
              <h2>Preparing the <em>Temple</em></h2>
              <p className="body">Coordinate with facilitators to ensure the temple is fully prepared. Set up and confirm:</p>
              <Duty
                title="Space & Energetic Prep"
                items={[
                  'Collect sacred objects from each member before the ceremony begins.',
                  'Ceremony space cleaned and cleared energetically — sage or copal, and prayers.',
                  'Darken the ceremony space — hang dark sheets over windows for privacy.',
                  'Fresh flowers.',
                  'Mirror.',
                ]}
              />
              <Duty
                title="Each Member’s Place"
                items={[
                  'Mat laid out for each person, clean sheet over each one.',
                  'Bolster, pillow, blanket.',
                  'Bucket and rattle.',
                  'Each member’s sacred objects arranged next to their mat as a personal altar.',
                  'Member’s eye mask from their room.',
                  'Personal water bottle.',
                  'Cell phones turned in before ceremony.',
                ]}
              />
              <Duty
                title="The Altar"
                items={[
                  'Altar and surrounding altar.',
                  'Crystals, singing bowl, cord-cutting knife, Buddha.',
                  'Angel cards, Earth Magic, Mana cards — choose which to display.',
                  'Avatars and ascended-being photos.',
                  'Rattle with white handle, shaker, drums, and other sacred objects.',
                  'Copal cast-iron incense burner with sand inside, coals loaded, extra coals nearby, copal, lighter.',
                  'Pueo wings and tail; Pueo talons.',
                  'Topical magnesium.',
                  'Rapé (hapé) and tepi.',
                ]}
              />
              <Duty
                title="Sound & Facilitator Support"
                items={[
                  'Facilitators’ water bottles: ½ coconut water, ½ filtered water. Clean water and electrolytes within reach of the ceremony space.',
                  'Bluetooth speaker set up, tested, and connected to Josh’s phone with the Spotify ceremony playlist queued.',
                  'Backup speaker charged and ready.',
                ]}
              />
              <Duty
                title="Fire Ceremony Set-Up & Supplies"
                items={[
                  'Topical magnesium; jar of 2 magnesium glycinate pills per person.',
                  'Wooden spoon.',
                  'Jar of ground Iboga (approx. 12g per person).',
                  'Mopeto (traditional ceremonial torch).',
                  'Firewood; firepit set up; lighters.',
                ]}
              />
            </div>
          </section>

          <section className="block">
            <div className="section-eyebrow">Daily Rhythm</div>
            <h2>Holding the <em>Days</em></h2>
            <Duty
              title="Daily Responsibilities"
              items={[
                'Update the whiteboard.', 'Confirm practitioner schedule.', 'Confirm meals.',
                'Coordinate transportation.', 'Check shared spaces.', 'Confirm all activities.',
                'Check tea station.', 'Restock juices (coordinate with chef).', 'Refresh fruit (coordinate with chef).',
              ]}
            />
            <Duty
              title="Daily Whiteboard"
              intro="Include:"
              items={[
                'Date and daily schedule.',
                'Breakfast, lunch, dinner.',
                'Individual therapies and group activities.',
                'Hiking day: remind of mosquito repellent, rain jacket, hiking shoes/poles, hat, sunscreen.',
                'First aid kit and prepared to-go meals in Rachel/Josh’s hiking pack.',
                'Hapé and tepi; flowers for the spiritual shower.',
                'Ceremony times and meeting locations.',
              ]}
              note="Members should always know what comes next."
            />
            <Duty
              title="Daily Property Refresh"
              intro="Complete while members are away from the home:"
              items={[
                'Make beds; refresh towels.', 'Tidy bathrooms; empty trash.',
                'Sweep or vacuum as needed.', 'Refresh flowers.',
                'Organize kitchen; reset living spaces.',
              ]}
              note="Members should return to a refreshed home every day."
            />
            <Duty
              title="Meal Coordination"
              intro="Coordinate closely with the chef. Every day, maintain:"
              items={['Tea station', 'Fresh juices', 'Seasonal fruit', 'Filtered water', 'Fresh coconuts']}
            />
            <Duty
              title="Practitioner Coordination"
              intro="Confirm each day:"
              items={['Appointment times', 'Treatment locations', 'Supplies', 'Schedule adjustments']}
              note="Communicate updates promptly to Josh and Rachel."
            />
            <Duty
              title="Communication"
              intro="Maintain communication with:"
              items={['Josh', 'Rachel', 'Practitioners', 'Aftercare Team', 'Overnight Team (Doctor)', 'Chef / Kitchen', 'Guest Support']}
              note="Keep updates concise and timely."
            />
          </section>

          <section className="block">
            <div className="section-eyebrow">Departure Day</div>
            <h2>Carrying Them <em>Onward</em></h2>
            <Duty
              title="Coordinate"
              items={[
                'Breakfast.', 'Transportation.', 'Room walkthrough.',
                'Collect forgotten items.', 'Property reset.',
                'Coordinate and confirm cleaning with Colleen (808-651-0053).',
              ]}
            />
          </section>

          <div className="closing">
            <p>Sacred hospitality is love made visible in the details.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
