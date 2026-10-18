"""Independent signal history. Never writes catalog or Wikipedia tables."""
import datetime as dt
import json

from f.external_ids.imdb_ids import valid_imdb_id

DDL = {
    'buzz_signal': '''source TEXT, day TEXT, title_key TEXT, rank INTEGER,
        value DOUBLE PRECISION, raw TEXT INDEX OFF, collected_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (source, day, title_key)''',
    'buzz_signal_mapping': '''source TEXT, source_id TEXT, title_key TEXT,
        raw TEXT INDEX OFF, checked_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (source, source_id)''',
    'buzz_signal_run': '''source TEXT, day TEXT, status TEXT, details TEXT INDEX OFF,
        collected_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (source, day)''',
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


class SignalStore:
    def __init__(self, crate):
        self.crate = crate
        self.mapping_cache = {}

    def initialize(self):
        for table, columns in DDL.items():
            self.crate.run(f"CREATE TABLE IF NOT EXISTS doc.{table} ({columns}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 1, column_policy = 'strict')")

    def upsert(self, table, rows, keys):
        if table not in DDL:
            raise ValueError('Not a signal table')
        if not rows:
            return
        columns = list(rows[0])
        sql = (f'INSERT INTO doc.{table} ({", ".join(chr(34)+c+chr(34) for c in columns)}) '
               f'VALUES ({", ".join("?" for _ in columns)}) ON CONFLICT ({", ".join(keys)}) DO UPDATE SET '
               + ', '.join(f'"{c}" = excluded."{c}"' for c in columns if c not in keys))
        for offset in range(0, len(rows), 500):
            self.crate.run_many(sql, [[r[c] for c in columns] for r in rows[offset:offset+500]])

    def save(self, source, day, rows, now):
        # One row per title; FlixPatrol aggregates service entries before this call.
        if len({r['title_key'] for r in rows}) != len(rows):
            raise ValueError('Duplicate signal identities')
        self.upsert('buzz_signal', [dict(source=source, day=day, title_key=r['title_key'],
            rank=r.get('rank'), value=r.get('value'), raw=encode(r['raw']), collected_at=now.isoformat())
            for r in rows], ['source', 'day', 'title_key'])

    def status(self, source, day, result, now):
        self.upsert('buzz_signal_run', [dict(source=source, day=day, status=result['status'],
            details=encode(result), collected_at=now.isoformat())], ['source', 'day'])

    def cohort(self):
        # Include historical Wikipedia winners, not only today's candidate pool.
        keys = {r['title_key'] for r in self.crate.select('SELECT title_key FROM doc.buzz_title LIMIT 100000')}
        for r in self.crate.select("SELECT payload FROM doc.buzz_snapshot WHERE snapshot_key != 'current' LIMIT 10000"):
            keys.update(t['title_key'] for t in json.loads(r['payload'])['top20'])
        for kind, table in [('movie', 'movie'), ('tv', 'show')]:
            keys.update(f"{kind}:{r['tmdb_id']}" for r in self.crate.select(
                f'SELECT tmdb_id FROM doc."{table}" WHERE adult IS NULL OR adult = false ORDER BY popularity DESC NULLS LAST, tmdb_id LIMIT 250'))
        return keys

    def imdb(self, ids, kind):
        table = 'movie' if kind == 'movie' else 'show'
        ids = sorted({i for i in ids if valid_imdb_id(i)})
        if not ids:
            return {}
        found = {}
        # These fields already publish the TMDB-primary / Wikidata-fallback mapping.
        for row in self.crate.select(f'SELECT tmdb_id, imdb_id FROM doc."{table}" WHERE imdb_id = ANY(?) LIMIT 10000', (ids,)):
            found.setdefault(row['imdb_id'], set()).add(f"{kind}:{row['tmdb_id']}")
        return {key: next(iter(values)) for key, values in found.items() if len(values) == 1}

    def catalog_match(self, name, year, kind):
        if not name or not year or kind not in ('movie', 'tv'):
            return None
        table, date_col = ('movie', 'release_date') if kind == 'movie' else ('show', 'first_air_date')
        rows = self.crate.select(f'SELECT tmdb_id FROM doc."{table}" WHERE (LOWER(title) = ? OR LOWER(original_title) = ?) AND {date_col} >= ? AND {date_col} < ? LIMIT 2',
            (name.casefold(), name.casefold(), f'{int(year)}-01-01', f'{int(year)+1}-01-01'))
        return f"{kind}:{rows[0]['tmdb_id']}" if len(rows) == 1 else None

    def mapping(self, source, source_id):
        key = (source, source_id)
        if key not in self.mapping_cache:
            rows = self.crate.select('SELECT title_key, raw FROM doc.buzz_signal_mapping WHERE source = ? AND source_id = ?', key)
            self.mapping_cache[key] = rows[0] if rows else None
        return self.mapping_cache[key]

    def save_mapping(self, source, source_id, title_key, raw, now):
        row = dict(source=source, source_id=source_id, title_key=title_key, raw=encode(raw), checked_at=now.isoformat())
        self.upsert('buzz_signal_mapping', [row], ['source', 'source_id'])
        self.mapping_cache[(source, source_id)] = row
