"""Disabled offline queue from reviewed, sealed provider inputs. No route admission."""
from pathlib import Path
from core import CONTRACT, KEYS, digest, unique_json, wire
from native_routes import ENDPOINTS, NUMERIC, STATES


def load(packet,breadth=None):
    packet=Path(packet)
    source=unique_json((packet/'candidate-inventory.json').read_bytes());plan=unique_json((packet/'screening-plan.json').read_bytes());contract=unique_json((packet/'v1-score-contract.json').read_bytes())
    # The original packet/parser is not eligible as an integration source.
    if unique_json((packet/'finite-ceilings.json').read_bytes()).get('version')!='review-v2' or not (packet/'corrections-and-handoff.md').exists():raise ValueError('corrected_review_v2_required')
    if contract['field_order']!=KEYS or contract['canonical_order_sha256']!=CONTRACT['field_order_sha256']:raise ValueError('provider_field_order_mismatch')
    if contract['field_definitions']!={f['key']:f['definition'] for f in CONTRACT['fields']}:raise ValueError('provider_definitions_mismatch')
    bounds={r['candidate_id']:r for r in unique_json((packet/'finite-ceilings.json').read_bytes())['rows']}
    extra=unique_json(Path(breadth).read_bytes()) if breadth else {'candidates':[]}
    extra={(r['model'],r['host']):r for r in extra['candidates']}
    allrows={r['id']:r for r in source['candidates']};configured=[];unsupported=[]
    for q in plan['queue']:
        row=allrows[q['candidate_id']];a=row['task_interface']['adapter']
        if a not in ENDPOINTS:
            unsupported.append({'id':row['id'],'adapter':a,'endpoint':row['task_interface'].get('endpoint'),'status':'REGISTERED_DESCRIPTOR_DISABLED_NO_VERIFIED_RESPONSE_CONTRACT','reason':'No reviewed callable response contract; no inferred fallback.'});continue
        limits=row.get('limits',{});batches=q.get('request_batches_if_known');b=extra.get((row['request_model'],q.get('provider_only')))
        if b:
            batches=b['proposed_chunks'];hostlimits=b['question_option_limits']
        else:hostlimits={}
        cfg={'id':row['id'],'family_group':row['family_group'],'adapter':a,'model':row['request_model'],'provider':q.get('provider_only'),'endpoint':row['task_interface']['endpoint'],'enabled':False,'admission_status':'UNVERIFIED','native_kind':'choice11','compatibility_lane':'strict_v1','option_bank':'choice16_states','mapping':{'kind':'choice_labels','labels':dict(NUMERIC,**{s:None for s in STATES})},'request_batches':batches or [74],'batch_count_status':'DOCUMENTED_PREPARATION' if batches else 'HYPOTHETICAL_74_REQUEST_HOST_FIT_UNVERIFIED','actual_subcalls':None,'internal_passes':q.get('internal_passes'),'full_cost_bound_usd':None,'input_cap':16000,'input_bound_tokens':None,'input_bound_proof_status':'UNVERIFIED','max_choice_options':hostlimits.get('choice_options_max',limits.get('max_choice_options',limits.get('choice_options'))),'max_questions':hostlimits.get('questions_max',limits.get('max_questions',limits.get('max_questions_explain_off'))),'native_priceguard_supported':False,'allowed_returned_models':[],'allowed_returned_providers':[],'price_and_usage_admission':'UNVERIFIED','provider_record_sha256':digest(wire(row)),'version_identity':row.get('version_identity'),'source_interface':row['task_interface'],'preparation_not_lineup':True}
        if cfg['endpoint']!=ENDPOINTS[a]:raise ValueError('provider_endpoint_mismatch')
        documentary=bounds.get(row['id'])
        if documentary:
            cfg['documentary_bound_proposal']=documentary;cfg['full_cost_bound_usd']=documentary['cash_ceiling_usd']
            cfg['proposed_billed_input_ceiling']=documentary['billed_input_ceiling_tokens']
            cfg['internal_work']={'actual_provider_subrequests':None,'native_scoring_groups_or_passes':None,'billed_aggregation':documentary['aggregation'],'upper_bound_groups':documentary.get('internal_groups_upper_bound'),'question_prompts':documentary.get('billed_question_prompts')}
        if b:
            cfg['breadth_qualification']=b;cfg['full_cost_bound_usd']=b['candidate_cash_ceiling_usd'];cfg['proposed_billed_input_ceiling']=b['billed_input_ceiling_tokens']
            cfg['internal_work']={'actual_provider_subrequests':None,'native_scoring_groups_or_passes':None,'internal_call_count':b.get('internal_model_calls'),'internal_pass_ceiling':b.get('internal_pass_ceiling'),'billed_aggregation':b['billed_aggregation']}
            if b.get('per_chunk_ceiling_usd'):cfg['request_cost_bounds_usd']=[format(__import__('decimal').Decimal(v),'.9f') for v in b['per_chunk_ceiling_usd']]
        if row['family_group']=='scaledown':cfg['state_renderer']='scaledown-text-v1'
        if row['family_group']=='perplexity':cfg['scientific_lane']='adaptive-host-grouped-exploratory; grouping unknown unless supplied telemetry; no singleton substitution'
        if row['family_group']=='respan':cfg['scientific_lane']='hosted Span02; question cap/truncation/upstream-default thought mode unverified'
        if len(cfg['request_batches'])>1 and 'request_cost_bounds_usd' not in cfg:cfg['request_cost_bounds_usd']=[None]*len(cfg['request_batches'])
        cfg['requires_new_route_input_exception']=bool(cfg.get('proposed_billed_input_ceiling',0) and cfg['proposed_billed_input_ceiling']>16000)
        cfg['total_output_cap']=8192
        configured.append(cfg)
    names=['candidate-inventory.json','screening-plan.json','adapter-contracts.json','v1-score-contract.json','native_contract.py','corrections-and-handoff.md','finite-ceilings.json','bounds-addon.md']
    receipt={'source_version':'native-challenger-prep/versions/review-v2','source_counts':source['counts'],'queue_count':len(plan['queue']),'renderable_configurations':len(configured),'unsupported_descriptors':unsupported,'source_hashes':{n:digest((packet/n).read_bytes()) for n in names},'breadth_sha256':digest(Path(breadth).read_bytes()) if breadth else None,'prompt_difference':'Harness shared policy/evidence, not byte-identical provider compact sizing recipe; field meanings/order match.','launch_authorized':False,'admitted_routes':0}
    return configured,receipt
