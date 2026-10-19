"""Offline prepared-input ingestion and documentary affordability. Never queries a service."""
from decimal import Decimal
from pathlib import Path
from core import KEYS, CONTRACT, SCHEMA_HASH, identity, state, vector, unique_json, digest, wire
from session import private_dir, save, save_raw, money


def catalog_inputs(packet,out):
    root=Path(packet);out=private_dir(out);raw=(root/'input-manifest.json').read_bytes();m=unique_json(raw)
    if m['field_order_sha256']!=CONTRACT['field_order_sha256'] or m['schema_sha256']!=SCHEMA_HASH:raise ValueError('comparator_contract_mismatch')
    baselines=unique_json((root/'baselines.json').read_bytes());synopses=unique_json((root/'synopsis-inputs.json').read_bytes());views=[];receipt=[]
    all_ids=[]
    for item in m['all_inputs']:
        p=(root/item['file']).resolve()
        if not p.is_relative_to(root.resolve()):raise ValueError('input_path_escape')
        data=p.read_bytes()
        if digest(data)!=item['sha256']:raise ValueError('input_source_hash')
        t=unique_json(data)
        if set(t)!=set(state(t)) or identity(t)!=item['identity'] or wire(state(t))!=data:raise ValueError('model_view_identity_or_bytes')
        key=f"{t['media_type']}:{t['tmdb_id']}"
        if key!=item['id'] or key in all_ids:raise ValueError('input_id_duplicate')
        all_ids.append(key);views.append(t)
        base=next(b for b in baselines if b['identity']==identity(t))
        if base['schema_sha256']!=SCHEMA_HASH or vector(base['native'])!=vector(base['mapped']):raise ValueError('baseline_not_raw74')
        synopsis=next(s for s in synopses if identity(s)==identity(t))
        if state(synopsis)!=t:raise ValueError('synopsis_input_mismatch')
        receipt.append({'identity':identity(t),'model_input_source_sha256':digest(data),'source_file':item['file'],'synopsis_source':item['synopsis_source'],'baseline_reference':item['baseline_reference']})
    if len(views)!=len(baselines) or len(views)!=len(synopses):raise ValueError('prepared_input_count')
    ids=m['recommended_initial_ids'];trio=[next(t for t in views if f"{t['media_type']}:{t['tmdb_id']}"==i) for i in ids]
    save(out/'all-model-inputs.json',views,exclusive=True);save(out/'screen-model-inputs.json',trio,exclusive=True)
    save_raw(out/'baselines.json',(root/'baselines.json').read_bytes())
    save(out/'input-receipt.json',{'source_kind':'existing_catalog_comparators_not_gold','source_hashes':{n:digest((root/n).read_bytes()) for n in ['input-manifest.json','baselines.json','synopsis-inputs.json']},'inputs':receipt,'selected_ids':ids,'producer_prompt_model_generation_scope':'unknown; no causal quality claim','no_network':True},exclusive=True)
    return {'all_titles':len(views),'screen_titles':len(trio),'model_visible_baseline_scores':False,'network':0}


def matrix(manifest):
    """Planning coverage only. Does not admit, reserve, reorder, skip or dispatch."""
    m=manifest;o=m['opening_accounting'];opening=money(o['cash_usd'])+sum(map(money,o['pending'].values()),Decimal(0))
    capacity=min(money(m['new_run_budget_usd']),money(m['title_limit_usd'])-opening,money(m['total_limit_usd'])-opening)
    prefix=Decimal(0);prefix_open=True;prefix_n=0;rows=[];sum_known=Decimal(0)
    for cell in m['cells']:
        c=next(c for c in m['candidates'] if c['id']==cell['candidate_id']);b=cell['full_cost_bound_usd'];bound=money(b) if b is not None else None
        if bound is not None:sum_known+=bound
        fits=bound is not None and bound<=capacity
        if prefix_open and bound is not None and prefix+bound<=capacity:prefix+=bound;prefix_n+=1
        else:prefix_open=False
        rows.append(dict(cell,identity=identity(m['titles'][cell['title_index']]),model=c['model'],provider=c.get('provider'),adapter=c['adapter'],state_renderer=c.get('state_renderer','shared-json-v1'),internal_work={'documentary_full_vector':c.get('internal_work',{'actual_provider_subrequests':None,'native_scoring_groups_or_passes':None,'billed_aggregation':'unverified'}),'explicit_questions_this_POST':len(cell['expected_keys']),'DREX_chunk_pass_ceiling':len(cell['expected_keys']) if c.get('family_group')=='nace-ai' else None},individually_within_current_cash_ceiling=fits,documentary_bound_only=True,admission_status=c['admission_status'],enabled=c.get('enabled',False),input_cap=c['input_cap'],proposed_input_exception=c.get('proposed_billed_input_ceiling'),scientific_lane=c.get('scientific_lane'),actual_external_attempts=0,completed_vectors=0))
    return {'status':'UNAPPROVED_OFFLINE_STATIC_MATRIX','reservation_policy':'rolling-next-post-v1','planned_external_POSTs':len(rows),'planned_vectors':len(m['titles'])*len(m['candidates']),'documentary_bounded_POSTs':sum(r['full_cost_bound_usd'] is not None for r in rows),'sum_documentary_bounds_usd':str(sum_known),'sum_complete':all(r['full_cost_bound_usd'] is not None for r in rows),'current_capacity_usd':str(capacity),'worst_case_affordable_fixed_prefix_POSTs':prefix_n,'prefix_bound_usd':str(prefix),'individually_affordable_POSTs':sum(r['individually_within_current_cash_ceiling'] for r in rows),'admitted_POSTs':0,'completed_POSTs':0,'completed_vectors':0,'opening_cash_usd':o['cash_usd'],'carried_pending':o['pending'],'new_actual_reservations_usd':'0','not_full_grid_guarantee':True,'rows':rows}
