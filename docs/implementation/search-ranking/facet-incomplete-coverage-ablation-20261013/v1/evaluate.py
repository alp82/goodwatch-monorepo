"""Local evidence metrics; no application import, model, service or query."""
import ast,hashlib,json,math
from pathlib import Path
from collections import defaultdict
HERE=Path(__file__).parent
REPO=Path('/home/alper/projects/goodwatch-monorepo')
ARENA=REPO/'docs/prototypes/search-arena'
def read(p): return json.loads(p.read_bytes())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
bindings=read(HERE/'input-bindings.json')
assert sha(HERE/'input-bindings.json')=='5963fab9fc317c09c59698a197821ec96db53ae468ae312b6501c2e9916f28e6'
for path,expected in bindings['files'].items():
 p=Path(path) if Path(path).is_absolute() else Path('/home/alper/projects/search-100-evidence')/path
 assert sha(p)==expected['sha256'] and p.stat().st_size==expected['bytes'],'bound_input_changed'
source=ARENA/'harness/metrics.py'
tree=ast.parse(source.read_text())
funcs=[x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name in ('graded_query','graded_query6')]
# The functions' arithmetic is copied by AST execution verbatim; only the cuts data adapter below differs.
class Cuts:
 def __init__(self,pairs):
  self.edges=defaultdict(set)
  for a,b in pairs:self.edges[a].add(b);self.edges[b].add(a)
 def second_cuts(self,ids,k=10):
  seen=set();out=[]
  for i,p in enumerate(ids[:k]):
   if self.edges[p]&seen:out.append(i)
   seen.add(p)
  return out
 def fold(self,ids):
  seen=set();out=[]
  for p in ids:
   if self.edges[p]&seen:continue
   out.append(p);seen.add(p)
  return out
import types,sys,gzip
pairs=read_json=None
pairs=json.loads(gzip.decompress((Path('/home/alper/projects/search-100-evidence/index-readonly-acquisition-20261013/verified-index/alternate_cuts.json.gz')).read_bytes()))['pairs']
cuts=Cuts(pairs);sys.modules['cuts']=cuts
namespace={'math':math}
exec(compile(ast.Module(body=funcs,type_ignores=[]),str(source),'exec'),namespace)
metric=namespace['graded_query6']

def validate_known():
 # Hand-calculated: grade3 at rank1 + grade2 at rank2 exactly match ideal => 1.
 got=metric([9000001,9000002,9000003],{9000001:3,9000002:2,9000003:0})
 assert got=={'ndcg10':1.0,'good10':2,'bad5':1,'unj10':0,'cuts10':0},got
 got=metric([9000004,9000003,9000001],{9000001:3,9000002:2,9000003:0})
 assert math.isclose(got['ndcg10'],3.5/(7+3/math.log2(3)))
 assert (got['good10'],got['bad5'],got['unj10'])==(1,1,1)
 # Real frozen cut edge: second sibling never contributes a second relevant gain.
 a,b=pairs[0]; got=metric([a,b],{a:3,b:3})
 assert got['ndcg10']==1 and got['good10']==1 and got['cuts10']==1 and got['bad5']==1,got
 return {'knownIdealPass':True,'knownBadUnjudgedPass':True,'realCutDuplicatePass':True}

def anchor_ids(items):
 return {(2000000000000 if x.get('media_type') in ('show','tv') else 1000000000000)+x['tmdb_id'] for x in items if isinstance(x.get('tmdb_id'),int)}

def title_guard_row(query, mode, items):
 expected=anchor_ids(query.get('anchors',{}).get('must',[]));ids=[x['id'] for x in items];ranks=[i+1 for i,pid in enumerate(ids) if pid in expected]
 return {'id':query['id'],'mode':mode,'expectedPointIds':sorted(expected),'expectedIdentitySource':'queries.json anchors.must media_type/tmdb_id','expectedRankInRetainedTop100':min(ranks) if ranks else None,'expectedAtRank1':bool(expected and ids and ids[0] in expected),'expectedInTop20':bool(expected&set(ids[:20])),'relevanceMetricExcluded':True,'qualification':'signal ablation omits production title-blending; a missing expected title is not a full production title-lookup verdict'}

def summary(rows):
 if not rows:return {'queries':0,'meanNdcg10':None}
 return {'queries':len(rows),'meanNdcg10':sum(x['ndcg10'] for x in rows)/len(rows),'meanGood10':sum(x['good10'] for x in rows)/len(rows),'bad5':sum(x['bad5'] for x in rows),'unjudgedTop10':sum(x['unj10'] for x in rows),'judgedTop10':sum(x['top10Count']-x['unj10'] for x in rows),'top10Slots':sum(x['top10Count'] for x in rows),'meanCondensedNdcg10':sum(x['condensedNdcg10'] for x in rows)/len(rows),'avoid5':sum(x['avoid5'] for x in rows)}

