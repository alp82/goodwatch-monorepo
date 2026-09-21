"""Offline candidate recall from frozen50k + original Jev only. No network imports.
Local token/proximity ranking is NOT Lucene/Crate or production Qdrant parity.
"""
import argparse
import hashlib
import heapq
import json
import math
import re
import time
from collections import defaultdict
from pathlib import Path

HERE=Path(__file__).resolve().parent
PRIVATE=HERE/'private'
FIELDS={'essence_text':1.,'synopsis':.9,'essence_tags':.8,'keywords':.45,'trope_names':.2}
SOURCES=['interpretations.json','loop-challenge-interpretations.json','loop-confirmation-interpretations.json','loop-final-validation-interpretations.json']

def tokens(value):
    return [w[:-3]+'y' if len(w)>4 and w.endswith('ies') else w[:-1] if len(w)>3 and w.endswith('s') and not w.endswith(('ss','us','is')) else w for w in re.findall(r'\w+',value.lower())]

def selected_phrases(case):
    # Surface polarity guard only; same vocabulary as original interpretation.
    original=tokens(case['request']);out=[]
    spans=list(re.finditer(r'\w+',case['request'].lower()))
    for p in case['attributes']['phrases']:
        words=tokens(p['phrase'])
        if p['probability']<.1 or not words:continue
        starts=[i for i in range(len(original)-len(words)+1) if original[i:i+len(words)]==words]
        negated=False
        for i in starts:
            prefix=case['request'][:spans[i].start()]
            clause=re.split(r'[,;.!?]|\bbut\b',prefix,flags=re.I)[-1]
            preceding=tokens(clause)[-5:]
            if 'but' in preceding: preceding=preceding[len(preceding)-1-preceding[::-1].index('but')+1:]
            if any(w in ('not','no','without','never') for w in preceding):negated=True
        if not negated:out.append({**p,'tokens':words})
    return out[:6]

