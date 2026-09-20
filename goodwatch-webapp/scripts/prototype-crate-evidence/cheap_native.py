"""Approved frozen50k scratch restore + bounded native SQL ablations. No model calls."""
import argparse,concurrent.futures,inspect,json,statistics,time,hashlib
from pathlib import Path
import experiment as e
from dotenv import dotenv_values
P=e.PRIVATE/'cheap-loop'

def save(name,data):
 P.mkdir(exist_ok=True);(P/name).write_text(json.dumps(data,ensure_ascii=False,indent=2))

def restore(sample,resume=False):
 assert len(sample)==50000 and len({(r['media_type'],r['tmdb_id']) for r in sample})==50000
 exists=e.sql("SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name=?",[e.TABLE.split('.')[1]])['rows']
 assert not exists or resume,'Refusing existing table'
 if exists:e.sql(f'REFRESH TABLE {e.TABLE}')
 existing={(r['media_type'],r['tmdb_id']) for r in e.sql(f'SELECT media_type,tmdb_id FROM {e.TABLE} LIMIT 50001')['rows']} if exists else set()
 assert existing <= {(r['media_type'],r['tmdb_id']) for r in sample},'Unexpected existing keys'
 ddl=(e.ROOT/'docs/prototypes/crate-evidence/setup.sql').read_text();ddl='\n'.join(s for s in ddl.splitlines() if not s.lstrip().startswith('--')).strip().rstrip(';')
 start=time.perf_counter()
 if not exists:e.sql(ddl);e.sql(f'ALTER TABLE {e.TABLE} ADD COLUMN poster_path TEXT')
 columns=list(sample[0]);statement=f"INSERT INTO {e.TABLE} ({','.join(columns)}) VALUES ({e.placeholders(columns)})"
 pending=[r for r in sample if (r['media_type'],r['tmdb_id']) not in existing]
 for i in range(0,len(pending),500):
  batch=pending[i:i+500];r=e.sql(statement,bulk=[[row[c] for c in columns] for row in batch]);assert sum(x['rowcount'] for x in r['results'])==len(batch)
  if i%5000==0:print('restored',len(existing)+i+len(batch),flush=True)
 e.sql(f'REFRESH TABLE {e.TABLE}')
 found=e.sql(f'SELECT media_type,tmdb_id FROM {e.TABLE} LIMIT 50001')['rows'];assert {(r['media_type'],r['tmdb_id']) for r in found}=={(r['media_type'],r['tmdb_id']) for r in sample}
 save('native-restore.json',{'table':e.TABLE,'rows':len(found),'sample_sha256':hashlib.sha256((e.PRIVATE/'sample.json').read_bytes()).hexdigest(),'wall_ms':(time.perf_counter()-start)*1000,'verified_exact_keys':True,'source_writes':False,'time':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())})

def native_function(kind):
 source=inspect.getsource(e.retrieve)
 source=source.replace("'variant':variant,'wall_ms'","'ranked_candidates':sorted(pool.values(),key=lambda r:(-r['combined'],r['key'])),'variant':variant,'wall_ms'")
 source=source.replace("fields = '(essence_text 2.0, synopsis)' if baseline else", "fields = '(essence_text 2.0, synopsis)' if baseline else")
 if kind not in ('english','english_phrase'):source=source.replace("fields = '(essence_text 2.0, synopsis)' if baseline else f\"(strong_evidence{'_standard' if standard else ''} {boost}.0, text_evidence{'_standard' if standard else ''})\"", "fields = '(strong_evidence 0.25, text_evidence 2.0)'")
 original="rows=query_pool(' AND '.join(f'match({fields}, ?)' for _ in words),words)"
 if kind=='native_best_fields':source=source.replace(original,'rows=query_pool(f"match({fields}, ?) using best_fields with (operator=\'and\')",[phrase])' )
 if kind=='native_phrase':source=source.replace(original,"rows=query_pool(f'match({fields}, ?) using phrase with (slop=1)',[phrase])")
 namespace=dict(e.__dict__);exec(source,namespace);return namespace['retrieve']

