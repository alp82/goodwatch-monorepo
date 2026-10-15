"""Serial, preserve-existing nightly ingestion; state lives with canonical crawl state.

Fetch/validate a small page, publish those exact responses, then checkpoint. A
crash replays at most one page, whose SQL cannot replace populated fields.
"""
import copy
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

from f.media_language.episode_translations import Bounds, ingest_titles, publish_rows, translation_rows
from f.media_language.episode_translation_seed import SEED, BASELINE

STATE_COLLECTION = 'tmdb_episode_catalog_state'
STATE_ID = 'episode_translations_nightly_v1'
TABLES = ('season_translation', 'episode_translation')
PAGE = Bounds(titles=1, seasons=20, episodes=40, requests=100, requests_per_second=5)


class SafetyStop(BaseException):
    """Bypass the ingestion helper's endpoint-error catch; never acknowledge a failed page."""


class Guard:
    def __init__(self, seconds, clock=time.monotonic, sleep=time.sleep):
        if not 1 <= seconds <= 10800:
            raise ValueError('Budget must be between 1 and 10800 seconds')
        self.clock, self.sleep = clock, sleep
        self.deadline = clock() + seconds
        self.last_request = float('-inf')
        self.requests = self.failures = self.crate_timeouts = 0

    def check(self, reserve=0):
        if self.clock() + reserve >= self.deadline:
            raise SafetyStop('budget')

    def get(self, fetch, path):
        self.check(31)
        self.sleep(max(0, self.last_request + 0.205 - self.clock()))
        self.check(31)
        self.last_request = self.clock()
        self.requests += 1
        try:
            return fetch(path)
        except Exception:
            self.failures += 1
            if self.failures / self.requests > 0.05:
                raise SafetyStop('failed_requests_over_5_percent') from None
            # Retry this page next night even when the global failure ratio is low.
            raise SafetyStop('endpoint_failed') from None


class Crate:
    """Bounded HTTP adapter: no implicit client retries and a two-table write allowlist."""
    def __init__(self, session, url, auth, guard):
        self.session, self.url, self.auth, self.guard = session, url, auth, guard
        self.known_keys = {}
        self.rows_added = {table: 0 for table in TABLES}

    def prepare_show(self, show_id):
        for table in TABLES:
            if (table, show_id) not in self.known_keys:
                rows = self.select(f'SELECT show_id, tmdb_id, language_code, country_code FROM {table} '
                                   'WHERE show_id = ? LIMIT 1000001', [show_id])
                if len(rows) > 1000000:
                    raise SafetyStop('translation_snapshot_exceeds_limit')
                self.known_keys[table, show_id] = {
                    tuple(row[k] for k in ('show_id', 'tmdb_id', 'language_code', 'country_code')) for row in rows}

    def sql(self, statement, args=None, bulk=None):
        import requests
        writing = bulk is not None
        if writing:
            if (not any(statement.startswith('INSERT INTO ' + t + ' ') for t in TABLES)
                    or 'CASE WHEN' not in statement or 'ELSE' not in statement):
                raise ValueError('Only preserve-existing translation writes are allowed')
        elif not statement.startswith('SELECT '):
            raise ValueError('Only SELECT is allowed outside translation publication')
        body = {'stmt': statement, 'bulk_args' if writing else 'args': bulk if writing else args or []}
        for attempt in range(2):
            self.guard.check(37)
            try:
                response = self.session.post(self.url, auth=self.auth, json=body, timeout=(2, 35))
                response.raise_for_status()
                result = response.json()
            except requests.exceptions.Timeout:
                self.guard.crate_timeouts += 1
                if self.guard.crate_timeouts >= 2:
                    raise SafetyStop('two_consecutive_crate_timeouts') from None
                if writing:
                    # The write may have committed. Probe health, never retry the write
                    # or advance its cursor; replaying next night is idempotent.
                    self.sql('SELECT 1')
                    raise SafetyStop('crate_write_outcome_uncertain') from None
                continue
            except Exception:
                raise SafetyStop('crate_error') from None
            self.guard.crate_timeouts = 0
            if result.get('error') or any(x.get('error') or x.get('error_message') or x.get('rowcount', 0) < 0
                                          for x in result.get('results', [])):
                raise SafetyStop('crate_statement_error')
            if writing and len(result.get('results', [])) != len(bulk):
                raise SafetyStop('crate_incomplete_bulk')
            return result

    def select(self, statement, args=None):
        result = self.sql(statement, args)
        return [dict(zip(result['cols'], row)) for row in result['rows']]

    def run_many(self, statement, values):
        table = statement.split()[2]
        for start in range(0, len(values), 500):
            batch = values[start:start + 500]
            self.sql(statement, bulk=batch)
            for row in batch:
                key = tuple(row[:4])
                known = self.known_keys[table, row[0]]
                if key not in known:
                    self.rows_added[table] += 1
                    known.add(key)


