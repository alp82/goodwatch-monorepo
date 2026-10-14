#!/usr/bin/env python3
"""Diagnostic ablation: same LLM checks early accepts instead of trusting them.

Reuses existing fallback responses; no threshold/prompt tuning against labels.
This script imports no gold labels and adds no candidates from annotations.
"""
from match import *

def main():
    predictions={x['id']:x for x in load('predictions.json')}
    previous={x['id']:x for x in load('verified.json')} if (DATA/'verified.json').exists() else {}
    def one(item):
        if item['id'] in previous:return previous[item['id']]
        p=predictions[item['id']]
        if p['chain_vector'] is None:
            return {'id':item['id'],'result':p['llm'],'reused':True}
        if p['official']:
            return {'id':item['id'],'result':{'key':p['official'],'skipped':'exact official video crosswalk'},'reused':True}
        return {'id':item['id'],'result':llm(item,p['candidates']),'reused':False}
    rows=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for row in pool.map(one,load('sample.json')):
            rows.append(row);dump('verified.json',rows)
            print(row['id'],'verified',flush=True)

if __name__=='__main__':main()