def preconjunction(case,variant,allowed,rows,minimum=20,preserve_joint=False):
 from cheap_loop import tokens,negative_phrase2
 start=time.perf_counter();request_words=set(tokens(case['request']))
 phrases=[p for p in case['attributes']['phrases'] if p['probability']>=.15]
 concrete={t for w in case['attributes']['split'] if w.get('isConcrete') for t in tokens(w['word'])}
 groups=[set(tokens(p['phrase'])) for p in phrases]
 activate=len(groups)==2 and not groups[0]&groups[1] and all(g<=request_words for g in groups) and bool(set.union(*groups)&concrete) and 'or' not in request_words and not any(negative_phrase2(p['phrase'],case['request']) for p in phrases)
 ordinary=native_function('english')
 if not activate:
  result=ordinary(case,'english',allowed,rows);result['preconjunction']={'activated':False};return result
 words=list(dict.fromkeys(w for p in phrases for w in p['phrase'].split()))
 predicate=' AND '.join('MATCH((strong_evidence 1.0,text_evidence),?)' for w in words)
 def query(media):
  if not allowed[media]:return [],None
  result=e.sql(f'SELECT tmdb_id,_score FROM {e.TABLE} WHERE media_type=? AND tmdb_id=ANY(?) AND ({predicate}) ORDER BY _score DESC,tmdb_id ASC LIMIT 300',[media,allowed[media],*words])
  return [{'key':f"{media}:{r['tmdb_id']}",'text_raw':r['_score']} for r in result['rows']],{'media':media,'server_ms':result['server_ms'],'wall_ms':result['wall_ms'],'rows':len(result['rows'])}
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:parts=list(pool.map(query,('movie','show')))
 candidates=[r for part,log in parts for r in part];logs=[log for part,log in parts if log];pre_ms=(time.perf_counter()-start)*1000
 diagnostics={'activated':True,'groups':[p['phrase'] for p in phrases],'pre_cap_candidates':len(candidates),'fallback':len(candidates)<minimum,'minimum_result_count':minimum,'prequery_wall_ms':pre_ms,'joint_candidate_scores':[dict(r) for r in candidates]}
 best=max([1]+[r['text_raw'] for r in candidates])
 for r in candidates:
  r['text']=r['text_raw']/best;r['weighted_sum']=sum(w*(rows[r['key']]['fingerprint_scores'].get(dim) or 0) for dim,w in case['weights'].items());r['evidence']=[' AND '.join(diagnostics['groups'])+' [pre-cap conjunction]']
 score_min=min([0]+[r['weighted_sum'] for r in candidates]);span=max([1]+[r['weighted_sum'] for r in candidates])-score_min or 1
 for r in candidates:r['combined']=(r['weighted_sum']-score_min)/span+.5*min(r['text'],4)
 candidates.sort(key=lambda r:(-r['combined'],r['key']))
 diagnostics['joint_ranked_candidates']=[dict(r) for r in candidates]
 if len(candidates)<minimum:
  result=ordinary(case,'english',allowed,rows)
  if preserve_joint:
   joint_keys={r['key'] for r in candidates};combined=candidates+[r for r in result['ranked_candidates'] if r['key'] not in joint_keys]
   result['ranked_candidates']=combined;result['candidates']=sorted(r['key'] for r in combined);result['top10']=[{**rows[r['key']],**r,'year':rows[r['key']]['release_year'],'judgment':'needs review'} for r in combined[:10]]
   diagnostics['fallback_policy']='joint candidates retain priority; English supplements remaining result slots'
  result['wall_ms']=(time.perf_counter()-start)*1000;result['queries']=logs+result['queries'];result['query_count']+=len(logs);result['server_sum_ms']+=sum(x['server_ms'] for x in logs);result['preconjunction']=diagnostics;return result
 top=[{**rows[r['key']],**r,'year':rows[r['key']]['release_year'],'judgment':'needs review'} for r in candidates[:10]]
 return {'variant':'native_preconjunction','wall_ms':(time.perf_counter()-start)*1000,'server_sum_ms':sum(x['server_ms'] for x in logs),'queries':logs,'query_count':len(logs),'gated':False,'searched':diagnostics['groups'],'candidates':sorted(r['key'] for r in candidates),'ranked_candidates':candidates,'top10':top,'preconjunction':diagnostics,'vector_fill':'not run; sample-only'}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--env',required=True);parser.add_argument('--restore',action='store_true');parser.add_argument('--resume-restore',action='store_true');parser.add_argument('--repeats',type=int,default=3);parser.add_argument('--warmups',type=int,default=1);parser.add_argument('--interpretations',type=Path,nargs='+',default=[e.PRIVATE/'interpretations.json']);parser.add_argument('--variants',nargs='+',default=['corrected','english','native_prose_boost','native_best_fields','native_phrase']);parser.add_argument('--output',default='native-round1.json');parser.add_argument('--request',action='append');a=parser.parse_args();env=dotenv_values(a.env)
 e.URL=f"http://{env['CRATE_HOSTS'].split(',')[0]}:{env.get('CRATE_PORT','4200')}/_sql";e.AUTH=(env.get('CRATE_USER',''),env.get('CRATE_PASS',''))
 sample=e.read('sample.json');e.MIN_VOTES=min(r['votes'] for r in sample)
 if a.restore or a.resume_restore:restore(sample,a.resume_restore)
 rows={f"{r['media_type']}:{r['tmdb_id']}":r for r in sample};elig={c['request']:c for c in e.read('cheap-loop-eligibility.json')['cases']}
 kinds=a.variants;functions={k:e.retrieve if k=='corrected' else preconjunction if k=='native_preconjunction' else (lambda c,v,a,r:preconjunction(c,v,a,r,minimum=10,preserve_joint=True)) if k=='native_preconjunction_v2' else native_function(k) for k in kinds};out={'status':'running','table':e.TABLE,'sample_count':len(sample),'min_votes':e.MIN_VOTES,'extra_model_cost_usd':0,'eligibility':'exact saved original filters; private/cheap-loop-eligibility.json','cases':[]}
 cases=[c for path in a.interpretations for c in json.loads(path.read_text())]
 if a.request:cases=[c for c in cases if c['request'] in a.request]
 out['interpretation_sources']=[str(path) for path in a.interpretations]
 for case in cases:
  allowed={m:[int(k.split(':')[1]) for k in elig[case['request']]['allowed_keys'] if k.startswith(m+':')] for m in ('movie','show')} if case['filters']==elig[case['request']]['filters'] else e.prepare(case,sample);runs=[]
  for repetition in range(a.repeats+a.warmups):
   order=kinds[repetition%len(kinds):]+kinds[:repetition%len(kinds)]
   for kind in order:
    start=time.perf_counter()
    try:
     result=functions[kind](case,kind if kind in ('corrected','english_phrase') else 'english',allowed,rows);result.update(variant=kind,repetition=repetition,warmup=repetition<a.warmups)
    except Exception as ex:result={'variant':kind,'repetition':repetition,'warmup':repetition<a.warmups,'error':str(ex),'wall_ms':(time.perf_counter()-start)*1000}
    runs.append(result)
  summaries={}
  for kind in kinds:
   valid=[r for r in runs if r['variant']==kind and not r['warmup'] and 'error' not in r];summary={'success_count':len(valid),'error_count':sum('error' in r for r in runs if r['variant']==kind),'median_wall_ms':statistics.median(r['wall_ms'] for r in valid) if valid else None,'top10':valid[-1]['top10'] if valid else [],'query_counts':[r['query_count'] for r in valid],'stable_top10':len({tuple(x['key'] for x in r['top10']) for r in valid})<=1,'stable_candidates':len({tuple(r['candidates']) for r in valid})<=1}
   summaries[kind]=summary
  out['cases'].append({'request':case['request'],'filters':case['filters'],'phrases':case['attributes']['phrases'],'weights':case['weights'],'original_jev_cost_usd':case['attributes']['usage']['usd']+case['reading']['usage']['usd'],'eligibility_reused':case['filters']==elig[case['request']]['filters'],'runs':runs,'summary':summaries});save(a.output,out);print(json.dumps({'complete':len(out['cases']),'request':case['request'],'median_ms':{k:v['median_wall_ms'] for k,v in summaries.items()}}),flush=True)
 out['status']='complete_pending_review';save(a.output,out)
if __name__=='__main__':main()
