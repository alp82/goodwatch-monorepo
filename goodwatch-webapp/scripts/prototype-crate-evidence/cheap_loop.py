"""Offline cheap-search ablations. Only unchanged original Jev + original pools.
No network/DB/model dependencies. Earlier paid planner/reranker files are never read.
"""
import argparse
import hashlib
import json
import math
import re
import statistics
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRIVATE = HERE / 'private'
ROOT = HERE.parents[2]
FIELDS = {'essence_text': 1., 'synopsis': .9, 'essence_tags': .8, 'keywords': .45, 'trope_names': .2}
BASELINES = ['original', 'corrected', 'standard', 'english', 'english_boost2', 'english_phrase']
CONFIGS = {
 'a_d4': ('english', 'd4'),
 'b_anchor_fusion': ('english', 'anchor'),
 'c_centrality': ('english', 'centrality'),
 'd_informative_coverage': ('english', 'coverage'),
 'c_phrase_pool': ('english_phrase', 'centrality'),
 'e_bounded_union': ('union', 'coverage'),
}


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def tokens(value):
    words = re.findall(r'\w+', value.lower())
    return [w[:-3]+'y' if len(w)>4 and w.endswith('ies') else w[:-1] if len(w)>3 and w.endswith('s') and not w.endswith(('ss','us','is')) else w for w in words]


def index_row(row):
    fields = {}
    for name in FIELDS:
        value = row.get(name) or ''
        if isinstance(value, list): value = '\n'.join(value)
        parts = tokens(value)
        fields[name] = (' ' + ' '.join(parts) + ' ', set(parts))
    return fields


def d4(row, weights):
    scores = row['fingerprint_scores']
    numerator = denominator = raw = 0.
    for key, weight in weights.items():
        value = scores.get(key)
        value = .5 if value is None else min(1., max(0., value / 10))
        numerator += abs(weight) * (value if weight >= 0 else 1-value)
        denominator += abs(weight)
        raw += weight * value * 10
    return numerator / denominator if denominator else .5, raw


def negative_phrase(phrase, request):
    """Conservative surface negation only, without inferring new semantic facets."""
    q = tokens(phrase); source = tokens(request)
    at = 0; positions = []
    for word in q:
        found = next((i for i in range(at,len(source)) if source[i]==word), None)
        if found is None: return False
        positions.append(found); at = found+1
    if not positions: return False
    preceding = source[max(0,positions[0]-10):positions[0]]
    if 'but' in preceding: preceding = preceding[len(preceding)-1-preceding[::-1].index('but')+1:]
    return any(w in ('not','no','without','never','nothing') for w in preceding) or ('don' in preceding and 'want' in preceding)


def phrases(case, selective=False):
    source = [p for p in case['attributes']['phrases'] if p['probability']>0]
    maximum = max((p['probability'] for p in source), default=0)
    threshold = max(.12, .35*maximum) if selective else .1
    selected = []
    for p in source:
        if p['probability'] < threshold or negative_phrase(p['phrase'], case['request']): continue
        words = tokens(p['phrase'])
        if not words: continue
        selected.append({**p, 'tokens': words, 'surface_negated': False})
    return selected[:6]


def phrase_features(entry, phrase):
    words = phrase['tokens']; query = ' '+' '.join(words)+' '; query_set = set(words)
    best = 0.; matches = []
    for name, (text, word_set) in entry.items():
        exact = query in text
        coverage = len(query_set & word_set)/len(query_set)
        match = 1. if exact else .35 if coverage==1 else .15*coverage
        strength = FIELDS[name]*match
        if strength:
            matches.append({'field':name,'phrase':phrase['phrase'],'ordered_phrase':exact,'token_coverage':coverage,'strength':strength})
            best=max(best,strength)
    return best, matches