class Store:
    """Majority-acknowledged state and run summaries in the existing state collection."""
    def __init__(self, db, owner):
        from pymongo.write_concern import WriteConcern
        self.collection = db.get_collection(STATE_COLLECTION, write_concern=WriteConcern('majority'))
        self.owner = owner

    def acquire(self):
        from pymongo import ReturnDocument
        now = datetime.utcnow()
        self.collection.update_one({'_id': STATE_ID}, {'$setOnInsert': {
            'changed_since': BASELINE, 'changed': [], 'backlog': copy.deepcopy(SEED),
            'completed': [], 'seeded_at': now}}, upsert=True)
        state = self.collection.find_one_and_update(
            {'_id': STATE_ID, '$or': [{'lease_until': {'$lte': now}}, {'lease_until': None}]},
            {'$set': {'owner': self.owner, 'lease_until': now + timedelta(hours=4)}},
            return_document=ReturnDocument.AFTER)
        if state is None:
            raise SafetyStop('another_run_holds_lease')
        return state

    def save(self, state):
        values = {k: v for k, v in state.items() if k != '_id'} | {'updated_at': datetime.utcnow()}
        result = self.collection.update_one({'_id': STATE_ID, 'owner': self.owner}, {'$set': values})
        if result.matched_count != 1:
            raise SafetyStop('state_lease_lost')

    def finish(self, state, summary):
        self.save(state)
        self.collection.update_one({'_id': STATE_ID + ':run:' + self.owner}, {'$set': summary}, upsert=True)
        self.collection.update_one({'_id': STATE_ID, 'owner': self.owner},
                                   {'$set': {'lease_until': datetime.utcnow(), 'last_run': summary}})


def changed_jobs(crate, db, since, until):
    """Only canonical additions: episode copy creation times and canonical season creation times.

    Read a closed interval with an overlap. The queue and upper watermark are saved
    together before ingestion, so stopping never loses additions or moves a cursor.
    """
    lower = datetime.fromisoformat(since).replace(tzinfo=timezone.utc) - timedelta(minutes=15)
    upper = until.replace(tzinfo=timezone.utc)
    rows = crate.select('SELECT show_id, tmdb_id, season_tmdb_id, season_number, episode_number '
                        'FROM episode WHERE created_at >= ? AND created_at <= ? AND removed_at IS NULL '
                        'ORDER BY show_id, season_number, episode_number LIMIT 100001',
                        [int(lower.timestamp() * 1000), int(upper.timestamp() * 1000)])
    if len(rows) > 100000:
        raise SafetyStop('canonical_additions_exceed_scan_limit')
    by_show = {}
    for row in rows:
        show, season, episode = row['show_id'], row['season_number'], row['episode_number']
        path = f'tv/{show}/season/{season}'
        targets = by_show.setdefault(show, {})
        if row['season_tmdb_id']:
            targets[path] = {'table': TABLES[0], 'id': row['season_tmdb_id'], 'path': path}
        targets[path + f'/episode/{episode}'] = {'table': TABLES[1], 'id': row['tmdb_id'],
                                               'path': path + f'/episode/{episode}'}
    seasons = db.tmdb_tv_season_details.find(
        {'created_at': {'$gte': lower.replace(tzinfo=None), '$lte': until}},
        {'tmdb_id': 1, 'season_id': 1, 'season_number': 1}).limit(100001)
    for index, season in enumerate(seasons):
        if index >= 100000:
            raise SafetyStop('canonical_seasons_exceed_scan_limit')
        if season.get('season_id'):
            path = f"tv/{season['tmdb_id']}/season/{season['season_number']}"
            by_show.setdefault(season['tmdb_id'], {})[path] = {
                'table': TABLES[0], 'id': season['season_id'], 'path': path}
    return [{'tmdb_id': show, 'targets': list(targets.values()), 'offset': 0}
            for show, targets in sorted(by_show.items())]


