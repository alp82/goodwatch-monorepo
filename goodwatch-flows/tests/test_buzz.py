"""Buzz behavior tests; no credentials, live HTTP, database or Valkey."""
import datetime as dt
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.buzz.score import rank_day

DAY = dt.date(2026, 10, 13)

class ScoreTests(unittest.TestCase):
    def test_prior_28_days_exclude_today_and_flat_z_is_unknown(self):
        series = {(DAY - dt.timedelta(days=i)).isoformat(): 100 for i in range(1, 29)}
        series[DAY.isoformat()] = 2000
        rows = rank_day([{'title_key': 'movie:1', 'title': 'Example'}], {'movie:1': series}, DAY)
        self.assertEqual((rows[0]['score'], rows[0]['mean28'], rows[0]['z'], rows[0]['rank']), (20.0, 100, None, 1))
        self.assertEqual(rows[0]['curve'][-1], {'day': '2026-10-13', 'views': 2000})

    def test_unknown_baseline_or_scored_day_is_never_zero(self):
        for missing in (0, 5, 28):
            series = {(DAY - dt.timedelta(days=i)).isoformat(): 2000 for i in range(29) if i != missing}
            self.assertEqual(rank_day([{'title_key': 'tv:1'}], {'tv:1': series}, DAY), [])

    def test_volume_and_extra_view_floors_and_deterministic_ties(self):
        titles, series = [], {}
        for key, baseline, views in [('movie:1', 0, 999), ('tv:1', 600, 1000),
                                     ('movie:2', 500, 1000), ('tv:2', 500, 1000), ('movie:3', 0, 1000)]:
            titles.append({'title_key': key})
            series[key] = {(DAY - dt.timedelta(days=i)).isoformat(): baseline for i in range(1, 29)}
            series[key][DAY.isoformat()] = views
        rows = rank_day(titles, series, DAY)
        self.assertEqual([(r['title_key'], r['rank']) for r in rows if r['eligible']],
                         [('movie:3', 1), ('movie:2', 2), ('tv:2', 3)])


class HintTests(unittest.TestCase):
    def test_hints_have_dated_evidence_and_no_future_season_or_trailer(self):
        from f.buzz.collect import reason_hints
        title = {'title_key': 'tv:1', 'kind': 'tv', 'tmdb_id': 1, 'release_date': '2026-10-01'}
        details = {'seasons': [{'season_number': 2, 'air_date': '2026-10-10'},
                               {'season_number': 3, 'air_date': '2027-01-01'}],
                   'videos': {'results': [{'type': 'Trailer', 'site': 'YouTube', 'key': 'abc',
                                          'official': True, 'published_at': '2026-10-12T09:00:00Z'},
                                         {'type': 'Trailer', 'site': 'YouTube', 'key': 'future',
                                          'official': True, 'published_at': '2026-10-14T09:00:00Z'}]}}
        hints = reason_hints(title, details, [], DAY)
        self.assertEqual([(h['kind'], h['event_day']) for h in hints],
                         [('new_release', '2026-10-01'), ('new_season', '2026-10-10'), ('trailer', '2026-10-12')])


