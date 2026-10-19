"""Proposed six-route runtime mechanics. No import-time network/auth/admission."""
import copy
import re
import time
from pathlib import Path
from urllib.parse import urlencode
from core import unique_json, digest, wire
import transport
from session import Stop, money, save, private_dir, atomic

CONTRACT=unique_json((Path(__file__).parent/'six-route-contracts.json').read_bytes())
ROUTES={r['candidate_id']:r for r in CONTRACT['routes']}
SHAPE=unique_json((Path(__file__).parent/'generation-metadata-shape.json').read_bytes())
POLICY={'status':'PROPOSED_UNAPPROVED','max_exact_ID_GETs_per_POST':3,'retry_only_http_status':[404],'monotonic_start_offsets_seconds':[0,2,5],'serial_no_overlap_or_catchup_duplicates':True,'restart_counter_persisted':True,'new_inference_during_join':False,'inference_retries':0,'public_endpoint_GETs_per_dispatch':6,'key_allowance_GETs_per_dispatch':1,'max_public_endpoint_GETs_for_screen':126,'max_account_allowance_GETs_for_screen':21,'max_generation_GETs_for_screen':63,'posthoc_native_output_threshold':8192,'provider_enforced_output_cap':False}


class MetadataShapeError(Exception):
    def __init__(self,codes):self.codes=codes


def validate_generation_shape(observed):
    data=observed.get('data') if isinstance(observed,dict) else None
    if not isinstance(data,dict):raise MetadataShapeError(['metadata_data_shape'])
    errors=[]
    def matches(v,types):
        types=[types] if isinstance(types,str) else types
        return any((t=='null' and v is None) or (t=='string' and isinstance(v,str)) or (t=='boolean' and type(v) is bool) or (t=='integer' and type(v) is int) or (t=='number' and type(v) in (int,float) and __import__('math').isfinite(v)) or (t=='array' and isinstance(v,list)) or (t=='object' and isinstance(v,dict)) for t in types or [])
    for key in SHAPE['generation_required']:
        if key not in data:errors.append('metadata_missing:'+key)
    for key,spec in SHAPE['generation_properties'].items():
        if key in data and (not matches(data[key],spec.get('type')) or ('enum' in spec and data[key] not in spec['enum'])):errors.append('metadata_type:'+key)
    if isinstance(data.get('provider_responses'),list):
        spec=SHAPE['provider_response_item']
        for r in data['provider_responses']:
            if not isinstance(r,dict) or any(k not in r for k in spec['required']):errors.append('metadata_provider_response_shape');continue
            for k,v in spec['properties'].items():
                if k in r and not matches(r[k],v.get('type')):errors.append('metadata_provider_response_type:'+k)
    if errors:raise MetadataShapeError(errors)


def public_preflight(public_get):
    """Six exact public reads, fresh per one-POST launch, no credentials."""
    observations=[]
    for r in ROUTES.values():
        path='models/'+r['model']+'/endpoints';obj=public_get(path);data=obj.get('data',{})
        if data.get('id')!=r['model'] or not isinstance(data.get('endpoints'),list):raise Stop('catalog_model_or_shape')
        tag=r['provider_tag'];matches=[e for e in data['endpoints'] if e.get('tag')==tag or ('/' not in tag and str(e.get('tag','')).startswith(tag+'/'))]
        # Extra variants are drift, never silently eligible under a base routing tag.
        if len(matches)!=1:raise Stop('catalog_endpoint_set_changed')
        e=matches[0];p=e.get('pricing',{})
        if e.get('tag')!=tag or e.get('provider_name')!=r['provider_display_name'] or e.get('model_id')!=r['model'] or e.get('name')!=r['provider_display_name']+' | '+r['advertised_dated_slug'] or e.get('context_length')!=r['context_tokens'] or e.get('max_prompt_tokens')!=r['max_prompt_tokens_metadata'] or (type(e.get('status')) is not int or e['status']!=0):raise Stop('catalog_host_context_build_changed')
        if money(p.get('prompt'))*1000000!=money(r['documented_max_price_proposal']['prompt']) or money(p.get('completion'))!=0 or any(money(p[k])!=0 for k in ('request','web_search','internal_reasoning') if k in p):raise Stop('catalog_tariff_changed')
        observations.append({'model':r['model'],'provider_tag':tag,'observed_endpoint':{k:e.get(k) for k in ('name','tag','provider_name','context_length','max_prompt_tokens','pricing','status')},'public_response_object_sha256':digest(wire(obj)),'origin':'fresh unauthenticated endpoint response; exact transport bytes retained separately','build_status':'advertised_only; no immutable weight proof'})
    return observations


