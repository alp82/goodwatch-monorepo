"""Independent retained-result checks; no model/scoring runner invocation."""
import json,math,hashlib,gzip
from pathlib import Path
P=Path(__file__).parent;B=P.parent
def read(p):return json.loads(p.read_bytes())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def z(a):
 if not a:return []
 avg=sum(a)/len(a);sd=math.sqrt(sum((x-avg)**2 for x in a)/len(a))
 return [(x-avg)/sd for x in a] if sd>1e-12 else [0.0]*len(a)
def equal(a,b):
 assert len(a)==len(b)
 assert all(math.isfinite(x) and math.isfinite(y) and abs(x-y)<1e-12 for x,y in zip(a,b))
r=read(P/'rankings.json');prior=read(B/'local-fingerprint-common-union-study-20261013/rankings.json');previous={q['id']:q for q in prior['queries']}
titles=json.loads(gzip.decompress((B/'index-readonly-acquisition-20261013/verified-index/title_table.json.gz').read_bytes()))['point_ids'];order={v:i for i,v in enumerate(titles)}
prepared={q['id']:q for q in read(B/'offline-prepared-inputs-20261013/prepared-with-filters.json')['rows']};mm={q['id']:q for q in read(B/'offline-prepared-inputs-20261013/filter-mask-manifest.json')['masks']};masks=(B/'offline-prepared-inputs-20261013/filter-masks.bin').read_bytes();valid=(B/'offline-raw-fingerprint-matrices-20261013/valid-fingerprint.u8').read_bytes();available={q['id']:q for q in read(B/'common-union-analysis-20261013/signal-input-availability.json')['rows']}
assert len(r['queries'])==101 and len({q['id'] for q in r['queries']})==101
assert sum(bool(q['facetTexts']) for q in r['queries'])==36 and sum(bool(q['coverageUnits']) for q in r['queries'])==34
modes=['C0-base','CX-base','CX-facets','CX-incomplete-dense-coverage','CX-facets-incomplete-dense-coverage'];maxerr=0;columns=0;poolmax=0
for q in r['queries']:
 p=prepared[q['id']];a=available[q['id']];assert not p['nonEnglish'] and not p['reference'];assert q['facetTexts']==a['facetTexts'] and q['coverageUnits']==a['coverageUnits'];assert len(q['facetTexts'])<=2 and len(q['coverageUnits'])<=4
 assert q['readingVector']==previous[q['id']]['readingVector'] and q['readingWeights']==previous[q['id']]['readingWeights']
 assert q['variants']['C0-base']==previous[q['id']]['variants']['common-union-fingerprint']
 pools=q['candidatePools'];assert pools['union']==previous[q['id']]['candidatePools']['union'];assert set(pools['union'])==set(pools['dense'])|set(pools['fingerprint'])
 ids=pools['expanded'];poolmax=max(poolmax,len(ids));assert ids==sorted(set(ids),key=order.get) and len(ids)<=2800;assert set(ids)==set(pools['union'])|{v for part in pools['partials'] for v in part['ids']}
 mask=mm[q['id']];raw=masks[mask['offset']:mask['offset']+mask['bytes']];assert all(raw[order[v]]==1 and valid[order[v]]==1 for v in ids)
 c=q['partialComponents'];assert c['populationIds']==ids and c['unitBm25Observed'] is False
 assert [x['text'] for x in c['facetColumns']]==q['facetTexts'] and [x['text'] for x in c['unitColumns']]==q['coverageUnits']
 for column in c['facetColumns']+c['unitColumns']:equal(z(column['cosines']),column['populationZ']);columns+=1
 f=[sum(x['populationZ'][i] for x in c['facetColumns'])/len(c['facetColumns']) if c['facetColumns'] else 0 for i in range(len(ids))]
 minimum=[min(x['populationZ'][i] for x in c['unitColumns']) if c['unitColumns'] else 0 for i in range(len(ids))]
 coverage=z(minimum) if c['unitColumns'] else [0]*len(ids);equal(f,c['facetMeanZ']);equal(minimum,c['unitMinimum']);equal(coverage,c['incompleteCoverageZ'])
 base={x['id']:x['score'] for x in q['baseScores']['CX']};assert set(base)==set(ids);assert set(q['variants'])==set(modes)
 for mode,fw,cw in [('CX-base',0,0),('CX-facets',.1,0),('CX-incomplete-dense-coverage',0,.3),('CX-facets-incomplete-dense-coverage',.1,.3)]:
  expected=sorted([{'id':v,'score':base[v]+fw*f[i]+cw*coverage[i]} for i,v in enumerate(ids)],key=lambda x:(-x['score'],order[x['id']]))[:100]
  actual=q['variants'][mode];assert [x['id'] for x in expected]==[x['id'] for x in actual]
  for x,y in zip(expected,actual):maxerr=max(maxerr,abs(x['score']-y['score']));assert abs(x['score']-y['score'])<1e-12
out={'schema':'local-facet-incomplete-coverage-result-validation.v1','rankingSha256':sha(P/'rankings.json'),'queries':101,'facetQueries':36,'unitQueries':34,'checkedPartialColumns':columns,'maxExpandedPool':poolmax,'allPoolsMaskedUniqueAligned':True,'allC0ScoresAndIdsExactPrior':True,'allFiveVariantTop100Validated':True,'maxComponentScoreError':maxerr,'unitBm25Observed':False,'incompleteCoverage':True,'productionAcceptance':False,'qualification':'Reconstructs retained component arithmetic/pools/masks/gates and top100; does not rerun full dense scans or observe production Qdrant/BM25.'}
with (P/'actual-v2-result-validation.json').open('x') as f:f.write(json.dumps(out,indent=2)+'\n')
(P/'actual-v2-result-validation.json').chmod(0o600);print(json.dumps(out))
