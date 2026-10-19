"""Offline by default. python bench.py --help; no network during import/prepare/demo."""
import argparse
import copy
import gzip
import json
from pathlib import Path
from core import CONTRACT, KEYS, SCHEMA_HASH, baseline, compare, identity, wire, digest, unique_json
from adapters import ADAPTERS, render
from session import private_dir, save, Session, Stop, live_one, adopt_reconciliation, dispose_review_hold, cell_candidate


def freeze(titles,candidates,opening,budget='0'):
    titles=copy.deepcopy(titles);candidates=copy.deepcopy(candidates);opening=copy.deepcopy(opening)
    if not candidates:raise ValueError('candidate_catalog_empty')
    cells=[]
    # Fixed round-robin rotation balances title position across candidates; freeze once.
    # This is not randomized repetitions and does not silently schedule repeat calls.
    for i,t in enumerate(titles):
        ordered=candidates[i%len(candidates):]+candidates[:i%len(candidates)]
        for c in ordered:
            batches=c.get('request_batches',[74])
            if any(type(n) is not int or n<=0 for n in batches) or sum(batches)!=74:raise ValueError('explicit_chunk_coverage')
            offset=0
            for chunk,n in enumerate(batches):
                expected=KEYS[offset:offset+n];offset+=n;variant=dict(c,field_keys=expected);r=render(t,variant)
                cells.append({'id':f'c{len(cells)+1:04d}','title_index':i,'candidate_id':c['id'],'request_sha256':r['wire_sha256'],'input_sha256':r['input_sha256'],'full_cost_bound_usd':c.get('request_cost_bounds_usd',[c['full_cost_bound_usd']]*len(batches))[chunk],'endpoint':r['endpoint'],'request_bytes':r['request_bytes'],'jev_mode_qualification':r['jev_mode_qualification'],'expected_keys':expected,'chunk_index':chunk,'chunk_count':len(batches),'batch_count_status':c.get('batch_count_status','ONE_REQUEST_TEMPLATE')})
    return {'version':'v1-decision-bench-1','status':'UNAPPROVED','schema_sha256':SCHEMA_HASH,'field_order_sha256':CONTRACT['field_order_sha256'],'scope':'scores-only; no companions/embeddings/retrieval benchmark','titles':titles,'candidates':candidates,'cells':cells,'opening_accounting':opening,'new_run_budget_usd':budget,'total_limit_usd':'5.00','title_limit_usd':'3.50','cumulative_attempt_cap':opening.get('initial_attempt_capacity_total',12),'new_retries':0,'allocation_disposition_reviewed':False,'reuse_identical_historical_runs_first':True,'reservation_policy':'rolling-next-post-v1','schedule_policy':'shared-title-rounds; deterministic model rotation; adjacent chunks; stop-at-next-unaffordable; no skipping','counting_scope_proposal':{'status':'UNAPPROVED_REVISED_COUNTING_REQUIRES_HUMAN_APPROVAL','external_POST_ceiling':opening.get('initial_attempt_capacity_total',72)-opening['attempts'],'provider_subrequests':'Separate actual/unknown; not silently one per POST','native_work':'Per candidate documented groups/passes/internal calls; bounds are conditional','retries':0,'concurrency':1,'settle_before_next_POST':True,'proposed_external_POSTs':len(cells),'counting_revision':'UNAPPROVED: external initiation attempts use shared72 capacity; provider HTTP subrequests and native scoring groups/passes remain separate counted work, with disclosed bounded or unknown fanout; not74 internal calls relabelled one total call','unexplained_extra_work':'Pause; no free undocumented pass or automatic revised limit','provider_work_by_candidate':{c['id']:c.get('internal_work',{'actual_provider_subrequests':None,'native_scoring_groups_or_passes':None,'billed_aggregation':'unverified'}) for c in candidates}}}


