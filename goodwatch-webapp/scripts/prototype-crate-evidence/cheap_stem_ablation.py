"""Offline Snowball-vs-plural-only ablation; identical saved pools/caps/scoring.
Run with the private WordNet venv (NLTK3.9.2). No corpus/network/model calls.
"""
import argparse,json,re,time,statistics,hashlib
from pathlib import Path
import nltk
from nltk.stem.snowball import EnglishStemmer
import cheap_loop as ranking
HERE=Path(__file__).resolve().parent;PRIVATE=HERE/'private'
ORIGINAL_TOKENS=ranking.tokens
ORIGINAL_NEGATIVE=ranking.negative_phrase2

def original_polarity(phrase,request):
    # Polarity control words retain their original representation in both arms.
    active=ranking.tokens
    ranking.tokens=ORIGINAL_TOKENS
    try:return ORIGINAL_NEGATIVE(phrase,request)
    finally:ranking.tokens=active

ranking.negative_phrase2=original_polarity

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=PRIVATE/'cheap-loop/stem-ablation.json');args=parser.parse_args();started=time.perf_counter()
 stemmer=EnglishStemmer();checks={w:stemmer.stem(w) for w in ['communicating','communication','alien','aliens','feeding','feed','narrator','narration']}
 cases={c['request']:c for name in ['interpretations.json','loop-challenge-interpretations.json','loop-confirmation-interpretations.json','loop-final-validation-interpretations.json'] for c in json.loads((PRIVATE/name).read_text())}
 originals={c['request'] for c in json.loads((PRIVATE/'interpretations.json').read_text())};rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in json.loads((PRIVATE/'sample.json').read_text())};jobs=[];sources=[]
 for filename,kind in [('native-round1.json','general'),('native-supplemental-controls.json','general'),('native-preconjunction-v2-screen.json','conjunction'),('native-preconjunction-v2-supplemental.json','conjunction')]:
  path=PRIVATE/'cheap-loop'/filename;raw=path.read_bytes();source=json.loads(raw);sources.append({'path':str(path),'sha256':hashlib.sha256(raw).hexdigest()})
  for case in source['cases']:
   runs=[r for r in case['runs'] if not r.get('warmup') and (kind=='conjunction' or r['variant']=='english')]
   if not runs:continue
   native=max(runs,key=lambda r:r.get('repetition',0));guard=native.get('preconjunction',{})
   if kind=='conjunction' and not(guard.get('activated') and not guard.get('fallback')):continue
   jobs.append((case['request'],kind,native))
 startup=(time.perf_counter()-started)*1000
 output={'nltk_version':nltk.__version__,'stem_checks':checks,'sources':sources,'startup_ms':startup,'additional_model_cost_usd':0,'network_calls':0,'method':'Only tokens normalizer changes. General English lexicaltop64 fields2; adoptedjoint lexicaltop64 anti. Same rows, originalJev, caps, formulas, no added synonym/stopword rules. Polarity eligibility uses the original normalizer in BOTH arms; selected phrase identities asserted equal. 1warmup+3measured fresh selection/normalization/ranking trials. Snowball uses a NEW pertrial memo to avoid duplicate token stemming inside that request; cache construction charged, no cross-trial cache. No forcedGC.','cases':[]}
 for request,kind,native in jobs:
  pool=native['ranked_candidates'];results={}
  for policy in ['original','snowball']:
   trials=[];warmup=None
   for trial in range(4):
    start=time.perf_counter();cache={}
    if policy=='snowball':
     def tokenize(value):
      result=[]
      for word in re.findall(r'\w+',value.lower()):
       if word not in cache:cache[word]=stemmer.stem(word)
       result.append(cache[word])
      return result
     ranking.tokens=tokenize
    else:ranking.tokens=ORIGINAL_TOKENS
    chosen=sorted(pool,key=lambda r:(-r['text'],r['key']))[:64];keys=[r['key'] for r in chosen];selection=(time.perf_counter()-start)*1000
    prep_start=time.perf_counter();indexed={k:ranking.index_row2(rows[k]) for k in keys};prep=(time.perf_counter()-prep_start)*1000
    ranked,rank_ms,selected=ranking.rank2(cases[request],keys,rows,indexed,'anti' if kind=='conjunction' else 'fields2',{})
    timing={'total_ms':(time.perf_counter()-start)*1000,'selection_ms':selection,'preparation_ms':prep,'rank_ms':rank_ms,'fresh_stem_cache_size':len(cache)}
    if trial==0:warmup=timing
    else:trials.append(timing)
   results[policy]={'top10':[{**rows[r['key']],**r} for r in ranked[:10]],'ranked_candidates':ranked,'selected_phrases':selected,'selected_candidate_keys':keys,'warmup':warmup,'trials':trials,'median_local_ms':statistics.median(t['total_ms'] for t in trials),'max_local_ms':max(t['total_ms'] for t in trials)}
  ranking.tokens=ORIGINAL_TOKENS
  assert results['original']['selected_candidate_keys']==results['snowball']['selected_candidate_keys']
  assert [p['phrase'] for p in results['original']['selected_phrases']]==[p['phrase'] for p in results['snowball']['selected_phrases']]
  changed=[r['key'] for r in results['original']['top10'][:5]]!=[r['key'] for r in results['snowball']['top10'][:5]]
  output['cases'].append({'request':request,'split':'original13' if request in originals else 'supplemental28','kind':kind,'pool_size':len(pool),'results':results,'top5_changed':changed})
  print(json.dumps({'completed':len(output['cases']),'kind':kind,'request':request,'top5_changed':changed,'original_ms':round(results['original']['median_local_ms'],2),'snowball_ms':round(results['snowball']['median_local_ms'],2)}),flush=True)
 output['total_wall_ms']=(time.perf_counter()-started)*1000;args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
