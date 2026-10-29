"""Build synthetic catalog data in the ticket's disposable loopback Crate only."""
import json, urllib.request, time, re
from pathlib import Path
TARGET = 'http://127.0.0.1:15873/_sql'
SOURCE = 'http://127.0.0.1:15870/_sql'
def sql(stmt, args=None, source=False):
    req = urllib.request.Request(SOURCE if source else TARGET, data=json.dumps({'stmt': stmt, 'args': args or []}).encode(), headers={'Content-Type':'application/json'})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode())
for attempt in range(60):
    try:
        sql('SELECT 1'); break
    except Exception: time.sleep(1)
assert sql('SELECT name FROM sys.cluster')['rows'] == [['gw-perf-stats']], 'Refusing another local cluster'
for table in ['movie','show','person','person_appeared_in','person_worked_on']:
    ddl = sql('SHOW CREATE TABLE '+table, source=True)['rows'][0][0]
    ddl = re.sub(r'number_of_replicas = [^,\n]+', "number_of_replicas = '0'", ddl)
    sql(ddl)
# Only public catalog fields. No user table is read or copied.
fields = 'title,release_year,poster_path,backdrop_path,genres,is_anime,production_country_codes,original_language_code,essence_tags,goodwatch_overall_score_normalized_percent'
for kind,n in [('movie',800),('show',300)]:
    cols=fields.split(',') + (['runtime','budget','revenue'] if kind=='movie' else ['episode_runtime'])
    rows=sql(f"SELECT {','.join(cols)} FROM {kind} ORDER BY tmdb_id LIMIT 1000",source=True)['rows']
    for i in range(1,n+1):
        values=rows[(i-1)%len(rows)]
        # Wide repeated trope lists stress the former full-array transfer. Duplicate labels must count once/title.
        tropes=[f'Trope {j%120:03d}' for j in range(i%80, i%80+250)]
        sql(f"INSERT INTO {kind} (tmdb_id,{','.join(cols)},tropes) VALUES ({','.join(['?']*(len(cols)+2))}) ON CONFLICT DO NOTHING",[i,*values,tropes])
        for order in range(8):
            pid=1+(i*7+order)%350
            sql('INSERT INTO person_appeared_in (credit_id,person_tmdb_id,media_tmdb_id,media_type,order_default) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING',[f'{kind}-{i}-{order}',pid,i,kind,order])
        if kind=='movie':
            for j,job in enumerate(['Director','Writer','Screenplay','Original Music Composer']):
                sql('INSERT INTO person_worked_on (credit_id,person_tmdb_id,media_tmdb_id,media_type,job) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING',[f'{kind}-{i}-{j}',351+(i*3+j)%100,i,kind,job])
for pid in range(1,451):
    sql('INSERT INTO person (tmdb_id,name,profile_path) VALUES (?,?,?) ON CONFLICT DO NOTHING',[pid,f'Fixture person {pid}',None])
for table in ['movie','show','person','person_appeared_in','person_worked_on']: sql('REFRESH TABLE '+table)
print('Synthetic fixture: 1,100 titles, 8,800 cast rows, 3,200 crew rows, 450 people')
# Empty schemas support the real profile loader without copying any member rows.
for (table,) in sql("SELECT table_name FROM information_schema.tables WHERE table_schema='doc'", source=True)['rows']:
    if table in ['movie','show','person','person_appeared_in','person_worked_on']: continue
    ddl=sql('SHOW CREATE TABLE "'+table+'"',source=True)['rows'][0][0]
    sql(ddl)
now=1790812800000
sql('INSERT INTO user_profile (user_id,handle,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',['stats-synthetic','stats_synthetic',now,now])
for kind,n in [('movie',700),('show',300)]:
    for i in range(1,n+1):
        sql('INSERT INTO user_score (user_id,media_type,tmdb_id,score,updated_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING',['stats-synthetic',kind,i,1+(i-1)%10,now])
for table in ['user_profile','user_score']: sql('REFRESH TABLE '+table)
print('Synthetic public profile: /u/stats_synthetic/stats')
# Within each score, distinct years make poster ranking deterministic despite unordered SQL credits.
for kind,n,start in [('movie',800,1900),('show',300,1970)]:
    for i in range(1,n+1): sql(f'UPDATE {kind} SET release_year = ? WHERE tmdb_id = ?',[start+(i-1)//10,i])
    sql('REFRESH TABLE '+kind)
# Populate the synthetic titles' analyses so a separate snapshot describes all 1,000 scores.
for kind,n in [('movie',800),('show',300)]:
    date_col='release_date' if kind=='movie' else 'last_air_date'
    cols=['fingerprint_scores','popularity','goodwatch_overall_score_voting_count',date_col]
    samples=sql(f"SELECT {','.join(cols)} FROM {kind} WHERE fingerprint_scores IS NOT NULL ORDER BY tmdb_id LIMIT 1000",source=True)['rows']
    for i in range(1,n+1):
        sql(f"UPDATE {kind} SET "+','.join(c+' = ?' for c in cols)+' WHERE tmdb_id = ?', [*samples[(i-1)%len(samples)],i])
    sql('REFRESH TABLE '+kind)
