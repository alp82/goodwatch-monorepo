"""Richer title and real Qdrant fixtures, only in this thread's guarded localhost services."""
import os, runpy, json, re
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
os.environ['MCP_LOCAL_CRATE_PORT']='15967'
root=Path(__file__).resolve().parents[1]
base=runpy.run_path(str(root/'mcp-personal/seed-local.py'))
sql,insert=base['sql'],base['insert']
runpy.run_path(str(root/'mcp-write/scoped-grants.py'))
for i in range(1,9):
 insert('person',tmdb_id=8000+i,name=f'Local Person {i}',profile_path='/person.jpg',popularity=10-i)
 insert('person_appeared_in',person_tmdb_id=8000+i,media_tmdb_id=2000,media_type='movie',character=f'Character {i}',order_default=i,credit_id=f'cast-{i}')
for kind,id,job in [('movie',2000,'Director'),('show',1399,'Creator'),('show',1399,'Director')]:
 insert('person_worked_on',person_tmdb_id=8001,media_tmdb_id=id,media_type=kind,credit_id=f'{kind}-{id}-{job}',job=job,department='Directing' if job=='Director' else None)
insert('media_video',tmdb_id='trailer-local',media_tmdb_id=2000,media_type='movie',site='YouTube',site_key='abcdefghijk',video_type='Trailer',official=True,language_code='en')

fingerprint=(root.parents[0]/'app/server/utils/fingerprint.ts').read_text()
keys=re.findall(r'"([a-z_]+)"',fingerprint.split('export const VALID_FINGERPRINT_KEYS')[1].split('] as const')[0])
scores={key:2 for key in keys}
scores.update(crime=9,mystery=9,tension=8,intrigue=9,wholesome=8,hopefulness=8,bleakness=2)
for kind,id in [('movie',2000),('show',1399)]:
 sql(f"UPDATE {kind} SET fingerprint_scores=?, essence_tags=?, essence_text=?, tropes=?, imdb_user_score_original=8.6, metacritic_meta_score_original=81, metacritic_user_score_original=7.8, rotten_tomatoes_tomato_score_original=91, rotten_tomatoes_audience_score_original=88 WHERE tmdb_id=?",[scores,['Local mystery','Kind friends'],'A hopeful local mystery about friends solving a crime.',['Found Family','Locked Room'],id])
insert('season',show_id=1399,tmdb_id=13991,season_number=1,episode_count=6,vote_average=8.2,air_date=1577836800000)
insert('season',show_id=1399,tmdb_id=13992,season_number=2,episode_count=3,air_date=1609459200000)
for n in range(1,7):
 insert('imdb_episode',show_id=1399,imdb_episode_id=f'tt900{n}',season_number=1,episode_number=n,name=f'Episode {n}',imdb_user_score_original=8+n/10,imdb_user_score_rating_count=100)
insert('imdb_season',show_id=1399,season_number=1,imdb_user_score_original=8.4,imdb_user_score_rating_count=600,max_episode_number=6)
insert('rotten_tomatoes_season',show_id=1399,season_number=1,rotten_tomatoes_tomato_score_original=94,rotten_tomatoes_tomato_score_review_count=20)
insert('metacritic_season',show_id=1399,season_number=1,metacritic_meta_score_original=85,metacritic_meta_score_review_count=12)
insert('user_not_interested',user_id='mcp-member-A',media_type='movie',tmdb_id=2002)
insert('user_skipped',user_id='mcp-member-A',media_type='movie',tmdb_id=2003)
for table in ['person','person_appeared_in','person_worked_on','media_video','movie','show','season','imdb_episode','imdb_season','rotten_tomatoes_season','metacritic_season','user_not_interested','user_skipped']:
 sql(f'REFRESH TABLE {table}')
http=build_opener(ProxyHandler({}))
def qdrant(path,body,method='PUT'):
 with http.open(Request('http://127.0.0.1:15970/'+path,json.dumps(body).encode(),headers={'Content-Type':'application/json'},method=method),timeout=30) as response:
  return json.load(response)
try:
 qdrant('collections/media_fingerprint_v1',{},'DELETE')
except HTTPError as error:
 if error.code != 404: raise
qdrant('collections/media_fingerprint_v1',{'vectors':{'fingerprint_v1':{'size':74,'distance':'Cosine'}}})
points=[]
for kind,id in [('movie',2000+i) for i in range(25)]+[('show',1399),('show',1400)]:
 i=id-2000 if kind=='movie' else 10 if id==1399 else 20
 points.append({'id':(1000000000000 if kind=='movie' else 2000000000000)+id,'vector':{'fingerprint_v1':[1,i/30]+[0]*72},'payload':{'tmdb_id':id,'media_type':kind,'title':f'Local Movie {i:02}' if kind=='movie' else 'Local Orbit' if id==1399 else 'Local Hold','release_year':2020,'poster_path':'/local.jpg','backdrop_path':'/local.jpg','fingerprint_scores_v1':scores,'goodwatch_overall_score_normalized_percent':80,'goodwatch_overall_score_voting_count':12000}})
qdrant('collections/media_fingerprint_v1/points?wait=true',{'points':points})
print('Seeded isolated rich titles, six rated episodes, season providers and 27 real Qdrant fingerprint neighbors')
