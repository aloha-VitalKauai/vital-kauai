import DownloadItineraryButton from '@/components/dashboard/DownloadItineraryButton'

const FONTS = "'Cormorant Garamond', var(--font-cormorant-garamond), serif"
const BODY = "'Jost', var(--font-jost), sans-serif"

const STYLES = `
.emgcy { background:#f5f0e8; color:#2a2a26; font-family:${BODY}; font-weight:300; line-height:1.7; letter-spacing:.01em; -webkit-font-smoothing:antialiased; min-height:100vh; position:relative; }
.emgcy * { box-sizing:border-box; margin:0; padding:0; }
.emgcy .wrapper { max-width:820px; margin:0 auto; padding:80px 48px 120px; position:relative; }
.emgcy .download-btn { position:absolute; top:24px; right:24px; display:inline-flex; align-items:center; gap:6px; font-family:${BODY}; font-size:10px; font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:#b08d5a; background:rgba(176,141,90,.08); border:1px solid rgba(176,141,90,.35); border-radius:4px; padding:8px 14px; cursor:pointer; transition:background .15s ease, border-color .15s ease; z-index:10; }
.emgcy .download-btn:hover { background:rgba(176,141,90,.16); border-color:rgba(176,141,90,.6); }
.emgcy .download-btn svg { stroke:#b08d5a; }

.emgcy header { text-align:center; padding-bottom:56px; border-bottom:1px solid rgba(42,42,38,.14); margin-bottom:56px; }
.emgcy .eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.32em; text-transform:uppercase; color:#a33a2a; font-weight:500; margin-bottom:22px; }
.emgcy h1 { font-family:${FONTS}; font-weight:400; font-size:56px; line-height:1.05; letter-spacing:-.01em; color:#28301f; margin-bottom:18px; }
.emgcy h1 em { font-style:italic; color:#a33a2a; font-weight:400; }
.emgcy .lede { font-family:${FONTS}; font-style:italic; font-size:19px; color:rgba(42,42,38,.62); max-width:560px; margin:0 auto; line-height:1.55; }
.emgcy .meta-row { display:flex; gap:32px; justify-content:center; margin-top:34px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#8a9a85; font-weight:500; flex-wrap:wrap; }

.emgcy .alert { background:rgba(162,58,42,.06); border:1px solid rgba(162,58,42,.3); border-left:3px solid #a33a2a; border-radius:2px; padding:40px 44px; }
.emgcy .alert .section-eyebrow { font-family:${BODY}; font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:#a33a2a; font-weight:600; margin-bottom:12px; }
.emgcy .alert h2 { font-family:${FONTS}; font-weight:400; font-size:32px; color:#8f2f21; margin-bottom:18px; }
.emgcy .alert p.body { font-size:15px; color:#4a352f; line-height:1.85; margin-bottom:18px; max-width:680px; }
.emgcy .alert p.body strong { color:#8f2f21; font-weight:600; }
.emgcy .alert ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
.emgcy .alert ul li { font-size:14.5px; color:#4a352f; line-height:1.7; padding-left:18px; position:relative; max-width:680px; }
.emgcy .alert ul li::before { content:''; position:absolute; left:0; top:9px; width:5px; height:5px; border-radius:50%; background:#a33a2a; }

.emgcy .closing { text-align:center; margin-top:64px; padding-top:36px; border-top:1px solid rgba(42,42,38,.14); }
.emgcy .closing p { font-family:${FONTS}; font-style:italic; font-size:19px; color:#28301f; line-height:1.6; max-width:560px; margin:0 auto; }

@media print {
  .emgcy { background:white; }
  .emgcy .wrapper { padding:32px; }
  .emgcy .download-btn { display:none !important; }
  .emgcy .alert { page-break-inside:avoid; }
  nav.pn, nav.vk-dock, header[role="banner"] { display:none !important; }
}
@media (max-width:720px) {
  .emgcy .wrapper { padding:48px 22px; }
  .emgcy h1 { font-size:40px; }
  .emgcy .download-btn { top:12px; right:12px; padding:6px 10px; font-size:9px; letter-spacing:.14em; }
  .emgcy .alert { padding:28px 24px; }
  .emgcy .meta-row { flex-direction:column; gap:10px; }
}
`

export const metadata = { title: 'Emergency Protocols — Vital Kauaʻi' }

export default function EmergencyProtocolsPage() {
  return (
    <div style={{ margin: '-1.75rem -2rem' }}>
      <style>{STYLES}</style>
      <div className="emgcy">
        <div className="wrapper">
          <DownloadItineraryButton />

          <header>
            <div className="eyebrow">Founders Dashboard · Emergency Protocols</div>
            <h1>When to Call <em>911</em></h1>
            <p className="lede">The signs that warrant immediate emergency care. Every guide should know them.</p>
            <div className="meta-row">
              <span>For All Guides</span>
              <span>Hanalei · Kauaʻi</span>
            </div>
          </header>

          <div className="alert">
            <div className="section-eyebrow">Know the Signs</div>
            <h2>Call 911 Immediately</h2>
            <p className="body">We do not anticipate emergencies. With proper intake and screening, Iboga is extremely safe. Still, every guide should know the signs that warrant immediate emergency care. <strong>Call 911 immediately if any of the following occur:</strong></p>
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

          <div className="closing">
            <p>When in doubt, call. It is always right to protect a member&rsquo;s safety.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
