'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import JourneyScheduler from '@/components/dashboard/JourneyScheduler'
import CohortManager from '@/components/dashboard/CohortManager'
import SchedulingRequestQueue from '@/components/dashboard/SchedulingRequestQueue'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/* ── DESIGN TOKENS ──────────────────────────────────────────────── */
const C = {
  bg:'#0D0B09', surf:'#141210', card:'#1A1613', border:'#2A2018', hi:'#3E2E1E',
  text:'#EDE8DF', muted:'#7A6A58', dim:'#3E3226', faint:'#221A12',
  terra:'#A84E38', terraBg:'rgba(168,78,56,.13)',
  amber:'#C08018', amberBg:'rgba(192,128,24,.13)',
  high:'#B83838', highBg:'rgba(184,56,56,.13)',
  crit:'#D42020', critBg:'rgba(212,32,32,.13)',
  med:'#B87020', medBg:'rgba(184,112,32,.13)',
  low:'#38886A', lowBg:'rgba(56,136,106,.13)',
  blue:'#4A8EC0', blueBg:'rgba(74,142,192,.13)',
  purple:'#7060B8',
}

const STAGE_META: Record<string,{label:string;color:string;order:number}> = {
  onboarding:        {label:'Onboarding',       color:C.muted, order:1},
  pre_ceremony:      {label:'Pre-Ceremony',      color:C.blue,  order:2},
  post_ceremony:     {label:'Post-Ceremony',     color:C.purple,order:3},
  ceremony_complete: {label:'Ceremony Complete', color:C.low,   order:4},
  active_member:     {label:'Active Member',     color:C.amber, order:5},
}
const RISK_META: Record<string,{color:string;bg:string;label:string}> = {
  critical:{color:C.crit,bg:C.critBg,label:'Critical'},
  high:    {color:C.high,bg:C.highBg,label:'High'},
  medium:  {color:C.med, bg:C.medBg, label:'Medium'},
  low:     {color:C.low, bg:C.lowBg, label:'Low'},
}
const SEV_META: Record<string,{color:string;bg:string}> = {
  critical:{color:C.crit, bg:C.critBg},
  high:    {color:C.high, bg:C.highBg},
  warning: {color:C.amber,bg:C.amberBg},
  info:    {color:C.blue, bg:C.blueBg},
}
const STATUS_META: Record<string,{color:string;bg:string;label:string}> = {
  open:        {color:C.muted,bg:C.faint,  label:'Open'},
  in_progress: {color:C.blue, bg:C.blueBg, label:'In Progress'},
  done:        {color:C.low,  bg:C.lowBg,  label:'Done'},
  canceled:    {color:C.dim,  bg:C.faint,  label:'Canceled'},
}
const PRIORITY_COLORS: Record<string,string> = {critical:C.crit,high:C.high,medium:C.amber,low:C.muted}
const REASON_LABELS: Record<string,string> = {
  not_medically_cleared:'Medical clearance pending',
  not_cardiac_cleared:'Cardiac clearance pending',
  labs_incomplete:'Labs incomplete',
  contraindications_flagged:'Contraindications flagged',
}
const TASK_TYPE_OPTIONS = [
  {value:'medical_clearance',    label:'Medical clearance'},
  {value:'cardiac_clearance',    label:'Cardiac clearance'},
  {value:'labs_missing',         label:'Labs missing'},
  {value:'followup_overdue',     label:'Follow-up overdue'},
  {value:'contraindication_review',label:'Contraindication review'},
  {value:'ceremony_readiness',   label:'Ceremony readiness'},
  {value:'agreement_missing',    label:'Agreement missing'},
  {value:'deposit_missing',      label:'Deposit missing'},
  {value:'guide_outreach',       label:'Guide outreach'},
]
const TASK_TYPE_LABELS = Object.fromEntries(TASK_TYPE_OPTIONS.map(o=>[o.value,o.label]))
const ALERT_TO_TASK: Record<string,string> = {
  cardiac_not_cleared:'cardiac_clearance', medical_not_cleared:'medical_clearance',
  labs_incomplete:'labs_missing', followup_overdue:'followup_overdue',
  contraindication:'contraindication_review',
}
const GUIDES = ['Josh','Rachel','Jon Allen PA-C']
// Internal tasks don't make sense to notify a member about
const INTERNAL_TASK_TYPES = ['guide_outreach','ceremony_readiness']

/* ── CEREMONY GATE ──────────────────────────────────────────────── */
function getCeremonyBlockers(m: any) {
  const b: {key:string;label:string;severity:string}[] = []
  if (!m.medical_cleared)     b.push({key:'medical', label:'Medical clearance required',  severity:'high'})
  if (!m.cardiac_cleared)     b.push({key:'cardiac', label:'Cardiac clearance required',  severity:'critical'})
  if (!m.labs_all_cleared)    b.push({key:'labs',    label:'All labs must be approved',   severity:'high'})
  if (!m.all_required_signed) b.push({key:'docs',    label:'Required documents unsigned', severity:'medium'})
  return b
}

/* ── MESSAGE BUILDERS ───────────────────────────────────────────── */
function buildSMS(firstName: string, taskTitle: string, dueDate: string | null) {
  const d = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {month:'long',day:'numeric'})
    : 'soon'
  return `Hi ${firstName} — a gentle reminder from Vital Kauaʻi.\n\n${taskTitle} is due ${d}.\n\nQuestions? aloha@vitalkauai.com\n\nMahalo 🌺`
}
function buildFollowupSMS(firstName: string, timepoint: string) {
  return `Hi ${firstName} — your ${timepoint.replace(/_/g,' ')} check-in with Vital Kauaʻi is ready.\n\nIt takes about 5 minutes. Reply and we'll send the link.\n\nMahalo 🌺`
}
function buildEmailSubject(taskTitle: string) { return `A reminder from Vital Kauaʻi — ${taskTitle}` }
function buildEmailBody(firstName: string, taskTitle: string, dueDate: string | null) {
  const d = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {month:'long',day:'numeric'})
    : 'soon'
  return `Hi ${firstName},\n\nThis is a gentle reminder that ${taskTitle} is due ${d}.\n\nIf you have any questions, reply to this message or reach us at aloha@vitalkauai.com.\n\nMahalo and aloha,\nRachel & Josh\nVital Kauaʻi`
}
function buildFollowupEmailSubject(timepoint: string) {
  return `Your ${timepoint.replace(/_/g,' ')} check-in with Vital Kauaʻi`
}
function buildFollowupEmailBody(firstName: string, timepoint: string, link?: string) {
  return `Hi ${firstName},\n\nYour ${timepoint.replace(/_/g,' ')} check-in is ready. It takes about 5 minutes and supports your integration journey.\n\n${link ? `Complete it here: ${link}` : "Reply and we'll send the link."}\n\nWe're with you.\n\nMahalo and aloha,\nRachel & Josh\nVital Kauaʻi`
}
function maskPhone(p: string | null) {
  if (!p) return null
  const d = p.replace(/\D/g,'')
  return d.length >= 10 ? `+1 (${d.slice(-10,-7)}) ${d.slice(-7,-4)}-••••` : '[phone]'
}

/* ── HELPERS ────────────────────────────────────────────────────── */
function pill(color:string, bg:string) {
  return {display:'inline-block' as const,fontSize:10,fontWeight:600,letterSpacing:'.06em',
    textTransform:'uppercase' as const,color,background:bg,padding:'2px 8px',borderRadius:20,
    border:`0.5px solid ${color}44`}
}
function RiskPill({level}:{level:string})  { const m=RISK_META[level]??RISK_META.low;  return <span style={pill(m.color,m.bg)}>{m.label}</span> }
function StagePill({stage}:{stage:string}) { const m=STAGE_META[stage]??{label:stage,color:C.muted}; return <span style={pill(m.color,m.color+'18')}>{m.label}</span> }
function StatusPill({status}:{status:string}) { const m=STATUS_META[status]??STATUS_META.open; return <span style={pill(m.color,m.bg)}>{m.label}</span> }

