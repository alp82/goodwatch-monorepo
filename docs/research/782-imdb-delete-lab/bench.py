#!/usr/bin/env python3
"""Identical local DELETE inputs; optional bounded priority paging; read-only telemetry."""
from lab import *
import statistics

PAGING = '''SELECT tmdb_id FROM crawl_priority
 WHERE media_type = ? AND demand > acknowledged_demand
 AND (last_success_at IS NULL OR CAST(last_success_at AS BIGINT) < CAST(current_timestamp AS BIGINT) - ?)
 AND (lease_expires_at IS NULL OR lease_expires_at <= current_timestamp)
 ORDER BY demand - acknowledged_demand DESC, tmdb_id ASC LIMIT ? OFFSET ?'''

def chunks(size): return [list(range(i,min(i+size,SHOWS+1))) for i in range(1,SHOWS+1,size)]
def keys(table, show):
 if table=='imdb_episode':return ['tte'+str(i)for i in range(show,EPISODES+1,SHOWS)]
 return list(range(1, (SEASONS-show)//SHOWS+2))

def kept(table,show):
 if table=='imdb_episode': return keys(table,show)
 return list(range(1,(SEASONS-show)//SHOWS+2))

def original(table,chunk):
 key='imdb_episode_id'if table=='imdb_episode'else'season_number'
 values=[str(s)+':'+str(k)for s in chunk for k in kept(table,s)]
 return f"DELETE FROM {table} WHERE show_id = ANY(?) AND NOT (CAST(show_id AS TEXT) || ':' || CAST({key} AS TEXT) = ANY(?))",[chunk,values]

def upsert(table,chunk,node):
 epoch=1793160000000
 if table=='imdb_episode':
  cols=['show_id','imdb_episode_id','imdb_show_id','season_number','episode_number','name','imdb_user_score_original','imdb_user_score_rating_count','created_at','updated_at'];pk=['show_id','imdb_episode_id'];data=[]
  for show in chunk:
   for ident in kept(table,show):
    i=int(ident[3:]);ep=(i-1)//SHOWS+1
    data.append([show,ident,'ttshow'+str(show),None if ep%23==0 else ep//18+1,ep,'Synthetic episode '+str(i),7.5,1000,epoch,epoch])
 else:
  cols=['show_id','season_number','imdb_show_id','imdb_user_score_original','imdb_user_score_rating_count','imdb_rated_episode_count','max_episode_number','created_at','updated_at'];pk=['show_id','season_number'];data=[[show,k,'ttshow'+str(show),7.5,10000,18,18,epoch,epoch]for show in chunk for k in kept(table,show)]
 stmt='INSERT INTO '+table+' ('+','.join(cols)+') VALUES ('+','.join('?'for _ in cols)+') ON CONFLICT ('+','.join(pk)+') DO UPDATE SET '+','.join(c+'=excluded.'+c for c in cols if c not in pk+['created_at'])
 start=time.monotonic();result=sql(stmt,node=node,bulk_args=data,timeout=180)
 assert len(result['results'])==len(data)and all(r.get('rowcount')==1 and not r.get('error')and not r.get('error_message')for r in result['results']),str(result)[:500]
 return {'rows':len(data),'wall_seconds':time.monotonic()-start,'server_ms':result['duration']}

def pools():
 return sql("SELECT name,heap,thread_pools,load FROM sys.nodes ORDER BY name",node=2,timeout=10)['rows']

def sampler(stop,path):
 while not stop.is_set():
  d={'utc':now(),'monotonic':time.monotonic()}
  try:d['nodes']=pools()
  except Exception as e:d['error']=str(e)
  with path.open('a')as f:f.write(json.dumps(d)+'\n')
  stop.wait(.2)

def paging(stop,path):
 i=0
 while not stop.is_set():
  start=time.monotonic();d={'utc':now(),'index':i}
  try:d['rows']=sql(PAGING,['movie'if i%2==0 else'show',604800000,100,(i%7)*100],node=i%3,timeout=180)['rowcount']
  except Exception as e:d['error']=str(e)
  d['seconds']=time.monotonic()-start
  with path.open('a')as f:f.write(json.dumps(d)+'\n')
  i+=1;stop.wait(max(0,1-d['seconds']))  # one sequential reader, <=1 query/s

def verify():
 result={}
 for t,target in [('imdb_episode',FULL_EP-STALE_EP),('imdb_season',FULL_SEASON-STALE_SEASON)]:
  total=sql('SELECT count(*) FROM '+t)['rows'][0][0]
  stale=sql("SELECT count(*) FROM "+t+(" WHERE imdb_episode_id LIKE 'stale%'"if t=='imdb_episode'else' WHERE show_id <= 2491 AND season_number=99'))['rows'][0][0]
  changed=sql('SELECT count(*) FROM '+t+' WHERE show_id<=2491')['rows'][0][0]
  assert total==target and stale==0 and changed==(EPISODES if t=='imdb_episode'else SEASONS),(t,total,stale,changed)
  result[t]={'remaining':total,'remaining_stale':stale,'retained_changed':changed}
 return result

def profile(label):
 version=state()['version'];chunk=chunks(200)[0];result={}
 for t in ['imdb_episode','imdb_season']:
  stmt,args=original(t,chunk);stmt=stmt.replace('DELETE FROM','SELECT show_id,'+('imdb_episode_id'if t=='imdb_episode'else'season_number')+' FROM',1)
  for mode in ['EXPLAIN ','EXPLAIN ANALYZE ']:
   start=time.monotonic()
   try:result[t+'-'+mode.strip()]={'result':sql(mode+stmt,args,timeout=600),'seconds':time.monotonic()-start,'kept_keys':len(args[1])}
   except Exception as e:result[t+'-'+mode.strip()]={'error':str(e),'seconds':time.monotonic()-start}
 save(f'profile-{version}-{label}.json',result);event(action='profile-complete',version=version,label=label)

def run(label,variant='original',with_paging=False,batch_size=200,with_upserts=False):
 assert sum(len(kept('imdb_episode',s))for s in range(1,SHOWS+1))==EPISODES
 assert sum(len(kept('imdb_season',s))for s in range(1,SHOWS+1))==SEASONS
 version=state()['version'];path=ROOT/f'run-{version}-{label}.json';assert not path.exists(),'No accidental replay'
 restore();before=pools();stop=threading.Event();telemetry=ROOT/f'pool-{version}-{label}.jsonl';tp=threading.Thread(target=sampler,args=(stop,telemetry),daemon=True);tp.start()
 pg=threading.Thread(target=paging,args=(stop,ROOT/f'paging-{version}-{label}.jsonl'),daemon=True)if with_paging else None
 if pg:pg.start();time.sleep(1)
 out={'version':version,'label':label,'variant':variant,'paging':with_paging,'batch_size':batch_size,'with_upserts':with_upserts,'started':now(),'before':before,'batches':[]};start=time.monotonic()
 try:
  for i,chunk in enumerate(chunks(batch_size)):
   b={'batch':i,'first_show':chunk[0],'last_show':chunk[-1],'shows':len(chunk),'statements':[]};bs=time.monotonic()
   for t in ['imdb_episode','imdb_season']:
    key='imdb_episode_id'if t=='imdb_episode'else'season_number'
    bulk=upsert(t,chunk,i%3)if with_upserts else None
    ts=time.monotonic()
    if variant=='original':
     stmt,args=original(t,chunk);res=sql(stmt,args,node=i%3,timeout=180);info={'table':t,'kept_keys':len(args[1]),'deleted':res['rowcount'],'server_ms':res['duration']}
    elif variant=='typed-bulk':
     params=[[s,kept(t,s)]for s in chunk]
     res=sql(f'DELETE FROM {t} WHERE show_id=? AND NOT ({key}=ANY(?))',bulk_args=params,node=i%3,timeout=180)
     results=res.get('results',[])
     assert len(results)==len(params)and all(r.get('rowcount',-1)>=0 and not r.get('error')and not r.get('error_message')for r in results),'Partial/failed bulk DELETE'
     info={'table':t,'kept_keys':sum(len(p[1])for p in params),'deleted':sum(r['rowcount']for r in results),'server_ms':res['duration'],'bulk_statements':len(params)}
    elif variant=='per-show':
     deleted=0;server=0
     # Bounded sequential per-show statements are also valid on versions lacking bulk DELETE.
     for s in chunk:
      res=sql(f'DELETE FROM {t} WHERE show_id=? AND NOT ({key}=ANY(?))',[s,kept(t,s)],node=i%3,timeout=180);deleted+=res['rowcount'];server+=res['duration']
     info={'table':t,'kept_keys':sum(len(kept(t,s))for s in chunk),'deleted':deleted,'server_ms':server}
    else:raise ValueError(variant)
    info['wall_seconds']=time.monotonic()-ts;info['upsert']=bulk;b['statements'].append(info)
   b['wall_seconds']=time.monotonic()-bs;out['batches'].append(b);save(path.name,out);event(action='batch',version=version,label=label,**b)
  out['wall_seconds']=time.monotonic()-start;out['delete_seconds']=sum(t['wall_seconds']for b in out['batches']for t in b['statements']);sql('REFRESH TABLE imdb_episode,imdb_season');out['verification']=verify();out['status']='PASS'
 except Exception as e:out['wall_seconds']=time.monotonic()-start;out['status']='FAILED';out['error']=str(e);event(action='run-error',version=version,label=label,error=str(e))
 finally:
  stop.set();tp.join(timeout=20)
  if pg:pg.join(timeout=190)
  out['after']=pools();out['ended']=now();samples=[json.loads(l)for l in telemetry.read_text().splitlines()];summary={}
  for node in NAMES:
   observed=[r for d in samples for r in d.get('nodes',[])if r[0]==node];b=next(r for r in before if r[0]==node);a=next(r for r in out['after']if r[0]==node);row={'max_heap_used':max((r[1]['used']for r in observed),default=0),'heap_max':b[1]['max']}
   for name in ['search','write']:
    obs=[p for r in observed for p in r[2]if p['name']==name];bp=next(p for p in b[2]if p['name']==name);ap=next(p for p in a[2]if p['name']==name)
    row[name]={'max_active':max((p['active']for p in obs),default=0),'max_queue':max((p['queue']for p in obs),default=0),'rejected_delta':ap['rejected']-bp['rejected'],'max_threads':max((p['threads']for p in obs),default=0)}
   summary[node]=row
  out['pool_summary']=summary;out['telemetry_errors']=sum('error'in d for d in samples);save(path.name,out);event(action='run-complete',version=version,label=label,status=out['status'],seconds=out['wall_seconds'],pool_summary=summary)
 return out

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['run','profile']);p.add_argument('label');p.add_argument('--paging',action='store_true');p.add_argument('--upserts',action='store_true');p.add_argument('--variant',default='original',choices=['original','per-show','typed-bulk']);p.add_argument('--batch-size',type=int,default=200);a=p.parse_args()
 if a.action=='profile':profile(a.label)
 else:
  result=run(a.label,a.variant,a.paging,a.batch_size,a.upserts)
  if result['status']!='PASS':raise SystemExit(1)
