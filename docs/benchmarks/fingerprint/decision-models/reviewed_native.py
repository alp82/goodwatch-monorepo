"""Pure offline contract examples. No HTTP client, credentials or inference entrypoint."""
import json,math,hashlib,re
from core import CONTRACT, KEYS
from pathlib import Path
P=Path(__file__).resolve().parent
STATES={'U_INSUFFICIENT':'unknown_insufficient','U_CONFLICT':'unknown_conflict','U_ID_SCOPE':'unknown_identity_scope','NA':'not_applicable','NOT_ASSESSED':'not_assessed'}
LABELS={f'V{i:02d}':i for i in range(11)}

def unique_json(text):
 def pairs(ps):
  d={}
  for k,v in ps:
   if k in d:raise ValueError('Duplicate JSON key')
   d[k]=v
  return d
 def bad(x):raise ValueError('Nonfinite JSON')
 return json.loads(text,object_pairs_hook=pairs,parse_constant=bad)

def finite(x):return type(x) in (int,float) and math.isfinite(x)

def compile_choice(state,kind,compact=False):
 contract={'field_order':KEYS,'field_definitions':{f['key']:f['definition'] for f in CONTRACT['fields']},'canonical_order_sha256':CONTRACT['field_order_sha256']}
 questions={}
 criteria={**{k:str(v) for k,v in LABELS.items()},'U_INSUFFICIENT':'Insufficient information','U_CONFLICT':'Unresolved conflict','U_ID_SCOPE':'Cannot bind identity or scope','NA':'Demonstrably inapplicable','NOT_ASSESSED':'Not assessed'}
 if compact:
  state=json.loads(json.dumps(state));state['task_contract']['option_meanings']={**LABELS,**{k:criteria[k] for k in STATES}};state['task_contract']['all_question_rule']='Apply this shared task_contract and option_meanings to every question; retain original per-field definitions.'
 for key in contract['field_order']:
  text=f"{key.replace('_',' ')}: {contract['field_definitions'][key]}"
  if not compact:text+=' Judge the whole declared work, not whether the trait is mentioned in the synopsis. Use the shared task_contract for criteria meanings.'
  questions[key]={'type':'choice','instructions':text,'criteria':{k:None for k in criteria} if compact else dict(criteria)}
 if kind=='jev':return {'model':'jev-1.14.0','state':state,'questions':questions}
 if kind=='celeris':return {'model':'celeris-1-decision','input':json.dumps(state,ensure_ascii=False,separators=(',',':')),'questions':[{'name':k,'type':'choice','instructions':q['instructions'],'choices':[({'value':v} if d is None else {'value':v,'description':d}) for v,d in q['criteria'].items()]} for k,q in questions.items()],'x_celeris':{'explain':False}}
 if kind=='openrouter':return {'model':'typesafe/jev-1.14','provider':{'only':['typesafe'],'allow_fallbacks':False},'state':state,'questions':questions}
 raise ValueError('Unsupported adapter')

def normalization_envelope(response,raw_response_bytes=None,custody=None):
 """Join observations, not an execution guard. External custody must name its source.
 Optional provider fields may be absent. Harness must independently verify host/build.
 Exact raw bytes must decode to the same response; object serialization is NOT a raw hash.
 """
 custody=dict(custody or {})
 if custody and not custody.get('source'):raise ValueError('Alternate custody needs a source receipt')
 digest=None
 if raw_response_bytes is not None:
  if not isinstance(raw_response_bytes,bytes) or unique_json(raw_response_bytes)!=response:raise ValueError('Raw response does not match normalized object')
  digest=hashlib.sha256(raw_response_bytes).hexdigest()
 supplied=custody.get('raw_response_sha256')
 if supplied is not None and not re.fullmatch(r'[0-9a-f]{64}',supplied):raise ValueError('Invalid raw hash')
 conflicts=[]
 if digest and supplied and digest!=supplied:conflicts.append('raw_response_sha256')
 joined={}
 for field in ['model','provider','id']:
  a=response.get(field);b=custody.get(field)
  if a is not None and b is not None and a!=b:conflicts.append(field)
  joined[field]=a if a is not None else b
 return {'serving_model':joined['model'],'serving_provider':joined['provider'],'response_id':joined['id'],
  'raw_response_sha256':digest or supplied,'response_reported':{k:response.get(k) for k in ['model','provider','id']},
  'alternate_custody':custody or None,'metadata_conflicts':conflicts,
  'raw_hash_custody':'exact_supplied_bytes' if digest else ('external_receipt' if supplied else 'missing'),
  'serving_model_semantics':'Reported model or alternate identified receipt; response may echo requested slug, not immutable actual build',
  'requested_execution_mode':custody.get('requested_execution_mode'),'observed_execution_mode':custody.get('observed_execution_mode'),'serving_build':custody.get('serving_build'),
  'harness_host_build_guard':'Required downstream; this pure parser neither attests nor authorizes serving identity',
  'eligibility_flags':{'raw_custody_present':bool(digest or supplied),'metadata_conflict_free':not conflicts,
   'provider_identity_observed':joined['provider'] is not None,'host_build_verified_by_this_parser':False,'dispatch_authorized':False}}