def rank(case, keys, rows, indexed, mode, anchors, limit=60):
    start=time.perf_counter()
    selected=phrases(case, mode=='coverage') if mode in ('centrality','coverage') else []
    work=[]
    for key in keys:
        fitness, weighted_sum=d4(rows[key],case['weights'])
        strengths=[]; evidence=[]
        for phrase in selected:
            strength, matches=phrase_features(indexed[key],phrase)
            strengths.append(strength); evidence.extend(matches)
        work.append({'key':key,'d4_fitness':fitness,'d4_weighted_sum':weighted_sum,'strengths':strengths,'evidence':evidence})
    # Request-local document frequency: same available fields, no learned aliases.
    dfs=[sum(w['strengths'][i] >= .35 for w in work) for i in range(len(selected))]
    informative=[p['probability']*(.25+.75*math.log1p(len(work)/(1+df))/math.log1p(max(1,len(work)))) for p,df in zip(selected,dfs)]
    d4_order=sorted(work,key=lambda w:(-w['d4_fitness'],w['key']))
    d4_ranks={w['key']:i+1 for i,w in enumerate(d4_order)}
    for w in work:
        if mode=='d4': score=w['d4_fitness']
        elif mode=='anchor':
            # Missing anchor means outside OBSERVED top10, not zero lexical score.
            score=60/(60+d4_ranks[w['key']]) + (.35*60/(60+anchors[w['key']]) if w['key'] in anchors else 0)
        else:
            weights=informative if mode=='coverage' else [p['probability'] for p in selected]
            mean=sum(x*y for x,y in zip(w['strengths'],weights))/sum(weights) if sum(weights) else 0
            coverage=sum(x>=.35 for x in w['strengths'])/len(selected) if selected else 0
            lexical=mean if mode=='centrality' else .8*mean+.2*coverage
            score=.65*lexical+.35*w['d4_fitness'] if selected else w['d4_fitness']
            w.update(lexical_score=lexical,concept_coverage=coverage)
        w['score']=score
        w['anchor_rank']=anchors.get(w['key'])
    work.sort(key=lambda w:(-w['score'],w['key']))
    return work, (time.perf_counter()-start)*1000, selected


def bounded_union(pools, rows, case, cap=400):
    """Round-robin source membership, each source ordered by unchanged D4 only."""
    ordered={v:sorted(set(keys),key=lambda k:(-d4(rows[k],case['weights'])[0],k)) for v,keys in pools.items()}
    output=[];seen=set()
    for i in range(max(map(len,ordered.values()),default=0)):
        for v in BASELINES:
            if i<len(ordered[v]) and ordered[v][i] not in seen:
                key=ordered[v][i];seen.add(key);output.append(key)
                if len(output)>=cap:return output
    return output



ROUND2 = {
 'r2_field_boundaries': ('english','fields2'),
 'r2_conjunctive': ('english','conjunctive'),
 'r2_anti_compensation': ('english','anti'),
 'r2_confidence_route': ('english','route'),
 'r2_phrase_pool': ('english_phrase','route'),
}


def index_row2(row):
    fields={}
    for name in FIELDS:
        values=row.get(name) or []
        if isinstance(values,str):values=[values]
        fields[name]=[(' '+' '.join(tokens(v))+' ',set(tokens(v))) for v in values if v]
    return fields


def negative_phrase2(phrase,request):
    # Negation cannot leak across sentence/list-clause punctuation.
    query=tokens(phrase)
    for clause in re.split(r'[,.!?;:]',request):
        source=tokens(clause);at=0;positions=[]
        for word in query:
            found=next((i for i in range(at,len(source)) if source[i]==word),None)
            if found is None:break
            positions.append(found);at=found+1
        if len(positions)!=len(query) or not positions:continue
        preceding=source[max(0,positions[0]-10):positions[0]]
        if 'but' in preceding:preceding=preceding[len(preceding)-preceding[::-1].index('but'):]
        return any(w in ('not','no','without','never','nothing') for w in preceding) or ('don' in preceding and 'want' in preceding)
    return False


