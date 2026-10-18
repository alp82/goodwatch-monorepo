import datetime as dt
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'windmill'))
from f.buzz.backup import rank_backup, snapshot
from f.buzz.signal_parsers import justwatch_chart
from f.buzz.signals import Collector
from f.buzz.daily import run
from f.buzz.store import BuzzStore

DAY = dt.date(2026, 10, 17)
NOW = dt.datetime(2026, 10, 18, 9, 30, tzinfo=dt.timezone.utc)
TITLES = [dict(title_key=f'movie:{i}', kind='movie', tmdb_id=i, title=f'Title {i}') for i in range(1, 22)]


def history(source='tmdb_popularity', count=29):
    return [dict(source=source, day=(DAY-dt.timedelta(days=i)).isoformat(), title_key=t['title_key'],
                 value=10 if i == 0 else 5, rank=t['tmdb_id'], raw={}) for t in TITLES for i in range(count)]


class BackupTests(unittest.TestCase):
    def test_baseline_floor_missing_and_determinism(self):
        rows = rank_backup(TITLES, history(), DAY)
        self.assertEqual(len(rows), 21)
        self.assertEqual(rows[0]['signal']['tmdb_lift'], 2)
        self.assertEqual(rows[0]['score'], 1/61)
        self.assertEqual(rows[0]['views'], 10)
        self.assertEqual(len(rows[0]['curve']), 14)
        self.assertEqual(rows, rank_backup(list(reversed(TITLES)), list(reversed(history())), DAY))
        self.assertEqual(rank_backup(TITLES, history(count=28), DAY), [])
        self.assertEqual(rank_backup(TITLES, [dict(r, value=4) for r in history()], DAY), [])
        self.assertEqual(rank_backup(TITLES, [dict(r, value=float('nan')) for r in history()], DAY), [])

    def test_new_sources_rank_then_automatically_lift(self):
        rows = rank_backup(TITLES, history('trakt_trending', 1), DAY)
        self.assertEqual(rows[0]['signal']['source_lifts'], {})
        self.assertIsNone(rows[0]['views'])
        self.assertTrue(all(p['views'] is None for p in rows[0]['curve']))
        rows = rank_backup(TITLES, history('trakt_trending'), DAY)
        self.assertEqual(rows[0]['signal']['source_lifts']['trakt_trending'], 2)
        self.assertEqual(rank_backup(TITLES, [dict(r, value=5) for r in history('trakt_trending')], DAY), [])
        jw = [dict(r, value=.5 if r['day'] == DAY.isoformat() else .1) for r in history('justwatch_chart')]
        self.assertEqual(rank_backup(TITLES, jw, DAY)[0]['signal']['source_lifts']['justwatch_chart'], 5)

    def test_fusion_and_minimum(self):
        data = history() + history('trakt_trending', 1)
        payload = snapshot(TITLES, data, DAY, NOW)
        self.assertEqual(payload['top20'][0]['score'], 2/61)
        self.assertEqual(payload['sources_used'], ['tmdb_popularity', 'trakt_trending'])
        self.assertIsNone(snapshot(TITLES[:19], data, DAY, NOW))
        self.assertIsNone(snapshot(TITLES, data, DAY-dt.timedelta(days=1), NOW))

    def test_daily_wait_publish_and_final(self):
        store, signals = Mock(), Mock()
        store.published_days.return_value = set()
        store.read_trending.return_value = {'movie': [], 'tv': []}
        store.candidates.return_value = TITLES
        store.read_backup_signals.return_value = history()
        signals.pageviews.return_value = {}
        signals.dumps_available.return_value = False
        self.assertEqual(run(store, signals, now=NOW.replace(hour=8))['status'], 'waiting_for_publication')
        store.candidates.assert_not_called()
        self.assertEqual(run(store, signals, now=NOW)['status'], 'published_backup')
        self.assertEqual(store.publish.call_args.args[0], DAY.isoformat())
        self.assertEqual(run(store, signals, now=NOW.replace(hour=23))['status'], 'published_backup')
        signals.mappings.assert_not_called()
        store.save_scores.assert_not_called()
        store.read_backup_signals.return_value = []
        with self.assertRaisesRegex(RuntimeError, 'Wikimedia'):
            run(store, signals, now=NOW.replace(hour=23))

    def test_read_requires_complete_source_and_calendar_window(self):
        crate = Mock()
        crate.select.side_effect = [[{'table_name': 'buzz_signal_run'}], []]
        self.assertEqual(BuzzStore(crate).read_backup_signals(TITLES, DAY), [])
        sql, args = crate.select.call_args.args
        self.assertIn("r.status = 'works'", sql)
        self.assertEqual(args[-2:], ('2026-09-19', '2026-10-17'))

    def test_real_backup_immutable_replaced_by_wikipedia_without_regression(self):
        from test_buzz import SnapshotCrate
        crate = SnapshotCrate()
        store = BuzzStore(crate)
        payload = snapshot(TITLES, history(), DAY, NOW)
        store.publish(DAY.isoformat(), payload, NOW)
        store.publish(DAY.isoformat(), dict(payload, top20=[]), NOW)
        self.assertEqual(json.loads(crate.rows['current']['payload']), payload)
        wiki = dict(payload, source='wikipedia_api', formula_version='wikipedia-lift-28d-v1')
        store.publish(DAY.isoformat(), wiki, NOW)
        self.assertEqual(json.loads(crate.rows['current']['payload'])['source'], 'wikipedia_api')
        key = f"{DAY}:backup_signals:signals-rrf-28d-v1"
        self.assertEqual(json.loads(crate.rows[key]['payload']), payload)
        older = DAY-dt.timedelta(days=1)
        store.publish(older.isoformat(), dict(payload, day=older.isoformat()), NOW)
        self.assertEqual(crate.rows['current']['day'], DAY.isoformat())
        store.publish(DAY.isoformat(), payload, NOW)
        self.assertEqual(json.loads(crate.rows['current']['payload'])['source'], 'wikipedia_api')

    def test_justwatch_fixture_and_fail_soft(self):
        payload = json.loads((Path(__file__).parent/'fixtures/buzz_signals/justwatch.json').read_text())
        rows = justwatch_chart(payload)
        self.assertEqual([(r['title_key'], r['rank'], r['value']) for r in rows], [('movie:603', 4, .25), ('tv:1396', 2, .5)])
        self.assertEqual(rows[0]['raw']['country'], 'US')
        http = Mock()
        http.post.return_value.__enter__ = Mock(return_value=Mock(json=lambda: {'errors': [{'message': 'schema changed'}]}))
        http.post.return_value.__exit__ = Mock(return_value=False)
        rows, status = Collector(Mock(), http=http).collect('justwatch_chart', DAY)
        self.assertEqual(rows, [])
        self.assertEqual(status['status'], 'blocked')
        self.assertEqual(http.post.call_count, 2)
