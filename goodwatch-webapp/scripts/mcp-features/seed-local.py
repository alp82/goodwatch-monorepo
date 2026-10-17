"""Seed only local synthetic feature-probe members and credits, using the guarded MCP cluster."""
import runpy
from pathlib import Path
base = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'mcp-write/seed-local.py'))
sql, insert, now = base['sql'], base['insert'], base['now']
for member in ['mcp-taste-features-A', 'mcp-features-B', 'mcp-features-no-handle']:
    for table in ['user_mcp_action', 'user_watch_state', 'user_watch_log', 'user_score', 'user_wishlist', 'user_not_interested', 'user_skipped', 'user_setting', 'user_list', 'user_profile']:
        sql(f'DELETE FROM {table} WHERE user_id = ?', [member])
    insert('user_setting', user_id=member, key='country_default', value='DE')
    insert('user_setting', user_id=member, key='streaming_providers_default', value='8,9')
for member, handle in [('mcp-taste-features-A', 'local_features_a'), ('mcp-features-B', 'local_features_b')]:
    insert('user_profile', user_id=member, handle=handle, created_at=now, updated_at=now)
for person_id, name in [(910001, 'Local Feature Person'), (910002, 'Local Feature Person')]:
    insert('person', tmdb_id=person_id, name=name, known_for_department='Directing', popularity=5)
for i, id in enumerate([2000,2001,2002,2003,2024]):
    insert('person_appeared_in', media_tmdb_id=id, media_type='movie', person_tmdb_id=910001, credit_id=f'feature-acting-{id}', character='Local character', order_default=i)
for id, department, job in [(2001,'Directing','Director'), (2002,'Writing','Writer'), (2024,'Directing','Director')]:
    insert('person_worked_on', media_tmdb_id=id, media_type='movie', person_tmdb_id=910001, credit_id=f'feature-crew-{id}', department=department, job=job)
insert('person_worked_on', media_tmdb_id=1399, media_type='show', person_tmdb_id=910001, credit_id='feature-show-writing', department='Writing', job='Writer')
insert('user_score', user_id='mcp-taste-features-A', media_type='movie', tmdb_id=2001, score=8, updated_at=now)
insert('user_skipped', user_id='mcp-taste-features-A', media_type='movie', tmdb_id=2002, created_at=now)
# Distinct years and scores prove full-list ordering before pagination, even when a credit lacks display data.
sql('UPDATE movie SET release_year = 2024, goodwatch_overall_score_normalized_percent = 95 WHERE tmdb_id = 2000')
sql('UPDATE movie SET release_year = 2025, goodwatch_overall_score_normalized_percent = 60, poster_path = null WHERE tmdb_id = 2003')
for table in ['person','person_appeared_in','person_worked_on','movie','user_mcp_action','user_watch_state','user_watch_log','user_score','user_wishlist','user_not_interested','user_skipped','user_setting','user_list','user_profile']:
    sql(f'REFRESH TABLE {table}')
print('Seeded local feature members, name collisions, acting/directing/writing credits and five-title list inputs')