def phrases2(case):
    original=[p for p in case['attributes']['phrases'] if p['probability']>0]
    maximum=max((p['probability'] for p in original),default=0)
    kept=[{**p,'tokens':tokens(p['phrase'])} for p in original if p['probability']>=max(.12,.35*maximum) and not negative_phrase2(p['phrase'],case['request'])]
    return [p for p in kept if p['tokens']][:6]


def field_match2(entry,phrase):
    words=phrase['tokens'];q=set(words);needle=' '+' '.join(words)+' ';best=0.;evidence=[]
    for field,items in entry.items():
        for text,word_set in items:
            exact=needle in text;coverage=len(q&word_set)/len(q)
            # Same metadata item only. Words from separate trope/tag rows never
            # combine into a phrase; prose all-word proximity is measured.
            proximity=0.
            if coverage==1 and not exact:
                document=text.split();locations=[i for i,w in enumerate(document) if w in q]
                spans=[locations[j+len(q)-1]-locations[j]+1 for j in range(max(0,len(locations)-len(q)+1)) if q<=set(document[locations[j]:locations[j+len(q)-1]+1])]
                proximity=len(q)/min(spans) if spans else 0
            match=1. if exact else .3+.4*proximity if coverage==1 else .1*coverage
            cap=.5 if field in ('keywords','trope_names') else FIELDS[field]
            strength=min(cap,FIELDS[field]*match)
            if strength>best:best=strength
            if strength>=.1:evidence.append({'field':field,'phrase':phrase['phrase'],'ordered_phrase':exact,'token_coverage':coverage,'proximity':proximity,'strength':strength})
    return best,evidence


def polarity_fitness(row,weights):
    positive=[];negative=[]
    maxpositive=max((w for w in weights.values() if w>0),default=1)
    for key,w in weights.items():
        value=(row['fingerprint_scores'].get(key,5))/10
        if w>0:positive.append((w,value,key))
        elif w<0:negative.append((-w,value,key))
    p=sum(w*v for w,v,_ in positive)/sum(w for w,_,_ in positive) if positive else 1.
    n=sum(w*v for w,v,_ in negative)/sum(w for w,_,_ in negative) if negative else 0.
    core=[(w,v) for w,v,_ in positive if w>=.5*maxpositive]
    harmonic=sum(w for w,v in core)/sum(w/max(.1,v) for w,v in core) if core else p
    positive_joint=.6*p+.4*harmonic
    fitness=math.sqrt(max(0,positive_joint*(1-n))) if negative else positive_joint
    return fitness,{'positive_mean':p,'positive_harmonic':harmonic,'negative_violation':n,'fitness':fitness}


