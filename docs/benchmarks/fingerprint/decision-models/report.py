"""Machine assembly for Astra; no automatic factual judgments or winner."""
from collections import defaultdict
import statistics
from pathlib import Path
from core import CONTRACT, KEYS, compare, digest, wire, field_coverage, identity
from adapters import PROMPT


def assemble(manifest, parsed, baselines, *, evidence_kind='new_observation',matched_output=None):
    results=[];comparisons=[];all_metrics=[];eligible_by_configuration={}
    families=list(dict.fromkeys(f['family'] for f in CONTRACT['fields']))
    for c in manifest['candidates']:
        expected=[x for x in manifest['cells'] if x['candidate_id']==c['id']]
        attempt_rows=[x for x in parsed if x.get('candidate_id')==c['id']]
        rows=[]
        for ti in dict.fromkeys(cell['title_index'] for cell in expected):
            ident=__import__('core').identity(manifest['titles'][ti]);parts=[r for r in attempt_rows if r['identity']==ident];expected_parts=[cell for cell in expected if cell['title_index']==ti]
            if not parts:continue
            if len(expected_parts)==1:rows.append(parts[0]);continue
            from native_routes import assemble_chunks
            if len(parts)==len(expected_parts) and all(r.get('returned',True) for r in parts):
                ordered=[next(r for r in parts if r.get('cell_id')==cell['id']) for cell in expected_parts];rows.append(assemble_chunks(ordered,[cell['expected_keys'] for cell in expected_parts]))
            else:
                partial=dict(parts[0],comparison_eligible=False,mapped={k:None for k in KEYS},format_valid=False,errors=['missing_or_failed_chunk'],native=[r.get('native') for r in parts],chunk_records=parts,actual_subcalls=len(parts),returned=any(r.get('returned',True) for r in parts))
                for r in parts:
                    for k in r.get('expected_fields',[]):partial['mapped'][k]=r['mapped'][k]
                rows.append(partial)
        expected_titles=len({cell['title_index'] for cell in expected})
        valid=[x for x in rows if x.get('format_valid') and not x.get('guard_errors') and x.get('comparison_eligible',True)]
        eligible_by_configuration[c['id']]=valid
        grouped=defaultdict(list)
        for row in valid:
            for base in baselines:
                if row['identity']==base['identity']:
                    metric=compare(row,base);kind=base['provenance']['kind'];grouped[kind].append(metric);all_metrics.append(metric)
        ds=[]
        for label,metrics in grouped.items():
            fieldrows=[f for m in metrics for f in m['fields'] if f['delta'] is not None]
            titlemeans=[m['overall']['mean_absolute_disagreement'] for m in metrics if m['overall']['compared']]
            ds.append({'baseline_id':label,'paired_title_identities':[m['identity'] for m in metrics],'paired_field_ids_by_title':[{
                    'identity':m['identity'],'field_ids':[f['key'] for f in m['fields'] if f['delta'] is not None]} for m in metrics],'paired_cells':len(fieldrows),'macro_title_mean_abs_delta':statistics.mean(titlemeans) if titlemeans else None,'mean_signed_delta':statistics.mean(r['delta'] for r in fieldrows) if fieldrows else None,'family_mean_abs_delta':{f:statistics.mean(abs(r['delta']) for r in fieldrows if r['family']==f) if any(r['family']==f for r in fieldrows) else None for f in families},'count_abs_delta_ge3':sum(abs(r['delta'])>=3 for r in fieldrows),'is_accuracy':False,'field_means':{k:{'n':len(v:=[abs(r['delta']) for r in fieldrows if r['key']==k]),'mean_absolute_disagreement':statistics.mean(v) if v else None} for k in KEYS},'craft_quality_title_means':[m['craft_quality'] for m in metrics]})
        coverage_records=[]
        for cell in expected:
            ident=identity(manifest['titles'][cell['title_index']])
            matches=[r for r in attempt_rows if r.get('cell_id')==cell['id']]
            if not matches and len([x for x in expected if x['title_index']==cell['title_index']])==1:
                matches=[r for r in attempt_rows if r.get('cell_id') is None and r['identity']==ident]
            if len(matches)>1:raise ValueError('coverage_duplicate_attempt_record')
            fields=cell.get('expected_keys',KEYS)
            coverage_records.append(dict(field_coverage(matches[0] if matches else {},fields,attempted=bool(matches)),cell_id=cell['id'],identity=ident))
        counts={key:sum(r['counts'][key] for r in coverage_records) for key in coverage_records[0]['counts']} if coverage_records else {}
        n_assessed=counts.get('assessed',0);withheld=counts.get('withheld_numeric',0);n_unknown=counts.get('semantic_unknown',0);invalid=counts.get('invalid',0)
        complete=[r for r in valid if all(r['mapped'][k] is not None for k in KEYS)]
        times=[r['transport_seconds'] for r in complete if r.get('transport_seconds') is not None]
        results.append({'configuration_id':c['id'],'native_kind':c['native_kind'],'compatibility_lane':c['compatibility_lane'] if complete else 'partial','recipe_match':'synthetic_only' if evidence_kind=='synthetic' else 'same_frozen_input','pins':{'route':None if evidence_kind=='synthetic' else c.get('provider'),'model_revision':None if evidence_kind=='synthetic' else c['model'],'prompt_sha256':digest(PROMPT.encode()),'input_manifest_sha256':digest(wire(manifest)+b'\n'),'adapter_sha256':digest((Path(__file__).parent/'adapters.py').read_bytes())},'coverage':{'expected_titles':expected_titles,'attempted_titles':len(rows),'returned_titles':sum(r.get('returned',True) for r in rows),'identity_valid_titles':sum('identity_or_envelope' not in r.get('errors',[]) and r.get('returned',True) for r in rows),'strict74_titles':len(complete) if c['compatibility_lane']=='strict_v1' else 0,'projected74_titles':len(complete) if c['compatibility_lane']=='projected_scale' else 0,'expected_cells':74*expected_titles,'assessed_cells':n_assessed,'unknown_cells':n_unknown,'semantic_unknown_cells':n_unknown,'not_applicable_cells':counts.get('not_applicable',0),'not_assessed_cells':counts.get('not_assessed',0),'refused_cells':counts.get('refused',0),'other_assessment_state_cells':counts.get('other_assessment_state',0),'unattempted_cells':counts.get('unattempted',0),'unreturned_cells':counts.get('unreturned',0),'failed_unreturned_cells':sum(r['failed_unreturned_cells'] for r in coverage_records),'field_coverage_by_POST':coverage_records,'comparison_withheld_numeric_cells':withheld,'not_attempted_external_POSTs':max(0,len(expected)-len(attempt_rows)),'partial_chunk_titles':sum('missing_or_failed_chunk' in r.get('errors',[]) for r in rows),'invalid_cells':invalid,'not_attempted_titles':max(0,expected_titles-len(rows))},'baseline_disagreement':ds,'repeat_noise':{'available':False,'basis':'Matching historical repeats exported separately; new repeats not scheduled automatically','mean_abs_delta':None},'efficiency':{'measurement_scope':'synthetic_unmeasured' if evidence_kind=='synthetic' else 'scores_only','paid_requests':0 if evidence_kind=='synthetic' else len(attempt_rows),'cash_usd':sum(float(r['reconciled_cost_usd']) for r in attempt_rows if r.get('reconciled_cost_usd') is not None) if evidence_kind!='synthetic' and all('charge_status' in r for r in attempt_rows) else None,'pending_bound_usd':sum(float(r['pending_bound_usd']) for r in attempt_rows) if evidence_kind!='synthetic' and all('pending_bound_usd' in r for r in attempt_rows) else None,'title_latency_median_seconds':statistics.median(times) if times else None,'vector_throughput_per_hour':None,'n_timings':len(times),'concurrency':1 if times else None},'strengths':[],'failures':['Not yet independently assessed; baseline distances are not accuracy.'],'recommendation':'unreviewed'})
    if matched_output is not None:matched_output.extend(matched_intersections(eligible_by_configuration,baselines))
    return {'report_id':'v1-decision-bench-report-1','evidence_kind':evidence_kind,'contract_order_sha256':CONTRACT['field_order_sha256'],'reviewer':{'model':'deterministic assembly; Astra review pending','effort':'not applicable','exposure':'Development inputs exposed; no new factual judgments authored by report assembler','assisted':True},'scope':'74-attribute scores-only comparison; independent meaning review and final human choice pending','model_results':results,'comparisons':comparisons,'human_decision':{'status':'not_requested_synthetic' if evidence_kind=='synthetic' else 'pending','selection':None,'review_minutes_used':0},'limits':['No fabricated ordinal gold or automatic winner.','Raw invalid/native predictions retained separately; metric eligibility requires valid identity/format/guards.','Unset cost fields require authoritative ledger join; response-reported cost is not reconciled cash.','No complete-pipeline, embedding or search-quality claim.','New benchmark calls require separate authorization; prior releases do not apply.']}


def matched_intersections(configurations,baselines):
    """Descriptive matched numeric cells only; no partial-vector leaderboard."""
    from itertools import combinations
    joined=[]
    for left,right in combinations(configurations,2):
        rows=[]
        for a in configurations[left]:
            if any(a['mapped'].get(k) is None for k in KEYS):continue
            for b in configurations[right]:
                if a['identity']!=b['identity'] or any(b['mapped'].get(k) is None for k in KEYS):continue
                for ref in baselines:
                    if ref['identity']!=a['identity']:continue
                    keys=[k for k in KEYS if all(r['mapped'].get(k) is not None for r in (a,b,ref))]
                    if not keys:continue
                    rows.append({'identity':a['identity'],'baseline_kind':ref['provenance']['kind'],'field_ids':keys,'n':len(keys),'left_mean_abs_disagreement':statistics.mean(abs(a['mapped'][k]-ref['mapped'][k]) for k in keys),'right_mean_abs_disagreement':statistics.mean(abs(b['mapped'][k]-ref['mapped'][k]) for k in keys)})
        joined.append({'configuration_ids':[left,right],'same_title_field_pairs':rows,'comparison_eligible_complete_vectors_only':True,'is_accuracy':False,'ranking':None})
    return joined
