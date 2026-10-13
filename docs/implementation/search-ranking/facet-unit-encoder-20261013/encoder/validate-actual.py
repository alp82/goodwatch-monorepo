import json,hashlib,math,struct
from pathlib import Path
HERE=Path(__file__).parent;BASE=HERE.parent
def read(p):return json.loads(p.read_bytes())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
plan=read(BASE/'offline-facet-unit-encoder-plan-20261013/plan.json');assert sha(BASE/'offline-facet-unit-encoder-plan-20261013/plan.json')=='5889f120be2dd2ed85e6d6b817b3b92a5458cf9b79823f027d9b8d91c070fd53'
inv=read(HERE/'actual-invocation.json');assert inv['exitCode']==0 and inv['timedOut'] is False and inv['elapsedSeconds']<330
for n in ['actual.stdout','actual.stderr']:assert sha(HERE/n)==inv[n]['sha256'] and (HERE/n).stat().st_size==inv[n]['bytes']
assert inv['actual.stderr']['bytes']==0
terminal=read(HERE/'actual.stdout');results=read(HERE/'run/encoding-results.json');assert terminal['completed'] is True and terminal['encodingResultsSha256']==sha(HERE/'run/encoding-results.json');assert results['completed'] is True and results['batches']==17 and results['uniqueRequestedModelTexts']==132 and results['observedRunWallMs']<300000
oldpath=BASE/'offline-public-encoder-additions-20261013/query-vectors-merged.json';assert sha(oldpath)=='35a2716af5e5b9a45b1678185b558cca736c7d81250f1c085ef59d62eb98a854';old=read(oldpath);new=read(HERE/'run/query-vectors-merged.json');adds=read(HERE/'run/query-vector-additions.json');assert set(adds)=={'english'};texts={x['text'] for x in plan['items']};assert len(texts)==132 and set(adds['english'])==texts
maxerr=0
for text,v in adds['english'].items():
 assert len(v)==768 and all(type(x) in (int,float) and math.isfinite(x) for x in v)
 error=abs(math.sqrt(sum(x*x for x in v))-1);assert error<1e-4;maxerr=max(maxerr,error)
 assert all(struct.unpack('<f',struct.pack('<f',x))[0]==x for x in v)
 assert v==new['english'][text]
oldvectors=0
for model,vs in old.items():
 assert set(new[model])==set(vs)|(texts if model=='english' else set())
 for text,v in vs.items():
  assert len(v)==len(new[model][text]);assert all(struct.pack('<d',a)==struct.pack('<d',b) for a,b in zip(v,new[model][text]));oldvectors+=1
assert oldvectors==269
pre=read(HERE/'run/model-preflight.json')['files'];assert pre==results['modelPostflight'] and len(pre)==6 and sum(x['bytes'] for x in pre)==923875007
original=read(BASE/'offline-public-encoder-20261013/model-preflight.json')['files'];assert {(x['model'],x['kind'],x['sha256'],x['bytes']) for x in pre}=={(x['model'],x['kind'],x['sha256'],x['bytes']) for x in original}
seen=[]
for index,row in enumerate(results['rows']):
 assert row['id']==index+1 and row['items']==[plan['items'][i] for i in plan['batches'][index]];seen.extend(row['items'])
assert seen==plan['items']
out={'schema':'local-public-facet-unit-encoder-actual-validation.v1','CLIExit0':True,'uniqueNewEnglishVectors':132,'dim':768,'maxUnitNormError':maxerr,'allNewValuesExactlyFloat32':True,'planRolesAndBatchOrderExact':True,'oldVectorsBitExact':oldvectors,'mergedVectors':sum(len(v) for v in new.values()),'modelPrePostStableFiles':6,'modelPinnedBytes':923875007,'mergedCacheSha256':sha(HERE/'run/query-vectors-merged.json'),'additionsSha256':sha(HERE/'run/query-vector-additions.json'),'encodingResultsSha256':sha(HERE/'run/encoding-results.json'),'outerElapsedSeconds':inv['elapsedSeconds'],'startupObservedWallMs':read(HERE/'run/startup.json')['observedWallMs'],'encodingObservedSumMs':results['corpusEncodingMs'],'runObservedWallMs':results['observedRunWallMs'],'newScoringStudyExecuted':False,'productionTiming':False,'productionAcceptance':False}
with(HERE/'actual-validation.json').open('x')as f:f.write(json.dumps(out,indent=2)+'\n')
print(json.dumps(out))
