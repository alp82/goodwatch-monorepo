"""Probe concrete segmentation, parent-series and identity-conflict edge cases."""
import collections, concurrent.futures, json
import audit

sample=audit.load('sample-episodes.json',audit.TMP);bypos={(e['show_id'],e['season_number'],e['episode_number']):e for e in sample['tmdb']}
keys=[(387,1,n) for n in range(1,7)]+[(387,3,11),(387,3,12),(1920,3,1),(1920,3,2),(61374,2,1),(61374,3,1),(61374,4,1),(30984,2,1),(60572,9,26),(60572,9,27),(60572,9,28),(1399,1,1),(1399,1,2)]
# Probe the first inversion in the complete absolute-order group for One Piece.
group=next(g for g in audit.load('group-probes.json') if g['show_id']==37854 and g['group_name']=='Absolute (No Specials)')
payload=json.loads((audit.TMP/'api'/('_tv_episode_group_'+group['group_id'])).read_text())
onepiece={e['tmdb_id']:e for e in sample['tmdb'] if e['show_id']==37854 and e['season_number']>0};previous=None
for part in sorted(payload['groups'],key=lambda g:g['order']):
 for ge in sorted(part['episodes'],key=lambda e:e['order']):
  e=onepiece.get(ge['id'])
  if not e:continue
  pos=(e['season_number'],e['episode_number'])
  if previous and pos<previous[0]:
   keys.extend([(37854,previous[1]['season_number'],previous[1]['episode_number']),(37854,e['season_number'],e['episode_number'])]);break
  previous=(pos,e)
 else:continue
 break

made=0

def fetch(key):
 e=bypos.get(key)
 if not e:return {'show_id':key[0],'tmdb_position':list(key[1:]),'error':'not in catalog snapshot'}
 path=f'/tv/{key[0]}/season/{key[1]}/episode/{key[2]}'
 r=audit.requests.get('https://api.themoviedb.org/3'+path,params={'api_key':audit.CFG['TMDB_API_KEY'],'append_to_response':'external_ids'},timeout=20)
 if not r.ok:return {'show_id':key[0],'tmdb_position':list(key[1:]),'error':'HTTP '+str(r.status_code)}
 d=r.json();eid=d.get('external_ids',{}).get('imdb_id')
 return {'show_id':key[0],'tmdb_id':d.get('id'),'tmdb_position':list(key[1:]),'tmdb_name':d.get('name'),'external_imdb_id':eid,'live_catalog_identity_agrees':d.get('id')==e['tmdb_id'] and d.get('name')==e['name'],'path':path}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:results=list(ex.map(fetch,keys))
ids=sorted({r['external_imdb_id'] for r in results if r.get('external_imdb_id')});slots=','.join('?' for _ in ids)
lookup=audit.sql(f'SELECT show_id,imdb_episode_id,imdb_show_id,season_number,episode_number,name,imdb_user_score_original AS score FROM imdb_episode WHERE imdb_episode_id IN ({slots}) LIMIT 10000',ids)
for r in results:r['serving_imdb_matches']=[x for x in lookup if x['imdb_episode_id']==r.get('external_imdb_id')]
audit.save('edge-case-followup.json',results)
for r in results:print(json.dumps(r,ensure_ascii=False))
print('Additional TMDB requests',len(keys),flush=True)
