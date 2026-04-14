export type StepType =
  | 'intro' | 'intention' | 'phq9' | 'gad7' | 'qol' | 'sleep'
  | 'stabilisation' | 'overall_change' | 'patterns' | 'functioning'
  | 'narrative' | 'addiction' | 'ptsd' | 'safety' | 'review';

export interface StepConfig {
  id:           string;
  type:         StepType;
  title:        string;
  required:     string[];
  fields:       string[];
  conditional?: 'track_addiction' | 'track_ptsd' | 'track_pain' | 'track_motor'
              | 'track_cognitive' | 'track_chronic_illness' | 'track_autism_regulation';
}

const PHQ9_FIELDS    = ['phq9_q1','phq9_q2','phq9_q3','phq9_q4','phq9_q5','phq9_q6','phq9_q7','phq9_q8','phq9_q9','phq9_total','phq9_severity'];
const PHQ9_REQUIRED  = ['phq9_q1','phq9_q2','phq9_q3','phq9_q4','phq9_q5','phq9_q6','phq9_q7','phq9_q8','phq9_q9','phq9_total'];

const GAD7_FIELDS    = ['gad7_q1','gad7_q2','gad7_q3','gad7_q4','gad7_q5','gad7_q6','gad7_q7','gad7_total','gad7_severity'];
const GAD7_REQUIRED  = ['gad7_q1','gad7_q2','gad7_q3','gad7_q4','gad7_q5','gad7_q6','gad7_q7','gad7_total'];

const QOL_FIELDS     = ['qol_cheerful','qol_calm','qol_active','qol_fresh','qol_interesting','qol_total'];
const QOL_REQUIRED   = [...QOL_FIELDS];

const SLEEP_FIELDS   = ['sleep_quality','sleep_hours_avg','sleep_latency_min'];
const PATTERN_FIELDS = ['pattern_return_level','pattern_intensity','response_to_returned_patterns_score','practice_days'];
const FUNCTIONING_FIELDS = ['functioning_score','emotional_intensity_score','support_score'];
const ADDICTION_FIELDS = ['craving_intensity','days_abstinent','relapse_occurred','relapse_date','relapse_substance','primary_substance','used_target_substance','used_target_substance_frequency','days_used_past_30','audit_total','dast10_total'];
const ADDICTION_REQUIRED = ['craving_intensity','days_abstinent'];
const PTSD_FIELDS    = ['pcl5_total','pcl5_severity'];
const SAFETY_FIELDS  = ['adverse_event_flag','adverse_event_member_report','support_needed_now'];

const introStep   = (): StepConfig => ({ id:'intro',   type:'intro',   title:'Before you begin', required:[], fields:[] });
const reviewStep  = (): StepConfig => ({ id:'review',  type:'review',  title:'Review',           required:[], fields:[] });
const sleepStep   = (): StepConfig => ({ id:'sleep',   type:'sleep',   title:'Sleep',            required:[], fields:SLEEP_FIELDS });
const safetyStep  = (): StepConfig => ({ id:'safety',  type:'safety',  title:'Wellbeing check',  required:[], fields:SAFETY_FIELDS });
const addictionStep = (): StepConfig => ({ id:'addiction', type:'addiction', title:'Substance use', conditional:'track_addiction', required:ADDICTION_REQUIRED, fields:ADDICTION_FIELDS });
const ptsdStep = (): StepConfig => ({ id:'ptsd', type:'ptsd', title:'Trauma & stress', conditional:'track_ptsd', required:[], fields:PTSD_FIELDS });

function fullBatterySteps(opts: { functioningRequired: boolean; narrativeFields: string[] }): StepConfig[] {
  return [
    introStep(),
    { id:'phq9',     type:'phq9',          title:"How you've been feeling", required:PHQ9_REQUIRED,  fields:PHQ9_FIELDS },
    { id:'gad7',     type:'gad7',          title:'Anxiety',                 required:GAD7_REQUIRED,  fields:GAD7_FIELDS },
    { id:'qol',      type:'qol',           title:'Wellbeing',               required:QOL_REQUIRED,   fields:QOL_FIELDS },
    sleepStep(),
    { id:'overall',  type:'overall_change',title:'Overall change',          required:['overall_change'], fields:['overall_change'] },
    { id:'patterns', type:'patterns',      title:'Patterns & practice',     required:[], fields:PATTERN_FIELDS },
    { id:'functioning', type:'functioning', title:'Functioning', required: opts.functioningRequired ? ['functioning_score'] : [], fields:FUNCTIONING_FIELDS },
    ...(opts.narrativeFields.length ? [{ id:'narrative', type:'narrative' as StepType, title:'Reflection', required:opts.narrativeFields, fields:['what_has_lasted','year_reflection'] }] : []),
    addictionStep(),
    ptsdStep(),
    safetyStep(),
    reviewStep(),
  ];
}

export const SURVEY_CONFIG: Record<string, StepConfig[]> = {
  baseline: [
    introStep(),
    { id:'intention', type:'intention', title:'Your intention', required:['primary_intention'], fields:['primary_intention','top_symptom_1','top_symptom_2','top_symptom_3','subjective_experience'] },
    { id:'phq9',  type:'phq9',  title:"How you've been feeling", required:PHQ9_REQUIRED,  fields:PHQ9_FIELDS },
    { id:'gad7',  type:'gad7',  title:'Anxiety',                 required:GAD7_REQUIRED,  fields:GAD7_FIELDS },
    { id:'qol',   type:'qol',   title:'Wellbeing',               required:QOL_REQUIRED,   fields:QOL_FIELDS },
    sleepStep(),
    addictionStep(),
    ptsdStep(),
    safetyStep(),
    reviewStep(),
  ],
  post_72h: [
    introStep(),
    { id:'stabilisation', type:'stabilisation', title:"How you're landing", required:['overall_change','regulation_score','emotional_intensity_score'], fields:['overall_change','regulation_score','emotional_intensity_score'] },
    sleepStep(),
    safetyStep(),
    reviewStep(),
  ],
  post_1m:  fullBatterySteps({ functioningRequired: false, narrativeFields: [] }),
  post_3m:  fullBatterySteps({ functioningRequired: true,  narrativeFields: [] }),
  post_6m:  fullBatterySteps({ functioningRequired: true,  narrativeFields: ['what_has_lasted'] }),
  post_12m: fullBatterySteps({ functioningRequired: true,  narrativeFields: ['what_has_lasted','year_reflection'] }),
};
