"""Offline native/shortlist/interpretation adapters for the cheap review UI."""
import argparse
import copy
import hashlib
import json
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DOCS = ROOT/'docs/prototypes/crate-evidence'
PRIVATE = HERE/'private/cheap-loop'


def read(path):
    return json.loads(Path(path).read_text())


def adapt():
    rows = read(HERE/'private/sample.json')
    source = {f"{r['media_type']}:{r['tmdb_id']}":r for r in rows}
    original_cost = {c['request']:c['original_jev_cost_usd'] for c in read(DOCS/'matched-comparison-metrics.json')['cases']}
    rounds, result_index = [], {}
    ledger = {'scope':'Current cheap-loop experiments only. Historical higher-cost loop spending is separate.', 'actual_api_calls':0,'actual_api_spend_usd':0,'calls':[],'runtime_calls_per_search':2,'extra_runtime_stages':0}
    def titles(items):
        return [{**{k:v for k,v in source.get(t['key'],{}).items() if k in {'title','synopsis','essence_text','poster_path','media_type','tmdb_id','release_year'}}, **t, 'year':source.get(t['key'],{}).get('release_year')} for t in items]
    def case(request):
        return {'id':hashlib.sha256(request.encode()).hexdigest()[:12],'request':request,'split':'development','results':{}}
    def meta(identifier,family,primary=True):
        return {'id':identifier,'label':identifier.replace('_',' '),'family':family,'primary_visible':primary,'status':'active','reason':'Measured alternative; no accepted universal replacement.'}
    for filename in ['native-round1.json','native-english-phrase-control.json','native-jev-control.json','native-jev-revised.json','native-jev-candidates-only.json','native-supplemental-controls.json','native-preconjunction-v2-supplemental.json','native-preconjunction-v2-supplemental-prefallbackfix.json']:
        path=PRIVATE/filename
        if not path.exists():continue
        raw=read(path); paired='native-jev-' in filename
        supplemental='supplemental' in filename
        superseded='prefallbackfix' in filename
        mode=filename.removeprefix('native-jev-').removesuffix('.json')
        interp={c['request']:c for c in read(PRIVATE/'jev-paired'/f'{mode}-interpretations.json')} if paired else {}
        rr={'name':('SUPERSEDED fallback bug · supplemental 28' if superseded else 'Supplemental 28 · '+filename if supplemental else 'Paired interpretation · '+mode if paired else 'Native SQL · '+filename),'variants':[],'cases':[],'family':'Supplemental native' if supplemental else 'Paired interpretation' if paired else 'Native SQL','input':str(path)}
        for c in raw['cases']:
            cc=case(c['request'])
            if c.get('original_jev_cost_usd') is not None: original_cost.setdefault(c['request'],c['original_jev_cost_usd'])
            if supplemental: cc['split']='supplemental (already seen)'
            for key,run in c['summary'].items():
                vid=('superseded_' if superseded else 'supplemental_' if supplemental else 'jev_'+mode+'_' if paired else 'native_live_')+key
                current=interp.get(c['request'],{});runtime=current.get('experiment',{}).get('projected_full_runtime_cost_usd',c.get('original_jev_cost_usd',original_cost.get(c['request'])))
                out={'top10':titles(run['top10']),'cost_usd':runtime,'baseline_model_cost_usd':runtime,'extra_model_cost_usd':0,'cost_policy':'actual_capture' if paired else 'unchanged','cheap_timing':{'retrieval_ms':run.get('median_wall_ms'),'retrieval_label':'measured SQL retrieval; '+('single run' if paired else 'median of '+str(run.get('success_count',0))+' non-warm repetitions')},'diagnostics':{k:v for k,v in run.items() if k!='top10'}}
                out['diagnostics'].update(input=str(path),interpretation_mode=mode if paired else 'original',interpretation_phrases=c.get('phrases'),timing_scope='Fresh restored scratch; not historical timing or measured full end-to-end',gated=not run['top10'],preconjunction=next((r.get('preconjunction') for r in reversed(c.get('runs',[])) if r.get('variant')==key),None),interpretation_experiment=current.get('experiment'))
                pc=out['diagnostics'].get('preconjunction')
                if pc: out['diagnostics']['preconjunction']={k:v for k,v in pc.items() if k not in {'joint_candidate_scores','joint_ranked_candidates','joint_candidate_keys'}}
                cc['results'][vid]=out;result_index[(c['request'],vid)]=out
                if not any(v['id']==vid for v in rr['variants']):rr['variants'].append({**meta(vid,rr['family']),**({'status':'discarded','reason':'Superseded technical run: variable shadowing prevented intended fallback supplementation; corrected run kept separately.'} if superseded else {})})
            rr['cases'].append(cc)
        rounds.append(rr)
        if paired:
            for c in interp.values():
                e=c['experiment'];ledger['calls'].append({'request':c['request'],'mode':mode,'cost_usd':e['actual_new_cost_usd'],'runtime_model_cost_usd':e['projected_full_runtime_cost_usd']})
    path=PRIVATE/'shortlist-all-native.json'
    if path.exists():
        raw=read(path);rr={'name':'Bounded shortlist and full-score blends','family':'Shortlist','variants':[],'cases':[],'input':str(path)}
        representative={'english_fields2_64','native_phrase_fields2_64','english_phrase_fields2_64','english_phrase_anti_64','english_phrase_rrf60_full','english_phrase_lexical75_d425_full'}
        for c in raw['cases']:
            cc=case(c['request'])
            for key,run in c['results'].items():
                vid='short_'+key;out=copy.deepcopy(run);co=out.get('components_ms',{});out['top10']=titles(out['top10']);out.update(baseline_model_cost_usd=run.get('original_interpretation_cost_usd'),cost_usd=run.get('original_interpretation_cost_usd'),extra_model_cost_usd=0,cost_policy='unchanged')
                out['cheap_timing']={'warm_rerank_ms':co.get('rank_median'),'candidate_preparation_ms':co.get('preparation'),'local_total_ms':run.get('local_ms'),'retrieval_ms':co.get('saved_native_retrieval'),'retrieval_label':'saved measured native retrieval; sum with local work is reconstructed, not live end-to-end'}
                out['diagnostics']={k:v for k,v in run.items() if k!='top10'};cc['results'][vid]=out;result_index[(c['request'],vid)]=out
                if not any(v['id']==vid for v in rr['variants']):rr['variants'].append(meta(vid,'Shortlist',key in representative))
            rr['cases'].append(cc)
        rounds.append(rr)
    path=PRIVATE/'shortlist-hygiene.json'
    if path.exists():
        raw=read(path);rr={'name':'Conservative catalog identity cleanup','family':'Hygiene','variants':[],'cases':[],'input':str(path)}
        for c in raw['cases']:
            cc=case(c['request'])
            for key,run in c['results'].items():
                base='native_live_'+key.removesuffix('_native_combined') if key.endswith('_native_combined') else 'short_'+key
                vid='clean_'+key;out=copy.deepcopy(result_index.get((c['request'],base),{}));out['top10']=titles(run['top10']);out.setdefault('diagnostics',{})['hygiene']= {k:v for k,v in run.items() if k!='top10'}
                out.setdefault('cheap_timing',{})['hygiene_ms']=run.get('hygiene_median_ms');cc['results'][vid]=out
                if not any(v['id']==vid for v in rr['variants']):rr['variants'].append(meta(vid,'Hygiene',key in {'english_native_combined','native_prose_boost_native_combined','english_phrase_anti_64','english_phrase_fields2_64'}))
            rr['cases'].append(cc)
        rounds.append(rr)
    for ranked_name in ['preconjunction-ranked.json','preconjunction-ranked-supplemental28.json']:
        path=PRIVATE/ranked_name
        if not path.exists():continue
        supplemental='supplemental' in ranked_name
        raw=read(path)
        bench_path=PRIVATE/'native-preconjunction-v2-benchmark.json'
        benchmarks={c['request']:c['summary'] for c in read(bench_path)['cases']} if bench_path.exists() else {}
        rr={'name':'Pre-cap conjunction · supplemental 28' if supplemental else 'Pre-cap conjunction · original 13','family':'Structural conjunction','input':str(path),'variants':[meta('joint_'+k,'Structural conjunction') for k in ['native','anti64','rrf60','lexical75_d425']],'cases':[]}
        review_path=DOCS/('cheap-loop-preconjunction-supplemental-independent-review.json' if supplemental else 'cheap-loop-preconjunction-independent-review.json')
        reviewed={c['request']:c for c in read(review_path)['cases']} if review_path.exists() else {}
        for c in raw['cases']:
            cc=case(c['request']);cc['split']='supplemental (already seen)' if supplemental else 'development';bm=benchmarks.get(c['request'],{}).get('native_preconjunction_v2',{})
            for mode in ['native','anti64','rrf60','lexical75_d425']:
                run=c.get('results',{}).get(mode,{})
                local=run.get('median_local_ms',0 if not c['activated'] or mode=='native' else None)
                out={'top10':titles(run.get('top10',c['native_top10'])),'cost_usd':original_cost.get(c['request']),'baseline_model_cost_usd':original_cost.get(c['request']),'extra_model_cost_usd':0,
                    'cheap_timing':{'local_total_ms':local,'retrieval_ms':bm.get('median_wall_ms',c.get('native_wall_ms')),'retrieval_label':'matched interleaved 5-repeat retrieval median; local addition reconstructed' if bm else 'single measured SQL screen; not benchmarked full end-to-end'},
                    'diagnostics':{'activated':c['activated'],'candidate_count':c.get('candidate_count'),'scope':c.get('scope','Joint before source caps; no paid features'),'matched_controls':{k:{a:b for a,b in v.items() if a!='top10'} for k,v in benchmarks.get(c['request'],{}).items()},'local_max_ms':run.get('max_local_ms'),'hygiene':run.get('hygiene'),'local_trials':run.get('trials')}}
                cc['results']['joint_'+mode]=out
            if c['request'] in reviewed:cc['assessments']=[{'source':'Independent structural conjunction review',**reviewed[c['request']]}]
            rr['cases'].append(cc)
        rounds.append(rr)
    path=PRIVATE/'stem-ablation.json'
    if path.exists():
        raw=read(path);groups={}
        review_path=DOCS/'cheap-loop-stem-independent-review.json'
        reviewed={(c['request'],c.get('kind')):c for c in read(review_path)['cases']} if review_path.exists() else {}
        for c in raw['cases']:
            group=(c['split'],c['kind'])
            if group not in groups:groups[group]={'name':'Normalization · '+c['split']+' · '+c['kind'],'family':'Normalization','input':str(path),'variants':[meta('stem_'+c['kind']+'_'+mode,'Normalization') for mode in ['original','snowball']],'cases':[]}
            cc=case(c['request']);cc['split']='development' if c['split']=='original13' else 'supplemental (already seen)'
            for mode,run in c['results'].items():
                trials=run.get('trials',[])
                cc['results']['stem_'+c['kind']+'_'+mode]={'top10':titles(run.get('top10',[])),'cost_usd':original_cost.get(c['request']),'baseline_model_cost_usd':original_cost.get(c['request']),'extra_model_cost_usd':0,
                    'cheap_timing':{'local_total_ms':run.get('median_local_ms'),'candidate_preparation_ms':statistics.median(t['preparation_ms'] for t in trials) if trials else None,'warm_rerank_ms':statistics.median(t['rank_ms'] for t in trials) if trials else None,'retrieval_label':'local-only normalization ablation; no new SQL timing measured','cold_prepare_ms':raw.get('startup_ms')},
                    'diagnostics':{'input':str(path),'method':raw.get('method'),'pool_size':c.get('pool_size'),'phrase_polarity_frozen':raw.get('phrase_polarity_frozen'),'selected_phrases':run.get('selected_phrases'),'candidate_keys':run.get('selected_candidate_keys'),'trials':trials,'max_local_ms':run.get('max_local_ms'),'top5_changed':c.get('top5_changed')}}
            review=reviewed.get((c['request'],c['kind']))
            if review:cc['assessments']=[{'source':'Independent normalization-only review',**review}]
            groups[group]['cases'].append(cc)
        rounds.extend(groups.values())
    ledger['actual_api_calls']=len(ledger['calls']);ledger['actual_api_spend_usd']=sum(c['cost_usd'] for c in ledger['calls'])
    for rr in rounds:
        review = 'cheap-loop-hygiene-ablation-independent-review.json' if rr['family']=='Hygiene' else 'cheap-loop-shortlist-independent-review.json' if rr['family']=='Shortlist' else 'cheap-loop-native1-independent-review.json' if rr['family']=='Native SQL' else 'cheap-loop-preconjunction-supplemental-independent-review.json' if rr['family']=='Supplemental native' and 'SUPERSEDED' not in rr['name'] else 'cheap-loop-jev-independent-review.json' if rr['family']=='Paired interpretation' else None
        if review and (DOCS/review).exists():
            by={c['request']:c for c in read(DOCS/review)['cases']}
            for c in rr['cases']:
                if c['request'] in by:c['assessments']=[{'source':review,**by[c['request']]}]
    return {'rounds':rounds,'spend_ledger':ledger}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=PRIVATE/'review-adapted.json');args=parser.parse_args()
    data=adapt();args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    (DOCS/'cheap-loop-spend.json').write_text(json.dumps(data['spend_ledger'],ensure_ascii=False,indent=2)+'\n')
    print(args.output)