class DailyTests(unittest.TestCase):
    def test_first_run_backfills_60_days_and_publishes_only_complete_days(self):
        from f.buzz.daily import run
        store, signals = MemoryStore(), FakeSignals()
        result = run(store, signals, now=dt.datetime(2026, 10, 14, 10, tzinfo=dt.timezone.utc))
        self.assertEqual(result['score_day'], '2026-10-13')
        self.assertEqual(len(store.pageviews['movie:1']), 60)
        self.assertEqual(len(store.snapshots), 32)
        self.assertEqual(store.current['top20'][0]['score'], 20)
        self.assertEqual(store.current['top20'][0]['rank'], 1)
        self.assertEqual(signals.ranges[-1], ('2026-08-15', '2026-10-13'))
        requests_after_publish = len(signals.ranges)
        run(store, signals, now=dt.datetime(2026, 10, 14, 11, tzinfo=dt.timezone.utc))
        self.assertEqual(len(signals.ranges), requests_after_publish)  # No source requests after publication.

    def test_delayed_latest_observations_preserve_the_published_day(self):
        from f.buzz.daily import run
        store = MemoryStore()
        run(store, FakeSignals(), now=dt.datetime(2026, 10, 14, 10, tzinfo=dt.timezone.utc))
        class DelayedSignals(FakeSignals):
            def pageviews(self, article, start, end):
                self.ranges.append((start.isoformat(), end.isoformat()))
                return {}
            def trending(self): raise AssertionError('Trending called before publication')
            def mappings(self, titles): raise AssertionError('Mappings called before publication')
        signals = DelayedSignals()
        result = run(store, signals, now=dt.datetime(2026, 10, 15, 10, tzinfo=dt.timezone.utc))
        self.assertEqual(result['status'], 'waiting_for_publication')
        self.assertEqual(signals.ranges, [('2026-10-14', '2026-10-14')] * 2)
        self.assertEqual(store.current['day'], '2026-10-13')
        self.assertNotIn('2026-10-15', store.trending)
        # No candidate collection, mapping, metadata or bulk pageviews on a delayed day.
        self.assertEqual(len(store.snapshots), 32)
        with self.assertRaisesRegex(RuntimeError, 'Wikimedia.*2026-10-14'):
            run(store, signals, now=dt.datetime(2026, 10, 15, 23, tzinfo=dt.timezone.utc))
        result = run(store, FakeSignals(), now=dt.datetime(2026, 10, 15, 22, tzinfo=dt.timezone.utc))
        self.assertEqual(store.current['day'], '2026-10-14')
        self.assertIn('top20', result)

    def test_completed_day_repairs_current_without_any_signal_requests(self):
        from f.buzz.daily import run
        store = MemoryStore()
        now = dt.datetime(2026, 10, 14, 10, tzinfo=dt.timezone.utc)
        run(store, FakeSignals(), now=now)
        payload = store.current
        store.current = None  # Crash after date write, before advancing current.
        result = run(store, object(), now=now.replace(hour=23))
        self.assertEqual(result['status'], 'already_published')
        self.assertIs(store.current, payload)
        self.assertEqual(len(store.snapshots), 32)

    def test_partial_publication_waits_until_final_attempt(self):
        from f.buzz.daily import run
        class PartialSignals(FakeSignals):
            def pageviews(self, article, start, end):
                # Probe day is present, but full article history is not ready.
                return {end.isoformat(): 2000}
        store = MemoryStore()
        now = dt.datetime(2026, 10, 14, 22, tzinfo=dt.timezone.utc)
        self.assertEqual(run(store, PartialSignals(), now=now)['status'], 'waiting_for_coverage')
        self.assertIsNone(store.current)
        with self.assertRaisesRegex(RuntimeError, 'latest 29 days'):
            run(store, PartialSignals(), now=now.replace(hour=23))

    def test_second_probe_can_confirm_publication_and_stops_at_two(self):
        from f.buzz.daily import run, PUBLICATION_PROBES
        class SecondProbeSignals(FakeSignals):
            def pageviews(self, article, start, end):
                if article == PUBLICATION_PROBES[0]:
                    self.ranges.append((start.isoformat(), end.isoformat()))
                    return {}
                return super().pageviews(article, start, end)
        signals = SecondProbeSignals()
        result = run(MemoryStore(), signals, now=dt.datetime(2026, 10, 14, 8, tzinfo=dt.timezone.utc))
        self.assertEqual(result['status'], 'published')
        self.assertEqual(len(signals.ranges), 3)  # Two probes, one full article history.

    def test_final_attempt_uses_utc_and_transport_errors_still_fail(self):
        from f.buzz.daily import run
        class DelayedSignals(FakeSignals):
            def pageviews(self, *args): return {}
        # 00:30 on the 15th in Berlin is still the 14th, before the final UTC attempt.
        now = dt.datetime(2026, 10, 15, 0, 30, tzinfo=dt.timezone(dt.timedelta(hours=2)))
        result = run(MemoryStore(), DelayedSignals(), now=now)
        self.assertEqual((result['score_day'], result['status']), ('2026-10-13', 'waiting_for_publication'))
        with self.assertRaisesRegex(RuntimeError, 'Wikimedia'):
            run(MemoryStore(), DelayedSignals(), now=now + dt.timedelta(hours=1))
        class BrokenSignals(FakeSignals):
            def pageviews(self, *args): raise RuntimeError('Signal HTTP 500 after four attempts')
        with self.assertRaisesRegex(RuntimeError, 'Signal HTTP 500'):
            run(MemoryStore(), BrokenSignals(), now=now)


