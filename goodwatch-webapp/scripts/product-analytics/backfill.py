#!/usr/bin/env python3
"""Resumable backfill of surviving records, never fabricated click/history events.

Dry-run by default. Keep --state outside the repository. The API key is the public
project token; database passwords are read from files or environment, never logged.
"""
import argparse
import base64
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

VERSION = 'goodwatch-records-v1'
INTERNAL = {'3a8e67d6-627b-47c3-a54f-9b873079e4a4', 'ee0e64c3-cf6a-48f9-8609-22325a9b7252'}
NAMESPACE = uuid.UUID('8d523da5-b2f8-50fa-9128-596e3e50aef9')
# table, event, primary-key columns, extra event columns, timestamp, precision
SOURCES = [
 ('auth_user', 'account created', ['id'], [], 'created_at', 'account_record'),
 ('user_score', 'rating saved', ['user_id','media_type','tmdb_id'], ['score'], 'updated_at', 'current_record'),
 ('user_wishlist', 'want to see added', ['user_id','media_type','tmdb_id'], [], 'created_at', 'surviving_record'),
 ('user_skipped', 'title skipped', ['user_id','media_type','tmdb_id'], [], 'created_at', 'surviving_record'),
 ('user_not_interested', 'not interested added', ['user_id','media_type','tmdb_id'], [], 'created_at', 'surviving_record'),
 ('user_favorite', 'favorite added', ['user_id','media_type','tmdb_id'], [], 'created_at', 'surviving_record'),
 ('user_watch_log', 'watch logged', ['user_id','watch_id'], ['tmdb_id','media_type','origin','import_id','group_id','season_number','episode_number','watched_at_precision'], 'created_at', 'surviving_record'),
 ('user_watch_state', 'watch state changed', ['user_id','media_type','tmdb_id'], ['state','pass'], 'updated_at', 'current_state_only'),
 ('user_list', 'list saved', ['user_id','id'], ['visibility'], 'updated_at', 'current_record'),
 ('user_import', 'import completed', ['user_id','id'], ['source','status','added','updated','kept','failed'], 'finished_at', 'surviving_record'),
]

def timestamp(value):
 if isinstance(value, (int,float)):
  return dt.datetime.fromtimestamp(value/1000, dt.timezone.utc).isoformat()
 return dt.datetime.fromisoformat(str(value).replace('Z','+00:00')).isoformat()

def envelope(table, event, row, keys, field, precision):
 user_id = row['id'] if table == 'auth_user' else row['user_id']
 if not user_id or row.get(field) is None:
  return None
 stamp = timestamp(row[field])
 props = {k:v for k,v in row.items() if k not in ('user_id','id',field,'source','status','group_id','state','watched_at_precision') and v is not None}
 props.update(distinct_id=user_id,user_id=user_id,**{'$user_id':user_id,'$geoip_disable':True,'$process_person_profile':True},
  is_guest=False,is_internal=user_id in INTERNAL,backfilled=True,backfill_version=VERSION,
  history_precision=precision,source='database_backfill',origin='unknown',environment='production',schema_version=1)
 if table == 'user_watch_log':
  props.update(watch_count=1,origin=row.get('origin') or 'unknown',batch_id=row.get('group_id'),date_precision=row.get('watched_at_precision'))
 elif table == 'user_watch_state':
  props.update(to_state=row['state'],from_state=None)
 elif table == 'user_list': props['list_id']=row['id']
 elif table == 'user_import':
  props.update(import_id=row['id'],import_source=row['source'],origin='import')
  event={'done':'import completed','undone':'import undone','failed':'import failed'}.get(row['status'])
  if event is None: return None
 identity=json.dumps([VERSION,table,[row[k] for k in keys],stamp],separators=(',',':'))
 return {'event':event,'uuid':str(uuid.uuid5(NAMESPACE,identity)),'timestamp':stamp,'properties':props}

