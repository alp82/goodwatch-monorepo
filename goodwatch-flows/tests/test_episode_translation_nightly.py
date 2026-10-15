"""Nightly orchestration contracts; no network or production resources."""
import copy
import json
import sqlite3
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock

import mongomock
import requests

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.media_language import nightly_episode_translations as nightly
from f.media_language.episode_translations import Bounds, ingest_titles


def payload(identifier, name='New', overview='Added'):
    return {'id': identifier, 'translations': [
        {'iso_639_1': 'de', 'iso_3166_1': 'DE', 'data': {'name': name, 'overview': overview}}]}


def catalog(show, episodes=1):
    path = f'tv/{show}/season/1'
    return {f'tv/{show}': {'id': show, 'seasons': [{'id': show * 10, 'season_number': 1}]},
            path: {'id': show * 10, 'season_number': 1, 'episodes': [
                {'id': show * 100 + e, 'season_number': 1, 'episode_number': e} for e in range(1, episodes + 1)]},
            path + '/translations': payload(show * 10)} | {
                path + f'/episode/{e}/translations': payload(show * 100 + e) for e in range(1, episodes + 1)}


class Clock:
    def __init__(self): self.now = 0
    def __call__(self): return self.now
    def sleep(self, seconds): self.now += seconds


class Database:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        for table in nightly.TABLES:
            self.db.execute(f'CREATE TABLE {table} (show_id INT, tmdb_id INT, language_code TEXT, '
                            'country_code TEXT, name TEXT, overview TEXT, '
                            'PRIMARY KEY (show_id, tmdb_id, language_code, country_code))')
        self.rows_added = {t: 0 for t in nightly.TABLES}
    def prepare_show(self, show): pass
    def run_many(self, sql, values):
        table = sql.split()[2]
        before = self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
        self.db.executemany(sql, values)
        self.rows_added[table] += self.db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] - before


class NightlyTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.guard = nightly.Guard(600, self.clock, self.clock.sleep)
        self.crate = Database()
        self.db = mongomock.MongoClient().db
        self.store = nightly.Store(self.db, 'test-owner')
        self.state = self.store.acquire()
        self.state.update(changed=[], backlog=[], completed=[], changed_since='2026-10-15T19:20:00')
        self.store.save(self.state)

    def tearDown(self):
        self.crate.db.close()

    def execute(self, fetch, changed=lambda *_: [], new=lambda *_: []):
        return nightly.run(self.state, self.store, self.crate, fetch, self.guard, changed, new)

    def test_selection_order_changed_then_capped_then_popular(self):
        target = {'tmdb_id': 1, 'targets': [{'id': 101, 'table': 'episode_translation',
                                           'path': 'tv/1/season/1/episode/1'}], 'offset': 0}
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        fixtures = catalog(1) | catalog(2) | catalog(3)
        paths, selected = [], []
        def fetch(path): paths.append(path); return fixtures[path]
        def new(completed):
            selected.append(completed.copy())
            return [] if 3 in completed else [{'tmdb_id': 3, 'resume': None}]
        result = self.execute(fetch, lambda *_: [target], new)
        self.assertEqual(result['stop_reason'], 'caught_up')
        self.assertEqual([paths[0], paths[1], paths[5]],
                         ['tv/1/season/1/episode/1/translations', 'tv/2', 'tv/3'])
        self.assertEqual(self.state['completed'], [2, 3])
        self.assertEqual(result['rows_added'], {'season_translation': 2, 'episode_translation': 3})

    def test_popularity_selection_requires_no_rows_in_either_table(self):
        crate = Mock()
        crate.select.side_effect = [[{'show_id': 1}], [{'show_id': 2}],
                                  [{'tmdb_id': i} for i in [1, 2, 3, 4, 5]]]
        result = nightly.select_new(crate, [3], limit=1)
        self.assertEqual(result, [{'tmdb_id': 4, 'resume': None}])
        self.assertIn('popularity DESC NULLS LAST, tmdb_id', crate.select.call_args.args[0])

    def test_budget_before_request_keeps_cursor_durable(self):
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        self.guard.deadline = 30
        fetch = Mock()
        result = self.execute(fetch)
        self.assertEqual(result['stop_reason'], 'budget')
        fetch.assert_not_called()
        self.assertEqual(self.db[nightly.STATE_COLLECTION].find_one({'_id': nightly.STATE_ID})['backlog'],
                         self.state['backlog'])

    def test_budget_mid_page_publishes_nothing_and_replays_from_durable_cursor(self):
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        fixtures = catalog(2, 90)
        def fetch(path):
            if path.endswith('/episode/2/translations'): self.clock.now = 590
            return fixtures[path]
        result = self.execute(fetch)
        self.assertEqual(result['stop_reason'], 'budget')
        self.assertEqual(result['rows_added']['episode_translation'], 0)
        self.assertIsNone(self.state['backlog'][0]['resume'])

    def test_failure_over_five_percent_stops_without_cursor_advance(self):
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        result = self.execute(Mock(side_effect=requests.Timeout()))
        self.assertEqual(result['stop_reason'], 'failed_requests_over_5_percent')
        self.assertEqual((result['requests'], result['failed_requests']), (1, 1))
        self.assertIsNone(self.state['backlog'][0]['resume'])

    def test_exactly_five_percent_does_not_claim_ratio_stop(self):
        self.guard.requests = 19
        with self.assertRaisesRegex(nightly.SafetyStop, '^endpoint_failed$'):
            self.guard.get(Mock(side_effect=requests.Timeout()), 'tv/2')

    def test_rate_limit_includes_requests_across_pages(self):
        for _ in range(10): self.guard.get(lambda _: {}, 'tv/2')
        self.assertAlmostEqual(self.clock.now, 9 * 0.205)

    def test_cursor_resumes_next_night_without_skipping_or_repeating_completed_page(self):
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        fixtures = catalog(2, 90)
        paths = []
        def fetch(path):
            paths.append(path)
            if path.endswith('/episode/42/translations'): self.clock.now = 590
            return fixtures[path]
        first = self.execute(fetch)
        self.assertEqual(first['stop_reason'], 'budget')
        self.assertEqual(self.state['backlog'][0]['resume'],
                         {'tmdb_id': 2, 'season_number': 1, 'episode_number': 41})
        stored = self.db[nightly.STATE_COLLECTION].find_one({'_id': nightly.STATE_ID})
        self.assertEqual(stored['backlog'], self.state['backlog'])
        self.store = nightly.Store(self.db, 'second-night')
        self.state = self.store.acquire()
        self.guard = nightly.Guard(600, self.clock, self.clock.sleep)
        paths.clear()
        def resume(path): paths.append(path); return fixtures[path]
        second = self.execute(resume)
        self.assertEqual(second['stop_reason'], 'caught_up')
        self.assertIn('tv/2/season/1/episode/41/translations', paths)
        self.assertNotIn('tv/2/season/1/episode/40/translations', paths)
        self.assertEqual(self.crate.db.execute('SELECT COUNT(*) FROM episode_translation').fetchone()[0], 90)

    def test_complete_page_preserves_nonempty_fields_and_fills_empty_fields(self):
        self.crate.db.execute("INSERT INTO episode_translation VALUES (2,201,'de','DE','Keep', '')")
        self.crate.db.execute("INSERT INTO season_translation VALUES (2,20,'de','DE','Keep season','Keep overview')")
        item = {'tmdb_id': 2, 'resume': None}
        self.assertTrue(nightly.page(item, catalog(2).__getitem__, self.crate))
        self.assertEqual(self.crate.db.execute('SELECT name, overview FROM episode_translation').fetchone(),
                         ('Keep', 'Added'))
        self.assertEqual(self.crate.db.execute('SELECT name, overview FROM season_translation').fetchone(),
                         ('Keep season', 'Keep overview'))

    def test_validation_failure_publishes_nothing(self):
        fixtures = catalog(2)
        fixtures['tv/2/season/1/episode/1/translations']['id'] = 999
        with self.assertRaisesRegex(nightly.SafetyStop, 'page_validation_failed'):
            nightly.page({'tmdb_id': 2, 'resume': None}, fixtures.__getitem__, self.crate)
        self.assertEqual(sum(self.crate.rows_added.values()), 0)

    def test_timeout_during_publication_keeps_the_page_cursor(self):
        self.state['backlog'] = [{'tmdb_id': 2, 'resume': None}]
        self.crate.run_many = Mock(side_effect=nightly.SafetyStop('two_consecutive_crate_timeouts'))
        result = self.execute(catalog(2).__getitem__)
        self.assertEqual(result['stop_reason'], 'two_consecutive_crate_timeouts')
        stored = self.db[nightly.STATE_COLLECTION].find_one({'_id': nightly.STATE_ID})
        self.assertEqual(stored['backlog'], [{'tmdb_id': 2, 'resume': None}])
        self.assertTrue(result['counts_may_exclude_uncertain_write'])

    def test_changed_page_offset_and_watermark_survive_budget_stop(self):
        targets = [{'id': 200 + e, 'table': 'episode_translation',
                    'path': f'tv/2/season/1/episode/{e}'} for e in range(1, 51)]
        fixtures = catalog(2, 50)
        since = self.state['changed_since']
        def fetch(path):
            if path.endswith('/episode/42/translations'): self.clock.now = 590
            return fixtures[path]
        self.execute(fetch, lambda *_: [{'tmdb_id': 2, 'targets': targets, 'offset': 0}])
        stored = self.db[nightly.STATE_COLLECTION].find_one({'_id': nightly.STATE_ID})
        self.assertEqual(stored['changed'][0]['offset'], 40)
        self.assertEqual(stored['changed_since'], since)
        self.assertIn('changed_until', stored)
        self.assertEqual(stored['active_run']['rows_added']['episode_translation'], 40)

    def test_reconstruction_handles_non_contiguous_episode_numbers(self):
        fixtures = catalog(2, 4)
        for episode, number in zip(fixtures['tv/2/season/1']['episodes'], [1, 3, 9, 12]):
            episode['episode_number'] = number
        cursor = nightly.reconstruct({'tmdb_id': 2, 'old_episodes': 2, 'old_seasons': 1}, fixtures.__getitem__)
        self.assertEqual(cursor['episode_number'], 9)

    def test_seed_import_once_preserves_conan_and_existing_progress(self):
        self.assertEqual(len(nightly.SEED), 47)
        self.assertEqual(nightly.SEED[0]['resume']['episode_number'], 132)
        self.assertFalse(nightly.SEED[0]['reconstruct'])
        self.assertTrue(all(item['reconstruct'] for item in nightly.SEED[1:]))
        self.store.finish(self.state, {'stop_reason': 'budget'})
        fresh = nightly.Store(self.db, 'new-owner').acquire()
        self.assertEqual(fresh['backlog'], [])

    def test_lease_prevents_overlapping_runs(self):
        with self.assertRaisesRegex(nightly.SafetyStop, 'another_run_holds_lease'):
            nightly.Store(self.db, 'another-owner').acquire()

    def test_changed_selection_uses_canonical_creation_times_and_new_seasons(self):
        crate = Mock()
        crate.select.return_value = [{'show_id': 2, 'tmdb_id': 201, 'season_tmdb_id': 20,
                                     'season_number': 1, 'episode_number': 1}]
        self.db.tmdb_tv_season_details.insert_one({'tmdb_id': 3, 'season_id': 30,
            'season_number': 0, 'created_at': datetime(2026, 10, 15, 20)})
        jobs = nightly.changed_jobs(crate, self.db, '2026-10-15T19:20:00', datetime(2026, 10, 15, 21))
        self.assertEqual([x['tmdb_id'] for x in jobs], [2, 3])
        self.assertEqual([x['table'] for x in jobs[0]['targets']], ['season_translation', 'episode_translation'])
        self.assertIn('created_at >= ?', crate.select.call_args.args[0])