class Response:
    def __init__(self, status=200, payload=None, content=b'', headers=None):
        self.status_code, self.payload, self.content = status, payload, content
        self.headers = headers or {}
        self.ok = status < 400
    def json(self): return self.payload


class FakeHTTP:
    def __init__(self, responses):
        self.responses, self.requests, self.headers = list(responses), [], {}
    def get(self, url, **kwargs):
        self.requests.append((url, kwargs))
        return self.responses.pop(0)


class SignalTests(unittest.TestCase):
    def test_pageviews_keep_zero_observations_and_leave_missing_days_unknown(self):
        from f.buzz.collect import Signals
        http = FakeHTTP([Response(payload={'items': [{'timestamp': '2026101100', 'views': 0},
                                                     {'timestamp': '2026101300', 'views': 2000}]})])
        signals = Signals('secret', session=http, sleep=lambda _: None)
        result = signals.pageviews('https://en.wikipedia.org/wiki/Example_(TV_series)', DAY - dt.timedelta(days=2), DAY)
        self.assertEqual(result, {'2026-10-11': 0, '2026-10-13': 2000})
        self.assertIn('/all-access/user/Example_%28TV_series%29/daily/', http.requests[0][0])
        self.assertIn('hello@goodwatch.app', http.headers['User-Agent'])

    def test_missing_article_is_unknown_and_transient_errors_retry_politely(self):
        from f.buzz.collect import Signals
        sleeps = []
        http = FakeHTTP([Response(429, headers={'Retry-After': '3'}), Response(404)])
        signals = Signals('secret', session=http, sleep=sleeps.append)
        self.assertEqual(signals.pageviews('https://en.wikipedia.org/wiki/Example', DAY, DAY), {})
        self.assertEqual(sleeps, [0.5, 3, 0.5])

    def test_mapping_accepts_only_one_distinct_enwiki_article(self):
        from f.buzz.collect import Signals
        def binding(article):
            return {'tmdb': {'value': '1'}, 'item': {'value': 'http://www.wikidata.org/entity/Q1'},
                    'article': {'value': 'https://en.wikipedia.org/wiki/' + article}}
        http = FakeHTTP([Response(payload={'results': {'bindings': [binding('One'), binding('Two')]}})])
        result = Signals('secret', session=http, sleep=lambda _: None).mappings([
            {'kind': 'movie', 'tmdb_id': 1, 'title_key': 'movie:1'},
            {'kind': 'movie', 'tmdb_id': 2, 'title_key': 'movie:2'}])
        self.assertEqual((result['movie:1']['mapping_status'], result['movie:1']['article'], result['movie:2']['mapping_status']),
                         ('ambiguous', None, 'no-enwiki'))

    def test_netflix_remakes_are_rejected_and_no_week_is_used_before_publication(self):
        from f.buzz.collect import Signals, reason_hints
        chart = b'week\tcategory\tweekly_rank\tshow_title\tseason_title\n2026-10-11\tFilms (English)\t1\tExample\t\n'
        signals = Signals('secret', session=FakeHTTP([Response(content=chart)]), sleep=lambda _: None)
        titles = [{'kind': 'movie', 'title_key': 'movie:1', 'tmdb_id': 1, 'title': 'Example'}]
        rows = signals.netflix(lambda names: titles + [dict(titles[0], title_key='movie:2', tmdb_id=2)])
        self.assertIsNone(rows[0]['title_key'])
        rows[0]['title_key'] = 'movie:1'
        self.assertEqual(reason_hints(titles[0], {}, rows, DAY - dt.timedelta(days=1)), [])
        self.assertEqual(reason_hints(titles[0], {}, rows, DAY)[0]['kind'], 'netflix_top10')
        self.assertEqual(reason_hints(titles[0], {}, rows, DAY + dt.timedelta(days=20)), [])