def request_json(url, payload, headers=None):
 req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json',**(headers or {})})
 for attempt in range(4):
  try:
   with urllib.request.urlopen(req,timeout=30) as response: return json.load(response)
  except urllib.error.HTTPError as error:
   if error.code not in (429,500,502,503,504): raise RuntimeError(f'HTTP {error.code} at {urllib.parse.urlparse(url).path}') from None
   if attempt==3: raise RuntimeError(f'HTTP {error.code}; checkpoint retained') from None
  except (TimeoutError,urllib.error.URLError):
   if attempt==3: raise RuntimeError('Network failure; checkpoint retained') from None
  time.sleep(2**attempt)

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--apply',action='store_true')
 parser.add_argument('--crate-url',default=os.getenv('CRATE_URL','http://10.0.0.11:4200'))
 parser.add_argument('--password-file',required=True)
 parser.add_argument('--auth-password-file')
 parser.add_argument('--state',required=True)
 parser.add_argument('--host',default=os.getenv('POSTHOG_HOST','https://eu.i.posthog.com'))
 parser.add_argument('--only',choices=[s[0] for s in SOURCES])
 args=parser.parse_args()
 state_path=Path(args.state)
 state=json.loads(state_path.read_text()) if state_path.exists() else {'version':VERSION,'cutoff':int(time.time()*1000),'tables':{}}
 if state['version']!=VERSION: raise RuntimeError('Backfill checkpoint version mismatch')
 api_key=os.getenv('POSTHOG_API_KEY')
 if args.apply and not api_key: raise RuntimeError('POSTHOG_API_KEY required for --apply')
 def save():
  state_path.parent.mkdir(parents=True,exist_ok=True)
  temp=state_path.with_suffix('.tmp')
  temp.write_text(json.dumps(state));temp.chmod(0o600);temp.replace(state_path)
 for table,event,keys,extras,field,precision in SOURCES:
  if args.only and args.only!=table: continue
  if table=='auth_user' and not args.auth_password_file:
   print(json.dumps({'table':table,'skipped':'--auth-password-file required'}));continue
  progress=state['tables'].setdefault(table,{'cursor':None,'events':0,'complete':False})
  if progress['complete']: print(json.dumps({'table':table,'events':progress['events'],'complete':True,'already_checkpointed':True}));continue
  auth=table=='auth_user'
  password=Path(args.auth_password_file if auth else args.password_file).read_text().strip()
  authorization='Basic '+base64.b64encode((('goodwatch_auth' if auth else 'goodwatch_readonly')+':'+password).encode()).decode()
  while True:
   columns=list(dict.fromkeys(keys+extras+[field]))
   where=[f'"{field}" IS NOT NULL',f'"{field}" <= ?'];params=[state['cutoff']]
   if auth: where.append('deleted=false')
   if table=='user_list':where.append('deleted_at IS NULL')
   # Lexicographic keyset pagination: safe across restarts and independent of query page offsets.
   cursor=progress['cursor']
   if cursor:
    predicates=[]
    for i,k in enumerate(keys):
     predicates.append('('+' AND '.join([f'"{keys[j]}" = ?' for j in range(i)]+[f'"{k}" > ?'])+')')
     params.extend(cursor[:i+1])
    where.append('('+' OR '.join(predicates)+')')
   stmt='SELECT '+','.join('"'+c+'"' for c in columns)+' FROM doc.'+table+' WHERE '+' AND '.join(where)+' ORDER BY '+','.join('"'+c+'"' for c in keys)+' LIMIT 500'
   result=request_json(args.crate_url.rstrip('/')+'/_sql',{'stmt':stmt,'args':params},{'Authorization':authorization})
   rows=[dict(zip(result['cols'],row)) for row in result['rows']]
   if not rows:
    progress['complete']=True
    if args.apply:save()
    break
   batch=[item for row in rows if (item:=envelope(table,event,row,keys,field,precision))]
   if args.apply and batch: request_json(args.host.rstrip('/')+'/batch/',{'api_key':api_key,'historical_migration':True,'batch':batch})
   progress['events']+=len(batch);progress['cursor']=[rows[-1][k] for k in keys]
   if args.apply:save()
   if progress['events'] % 10000 < len(batch): print(json.dumps({'table':table,'events':progress['events'],'in_progress':True}),flush=True)
  print(json.dumps({'table':table,'events':progress['events'],'complete':progress['complete'],'applied':args.apply}),flush=True)
 if not args.apply: print('Dry run only; nothing sent or checkpointed.')

if __name__=='__main__':main()
