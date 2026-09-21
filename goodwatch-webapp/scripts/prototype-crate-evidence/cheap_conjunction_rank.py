"""Bounded three-arm follow-up only on generic activated conjunction pools."""
import argparse,json,time,statistics,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
PRIVATE=HERE/'private'
from cheap_loop import rank2,index_row2
from cheap_hygiene import candidate_hygiene
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,default=PRIVATE/'cheap-loop/native-preconjunction-v2-screen.json')
parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/preconjunction-ranked.json')
args=parser.parse_args();startup=time.perf_counter()
p=PRIVATE/'cheap-loop';path=args.input;raw=path.read_bytes();source=json.loads(raw)
rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in json.loads((PRIVATE/'sample.json').read_text())}
interpretation_sources=['interpretations.json','loop-challenge-interpretations.json','loop-confirmation-interpretations.json','loop-final-validation-interpretations.json']
cases={c['request']:c for name in interpretation_sources for c in json.loads((PRIVATE/name).read_text())}
load_ms=(time.perf_counter()-startup)*1000
output={'source':str(path),'source_sha256':hashlib.sha256(raw).hexdigest(),'additional_model_cost_usd':0,'network_calls':0,'startup_load_ms':load_ms,'interpretation_sources':interpretation_sources,'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'timing':'1warmup+3measured fullselection/preparation/ranking trials; rawrows loaded outside perquery; noforcedGC','cases':[]}
for case in source['cases']:
 request=case['request'];native=case['runs'][0];pool=native['ranked_candidates'];guard=native.get('preconjunction',{});activated=bool(guard.get('activated',False) and not guard.get('fallback',False))
 record={'request':request,'activated':activated,'preconjunction_guard':{k:v for k,v in guard.items() if k not in ('joint_candidate_scores','joint_ranked_candidates')},'candidate_count':len(pool),'native_candidate_keys':[r['key'] for r in pool],'native_wall_ms':native['wall_ms'],'native_top10':[{**rows[r['key']],**r} for r in pool[:10]],'results':{}}
 if not activated:record['scope']='Native source order preserved; no new local ranking. Retrieval fallback behavior remains in preconjunction_guard.';output['cases'].append(record);continue
 for mode in ['anti64','rrf60','lexical75_d425']:
  trials=[];warm=None
  for trial in range(4):
   started=time.perf_counter();lex=sorted(pool,key=lambda r:(-r['text'],r['key']));prep_ms=0
   if mode=='anti64':
    keys=[r['key'] for r in lex[:64]];prep_start=time.perf_counter();indexed={k:index_row2(rows[k]) for k in keys};prep_ms=(time.perf_counter()-prep_start)*1000;ranked,_,_=rank2(cases[request],keys,rows,indexed,'anti',{})
   else:
    d4=sorted(pool,key=lambda r:(-r['weighted_sum'],r['key']));lr={r['key']:i+1 for i,r in enumerate(lex)};dr={r['key']:i+1 for i,r in enumerate(d4)};lo=min(r['weighted_sum'] for r in pool);hi=max(r['weighted_sum'] for r in pool);mx=max(r['text'] for r in pool)
    ranked=[{**r,'score':1/(60+lr[r['key']])+1/(60+dr[r['key']]) if mode=='rrf60' else .75*(r['text']/mx if mx else 0)+.25*((r['weighted_sum']-lo)/(hi-lo) if hi>lo else 0)} for r in pool];ranked.sort(key=lambda r:(-r['score'],r['key']))
   measurement={'total_ms':(time.perf_counter()-started)*1000,'preparation_ms':prep_ms}
   if trial==0:warm=measurement
   else:trials.append(measurement)
  hygiene_trials=[]
  for trial in range(4):
   started=time.perf_counter();kept=[];excluded=[]
   for r in ranked:
    reasons=candidate_hygiene(rows[r['key']])
    if reasons:excluded.append({'key':r['key'],'reasons':reasons})
    else:kept.append(r)
    if len(kept)==10:break
   if trial:hygiene_trials.append((time.perf_counter()-started)*1000)
  record['results'][mode]={'selected_candidate_keys':[r['key'] for r in ranked],'top10':[{**rows[r['key']],**r} for r in ranked[:10]],'ranked_candidates':ranked,'warmup':warm,'trials':trials,'median_local_ms':statistics.median(t['total_ms'] for t in trials),'max_local_ms':max(t['total_ms'] for t in trials),'hygiene':{'top10':[{**rows[r['key']],**r} for r in kept],'excluded':excluded,'median_ms':statistics.median(hygiene_trials),'max_ms':max(hygiene_trials)}}
 output['cases'].append(record)
 print(request,{m:{'ms':round(v['median_local_ms'],3),'top5':[r['title'] for r in v['top10'][:5]]} for m,v in record['results'].items()})
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