def prepare(out,titles,candidates,opening,budget='0'):
    out=private_dir(out);m=freeze(titles,candidates,opening,budget)
    save(out/'manifest.json',m,exclusive=True)
    reqs=private_dir(out/'requests')
    for cell in m['cells']:
        c=next(c for c in candidates if c['id']==cell['candidate_id']);body=render(titles[cell['title_index']],cell_candidate(c,cell))['body']
        # No trailing newline so persisted request bytes equal dispatched bytes/hash.
        p=reqs/(cell['id']+'.json');p.write_bytes(wire(body));p.chmod(0o600)
    return m


def historical(repo,cohort,out,catalog=None):
    """Read saved files, exact selected identities only. Never export/query a service."""
    repo=Path(repo);out=private_dir(out);titles=unique_json(Path(cohort).read_bytes())
    hist=repo/'docs/benchmarks/fingerprint';old=unique_json((hist/'titles.json').read_bytes())['titles']
    saved=unique_json((hist/'jev/scores.json').read_bytes());assert saved['score_keys']==KEYS
    old_by={(t['media_type'],t['tmdb_id']):t for t in old}
    catalog_rows={}
    if catalog:
        selected={(t['media_type'],t['tmdb_id']) for t in titles};p=Path(catalog)
        with (gzip.open(p,'rt') if p.suffix=='.gz' else p.open()) as f:
            for line in f:
                row=unique_json(line)
                if (row.get('media_type'),row.get('tmdb_id')) in selected:
                    key=(row['media_type'],row['tmdb_id'])
                    if key in catalog_rows:raise ValueError('duplicate_catalog_identity')
                    # Deliberately retain only requested title/score fields, not other users or catalog rows.
                    catalog_rows[key]={k:row.get(k) for k in ('media_type','tmdb_id','title','year','fingerprint','fingerprint_scores','synopsis','original_title')}
    top={}
    top_sources={}
    for name in ('top-movies.json','top-shows.json'):
        p=repo/'docs/research/fingerprint-v2-gap-audit'/name
        if p.exists():
            for row in unique_json(p.read_bytes()):
                key=(row['media_type'],row['tmdb_id'])
                if key in {(t['media_type'],t['tmdb_id']) for t in titles}:top[key]=row;top_sources[key]=p
    normalized=unique_json((hist/'poc/evidence-first/normalized-scores.json').read_bytes())['results']
    records=[];availability=[];inputs=[]
    for t in titles:
        key=(t['media_type'],t['tmdb_id']);bid=f'{key[0]}:{key[1]}';o=old_by.get(key);matches=[];inp=None
        if o:
            if o['release_year']!=t['year'] or o['title']!=t['title']:raise ValueError('historical_identity_mismatch')
            p=hist/'jev/scores.json'
            for arm,rows in saved['baselines'].items():
                if bid in rows:
                    record=baseline(t,rows[bid],{'source_sha256':digest(p.read_bytes()),'source_path':str(p.relative_to(repo)),'locator':f'baselines/{arm}/{bid}','kind':'historical_generated_'+arm,'scope_limit':'movie edition unrecorded; shows historically through2026-09-12','prior_exposure':True});
                    if arm in ('F','D'):
                        index={'F':6,'D':7}[arm]
                        found=[x for x in normalized if x['benchmark_id']==bid and x['candidate_index']==index and x['full_response_outcome']=='valid']
                        if len(found)!=1:raise ValueError('historical_artifact_ambiguity')
                        artifact=hist/'poc/evidence-first'/found[0]['artifact'];oldparsed=unique_json((artifact/'parsed.json').read_bytes());oldreq=unique_json((artifact/'request.json').read_bytes());generation=unique_json((artifact/'generation.json').read_bytes())
                        if oldparsed['results'][0]['analysis']['fingerprint']['scores']!=rows[bid]:raise ValueError('saved_projection_mismatch')
                        record['provenance'].update({'request_sha256':digest((artifact/'request.json').read_bytes()),'prompt_sha256':digest(oldreq['messages'][0]['content'].encode()),'generation_metadata_sha256':digest((artifact/'generation.json').read_bytes()),'generation_model':generation.get('model'),'provider':generation.get('provider_name'),'created_at':generation.get('created_at'),'full_document_control':True,'artifact':str(artifact.relative_to(repo)),'recipe_match':'stored_unmatched_recipe: new scores-only projection differs from historical full-document prompt'})
                    else:record['provenance']['kind']='historical_panel_median_comparator_not_gold'
                    records.append(record);matches.append(arm)
            for arm,rows in saved['jev'].items():
                if bid not in rows:continue
                record=baseline(t,rows[bid],{'source_sha256':digest((hist/'jev/scores.json').read_bytes()),'source_path':'docs/benchmarks/fingerprint/jev/scores.json','locator':f'jev/{arm}/{bid}','kind':'historical_jev_projection_'+arm,'reference_role':'reproduction_context_not_gold','producer':'jev-1.13.0 per original runner; sanitized mapped artifact, raw native response unavailable','projection':'Historical Python round(10*x/9) or round(2*x); mode/argmax/presence gating retained in arm label; not current comparison mapping','raw_native_available':False,'historical_arm':arm});records.append(record);matches.append('Jev:'+arm)
            inp=dict(t,original_title=o['original_title'],synopsis=o['overview'],synopsis_source={'file':'docs/benchmarks/fingerprint/titles.json','sha256':digest((hist/'titles.json').read_bytes()),'locator':bid,'historical_exact_synopsis':True})
        elif key in top:
            row=top[key]
            if row['title']!=t['title']:raise ValueError('saved_catalog_title_mismatch')
            inp=dict(t,original_title=row['original_title'],synopsis=row['synopsis'],synopsis_source={'file':str(top_sources[key].relative_to(repo)),'sha256':digest(top_sources[key].read_bytes()),'locator':bid,'historical_exact_synopsis':False,'qualification':'saved catalog synopsis; year/scope independently from selected identity; no historical trial for this title'})
        row=catalog_rows.get(key)
        if row:
            if row['title']!=t['title'] or row['year']!=t['year']:raise ValueError('catalog_identity_mismatch')
            if row['fingerprint_scores']:
                records.append(baseline(t,row['fingerprint_scores'],{'source_path':str(catalog),'source_sha256':digest(Path(catalog).read_bytes()),'locator':bid,'kind':'saved_catalog_payload_scores','generation_identity':'unverified unless source supplies it'}));matches.append('saved_catalog_payload_scores')
            if not inp and row['synopsis']:inp=dict(t,original_title=row['original_title'],synopsis=row['synopsis'],synopsis_source={'file':str(catalog),'sha256':digest(Path(catalog).read_bytes()),'locator':bid,'historical_exact_synopsis':False})
        if inp:inputs.append(inp)
        availability.append({'identity':identity(t),'baseline_labels':matches,'baseline_status':'saved_generated_not_gold' if matches else 'MISSING_IN_AUDITED_ASSETS','synopsis_available':bool(inp),'old_ten_exposure':bool(o),'saved_normalized_vector_present':bool(row and row['fingerprint']),'qualification':'Normalized search vector must not be inverted into raw trait scores; payload/vector drift is documented. Other prior exposure remains possible.'})
    save(out/'baselines.json',records,exclusive=True);save(out/'synopsis-inputs.json',inputs,exclusive=True);save(out/'availability.json',availability,exclusive=True)
    # Saved repeat sensitivity is retained only for titles actually in this selection.
    rep=[];repeat_checks=[]
    for row in unique_json((hist/'poc/repeat-cost/comparison.json').read_bytes()):
        if row['benchmark_id'] in {f"{t['media_type']}:{t['tmdb_id']}" for t in titles}:
            p=hist/'poc/repeat-cost'/row['repeat_artifact']/'parsed.json';parsed=unique_json(p.read_bytes())
            t=next(t for t in titles if f"{t['media_type']}:{t['tmdb_id']}"==row['benchmark_id'])
            repeat_record=baseline(t,parsed['results'][0]['analysis']['fingerprint']['scores'],{'source_sha256':digest(p.read_bytes()),'source_path':str(p.relative_to(repo)),'locator':'results/0/analysis/fingerprint/scores','kind':'historical_repeat_'+row['model_label']});rep.append(repeat_record)
            first=next(x for x in records if x['identity']==identity(t) and x['provenance']['kind']=='historical_generated_'+row['model_label'])
            first_req=unique_json((repo/first['provenance']['artifact']/'request.json').read_bytes());repeat_req=unique_json((p.parent/'request.json').read_bytes())
            result=compare(repeat_record,first);result['same_input_messages']=first_req['messages']==repeat_req['messages'];result['same_model_and_provider']=first_req['model']==repeat_req['model'] and first_req['provider']==repeat_req['provider'];result['recipe_qualification']='Descriptive saved repeat sensitivity; repaired/control provenance retained, not a universal noise floor.';result['fraction_within_one']=sum(abs(r['delta'])<=1 for r in result['fields'] if r['delta'] is not None)/result['overall']['compared'] if result['overall']['compared'] else None;repeat_checks.append(result)
    save(out/'repeat-baselines.json',rep,exclusive=True);save(out/'repeat-sensitivity.json',repeat_checks,exclusive=True)
    return availability


