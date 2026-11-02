"""Combine request-intent audits, preserving evidence and validating schema references."""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

HERE=Path(__file__).resolve().parent
SCHEMA=HERE.parents[1]/'draft-3'
load=lambda p:json.loads(p.read_text())
metadata=load(SCHEMA/'metadata.schema.json')
registry=load(SCHEMA/'definition.json')['attribute_groups']
fields={g+'.'+k for g,attrs in registry.items() for k in attrs}

def resolve(node):
    while '$ref' in node:node=metadata['$defs'][node['$ref'].split('/')[-1]]
    return node

def exists(path):
    if path in fields:return True
    node=metadata
    try:
        for part in path.split('.'):
            node=resolve(node)['properties'][part.replace('[]','')]
            if part.endswith('[]'):node=resolve(node)['items']
        return True
    except KeyError:return False

all_rows=[]
for branch in ['movies','tv','niche','root']:
    rows=load(HERE/(branch+'.json'))
    for row in rows:
        assert row['access_level'] in {'search_excerpt','post','post_and_comments'}
        assert row['support'] in {'represented','partial','gap','non_schema'}
        assert row['priority'] in {'high','medium','low','none'}
        assert row['predicates'] and row['request_excerpt'] and row['failure_reason']
        for field in row['existing_fields']:assert exists(field),(row['id'],field)
        m=re.search(r'reddit.com/r/([^/]+)/comments/([^/]+)',row['url']);assert m,row['url']
        assert row['subreddit'].removeprefix('r/').lower()==m[1].lower(),row['id']
        all_rows.append({**row,'branch':branch,'thread_id':m[2]})
assert len({r['id'] for r in all_rows})==len(all_rows)
unique={}
for row in all_rows:
    if row['thread_id'] in unique:
        unique[row['thread_id']]['also_assessed_as'].append(row['id'])
    else:unique[row['thread_id']]={**row,'also_assessed_as':[]}
# Root directly confirmed this previously excerpt-only case. Keep branch evidence unchanged.
unique['1vygr9y']['root_validation']='Post and comments opened; exact snow-as-obstacle request confirmed.'
rows=list(unique.values())
log=[]
for branch in ['movies','tv','niche']:
    log+=load(HERE/(branch+'-searches.json'))
queries=[r for r in log if r.get('query') is not None and 'Google direct' not in r['engine']]
root=load(HERE/'root-searches.json')
query_texts=[r['query'] for r in queries]+[r['query'] for r in root['fallback_queries']]
summary={'date':'2026-10-24','researchers':'three gpt-6.1-sol agents plus root synthesis',
 'branch_case_counts':dict(Counter(r['branch'] for r in all_rows)),
 'case_records':len(all_rows),'unique_threads':len(rows),'duplicate_records':len(all_rows)-len(rows),
 'subreddits':dict(sorted(Counter(r['subreddit'] for r in rows).items())),
 'web_search_query_executions':len(query_texts),'distinct_web_search_queries':len(set(query_texts)),
 'google_attempts':{'agent_attempts':3,'root_http_probes':2,'outcome':'Consent or JavaScript redirect/interstitial; no usable search results'},
 'branch_access_counts':dict(Counter(r['access_level'] for r in rows)),
 'direct_open_unique_threads':sum(r['access_level']!='search_excerpt' or bool(r.get('root_validation')) for r in rows),
 'support_labels':dict(Counter(r['support'] for r in rows)),
 'gap_kinds':dict(Counter(r['gap_kind'] for r in rows)),
 'interpretation':'Purposive request-intent audit, not representative prevalence, movie-fact verification or measured retrieval performance. Existing fields means schema support, not deployed capability.'}
(HERE/'cases.json').write_text(json.dumps(rows,indent=2)+'\n')
(HERE/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with (HERE/'cases.csv').open('w',newline='') as f:
 keys=['id','subreddit','url','title','request_summary','predicates','existing_fields','support','gap_kind','failure_reason','proposed_change','priority','access_level','root_validation']
 w=csv.DictWriter(f,fieldnames=keys);w.writeheader()
 for r in rows:w.writerow({k:' | '.join(r.get(k,[])) if isinstance(r.get(k),list) else r.get(k,'') for k in keys})
for path,digest in load(HERE/'schema-bindings.json').items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest,path
print(json.dumps(summary,indent=2))
