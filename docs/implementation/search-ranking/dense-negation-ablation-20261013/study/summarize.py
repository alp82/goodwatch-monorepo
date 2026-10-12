import json,hashlib,gzip,collections,statistics
from pathlib import Path
P=Path(__file__).parent;R=Path('/home/alper/projects/goodwatch-monorepo');A=R/'docs/prototypes/search-arena'
x=json.loads((P/'metrics-v2.json').read_bytes());rank=json.loads((P/'rankings-v2.json').read_bytes());qs={q['id']:q for q in json.loads((A/'queries.json').read_bytes())}
out={'schema':'search.local-dense-negation-summary.v1','productionAcceptance':False,'currentFinalOverlap':None,'includedQueries':len(rank['queries']),'gradedQueries':x['coverage']['gradedQueries'],'exclusionCounts':dict(collections.Counter(a['reason'] for a in rank['excluded'])),'byMode':x['byMode'],'byClass':x['byClass'],'bySplit':x['bySplit'],'historicalPaired':{},'titleGuardrails':[],'sameMaskViolations':0,'negationQueries':sum(bool(q['negated']) for q in rank['queries']),'eraQueries':sum(q['era'] is not None for q in rank['queries']),'rowFilteredQueries':sum(q['eligibleRows']<42934 for q in rank['queries']),'localComputeMs':{},'currentFullPipelineMeasured':False}
for mode in rank['queries'][0]['variants']:
 out['historicalPaired'][mode]={}
 for ref in x['referenceBindings']:
  rows=[r for r in x['rows'] if r['mode']==mode and ref in r['historicalComparisons']];n=len(rows)
  out['historicalPaired'][mode][ref]={'pairedQueries':n,'referenceAvailableQueries':x['referenceBindings'][ref]['queries'],'ablationNdcg10':sum(r['ndcg10'] for r in rows)/n if n else None,'referenceNdcg10':sum(r['historicalComparisons'][ref]['referenceMetrics']['ndcg10'] for r in rows)/n if n else None,'ablationBad5':sum(r['bad5'] for r in rows),'referenceBad5':sum(r['historicalComparisons'][ref]['referenceMetrics']['bad5'] for r in rows),'ablationUnjudgedTop10':sum(r['unj10'] for r in rows),'referenceUnjudgedTop10':sum(r['historicalComparisons'][ref]['referenceMetrics']['unj10'] for r in rows),'meanTop20Shared':sum(r['historicalComparisons'][ref]['top20Shared'] for r in rows)/n if n else None,'currentBuildComparison':False}
maskp=Path('/home/alper/projects/search-100-evidence/offline-prepared-inputs-20261013');mb=(maskp/'filter-masks.bin').read_bytes();mm={m['id']:m for m in json.loads((maskp/'filter-mask-manifest.json').read_bytes())['masks']}
t=json.loads(gzip.decompress(Path('/home/alper/projects/search-100-evidence/index-readonly-acquisition-20261013/verified-index/title_table.json.gz').read_bytes()));rowof={i:r for r,i in enumerate(t['point_ids'])}
for q in rank['queries']:
 m=mm[q['id']];mask=mb[m['offset']:m['offset']+m['bytes']]
 for lst in q['variants'].values():out['sameMaskViolations']+=sum(not mask[rowof[v['id']]] for v in lst)
 if qs[q['id']]['type']=='title_lookup':
  anchors={(2_000_000_000_000 if a['media_type'] in ('show','tv') else 1_000_000_000_000)+a['tmdb_id'] for a in qs[q['id']]['anchors']['must'] if isinstance(a.get('tmdb_id'),int)}
  out['titleGuardrails'].append({'id':q['id'],'rankOneExpectedTitle':{k:bool(v and v[0]['id'] in anchors) for k,v in q['variants'].items()}})
times=sorted(r['computeMs'] for r in rank['queries']);out['localComputeMs']={'median':statistics.median(times),'p95OrderStatistic':times[int((len(times)-1)*.95)],'maximum':max(times),'scope':'one local dense scan plus optional negative scans, three variant sorts; excludes index loading, encoding, catalog, member taste, reading, delivery and contention'}
(P/'summary-v2.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'included':out['includedQueries'],'graded':out['gradedQueries'],'maskViolations':out['sameMaskViolations'],'historicalPairs':{k:v['pairedQueries'] for k,v in out['historicalPaired']['dense-negation-priors'].items()}}))