class MemoryStore:
    def __init__(self):
        self.titles, self.pageviews, self.snapshots, self.current = {}, {}, {}, None
        self.trending = {}

    def initialize(self): pass
    def candidates(self, trending):
        return [{'title_key': 'movie:1', 'kind': 'movie', 'tmdb_id': 1, 'title': 'Example'}]
    def catalog_names(self, names): return self.candidates({})
    def published_days(self): return set(self.snapshots)
    def read_titles(self): return self.titles
    def save_titles(self, titles): self.titles = {t['title_key']: dict(t) for t in titles}
    def read_trending(self, now): return self.trending.get(now.date().isoformat())
    def save_trending(self, lists, now): self.trending[now.date().isoformat()] = lists
    def read_pageviews(self, titles, start, end): return self.pageviews
    def save_pageviews(self, title, values, now): self.pageviews.setdefault(title['title_key'], {}).update(values)
    def save_scores(self, day, rows): pass
    def publish(self, day, payload, now):
        if payload is not None:
            self.snapshots.setdefault(day, payload)
        payload = self.snapshots[day]
        if payload['history_mode'] == 'daily' and (self.current is None or self.current['day'] <= day):
            self.current = payload
    def cleanup(self, now): pass


class FakeSignals:
    def __init__(self): self.ranges = []
    def trending(self): return {'movie': [{'id': 1}], 'tv': []}
    def mappings(self, titles):
        return {t['title_key']: {'article': 'https://en.wikipedia.org/wiki/Example',
                                'qid': 'Q1', 'mapping_status': 'matched'} for t in titles}
    def pageviews(self, article, start, end):
        self.ranges.append((start.isoformat(), end.isoformat()))
        return {(start + dt.timedelta(days=i)).isoformat(): 2000 if start + dt.timedelta(days=i) == DAY else 100
                for i in range((end - start).days + 1)}
    def details(self, title): return {}
    def netflix(self, names): return []


class SnapshotCrate:
    """Crate boundary fake with first-write and optimistic-version semantics."""
    def __init__(self): self.rows = {}; self.race = None
    def run_many(self, sql, values):
        for key, day, generated, payload in values:
            self.rows.setdefault(key, dict(snapshot_key=key, day=day, generated_at=generated,
                                           payload=payload, _seq_no=0, _primary_term=1))
    def run(self, sql, params=()):
        if sql.startswith('REFRESH'): return
        if sql.startswith('UPDATE'):
            if self.race:
                self.race(self)
                self.race = None
            day, generated, payload, seq, term = params
            old = self.rows['current']
            if (old['_seq_no'], old['_primary_term']) == (seq, term):
                old.update(day=day, generated_at=generated, payload=payload, _seq_no=seq + 1)
            return
        raise AssertionError(sql)
    def select(self, sql, params=()):
        if params: key = params[0]
        elif "snapshot_key = 'current'" in sql: key = 'current'
        else: return [dict(day=r['day']) for k, r in self.rows.items() if k != 'current']
        columns = sql.split(' FROM ', 1)[0].removeprefix('SELECT ').split(', ')
        return [{column: self.rows[key][column] for column in columns}] if key in self.rows else []