class RecallIndex:
    def __init__(self, sample, vocabulary):
        self.rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in sample}
        self.keys=sorted(self.rows)
        self.ids={k:i for i,k in enumerate(self.keys)}
        self.postings=defaultdict(set)
        self.positions={}
        # Keep positions only for frozen query vocabulary; no text duplication.
        for i,key in enumerate(self.keys):
            record={}
            for field in FIELDS:
                value=self.rows[key].get(field) or ''
                parts=value if isinstance(value,list) else value.split('\n')
                segments=[]
                for part in parts:
                    pos=defaultdict(list)
                    for at,token in enumerate(tokens(part)):
                        if token in vocabulary:pos[token].append(at);self.postings[token].add(i)
                    if pos:segments.append(dict(pos))
                if segments:record[field]=segments
            if record:self.positions[i]=record
        self.idf={t:math.log1p(len(self.keys)/(1+len(post))) for t,post in self.postings.items()}

    def lexical(self, phrases, allowed, cap=200):
        started=time.perf_counter();ids=set()
        for p in phrases:
            for t in p['tokens']:ids.update(self.postings.get(t,()))
        ids.intersection_update(allowed)
        work=[]
        for i in ids:
            score=0.; evidence=[];group_strengths={}
            for phrase_index,p in enumerate(phrases):
                words=p['tokens'];distinct=set(words);denom=sum(self.idf.get(t,math.log1p(len(self.keys))) for t in distinct) or 1
                best=0.;support=None
                for field,segments in self.positions[i].items():
                    for pos in segments:
                        present=distinct & pos.keys()
                        if not present:continue
                        coverage=sum(self.idf.get(t,0) for t in present)/denom
                        exact=all(t in pos for t in distinct) and any(all(start+j in pos.get(t,()) for j,t in enumerate(words)) for start in pos.get(words[0],()))
                        window=None
                        if len(present)==len(distinct):
                            # Minimal covering window; no crossings between tag items.
                            events=sorted((at,t) for t in distinct for at in pos[t]);counts=defaultdict(int);left=0
                            for right,(at,t) in enumerate(events):
                                counts[t]+=1
                                while len(counts)==len(distinct):
                                    width=at-events[left][0]+1;window=width if window is None else min(window,width)
                                    first=events[left][1];counts[first]-=1
                                    if not counts[first]:del counts[first]
                                    left+=1
                        proximity=(len(distinct)/window) if window else 0
                        strength=FIELDS[field]*(1. if exact else .55*coverage+.25*proximity)
                        if strength>best:
                            best=strength;support={'phrase':p['phrase'],'field':field,'ordered_phrase':bool(exact),'distinct_coverage':len(present)/len(distinct),'minimum_token_window':window,'strength':strength}
                group=p.get('concept_group',phrase_index)
                group_strengths[group]=max(group_strengths.get(group,0),p['probability']*best)
                if support:evidence.append(support)
            score=sum(group_strengths.values())
            if score:work.append({'key':self.keys[i],'score':score,'evidence':evidence})
        ranked=heapq.nsmallest(cap,work,key=lambda r:(-r['score'],r['key']))
        return ranked,{'wall_ms':(time.perf_counter()-started)*1000,'posting_union_eligible_count':len(ids),'scored_count':len(work)}

    def fingerprint(self, weights, allowed, cap=200):
        started=time.perf_counter()
        if not weights:return [],{'wall_ms':(time.perf_counter()-started)*1000,'scored_count':0,'skip_reason':'No original weights; avoid arbitrary zero-score recall.'}
        def scored():
            for i in allowed:
                key=self.keys[i];scores=self.rows[key]['fingerprint_scores']
                yield {'key':key,'score':sum(weight*(scores.get(dim) or 0) for dim,weight in weights.items()),'missing_requested_dimensions':sum(scores.get(dim) is None for dim in weights)}
        result=heapq.nsmallest(cap,scored(),key=lambda r:(-r['score'],r['key']))
        return result,{'wall_ms':(time.perf_counter()-started)*1000,'scored_count':len(allowed),'missing_score_policy':'zero, matching original experiment weighted sum'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/recall-round1.json')
    args=parser.parse_args();start=time.perf_counter()
    cases=[(source,c) for source in SOURCES for c in json.loads((PRIVATE/source).read_text())]
    eligibility=json.loads((PRIVATE/'cheap-loop-eligibility.json').read_text());eligible={c['request']:c for c in eligibility['cases']}
    sample_path=PRIVATE/'sample.json';sample_bytes=sample_path.read_bytes()
    if hashlib.sha256(sample_bytes).hexdigest()!=eligibility['sample_sha256']:raise ValueError('Eligibility snapshot hash mismatch')
    sample=json.loads(sample_bytes)
    controls=json.loads((PRIVATE/'comparison.json').read_text());english={}
    for case in controls:
        runs=[r for r in case['runs'] if r['variant']=='english' and not r['warmup']]
        english[case['request']]=max(runs,key=lambda r:r['repetition'])['candidates']
    plans={c['request']:selected_phrases(c) for _,c in cases}
    vocabulary={t for ps in plans.values() for p in ps for t in p['tokens']}
    loaded_ms=(time.perf_counter()-start)*1000;index_start=time.perf_counter();index=RecallIndex(sample,vocabulary)
    output={'schema_version':1,'status':'complete','startup_ms':None,'load_ms':loaded_ms,'index_ms':(time.perf_counter()-index_start)*1000,'sample_count':len(sample),'sample_sha256':eligibility['sample_sha256'],'index_vocabulary_size':len(vocabulary),'provenance':{'interpretations':SOURCES,'eligibility':'private/cheap-loop-eligibility.json','additional_model_calls':0,'additional_model_cost_usd':0,'network_calls':0,'paid_interpretations_used':False,'fingerprint_method':'Exact raw signed weighted sum; not Qdrant cosine','lexical_method':'Local plural-normalized tokens, source weights, phrase/proximity; not Lucene/BM25','eligibility_warning':eligibility['scope'],'pool_caps':[60,200]},'cases':[]}
    output['startup_ms']=(time.perf_counter()-start)*1000
    for source,case in cases:
        request=case['request'];allowed_keys=eligible[request]['allowed_keys'];allowed={index.ids[k] for k in allowed_keys};original=set(english.get(request,[]));arms={}
        fp,fpdiag=index.fingerprint(case['weights'],allowed);lex,lexdiag=index.lexical(plans[request],allowed)
        for name,ranked,diag in [('fingerprint',fp,fpdiag),('lexical',lex,lexdiag)]:
            for cap in (60,200):
                chosen=ranked[:cap];arms[f'{name}_{cap}']={'candidates':chosen,'candidate_count':len(chosen),'new_vs_frozen_english_count':sum(r['key'] not in original for r in chosen) if request in english else None,'diagnostics':{**diag,'cap':cap,'timing_scope':'One full top200 calculation shared by nested60/200 arms; do not sum both'}}
        output['cases'].append({'request':request,'split':'original13' if source==SOURCES[0] else 'supplemental28','interpretation_source':source,'phrases':plans[request],'weights':case['weights'],'filters':case['filters'],'eligible_count':len(allowed),'english_pool_keys':english.get(request),'arms':arms,'union_60_keys':sorted(original|{r['key'] for r in fp[:60]+lex[:60]}),'union_200_keys':sorted(original|{r['key'] for r in fp+lex}),'interpretation_cost_usd':case['attributes']['usage']['usd']+case['reading']['usage']['usd']})
    output['total_wall_ms']=(time.perf_counter()-start)*1000
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'path':str(args.output),'cases':len(output['cases']),'startup_ms':output['startup_ms'],'total_wall_ms':output['total_wall_ms']}))

if __name__=='__main__':main()