def validate_candidate(c):
    r=ROUTES.get(c.get('route_contract_id'))
    if not r or c['id']!=r['candidate_id'] or c['model']!=r['model'] or c['provider']!=r['provider_tag'] or c.get('max_price')!=r['documented_max_price_proposal'] or c.get('native_guard_mode')!='documented-server-price-filter-v1':raise Stop('native_route_contract_binding')
    return r


def metadata_join(raw,c,bound,lookup,artifact,*,sleep=time.sleep,clock=time.monotonic,context=None):
    """At most three exact-ID reads; only404 repeats. No reconciliation or repair."""
    r=validate_candidate(c);errors=[];events=[];meta=None
    native=raw.get('usage') if isinstance(raw.get('usage'),dict) else {}
    out={'body_reported_model':raw.get('model'),'body_reported_provider':raw.get('provider'),'native_usage_literal':copy.deepcopy(native),'requested_provider_tag':r['provider_tag'],'catalog_advertised_dated_model':r['advertised_dated_slug'],'alias_mapping_source_sha256':CONTRACT['source_matrix_sha256'],'native_work_profile':r['native_work'],'immutable_weights_verified':False,'independent_region_attestation':None,'requested_region_policy':r['provider_tag'],'metadata_policy':POLICY,'events':events,'binding_conflicts':errors,'canonical_acceptance':False,'attempt_binding':context or {}}
    body_shape=SHAPE['native_response']
    for k in body_shape['required']:
        if k not in raw:errors.append('native_schema_missing:'+k)
    for k in ('model','id','provider'):
        if k in raw and not isinstance(raw[k],str):errors.append('native_schema_type:'+k)
    if not isinstance(raw.get('answers'),dict) or not isinstance(raw.get('usage'),dict):errors.append('native_schema_answers_or_usage')
    if 'cost' in native and (type(native['cost']) not in (int,float) or not __import__('math').isfinite(native['cost'])):errors.append('native_schema_type:usage.cost')
    gid=raw.get('id');allowed={r['model'],r['advertised_dated_slug']};providers={r['provider_tag'],r['provider_display_name']}
    if raw.get('model') not in allowed:errors.append('body_model_identity')
    if raw.get('provider') is not None and raw['provider'] not in providers:errors.append('body_provider_identity')
    if not isinstance(gid,str) or len(gid)>128 or not re.fullmatch('gen-[0-9A-Za-z-]+',gid):errors.append('generation_id_missing_or_invalid')
    if lookup is None:errors.append('metadata_lookup_unavailable')
    read_state=artifact/'metadata-read-state.json'
    if not errors:
        binding={'generation_id':gid,'request_sha256':(context or {}).get('request_sha256'),'manifest_sha256':(context or {}).get('manifest_sha256')}
        if read_state.exists():
            state=unique_json(read_state.read_bytes())
            if state.get('binding')!=binding:errors.append('metadata_restart_binding_conflict')
            else:errors.append('metadata_restart_paused_no_automatic_reads')
            out['persisted_metadata_attempts']=state.get('attempted_GETs')
        else:
            state={'binding':binding,'attempted_GETs':0,'events':[],'state':'created','start_monotonic':clock()};save(read_state,state,exclusive=True)
            for i in range(3):
                remaining=POLICY['monotonic_start_offsets_seconds'][i]-(clock()-state['start_monotonic'])
                if remaining>0:sleep(remaining)
                # Persist intent before request. Crash/timeout never resets this count.
                state['attempted_GETs']+=1;state['state']='GET_inflight_or_ambiguous';atomic(read_state,state)
                try:
                    observed=lookup('generation?'+urlencode({'id':gid}),artifact,i)
                    selected=transport.generation_fields(observed)
                    save(artifact/('generation-'+str(i)+'.selected.json'),selected,exclusive=True)
                    event={'attempt':i+1,'http_status':200,'selected_receipt_sha256':digest((artifact/('generation-'+str(i)+'.selected.json')).read_bytes())}
                    events.append(event);state['events'].append(event)
                    validate_generation_shape(observed)
                    meta=selected;state['state']='success_pending_identity_cost_guards';atomic(read_state,state);break
                except MetadataShapeError as e:
                    errors+=e.codes;state['state']='paused_malformed_metadata';atomic(read_state,state);break
                except transport.TransportFailure as e:
                    event={'attempt':i+1,'diagnostic':e.note};events.append(event);state['events'].append(event)
                    repeat=e.note.get('http_status')==404 and e.note.get('category')=='http_rejection' and i<2
                    state['state']='404_wait' if repeat else 'paused_metadata_failure';atomic(read_state,state)
                    if repeat:continue
                    errors.append('generation_metadata_unresolved');break
                except Exception:
                    errors.append('generation_metadata_local_failure');state['state']='paused_metadata_local_failure';atomic(read_state,state);break
    if meta is not None:
        out['metadata_literal']=meta;out['metadata_id']=meta.get('id');out['metadata_api_type']=meta.get('api_type')
        if meta.get('id')!=gid:errors.append('metadata_id_conflict')
        if meta.get('model') not in allowed:errors.append('metadata_model_conflict')
        if meta.get('provider_name')!=r['provider_display_name']:errors.append('metadata_provider_conflict')
        if meta.get('api_type') not in (None,'decisions'):errors.append('metadata_api_type_conflict')
        if meta.get('is_byok') is True or meta.get('cancelled') is True or any(meta.get(k) not in (None,0) for k in ('num_fetches','num_search_results')):errors.append('unexpected_charge_or_service_basis')
        prs=meta.get('provider_responses')
        if prs is not None:
            if not isinstance(prs,list) or len(prs)>1:errors.append('unexpected_provider_attempts')
            else:
                for p in prs:
                    if not isinstance(p,dict) or p.get('provider_name') not in (None,r['provider_display_name']) or p.get('model_permaslug') not in (None,*allowed) or p.get('is_byok') is True or (p.get('status') is not None and (type(p['status']) is not int or not 200<=p['status']<300)):errors.append('provider_attempt_conflict')
        for body_key,meta_key in [('input_tokens','native_tokens_prompt'),('output_tokens','native_tokens_completion')]:
            v=meta.get(meta_key)
            if v is not None and (type(v) is not int or v<0 or v!=native.get(body_key)):errors.append('native_usage_conflict:'+meta_key)
        for k in ('native_tokens_reasoning','native_tokens_cached'):
            v=meta.get(k)
            if v is not None and (type(v) is not int or v<0):errors.append('native_optional_usage_shape:'+k)
        if type(meta.get('native_tokens_reasoning')) is int and meta['native_tokens_reasoning']>8192:errors.append('native_reasoning_observed_threshold')
        try:
            cost=money(meta.get('total_cost'));out['metadata_total_cost_usd']=str(cost)
            if native.get('cost') is not None and money(native['cost'])!=cost:errors.append('inline_metadata_cost_conflict')
            if meta.get('usage') is not None and money(meta['usage'])!=cost:errors.append('metadata_usage_cost_conflict')
            if cost>money(bound):errors.append('cost_exceeds_bound')
        except (Stop,TypeError):errors.append('metadata_cost_missing_or_invalid')
        dated=[v for v in [raw.get('model'),meta.get('model'),*([p.get('model_permaslug') for p in prs if isinstance(p,dict)] if isinstance(prs,list) else [])] if v==r['advertised_dated_slug']]
        out['observed_dated_slug']=dated[0] if dated else None;out['dated_slug_status']='reported identity only; no weights proof' if dated else 'unverified; catalog advertised only'
        out['field_origins']={'model':['body.model','metadata.data.model','documentary exact alias table'],'provider':'exact-ID metadata.data.provider_name, crosschecked body when present','cost':'exact-ID metadata.data.total_cost, independently retained before root settlement','native_counts':'body.usage.input_tokens/output_tokens; metadata native counts corroborate only when nonnull','reasoning':'metadata native_tokens_reasoning literal/null; no default zero or no-thought assertion'}
    for key,cap in [('input_tokens',c.get('post_input_cap',c['input_cap'])),('output_tokens',8192)]:
        v=native.get(key)
        if type(v) is not int or v<0 or v>cap:errors.append('native_required_count_or_threshold:'+key)
    out['guard_status']='held' if errors else 'joined_for_review_not_settled';out['reported_cost_usd']=out.get('metadata_total_cost_usd');out['metadata_GET_attempts']=unique_json(read_state.read_bytes())['attempted_GETs'] if read_state.exists() else 0
    receipt=artifact/'native-generation-join.json'
    if receipt.exists():raise Stop('metadata_join_already_recorded_no_replay')
    save(receipt,out,exclusive=True)
    return out
