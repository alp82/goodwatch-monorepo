"""Seed only the dedicated localhost MCP rehearsal cluster using the repository schemas."""
import importlib.util
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler

port = os.environ.get('MCP_LOCAL_CRATE_PORT', '15767')
assert port in ('15767', '15548', '15848', '16248'), 'Dedicated local MCP, account-page or account-deletion rehearsal port required'
cluster = 'gw-mcp-567' if port == '15767' else 'goodwatch-local-auth-548'
member = os.environ.get('MCP_LOCAL_MEMBER_ID', 'mcp-member-A')
url = f'http://127.0.0.1:{port}/_sql'
http = build_opener(ProxyHandler({}))
def sql(stmt, args=None):
    with http.open(Request(url, data=json.dumps({'stmt': stmt, 'args': args or []}).encode(), headers={'Content-Type': 'application/json'}), timeout=30) as response:
        return json.load(response)
assert sql('SELECT name FROM sys.cluster')['rows'] == [[cluster]], 'Wrong local cluster; refusing to seed'
source = Path(__file__).resolve().parents[3] / 'goodwatch-flows/windmill/f/sync/models/crate_schemas.py'
# Shared schemas import other Windmill modules through the top-level f package.
sys.path.insert(0, str(source.parents[3]))
spec = importlib.util.spec_from_file_location('schemas', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for name, schema in module.SCHEMAS.items():
    columns = schema['columns'].copy()
    if schema.get('timestamps') is not False:
        columns |= {'created_at': 'TIMESTAMP', 'updated_at': 'TIMESTAMP'}
    definitions = [f'{key} {kind}' for key, kind in columns.items()]
    definitions += [f"PRIMARY KEY ({','.join(schema['primary_key'])})"]
    routing = f"BY ({schema['clustered_by']}) " if schema.get('clustered_by') else ''
    sql(f"CREATE TABLE IF NOT EXISTS {name} ({','.join(definitions)}) CLUSTERED {routing}INTO 1 SHARDS WITH (number_of_replicas=0)")
# The MCP receipt table is created by hand in production (cut-over step 1.4), so it isn't in SCHEMAS.
import re
receipts = (Path(__file__).resolve().parents[3] / 'docs/implementation/mcp-write-tools-schema.sql').read_text()
receipts = '\n'.join(line for line in receipts.splitlines() if not line.startswith('--')).strip().rstrip(';')
receipts = re.sub(r'INTO \d+ SHARDS$', 'INTO 1 SHARDS WITH (number_of_replicas=0)', receipts.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1))
sql(receipts)

def insert(table, **row):
    sql(f"INSERT INTO {table} ({','.join(row)}) VALUES ({','.join('?' for _ in row)}) ON CONFLICT DO NOTHING", list(row.values()))

now = 1791982800000
for i in range(25):
    insert('movie', tmdb_id=2000+i, title=f'Local Movie {i:02}', original_title=f'Local Movie {i:02}', release_year=2020, synopsis='A local test movie.', poster_path='/local.jpg', runtime=100, goodwatch_overall_score_normalized_percent=80, adult=False)
    insert('user_wishlist', user_id=member, media_type='movie', tmdb_id=2000+i, created_at=now-i*1000, updated_at=now)
for id, title, state in [(1399, 'Local Orbit', 'watching'), (1400, 'Local Hold', 'on_hold')]:
    insert('show', tmdb_id=id, title=title, original_title=title, release_year=2020, synopsis='A local test show.', poster_path='/show.jpg', aired_episode_count=6, number_of_seasons=1, number_of_episodes=6, status='Returning Series', goodwatch_overall_score_normalized_percent=85)
    insert('user_watch_state', user_id=member, media_type='show', tmdb_id=id, state=state, state_changed_at=now, **{"pass": 1}, seen_question='not_asked', created_at=now, updated_at=now)
    for n in range(1,7):
        insert('episode', show_id=id, tmdb_id=id*100+n, season_number=1, episode_number=n, name=f'Episode {n}', air_date=1577836800000+(n-1)*86400000, runtime=40)
    for n in range(1,3):
        insert('user_watch_log', user_id=member, watch_id=f'local-{id}-{n}', media_type='show', tmdb_id=id, episode_tmdb_id=id*100+n, season_number=1, episode_number=n, watched_at=None, watched_at_precision='unknown', origin='single', **{"pass": 1}, created_at=now, updated_at=now)
insert('user_watch_state', user_id=member, media_type='movie', tmdb_id=2000, state='seen', state_changed_at=now, **{'pass': 1}, seen_question='not_asked', created_at=now, updated_at=now)
insert('user_watch_log', user_id=member, watch_id='score-movie-2000', media_type='movie', tmdb_id=2000, watched_at=None, watched_at_precision='unknown', origin='score', **{'pass': 1}, created_at=now, updated_at=now)
insert('user_watch_log', user_id=member, watch_id='earlier-pass', media_type='show', tmdb_id=1400, episode_tmdb_id=140006, season_number=1, episode_number=6, watched_at=1578268800000, watched_at_precision='day', origin='single', **{'pass': 0}, created_at=now, updated_at=now)
insert('movie', tmdb_id=3000, title='Harbor', original_title='Harbor', release_year=2019, adult=False)
insert('movie', tmdb_id=3001, title='Harbor', original_title='Harbor', release_year=2024, adult=False)
insert('user_score', user_id=member, media_type='movie', tmdb_id=2000, score=8, updated_at=now)
insert('user_setting', user_id=member, key='country_default', value='DE')
insert('user_setting', user_id=member, key='streaming_providers_default', value='')
insert('user_wishlist', user_id='mcp-member-B', media_type='movie', tmdb_id=2001, created_at=now, updated_at=now)
for table in [*module.SCHEMAS, 'user_mcp_action']:
    sql(f'REFRESH TABLE {table}')
print('Seeded dedicated local MCP cluster with 29 catalog titles and two isolated members')