def rank2(case,keys,rows,indexed,mode,anchors,limit=60):
    start=time.perf_counter();selected=phrases2(case)
    groups=[]
    for i,p in enumerate(selected):
        overlapping=[g for g in groups if any(set(p['tokens'])&set(selected[j]['tokens']) for j in g)]
        merged={i}
        for g in overlapping:merged.update(g);groups.remove(g)
        groups.append(merged)
    concrete={word:w.get('concrete',0) for w in case['attributes']['split'] for word in (tokens(w['word']) if mode=='route3' else [w['word']])}
    phrase_focus=max((p['probability']*sum(concrete.get(w,0) for w in p['tokens'])/len(p['tokens']) for p in selected),default=0)
    positive_phrases=sum(p['probability']>=.025 and not negative_phrase2(p['phrase'],case['request']) for p in case['attributes']['phrases'])
    focus=phrase_focus/math.sqrt(max(1,positive_phrases))
    work=[]
    for key in keys:
        fitness,raw=d4(rows[key],case['weights']);balanced,polarity=polarity_fitness(rows[key],case['weights']);strengths=[];evidence=[]
        for p in selected:
            strength,matches=field_match2(indexed[key],p);strengths.append(strength);evidence.extend(matches)
        mean=sum(p['probability']*v for p,v in zip(selected,strengths))/sum(p['probability'] for p in selected) if selected else 0
        group_strengths=[max(strengths[i] for i in g) for g in groups]
        joint=.5*mean+.5*min(group_strengths) if group_strengths else 0
        if mode=='fields2':score=.65*mean+.35*fitness if selected else fitness
        elif mode=='conjunctive':score=.55*joint+.45*fitness if selected else fitness
        elif mode=='anti':score=.25*joint+.75*balanced if selected else balanced
        else:
            lexical_weight=.65 if focus>=.55 else .2 if focus>=.2 else .05
            if mode=='route3':
                # Strong same-item support can be meaningful for abstract moods too.
                # Require every retained distinct concept, not one compensating hit.
                reliable=bool(group_strengths) and min(group_strengths)>=.8
                lexical_weight=max(lexical_weight,.55 if reliable else .2)
            score=lexical_weight*joint+(1-lexical_weight)*balanced if selected else balanced
            # An observed baseline top10 anchor is only a bounded fallback signal.
            if focus<.2 and key in anchors and mode!='route3':score+=.06*(11-anchors[key])/10
        work.append({'key':key,'score':score,'d4_fitness':fitness,'d4_weighted_sum':raw,'lexical_score':mean,'joint_lexical':joint,'concept_coverage':sum(v>=.35 for v in group_strengths)/len(groups) if groups else 0,'evidence':evidence,'polarity':polarity,'literal_focus':focus,'concept_groups':[[selected[i]['phrase'] for i in sorted(g)] for g in groups],'anchor_rank':anchors.get(key)})
    work.sort(key=lambda w:(-w['score'],w['key']))
    return work,(time.perf_counter()-start)*1000,selected

