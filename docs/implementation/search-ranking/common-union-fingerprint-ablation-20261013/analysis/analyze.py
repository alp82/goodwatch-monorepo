import json,hashlib,statistics
from pathlib import Path
BASE=Path('/home/alper/projects/search-100-evidence');HERE=Path(__file__).parent;STUDY=BASE/'local-fingerprint-common-union-study-20261013'
def load(p):return json.loads(p.read_bytes())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for name,e in load(HERE/'actual-study-bindings.json')['files'].items():
 p=Path(name);assert sha(p)==e['sha256'] and p.stat().st_size==e['bytes']
m=load(STUDY/'metrics.json');r=load(STUDY/'rankings.json');qpath=Path('/home/alper/projects/goodwatch-monorepo/docs/prototypes/search-arena/queries.json');gpath=qpath.parent/'results/grades.json';assert sha(qpath)==m['queriesSha256'] and sha(gpath)==m['gradesSha256'];queries={q['id']:q for q in load(qpath)};grades=load(gpath);rank={q['id']:q for q in r['queries']};rows={mode:{q['id']:q for q in m['rows'] if q['mode']==mode} for mode in m['byMode']};C='common-union-control';F='common-union-fingerprint';D='dense-pool-control'
def delta(a,b):return {'queries':b['queries'],'ndcg10Delta':b['meanNdcg10']-a['meanNdcg10'],'bad5Delta':b['bad5']-a['bad5'],'unjudgedTop10Delta':b['unjudgedTop10']-a['unjudgedTop10'],'meanGood10Delta':b['meanGood10']-a['meanGood10']}
newbad=[]
for id,a in rows[C].items():
 b=rows[F][id]
 if b['bad5']<=a['bad5']:continue
 old=[x['id'] for x in rank[id]['variants'][C]];new=[x['id'] for x in rank[id]['variants'][F]];gs={int(k):v for k,v in grades[id].items()}
 newbad.append({'id':id,'publicQuery':queries[id]['query'],'type':b['type'],'split':b['split'],'bad5Before':a['bad5'],'bad5After':b['bad5'],'ndcg10Delta':b['ndcg10']-a['ndcg10'],'newGradeZeroTop5':[{'pointId':pid,'newRank':i+1,'previousRankTop100':old.index(pid)+1 if pid in old else None} for i,pid in enumerate(new[:5]) if gs.get(pid)==0 and pid not in old[:5]],'qualification':'bad5 can also count a second alternate cut; explicit entries above are grade-zero titles only'})
hist={}
for mode,rr in rows.items():
 hist[mode]={}
 for name in m['referenceBindings']:
  matched=[x['historicalComparisons'][name] for x in rr.values() if name in x['historicalComparisons']]
  if matched:hist[mode][name]={'matchedQueries':len(matched),'meanNdcg10Delta':statistics.mean(x['ndcg10Delta'] for x in matched),'bad5Delta':sum(x['bad5Delta'] for x in matched),'meanTop20Shared':statistics.mean(x['top20Shared'] for x in matched),'currentBuildOrFullRankParity':False}
coverage={k:sum(x[k] for x in m['poolCoverage']) for k in ['judgedRelevantCatalogPairs','judgedRelevantInDense500','judgedRelevantInRaw500','judgedRelevantInUnion','judgedRelevantAddedByRawRetrieval']}
bytitle={mode:[x for x in m['titleLookupGuardRows'] if x['mode']==mode] for mode in rows}
timings=sorted(x['computeMs'] for x in r['queries']);run=load(STUDY/'root-run-invocation.json');ev=load(STUDY/'root-evaluate-invocation.json')
out={'schema':'offline-common-union-derived-analysis.v1','productionAcceptance':False,'studyBindingsSha256':sha(HERE/'actual-study-bindings.json'),'aggregate':m['byMode'],'samePoolFingerprintDelta':delta(m['byMode'][C],m['byMode'][F]),'candidatePoolAndNormalizationDelta':delta(m['byMode'][D],m['byMode'][C]),'byClassFingerprintDelta':{k:delta(m['byClass'][C][k],v) for k,v in m['byClass'][F].items()},'bySplitFingerprintDelta':{k:delta(m['bySplit'][C][k],v) for k,v in m['bySplit'][F].items()},'queriesImproved':sum(rows[F][k]['ndcg10']>v['ndcg10'] for k,v in rows[C].items()),'queriesWorsened':sum(rows[F][k]['ndcg10']<v['ndcg10'] for k,v in rows[C].items()),'queriesUnchanged':sum(rows[F][k]['ndcg10']==v['ndcg10'] for k,v in rows[C].items()),'newKnownBadQueries':newbad,'historicalPairedComparisons':hist,'candidateCoverage':coverage,'coverageQualification':m['poolCoverageQualification'],'titleGuards':{k:{'queries':len(v),'expectedAtRank1':sum(x['expectedAtRank1'] for x in v),'expectedInTop20':sum(x['expectedInTop20'] for x in v),'rows':v} for k,v in bytitle.items()},'cohortNotes':{'included':len(r['queries']),'graded':len(rows[C]),'titleGuards':len(bytitle[C]),'nonEnglishRequestExclusion':True,'nonEnglishLabelWithinEnglishEncodedCohort':[k for k,x in rows[C].items() if x['type']=='non_english'],'splitsAbsent':['holdout3','holdout4'],'organicTrafficShare':None},'localCompute':{'queryComputeSumMs':sum(timings),'queryComputeMedianMs':statistics.median(timings),'queryComputeP95Ms':timings[int(.95*(len(timings)-1))],'queryComputeMaxMs':max(timings),'runInvocation':run,'evaluationInvocation':ev,'productionLatencyInference':False},'limitations':['current catalog raw FP is not historical snapshot','2772 vote changes and29 current below-floor; original index mask preserved','missing hybrid signals prevent full-ranking causal attribution','unjudged slots are not relevance negatives','no automatic quality threshold or acceptance']}
with (HERE/'derived-summary.json').open('x') as f:f.write(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['samePoolFingerprintDelta','candidatePoolAndNormalizationDelta','queriesImproved','queriesWorsened','queriesUnchanged','candidateCoverage']}));print('summarySHA',sha(HERE/'derived-summary.json'))
