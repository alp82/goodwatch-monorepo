#!/usr/bin/env python3
"""THROWAWAY baseline capture: existing dev endpoints, no database writes."""
import argparse, datetime, hashlib, json, pathlib, subprocess, time, urllib.parse, urllib.request
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def key(row):
    kind = row.get('media_type', row.get('type'))
    return f"{'show' if kind == 'tv' else kind}:{row.get('tmdb_id', row.get('id'))}"

def render(data):
    template = (HERE/'review-template.html').read_text()
    (HERE/'review.html').write_text(template.replace('/*BASELINE*/', 'const baseline = '+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+';'))

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',default='http://localhost:3003')
parser.add_argument('--previous',type=pathlib.Path)
parser.add_argument('--render-only',action='store_true')
args=parser.parse_args()
if args.render_only:
    render(json.loads((HERE/'baseline.json').read_text())); raise SystemExit
fixtures=json.loads((HERE/'fixtures.json').read_text())
previous=json.loads(args.previous.read_text()) if args.previous else {'cases':[]}
old={c['fixture']['id']:c for c in previous['cases']}
source_files=['goodwatch-webapp/app/routes/prototype.combined-search.tsx','goodwatch-webapp/app/server/prototype-combined-d4.server.ts']
data={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
      'source_sha256':{f:digest(ROOT/f) for f in source_files},
      'fixture_sha256':digest(HERE/'fixtures.json'), 'environment':args.base_url,
      'scope':'Separate TMDB title and D4+ description paths, NOT blended UI or production acceptance. HTTP wall time includes local dev overhead. USD is module-reported Jev estimate only; excludes infrastructure and title API. No translation. Mutable model alias and live catalog prevent bit-for-bit replay.',
      'configuration':{'routing':False,'description_vote_floor':2000,'description_model':'jev-latest','title_include_adult':False,'top_n':10},
      'cases':[]}
for fixture in fixtures:
    params=urllib.parse.urlencode({'q':fixture['query'],'kind':'titles' if fixture['kind']=='title' else 'description','_data':'routes/prototype.combined-search'})
    start=time.perf_counter()
    try:
        with urllib.request.urlopen(args.base_url+'/prototype/combined-search?'+params,timeout=45) as response:
            body=json.load(response)
    except Exception as error:
        body={'error':str(error)}
    rows=body.get('results',[])[:10]
    ids=[key(r) for r in rows]
    violations=[]
    if fixture['expected_first'] and (not ids or ids[0]!=fixture['expected_first']):
        violations.append('Intended title is not first')
    for row in rows:
        exclusions=fixture['explicit_exclusions']
        if 'movie' in exclusions and row.get('media_type',row.get('type'))=='movie':
            violations.append(key(row)+': movie returned for a show-only request')
        if 'animation' in exclusions and 'Animation' in row.get('genres',[]):
            violations.append(key(row)+': Animation genre violates exclusion')
        if 'horror' in exclusions and 'Horror' in row.get('genres',[]):
            violations.append(key(row)+': Horror genre violates exclusion')
    prior=old.get(fixture['id'])
    case={'fixture':fixture,'http_ms':round((time.perf_counter()-start)*1000), 'response':body,
          'top10_ids':ids,'violations':violations,
          'constraint_review':'Other semantic exclusions require human review; metadata checks are incomplete.',
          'judgments':{k:None for k in ids},
          'status':'error' if body.get('error') else 'fail' if violations else 'needs review',
          'comparison':None if not prior else {'previous_ids':prior['top10_ids'],'order_changed':ids!=prior['top10_ids'],'new_ids':[k for k in ids if k not in prior['top10_ids']], 'previous_judgments':prior.get('judgments',{}),'previous_minimum':prior['fixture'].get('minimum_acceptable')}}
    data['cases'].append(case)
    (HERE/'baseline.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(f"{fixture['id']}: {len(rows)} results, {case['http_ms']} ms, {case['status']}",flush=True)
render(data)