function Avatar({name,size=36}:{name:string;size?:number}) {
  const c=[C.terra,C.amber,C.blue,C.purple,C.low][name.charCodeAt(0)%5]
  return <div style={{width:size,height:size,borderRadius:'50%',background:c+'2A',border:`1px solid ${c}50`,color:c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.32,fontWeight:600,flexShrink:0}}>
    {name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
  </div>
}
function Btn({label,color,onClick,small}:{label:string;color:string;onClick:()=>void;small?:boolean}) {
  return <button onClick={e=>{e.stopPropagation();onClick()}} style={{fontSize:small?9:10,color,background:'transparent',border:`0.5px solid ${color}55`,borderRadius:6,padding:small?'2px 8px':'4px 12px',cursor:'pointer',letterSpacing:'.05em',fontWeight:500,whiteSpace:'nowrap'}}>{label}</button>
}

const INP: React.CSSProperties = {fontSize:11,background:C.faint,border:`0.5px solid ${C.hi}`,borderRadius:6,padding:'5px 9px',color:C.text,width:'100%',outline:'none'}
const LBL: React.CSSProperties = {fontSize:9,color:C.dim,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:4,display:'block'}

/* ── NOTIFY BUTTON (SMS or Email) ───────────────────────────────── */
function NotifyButton({phone,email,memberName,smsMessage,emailSubject,emailBody,taskId,memberId,onSent,small}:{
  phone:string|null;email:string|null;memberName:string;smsMessage:string;emailSubject:string;emailBody:string;
  taskId?:string;memberId?:string;onSent?:(r:any)=>void;small?:boolean
}) {
  const [state,   setState]  = useState<'idle'|'open'|'sending'|'sent'|'failed'>('idle')
  const [channel, setChannel]= useState<'sms'|'email'>('sms')
  const [sentLog, setSentLog]= useState<{channel:string;time:Date}[]>([])
  const hasPhone=!!phone, hasEmail=!!email, hasBoth=hasPhone&&hasEmail
  const effectiveCh = !hasPhone?'email':!hasEmail?'sms':channel
  const firstName = memberName.split(' ')[0]

  if(!hasPhone&&!hasEmail) return <span style={{fontSize:9,color:C.dim,fontStyle:'italic'}}>No contact on file</span>

  async function send() {
    setState('sending')
    try {
      const supabase = createClient()
      await supabase.functions.invoke('send-notification', {
        body: {
          channel: effectiveCh,
          to: effectiveCh==='sms' ? phone : email,
          message: effectiveCh==='sms' ? smsMessage : emailBody,
          subject: effectiveCh==='email' ? emailSubject : undefined,
          member_id: memberId, task_id: taskId, to_name: memberName,
        }
      })
      const now = new Date()
      setSentLog(prev=>[{channel:effectiveCh,time:now},...prev])
      setState('sent')
      onSent?.({channel:effectiveCh, to:effectiveCh==='sms'?phone:email, time:now})
    } catch(err:any) { setState('failed') }
  }

  if(state==='idle') return (
    <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
      <button onClick={e=>{e.stopPropagation();setState('open')}} style={{fontSize:small?9:10,color:C.blue,background:C.blueBg,border:`0.5px solid ${C.blue}44`,borderRadius:6,padding:small?'2px 8px':'3px 10px',cursor:'pointer',fontWeight:500}}>
        Notify {hasPhone?'📱':''}{hasBoth?' / ':''}{hasEmail?'✉':''}
      </button>
      {sentLog.length>0&&<span style={{fontSize:9,color:C.muted}}>{sentLog[0].channel==='sms'?'📱':'✉'} Sent · {sentLog[0].time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}{sentLog.length>1?` (+${sentLog.length-1})`:''}</span>}
    </div>
  )
  if(state==='sending') return <span style={{fontSize:10,color:C.blue}}>Sending…</span>
  if(state==='sent') return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:10,color:C.low}}>{effectiveCh==='sms'?'📱 Text':'✉ Email'} sent to {firstName} · {sentLog[0]?.time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>
      <Btn label='Send another' color={C.muted} onClick={()=>setState('open')} small/>
    </div>
  )
  if(state==='failed') return <div style={{display:'flex',gap:8}}><span style={{fontSize:10,color:C.high}}>✗ Failed</span><Btn label='Retry' color={C.amber} onClick={()=>setState('open')} small/></div>

  // OPEN PANEL
  return (
    <div onClick={e=>e.stopPropagation()} style={{background:C.surf,border:`0.5px solid ${C.blue}44`,borderRadius:10,padding:'14px 16px',marginTop:8,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:12,fontWeight:600,color:C.text}}>Notify {firstName}</span>
        <button onClick={()=>setState('idle')} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
      </div>
      {hasBoth&&(
        <div style={{display:'flex',gap:0,background:C.faint,borderRadius:8,border:`0.5px solid ${C.border}`,overflow:'hidden'}}>
          {[{key:'sms' as const,icon:'📱',label:'Text',sub:maskPhone(phone)??''},
            {key:'email' as const,icon:'✉', label:'Email',sub:email??''}].map(ch=>(
            <button key={ch.key} onClick={()=>setChannel(ch.key)} style={{flex:1,padding:'8px 10px',border:'none',cursor:'pointer',background:channel===ch.key?C.card:'transparent',borderRight:ch.key==='sms'?`0.5px solid ${C.border}`:'none',transition:'background .15s'}}>
              <div style={{fontSize:12,color:channel===ch.key?C.text:C.muted}}>{ch.icon} {ch.label}</div>
              <div style={{fontSize:9,color:C.dim,marginTop:2}}>{ch.sub}</div>
            </button>
          ))}
        </div>
      )}
      {!hasBoth&&<div style={{fontSize:11,color:C.muted}}>{hasPhone?`📱 ${maskPhone(phone)}`:`✉ ${email}`}</div>}
      {effectiveCh==='email'&&<div style={{fontSize:11,color:C.dim}}><span style={{color:C.muted,fontWeight:500}}>Subject: </span>{emailSubject}</div>}
      <div style={{fontSize:11,color:C.muted,lineHeight:1.7,whiteSpace:'pre-wrap',background:C.faint,borderRadius:8,padding:'10px 12px',border:`0.5px solid ${C.border}`,maxHeight:140,overflowY:'auto'}}>
        {effectiveCh==='sms' ? smsMessage : emailBody}
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={send} style={{fontSize:11,color:C.text,background:C.blue,border:'none',borderRadius:7,padding:'6px 18px',cursor:'pointer',fontWeight:600}}>
          Send {effectiveCh==='sms'?'Text':'Email'} →
        </button>
        <Btn label='Cancel' color={C.muted} onClick={()=>setState('idle')} small/>
      </div>
    </div>
  )
}

/* ── FOUNDER NOTIFICATION TOAST ─────────────────────────────────── */
function FounderToast({notification,onDismiss}:{notification:string|null;onDismiss:()=>void}) {
  if(!notification) return null
  return (
    <div style={{position:'fixed',bottom:20,right:20,background:C.surf,border:`0.5px solid ${C.low}55`,borderLeft:`3px solid ${C.low}`,borderRadius:12,padding:'14px 18px',maxWidth:320,zIndex:100,boxShadow:'0 4px 24px rgba(0,0,0,.4)'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:C.low,marginBottom:4}}>📱 Rachel & Josh notified</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{notification}</div>
        </div>
        <button onClick={onDismiss} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>×</button>
      </div>
    </div>
  )
}

