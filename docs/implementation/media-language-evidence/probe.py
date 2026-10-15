"""Bounded SELECT-only production evidence. No model calls or database writes."""
import json, shlex, subprocess
from pathlib import Path

MOVIES = [550, 278, 238, 155, 27205, 157336, 603, 13, 129, 496243]
SHOWS = [1396, 1399, 66732, 42009, 1668, 2316, 1398, 100088, 119051, 93405]
SCOPE = f"((media_type='movie' AND media_tmdb_id IN ({','.join(map(str, MOVIES))})) OR (media_type='show' AND media_tmdb_id IN ({','.join(map(str, SHOWS))})))"

def select(sql):
    assert sql.startswith('SELECT ')
    command = 'docker exec crate-01 crash --timeout 5,15 --format json -c ' + shlex.quote(sql)
    raw = subprocess.check_output(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'root@10.0.0.11', command], text=True)
    return json.loads(raw[raw.index('['):])

out = {'date': '2026-10-14', 'source': 'Crate production on 10.0.0.11, SELECT only; 10 named movies + 10 named shows', 'queries': {}}
queries = {
    'schemas': "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='doc' AND table_name IN ('translation','media_image','episode','season','user_setting') ORDER BY table_name,ordinal_position",
    'translation_tables': "SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND (table_name LIKE '%translation%' OR table_name LIKE '%locale%') ORDER BY table_name",
    'movies': f"SELECT tmdb_id,title,original_language_code FROM movie WHERE tmdb_id IN ({','.join(map(str, MOVIES))}) ORDER BY tmdb_id",
    'shows': f"SELECT tmdb_id,title,original_language_code FROM show WHERE tmdb_id IN ({','.join(map(str, SHOWS))}) ORDER BY tmdb_id",
    'text_coverage': f"SELECT language_code,country_code,COUNT(*) AS rows,SUM(CASE WHEN trim(coalesce(title,'')) <> '' THEN 1 ELSE 0 END) AS titles,SUM(CASE WHEN trim(coalesce(overview,'')) <> '' THEN 1 ELSE 0 END) AS overviews,SUM(CASE WHEN trim(coalesce(tagline,'')) <> '' THEN 1 ELSE 0 END) AS taglines FROM translation WHERE {SCOPE} GROUP BY language_code,country_code ORDER BY language_code,country_code",
    'poster_coverage': f"SELECT language_code,COUNT(DISTINCT media_type || '-' || CAST(media_tmdb_id AS TEXT)) AS titles FROM media_image WHERE {SCOPE} AND image_type='posters' AND trim(coalesce(url_path,'')) <> '' GROUP BY language_code ORDER BY language_code",
}
for name, sql in queries.items():
    out['queries'][name] = {'sql': sql, 'rows': select(sql)}
Path(__file__).with_name('coverage.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({name: data['rows'] for name, data in out['queries'].items() if name != 'schemas'}, ensure_ascii=False, indent=2))