ROUND3 = {
 'r3_route_fixed': ('english','route3'),
 'r3_anti_control': ('english','anti'),
 'r3_recall_route': ('recall60','route3'),
 'r3_recall_anti': ('recall60','anti'),
 'r3_recall200_anti': ('recall200','anti'),
}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',type=int,choices=(1,2,3),default=1)
    parser.add_argument('--round-name',default='Cheap round1 — original Jev deterministic ablations')
    parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/round1.json')
    parser.add_argument('--public',type=Path,default=ROOT/'docs/prototypes/crate-evidence/cheap-loop-round1.json')
    parser.add_argument('--repeats',type=int,default=3)
    args=parser.parse_args()
    configs=ROUND3 if args.phase==3 else ROUND2 if args.phase==2 else CONFIGS
    if args.phase==2:
        if args.output==PRIVATE/'cheap-loop/round1.json':args.output=PRIVATE/'cheap-loop/round2.json'
        if args.public==ROOT/'docs/prototypes/crate-evidence/cheap-loop-round1.json':args.public=ROOT/'docs/prototypes/crate-evidence/cheap-loop-round2.json'
        args.round_name='Cheap round2 — clause scope, concept coverage and fingerprint balance'
    if args.phase==3:
        args.output=PRIVATE/'cheap-loop/round3.json'
        args.public=ROOT/'docs/prototypes/crate-evidence/cheap-loop-round3.json'
        args.round_name='Cheap round3 — corrected evidence routing and expanded original-Jev recall'
    started=time.perf_counter()
    cases=json.loads((PRIVATE/'interpretations.json').read_text())
    controls=json.loads((PRIVATE/'comparison.json').read_text())
    sample=json.loads((PRIVATE/'sample.json').read_text())
    rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in sample}
    control_by={c['request']:c for c in controls}
    frozen={}
    for c in controls:
        frozen[c['request']]={v:max((r for r in c['runs'] if r['variant']==v and not r['warmup']),key=lambda r:r['repetition']) for v in BASELINES}
    needed=set(k for by_variant in frozen.values() for run in by_variant.values() for k in run['candidates'])
    assert needed <= rows.keys()
    recall=json.loads((PRIVATE/'cheap-loop/recall-round1.json').read_text()) if args.phase==3 else None
    recall_by={c['request']:c for c in recall['cases']} if recall else {}
    indexed={}
    startup_ms=(time.perf_counter()-started)*1000
    output={'schema_version':1,'status':'running','rounds':[{'name':args.round_name,'variants':[
        *[{'id':v,'label':'Original '+v,'status':'active','reason':'Unchanged frozen control.'} for v in BASELINES],
        *[{'id':v,'label':v,'status':'active','reason':'Deterministic ablation; awaiting independent review.'} for v in configs]],'cases':[]}],
        'overall':{'winner_id':None,'summary':'No winner selected. Original13 only; independent evidence review required.','limitations':[
            'Two original gated requests have empty saved pools and remain unavailable; no fabricated mood fallback.',
            'Only top10 original combined ranks/scores were recorded. Full candidate membership does not imply full original ranking.',
            'Membership varied across SQL repetitions for some cases. Last measured repetition is frozen consistently; no favorable-run selection.',
            'Historical retrieval timings are separate from newly measured local ranking times. No current retrieval, model, or database calls.',
            'Multi-concept signals are original Jev phrases, not extra semantic interpretation. Local polarity detection is conservative and fallible.']},
        'provenance':{'interpretations':'private/interpretations.json','candidate_pools':'private/comparison.json:last non-warm repetition per source','sample':'private/sample.json','sample_size':len(sample),'additional_model_calls':0,'additional_model_cost_usd':0,'paid_planner_or_reranker_artifacts_read':False},
        'startup_ms':startup_ms,'indexed_candidate_titles':len(indexed)}
    rich=[]
    for case in cases:
        request=case['request'];control=control_by[request];runs=frozen[request];pools={v:r['candidates'] for v,r in runs.items()}
        jev_cost=case['attributes']['usage']['usd']+case['reading']['usage']['usd']
        report={'id':hashlib.sha256(request.encode()).hexdigest()[:12],'request':request,'split':'development','original_interpretation':{'phrases':case['attributes']['phrases'],'split':case['attributes']['split'],'weights':case['weights'],'filters':case['filters']},'results':{},'assessment':{'preference':None,'assessment':'Pending independent original-request evidence review.','next_experiment':None}}
        full={'request':request,'pool_provenance':{v:{'repetition':r['repetition'],'membership_stable_across_prior_runs':control['summary'][v]['stable_candidates'],'keys':r['candidates']} for v,r in runs.items()},'variants':{},'candidate_evidence':{k:rows[k] for k in set().union(*(set(x) for x in pools.values()))}}
        for v in BASELINES:
            summary=control['summary'][v];top=[{**rows[r['key']],**r} for r in summary['top10']]
            report['results'][v]={'top10':top,'wall_ms':summary['median_wall_ms'],'cost_usd':jev_cost,'diagnostics':{'timing_kind':'frozen retrieval-only median','gated':summary['gated'],'candidate_count':summary['candidates'],'vector_fill':'not run','additional_model_cost_usd':0}}
        for ident,(source,mode) in configs.items():
            selection_started=time.perf_counter()
            keys=bounded_union(pools,rows,case) if source=='union' else recall_by[request]['union_'+('200' if source=='recall200' else '60')+'_keys'] if source.startswith('recall') else pools[source]
            selection_ms=(time.perf_counter()-selection_started)*1000
            anchors={r['key']:i+1 for i,r in enumerate(control['summary']['english']['top10'])}
            prep_started=time.perf_counter()
            indexed={key:(index_row2 if args.phase>=2 else index_row)(rows[key]) for key in keys} if mode not in ('d4','anchor') else {}
            preparation_ms=(time.perf_counter()-prep_started)*1000
            for key in keys:full['candidate_evidence'].setdefault(key,rows[key])
            trials=[]
            for repeat in range(args.repeats): ranked,wall,selected=(rank2 if args.phase>=2 else rank)(case,keys,rows,indexed,mode,anchors);trials.append(wall)
            local_ms=statistics.median(trials)+selection_ms+preparation_ms
            source_ms=max(control['summary'][v]['median_wall_ms'] for v in BASELINES) if source=='union' else control['summary']['english' if source.startswith('recall') else source]['median_wall_ms']
            top=[]
            for candidate in ranked[:10]:
                row=rows[candidate['key']]
                top.append({**row,**candidate,'year':row['release_year'],'reason':None,'score_explanation':{'method':mode,'d4_fitness':candidate['d4_fitness'],'lexical_score':candidate.get('lexical_score'),'coverage':candidate.get('concept_coverage'),'anchor_rank':candidate.get('anchor_rank')}})
            diagnostics={'pool_source':source,'candidate_count':len(keys),'original_jev_model_cost_usd':jev_cost,'additional_model_cost_usd':0,'local_rank_trials_ms':trials,'local_total_median_ms':local_ms,'local_pool_selection_ms':selection_ms,'candidate_preparation_ms':preparation_ms,'preparation_scope':'first-use normalization from already-loaded raw rows; charged independently to each variant','local_rank_only_median_ms':statistics.median(trials),'frozen_retrieval_ms':source_ms,'selected_original_jev_phrases':selected,'availability':'available' if keys else 'unavailable_original_gated_empty_pool','timing_kind':'frozen source retrieval + newly measured deterministic local processing','source_stability':{v:control['summary'][v]['stable_candidates'] for v in (BASELINES if source=='union' else ['english'] if source.startswith('recall') else [source])},'combined_anchor_coverage':'observed English top10 only' if mode=='anchor' else None}
            if source.startswith('recall'):
                arm=recall_by[request]['arms']
                recall_ms=arm['fingerprint_200']['diagnostics']['wall_ms']+arm['lexical_200']['diagnostics']['wall_ms']
                source_ms+=recall_ms
                diagnostics.update(recall_compute_ms=recall_ms,recall_cold_index_ms=recall['index_ms'],recall_index_assumption='shared corpus index built offline at sync; cold build excluded from per-query estimate and disclosed',pool_keys=keys,extra_retrieval_not_free=True)
            if source=='union':diagnostics.update(extra_retrieval_not_free=True,retrieval_projection='max six recorded retrieval medians assuming parallel execution; current concurrency/extra database work not measured',sum_source_retrieval_ms=sum(control['summary'][v]['median_wall_ms'] for v in BASELINES),cap=400)
            report['results'][ident]={'top10':top,'wall_ms':source_ms+local_ms,'cost_usd':jev_cost,'components_ms':{'frozen_retrieval':source_ms,'measured_local_processing':local_ms,'candidate_preparation':preparation_ms,'local_rank_only':statistics.median(trials)},'diagnostics':diagnostics}
            full['variants'][ident]={'ranked_candidates':ranked,'diagnostics':diagnostics}
        output['rounds'][0]['cases'].append(report);rich.append(full)
        save(args.output,output);save(args.public,output)
        print(json.dumps({'completed':len(rich),'request':request,'local_ms':{v:round(report['results'][v]['diagnostics']['local_total_median_ms'],2) for v in configs},'top3':{v:[r['title'] for r in report['results'][v]['top10'][:3]] for v in configs}},ensure_ascii=False),flush=True)
    if args.phase==3:
        output['overall']['limitations'][0]='Original two gated cases available only in expanded recall arms, using unchanged eligibility; no original English candidates fabricated.'
    output['status']='complete_pending_review';save(args.output,output);save(args.public,output)
    save(args.output.with_name(args.output.stem+'-candidate-evidence.json'),rich)


if __name__=='__main__':main()