/* ── CEREMONY GATE ──────────────────────────────────────────────── */
function CeremonyGate({member}:{member:any}) {
  const blockers = getCeremonyBlockers(member)
  const isClear  = blockers.length === 0
  const hasUpcoming = member.days_to_ceremony != null && member.days_to_ceremony > 0
  if (!hasUpcoming && member.pipeline_stage !== 'pre_ceremony') return null
  return (
    <div style={{marginBottom:12,borderRadius:10,border:`0.5px solid ${isClear?C.low+'55':C.high+'55'}`,overflow:'hidden'}}>
      <div style={{background:isClear?C.lowBg:C.highBg,padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:11,fontWeight:600,color:isClear?C.low:C.high}}>{isClear?'✓ Ceremony ready':'⚠ Ceremony blocked'}</span>
        {hasUpcoming&&<span style={{fontSize:10,color:C.muted}}>{member.days_to_ceremony} days away</span>}
      </div>
      {!isClear&&(
        <div style={{padding:'10px 12px',background:C.faint}}>
          <div style={{fontSize:10,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8}}>Must be resolved before ceremony</div>
          {blockers.map(b=>(
            <div key={b.key} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
              <span style={{fontSize:13,color:b.severity==='critical'?C.crit:C.high}}>✗</span>
              <span style={{fontSize:12,color:C.text}}>{b.label}</span>
              <span style={pill(b.severity==='critical'?C.crit:C.high,b.severity==='critical'?C.critBg:C.highBg)}>{b.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── ASSIGN EDITOR ──────────────────────────────────────────────── */
function AssignEditor({current,onSave,onCancel}:{current:string|null;onSave:(v:string)=>void;onCancel:()=>void}) {
  const [val,setVal]=useState(current??'')
  return (
    <div style={{display:'flex',gap:6,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
      <select value={GUIDES.includes(val)?val:'custom'} onChange={e=>{if(e.target.value!=='custom')setVal(e.target.value)}} style={{...INP,width:110,appearance:'none' as any}}>
        <option value=''>Unassigned</option>
        {GUIDES.map(g=><option key={g} value={g}>{g}</option>)}
        <option value='custom'>Other…</option>
      </select>
      {!GUIDES.includes(val)&&<input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')onSave(val);if(e.key==='Escape')onCancel()}} placeholder='Name' style={{...INP,width:100}}/>}
      <Btn label='Save' color={C.low}   onClick={()=>onSave(val)} small/>
      <Btn label='✕'    color={C.muted} onClick={onCancel}       small/>
    </div>
  )
}

/* ── CREATE TASK PANEL ──────────────────────────────────────────── */
function CreateTaskPanel({members,preselectedMemberId,onSave,onClose}:{members:any[];preselectedMemberId:string|null;onSave:(d:any)=>void;onClose:()=>void}) {
  const [memberId, setMemberId] = useState(preselectedMemberId??'')
  const [taskType, setTaskType] = useState('guide_outreach')
  const [title,    setTitle]    = useState('')
  const [desc,     setDesc]     = useState('')
  const [priority, setPriority] = useState('medium')
  const [owner,    setOwner]    = useState('')
  const [customOwner,setCustomOwner]=useState('')
  const [dueDate,  setDueDate]  = useState('')
  function handleTypeChange(v:string){setTaskType(v);if(!title)setTitle(TASK_TYPE_LABELS[v]??'')}
  const finalOwner = owner==='custom' ? customOwner : owner

  async function handleSubmit() {
    if(!memberId||!title.trim()) return
    const supabase = createClient()
    const newTask = {member_id:memberId,task_type:taskType,title:title.trim(),
      description:desc.trim()||null,priority,status:'open',
      owner_name:finalOwner||null,due_date:dueDate||null,
      source_view:'manual',source_reason:'manual_creation'}
    const {data:created}=await supabase.from('ops_tasks').insert(newTask).select().single()
    onSave(created ?? {...newTask,id:'t_'+Date.now(),text_sent_at:null,text_sent_count:0,completed_at:null})
    onClose()
  }

  return (
    <div style={{background:C.surf,border:`0.5px solid ${C.terra}55`,borderLeft:`3px solid ${C.terra}`,borderRadius:12,padding:'18px 20px',marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13,fontWeight:600,color:C.terra}}>New Task</span>
          {preselectedMemberId&&<span style={{fontSize:11,color:C.muted}}>for {members.find((m:any)=>m.member_id===preselectedMemberId)?.full_name}</span>}
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        {!preselectedMemberId&&<div style={{gridColumn:'1/-1'}}><span style={LBL}>Member <span style={{color:C.crit}}>*</span></span><select value={memberId} onChange={e=>setMemberId(e.target.value)} style={{...INP,appearance:'none' as any}}><option value=''>Select member…</option>{members.map((m:any)=><option key={m.member_id} value={m.member_id}>{m.full_name}</option>)}</select></div>}
        <div><span style={LBL}>Task type</span><select value={taskType} onChange={e=>handleTypeChange(e.target.value)} style={{...INP,appearance:'none' as any}}>{TASK_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><span style={LBL}>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)} style={{...INP,appearance:'none' as any,borderColor:PRIORITY_COLORS[priority]+'55',color:PRIORITY_COLORS[priority]}}><option value='critical'>Critical</option><option value='high'>High</option><option value='medium'>Medium</option><option value='low'>Low</option></select></div>
        <div style={{gridColumn:'1/-1'}}><span style={LBL}>Title <span style={{color:C.crit}}>*</span></span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder='What needs to be done?' style={INP}/></div>
        <div><span style={LBL}>Assign to</span><select value={owner} onChange={e=>setOwner(e.target.value)} style={{...INP,appearance:'none' as any}}><option value=''>Unassigned</option>{GUIDES.map(g=><option key={g} value={g}>{g}</option>)}<option value='custom'>Other…</option></select></div>
        <div><span style={LBL}>Due date</span><input type='date' value={dueDate} onChange={e=>setDueDate(e.target.value)} style={INP}/></div>
        {owner==='custom'&&<div style={{gridColumn:'1/-1'}}><span style={LBL}>Assignee name</span><input value={customOwner} onChange={e=>setCustomOwner(e.target.value)} placeholder='Enter name' style={INP}/></div>}
        <div style={{gridColumn:'1/-1'}}><span style={LBL}>Notes (optional)</span><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder='Add context or instructions…' rows={2} style={{...INP,resize:'vertical' as any,fontFamily:'inherit'}}/></div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={handleSubmit} disabled={!memberId||!title.trim()} style={{fontSize:11,color:C.text,background:(!memberId||!title.trim())?C.dim:C.terra,border:'none',borderRadius:8,padding:'7px 18px',cursor:(!memberId||!title.trim())?'not-allowed':'pointer',fontWeight:600}}>Create Task</button>
        <Btn label='Cancel' color={C.muted} onClick={onClose}/>
      </div>
    </div>
  )
}

/* ── TASK CARD ──────────────────────────────────────────────────── */
function TaskCard({task,member,onStatusChange,onAssign,onNotifySent}:{task:any;member:any;onStatusChange:(id:string,s:string)=>void;onAssign:(id:string,n:string)=>void;onNotifySent?:(r:any)=>void}) {
  const [assigning,setAssigning]=useState(false)
  if(task.status==='done'||task.status==='canceled') return null
  const isOverdue = task.due_date && new Date(task.due_date)<new Date()
  const showNotify = !INTERNAL_TASK_TYPES.includes(task.task_type)
  return (
    <div style={{background:C.faint,borderRadius:8,padding:'10px 12px',border:`0.5px solid ${task.status==='in_progress'?C.blue+'44':C.border}`,borderLeft:`2px solid ${PRIORITY_COLORS[task.priority]}`}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:500,color:C.text,marginBottom:4}}>{task.title}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:10,color:C.dim,alignItems:'center'}}>
            <span style={pill(PRIORITY_COLORS[task.priority],PRIORITY_COLORS[task.priority]+'18')}>{task.priority}</span>
            <StatusPill status={task.status}/>
            {!assigning&&(task.owner_name
              ?<span onClick={e=>{e.stopPropagation();setAssigning(true)}} style={{cursor:'pointer',color:C.muted,textDecoration:'underline dotted'}}>{task.owner_name}</span>
              :<span onClick={e=>{e.stopPropagation();setAssigning(true)}} style={{cursor:'pointer',color:C.amber}}>+ Assign</span>
            )}
            {task.due_date&&<span style={{color:isOverdue?C.high:C.dim}}>Due {task.due_date}{isOverdue?' · OVERDUE':''}</span>}
            {task.text_sent_count>0&&<span style={{color:C.blue,fontSize:9}}>📱 {task.text_sent_count} sent</span>}
          </div>
          {assigning&&<div style={{marginTop:8}}><AssignEditor current={task.owner_name} onSave={n=>{onAssign(task.id,n);setAssigning(false)}} onCancel={()=>setAssigning(false)}/></div>}
        </div>
        <div style={{display:'flex',gap:4,flexShrink:0}}>
          {task.status==='open'        &&<Btn label='→ Start'   color={C.blue}  onClick={()=>onStatusChange(task.id,'in_progress')} small/>}
          {task.status==='in_progress' &&<Btn label='← Reopen' color={C.muted} onClick={()=>onStatusChange(task.id,'open')}        small/>}
          <Btn label='✓ Done' color={C.low} onClick={()=>onStatusChange(task.id,'done')} small/>
        </div>
      </div>
      {showNotify&&(
        <div style={{marginTop:8,paddingTop:8,borderTop:`0.5px solid ${C.border}`}}>
          <NotifyButton
            phone={member?.contact_phone??null}
            email={member?.email??null}
            memberName={member?.full_name??''}
            smsMessage={buildSMS(member?.full_name?.split(' ')[0]??'there',task.title,task.due_date)}
            emailSubject={buildEmailSubject(task.title)}
            emailBody={buildEmailBody(member?.full_name?.split(' ')[0]??'there',task.title,task.due_date)}
            taskId={task.id}
            memberId={task.member_id}
            onSent={onNotifySent}
            small
          />
        </div>
      )}
    </div>
  )
}

/* ── ALERT CARD ─────────────────────────────────────────────────── */
function AlertCard({alert,memberName,onAcknowledge,onCreateTask,taskLinked}:{alert:any;memberName:string;onAcknowledge:(id:string)=>void;onCreateTask:(a:any,d:any)=>void;taskLinked:boolean}) {
  const [showForm,setShowForm]=useState(false)
  const sm=SEV_META[alert.severity]??SEV_META.info
  return (
    <div style={{background:C.card,border:`0.5px solid ${sm.color}33`,borderLeft:`3px solid ${sm.color}`,borderRadius:12,padding:'13px 16px',opacity:alert.acknowledged?.6:1}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
            <span style={pill(sm.color,sm.bg)}>{alert.severity}</span>
            {memberName&&<span style={{fontSize:12,fontWeight:500,color:C.text}}>{memberName}</span>}
          </div>
          <div style={{fontSize:13,color:C.muted}}>{alert.title}</div>
        </div>
        <div style={{display:'flex',gap:5,flexShrink:0}}>
          {!alert.acknowledged&&<>
            {!taskLinked&&!showForm&&<Btn label='Create Task' color={C.amber} onClick={()=>setShowForm(true)} small/>}
            {taskLinked&&<span style={{fontSize:10,color:C.low,alignSelf:'center'}}>✓ Task exists</span>}
            <Btn label='Acknowledge' color={C.muted} onClick={()=>onAcknowledge(alert.id)} small/>
          </>}
          {alert.acknowledged&&<span style={{fontSize:10,color:C.dim}}>Acknowledged</span>}
        </div>
      </div>
      {showForm&&(
        <div onClick={e=>e.stopPropagation()} style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${C.border}`,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:11,color:C.amber,fontWeight:500}}>Create task for {memberName}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div><span style={LBL}>Task type</span><select defaultValue={ALERT_TO_TASK[alert.alert_type]??'guide_outreach'} style={{...INP,appearance:'none' as any}}>{TASK_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><span style={LBL}>Assign to</span><select style={{...INP,appearance:'none' as any}}><option value=''>Unassigned</option>{GUIDES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
            <div><span style={LBL}>Due date</span><input type='date' style={INP}/></div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <Btn label='Create Task' color={C.low} onClick={()=>{onCreateTask(alert,{task_type:ALERT_TO_TASK[alert.alert_type]??'guide_outreach',owner_name:null,due_date:null});setShowForm(false)}}/>
            <Btn label='Cancel' color={C.muted} onClick={()=>setShowForm(false)}/>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── STAT CARD ──────────────────────────────────────────────────── */
function StatCard({label,value,sub,accent}:{label:string;value:number|string;sub?:string;accent?:string}) {
  return (
    <div style={{background:C.card,borderRadius:10,border:`0.5px solid ${accent??C.border}`,borderLeft:accent?`2px solid ${accent}`:`0.5px solid ${C.border}`,padding:'12px 16px'}}>
      <div style={{fontSize:9,color:C.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:5}}>{label}</div>
      <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1,fontFamily:'var(--font-cormorant-garamond, serif)'}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.dim,marginTop:3}}>{sub}</div>}
    </div>
  )
}

/* ── TODAY PANEL ────────────────────────────────────────────────── */
function TodayPanel({tasks,activity,onStatusChange,onAssign,memberLookup,onNewTask,onNotifySent}:{tasks:any[];activity:any[];onStatusChange:(id:string,s:string)=>void;onAssign:(id:string,n:string)=>void;memberLookup:Record<string,any>;onNewTask:()=>void;onNotifySent:(r:any)=>void}) {
  const [collapsed,setCollapsed]=useState(false)
  const open=tasks.filter(t=>t.status==='open'||t.status==='in_progress')
  return (
    <div style={{background:C.faint,border:`0.5px solid ${C.hi}`,borderLeft:`3px solid ${C.terra}`,borderRadius:12,padding:'14px 18px',marginBottom:18}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:collapsed?0:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.terra,animation:'pulse 2s infinite'}}/>
          <span style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:C.terra}}>Today's Focus</span>
          <span style={{fontSize:11,color:C.dim}}>· {open.length} open</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Btn label='+ New Task' color={C.terra} onClick={onNewTask} small/>
          <button onClick={()=>setCollapsed(v=>!v)} style={{background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',transform:collapsed?'rotate(-90deg)':'rotate(90deg)',transition:'transform .2s'}}>›</button>
        </div>
      </div>
      {!collapsed&&activity.length>0&&(
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,padding:'7px 10px',background:C.bg,borderRadius:8,border:`0.5px solid ${C.border}`}}>
          <span style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',alignSelf:'center',marginRight:4}}>Today</span>
          {activity.map((a:any,i:number)=><span key={i} style={{fontSize:11,color:C.muted}}><span style={{color:a.color}}>·</span> {a.text}</span>)}
        </div>
      )}
      {!collapsed&&open.length===0&&<div style={{fontSize:12,color:C.low,padding:'8px 0'}}>✓ No open tasks — you're all clear.</div>}
      {!collapsed&&open.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {open.sort((a:any,b:any)=>(['critical','high','medium','low'].indexOf(a.priority))-(['critical','high','medium','low'].indexOf(b.priority))).map((t:any,i:number)=>(
            <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:PRIORITY_COLORS[t.priority]+'22',border:`0.5px solid ${PRIORITY_COLORS[t.priority]}55`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:8}}>
                <span style={{fontSize:10,fontWeight:700,color:PRIORITY_COLORS[t.priority]}}>{i+1}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{marginBottom:2,fontSize:11,color:C.muted}}>{memberLookup[t.member_id]?.full_name}</div>
                <TaskCard task={t} member={memberLookup[t.member_id]} onStatusChange={onStatusChange} onAssign={onAssign} onNotifySent={onNotifySent}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── CHART TOOLTIP ──────────────────────────────────────────────── */
const ChartTip = ({active,payload,label}:any) => {
  if(!active||!payload?.length) return null
  return <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:8,padding:'8px 14px'}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>{label}</div>{payload.map((p:any)=><div key={p.dataKey} style={{fontSize:12,color:p.color,fontWeight:500}}>{p.name}: {p.value?.toFixed(1)}</div>)}</div>
}

/* ── SOPS / PLAYBOOK ────────────────────────────────────────────── */
type SopSection = { heading: string; items: string[] }
type Sop = {
  id: string
  title: string
  owner: string
  updated: string
  status: 'active' | 'draft' | 'review'
  summary: string
  sections: SopSection[]
}

const SOPS: Sop[] = [
  {
    id: 'medical-intake',
    title: 'Medical Intake Playbook',
    owner: 'Jon Allen PA-C · Josh',
    updated: '2026-04-21',
    status: 'draft',
    summary: 'End-to-end pathway from first inquiry to ceremony-cleared. Every member passes through this gate before receiving a ceremony date.',
    sections: [
      {
        heading: '1 · Pre-intake screening',
        items: [
          'Lead completes the intake form on vitalkauai.com (medical history, current medications, mental-health baseline, intention statement).',
          'Screener flags automatic holds: active psychosis, uncontrolled cardiac disease, pregnancy, SSRI/MAOI/lithium within taper window.',
          'Josh or Rachel schedules a 30-min discovery call before any clinical work begins; no clinical advice given on this call.',
          'Inquiry logged in Supabase as a lead with source + UTM attribution.',
        ],
      },
      {
        heading: '2 · Clinical intake (Jon Allen PA-C)',
        items: [
          'Full medical history + medication reconciliation, including supplements and recreational substances.',
          'Cardiac history + family history of sudden cardiac death or long QT syndrome — mandatory.',
          'Mental-health baseline: PHQ-9, GAD-7, trauma/dissociation screen. Baseline stored in follow-up series.',
          'Informed consent reviewed and signed (risks of iboga, cardiac monitoring protocol, emergency plan).',
        ],
      },
      {
        heading: '3 · Required labs (within 30 days of ceremony)',
        items: [
          'CBC with differential, CMP, Mg, K+, Ca2+ (electrolytes must be within range before medicine day).',
          'LFTs (AST, ALT, bilirubin, alk phos).',
          'TSH + free T4.',
          'Urine drug screen.',
          'Pregnancy test (where applicable).',
          'ECG (12-lead) read by our cardiology consult — QTc flag threshold per Jon Allen protocol.',
        ],
      },
      {
        heading: '4 · Cardiac clearance',
        items: [
          'Members 40+, anyone with cardiac history, or any QTc flag → referred to cardiologist for formal clearance.',
          'Clearance letter uploaded to member record before labs_all_cleared is set.',
          'No exceptions. If cardiology cannot clear in time, ceremony is deferred to the next cohort.',
        ],
      },
      {
        heading: '5 · Medication washout',
        items: [
          'SSRIs/SNRIs: taper plan authored by member\'s prescribing physician + Jon Allen. Typical window 4–6 weeks; fluoxetine longer.',
          'MAOIs: absolute contraindication within washout window — defer ceremony.',
          'Tramadol, ondansetron, methadone, and other QT-prolonging meds: reviewed case-by-case.',
          'Stimulants (ADHD meds) paused per protocol.',
          'Washout status confirmed by Jon Allen in writing before medical_cleared flag is set.',
        ],
      },
      {
        heading: '6 · Sign-off + gate flip',
        items: [
          'Jon Allen signs off: medical_cleared = true.',
          'Cardiology signs off: cardiac_cleared = true.',
          'Lab review complete: labs_all_cleared = true.',
          'Agreement + informed consent signed: all_required_signed = true.',
          'Only when all four flags are true does the Ops dashboard open the ceremony date.',
        ],
      },
    ],
  },
  {
    id: 'emergency-protocols',
    title: 'Emergency Protocols',
    owner: 'Jon Allen PA-C · On-site medical lead',
    updated: '2026-04-21',
    status: 'draft',
    summary: 'What to do when something goes wrong — during ceremony, integration nights, or between cohorts. Memorize the first bullet of every section.',
    sections: [
      {
        heading: 'Chain of command (ceremony night)',
        items: [
          'On-site medical lead (PA-C or RN) has final call on any clinical decision.',
          'Ceremony holder manages the container; medical lead manages the body.',
          'Sacred hospitality coordinator assists, does not intervene clinically.',
          'Josh or Rachel is the designated comms lead to family / outside parties.',
        ],
      },
      {
        heading: 'Cardiac event',
        items: [
          'Continuous pulse-ox + telemetry during the acute window; vitals logged every 15 min.',
          'Chest pain, arrhythmia on monitor, or sustained HR outside safe band → stop dosing, stabilize, assess.',
          'AED + IV magnesium + crash kit staged in ceremony space at all times.',
          'Call 911 immediately for any suspected cardiac event. Do not wait.',
          'Wilcox Medical Center (Līhuʻe) is the nearest ED — ~25 min by ground.',
        ],
      },
      {
        heading: 'Adverse psychological reaction',
        items: [
          'Contained space, one-on-one holder, lower stimulation. Never leave the person alone.',
          'Benzodiazepine available per Jon Allen protocol if acute agitation cannot be contained verbally.',
          'Persistent dissociation, suicidal ideation, or psychosis beyond the acute window → clinical escalation + in-person follow-up within 24 hours.',
          'Document everything in the adverse events panel; file within 24 hours.',
        ],
      },
      {
        heading: 'On-island emergency contacts',
        items: [
          '911 — fire, paramedics, police.',
          'Wilcox Medical Center (Līhuʻe): (808) 245-1100.',
          'Kauaʻi Veterans Memorial Hospital (Waimea): (808) 338-9431.',
          'Poison Control (national): 1-800-222-1222.',
          'Jon Allen PA-C direct line: [fill in].',
          'Insurance + malpractice carrier after-hours line: [fill in].',
        ],
      },
      {
        heading: 'Evacuation plan',
        items: [
          'Ground evac to Wilcox is primary — vehicle fueled and keys in known location at all times during retreat.',
          'Air evac (AirMed / Life Flight) for inter-island transfer if Oʻahu-level care required.',
          'Every staff member knows the driveway exit route and the nearest helicopter landing zone.',
          'Run a tabletop evac drill before every cohort.',
        ],
      },
      {
        heading: 'Post-event debrief + reporting',
        items: [
          'Hot debrief within 24 hours with all staff present at the event.',
          'Written incident report filed within 48 hours — root cause, timeline, what we\'d change.',
          'Member + family communication handled only by Josh or Rachel.',
          'If reportable, coordinate with counsel before any external statement.',
        ],
      },
    ],
  },
  {
    id: 'practitioner-onboarding',
    title: 'Practitioner Onboarding',
    owner: 'Rachel · Dr. Liz (Director of On-Island Integration)',
    updated: '2026-04-21',
    status: 'draft',
    summary: 'Bringing a new guide, integration specialist, or medical practitioner into the Vital Kauaʻi container. No one holds space for a member until this is complete.',
    sections: [
      {
        heading: '1 · Credentialing',
        items: [
          'License verification (clinical role) + current malpractice coverage on file.',
          'Background check (national + state) — renewed annually.',
          'Signed contractor agreement, NDA, and code of ethics.',
          'W-9 + payment setup before first engagement.',
        ],
      },
      {
        heading: '2 · Orientation + training',
        items: [
          'Vital Kauaʻi ethos + history (2-hour session with Josh or Rachel).',
          'Cultural orientation with kumu / cultural advisor — Hawaiian protocols, land, language.',
          'Iboga 101: pharmacology, phenomenology, safety profile, our specific protocol.',
          'Trauma-informed care + ethics training (internal modules + annual refresh).',
          'Review of emergency protocols + dry run of the evac plan.',
        ],
      },
      {
        heading: '3 · Observed ceremonies',
        items: [
          'Minimum 2 observed ceremonies before any active role.',
          'Written reflections after each observation, reviewed by mentor.',
          'No clinical decisions by the trainee during this phase.',
        ],
      },
      {
        heading: '4 · Mentorship period',
        items: [
          'Assigned mentor (Dr. Liz or senior guide) for first 3 cohorts.',
          'Weekly 1:1 during first cohort; biweekly after.',
          'Peer consultation group monthly, ongoing.',
        ],
      },
      {
        heading: '5 · Integration-guide calibration',
        items: [
          'Shadow one full integration arc (pre-ceremony → 6-month follow-up).',
          'Calibration call on PHQ-9 / GAD-7 / regulation scoring so data is consistent across guides.',
          'Review of how we talk about outcomes — no claims, no promises.',
        ],
      },
      {
        heading: '6 · Go-live + ongoing',
        items: [
          'Profile added to Specialists registry; assignment cell enabled in Ops dashboard.',
          'Calendly wired to the shared scheduling link.',
          'Annual ethics + emergency refresh; credentials re-verified.',
        ],
      },
    ],
  },
  {
    id: 'sacred-hospitality',
    title: 'Sacred Hospitality Coordinator SOPs',
    owner: 'Sacred Hospitality Coordinator · Robyn',
    updated: '2026-04-21',
    status: 'draft',
    summary: 'Hospitality as ceremony. The coordinator is the keeper of the container — land, altar, rhythm, food, language. Everything a member feels from arrival to departure passes through this role.',
    sections: [
      {
        heading: 'Opening the week · arrival',
        items: [
          'Land blessing with kumu or designated culture bearer before members arrive.',
          'Lei greeting + pule (prayer) at the threshold — every member, every time.',
          'Orientation walk: sleeping quarters, ceremony space, kitchen, bathrooms, emergency exits.',
          'Phones collected and placed in the phone basket at the altar (returned at departure).',
          'First-night kava circle: names, intentions, agreements, silence protocol.',
        ],
      },
      {
        heading: 'Altar + ceremonial space',
        items: [
          'Altar refreshed daily — water, flowers, pa\'akai (salt), offerings from the land.',
          'Space cleansed with la\'au (hawaiian herbs) morning and evening.',
          'Nothing crosses the altar without intention — no phones, no food, no street shoes.',
          'Ceremony space is silent between 10pm and 6am unless medicine is active.',
        ],
      },
      {
        heading: 'Daily rhythm during retreat',
        items: [
          'Sunrise: pule + light movement on the lanai.',
          'Breakfast is communal, silent for the first 10 minutes.',
          'Morning: integration circle or 1:1 with guide.',
          'Midday rest — no programming between 12 and 2pm.',
          'Afternoon: somatic work, nature immersion, or creative time.',
          'Evening: dinner, story circle, wind-down. Lights out by 10pm on non-ceremony nights.',
        ],
      },
      {
        heading: 'Food + kitchen',
        items: [
          'Pre-ceremony diet starts 72 hours before medicine day: no alcohol, caffeine tapered, whole foods, low sodium, no tyramine-heavy foods (aged cheese, cured meats, fermented soy).',
          'Local + culturally aligned sourcing where possible: kalo, ulu, fish from trusted fisher, greens from the garden.',
          'Allergies + dietary restrictions documented on the member card; cross-contamination protocol in the kitchen.',
          'Post-ceremony meal is intentional — broth, simple, warming. No heavy solids until the body asks for them.',
          'Water always available in the ceremony space; never interrupt a member to offer it.',
        ],
      },
      {
        heading: 'Language + cultural orientation',
        items: [
          'We do not use the word "shaman." We say guide, holder, or practitioner.',
          'We do not say "trip" — we say journey or medicine.',
          'Hawaiian words are used with reverence, not decoration. When unsure, ask kumu.',
          'Members are told what kapu (sacred boundaries) apply on the land — where to walk, where not to walk, what to touch.',
          'Photography is by explicit permission only; never of other members, never of the altar.',
        ],
      },
      {
        heading: 'Night oversight + medicine nights',
        items: [
          'Coordinator is awake and on-call during the full medicine window, handing off to night watch only with explicit verbal handoff.',
          'No coordinator intervenes clinically — that is the medical lead\'s role. Hospitality holds the room, not the body.',
          'Quiet hands, low voice, warm presence. Members in process are not conversed with unless they initiate.',
          'Bathroom escorts as needed; dignity preserved at all times.',
        ],
      },
      {
        heading: 'Departure + aloha continuum',
        items: [
          'Closing circle on final morning — gratitudes, intention for return, what the member carries home.',
          'Lei of departure + personalized blessing from kumu.',
          'Phones returned at the threshold, not before.',
          'Integration packet handed to member in person: follow-up schedule, guide contact, emergency lines.',
          'Coordinator writes a one-paragraph note per member for the integration team within 48 hours.',
        ],
      },
      {
        heading: 'Between cohorts',
        items: [
          'Deep clean of ceremony space, altar reset with fresh offerings.',
          'Kitchen inventory + restock, allergen audit.',
          'Walk the land with kumu — what needs tending, what needs rest.',
          'Debrief with Rachel + Josh on what worked, what to change for the next cohort.',
        ],
      },
    ],
  },
]

function SopStatusPill({status}:{status:Sop['status']}) {
  const m = status==='active' ? {color:C.low, bg:C.lowBg, label:'Active'}
         : status==='review'  ? {color:C.amber,bg:C.amberBg,label:'In Review'}
         :                      {color:C.muted,bg:C.faint,  label:'Draft'}
  return <span style={pill(m.color,m.bg)}>{m.label}</span>
}

function SopsPanel() {
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

      {/* TOC */}
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
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'28px 20px',textAlign:'center',color:C.dim,fontSize:12}}>
          No playbooks yet. Content coming in the next turn.
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

/* ══════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════ */
export default function OpsDashboardPage() {
  const router = useRouter()
  const [loading,         setLoading]         = useState(true)
  const [tab,             setTab]             = useState('pipeline')
  const [expanded,        setExpanded]        = useState<string|null>(null)
  const [expandedSub,     setExpandedSub]     = useState<Record<string,string|null>>({})
  const [riskFilter,      setRiskFilter]      = useState('all')
  const [activity,        setActivity]        = useState<any[]>([])
  const [showCreate,      setShowCreate]      = useState(false)
  const [createForMember, setCreateForMember] = useState<string|null>(null)
  const [founderNotif,    setFounderNotif]    = useState<string|null>(null)

  // Supabase data
  const [tasks,      setTasks]      = useState<any[]>([])
  const [members,    setMembers]    = useState<any[]>([])
  const [riskScores, setRiskScores] = useState<Record<string,any>>({})
  const [alerts,     setAlerts]     = useState<any[]>([])
  const [overdueFu,  setOverdueFu]  = useState<any[]>([])
  const [outcomes,   setOutcomes]   = useState<Record<string,any>>({})
  const [ceremonies, setCeremonies] = useState<any[]>([])
  const [timelines,  setTimelines]  = useState<Record<string,any[]>>({})

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){router.push('/login');return}

      const [
        {data:td},{data:md},{data:rd},{data:ad},
        {data:od},{data:outd},{data:cd},{data:tld},
      ] = await Promise.all([
        supabase.from('ops_tasks').select('*').in('status',['open','in_progress']).order('created_at',{ascending:false}),
        supabase.from('member_pipeline_view').select('*'),
        supabase.from('member_risk_scores').select('*'),
        supabase.from('ops_alerts').select('*').eq('is_active',true).order('created_at',{ascending:false}),
        supabase.from('followup_overdue_view').select('*'),
        supabase.from('member_outcomes_summary_view').select('*'),
        supabase.from('ceremony_schedule_view').select('*').order('ceremony_date'),
        supabase.from('member_timelines').select('*').order('event_date',{ascending:true}),
      ])

      setTasks(td??[])
      setMembers(md??[])
      const rMap:Record<string,any>={}; for(const r of rd??[]) rMap[r.member_id]=r; setRiskScores(rMap)
      setAlerts(ad??[])
      setOverdueFu(od??[])
      const oMap:Record<string,any>={}; for(const o of outd??[]) oMap[o.member_id]=o; setOutcomes(oMap)
      setCeremonies(cd??[])
      const tMap:Record<string,any[]>={}; for(const t of tld??[]){if(!tMap[t.member_id])tMap[t.member_id]=[]; tMap[t.member_id].push(t)}; setTimelines(tMap)
      setLoading(false)
    }
    load()
  }, [router])

  /* ── MUTATIONS ──────────────────────────────────────────────────── */
  const addActivity = useCallback((text:string,color:string)=>{
    setActivity(prev=>[{text,color,ts:Date.now()},...prev.slice(0,4)])
  },[])

  const updateTaskStatus = useCallback(async(taskId:string,newStatus:string)=>{
    const supabase=createClient()
    const task=tasks.find(t=>t.id===taskId); if(!task) return
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status:newStatus,completed_at:newStatus==='done'?new Date().toISOString():null}:t))
    await supabase.from('ops_tasks').update({status:newStatus,completed_at:newStatus==='done'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',taskId)
    if(newStatus==='done'){
      // Write timeline event
      await supabase.from('member_timelines').insert({member_id:task.member_id,event_type:'task_completed',event_title:`Task completed: ${task.title}`,event_detail:`Type: ${TASK_TYPE_LABELS[task.task_type]??task.task_type}`,event_date:new Date().toISOString(),is_system:false,actor_name:task.owner_name??'Guide',source_table:'ops_tasks',source_id:taskId})
      // Auto-notify founders
      const member=members.find(m=>m.member_id===task.member_id)
      const founderMsg=`Vital Kauaʻi Ops ✓\n\n${member?.full_name??'A member'} completed:\n"${task.title}"\n\nView dashboard for details.`
      await supabase.functions.invoke('send-notification',{
        body:{channel:'sms',to:'founders',message:founderMsg,sms_type:'task_complete_alert',member_id:task.member_id,task_id:taskId,to_name:member?.full_name,notify_founders:true,founder_message:founderMsg,founder_subject:`Ops: ${member?.full_name?.split(' ')[0]} completed a task`}
      }).catch(console.error)
      const name=member?.full_name?.split(' ')[0]??'Member'
      setFounderNotif(`${name} completed "${task.title.slice(0,40)}"`)
      setTimeout(()=>setFounderNotif(null),5000)
      addActivity('📱 Rachel & Josh notified',C.low)
    }
    const m=members.find(x=>x.member_id===task.member_id)
    addActivity(`${m?.full_name?.split(' ')[0]} · "${task.title.slice(0,28)}" ${newStatus==='done'?'completed':newStatus==='in_progress'?'started':'reopened'}`,newStatus==='done'?C.low:newStatus==='in_progress'?C.blue:C.muted)
  },[tasks,members,addActivity])

  const assignTask = useCallback(async(taskId:string,ownerName:string)=>{
    const supabase=createClient()
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,owner_name:ownerName||null}:t))
    await supabase.from('ops_tasks').update({owner_name:ownerName||null,updated_at:new Date().toISOString()}).eq('id',taskId)
    const task=tasks.find(t=>t.id===taskId); const m=members.find(x=>x.member_id===task?.member_id)
    if(ownerName) addActivity(`${m?.full_name?.split(' ')[0]} · assigned to ${ownerName}`,C.amber)
  },[tasks,members,addActivity])

  const saveNewTask = useCallback((taskData:any)=>{
    setTasks(prev=>[taskData,...prev])
    const m=members.find(x=>x.member_id===taskData.member_id)
    addActivity(`New task · ${m?.full_name?.split(' ')[0]} · ${taskData.title.slice(0,30)}`,C.terra)
    setCreateForMember(null)
  },[members,addActivity])

  const createTaskFromAlert = useCallback(async(alert:any,taskData:any)=>{
    const supabase=createClient()
    const m=members.find(x=>x.member_id===alert.member_id)
    const newTask={member_id:alert.member_id,task_type:taskData.task_type,title:TASK_TYPE_LABELS[taskData.task_type]??taskData.task_type,priority:alert.severity==='critical'?'critical':alert.severity==='high'?'high':'medium',status:'open',owner_name:taskData.owner_name,due_date:taskData.due_date,source_view:'ops_alerts',source_reason:alert.alert_type}
    const {data:created}=await supabase.from('ops_tasks').insert(newTask).select().single()
    if(created){setTasks(prev=>[created,...prev]);if(alert.id)await supabase.from('ops_alerts').update({source_id:created.id}).eq('id',alert.id);setAlerts(prev=>prev.map(a=>a.id===alert.id?{...a,linked_task_id:created.id}:a))}
    addActivity(`Task created · ${m?.full_name?.split(' ')[0]} · ${TASK_TYPE_LABELS[taskData.task_type]}`,C.amber)
  },[members,addActivity])

  const ackAlert = useCallback(async(id:string)=>{
    const supabase=createClient()
    setAlerts(prev=>prev.map(a=>a.id===id?{...a,acknowledged:true}:a))
    await supabase.from('ops_alerts').update({acknowledged:true,acknowledged_at:new Date().toISOString()}).eq('id',id)
    const alert=alerts.find(a=>a.id===id); const m=members.find(x=>x.member_id===alert?.member_id)
    addActivity(`Alert acknowledged · ${m?.full_name?.split(' ')[0]??'member'}`,C.muted)
  },[alerts,members,addActivity])

  const onNotifySent = useCallback((r:any)=>{
    addActivity(`${r.channel==='sms'?'📱 Text':'✉ Email'} sent to ${r.to_name??'member'}`,C.blue)
  },[addActivity])

  /* ── DERIVED ─────────────────────────────────────────────────────── */
  const memberLookup = useMemo(()=>{ const m:Record<string,any>={}; for(const x of members) m[x.member_id]=x; return m },[members])
  const memberTasksMap = useMemo(()=>{ const m:Record<string,any[]>={}; for(const t of tasks.filter(t=>t.status!=='done'&&t.status!=='canceled')){if(!m[t.member_id])m[t.member_id]=[];m[t.member_id].push(t)}; return m },[tasks])

  const critCount  = alerts.filter(a=>a.severity==='critical'&&!a.acknowledged).length
  const highCount  = alerts.filter(a=>a.severity==='high'&&!a.acknowledged).length
  const warnCount  = alerts.filter(a=>a.severity==='warning'&&!a.acknowledged).length
  const upcoming   = ceremonies.filter(c=>c.days_until_ceremony!=null&&c.days_until_ceremony>0)
  const totalRev   = members.reduce((s:number,m:any)=>s+(m.program_price??0),0)
  const totalProfit= members.reduce((s:number,m:any)=>s+((m.program_price??0)-(m.cost_of_service??0)),0)
  const sortedMembers=[...members].sort((a:any,b:any)=>(STAGE_META[a.pipeline_stage]?.order??9)-(STAGE_META[b.pipeline_stage]?.order??9))
  const visibleRisk=riskFilter==='all'?sortedMembers:sortedMembers.filter((m:any)=>(riskScores[m.member_id]?.risk_level??m.risk_level)===riskFilter)
  const cohortTrend=[{label:'Baseline',phq9:21.0,gad7:15.0},{label:'1 wk',phq9:12.5,gad7:9.8},{label:'1 mo',phq9:9.0,gad7:7.0}]

  if(loading) return <div style={{margin:'-2rem',minHeight:'calc(100vh - 101px)',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:12,color:C.muted,letterSpacing:'.1em',textTransform:'uppercase'}}>Loading ops data…</div></div>

  return (
    <div style={{margin:'-2rem',minHeight:'calc(100vh - 101px)',background:C.bg,fontFamily:'var(--font-jost, sans-serif)',color:C.text}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px} button:focus{outline:none} select,input,textarea{background:${C.faint};color:${C.text}} option{background:#1A1613} @media print{body,html{background:#fff!important;color:#111!important}.sops-panel{color:#111!important}.sops-panel *{color:#111!important;background:#fff!important;border-color:#ddd!important}.sops-panel button{display:none!important}}`}</style>

      <FounderToast notification={founderNotif} onDismiss={()=>setFounderNotif(null)}/>

      {/* OPS HEADER */}
      <div style={{borderBottom:`0.5px solid ${C.border}`,height:46,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Link href='/dashboard' style={{fontSize:11,color:C.muted,textDecoration:'none',letterSpacing:'.06em'}}>← Dashboard</Link>
          <span style={{color:C.dim}}>·</span>
          <span style={{fontSize:10,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase'}}>Command Center</span>
          <span style={{color:C.dim}}>·</span>
          <Link href='/ops/pending' style={{fontSize:11,color:C.terra,textDecoration:'none',letterSpacing:'.06em',fontWeight:600}}>Pending Approvals →</Link>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>{setCreateForMember(null);setShowCreate(v=>!v)}} style={{fontSize:10,color:C.terra,background:C.terraBg,border:`0.5px solid ${C.terra}55`,borderRadius:6,padding:'4px 12px',cursor:'pointer',fontWeight:600,letterSpacing:'.06em'}}>
            {showCreate?'Cancel':'+ New Task'}
          </button>
          {critCount>0&&<div style={{display:'flex',alignItems:'center',gap:5,background:C.critBg,border:`0.5px solid ${C.crit}44`,borderRadius:20,padding:'3px 10px'}}><div style={{width:5,height:5,borderRadius:'50%',background:C.crit,animation:'pulse 1.5s infinite'}}/><span style={{fontSize:10,color:C.crit,fontWeight:700,letterSpacing:'.06em'}}>{critCount} CRITICAL</span></div>}
          {highCount>0&&<div style={{background:C.highBg,border:`0.5px solid ${C.high}44`,borderRadius:20,padding:'3px 10px'}}><span style={{fontSize:10,color:C.high,fontWeight:600}}>{highCount} high</span></div>}
          {warnCount>0&&<div style={{background:C.amberBg,border:`0.5px solid ${C.amber}44`,borderRadius:20,padding:'3px 10px'}}><span style={{fontSize:10,color:C.amber,fontWeight:600}}>{warnCount} warning</span></div>}
        </div>
      </div>

      <div style={{padding:'20px 24px'}}>
        {/* METRICS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
          {([
            ['Members',             members.length,                     'across all stages', null],
            ['Open Tasks',          tasks.filter((t:any)=>t.status!=='done'&&t.status!=='canceled').length, `${tasks.filter((t:any)=>t.priority==='critical'||t.priority==='high').length} high priority`, (critCount||highCount)?C.high:null],
            ['Active Alerts',       critCount+highCount+warnCount,      `${critCount} critical · ${highCount} high`, critCount?C.crit:highCount?C.high:null],
            ['Upcoming Ceremonies', upcoming.length,                    upcoming[0]?`${upcoming[0].full_name?.split(' ')[0]} · ${upcoming[0].days_until_ceremony}d`:'None scheduled', upcoming.length?C.blue:null],
            ['Overdue Follow-ups',  overdueFu.length,                   overdueFu.length?`${overdueFu[0].full_name?.split(' ')[0]} · ${overdueFu[0].timepoint?.replace(/_/g,' ')}`:'All current', overdueFu.length?C.amber:null],
          ] as [string,number,string,string|null][]).map(([label,value,sub,accent])=>(
            <StatCard key={label} label={label} value={value} sub={sub} accent={accent??undefined}/>
          ))}
        </div>

        {/* GLOBAL CREATE TASK */}
        {showCreate&&!createForMember&&<CreateTaskPanel members={members} preselectedMemberId={null} onSave={saveNewTask} onClose={()=>setShowCreate(false)}/>}

        {/* TODAY */}
        <TodayPanel tasks={tasks} activity={activity} onStatusChange={updateTaskStatus} onAssign={assignTask} memberLookup={memberLookup} onNewTask={()=>{setCreateForMember(null);setShowCreate(true)}} onNotifySent={onNotifySent}/>

        {/* MAIN GRID */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14}}>
          <div>
            {/* Tabs */}
            <div style={{display:'flex',gap:2,marginBottom:13,background:C.card,borderRadius:9,padding:3,border:`0.5px solid ${C.border}`}}>
              {(['pipeline','risk','outcomes','alerts','journeys','cohorts','sops'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'6px 0',borderRadius:7,border:'none',background:tab===t?C.surf:'transparent',color:tab===t?C.text:C.dim,fontSize:10,fontWeight:500,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',transition:'all .15s',position:'relative'}}>
                  {t}{t==='alerts'&&(critCount+highCount)>0&&<span style={{position:'absolute',top:4,right:8,width:5,height:5,borderRadius:'50%',background:critCount?C.crit:C.high}}/>}
                </button>
              ))}
            </div>

            {/* PIPELINE */}
            {tab==='pipeline'&&sortedMembers.map((m:any)=>{
              const rs=riskScores[m.member_id]??{}, rLevel=rs.risk_level??m.risk_level??'low'
              const rFactors:string[]=rs.risk_factors??m.risk_factors??[]
              const mTasks=memberTasksMap[m.member_id]??[]
              const outcome=outcomes[m.member_id]
              const blockers=getCeremonyBlockers(m)
              const open=expanded===m.member_id, sub=expandedSub[m.member_id]??null
              const showCreateForThis=createForMember===m.member_id
              const memberTimeline=timelines[m.member_id]??[]

              return (
                <div key={m.member_id} style={{marginBottom:7,background:open?C.surf:C.card,border:`0.5px solid ${open?C.hi:C.border}`,borderRadius:12,overflow:'hidden',transition:'all .15s'}}>
                  <div onClick={()=>setExpanded(v=>v===m.member_id?null:m.member_id)} style={{display:'flex',alignItems:'center',gap:11,padding:'13px 16px',cursor:'pointer'}}>
                    <Avatar name={m.full_name}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:500}}>{m.full_name}</span>
                        <StagePill stage={m.pipeline_stage}/>
                        <RiskPill level={rLevel}/>
                        {mTasks.length>0&&<span style={pill(C.amber,C.amberBg)}>{mTasks.length} task{mTasks.length>1?'s':''}</span>}
                        {blockers.length>0&&m.pipeline_stage==='pre_ceremony'&&<span style={pill(C.crit,C.critBg)}>⚠ {blockers.length} blocker{blockers.length>1?'s':''}</span>}
                      </div>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:11,color:C.muted,alignItems:'center'}}>
                        {m.assigned_partner&&<span>Guide: {m.assigned_partner}</span>}
                        {m.days_to_ceremony!=null&&m.days_to_ceremony>0&&<span style={{color:C.blue}}>Ceremony in {m.days_to_ceremony}d</span>}
                        {m.days_to_ceremony!=null&&m.days_to_ceremony<0&&<span>Ceremony {Math.abs(m.days_to_ceremony)}d ago</span>}
                        {m.overdue_followup_count>0&&<span style={{color:C.amber}}>⚑ {m.overdue_followup_count} overdue</span>}
                        {outcome?.phq9_delta!=null&&<span style={{color:outcome.phq9_delta<0?C.low:C.high}}>PHQ-9 {outcome.phq9_delta>0?'+':''}{outcome.phq9_delta}</span>}
                        {outcome?.gad7_delta!=null&&<span style={{color:outcome.gad7_delta<0?C.low:C.high}}>GAD-7 {outcome.gad7_delta>0?'+':''}{outcome.gad7_delta}</span>}
                        {outcome?.regulation_delta!=null&&<span style={{color:C.low}}>Reg +{outcome.regulation_delta}</span>}
                        {!outcome?.phq9_delta&&m.journey_focus&&<span style={{color:C.dim}}>{m.journey_focus}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      {m.program_price&&<div style={{fontSize:11,color:C.dim}}>${(m.program_price/1000).toFixed(0)}k</div>}
                      <div style={{fontSize:10,color:C.dim}}>score {rs.risk_score??0}</div>
                    </div>
                    <div style={{fontSize:13,color:C.dim,transform:open?'rotate(90deg)':'none',transition:'transform .2s',marginLeft:4}}>›</div>
                  </div>

                  {open&&(
                    <div style={{borderTop:`0.5px solid ${C.border}`,padding:'14px 16px'}}>
                      {(m.pipeline_stage==='pre_ceremony'||(m.days_to_ceremony!=null&&m.days_to_ceremony>0))&&<CeremonyGate member={m}/>}
                      {rFactors.length>0&&<div style={{marginBottom:12,display:'flex',gap:6,flexWrap:'wrap'}}>{rFactors.map((r:string)=><span key={r} style={pill(rLevel==='high'||rLevel==='critical'?C.high:C.amber,rLevel==='high'||rLevel==='critical'?C.highBg:C.medBg)}>{REASON_LABELS[r]??r}</span>)}</div>}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginBottom:12}}>
                        {([
                          ['Medical',   m.medical_cleared?'Cleared':'Pending',             m.medical_cleared?C.low:C.high],
                          ['Cardiac',   m.cardiac_cleared?'Cleared':'Pending',             m.cardiac_cleared?C.low:C.high],
                          ['Labs',      m.labs_all_cleared?'All approved':`${m.total_approved??0}/${m.total_submitted??0} done`,m.labs_all_cleared?C.low:C.amber],
                          ['Agreement', m.all_required_signed?'All signed':'Incomplete',   m.all_required_signed?C.low:C.muted],
                          ['Ceremonies',m.ceremony_count>0?`${m.ceremony_count} held`:'None yet',C.muted],
                          ['PHQ-9 Δ',   outcome?.phq9_delta!=null?`${outcome.phq9_delta>0?'+':''}${outcome.phq9_delta}`:'—',outcome?.phq9_delta<0?C.low:outcome?.phq9_delta>0?C.high:C.muted],
                        ] as [string,string,string][]).map(([l,v,c])=>(
                          <div key={l} style={{background:C.faint,borderRadius:8,padding:'8px 11px',border:`0.5px solid ${C.border}`}}>
                            <div style={{fontSize:9,color:C.dim,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:3}}>{l}</div>
                            <div style={{fontSize:12,fontWeight:500,color:c}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:4,marginBottom:10}}>
                        {(['tasks','timeline'] as const).map(s2=>(
                          <button key={s2} onClick={e=>{e.stopPropagation();setExpandedSub(v=>({...v,[m.member_id]:v[m.member_id]===s2?null:s2}))}} style={{padding:'4px 12px',borderRadius:20,border:`0.5px solid ${sub===s2?C.terra:C.border}`,background:sub===s2?C.terraBg:'transparent',color:sub===s2?C.terra:C.muted,fontSize:10,fontWeight:500,letterSpacing:'.07em',textTransform:'uppercase',cursor:'pointer'}}>
                            {s2}{s2==='tasks'&&mTasks.length>0?` (${mTasks.length})`:''}
                            {s2==='timeline'&&memberTimeline.length>0?` (${memberTimeline.length})`:''}
                          </button>
                        ))}
                      </div>
                      {sub==='tasks'&&(
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {showCreateForThis?<CreateTaskPanel members={members} preselectedMemberId={m.member_id} onSave={saveNewTask} onClose={()=>setCreateForMember(null)}/>:<div style={{marginBottom:6}}><Btn label='+ Add Task for this member' color={C.terra} onClick={()=>{setCreateForMember(m.member_id);setShowCreate(false)}}/></div>}
                          {mTasks.length===0?<div style={{fontSize:12,color:C.dim,padding:'4px 0'}}>No open tasks.</div>:mTasks.map((t:any)=><TaskCard key={t.id} task={t} member={m} onStatusChange={updateTaskStatus} onAssign={assignTask} onNotifySent={onNotifySent}/>)}
                        </div>
                      )}
                      {sub==='timeline'&&(
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {memberTimeline.length===0
                            ?<div style={{fontSize:12,color:C.dim,padding:'8px 0'}}>No timeline events yet.</div>
                            :memberTimeline.map((event:any)=>(
                              <div key={event.id} style={{display:'flex',gap:10,padding:'8px 10px',background:C.faint,borderRadius:8,border:`0.5px solid ${C.border}`}}>
                                <div style={{width:6,height:6,borderRadius:'50%',background:C.terra,flexShrink:0,marginTop:5}}/>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,fontWeight:500,color:C.text,marginBottom:2}}>{event.event_title}</div>
                                  {event.event_detail&&<div style={{fontSize:10,color:C.dim}}>{event.event_detail}</div>}
                                  <div style={{fontSize:9,color:C.dim,marginTop:3}}>
                                    {new Date(event.event_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                                    {event.actor_name&&!event.is_system?` · ${event.actor_name}`:''}
                                  </div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      )}
                      {!sub&&m.primary_intention&&<div style={{padding:'9px 12px',background:C.faint,borderRadius:8,border:`0.5px solid ${C.border}`,borderLeft:`2px solid ${C.terra}`}}><div style={{fontSize:9,color:C.dim,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:3}}>Intention</div><div style={{fontSize:12,color:C.muted,fontStyle:'italic'}}>"{m.primary_intention}"</div></div>}
                    </div>
                  )}
                </div>
              )
            })}

            {/* RISK TAB */}
            {tab==='risk'&&(
              <div>
                <div style={{display:'flex',gap:6,marginBottom:13}}>
                  {(['all','critical','high','medium','low'] as const).map(f=>(
                    <button key={f} onClick={()=>setRiskFilter(f)} style={{padding:'4px 12px',borderRadius:20,border:`0.5px solid ${C.border}`,background:riskFilter===f?C.surf:'transparent',color:riskFilter===f?C.text:C.muted,fontSize:10,fontWeight:500,cursor:'pointer',letterSpacing:'.06em',textTransform:'uppercase'}}>{f}</button>
                  ))}
                </div>
                {[...visibleRisk].sort((a:any,b:any)=>(riskScores[b.member_id]?.risk_score??0)-(riskScores[a.member_id]?.risk_score??0)).map((m:any)=>{
                  const rs=riskScores[m.member_id]??{}, rLevel=rs.risk_level??m.risk_level??'low'
                  const rc=RISK_META[rLevel]??RISK_META.low, rFactors:string[]=rs.risk_factors??m.risk_factors??[]
                  const mTasks=memberTasksMap[m.member_id]??[]
                  return (
                    <div key={m.member_id} style={{marginBottom:8,background:C.card,border:`0.5px solid ${C.border}`,borderLeft:`3px solid ${rc.color}`,borderRadius:12,padding:'14px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                        <Avatar name={m.full_name} size={30}/>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{m.full_name}</div><div style={{display:'flex',alignItems:'center',gap:8}}><StagePill stage={m.pipeline_stage}/>{m.ceremony_date&&<span style={{fontSize:11,color:C.muted}}>{m.ceremony_date}</span>}</div></div>
                        <div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:600,color:rc.color,fontFamily:'var(--font-cormorant-garamond,serif)',lineHeight:1}}>{rs.risk_score??0}</div><div style={{fontSize:9,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginTop:2}}>score</div></div>
                        <RiskPill level={rLevel}/>
                      </div>
                      {m.pipeline_stage==='pre_ceremony'&&<div style={{marginBottom:12}}><CeremonyGate member={m}/></div>}
                      {rFactors.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:mTasks.length?10:0}}>{rFactors.map((r:string)=><span key={r} style={pill(rc.color,rc.bg)}>{REASON_LABELS[r]??r}</span>)}</div>}
                      {mTasks.length>0&&<div style={{display:'flex',flexDirection:'column',gap:5,marginTop:rFactors.length?10:0}}>{mTasks.map((t:any)=><TaskCard key={t.id} task={t} member={m} onStatusChange={updateTaskStatus} onAssign={assignTask} onNotifySent={onNotifySent}/>)}</div>}
                      {!rFactors.length&&!mTasks.length&&<div style={{fontSize:11,color:C.low}}>✓ No active flags or open tasks</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* OUTCOMES TAB */}
            {tab==='outcomes'&&(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 18px'}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>Cohort average · PHQ-9 + GAD-7</div>
                  <ResponsiveContainer width='100%' height={160}>
                    <AreaChart data={cohortTrend} margin={{top:4,right:4,left:-22,bottom:0}}>
                      <defs><linearGradient id='gP' x1='0' y1='0' x2='0' y2='1'><stop offset='5%' stopColor={C.blue} stopOpacity={.2}/><stop offset='95%' stopColor={C.blue} stopOpacity={0}/></linearGradient><linearGradient id='gG' x1='0' y1='0' x2='0' y2='1'><stop offset='5%' stopColor={C.purple} stopOpacity={.2}/><stop offset='95%' stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey='label' tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false} domain={[0,25]}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Area type='monotone' dataKey='phq9' name='PHQ-9' stroke={C.blue}   strokeWidth={2} fill='url(#gP)' dot={{fill:C.blue,r:3}}/>
                      <Area type='monotone' dataKey='gad7' name='GAD-7' stroke={C.purple} strokeWidth={2} fill='url(#gG)' dot={{fill:C.purple,r:3}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {members.map((m:any)=>{
                  const o=outcomes[m.member_id]; const hasData=o?.phq9_delta!=null
                  return (
                    <div key={m.member_id} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'13px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:hasData?10:0}}>
                        <Avatar name={m.full_name} size={30}/>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{m.full_name}</div>{o?.latest_timepoint?<span style={pill(C.blue,C.blueBg)}>{o.latest_timepoint.replace(/_/g,' ')}</span>:<span style={{fontSize:11,color:C.dim}}>No follow-up data yet</span>}</div>
                        {hasData&&<div style={{textAlign:'right'}}><div style={{fontSize:18,fontWeight:600,color:o.phq9_delta<0?C.low:C.high,fontFamily:'var(--font-cormorant-garamond,serif)',lineHeight:1}}>{o.phq9_pct_improvement?.toFixed(0)}%</div><div style={{fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.07em',marginTop:1}}>{o.phq9_response_class?.replace(/_/g,' ')}</div></div>}
                      </div>
                      {hasData&&<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>{([['PHQ-9',`${o.phq9_delta>0?'+':''}${o.phq9_delta}`,o.phq9_delta<0?C.low:C.high],['GAD-7',`${o.gad7_delta>0?'+':''}${o.gad7_delta}`,o.gad7_delta<0?C.low:C.high],['Regulation',o.regulation_delta!=null?`+${o.regulation_delta}`:'—',C.low],['Practice',o.practice_days!=null?`${o.practice_days}d/wk`:'—',o.practice_days>=5?C.low:o.practice_days>=3?C.amber:C.muted],['Patterns',o.pattern_returned===false?'Clear':o.pattern_returned===true?'Returned':'—',o.pattern_returned===false?C.low:C.amber]] as [string,string,string][]).map(([l,v,c])=><div key={l} style={{background:C.faint,borderRadius:7,padding:'7px 9px',border:`0.5px solid ${C.border}`}}><div style={{fontSize:9,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:2}}>{l}</div><div style={{fontSize:13,fontWeight:500,color:c}}>{v}</div></div>)}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ALERTS TAB */}
            {tab==='alerts'&&(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {alerts.length===0&&<div style={{fontSize:12,color:C.dim,padding:'20px 0'}}>No active alerts.</div>}
                {[...alerts].filter(a=>a.is_active).sort((a:any,b:any)=>({critical:0,high:1,warning:2,info:3}[a.severity as string]??4)-({critical:0,high:1,warning:2,info:3}[b.severity as string]??4)).map((a:any)=>(
                  <AlertCard key={a.id} alert={a} memberName={memberLookup[a.member_id]?.full_name??''} onAcknowledge={ackAlert} onCreateTask={createTaskFromAlert} taskLinked={!!(a.linked_task_id&&tasks.find((t:any)=>t.id===a.linked_task_id))}/>
                ))}
              </div>
            )}
            {tab==='journeys'&&<JourneyScheduler />}
            {tab==='cohorts'&&<CohortManager />}
            {tab==='sops'&&<SopsPanel />}
          </div>

          {/* SIDEBAR */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Pipeline</div>
              {Object.entries(STAGE_META).sort((a,b)=>a[1].order-b[1].order).map(([stage,meta])=>{const count=members.filter((m:any)=>m.pipeline_stage===stage).length;return <div key={stage} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}><div style={{width:6,height:6,borderRadius:'50%',background:count>0?meta.color:C.dim,flexShrink:0}}/><div style={{flex:1,fontSize:11,color:count>0?C.muted:C.dim}}>{meta.label}</div><span style={{fontSize:11,fontWeight:600,color:count>0?C.text:C.dim,background:count>0?C.surf:'transparent',borderRadius:20,padding:'1px 7px',minWidth:18,textAlign:'center'}}>{count}</span></div>})}
            </div>
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Upcoming Ceremonies</div>
              {upcoming.length===0?<div style={{fontSize:11,color:C.dim}}>None scheduled</div>:upcoming.map((c:any)=>(
                <div key={c.member_id} style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}><Avatar name={c.full_name} size={26}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{c.full_name}</div><div style={{fontSize:10,color:C.muted}}>{c.ceremony_date}</div></div><div style={{fontSize:14,fontWeight:600,color:C.blue,fontFamily:'var(--font-cormorant-garamond,serif)'}}>{c.days_until_ceremony}d</div></div>
              ))}
            </div>
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Scheduling Requests</div>
              <SchedulingRequestQueue />
            </div>
            <div style={{background:C.card,border:`0.5px solid ${overdueFu.length?C.amber+'44':C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Follow-ups{overdueFu.length>0&&<span style={{color:C.amber,marginLeft:5}}>· {overdueFu.length} overdue</span>}</div>
              {overdueFu.length===0?<div style={{fontSize:11,color:C.low}}>All current ✓</div>:overdueFu.map((f:any)=>(
                <div key={`${f.member_id}_${f.timepoint}`} style={{background:C.amberBg,border:`0.5px solid ${C.amber}33`,borderRadius:8,padding:'10px 11px',marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.amber,marginBottom:1}}>{f.full_name}</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:8}}>{f.timepoint?.replace(/_/g,' ')} · {f.days_overdue}d overdue</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                    {!f.task_exists&&<button style={{fontSize:10,color:C.blue,background:'transparent',border:`0.5px solid ${C.blue}55`,borderRadius:6,padding:'3px 9px',cursor:'pointer'}}>Create task</button>}
                    {f.task_exists&&<span style={{fontSize:10,color:C.low,alignSelf:'center'}}>✓ Task exists</span>}
                  </div>
                  <NotifyButton
                    phone={f.contact_phone??null}
                    email={f.email??null}
                    memberName={f.full_name}
                    smsMessage={buildFollowupSMS(f.full_name.split(' ')[0],f.timepoint)}
                    emailSubject={buildFollowupEmailSubject(f.timepoint)}
                    emailBody={buildFollowupEmailBody(f.full_name.split(' ')[0],f.timepoint,f.survey_token?`https://vital-kauai.vercel.app/checkin/${f.survey_token}`:undefined)}
                    memberId={f.member_id}
                    onSent={onNotifySent}
                    small
                  />
                </div>
              ))}
            </div>
            {totalRev>0&&<div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:9}}>Revenue · Cohort</div>
              <div style={{fontSize:24,fontWeight:600,color:C.text,fontFamily:'var(--font-cormorant-garamond,serif)'}}>${totalRev.toLocaleString()}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:2,marginBottom:9}}>{members.length} members · avg ${Math.round(totalRev/members.length).toLocaleString()}</div>
              {totalProfit>0&&<div style={{display:'flex',justifyContent:'space-between',paddingTop:9,borderTop:`0.5px solid ${C.border}`}}><div><div style={{fontSize:9,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:2}}>Net profit</div><div style={{fontSize:15,fontWeight:600,color:C.low}}>${totalProfit.toLocaleString()}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:2}}>Margin</div><div style={{fontSize:15,fontWeight:600,color:C.low}}>{Math.round((totalProfit/totalRev)*100)}%</div></div></div>}
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
