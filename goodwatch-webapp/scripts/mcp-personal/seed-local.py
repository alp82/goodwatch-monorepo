"""Personal title metadata probes, only on the dedicated guarded localhost cluster."""
import runpy, json, time
from pathlib import Path
base=runpy.run_path(str(Path(__file__).resolve().parents[1]/'mcp-read/seed-local.py'))
sql,insert=base['sql'],base['insert']
now=int(time.time()*1000)
for member in ['mcp-taste-A','mcp-taste-B','mcp-taste-failure']:
 for table in ['user_watch_state','user_watch_log','user_wishlist','user_score','user_setting','user_mcp_action']:
  sql(f'DELETE FROM {table} WHERE user_id = ?', [member])
 for i in range(25):
  insert('user_wishlist',user_id=member,media_type='movie',tmdb_id=2000+i,created_at=now-i*1000,updated_at=now)
  insert('user_watch_state',user_id=member,media_type='movie',tmdb_id=2000+i,state='seen',state_changed_at=now,**{'pass':1},seen_question='not_asked',created_at=now,updated_at=now)
 insert('user_setting',user_id=member,key='country_default',value='DE' if member != 'mcp-taste-B' else 'US')
 insert('user_setting',user_id=member,key='streaming_providers_default',value='8')
 insert('user_watch_state',user_id=member,media_type='show',tmdb_id=1399,state='watching',state_changed_at=now,**{'pass':1},seen_question='not_asked',created_at=now,updated_at=now)
 insert('user_watch_log',user_id=member,watch_id='personal-episode',media_type='show',tmdb_id=1399,episode_tmdb_id=139901,season_number=1,episode_number=1,watched_at=None,watched_at_precision='unknown',origin='single',**{'pass':1},created_at=now,updated_at=now)
sql('UPDATE movie SET runtime = 310 WHERE tmdb_id=2001')
sql('UPDATE movie SET runtime = 240 WHERE tmdb_id=2002')
sql('UPDATE show SET episode_runtime = [40] WHERE tmdb_id=1399')
for id,name in [(8,'Netflix'),(9,'Amazon Prime Video')]:
 for kind in ['movie','show']:
  insert('streaming_service',tmdb_id=id,media_type=kind,name=name,logo_path='/local.jpg')
for kind,id in [('show',1399),('movie',2000)]:
 for country in ['DE','US']:
  checks=[{'source':source,'snapshot_id':source,'checked_at':now,'last_attempt_at':now,'state':'usable','reason':None,'offer_types':['flatrate','free','ads'],'mapping_complete':True,'offers':[{'service_id':provider,'offer_type':'flatrate','snapshot_id':source,'stream_url':None} for provider in [8,9]]} for source in ['tmdb_web','tmdb_api']]
  payload={'version':1,'media_tmdb_id':id,'media_type':kind,'country_code':country,'checks':checks,'unknown_contributions':False}
  sql('DELETE FROM streaming_evidence WHERE media_tmdb_id=? AND media_type=? AND country_code=?',[id,kind,country])
  insert('streaming_evidence',media_tmdb_id=id,media_type=kind,country_code=country,payload=json.dumps(payload),updated_at=now)
  sql('DELETE FROM streaming_availability WHERE media_tmdb_id=? AND media_type=? AND country_code=?',[id,kind,country])
  insert('streaming_availability',media_tmdb_id=id,media_type=kind,country_code=country,streaming_service_id=8,streaming_type='flatrate',stream_url=f'https://www.netflix.com/title/{country}-{kind}-{id}',updated_at=now)
for table in ['movie','show','streaming_evidence','streaming_availability','streaming_service','user_watch_state','user_watch_log','user_wishlist','user_score','user_setting','user_mcp_action']:
 sql(f'REFRESH TABLE {table}')
print('Seeded isolated personal metadata, full-library runtime and country/service link fixtures')