def review(out,parsed,baselines,manifest=None,evidence_kind="new_observation"):
    out=private_dir(out);results=[]
    for item in parsed:
        for base in baselines:
            if item['identity']==base['identity']:
                r=compare(item,base);r['format_valid']=item.get('format_valid');r['metric_eligible']=bool(item.get('format_valid') and not item.get('guard_errors') and item.get('comparison_eligible',True));r['diagnostic_only_if_invalid']=not r['metric_eligible'];r['mapping']=item.get('mapping');r['candidate_id']=item.get('candidate_id');r['reference']=base.get('provenance');r['stage_seconds']=item.get('transport_seconds');r['reported_cost_usd']=item.get('reported_cost_usd');r['cost_status']=item.get('cost_status');results.append(r)
    save(out/'differences.json',results,exclusive=True)
    if manifest is not None:
        from report import assemble
        matched=[];assembled=assemble(manifest,parsed,baselines,evidence_kind=evidence_kind,matched_output=matched)
        save(out/'review-report.json',assembled,exclusive=True)
        save(out/'matched-configuration-intersections.json',matched,exclusive=True)
    save(out/'representative-outputs.json',parsed,exclusive=True)
    queue=[]
    for result in results:
        selected=[]
        for family in dict.fromkeys(f['family'] for f in CONTRACT['fields']):
            eligible=[f for f in result['fields'] if f['family']==family and f['delta'] is not None]
            if eligible:selected.append(max(eligible,key=lambda f:abs(f['delta'])))
        control=next((f for f in result['fields'] if f['delta'] is None),None) or min((f for f in result['fields'] if f['delta'] is not None),key=lambda f:abs(f['delta']),default=None)
        if control and control not in selected:selected.append(control)
        queue.append({'identity':result['identity'],'candidate_id':result['candidate_id'],'reference':result['reference'],'selection':'one largest diagnostic difference per family plus unknown/agreement control; Astra may replace with consequential semantic cases','cells':selected[:6],'factual_verdict':'PENDING_ASTRA'})
    save(out/'review-queue.json',queue,exclusive=True)
    lines=['# Vector review packet','', 'Synthetic if inputs say synthetic. Baseline disagreement is not factual error. No winner or canonical acceptance. Astra assessment precedes final human review.','']
    for r in results:
        lines += [f"## {r['identity']['title']} / {r.get('candidate_id')} / {r['reference'].get('kind')}",f"Coverage {r['candidate_coverage']:.3f}; format valid: {r['format_valid']}; mean absolute disagreement: {r['overall']['mean_absolute_disagreement']}."]
        for x in r['consequential_disagreements'][:4]:lines.append(f"- {x['key']}: baseline {x['baseline']}; candidate {x['candidate']}; delta {x['delta']} (review, not error label).")
    (out/'REVIEW.md').write_text('\n'.join(lines)+'\n');(out/'REVIEW.md').chmod(0o600)
    return results