def parse_choice(response,kind,allowed_models,*,raw_response_bytes=None,custody=None,expected_keys=None,include_nonordinal_states=True):
 contract={'field_order':KEYS,'field_definitions':{f['key']:f['definition'] for f in CONTRACT['fields']},'canonical_order_sha256':CONTRACT['field_order_sha256']};keys=contract['field_order'] if expected_keys is None else expected_keys
 if response.get('model') not in allowed_models:raise ValueError('Unexpected serving model')
 if kind=='celeris':
  ans=response.get('answers');assert isinstance(ans,list)
  names=[a.get('name') for a in ans]
  if len(names)!=len(set(names)):raise ValueError('Duplicate answer name')
  records={a['name']:a for a in ans}
 else:records=response.get('answers')
 if not isinstance(records,dict) or set(records)!=set(keys):raise ValueError('Missing or extra trait answers')
 result={};labels=set(LABELS)|(set(STATES) if include_nonordinal_states else set())
 for key in keys:
  a=records[key]
  if a.get('type')!='choice' or not isinstance(a.get('choice'),str) or a['choice'] not in labels:raise ValueError('Expected known Choice label')
  raw=a.get('probabilities')
  if kind=='celeris':
   if not isinstance(raw,list):raise ValueError('Expected probability list')
   vals=[v.get('value') for v in raw]
   if len(vals)!=len(set(vals)) or any(not isinstance(v,str) for v in vals):raise ValueError('Duplicate/untyped choice value')
   probs={v['value']:v['probability'] for v in raw};sum_tol=len(labels)*0.005+1e-12;pair_tol=0.01+1e-12
  else:probs=raw;sum_tol=1e-6;pair_tol=1e-12
  if not isinstance(probs,dict) or set(probs)!=labels:raise ValueError('Incomplete or extra probability bank')
  if any(not finite(v) or not 0<=v<=1 for v in probs.values()):raise ValueError('Invalid probability')
  mass=sum(probs.values())
  if abs(mass-1)>sum_tol:raise ValueError('Probability mass outside explicit parser compatibility policy')
  unit=abs(mass-1)<=1e-12
  norm='unit_within_arithmetic_epsilon' if unit else 'nonunit_within_parser_compatibility_budget'
  mismatch=probs[a['choice']]+pair_tol<max(probs.values())
  eligible=unit and not mismatch
  confidence=a.get('confidence')
  if not finite(confidence) or not 0<=confidence<=1:raise ValueError('Invalid provider confidence')
  label=a['choice'];value=LABELS.get(label)
  result[key]={'selected_label':label,'raw_native_value':value,'assessment_state_prediction':'assessed' if label in LABELS else STATES[label],'normalized_value':value,'probabilities':dict(probs),'reported_probability_sum':mass,'provider_confidence':confidence,'probability_semantics':'Category distribution, not semantic confidence or independent source support','selected_not_max_probability':mismatch,'normalization_status':norm,'probabilities_renormalized':False,'mass_rounding_compatibility_budget':sum_tol,'pairwise_selection_rounding_budget':pair_tol,'eligibility_flags':{'distribution_unit_mass':unit,'selection_consistent':not mismatch,'numeric_comparison_eligible':eligible and value is not None},'comparison_value':value if eligible else None,'source_citations':None,'canonical':None}
 complete=all(r['assessment_state_prediction']=='assessed' for r in result.values())
 return {'native_kind':'choice11','numeric_categories':11,'nonordinal_categories':5 if include_nonordinal_states else 0,'compatibility_lane':'strict_v1' if complete else 'partial','contract_order_sha256':contract['canonical_order_sha256'],'scores_in_field_order':[result[k]['normalized_value'] for k in keys],'stored_vector_projection':'Float conversions only if all74 assessed; no L2 normalization; this adapter does not write vectors','records':result,'usage_native':response.get('usage'),'canonical_acceptance':'Unreviewed; raw labels preserved even if unsupported','normalization_envelope':normalization_envelope(response,raw_response_bytes,custody),'eligibility_flags':{'all_numeric_cells_comparison_eligible':all(r['eligibility_flags']['numeric_comparison_eligible'] for r in result.values()),'serving_identity_guard_pending':True,'dispatch_authorized':False},'comparison_scores_in_field_order':[result[k]['comparison_value'] for k in keys]}

