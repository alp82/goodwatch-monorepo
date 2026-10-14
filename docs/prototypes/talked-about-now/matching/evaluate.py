#!/usr/bin/env python3
"""Offline evaluation against manually annotated identities; never calls services."""
from spike import *
import math
import sqlite3

def gold():
    db=sqlite3.connect(DATA/'catalog.local.sqlite')
    result=[]
    for x in load('annotations.json')['items']:
        x=dict(x); keys=[]; unresolved=[]
        for name,year,kind in x['targets']:
            candidates={r['key']:r for row in db.execute('SELECT t.body FROM names n JOIN titles t ON n.key=t.key WHERE n.name=?',[norm(name)])
                        if (r:=json.loads(row[0]))['media_type']==kind and (year is None or r['release_year']==year)}
            if len(candidates)==1:keys.extend(candidates)
            elif candidates:unresolved.append({'title':name,'year':year,'candidates':list(candidates)})
            else:unresolved.append({'title':name,'year':year,'candidates':[]})
        x['gold']=x.get('gold_override',keys)
        x['unresolved_catalog_lookups']=unresolved
        if 'gold_override' not in x and any(u['candidates'] for u in unresolved) and not x.get('ambiguous'):
            raise ValueError('Manual identity selection still needed: '+x['id'])
        result.append(x)
    dump('labels.json',result)
    return result

def wilson(tp,n):
    if not n:return None
    z=1.96;p=tp/n;d=1+z*z/n
    center=(p+z*z/(2*n))/d
    delta=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [round(center-delta,4),round(center+delta,4)]

def stats(rows,stage):
    eligible=[r for r in rows if not r['label'].get('ambiguous')]
    tp=sum(bool(r['prediction'].get(stage)) and r['prediction'][stage] in r['label']['gold'] for r in eligible)
    predicted=sum(bool(r['prediction'].get(stage)) for r in eligible)
    positives=sum(bool(r['label']['gold']) for r in eligible)
    named_positives=sum(bool(r['label']['targets']) for r in eligible)
    return {'n':len(eligible),'ambiguous':len(rows)-len(eligible),'positives':positives,'tp':tp,'fp':predicted-tp,'fn':positives-tp,
            'precision':tp/predicted if predicted else None,'recall':tp/positives if positives else None,
            'precision_95_wilson':wilson(tp,predicted),'coverage':predicted/len(eligible) if eligible else None,
            'named_positive_items':named_positives,'end_to_end_recall':tp/named_positives if named_positives else None}

def main():
    labels={r['id']:r for r in load('labels.json')}
    preds={r['id']:r for r in load('predictions.json')}
    rows=[{'item':x,'label':labels[x['id']],'prediction':preds[x['id']]} for x in load('sample.json')]
    if (DATA/'verified.json').exists():
        verified={x['id']:x for x in load('verified.json')}
        for r in rows:r['prediction']['verified']=verified[r['item']['id']]['result']['key']
    stages=['chain_official','chain_fuzzy','chain_vector','chain_llm']
    if 'verified' in rows[0]['prediction']:stages+=['verified']
    report={source:{stage:stats([r for r in rows if source=='all' or r['item']['source']==source],stage) for stage in stages}
            for source in ['youtube','rss','bluesky','all']}
    # Item candidate recall is separate from decision recall.
    for source in report:
        group=[r for r in rows if (source=='all' or r['item']['source']==source) and r['label']['gold'] and not r['label'].get('ambiguous')]
        report[source]['candidate_recall']={kind:sum(bool(set(r['label']['gold']) & {c['key'] for c in r['prediction'][kind]}) for r in group)/len(group) if group else None
                                             for kind in ['lexical_candidates','vector_candidates','candidates']}
        scoped=[r for r in rows if source=='all' or r['item']['source']==source]
        report[source]['incremental_stages']={}
        previous=None
        for stage in ['chain_official','chain_fuzzy','chain_vector','chain_llm']:
            cohort=[r for r in scoped if previous is None or not r['prediction'][previous]]
            report[source]['incremental_stages'][stage]=stats(cohort,stage)
            previous=stage
    costs=[p['llm'].get('usage',{}) for p in preds.values()]
    extra=[x['result'].get('usage',{}) for x in load('verified.json') if not x['reused']] if (DATA/'verified.json').exists() else []
    def cost(usages):
        return {'calls':len([u for u in usages if u]),'prompt_tokens':sum(u.get('prompt_tokens',0) for u in usages),
                'completion_tokens':sum(u.get('completion_tokens',0) for u in usages),'observed_usd':sum(u.get('cost',0) for u in usages),
                'usd_per_1000_input_items':sum(u.get('cost',0) for u in usages)*1000/len(rows)}
    report['cost']={'waterfall':cost(costs),'verification_additional':cost(extra)}
    if extra:
        report['cost']['guarded_total']=cost(costs+extra)
    report['independent_vector_top1']={}
    for source in ['youtube','rss','bluesky','all']:
        group=[r for r in rows if (source=='all' or r['item']['source']==source) and not r['label'].get('ambiguous')]
        good=sum(bool(r['prediction']['vector_candidates']) and r['prediction']['vector_candidates'][0]['key'] in r['label']['gold'] for r in group)
        report['independent_vector_top1'][source]={'correct':good,'items':len(group),'precision':good/len(group) if group else None}
    for source in ['youtube','rss','bluesky']:
        group=[r for r in rows if r['item']['source']==source]
        us=[r['prediction']['llm'].get('usage',{}) for r in group]
        c=cost(us);c['usd_per_1000_input_items']=c['observed_usd']*1000/len(group) if group else None
        report[source]['cost']=c
        if (DATA/'verified.json').exists():
            additional=[x['result'].get('usage',{}) for x in load('verified.json') if not x['reused'] and x['id'] in {r['item']['id'] for r in group}]
            guarded=cost(us+additional);guarded['usd_per_1000_input_items']=guarded['observed_usd']*1000/len(group) if group else None
            report[source]['verified_cost']=guarded
    dump('metrics.json',report)
    dump('evaluation.json',rows)
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    if '--gold' in os.sys.argv:gold()
    else:main()