class CrateSafetyTests(unittest.TestCase):
    def setUp(self):
        self.session = Mock()
        self.clock = Clock()
        self.guard = nightly.Guard(600, self.clock, self.clock.sleep)
        self.crate = nightly.Crate(self.session, 'http://unused/_sql', ('unused', 'unused'), self.guard)

    def test_two_consecutive_read_timeouts_stop(self):
        self.session.post.side_effect = requests.Timeout()
        with self.assertRaisesRegex(nightly.SafetyStop, 'two_consecutive_crate_timeouts'):
            self.crate.select('SELECT 1')
        self.assertEqual(self.session.post.call_count, 2)

    def test_success_resets_consecutive_timeout_counter(self):
        okay = Mock()
        okay.json.return_value = {'cols': ['one'], 'rows': [[1]]}
        self.session.post.side_effect = [requests.Timeout(), okay, requests.Timeout(), okay]
        self.assertEqual(self.crate.select('SELECT 1'), [{'one': 1}])
        self.assertEqual(self.guard.crate_timeouts, 0)
        self.assertEqual(self.crate.select('SELECT 1'), [{'one': 1}])

    def test_uncertain_write_is_never_retried_and_second_timeout_stops(self):
        self.session.post.side_effect = requests.Timeout()
        sql = "INSERT INTO episode_translation (name) VALUES (?) ON CONFLICT DO UPDATE SET name = CASE WHEN name = '' THEN excluded.name ELSE name END"
        with self.assertRaisesRegex(nightly.SafetyStop, 'two_consecutive_crate_timeouts'):
            self.crate.sql(sql, bulk=[['text']])
        self.assertEqual([c.kwargs['json']['stmt'] for c in self.session.post.call_args_list], [sql, 'SELECT 1'])

    def test_write_allowlist(self):
        for sql in ['DELETE FROM episode_translation', 'INSERT INTO episode (name) VALUES (?)',
                    'INSERT INTO episode_translation (name) VALUES (?)']:
            with self.assertRaises(ValueError): self.crate.sql(sql, bulk=[['x']])
        self.session.post.assert_not_called()

    def test_bulk_partial_failure_is_not_acknowledged(self):
        self.session.post.return_value.json.return_value = {'results': [{'rowcount': -1, 'error': 'bad'}]}
        sql = "INSERT INTO episode_translation (name) VALUES (?) ON CONFLICT DO UPDATE SET name = CASE WHEN name = '' THEN excluded.name ELSE name END"
        with self.assertRaisesRegex(nightly.SafetyStop, 'crate_statement_error'):
            self.crate.sql(sql, bulk=[['text']])


if __name__ == '__main__': unittest.main()