def project_score10(a,historical_rounding=False,*,precision_policy=None):
 """Reported and derived means retained independently; never repair one from the other.
 precision_policy may ONLY contain documented rounding half-units plus a source URL.
 Default 1e-12 is floating arithmetic epsilon, NOT provider precision/calibration.
 No precision inferred from example decimal digits. Unknown precision cannot excuse mismatch.
 """
 if a.get('type')!='score' or not finite(a.get('score')) or not 0<=a['score']<=9:raise ValueError('Expected native Score0..9')
 p=a.get('probabilities')
 if 'confidence' in a and (not finite(a['confidence']) or not 0<=a['confidence']<=1):raise ValueError('Invalid provider confidence')
 if not isinstance(p,dict) or set(p)!={str(i) for i in range(10)}:raise ValueError('Expected ten-level distribution')
 if any(not finite(v) or not 0<=v<=1 for v in p.values()):raise ValueError('Invalid score distribution')
 policy=dict(precision_policy or {})
 if policy and not policy.get('source'):raise ValueError('Documented precision requires source')
 if set(policy)-{'source','probability_rounding_half_unit','score_rounding_half_unit'}:raise ValueError('Unknown precision setting')
 ph=policy.get('probability_rounding_half_unit',0);sh=policy.get('score_rounding_half_unit',0)
 if any(not finite(v) or v<0 for v in [ph,sh]):raise ValueError('Invalid documented rounding interval')
 eps=1e-12;mass=math.fsum(p.values());derived=math.fsum(int(k)*v for k,v in p.items());x=a['score']
 if abs(mass-1)>len(p)*ph+eps:raise ValueError('Invalid score probability mass')
 # Interval from documented rounding of individual probabilities only. Conservative;
 # normalization coupling could tighten it, but no probabilities are renormalized.
 lo=math.fsum(int(k)*max(0,v-ph) for k,v in p.items());hi=math.fsum(int(k)*min(1,v+ph) for k,v in p.items())
 consistent=(x+sh+eps>=lo and x-sh-eps<=hi)
 unit=abs(mass-1)<=eps;eligible=consistent and unit
 out={'native_kind':'ordinal10','compatibility_lane':'projected_scale','native_expected_level':x,'distribution_expected_level':derived,
  'reported_mean_projection':10*x/9,'normalized_continuous_value':10*x/9 if eligible else None,
  'projection':'10*x/9 of reported mean only; no silent replacement or rounding; not strict V1',
  'mean_consistency_status':('consistent_with_documented_rounding' if policy else 'consistent_with_arithmetic_epsilon_only') if consistent else 'inconsistent_or_unresolved_precision',
  'mean_difference':x-derived,'documented_precision_policy':policy or None,'arithmetic_epsilon':eps,
  'derived_mean_rounding_interval':[lo,hi],'reported_probability_sum':mass,
  'normalization_status':'unit_within_arithmetic_epsilon' if unit else 'nonunit_within_documented_rounding_budget',
  'probabilities_renormalized':False,'eligibility_flags':{'mean_consistent':consistent,'distribution_unit_mass':unit,'numeric_comparison_eligible':eligible},
  'probabilities':dict(p),'provider_confidence':a.get('confidence'),'raw_native_answer':dict(a),
  'semantic_unknown_supported_by_this_primitive':False,'canonical':None}
 if historical_rounding:out['historical_replication_only']={'value':round(10*x/9),'rule':'Python ties-to-even round; retain even when inconsistent, never comparison-eligible by this field alone'}
 return out

def compile_router_choice(state,model,provider,compact=True):
 """Offline renderer allowlist only; does not establish paid/work-fit admission.
 ScaleDown/Span01 deliberately absent while their state shapes remain unresolved.
 """
 known={'typesafe/jev-1.14':'typesafe','perplexity/pplx-decider-flash-v1.2':'perplexity','respan/span-02':'respan'}
 if known.get(model)!=provider:raise ValueError('Unverified native model/host renderer')
 body=compile_choice(state,'openrouter',compact)
 body['model']=model;body['provider']={'only':[provider],'allow_fallbacks':False}
 return body
