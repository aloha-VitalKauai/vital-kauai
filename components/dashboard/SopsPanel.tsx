'use client'

const C = {
  card:'#1A1613', border:'#4A3D2E', text:'#EDE8DF', muted:'#C4B199', dim:'#8A7A64', faint:'#221A12',
  terra:'#C96A52', terraBg:'rgba(201,106,82,.16)',
  amber:'#D89428', amberBg:'rgba(216,148,40,.16)',
  low:'#4AA082',   lowBg:'rgba(74,160,130,.16)',
}

function pill(color: string, bg: string) {
  return {display:'inline-block' as const, fontSize:10, fontWeight:600, letterSpacing:'.06em',
    textTransform:'uppercase' as const, padding:'2px 8px', borderRadius:20, color, background:bg,
    border:`0.5px solid ${color}44`}
}

export type SopSection = { heading: string; items: string[] }
export type Sop = {
  id: string
  title: string
  owner: string
  updated: string
  status: 'active' | 'draft' | 'review'
  summary: string
  sections: SopSection[]
  href?: string
}

export const SOPS: Sop[] = [
  {
    id: 'reference-itinerary',
    title: 'The Seven-Day Ceremony Arc',
    owner: 'Rachel · Josh · Dr. Liz',
    updated: '2026-04-21',
    status: 'active',
    summary: 'Arrival · Release · Medicine · Emergence · Integration · Embodiment · Closing. Held in Hanalei for up to six members per cohort.',
    sections: [],
    href: '/dashboard/sops/reference-itinerary',
  },
  {
    id: 'emergency-protocols',
    title: 'Emergency Protocols',
    owner: '—',
    updated: '—',
    status: 'draft',
    summary: 'Awaiting upload. Paste medical emergency, cardiac event, and evacuation protocols here.',
    sections: [],
  },
  {
    id: 'practitioner-onboarding',
    title: 'Practitioner Onboarding',
    owner: '—',
    updated: '—',
    status: 'draft',
    summary: 'Awaiting upload. Paste credentialing, training, and mentorship protocols here.',
    sections: [],
  },
  {
    id: 'sacred-hospitality-coordinator',
    title: 'Sacred Hospitality Coordinator SOP',
    owner: '—',
    updated: '—',
    status: 'draft',
    summary: 'Awaiting upload. Paste hospitality coordinator protocols here.',
    sections: [],
  },
]

function SopStatusPill({status}:{status:Sop['status']}) {
  const m = status==='active' ? {color:C.low, bg:C.lowBg, label:'Active'}
         : status==='review'  ? {color:C.amber,bg:C.amberBg,label:'In Review'}
         :                      {color:C.muted,bg:C.faint,  label:'Draft'}
  return <span style={pill(m.color, m.bg)}>{m.label}</span>
}

export default function SopsPanel() {
  const lastUpdated = SOPS.reduce((a,s)=>s.updated>a?s.updated:a,'')
  return (
    <div className='sops-panel'>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 18px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:6}}>Vital Kauaʻi · Internal Playbook</div>
          <div style={{fontSize:18,fontWeight:500,color:C.text,fontFamily:'var(--font-cormorant-garamond,serif)',marginBottom:2}}>Standard Operating Procedures</div>
          <div style={{fontSize:11,color:C.muted}}>Source of truth for medical, emergency, practitioner, and hospitality protocols. {lastUpdated && <>Last updated {lastUpdated}.</>}</div>
        </div>
        <button onClick={()=>window.print()} style={{fontSize:10,color:C.terra,background:C.terraBg,border:`0.5px solid ${C.terra}55`,borderRadius:6,padding:'6px 14px',cursor:'pointer',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase'}}>Print / Share</button>
      </div>

      {SOPS.length>0 && (
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'12px 16px',marginBottom:12}}>
          <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:8}}>Contents</div>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {SOPS.map((s,i)=>(
              <a key={s.id} href={`#sop-${s.id}`} style={{fontSize:12,color:C.muted,textDecoration:'none',display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:10,color:C.dim,minWidth:16}}>{String(i+1).padStart(2,'0')}</span>
                <span>{s.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {SOPS.length===0 && (
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'40px 24px',textAlign:'center'}}>
          <div style={{fontSize:14,color:C.muted,marginBottom:8,fontFamily:'var(--font-cormorant-garamond,serif)',fontStyle:'italic'}}>No playbooks uploaded yet.</div>
          <div style={{fontSize:11,color:C.dim,maxWidth:420,margin:'0 auto',lineHeight:1.5}}>Upload or paste a document and a founder will wire it in here. Each SOP shows owner, last-updated date, status, and printable sectioned content.</div>
        </div>
      )}

      {SOPS.map(s=>(
        <div key={s.id} id={`sop-${s.id}`} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'18px 20px',marginBottom:12,scrollMarginTop:80}}>
          <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:8}}>
            <div style={{fontSize:16,fontWeight:500,color:C.text,fontFamily:'var(--font-cormorant-garamond,serif)'}}>{s.title}</div>
            <SopStatusPill status={s.status}/>
          </div>
          <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:10,color:C.dim,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:10}}>
            <span>Owner · <span style={{color:C.muted,textTransform:'none',letterSpacing:0}}>{s.owner}</span></span>
            <span>Updated · <span style={{color:C.muted,textTransform:'none',letterSpacing:0}}>{s.updated}</span></span>
          </div>
          {s.summary && <div style={{fontSize:12,color:C.muted,fontStyle:'italic',borderLeft:`2px solid ${C.terra}`,paddingLeft:10,marginBottom:14}}>{s.summary}</div>}
          {s.href && <a href={s.href} style={{display:'inline-block',fontSize:11,color:C.terra,textDecoration:'none',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:12,padding:'6px 12px',border:`0.5px solid ${C.terra}55`,background:C.terraBg,borderRadius:6}}>Open full document →</a>}
          {s.sections.map((sec,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:C.text,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>{sec.heading}</div>
              <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:4}}>
                {sec.items.map((it,j)=>(
                  <li key={j} style={{fontSize:12,color:C.muted,lineHeight:1.55,paddingLeft:14,position:'relative'}}>
                    <span style={{position:'absolute',left:0,top:7,width:4,height:4,borderRadius:'50%',background:C.terra}}/>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
