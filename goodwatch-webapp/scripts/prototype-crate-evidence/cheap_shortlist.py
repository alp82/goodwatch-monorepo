"""Offline lexical-shortlist speed/quality ablation over saved native score pools.
No provider/database access. Charges selection, raw-field preparation and local rank.
"""
import argparse
import hashlib
import json
import statistics
import time
from pathlib import Path
from cheap_loop import index_row2,rank2

HERE=Path(__file__).resolve().parent
PRIVATE=HERE/'private'

def run(source,interpretations,sample,caps=(32,64,128),modes=('fields2','route3','anti'),repeats=3):
    started=time.perf_counter();rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in sample};by={c['request']:c for c in interpretations}
    output={'schema_version':1,'status':'complete_pending_review','startup_rowmap_ms':(time.perf_counter()-started)*1000,'provenance':{'selection':'native text score DESC,key ASC; last non-warm repetition per variant','caps':list(caps),'modes':list(modes),'additional_model_cost_usd':0,'network_calls':0,'preparation':'Each variant: one disclosed warmup plus at least3 measured full sorting+fresh normalization+rank trials from raw loaded rows; no forced GC or prepared-input cache','timing':'saved native retrieval plus local measured selection/preparation/rank; not live end-to-end','missing_score_policy':'Skip sources without full ranked_candidates; do not reconstruct full ranks from top10'},'cases':[]}
    for case in source['cases']:
        request=case['request'];interpretation=by[request];runs=case['runs'];sources={};results={};skipped=[]
        for variant in sorted({r['variant'] for r in runs}):
            eligible=[r for r in runs if r['variant']==variant and not r.get('warmup',False)]
            if not eligible:continue
            native=max(eligible,key=lambda r:r.get('repetition',0));pool=native.get('ranked_candidates')
            if pool is None:skipped.append(variant);continue
            if len(pool)!=len(native['candidates']) or {r['key'] for r in pool}!=set(native['candidates']):raise ValueError('Incomplete scored pool')
            if len(set(r['key'] for r in pool))!=len(pool):raise ValueError('Duplicate native keys')
            sources[variant]={'native_top10':sorted(pool,key=lambda r:(-r['combined'],r['key']))[:10],'candidate_count':len(pool),'repetition':native.get('repetition'),'wall_ms':native['wall_ms']}
            # Full native scores permit true full-list fusion; no text normalization.
            for cheap_mode in ('lexical_only','rrf60','lexical75_d425'):
                cheap_trials=[];cheap_warmup=None
                for trial in range(max(3,repeats)+1):
                    cheap_start=time.perf_counter()
                    lexical=sorted(pool,key=lambda r:(-r['text'],r['key']))
                    d4=sorted(pool,key=lambda r:(-r['weighted_sum'],r['key']))
                    lexical_rank={r['key']:i+1 for i,r in enumerate(lexical)}
                    d4_rank={r['key']:i+1 for i,r in enumerate(d4)}
                    lo=min((r['weighted_sum'] for r in pool),default=0)
                    hi=max((r['weighted_sum'] for r in pool),default=0)
                    text_max=max((r['text'] for r in pool),default=0)
                    rescored=[]
                    for r in pool:
                        if cheap_mode=='lexical_only':score=r['text']
                        elif cheap_mode=='rrf60':score=1/(60+lexical_rank[r['key']])+1/(60+d4_rank[r['key']])
                        else:score=.75*(r['text']/text_max if text_max else 0)+.25*((r['weighted_sum']-lo)/(hi-lo) if hi>lo else 0)
                        rescored.append({**r,'score':score,'lexical_rank':lexical_rank[r['key']],'d4_rank':d4_rank[r['key']]})
                    rescored.sort(key=lambda r:(-r['score'],r['key']))
                    cheap_ms=(time.perf_counter()-cheap_start)*1000
                    if trial==0:cheap_warmup=cheap_ms
                    else:cheap_trials.append(cheap_ms)
                cheap_ms=statistics.median(cheap_trials)
                results[f'{variant}_{cheap_mode}_full']={'top10':[{**rows[r['key']],**r} for r in rescored[:10]],'candidate_count':len(pool),'local_ms':cheap_ms,'local_max_ms':max(cheap_trials),'warmup_ms':cheap_warmup,'components_ms':{'selection':0,'preparation':0,'rank_median':cheap_ms,'rank_trials':cheap_trials,'saved_native_retrieval':native['wall_ms']},'projected_retrieval_plus_local_ms':native['wall_ms']+cheap_ms,'original_interpretation_cost_usd':interpretation['attributes']['usage']['usd']+interpretation['reading']['usage']['usd'],'scope':'Full native returned pool; raw aggregated text scores and raw original signed fingerprint weighted sum. No field preparation. Ties key ASC. RRF k60 equal arms; blend lexical/max and D4 minmax within pool.'}
            for cap in (*caps,None):
                for mode in modes:
                    trials=[];warmup=None
                    for trial in range(max(3,repeats)+1):
                        total_started=time.perf_counter()
                        select_start=time.perf_counter();chosen=sorted(pool,key=lambda r:(-r['text'],r['key']))[:cap];keys=[r['key'] for r in chosen];selection_ms=(time.perf_counter()-select_start)*1000
                        prep_start=time.perf_counter();indexed={k:index_row2(rows[k]) for k in keys};prep_ms=(time.perf_counter()-prep_start)*1000
                        ranked,rank_ms,phrases=rank2(interpretation,keys,rows,indexed,mode,{})
                        elapsed=(time.perf_counter()-total_started)*1000
                        measurement={'selection':selection_ms,'preparation':prep_ms,'rank':rank_ms,'total':elapsed}
                        if trial==0:warmup=measurement
                        else:trials.append(measurement)
                    total=statistics.median(t['total'] for t in trials)
                    top=[{**rows[r['key']],**r} for r in ranked[:10]]
                    label=f'{variant}_{mode}_{cap or "full"}'
                    results[label]={'top10':top,'candidate_count':len(keys),'candidate_keys':keys,'selected_phrases':phrases,'local_ms':total,'local_max_ms':max(t['total'] for t in trials),'fresh_processing_trials_ms':trials,'warmup_ms':warmup,'components_ms':{'selection':statistics.median(t['selection'] for t in trials),'preparation':statistics.median(t['preparation'] for t in trials),'rank_median':statistics.median(t['rank'] for t in trials),'saved_native_retrieval':native['wall_ms']},'projected_retrieval_plus_local_ms':native['wall_ms']+total,'original_interpretation_cost_usd':interpretation['attributes']['usage']['usd']+interpretation['reading']['usage']['usd']}
            for mode in modes:
                full=results[f'{variant}_{mode}_full'];fullkeys=[r['key'] for r in full['top10']]
                for cap in caps:
                    entry=results[f'{variant}_{mode}_{cap}'];got=[r['key'] for r in entry['top10']]
                    entry['full_rerank_top10_retained_in_pool']=sum(k in entry['candidate_keys'] for k in fullkeys)
                    entry['full_rerank_top10_overlap']=len(set(got)&set(fullkeys));entry['full_rerank_top5_exact']=got[:5]==fullkeys[:5]
                    entry['full_rerank_local_speedup']=full['local_ms']/entry['local_ms'] if entry['local_ms'] else None
        output['cases'].append({'request':request,'id':hashlib.sha256(request.encode()).hexdigest()[:12],'native_sources':sources,'skipped_sources_no_full_scores':skipped,'results':results})
        print(json.dumps({'completed':len(output['cases']),'request':request,'variants':len(results)}),flush=True)
    return output

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=PRIVATE/'cheap-loop/native-round1.json')
    parser.add_argument('--interpretations',type=Path,default=PRIVATE/'interpretations.json')
    parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/shortlist-round1.json')
    parser.add_argument('--repeats',type=int,default=3)
    args=parser.parse_args();start=time.perf_counter()
    source_bytes=args.input.read_bytes();source=json.loads(source_bytes);cases=json.loads(args.interpretations.read_text());sample=json.loads((PRIVATE/'sample.json').read_text());load_ms=(time.perf_counter()-start)*1000
    out=run(source,cases,sample,repeats=args.repeats);out['file_load_ms']=load_ms;out['total_ms']=(time.perf_counter()-start)*1000;out['provenance'].update(source_path=str(args.input),source_sha256=hashlib.sha256(source_bytes).hexdigest(),interpretations_path=str(args.interpretations))
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