def select_new(crate, excluded, limit=800):
    existing = set(excluded)
    for table in TABLES:
        existing.update(row['show_id'] for row in crate.select(f'SELECT DISTINCT show_id FROM {table} LIMIT 1000000'))
    popular = crate.select('SELECT tmdb_id FROM show WHERE tmdb_id IS NOT NULL '
                           'ORDER BY popularity DESC NULLS LAST, tmdb_id LIMIT 1000000')
    return [{'tmdb_id': row['tmdb_id'], 'resume': None} for row in popular if row['tmdb_id'] not in existing][:limit]


def reconstruct(item, get):
    """Replay old successful counts against valid episodes, including numbering gaps."""
    show_id = item['tmdb_id']
    catalog = get(f'tv/{show_id}')
    if catalog.get('id') != show_id or not isinstance(catalog.get('seasons'), list):
        raise SafetyStop('invalid_seed_catalog')
    left = item['old_episodes']
    seasons = [s for s in catalog['seasons'] if type(s.get('season_number')) is int and s['season_number'] >= 0]
    for index, summary in enumerate(seasons):
        number = summary['season_number']
        if index >= item['old_seasons'] or left == 0:
            return {'tmdb_id': show_id, 'season_number': number, 'episode_number': None}
        season = get(f'tv/{show_id}/season/{number}')
        if (season.get('id') != summary['id'] or season.get('season_number') != number
                or not isinstance(season.get('episodes'), list)):
            raise SafetyStop('invalid_seed_season')
        valid = [e for e in season['episodes'] if type(e.get('id')) is int and e['id'] > 0
                 and type(e.get('episode_number')) is int and e['episode_number'] > 0
                 and e.get('season_number') == number and e.get('show_id', show_id) == show_id]
        if left < len(valid):
            return {'tmdb_id': show_id, 'season_number': number, 'episode_number': valid[left]['episode_number']}
        left -= len(valid)
    # Catalog shrinkage cannot justify skipping anything. Replay safely from the start.
    return None


def page(item, get, crate):
    if 'targets' in item:
        targets = item['targets'][item['offset']:item['offset'] + 40]
        pending = {table: [] for table in TABLES}
        for target in targets:
            pending[target['table']].extend(translation_rows(
                item['tmdb_id'], target['id'], get(target['path'] + '/translations')))
        for table, rows in pending.items():
            publish_rows(crate, table, rows, preserve_existing=True)
        item['offset'] += len(targets)
        return item['offset'] == len(item['targets'])
    responses = {}
    def fetch(path):
        response = get(path)
        responses[path] = response
        return response
    cursor = [item['resume']] if item.get('resume') else None
    preview = ingest_titles([item['tmdb_id']], fetch, bounds=PAGE, resume=cursor, sleep=lambda _: None)
    if preview['failures']:
        raise SafetyStop('page_validation_failed')
    result = ingest_titles([item['tmdb_id']], responses.__getitem__, crate, dry_run=False,
                           bounds=PAGE, resume=cursor, sleep=lambda _: None, preserve_existing=True)
    if result['failures'] or result != preview | {'dry_run': False}:
        raise SafetyStop('cached_publication_mismatch')
    if result['truncated']:
        if len(result['continuation']) != 1 or result['continuation'][0] == item.get('resume'):
            raise SafetyStop('cursor_did_not_advance')
        item['resume'] = result['continuation'][0]
        return False
    return True