def demo(out):
    out=private_dir(out);template=unique_json((Path(__file__).parent/'example-candidates.json').read_bytes())
    candidates=copy.deepcopy(template[:2]);candidates[0]['id']='synthetic-chat';candidates[1]['id']='synthetic-native'
    for c in candidates:c.update(model='SYNTHETIC',provider='SYNTHETIC',allowed_returned_models=['SYNTHETIC'],allowed_returned_providers=['SYNTHETIC'])
    titles=[{'media_type':'movie','tmdb_id':900000001,'title':'Synthetic Fixture A','original_title':'Synthetic Fixture A','year':2001,'scope':'movie_work_edition_unrecorded','synopsis':'An invented courier must choose whether to deliver a sealed letter.'}]
    opening={'cash_usd':'0','pending':{},'held_stage_usd':'0','attempts':0,'retries':0,'semantic_hold':False,'synthetic':True}
    m=freeze(titles,candidates,opening,'0.02');save(out/'manifest.json',m,exclusive=True)
    base=baseline(titles[0],{k:5 for k in KEYS},{'source_sha256':digest(b'synthetic-not-gold'),'locator':'fixture','kind':'synthetic_fixture_not_gold'})
    parsed=[]
    for c in candidates:
        native={k:5 for k in KEYS};native[KEYS[0]]=8;native[KEYS[1]]=None
        raw={'model':'SYNTHETIC','provider':'SYNTHETIC','usage':{'prompt_tokens':100,'completion_tokens':100,'cost':0},'id':'gen-synthetic'}
        if c['adapter']=='openrouter':raw['choices']=[{'finish_reason':'stop','message':{'content':wire({'identity':identity(titles[0]),'scores':native}).decode()}}]
        else:raw['answers']={k:({'state':'unknown'} if v is None else {'type':'score','score':v,'probabilities':{str(i):float(i==v) for i in range(10)}}) for k,v in native.items()}
        r=render(titles[0],c);save(out/(c['id']+'-request.json'),r,exclusive=True);save(out/(c['id']+'-response.json'),raw,exclusive=True)
        p=ADAPTERS[c['adapter']].parse(raw,titles[0],c);p.update(candidate_id=c['id'],mapping=c['mapping'],synthetic=True,reported_cost_usd='0',cost_status='synthetic_not_billable',transport_seconds=None);parsed.append(p)
    review(out/'review',parsed,[base],m,evidence_kind='synthetic');save(out/'baselines.json',[base],exclusive=True)
    # Exercise durable one-attempt path separately, not one bespoke production runner per cell.
    s=Session(out/'manifest.json',out/'runtime')
    try:
        def fake(body,artifact,c):return unique_json((out/(c['id']+'-response.json')).read_bytes())
        s.one(fake,synthetic=True)
    finally:s.close()
    return {'mode':'offline_synthetic','requests_rendered':2,'fake_transport_sends':1,'real_network_sends':0,'schema_fields':74,'manifest_sha256':digest((out/'manifest.json').read_bytes())}