def main():
 checks=validate_known(); rankings=read(HERE/'rankings.json');grades=read(ARENA/'results/grades.json');queries={q['id']:q for q in read(ARENA/'queries.json')}
 historical_paths={'combo-safe-v3-holdout5':ARENA/'results/simplify/holdout5/lists/combo-safe-v3.json','r6-holdout4':ARENA/'results/round6/holdout4/lists/r6.json'}
 historical_hashes={'combo-safe-v3-holdout5': '69a2239b67babbcc6cac42a139fade5d29fdb18d90eec269d74ecc77551ee50b', 'r6-holdout4': 'd90bdf36656f42bc758212a5977e619e79057705212429f3df869a1db3b66451'}
 for k,v in historical_paths.items():assert sha(v)==historical_hashes[k],'historical_reference_changed'
 refs={k:read(v) for k,v in historical_paths.items()}
 allrows=[]; pools=[]; ungraded=[]; title=[]; title_guards=[]
 for b in rankings['queries']:
  q=queries[b['id']]
  if q['type']=='title_lookup':
   title.append(b['id'])
   for mode,lst in b['variants'].items():title_guards.append(title_guard_row(q,mode,lst))
   continue
  if b['id'] not in grades:ungraded.append(b['id']);continue
  gs={int(k):v for k,v in grades[b['id']].items()}
  assert all(type(v) is int and 0<=v<=3 for v in gs.values())
  relevant={i for i,g in gs.items() if g>=2}; pool={k:set(b['candidatePools'][k]) for k in ['dense','fingerprint','union','expanded']}
  assert pool['union']==pool['dense']|pool['fingerprint']; assert pool['expanded']==pool['union']|set(i for part in b['candidatePools']['partials'] for i in part['ids'])
  pools.append({'id':b['id'],'split':q['split'],'type':q['type'],'judgedRelevantCatalogPairs':len(relevant),'judgedRelevantInDense500':len(relevant&pool['dense']),'judgedRelevantInRaw500':len(relevant&pool['fingerprint']),'judgedRelevantInUnion':len(relevant&pool['union']),'judgedRelevantAddedByRawRetrieval':len(relevant&(pool['fingerprint']-pool['dense'])),'densePoolSize':len(pool['dense']),'rawPoolSize':len(pool['fingerprint']),'unionSize':len(pool['union']),'expandedSize':len(pool['expanded']),'judgedRelevantInExpanded':len(relevant&pool['expanded']),'judgedRelevantAddedByPartialRetrieval':len(relevant&(pool['expanded']-pool['union']))})
  must=anchor_ids(q.get('anchors',{}).get('must',[]));avoid=anchor_ids(q.get('anchors',{}).get('avoid',[]))
  for mode,lst in b['variants'].items():
   ids=[x['id'] for x in lst];m=metric(ids,gs)
   condensed=metric([i for i in ids if i in gs],gs)
   r={'id':b['id'],'mode':mode,'split':q['split'],'type':q['type'],**m,'top10Count':len(ids[:10]),'condensedNdcg10':condensed['ndcg10'],'anchor10':len(set(ids[:10])&must)/len(must) if must else None,'anchor50':len(set(ids[:50])&must)/len(must) if must else None,'avoid5':len(set(ids[:5])&avoid),'negationClauses':len(b['negated']),'historicalComparisons':{}}
   for k,ref in refs.items():
    if b['id'] not in ref:continue
    rid=[x['id'] for x in ref[b['id']]];rm=metric(rid,gs)
    r['historicalComparisons'][k]={'referenceMetrics':rm,'ndcg10Delta':m['ndcg10']-rm['ndcg10'],'bad5Delta':m['bad5']-rm['bad5'],'top20Shared':len(set(ids[:20])&set(rid[:20])),'top20SameRank':sum(a==bb for a,bb in zip(ids[:20],rid[:20])),'currentFinalOverlap':None}
   allrows.append(r)
 out={'schema':'search.local-facet-incomplete-coverage-grades.v1','productionAcceptance':False,'currentFinalOverlap':None,'rankingSha256':sha(HERE/'rankings.json'),'metricSourceSha256':sha(source),'gradesSha256':sha(ARENA/'results/grades.json'),'queriesSha256':sha(ARENA/'queries.json'),'knownCalculationChecks':checks,'alternateCutBasis':'current frozen index alternate_cuts.pairs; original metric formulas, not independently regenerated historical cuts catalog','referenceBindings':{k:{'sha256':sha(v),'currentBuildBound':False,'queries':len(refs[k])} for k,v in historical_paths.items()},'coverage':{'included':len(rankings['queries']),'excluded':rankings['excluded'],'gradedQueries':len({x['id'] for x in allrows}),'titleLookupOutsideMetrics':title,'ungraded':ungraded},'byMode':{},'byClass':{},'bySplit':{},'rows':allrows,'poolCoverage':pools,'titleLookupGuardRows':title_guards,'poolCoverageQualification':'denominator is all existing grade>=2 catalog pairs; includes titles outside current filtered/common-valid universe, so this is catalog judged-pair coverage, not eligible recall; added raw retrieval pairs are directly retained pool membership, not inferred from top100','causalQualification':'C0-base vs CX-base changes candidates/population; CX variants share population, source facet .1mean(z), explicitly incomplete dense-only coverage .3z(min unit z); no observed BM25 scores or unit BM25 retrieval', 'incompleteCoverage':True,'unitBm25Observed':False,'currentCatalogNotHistoricalSnapshot':True,'acceptanceThresholdIntroduced':False}
 for mode in rankings['queries'][0]['variants'] if rankings['queries'] else []:
  mr=[x for x in allrows if x['mode']==mode];out['byMode'][mode]=summary(mr)
  out['byClass'][mode]={t:summary([x for x in mr if x['type']==t]) for t in sorted({x['type'] for x in mr})}
  out['bySplit'][mode]={t:summary([x for x in mr if x['split']==t]) for t in sorted({x['split'] for x in mr})}
 with (HERE/'metrics.json').open('x') as f:f.write(json.dumps(out,indent=2)+'\n')
 print(json.dumps({'knownCalculationChecks':checks,'coverage':{k:v for k,v in out['coverage'].items() if k!='excluded'},'byMode':out['byMode']}))
if __name__=='__main__': main()