def run(state, store, crate, fetch, guard, discover_changed, discover_new):
    summary = {'started_at': datetime.utcnow().isoformat(), 'requests': 0, 'failed_requests': 0,
               'rows_added': {table: 0 for table in TABLES}, 'shows_completed': 0,
               'pages_completed': 0, 'stop_reason': None, 'preserve_existing': True}
    # Count new keys against each show's pre-publication snapshot. Only acknowledged
    # bulk writes count. An uncertain timed-out write can make these a lower bound.
    get = lambda path: guard.get(fetch, path)
    try:
        state['active_run'] = summary.copy()
        store.save(state)
        guard.check()
        if not state['changed']:
            until = datetime.utcnow()
            state['changed'] = discover_changed(state['changed_since'], until)
            state['changed_until'] = until.isoformat()
            store.save(state)
        while True:
            guard.check(40)
            queue = state['changed'] if state['changed'] else state['backlog']
            if not state['changed'] and state.get('changed_until'):
                state['changed_since'] = state.pop('changed_until')
                store.save(state)
            if not queue:
                state['backlog'] = discover_new(state['completed'])
                queue = state['backlog']
                store.save(state)
                if not queue:
                    summary['stop_reason'] = 'caught_up'
                    break
            item = queue[0]
            crate.prepare_show(item['tmdb_id'])
            if item.get('reconstruct'):
                item['resume'] = reconstruct(item, get)
                item.pop('reconstruct')
                store.save(state)
            # Before fetching/publishing: the durable cursor still names this page.
            done = page(item, get, crate)
            summary['pages_completed'] += 1
            if done:
                queue.pop(0)
                summary['shows_completed'] += 1
                if 'targets' not in item and item['tmdb_id'] not in state['completed']:
                    state['completed'].append(item['tmdb_id'])
            state['active_run'] = summary | {'requests': guard.requests, 'failed_requests': guard.failures,
                                            'rows_added': crate.rows_added.copy()}
            store.save(state)
            print(json.dumps({'show_id': item['tmdb_id'], 'complete': done, 'requests': guard.requests,
                              'cursor': item.get('resume'), 'pages': summary['pages_completed']}), flush=True)
    except SafetyStop as error:
        summary['stop_reason'] = str(error)
    except Exception as error:
        summary['stop_reason'] = 'unexpected_' + type(error).__name__
    finally:
        summary.update(requests=guard.requests, failed_requests=guard.failures,
                       rows_added=crate.rows_added.copy(),
                       counts_may_exclude_uncertain_write=summary['stop_reason'] in
                       ('crate_write_outcome_uncertain', 'two_consecutive_crate_timeouts', 'crate_statement_error',
                        'crate_incomplete_bulk'), finished_at=datetime.utcnow().isoformat())
        state['active_run'] = summary.copy()
        print(json.dumps(summary), flush=True)
        store.finish(state, summary)
    return summary


def main(dry_run: bool = True, max_seconds: int = 10800):
    if dry_run is not False:
        return {'dry_run': True, 'max_seconds': max_seconds, 'seed_shows': len(SEED),
                'selection': ['canonical_additions', '47_capped_shows', 'untranslated_by_popularity']}
    import requests
    import wmill
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    guard = Guard(10800 if max_seconds is None else max_seconds)
    init_mongodb()
    session = requests.Session()
    try:
        db = get_db()
        store = Store(db, str(uuid.uuid4()))
        state = store.acquire()
        crate = Crate(session, 'http://' + wmill.get_variable('u/Alp/CRATE_HOSTS').split(',')[0] + '/_sql',
                      (wmill.get_variable('u/Alp/CRATE_USER'), wmill.get_variable('u/Alp/CRATE_PASS')), guard)
        token = wmill.get_variable('u/Alp/TMDB_API_KEY')
        def fetch(path):
            response = session.get('https://api.themoviedb.org/3/' + path,
                                   params={'api_key': token}, timeout=(3, 25))
            response.raise_for_status()
            return response.json()
        # Bound Mongo operations as well: the shared adapter's normal socket
        # timeout is longer than this runner's reserved checkpoint window.
        import pymongo
        with pymongo.timeout(max(1, guard.deadline - guard.clock() - 5)):
            return run(state, store, crate, fetch, guard,
                       lambda since, until: changed_jobs(crate, db, since, until),
                       lambda excluded: select_new(crate, excluded))
    finally:
        session.close()
        close_mongodb()
