import SopsPanel from '@/components/dashboard/SopsPanel'

export const metadata = { title: 'SOPs — Vital Kauaʻi' }

const C = { bg:'#F8F5EE', border:'#E2DCC8', text:'#1A1A18', muted:'#5C5C58', dim:'#8A8A82' }

export default function SopsPage() {
  return (
    <div style={{margin:'-1.75rem -2rem',minHeight:'calc(100vh - 101px)',background:C.bg,fontFamily:'var(--font-jost, sans-serif)',color:C.text}}>
      <style>{`@media print{body,html{background:#fff!important;color:#111!important}.sops-panel{color:#111!important}.sops-panel *{color:#111!important;background:#fff!important;border-color:#ddd!important}.sops-panel button{display:none!important}header,nav{display:none!important}}`}</style>
      <div style={{borderBottom:`0.5px solid ${C.border}`,height:46,display:'flex',alignItems:'center',padding:'0 24px'}}>
        <span style={{fontSize:10,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase'}}>Internal Playbook</span>
      </div>
      <div style={{padding:'20px 24px',maxWidth:1000,margin:'0 auto'}}>
        <SopsPanel />
      </div>
    </div>
  )
}
