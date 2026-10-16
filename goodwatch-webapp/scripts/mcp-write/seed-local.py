"""Reset only the two write-probe members on the guarded dedicated loopback rehearsal."""
import runpy
import hashlib
import json
from pathlib import Path
base = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'mcp-read/seed-local.py'))
sql, insert = base['sql'], base['insert']
for member in ['mcp-writer-A', 'mcp-writer-B']:
    for table in ['user_mcp_action', 'user_watch_state', 'user_watch_log', 'user_score', 'user_wishlist', 'user_not_interested', 'user_setting']:
        sql(f'DELETE FROM {table} WHERE user_id = ?', [member])
now = base['now']
for code, name in [('DE', 'Germany'), ('US', 'United States'), ('GB', 'United Kingdom')]:
    insert('country', country_code=code, english_name=name)
sql('REFRESH TABLE country')
for service in [500, 501]:
    insert('streaming_service', tmdb_id=service, media_type='movie', name='Shared Stream')
for service, name in [(8, 'Netflix'), (9, 'Prime Video')]:
    for kind in ['movie', 'show']:
        insert('streaming_service', tmdb_id=service, media_type=kind, name=name)
sql('REFRESH TABLE streaming_service')
for member in ['mcp-writer-A', 'mcp-writer-B']:
    insert('user_setting', user_id=member, key='country_default', value='DE')
    insert('user_setting', user_id=member, key='streaming_providers_default', value='')
insert('user_watch_state', user_id='mcp-writer-A', media_type='show', tmdb_id=1399, state='watching', state_changed_at=now, **{'pass': 1}, created_at=now, updated_at=now)
for n in [1,2]:
    insert('user_watch_log', user_id='mcp-writer-A', watch_id=f'writer-1399-{n}', media_type='show', tmdb_id=1399, episode_tmdb_id=139900+n, season_number=1, episode_number=n, watched_at=None, watched_at_precision='unknown', origin='single', **{'pass': 1}, created_at=now, updated_at=now)
pending_args = {'title_id': 'movie:3000', 'action_id': 'pending-local-movie'}
pending_hash = hashlib.sha256(json.dumps({'name': 'log_watch', 'args': pending_args}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
insert('user_mcp_action', user_id='mcp-writer-A', action_id='pending-local-movie', request_hash=pending_hash, owner_id='seeded-pending-owner', result=json.dumps({'outcome': 'indeterminate', 'action_id': 'pending-local-movie', 'replayed': False, 'title': {'id': 'movie:3000'}, 'message': 'An earlier attempt may have applied. Inspect this title before retrying.'}), created_at=now, updated_at=now)
for table in ['user_mcp_action', 'user_watch_state', 'user_watch_log', 'user_score', 'user_wishlist', 'user_not_interested', 'user_setting']:
    sql(f'REFRESH TABLE {table}')
print('Reset local write-probe members only')
