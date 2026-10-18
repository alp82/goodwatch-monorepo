"""Storage owned by f/buzz. Every mutation targets only one of five new tables."""
import datetime as dt
import json

from f.buzz.collect import iso_day

TABLES = ('buzz_title', 'buzz_pageview', 'buzz_trending', 'buzz_score', 'buzz_snapshot')
DDL = {
    'buzz_title': '''title_key TEXT PRIMARY KEY, kind TEXT, tmdb_id INTEGER, title TEXT,
        original_title TEXT, poster_path TEXT, release_date TEXT, popularity DOUBLE PRECISION,
        article TEXT, qid TEXT, mapping_status TEXT, mapping_checked_at TEXT, last_candidate_at TEXT''',
    'buzz_pageview': '''title_key TEXT, day TEXT, article TEXT, views BIGINT, fetched_at TEXT, source TEXT,
        PRIMARY KEY (title_key, day)''',
    'buzz_trending': '''snapshot_day TEXT, kind TEXT, tmdb_id INTEGER, rank INTEGER,
        popularity DOUBLE PRECISION, title TEXT, raw TEXT INDEX OFF, fetched_at TEXT, expected_count INTEGER,
        PRIMARY KEY (snapshot_day, kind, tmdb_id)''',
    'buzz_score': '''day TEXT, title_key TEXT, score DOUBLE PRECISION, eligible BOOLEAN,
        rank INTEGER, views BIGINT, mean28 DOUBLE PRECISION, sd28 DOUBLE PRECISION,
        z DOUBLE PRECISION, curve TEXT INDEX OFF, card TEXT INDEX OFF, reasons TEXT INDEX OFF,
        PRIMARY KEY (day, title_key)''',
    'buzz_snapshot': '''snapshot_key TEXT PRIMARY KEY, day TEXT, generated_at TEXT,
        payload TEXT INDEX OFF''',
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


WIKIPEDIA_SOURCES = {'wikipedia_api', 'wikipedia_dumps'}


def snapshot_source(payload):
    source = payload.get('source')
    return 'wikipedia_api' if not source or source == 'Wikipedia en.wikipedia.org / all-access / user' else source


def priority(row):
    return int(snapshot_source(json.loads(row['payload'])) in WIKIPEDIA_SOURCES)


class BuzzStore:
    def __init__(self, crate):
        self.crate = crate

    def initialize(self):
        for table, columns in DDL.items():
            self.crate.run(f'CREATE TABLE IF NOT EXISTS doc.{table} ({columns}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 1, column_policy = \'strict\')')
        # Upgrade only our newly created table from the initial local backfill schema.
        columns = self.crate.select("SELECT column_name FROM information_schema.columns WHERE table_schema = 'doc' AND table_name = 'buzz_trending' AND column_name = 'expected_count'")
        if not columns:
            self.crate.run('ALTER TABLE doc.buzz_trending ADD COLUMN expected_count INTEGER')

        columns = self.crate.select("SELECT column_name FROM information_schema.columns WHERE table_schema = 'doc' AND table_name = 'buzz_pageview' AND column_name = 'source'")
        if not columns:
            self.crate.run('ALTER TABLE doc.buzz_pageview ADD COLUMN source TEXT')

    def refresh(self, table):
        assert table in TABLES
        self.crate.run(f'REFRESH TABLE doc.{table}')

    def upsert(self, table, rows, keys, *, replace=True):
        assert table in TABLES
        if not rows:
            return
        columns = list(rows[0])
        updates = ', '.join(f'"{c}" = excluded."{c}"' for c in columns if c not in keys)
        sql = (f'INSERT INTO doc.{table} ({", ".join(chr(34) + c + chr(34) for c in columns)}) '
               f'VALUES ({", ".join("?" for _ in columns)}) ON CONFLICT ({", ".join(keys)}) DO '
               + ('UPDATE SET ' + updates if replace else 'NOTHING'))
        for offset in range(0, len(rows), 500):
            self.crate.run_many(sql, [[r.get(c) for c in columns] for r in rows[offset:offset + 500]])

    def candidates(self, trending):
        titles = {}
        for kind, table, release in (('movie', 'movie', 'release_date'), ('tv', 'show', 'first_air_date')):
            columns = f'tmdb_id, title, original_title, poster_path, {release} AS release_date, popularity'
            rows = self.crate.select(f'SELECT {columns} FROM doc."{table}" WHERE popularity IS NOT NULL AND (adult IS NULL OR adult = false) ORDER BY popularity DESC, tmdb_id ASC LIMIT 250')
            ids = [row['id'] for row in trending[kind]]
            if ids:
                rows += self.crate.select(f'SELECT {columns} FROM doc."{table}" WHERE tmdb_id = ANY(?) AND (adult IS NULL OR adult = false)', (ids,))
            for row in rows:
                key = f"{kind}:{row['tmdb_id']}"
                titles[key] = dict(row, title_key=key, kind=kind, release_date=iso_day(row['release_date']))
        return sorted(titles.values(), key=lambda t: t['title_key'])

    def catalog_names(self, names):
        out = []
        for kind, table in (('movie', 'movie'), ('tv', 'show')):
            out += [dict(row, kind=kind, title_key=f"{kind}:{row['tmdb_id']}") for row in
                    self.crate.select(f'SELECT tmdb_id, title, original_title FROM doc."{table}" WHERE LOWER(title) = ANY(?) OR LOWER(original_title) = ANY(?)', (names[kind], names[kind]))]
        return out

    def read_titles(self):
        self.refresh('buzz_title')
        return {r['title_key']: r for r in self.crate.select('SELECT * FROM doc.buzz_title')}

    def save_titles(self, titles):
        self.upsert('buzz_title', titles, ['title_key'])

    def save_trending(self, lists, now):
        rows = []
        expected = sum(len(values) for values in lists.values())
        for kind, values in lists.items():
            for rank, row in enumerate(values, 1):
                rows.append(dict(snapshot_day=now.date().isoformat(), kind=kind, tmdb_id=row['id'], rank=rank,
                                 popularity=row.get('popularity'), title=row.get('title') or row.get('name'),
                                 raw=encode(row), fetched_at=now.isoformat(), expected_count=expected))
        if not rows:
            raise RuntimeError('Empty TMDB trending response; current snapshot preserved')
        # Only incomplete captures reach here. Replace them in full on retry.
        self.crate.run('DELETE FROM doc.buzz_trending WHERE snapshot_day = ?', (now.date().isoformat(),))
        self.upsert('buzz_trending', rows, ['snapshot_day', 'kind', 'tmdb_id'])

    def read_trending(self, now):
        self.refresh('buzz_trending')
        rows = self.crate.select('SELECT kind, rank, raw, expected_count FROM doc.buzz_trending WHERE snapshot_day = ? ORDER BY kind, rank', (now.date().isoformat(),))
        if not rows or any(r['expected_count'] != len(rows) for r in rows):
            return None
        return {kind: [json.loads(r['raw']) for r in rows if r['kind'] == kind] for kind in ('movie', 'tv')}

    def read_backup_signals(self, titles, day):
        from f.buzz.backup import SOURCES
        # Only complete successful source-days; failed/partial captures cannot rank.
        if not self.crate.select("SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc' AND table_name = 'buzz_signal_run'"):
            return []
        return self.crate.select("""SELECT s.source, s.day, s.title_key, s.rank, s.value, s.raw
            FROM doc.buzz_signal s JOIN doc.buzz_signal_run r ON s.source = r.source AND s.day = r.day
            WHERE r.status = 'works' AND s.source = ANY(?) AND s.title_key = ANY(?)
              AND s.day >= ? AND s.day <= ? LIMIT 200000""",
            (list(SOURCES), [t['title_key'] for t in titles],
             (day-dt.timedelta(days=28)).isoformat(), day.isoformat()))

    def read_pageviews(self, titles, start, end):
        self.refresh('buzz_pageview')
        out = {t['title_key']: {} for t in titles}
        articles = {t['title_key']: t['article'] for t in titles}
        rows = self.crate.select('SELECT title_key, day, article, views FROM doc.buzz_pageview WHERE day >= ? AND day <= ? AND title_key = ANY(?) LIMIT 100000',
                                 (start.isoformat(), end.isoformat(), list(articles)))
        for row in rows:
            if row['article'] == articles[row['title_key']]:
                out[row['title_key']][row['day']] = row['views']
        return out

    def save_pageviews(self, title, values, now, source='wikipedia_api'):
        self.upsert('buzz_pageview', [dict(title_key=title['title_key'], day=day, article=title['article'], views=views,
                                         fetched_at=now.isoformat(), source=source) for day, views in values.items()], ['title_key', 'day'])

    def save_scores(self, day, rows):
        # Remove obsolete eligibility/ranks on retry (all remaining rows rewritten below).
        self.crate.run('DELETE FROM doc.buzz_score WHERE day = ?', (day,))
        self.upsert('buzz_score', [dict(r, curve=encode(r['curve']), card=encode(r['card']), reasons=encode(r['reasons']))
                                  for r in rows], ['day', 'title_key'])

    def snapshot(self, key):
        rows = self.crate.select('SELECT snapshot_key, day, generated_at, payload, _seq_no, _primary_term FROM doc.buzz_snapshot WHERE snapshot_key = ?', (key,))
        return rows[0] if rows else None

    def archive(self, row):
        payload = json.loads(row['payload'])
        key = f"{row['day']}:{snapshot_source(payload)}:{payload.get('formula_version', 'wikipedia-lift-28d-v1')}"
        self.upsert('buzz_snapshot', [dict(snapshot_key=key, day=row['day'],
                    generated_at=row['generated_at'], payload=row['payload'])], ['snapshot_key'], replace=False)

    def prefer(self, key, row):
        # CAS protects both the date alias and current against stale writers.
        for _ in range(4):
            self.refresh('buzz_snapshot')
            old = self.snapshot(key)
            if old and (old['day'] > row['day'] or
                        (old['day'] == row['day'] and priority(old) >= priority(row))):
                return old
            if old:
                self.archive(old)
                self.crate.run("UPDATE doc.buzz_snapshot SET day = ?, generated_at = ?, payload = ? WHERE snapshot_key = ? AND _seq_no = ? AND _primary_term = ?",
                               (row['day'], row['generated_at'], row['payload'], key, old['_seq_no'], old['_primary_term']))
            else:
                self.upsert('buzz_snapshot', [dict(snapshot_key=key, day=row['day'],
                            generated_at=row['generated_at'], payload=row['payload'])], ['snapshot_key'], replace=False)
        self.refresh('buzz_snapshot')
        result = self.snapshot(key)
        if result and (result['day'], priority(result)) >= (row['day'], priority(row)):
            return result
        raise RuntimeError('Concurrent buzz publication; rerun to advance snapshot')

    def publish(self, day, payload, now):
        self.refresh('buzz_snapshot')
        old = self.snapshot(day)
        if payload is not None:
            payload = dict(payload, source=snapshot_source(payload),
                           formula_version=payload.get('formula_version', 'wikipedia-lift-28d-v1'))
            # A previously served fallback remains a daily publication on catch-up.
            if old and json.loads(old['payload']).get('history_mode') == 'daily':
                payload['history_mode'] = 'daily'
            row = dict(snapshot_key=day, day=day, generated_at=now.isoformat(), payload=encode(payload))
            self.archive(row)
            # Reuse the immutable source/formula copy after an interrupted write.
            self.refresh('buzz_snapshot')
            key = f"{day}:{payload['source']}:{payload['formula_version']}"
            row = self.prefer(day, self.snapshot(key))
        else:
            row = old
        if row is None:
            raise RuntimeError('Cannot publish a missing daily snapshot')
        if json.loads(row['payload'])['history_mode'] == 'daily':
            self.prefer('current', row)

    def published_days(self):
        """Wikipedia-complete days; fallback days remain eligible for catch-up."""
        self.refresh('buzz_snapshot')
        return {r['day'] for r in self.crate.select("SELECT snapshot_key, day, payload FROM doc.buzz_snapshot WHERE snapshot_key != 'current'")
                if r['snapshot_key'] == r['day'] and snapshot_source(json.loads(r['payload'])) in WIKIPEDIA_SOURCES}

    def cleanup(self, now):
        cutoff = (now.date() - dt.timedelta(days=180)).isoformat()
        for table, column in (('buzz_pageview', 'day'), ('buzz_trending', 'snapshot_day'), ('buzz_score', 'day')):
            self.crate.run(f'DELETE FROM doc.{table} WHERE {column} < ?', (cutoff,))
        self.crate.run("DELETE FROM doc.buzz_snapshot WHERE snapshot_key != 'current' AND day < ?", (cutoff,))
        self.crate.run('DELETE FROM doc.buzz_title WHERE last_candidate_at < ?', (cutoff,))
        for table in TABLES:
            self.refresh(table)