def native_demo(out):
    from native_routes import ENDPOINTS,NUMERIC,STATES,bank,NativeChoice
    from session import save_raw
    out=private_dir(out)
    t={'media_type':'movie','tmdb_id':900000002,'title':'Synthetic Native Fixture','original_title':'Synthetic Native Fixture','year':2002,'scope':'movie_work_edition_unrecorded','synopsis':'An invented traveler searches for a missing letter.'}
    configs=[]
    for n,a in enumerate(ENDPOINTS):
        configs.append({'id':'synthetic-native-'+str(n),'adapter':a,'model':'SYNTHETIC','provider':'SYNTHETIC','option_bank':'choice16_states','native_kind':'choice11','compatibility_lane':'strict_v1','full_cost_bound_usd':None,'enabled':False,'mapping':{'kind':'choice_labels','labels':dict(NUMERIC,**{k:None for k in STATES})},'request_batches':[64,10] if a=='systemone-map-v1' else [74]})
    m=freeze([t],configs,{'cash_usd':'0','pending':{},'held_stage_usd':'0','attempts':0,'retries':0,'semantic_hold':False,'synthetic':True})
    save(out/'manifest.json',m,exclusive=True);records=[]
    for cell in m['cells']:
        c=cell_candidate(next(c for c in configs if c['id']==cell['candidate_id']),cell);r=render(t,c);labels=bank(c);answers={}
        for k in cell['expected_keys']:
            selected='U_INSUFFICIENT' if k==KEYS[0] else 'V00' if k==KEYS[1] else 'V05'
            answers[k]={'type':'choice','choice':selected,'probabilities':{label:float(label==selected) for label in labels},'confidence':.7}
        if c['adapter']=='celeris-decisions-list-v1':answers=[dict(a,name=k,probabilities=[{'value':label,'probability':v} for label,v in a['probabilities'].items()]) for k,a in answers.items()]
        raw={'model':'SYNTHETIC','answers':answers,'usage':{'input_tokens':0,'output_tokens':0}}
        save_raw(out/(cell['id']+'-request.wire.json'),wire(r['body']));save(out/(cell['id']+'-response.json'),raw,exclusive=True)
        parsed=NativeChoice.parse(raw,t,c);parsed.update(candidate_id=c['id'],cell_id=cell['id'],input_sha256=r['input_sha256'],request_sha256=r['wire_sha256'],mapping=c['mapping'],synthetic=True);records.append(parsed)
    b=baseline(t,{k:5 for k in KEYS},{'source_sha256':digest(b'synthetic-native-fixture'),'locator':'fixture','kind':'synthetic_fixture_not_gold'})
    review(out/'review',records,[b],m,evidence_kind='synthetic');save(out/'parsed-records.json',records,exclusive=True)
    return {'mode':'offline_synthetic_native','endpoint_configurations':len(configs),'explicit_request_templates':len(m['cells']),'real_network_sends':0,'native_models_tested':0,'manifest_sha256':digest((out/'manifest.json').read_bytes())}