class PublicationTests(unittest.TestCase):
    def test_partial_trending_captures_are_retried_as_a_whole(self):
        from f.buzz.store import BuzzStore
        class TrendingCrate:
            rows = [{'kind': 'movie', 'rank': 1, 'raw': '{"id":1}', 'expected_count': 2}]
            def run(self, *args): pass
            def select(self, *args): return self.rows
        crate = TrendingCrate()
        store = BuzzStore(crate)
        now = dt.datetime(2026, 10, 14, tzinfo=dt.timezone.utc)
        self.assertIsNone(store.read_trending(now))
        crate.rows.append({'kind': 'tv', 'rank': 1, 'raw': '{"id":2}', 'expected_count': 2})
        self.assertEqual(store.read_trending(now), {'movie': [{'id': 1}], 'tv': [{'id': 2}]})

    def test_current_advances_atomically_uses_first_snapshot_and_never_regresses(self):
        from f.buzz.store import BuzzStore
        crate = SnapshotCrate()
        store = BuzzStore(crate)
        now = dt.datetime(2026, 10, 14, tzinfo=dt.timezone.utc)
        store.publish('2026-10-12', {'day': '2026-10-12', 'history_mode': 'current-candidate-pool backfill'}, now)
        self.assertNotIn('current', crate.rows)
        store.publish('2026-10-13', {'day': '2026-10-13', 'history_mode': 'daily', 'top20': ['first']}, now)
        store.publish('2026-10-13', {'day': '2026-10-13', 'history_mode': 'daily', 'top20': ['retry']}, now)
        self.assertEqual(json.loads(crate.rows['current']['payload'])['top20'], ['first'])
        # A crash after persisting the date row can be repaired without recollection.
        crate.rows.pop('current')
        store.publish('2026-10-13', None, now)
        self.assertEqual(crate.rows['current']['day'], '2026-10-13')
        store.publish('2026-10-11', {'day': '2026-10-11', 'history_mode': 'daily'}, now)
        self.assertEqual(crate.rows['current']['day'], '2026-10-13')

    def test_concurrent_newer_publication_wins(self):
        from f.buzz.store import BuzzStore
        crate = SnapshotCrate()
        store = BuzzStore(crate)
        now = dt.datetime(2026, 10, 14, tzinfo=dt.timezone.utc)
        store.publish('2026-10-12', {'day': '2026-10-12', 'history_mode': 'daily'}, now)
        def newer(crate):
            crate.rows['current'].update(day='2026-10-14', _seq_no=1)
        crate.race = newer
        store.publish('2026-10-13', {'day': '2026-10-13', 'history_mode': 'daily'}, now)
        self.assertEqual(crate.rows['current']['day'], '2026-10-14')

    def test_changed_article_never_mixes_old_observations_into_new_series(self):
        from f.buzz.store import BuzzStore
        class ObservationsCrate:
            def run(self, *args): pass
            def select(self, *args):
                return [{'title_key': 'movie:1', 'day': '2026-10-12', 'article': 'old', 'views': 2000},
                        {'title_key': 'movie:1', 'day': '2026-10-13', 'article': 'new', 'views': 1000}]
        result = BuzzStore(ObservationsCrate()).read_pageviews([{'title_key': 'movie:1', 'article': 'new'}], DAY - dt.timedelta(days=1), DAY)
        self.assertEqual(result, {'movie:1': {'2026-10-13': 1000}})


class LocalDriverTests(unittest.TestCase):
    def test_local_driver_refuses_existing_table_mutations_before_network(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
        from run_buzz import LocalCrate
        crate = LocalCrate({'CRATE_HOSTS': 'invalid.example'})
        for sql in ('DELETE FROM doc.movie', 'UPDATE doc."show" SET title = ?',
                    'INSERT INTO doc.search_history (query) VALUES (?)', 'REFRESH TABLE doc.movie'):
            with self.assertRaisesRegex(ValueError, 'outside the new buzz tables'):
                crate.run(sql)

if __name__ == '__main__':
    unittest.main()
