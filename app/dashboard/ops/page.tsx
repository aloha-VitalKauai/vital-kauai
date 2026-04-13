'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/* ── TOKENS ─────────────────────────────────────────────────── */
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
  purple:'#7060B8', purpleBg:'rgba(112,96,184,.13)',
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
  not_medically_cleared:    'Medical clearance pending',
  not_cardiac_cleared:      'Cardiac clearance pending',
  labs_incomplete:          'Labs incomplete',
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

/* ── CEREMONY GATE ───────────────────────────────────────── */
function getCeremonyBlockers(m: any) {
  const blockers: {key:string;label:string;severity:string}[] = []
  if (!m.medical_cleared)     blockers.push({key:'medical', label:'Medical clearance required',  severity:'high'})
  if (!m.cardiac_cleared)     blockers.push({key:'cardiac', label:'Cardiac clearance required',  severity:'critical'})
  if (!m.labs_all_cleared)    blockers.push({key:'labs',    label:'All labs must be approved',   severity:'high'})
  if (!m.all_required_signed) blockers.push({key:'docs',    label:'Required documents unsigned', severity:'medium'})
  return blockers
}

/* ── HELPERS ─────────────────────────────────────────────── */
function pill(color:string, bg:string) {
  return {display:'inline-block' as const,fontSize:10,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase' as const,color,background:bg,padding:'2px 8px',borderRadius:20,border:`0.5px solid ${color}44`}
}
function RiskPill({level}:{level:string}) { const m=RISK_META[level]??RISK_META.low; return <span style={pill(m.color,m.bg)}>{m.label}</span> }
function StagePill({stage}:{stage:string}) { const m=STAGE_META[stage]??{label:stage,color:C.muted}; return <span style={pill(m.color,m.color+'18')}>{m.label}</span> }
function StatusPill({status}:{status:string}) { const m=STATUS_META[status]??STATUS_META.open; return <span style={pill(m.color,m.bg)}>{m.label}</span> }

function Avatar({name,size=36}:{name:string;size?:number}) {
  const cols=[C.terra,C.amber,C.blue,C.purple,C.low]
  const c=cols[name.charCodeAt(0)%cols.length]
  return <div style={{width:size,height:size,borderRadius:'50%',background:c+'2A',border:`1px solid ${c}50`,color:c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.32,fontWeight:600,flexShrink:0}}>{name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
}

function Btn({label,color,onClick,small,icon}:{label:string;color:string;onClick:()=>void;small?:boolean;icon?:string}) {
  return <button onClick={e=>{e.stopPropagation();onClick()}} style={{fontSize:small?9:10,color,background:'transparent',border:`0.5px solid ${color}55`,borderRadius:6,padding:small?'2px 8px':'4px 12px',cursor:'pointer',letterSpacing:'.05em',fontWeight:500,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:3}}>{icon&&<span>{icon}</span>}{label}</button>
}

const INP: React.CSSProperties = {fontSize:11,background:C.faint,border:`0.5px solid ${C.hi}`,borderRadius:6,padding:'5px 9px',color:C.text,width:'100%',outline:'none'}
const LBL: React.CSSProperties = {fontSize:9,color:C.dim,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:4,display:'block'}

const ChartTip = ({active,payload,label}:any) => {
  if(!active||!payload?.length) return null
  return <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:8,padding:'8px 14px'}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>{label}</div>{payload.map((p:any)=><div key={p.dataKey} style={{fontSize:12,color:p.color,fontWeight:500}}>{p.name}: {p.value?.toFixed(1)}</div>)}</div>
}

/* ── CEREMONY GATE COMPONENT ───────────────────────────── */
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
          <div style={{fontSize:10,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8}}>Blockers — must be resolved before ceremony</div>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {blockers.map(b=>(
              <div key={b.key} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:13,color:b.severity==='critical'?C.crit:C.high}}>✗</span>
                <span style={{fontSize:12,color:C.text}}>{b.label}</span>
                <span style={pill(b.severity==='critical'?C.crit:C.high,b.severity==='critical'?C.critBg:C.highBg)}>{b.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── CREATE TASK PANEL ──────────────────────────────────── */
function CreateTaskPanel({members,preselectedMemberId,onSave,onClose}:{
  members:any[];preselectedMemberId:string|null;onSave:(d:any)=>void;onClose:()=>void
}) {
  const [memberId,  setMemberId]  = useState(preselectedMemberId??'')
  const [taskType,  setTaskType]  = useState('guide_outreach')
  const [title,     setTitle]     = useState('')
  const [desc,      setDesc]      = useState('')
  const [priority,  setPriority]  = useState('medium')
  const [owner,     setOwner]     = useState('')
  const [customOwner,setCustomOwner] = useState('')
  const [dueDate,   setDueDate]   = useState('')

  function handleTypeChange(v:string) { setTaskType(v); if(!title) setTitle(TASK_TYPE_LABELS[v]??'') }
  const finalOwner = owner==='custom' ? customOwner : owner

  async function handleSubmit() {
    if(!memberId||!title.trim()) return
    const supabase = createClient()
    const newTask = { member_id:memberId, task_type:taskType, title:title.trim(), description:desc.trim()||null, priority, status:'open', owner_name:finalOwner||null, due_date:dueDate||null, source_view:'manual', source_reason:'manual_creation' }
    const { data: created } = await supabase.from('ops_tasks').insert(newTask).select().single()
    onSave(created ?? { ...newTask, id:'t_'+Date.now(), completed_at:null })
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
        {!preselectedMemberId&&(
          <div style={{gridColumn:'1/-1'}}>
            <span style={LBL}>Member <span style={{color:C.crit}}>*</span></span>
            <select value={memberId} onChange={e=>setMemberId(e.target.value)} style={{...INP,appearance:'none' as any}}>
              <option value=''>Select member…</option>
              {members.map((m:any)=><option key={m.member_id} value={m.member_id}>{m.full_name}</option>)}
            </select>
          </div>
        )}
        <div><span style={LBL}>Task type</span><select value={taskType} onChange={e=>handleTypeChange(e.target.value)} style={{...INP,appearance:'none' as any}}>{TASK_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><span style={LBL}>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)} style={{...INP,appearance:'none' as any,borderColor:PRIORITY_COLORS[priority]+'55',color:PRIORITY_COLORS[priority]}}><option value='critical'>Critical</option><option value='high'>High</option><option value='medium'>Medium</option><option value='low'>Low</option></select></div>
        <div style={{gridColumn:'1/-1'}}><span style={LBL}>Title <span style={{color:C.crit}}>*</span></span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder='What needs to be done?' style={INP}/></div>
        <div><span style={LBL}>Assign to</span><select value={owner} onChange={e=>setOwner(e.target.value)} style={{...INP,appearance:'none' as any}}><option value=''>Unassigned</option>{GUIDES.map(g=><option key={g} value={g}>{g}</option>)}<option value='custom'>Other…</option></select></div>
        <div><span style={LBL}>Due date</span><input type='date' value={dueDate} onChange={e=>setDueDate(e.target.value)} style={INP}/></div>
        {owner==='custom'&&<div style={{gridColumn:'1/-1'}}><span style={LBL}>Assignee name</span><input value={customOwner} onChange={e=>setCustomOwner(e.target.value)} placeholder='Enter name' style={INP}/></div>}
        <div style={{gridColumn:'1/-1'}}><span style={LBL}>Notes (optional)</span><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder='Add context or instructions…' rows={2} style={{...INP,resize:'vertical' as any,fontFamily:'inherit'}}/></div>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <button onClick={handleSubmit} disabled={!memberId||!title.trim()} style={{fontSize:11,color:C.text,background:(!memberId||!title.trim())?C.dim:C.terra,border:'none',borderRadius:8,padding:'7px 18px',cursor:(!memberId||!title.trim())?'not-allowed':'pointer',fontWeight:600,letterSpacing:'.04em'}}>
          Create Task
        </button>
        <Btn label='Cancel' color={C.muted} onClick={onClose}/>
      </div>
    </div>
  )
}

/* ── ASSIGN EDITOR ──────────────────────────────────────── */
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

/* ── ALERT CREATE TASK FORM ─────────────────────────────── */
function AlertCreateTaskForm({alert,memberName,onCreate,onCancel}:{alert:any;memberName:string;onCreate:(d:any)=>void;onCancel:()=>void}) {
  const [taskType,setTaskType]=useState(ALERT_TO_TASK[alert.alert_type]??'guide_outreach')
  const [assignee,setAssignee]=useState('')
  const [dueDate, setDueDate] =useState('')
  return (
    <div onClick={e=>e.stopPropagation()} style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${C.border}`,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:11,color:C.amber,fontWeight:500}}>Create task for {memberName}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <div><span style={LBL}>Task type</span><select value={taskType} onChange={e=>setTaskType(e.target.value)} style={{...INP,appearance:'none' as any}}>{TASK_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><span style={LBL}>Assign to</span><select value={assignee} onChange={e=>setAssignee(e.target.value)} style={{...INP,appearance:'none' as any}}><option value=''>Unassigned</option>{GUIDES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
        <div><span style={LBL}>Due date</span><input type='date' value={dueDate} onChange={e=>setDueDate(e.target.value)} style={INP}/></div>
      </div>
      <div style={{display:'flex',gap:6}}>
        <Btn label='Create Task' color={C.low}   onClick={()=>onCreate({task_type:taskType,owner_name:assignee||null,due_date:dueDate||null})}/>
        <Btn label='Cancel'      color={C.muted} onClick={onCancel}/>
      </div>
    </div>
  )
}

/* ── TASK CARD ──────────────────────────────────────────── */
function TaskCard({task,onStatusChange,onAssign}:{task:any;onStatusChange:(id:string,s:string)=>void;onAssign:(id:string,n:string)=>void}) {
  const [assigning,setAssigning]=useState(false)
  if(task.status==='done'||task.status==='canceled') return null
  const isOverdue=task.due_date&&new Date(task.due_date)<new Date()&&task.status!=='done'
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
          </div>
          {assigning&&<div style={{marginTop:8}}><AssignEditor current={task.owner_name} onSave={n=>{onAssign(task.id,n);setAssigning(false)}} onCancel={()=>setAssigning(false)}/></div>}
        </div>
        <div style={{display:'flex',gap:4,flexShrink:0}}>
          {task.status==='open'        &&<Btn label='→ Start'   color={C.blue}  onClick={()=>onStatusChange(task.id,'in_progress')} small/>}
          {task.status==='in_progress' &&<Btn label='← Reopen' color={C.muted} onClick={()=>onStatusChange(task.id,'open')}        small/>}
          <Btn label='✓ Done' color={C.low} onClick={()=>onStatusChange(task.id,'done')} small/>
        </div>
      </div>
    </div>
  )
}

/* ── ALERT CARD ─────────────────────────────────────────── */
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
            {taskLinked            &&<span style={{fontSize:10,color:C.low,alignSelf:'center'}}>✓ Task exists</span>}
            <Btn label='Acknowledge' color={C.muted} onClick={()=>onAcknowledge(alert.id)} small/>
          </>}
          {alert.acknowledged&&<span style={{fontSize:10,color:C.dim}}>Acknowledged</span>}
        </div>
      </div>
      {showForm&&<AlertCreateTaskForm alert={alert} memberName={memberName} onCreate={d=>{onCreateTask(alert,d);setShowForm(false)}} onCancel={()=>setShowForm(false)}/>}
    </div>
  )
}

/* ── TODAY PANEL ────────────────────────────────────────── */
function TodayPanel({tasks,activity,onStatusChange,onAssign,memberLookup,onNewTask}:{tasks:any[];activity:any[];onStatusChange:(id:string,s:string)=>void;onAssign:(id:string,n:string)=>void;memberLookup:Record<string,any>;onNewTask:()=>void}) {
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
          {activity.map((a,i)=><span key={i} style={{fontSize:11,color:C.muted}}><span style={{color:a.color}}>·</span> {a.text}</span>)}
        </div>
      )}
      {!collapsed&&open.length===0&&<div style={{fontSize:12,color:C.low,padding:'8px 0'}}>✓ No open tasks — you're all clear.</div>}
      {!collapsed&&open.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {open.sort((a:any,b:any)=>['critical','high','medium','low'].indexOf(a.priority)-['critical','high','medium','low'].indexOf(b.priority)).map((t:any,i:number)=>(
            <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:PRIORITY_COLORS[t.priority]+'22',border:`0.5px solid ${PRIORITY_COLORS[t.priority]}55`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:8}}>
                <span style={{fontSize:10,fontWeight:700,color:PRIORITY_COLORS[t.priority]}}>{i+1}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{marginBottom:2,fontSize:11,color:C.muted}}>{memberLookup[t.member_id]?.full_name}</div>
                <TaskCard task={t} onStatusChange={onStatusChange} onAssign={onAssign}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── STAT CARD ──────────────────────────────────────────── */
function StatCard({label,value,sub,accent}:{label:string;value:number|string;sub?:string;accent?:string}) {
  return (
    <div style={{background:C.card,borderRadius:10,border:`0.5px solid ${accent??C.border}`,borderLeft:accent?`2px solid ${accent}`:`0.5px solid ${C.border}`,padding:'12px 16px'}}>
      <div style={{fontSize:9,color:C.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:5}}>{label}</div>
      <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1,fontFamily:'var(--font-cormorant-garamond, serif)'}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.dim,marginTop:3}}>{sub}</div>}
    </div>
  )
}

/* ── PAGE ───────────────────────────────────────────────── */
export default function OpsDashboardPage() {
  const router = useRouter()
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState('pipeline')
  const [expanded,       setExpanded]       = useState<string|null>(null)
  const [expandedSub,    setExpandedSub]    = useState<Record<string,string|null>>({})
  const [riskFilter,     setRiskFilter]     = useState('all')
  const [activity,       setActivity]       = useState<any[]>([])
  const [showCreate,     setShowCreate]     = useState(false)
  const [createForMember,setCreateForMember]= useState<string|null>(null)

  const [tasks,     setTasks]     = useState<any[]>([])
  const [members,   setMembers]   = useState<any[]>([])
  const [riskScores,setRiskScores]= useState<Record<string,any>>({})
  const [alerts,    setAlerts]    = useState<any[]>([])
  const [overdueFu, setOverdueFu] = useState<any[]>([])
  const [outcomes,  setOutcomes]  = useState<Record<string,any>>({})
  const [ceremonies,setCeremonies]= useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [
        { data: td }, { data: md }, { data: rd }, { data: ad },
        { data: od }, { data: outd }, { data: cd },
      ] = await Promise.all([
        supabase.from('ops_tasks').select('*').in('status',['open','in_progress']).order('created_at',{ascending:false}),
        supabase.from('member_pipeline_view').select('*'),
        supabase.from('member_risk_scores').select('*'),
        supabase.from('ops_alerts').select('*').eq('is_active',true).order('created_at',{ascending:false}),
        supabase.from('followup_overdue_view').select('*'),
        supabase.from('member_outcomes_summary_view').select('*'),
        supabase.from('ceremony_schedule_view').select('*').order('ceremony_date'),
      ])
      setTasks(td??[])
      setMembers(md??[])
      const rMap:Record<string,any>={}; for(const r of rd??[]) rMap[r.member_id]=r; setRiskScores(rMap)
      setAlerts(ad??[])
      setOverdueFu(od??[])
      const oMap:Record<string,any>={}; for(const o of outd??[]) oMap[o.member_id]=o; setOutcomes(oMap)
      setCeremonies(cd??[])
      setLoading(false)
    }
    load()
  }, [router])

  /* ── MUTATIONS ──────────────────────────────────────────── */
  const updateTaskStatus = useCallback(async (taskId:string, newStatus:string) => {
    const supabase = createClient()
    const task = tasks.find(t=>t.id===taskId)
    if(!task) return
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status:newStatus,completed_at:newStatus==='done'?new Date().toISOString():null}:t))
    await supabase.from('ops_tasks').update({status:newStatus,completed_at:newStatus==='done'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',taskId)
    if(newStatus==='done') {
      await supabase.from('member_timelines').insert({member_id:task.member_id,event_type:'task_completed',event_title:`Task completed: ${task.title}`,event_detail:`Type: ${TASK_TYPE_LABELS[task.task_type]??task.task_type}`,event_date:new Date().toISOString(),is_system:false,actor_name:task.owner_name??'Guide',source_table:'ops_tasks',source_id:taskId})
    }
    const m=members.find(x=>x.member_id===task.member_id)
    setActivity(prev=>[{text:`${m?.full_name?.split(' ')[0]} · "${task.title.slice(0,28)}" ${newStatus==='done'?'completed':newStatus==='in_progress'?'started':'reopened'}`,color:newStatus==='done'?C.low:newStatus==='in_progress'?C.blue:C.muted,ts:Date.now()},...prev.slice(0,4)])
  },[tasks,members])

  const assignTask = useCallback(async (taskId:string, ownerName:string) => {
    const supabase = createClient()
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,owner_name:ownerName||null}:t))
    await supabase.from('ops_tasks').update({owner_name:ownerName||null,updated_at:new Date().toISOString()}).eq('id',taskId)
    const task=tasks.find(t=>t.id===taskId); const m=members.find(x=>x.member_id===task?.member_id)
    if(ownerName) setActivity(prev=>[{text:`${m?.full_name?.split(' ')[0]} · task assigned to ${ownerName}`,color:C.amber,ts:Date.now()},...prev.slice(0,4)])
  },[tasks,members])

  const saveNewTask = useCallback(async (taskData:any) => {
    setTasks(prev=>[taskData,...prev])
    const m=members.find(x=>x.member_id===taskData.member_id)
    setActivity(prev=>[{text:`New task · ${m?.full_name?.split(' ')[0]} · ${taskData.title.slice(0,30)}`,color:C.terra,ts:Date.now()},...prev.slice(0,4)])
  },[members])

  const createTaskFromAlert = useCallback(async (alert:any, taskData:any) => {
    const supabase = createClient()
    const m=members.find(x=>x.member_id===alert.member_id)
    const newTask={member_id:alert.member_id,task_type:taskData.task_type,title:TASK_TYPE_LABELS[taskData.task_type]??taskData.task_type,priority:alert.severity==='critical'?'critical':alert.severity==='high'?'high':'medium',status:'open',owner_name:taskData.owner_name,due_date:taskData.due_date,source_view:'ops_alerts',source_reason:alert.alert_type}
    const {data:created}=await supabase.from('ops_tasks').insert(newTask).select().single()
    if(created) { setTasks(prev=>[created,...prev]); await supabase.from('ops_alerts').update({source_id:created.id}).eq('id',alert.id); setAlerts(prev=>prev.map(a=>a.id===alert.id?{...a,linked_task_id:created.id}:a)) }
    setActivity(prev=>[{text:`Task created · ${m?.full_name?.split(' ')[0]} · ${TASK_TYPE_LABELS[taskData.task_type]}`,color:C.amber,ts:Date.now()},...prev.slice(0,4)])
  },[members])

  const ackAlert = useCallback(async (id:string) => {
    const supabase = createClient()
    setAlerts(prev=>prev.map(a=>a.id===id?{...a,acknowledged:true}:a))
    await supabase.from('ops_alerts').update({acknowledged:true,acknowledged_at:new Date().toISOString()}).eq('id',id)
    const alert=alerts.find(a=>a.id===id); const m=members.find(x=>x.member_id===alert?.member_id)
    setActivity(prev=>[{text:`Alert acknowledged · ${m?.full_name?.split(' ')[0]??'member'}`,color:C.muted,ts:Date.now()},...prev.slice(0,4)])
  },[alerts,members])

  /* ── DERIVED ────────────────────────────────────────────── */
  const memberLookup = useMemo(()=>{ const m:Record<string,any>={}; for(const x of members) m[x.member_id]=x; return m },[members])
  const memberTasksMap = useMemo(()=>{
    const m:Record<string,any[]>={}
    for(const t of tasks.filter(t=>t.status!=='done'&&t.status!=='canceled')) { if(!m[t.member_id])m[t.member_id]=[]; m[t.member_id].push(t) }
    return m
  },[tasks])

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
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:${C.bg}} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px} button:focus{outline:none} select,input,textarea{background:${C.faint};color:${C.text}} option{background:#1A1613}`}</style>

      {/* OPS HEADER */}
      <div style={{borderBottom:`0.5px solid ${C.border}`,height:46,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Link href='/dashboard' style={{fontSize:11,color:C.muted,textDecoration:'none',letterSpacing:'.06em'}}>← Dashboard</Link>
          <span style={{color:C.dim}}>·</span>
          <span style={{fontSize:10,color:C.dim,letterSpacing:'.12em',textTransform:'uppercase'}}>Command Center</span>
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
            ['Members',             members.length,                     'across all stages',                                                                            null],
            ['Open Tasks',          tasks.filter((t:any)=>t.status!=='done'&&t.status!=='canceled').length, `${tasks.filter((t:any)=>t.priority==='critical'||t.priority==='high').length} high priority`,(critCount||highCount)?C.high:null],
            ['Active Alerts',       critCount+highCount+warnCount,      `${critCount} critical · ${highCount} high`,                                                   critCount?C.crit:highCount?C.high:null],
            ['Upcoming Ceremonies', upcoming.length,                    upcoming[0]?`${upcoming[0].full_name?.split(' ')[0]} · ${upcoming[0].days_until_ceremony}d`:'None scheduled', upcoming.length?C.blue:null],
            ['Overdue Follow-ups',  overdueFu.length,                   overdueFu.length?`${overdueFu[0].full_name?.split(' ')[0]} · ${overdueFu[0].timepoint?.replace(/_/g,' ')}`:'All current', overdueFu.length?C.amber:null],
          ] as [string,number,string,string|null][]).map(([label,value,sub,accent])=>(
            <StatCard key={label} label={label} value={value} sub={sub} accent={accent??undefined}/>
          ))}
        </div>

        {/* GLOBAL CREATE TASK */}
        {showCreate&&!createForMember&&<CreateTaskPanel members={members} preselectedMemberId={null} onSave={saveNewTask} onClose={()=>setShowCreate(false)}/>}

        {/* TODAY */}
        <TodayPanel tasks={tasks} activity={activity} onStatusChange={updateTaskStatus} onAssign={assignTask} memberLookup={memberLookup} onNewTask={()=>{setCreateForMember(null);setShowCreate(true)}}/>

        {/* MAIN GRID */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14}}>
          <div>
            {/* Tabs */}
            <div style={{display:'flex',gap:2,marginBottom:13,background:C.card,borderRadius:9,padding:3,border:`0.5px solid ${C.border}`}}>
              {(['pipeline','risk','outcomes','alerts'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'6px 0',borderRadius:7,border:'none',background:tab===t?C.surf:'transparent',color:tab===t?C.text:C.dim,fontSize:10,fontWeight:500,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',transition:'all .15s',position:'relative'}}>
                  {t}
                  {t==='alerts'&&(critCount+highCount)>0&&<span style={{position:'absolute',top:4,right:8,width:5,height:5,borderRadius:'50%',background:critCount?C.crit:C.high}}/>}
                </button>
              ))}
            </div>

            {/* PIPELINE */}
            {tab==='pipeline'&&sortedMembers.map((m:any)=>{
              const rs=riskScores[m.member_id]??{}
              const rLevel=rs.risk_level??m.risk_level??'low'
              const rFactors:string[]=rs.risk_factors??m.risk_factors??[]
              const mTasks=memberTasksMap[m.member_id]??[]
              const outcome=outcomes[m.member_id]
              const blockers=getCeremonyBlockers(m)
              const open=expanded===m.member_id
              const sub=expandedSub[m.member_id]??null
              const showCreateForThis=createForMember===m.member_id

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
                          ['Medical',   m.medical_cleared?'Cleared':'Pending',               m.medical_cleared?C.low:C.high],
                          ['Cardiac',   m.cardiac_cleared?'Cleared':'Pending',               m.cardiac_cleared?C.low:C.high],
                          ['Labs',      m.labs_all_cleared?'All approved':`${m.total_approved??0}/${m.total_submitted??0} done`,m.labs_all_cleared?C.low:C.amber],
                          ['Agreement', m.all_required_signed?'All signed':'Incomplete',     m.all_required_signed?C.low:C.muted],
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
                          </button>
                        ))}
                      </div>
                      {sub==='tasks'&&(
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {showCreateForThis?(
                            <CreateTaskPanel members={members} preselectedMemberId={m.member_id} onSave={saveNewTask} onClose={()=>setCreateForMember(null)}/>
                          ):(
                            <div style={{marginBottom:6}}><Btn label='+ Add Task for this member' color={C.terra} onClick={()=>{setCreateForMember(m.member_id);setShowCreate(false)}}/></div>
                          )}
                          {mTasks.length===0?<div style={{fontSize:12,color:C.dim,padding:'4px 0'}}>No open tasks.</div>:mTasks.map((t:any)=><TaskCard key={t.id} task={t} onStatusChange={updateTaskStatus} onAssign={assignTask}/>)}
                        </div>
                      )}
                      {sub==='timeline'&&<div style={{fontSize:12,color:C.dim,padding:'8px 0'}}>Timeline events appear as members progress.</div>}
                      {!sub&&m.primary_intention&&<div style={{padding:'9px 12px',background:C.faint,borderRadius:8,border:`0.5px solid ${C.border}`,borderLeft:`2px solid ${C.terra}`}}><div style={{fontSize:9,color:C.dim,letterSpacing:'.09em',textTransform:'uppercase',marginBottom:3}}>Intention</div><div style={{fontSize:12,color:C.muted,fontStyle:'italic'}}>"{m.primary_intention}"</div></div>}
                    </div>
                  )}
                </div>
              )
            })}

            {/* RISK */}
            {tab==='risk'&&(
              <div>
                <div style={{display:'flex',gap:6,marginBottom:13}}>
                  {(['all','critical','high','medium','low'] as const).map(f=>(
                    <button key={f} onClick={()=>setRiskFilter(f)} style={{padding:'4px 12px',borderRadius:20,border:`0.5px solid ${C.border}`,background:riskFilter===f?C.surf:'transparent',color:riskFilter===f?C.text:C.muted,fontSize:10,fontWeight:500,cursor:'pointer',letterSpacing:'.06em',textTransform:'uppercase'}}>{f}</button>
                  ))}
                </div>
                {[...visibleRisk].sort((a:any,b:any)=>(riskScores[b.member_id]?.risk_score??0)-(riskScores[a.member_id]?.risk_score??0)).map((m:any)=>{
                  const rs=riskScores[m.member_id]??{}; const rLevel=rs.risk_level??m.risk_level??'low'
                  const rc=RISK_META[rLevel]??RISK_META.low; const rFactors:string[]=rs.risk_factors??m.risk_factors??[]
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
                      {mTasks.length>0&&<div style={{display:'flex',flexDirection:'column',gap:5,marginTop:rFactors.length?10:0}}>{mTasks.map((t:any)=><TaskCard key={t.id} task={t} onStatusChange={updateTaskStatus} onAssign={assignTask}/>)}</div>}
                      {!rFactors.length&&!mTasks.length&&<div style={{fontSize:11,color:C.low}}>✓ No active flags or open tasks</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* OUTCOMES */}
            {tab==='outcomes'&&(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 18px'}}>
                  <div style={{fontSize:9,color:C.muted,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:14}}>Cohort average · PHQ-9 + GAD-7</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={cohortTrend} margin={{top:4,right:4,left:-22,bottom:0}}>
                      <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={.2}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient><linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={.2}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="label" tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.dim,fontSize:10}} axisLine={false} tickLine={false} domain={[0,25]}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Area type="monotone" dataKey="phq9" name="PHQ-9" stroke={C.blue}   strokeWidth={2} fill="url(#gP)" dot={{fill:C.blue,r:3}}/>
                      <Area type="monotone" dataKey="gad7" name="GAD-7" stroke={C.purple} strokeWidth={2} fill="url(#gG)" dot={{fill:C.purple,r:3}}/>
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
                      {hasData&&<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
                        {([['PHQ-9',`${o.phq9_delta>0?'+':''}${o.phq9_delta}`,o.phq9_delta<0?C.low:C.high],['GAD-7',`${o.gad7_delta>0?'+':''}${o.gad7_delta}`,o.gad7_delta<0?C.low:C.high],['Regulation',o.regulation_delta!=null?`+${o.regulation_delta}`:'—',C.low],['Practice',o.practice_days!=null?`${o.practice_days}d/wk`:'—',o.practice_days>=5?C.low:o.practice_days>=3?C.amber:C.muted],['Patterns',o.pattern_returned===false?'Clear':o.pattern_returned===true?'Returned':'—',o.pattern_returned===false?C.low:C.amber]] as [string,string,string][]).map(([l,v,c])=><div key={l} style={{background:C.faint,borderRadius:7,padding:'7px 9px',border:`0.5px solid ${C.border}`}}><div style={{fontSize:9,color:C.dim,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:2}}>{l}</div><div style={{fontSize:13,fontWeight:500,color:c}}>{v}</div></div>)}
                      </div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ALERTS */}
            {tab==='alerts'&&(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {[...alerts].filter(a=>a.is_active).sort((a:any,b:any)=>({critical:0,high:1,warning:2,info:3}[a.severity as string]??4)-({critical:0,high:1,warning:2,info:3}[b.severity as string]??4)).map((a:any)=>(
                  <AlertCard key={a.id} alert={a} memberName={memberLookup[a.member_id]?.full_name??''} onAcknowledge={ackAlert} onCreateTask={createTaskFromAlert} taskLinked={!!(a.linked_task_id&&tasks.find((t:any)=>t.id===a.linked_task_id))}/>
                ))}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Pipeline</div>
              {Object.entries(STAGE_META).sort((a,b)=>a[1].order-b[1].order).map(([stage,meta])=>{
                const count=members.filter((m:any)=>m.pipeline_stage===stage).length
                return <div key={stage} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}><div style={{width:6,height:6,borderRadius:'50%',background:count>0?meta.color:C.dim,flexShrink:0}}/><div style={{flex:1,fontSize:11,color:count>0?C.muted:C.dim}}>{meta.label}</div><span style={{fontSize:11,fontWeight:600,color:count>0?C.text:C.dim,background:count>0?C.surf:'transparent',borderRadius:20,padding:'1px 7px',minWidth:18,textAlign:'center'}}>{count}</span></div>
              })}
            </div>
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Upcoming Ceremonies</div>
              {upcoming.length===0?<div style={{fontSize:11,color:C.dim}}>None scheduled</div>:upcoming.map((c:any)=>(
                <div key={c.member_id} style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}><Avatar name={c.full_name} size={26}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{c.full_name}</div><div style={{fontSize:10,color:C.muted}}>{c.ceremony_date}</div></div><div style={{fontSize:14,fontWeight:600,color:C.blue,fontFamily:'var(--font-cormorant-garamond,serif)'}}>{c.days_until_ceremony}d</div></div>
              ))}
            </div>
            <div style={{background:C.card,border:`0.5px solid ${overdueFu.length?C.amber+'44':C.border}`,borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:C.dim,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:11}}>Follow-ups{overdueFu.length>0&&<span style={{color:C.amber,marginLeft:5}}>· {overdueFu.length} overdue</span>}</div>
              {overdueFu.length===0?<div style={{fontSize:11,color:C.low}}>All current ✓</div>:overdueFu.map((f:any)=>(
                <div key={`${f.member_id}_${f.timepoint}`} style={{background:C.amberBg,border:`0.5px solid ${C.amber}33`,borderRadius:8,padding:'10px 11px',marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.amber,marginBottom:1}}>{f.full_name}</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:8}}>{f.timepoint?.replace(/_/g,' ')} · {f.days_overdue}d overdue</div>
                  <div style={{display:'flex',gap:5}}><button style={{fontSize:10,color:C.amber,background:'transparent',border:`0.5px solid ${C.amber}55`,borderRadius:6,padding:'3px 9px',cursor:'pointer'}}>Send reminder</button>{!f.task_exists&&<button style={{fontSize:10,color:C.blue,background:'transparent',border:`0.5px solid ${C.blue}55`,borderRadius:6,padding:'3px 9px',cursor:'pointer'}}>Create task</button>}{f.task_exists&&<span style={{fontSize:10,color:C.low,alignSelf:'center'}}>✓ Task exists</span>}</div>
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