def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='cmd',required=True)
    nd=sub.add_parser('demo-native');nd.add_argument('--out',required=True)
    ci=sub.add_parser('import-prepared');ci.add_argument('--packet',required=True);ci.add_argument('--out',required=True)
    mx=sub.add_parser('matrix');mx.add_argument('--manifest',required=True);mx.add_argument('--out',required=True)
    d=sub.add_parser('demo');d.add_argument('--out',required=True)
    i=sub.add_parser('import-history');i.add_argument('--repo',required=True);i.add_argument('--cohort',required=True);i.add_argument('--out',required=True);i.add_argument('--catalog')
    account=sub.add_parser('import-accounting');account.add_argument('--ledger',required=True);account.add_argument('--receipt',required=True);account.add_argument('--out',required=True)
    collect=sub.add_parser('collect-runtime');collect.add_argument('--manifest',required=True);collect.add_argument('--runtime',required=True);collect.add_argument('--out',required=True)
    cat=sub.add_parser('import-catalog');cat.add_argument('--packet',required=True);cat.add_argument('--out',required=True);cat.add_argument('--breadth')
    chunks=sub.add_parser('assemble-chunks');chunks.add_argument('--records',required=True);chunks.add_argument('--batches',required=True);chunks.add_argument('--out',required=True)
    f=sub.add_parser('prepare');f.add_argument('--titles',required=True);f.add_argument('--candidates',required=True);f.add_argument('--opening',required=True);f.add_argument('--out',required=True);f.add_argument('--run-ceiling',default='0')
    r=sub.add_parser('review');r.add_argument('--manifest',required=True);r.add_argument('--parsed',required=True);r.add_argument('--baselines',required=True);r.add_argument('--out',required=True)
    i2=sub.add_parser('ingest');i2.add_argument('--manifest',required=True);i2.add_argument('--cell',required=True);i2.add_argument('--response',required=True);i2.add_argument('--request',required=True);i2.add_argument('--out',required=True)
    run=sub.add_parser('run');run.add_argument('--manifest',required=True);run.add_argument('--runtime',required=True);run.add_argument('--live',action='store_true');run.add_argument('--approval');run.add_argument('--approval-sha256');run.add_argument('--credential-env',default='OPENROUTER_API_KEY')
    a=sub.add_parser('adopt-reconciliation');a.add_argument('--manifest',required=True);a.add_argument('--runtime',required=True);a.add_argument('--receipt',required=True);a.add_argument('--receipt-sha256',required=True)
    disposition=sub.add_parser('dispose-review-hold');disposition.add_argument('--manifest',required=True);disposition.add_argument('--runtime',required=True);disposition.add_argument('--receipt',required=True);disposition.add_argument('--receipt-sha256',required=True)
    args=p.parse_args()
    if args.cmd=='import-prepared':
        from preparation import catalog_inputs
        result=catalog_inputs(args.packet,args.out)
    elif args.cmd=='matrix':
        from preparation import matrix
        m=unique_json(Path(args.manifest).read_bytes());out=private_dir(args.out);value=matrix(m);save(out/'request-route-matrix.json',value,exclusive=True);result={k:v for k,v in value.items() if k!='rows'}
    elif args.cmd=='demo':result=demo(args.out)
    elif args.cmd=='demo-native':result=native_demo(args.out)
    elif args.cmd=='import-history':result={'titles':len(historical(args.repo,args.cohort,args.out,args.catalog)),'network':0}
    elif args.cmd=='import-accounting':
        from accounting import retired
        opening=retired(args.ledger,args.receipt);out=private_dir(args.out);save(out/'opening-accounting.json',opening,exclusive=True);result={'source_status':opening['parent_accounting_status'],'old_stage_reusable':False,'new_reservations_usd':'0','network':0}
    elif args.cmd=='collect-runtime':
        m=unique_json(Path(args.manifest).read_bytes());runtime=Path(args.runtime);ledger=unique_json((runtime/'ledger.json').read_bytes());records=[]
        if ledger['manifest_sha256']!=digest(Path(args.manifest).read_bytes()):raise Stop('runtime_manifest_mismatch')
        for attempt in ledger['attempts']:
            cell=next(x for x in m['cells'] if x['id']==attempt['cell_id']);t=m['titles'][cell['title_index']];p=runtime/cell['id']/'parsed.json'
            record=unique_json(p.read_bytes()) if p.exists() else {'identity':identity(t),'schema_sha256':SCHEMA_HASH,'native':None,'mapped':{k:None for k in KEYS},'format_valid':False,'errors':['failed_attempt_no_parsed_output'],'returned':False}
            record.update(candidate_id=cell['candidate_id'],cell_id=cell['id'],chunk_index=cell.get('chunk_index',0),chunk_count=cell.get('chunk_count',1),expected_fields=cell.get('expected_keys',KEYS),charge_status=attempt['charge'],reconciled_cost_usd=attempt.get('cost_usd'),pending_bound_usd=ledger['pending'].get(cell['id'],'0'));records.append(record)
        out=private_dir(args.out);save(out/'attempt-records.json',records,exclusive=True);save(out/'ledger-source.json',{'ledger_sha256':digest((runtime/'ledger.json').read_bytes()),'cumulative_cash_usd':ledger['cash_usd'],'pending':ledger['pending'],'old_stage_held_usd':ledger['held_stage_usd']},exclusive=True);result={'attempts_retained':len(records),'network':0}
    elif args.cmd=='import-catalog':
        from catalog import load
        configs,receipt=load(args.packet,args.breadth);out=private_dir(args.out);save(out/'registered-candidates.json',configs,exclusive=True);save(out/'catalog-receipt.json',receipt,exclusive=True);result={'renderable':len(configs),'disabled_descriptors':len(receipt['unsupported_descriptors']),'launch_authorized':False}
    elif args.cmd=='assemble-chunks':
        from native_routes import assemble_chunks
        records=unique_json(Path(args.records).read_bytes());sizes=unique_json(Path(args.batches).read_bytes());offset=0;keys=[]
        for n in sizes:keys.append(KEYS[offset:offset+n]);offset+=n
        value=assemble_chunks(records,keys);out=private_dir(args.out);save(out/'assembled.json',value,exclusive=True);result={'subcalls':value['actual_subcalls'],'canonical_acceptance':False}
    elif args.cmd=='prepare':
        result=prepare(args.out,unique_json(Path(args.titles).read_bytes()),unique_json(Path(args.candidates).read_bytes()),unique_json(Path(args.opening).read_bytes()),args.run_ceiling);result={'status':result['status'],'cells':len(result['cells']),'network':0}
    elif args.cmd=='review':result={'comparisons':len(review(args.out,unique_json(Path(args.parsed).read_bytes()),unique_json(Path(args.baselines).read_bytes()),unique_json(Path(args.manifest).read_bytes()))),'network':0}
    elif args.cmd=='ingest':
        m=unique_json(Path(args.manifest).read_bytes());cell=next(x for x in m['cells'] if x['id']==args.cell);c=next(x for x in m['candidates'] if x['id']==cell['candidate_id']);t=m['titles'][cell['title_index']];c=cell_candidate(c,cell)
        from adapters import register_native
        register_native()
        if digest(Path(args.request).read_bytes())!=cell['request_sha256']:raise Stop('imported_request_wire_mismatch')
        raw=Path(args.response).read_bytes()
        if len(raw)>2000000:raise Stop('response_oversized')
        parsed=ADAPTERS[c['adapter']].parse(unique_json(raw),t,c,**({'raw_response_bytes':raw,'custody':{'source':'explicit saved response import'}} if c['adapter']!='openrouter' else {}));parsed.update(candidate_id=c['id'],cell_id=cell['id'],chunk_index=cell.get('chunk_index',0),chunk_count=cell.get('chunk_count',1),expected_fields=cell.get('expected_keys',KEYS),mapping=c['mapping'],request_sha256=cell['request_sha256'],input_sha256=cell['input_sha256'],source_response_sha256=digest(raw),cost_status='not_reconciled',canonical_acceptance=False)
        parsed['guard_errors']=[]
        if parsed.get('returned_model') not in c.get('allowed_returned_models',[]):parsed['guard_errors'].append('returned_model_unverified_or_mismatch')
        if c['adapter']=='openrouter' or c['adapter'].startswith('openrouter-'):
            if parsed.get('returned_provider') not in c.get('allowed_returned_providers',[]):parsed['guard_errors'].append('returned_provider_unverified_or_mismatch')
        out=private_dir(args.out);fd=__import__('os').open(out/'raw-response.private.bin',__import__('os').O_WRONLY|__import__('os').O_CREAT|__import__('os').O_EXCL,0o600)
        with __import__('os').fdopen(fd,'wb') as stream:stream.write(raw)
        save(out/'parsed.json',parsed,exclusive=True);result={'status':'imported_for_review_not_accepted','network':0}
    elif args.cmd in ('adopt-reconciliation','dispose-review-hold'):
        s=Session(args.manifest,args.runtime)
        try:result=(adopt_reconciliation if args.cmd=='adopt-reconciliation' else dispose_review_hold)(s,args.receipt,args.receipt_sha256)
        finally:s.close()
    elif not args.live:
        from session import validate_manifest
        m=unique_json(Path(args.manifest).read_bytes());validate_manifest(m);result={'mode':'dry-run','status':m['status'],'cells':len(m['cells']),'credentials_resolved':False,'network':0}
    else:
        if not args.approval or not args.approval_sha256:raise Stop('explicit_new_benchmark_approval_required')
        result=live_one(args.manifest,args.runtime,args.approval,args.approval_sha256,args.credential_env)
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    try:main()
    except (Stop,ValueError) as e:
        # Controlled validation errors only; transport never exposes arbitrary exception text.
        raise SystemExit(str(e)) from None
