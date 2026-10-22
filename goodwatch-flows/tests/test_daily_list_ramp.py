"""Automatic ramp through the daily job's public entrypoint."""
from contextlib import contextmanager, redirect_stdout
from copy import deepcopy
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import types
from uuid import uuid4
import unittest
from unittest.mock import Mock, patch

from test_daily_provider_lists import Storage
from f.tmdb_api import daily_provider_lists as job


class RampStorage(Storage):
    def inventory(self):
        return {key: deepcopy(value) for key, value in self.snapshots.items()}

    @contextmanager
    def checkpoint_batch(self):
        before = deepcopy(self.snapshots)
        try:
            yield
        except BaseException:
            self.snapshots = before
            raise


class FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 10, 17, 14, tzinfo=timezone.utc)


class DailyRampTests(unittest.TestCase):
    def setUp(self):
        self.store = RampStorage()
        self.store.dry_run = False
        self.calls = []
        self.ids = {country: [42] for country in ('AR', 'DE', 'US')}
        self.session = Mock()
        self.session.get.side_effect = self.respond

    def respond(self, url, **kwargs):
        params = kwargs['params']
        self.calls.append((url, params))
        if '/discover/' in url:
            ids = self.ids[params['watch_region']]
            body = dict(page=1, total_pages=1 if ids else 0, total_results=len(ids),
                        results=[{'id': i} for i in ids])
        else:
            body = dict(id=int(url.split('/')[-3]), results={country: {'flatrate': [{'provider_id': 8}]}
                        for country in self.ids})
        return Mock(status_code=200, json=lambda: body)

    def checkpoint(self, country, media):
        self.store.snapshots[f'{country}:{media}:8'] = dict(
            checked_at=int(datetime(2026, 10, 16, 14, tzinfo=timezone.utc).timestamp() * 1000),
            ids=[42], members={'42': ['flatrate']}, retry_ids=[], complete=True, cache_bypassed=True)

    def run_job(self, **kwargs):
        options = dict(countries=list(self.ids), service_ids=[8], dry_run=self.store.dry_run,
                       baseline_max_requests=100, baseline_max_memberships=2)
        options.update(kwargs)
        client_type = job.TMDBClient
        def client(*args, **options):
            value = client_type(*args, **options)
            value.interval = 0
            return value
        with patch('wmill.get_variable', return_value='fixture-key'), \
             patch('requests.Session', return_value=self.session), \
             patch.object(job, 'TMDBClient', side_effect=client), \
             patch.object(job, 'create_list_storage', return_value=self.store), \
             patch.object(job, 'datetime', FixedDateTime):
            return job.main(**options)

    def test_rereads_checkpoints_first_then_admits_countries_in_order(self):
        self.checkpoint('US', 'movie')
        self.checkpoint('US', 'show')
        report = self.run_job(baseline_max_memberships=3)
        discover_countries = [params['watch_region'] for url, params in self.calls if '/discover/' in url]
        self.assertEqual(discover_countries[:2], ['US', 'US'])
        self.assertEqual(report['countries_started'], ['AR'])
        self.assertEqual(report['countries_remaining'], ['DE'])
        self.assertEqual(report['requests_rereads'], 2)
        self.assertEqual(report['requests_new_baselines'], 6)  # Includes DE's deferred discovery reads.
        self.assertEqual(set(self.store.snapshots), {'US:movie:8', 'US:show:8', 'AR:movie:8', 'AR:show:8'})
        self.assertEqual({row['appeared_precision'] for row in self.store.crate.history.values()}, {'unknown'})
        self.assertEqual({row['appeared_source'] for row in self.store.crate.history.values()}, {'backfill'})

    def test_gb_count_overstatement_does_not_withhold_its_other_29_baselines(self):
        self.ids = {'GB': []}
        original = self.session.get.side_effect
        def respond(url, **kwargs):
            params = kwargs['params']
            if '/discover/movie' in url and params['with_watch_providers'] == 9:
                self.calls.append((url, params))
                ids = list(range(1, 1723))
                if params['sort_by'] == 'primary_release_date.desc':
                    ids.reverse()
                page = params['page']
                return Mock(status_code=200, json=lambda: dict(page=page, total_pages=87,
                    total_results=1723, results=[{'id': i} for i in ids[(page - 1) * 20:page * 20]]))
            if '/watch/providers' in url:
                return Mock(status_code=200, json=lambda: dict(id=int(url.split('/')[-3]),
                    results={'GB': {'flatrate': [{'provider_id': 9}]}}))
            return original(url, **kwargs)
        self.session.get.side_effect = respond
        report = self.run_job(service_ids=list(job.SERVICE_NAMES), baseline_max_requests=5000,
                              baseline_max_memberships=5000)
        self.assertEqual(report['countries_started'], ['GB'])
        self.assertEqual((report['lists_completed'], report['lists_failed']), (30, 0))
        self.assertEqual(len(self.store.snapshots), 30)
        self.assertEqual(len(self.store.snapshots['GB:movie:9']['ids']), 1722)
        self.assertEqual({row['appeared_source'] for row in self.store.crate.history.values()}, {'backfill'})
        self.assertEqual({row['appeared_precision'] for row in self.store.crate.history.values()}, {'unknown'})

    def test_shortfall_baseline_cannot_make_the_next_days_arrival_exact(self):
        self.ids = {'AR': []}
        phase, original = [1], self.respond
        def respond(url, **kwargs):
            params = kwargs['params']
            if '/discover/movie' not in url:
                return original(url, **kwargs)
            ids = list(range(1, 1000 if phase[0] == 1 else 1001))
            if params['sort_by'] == 'primary_release_date.desc':
                ids.reverse()
            page = params['page']
            return Mock(status_code=200, json=lambda: dict(page=page, total_pages=50, total_results=1000,
                results=[{'id': i} for i in ids[(page - 1) * 20:page * 20]]))
        self.session.get.side_effect = respond
        first = self.run_job(baseline_max_requests=5000, baseline_max_memberships=2000)
        checkpoint = self.store.load('AR:movie:8')
        self.assertEqual(first['lists'][0]['count_shortfall'], 1)
        phase[0] = 2
        class FollowingDay(FixedDateTime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2026, 10, 18, 14, tzinfo=timezone.utc)
        with patch(__name__ + '.FixedDateTime', FollowingDay):
            second = self.run_job(baseline_max_requests=5000, baseline_max_memberships=2000)
        arrival = next(row for row in self.store.crate.history.values() if row['media_tmdb_id'] == 1000)
        self.assertEqual((second['lists_completed'], second['lists_failed']), (2, 0))
        self.assertEqual(arrival['appeared_precision'], 'unknown')
        self.assertIs(checkpoint['complete'], False)
        self.assertIs(self.store.load('AR:movie:8')['complete'], True)

    def test_a_torn_gb_movie_list_preserves_its_stays_and_commits_the_other_29_lists(self):
        from test_daily_provider_lists import TMDB
        seed = TMDB(ids=[99])
        seed.results = {'GB': {'flatrate': [{'provider_id': 9}]}}
        job.run_daily_lists(seed, self.store, countries=['GB'], service_ids=[9],
                            media_types=['movie'], now=datetime(2026, 10, 15, 14))
        del self.store.snapshots['GB:movie:9']
        prior = deepcopy(self.store.crate.history)
        self.ids = {'GB': []}
        original = self.respond
        def torn(url, **kwargs):
            params = kwargs['params']
            if '/discover/movie' in url and params['with_watch_providers'] == 9:
                page = params['page']
                ids = [41, 42] if page == 1 else [42, 43]
                return Mock(status_code=200, json=lambda: dict(page=page, total_pages=2,
                    total_results=3 if page == 1 else 4, results=[{'id': i} for i in ids]))
            return original(url, **kwargs)
        self.session.get.side_effect = torn
        report = self.run_job(service_ids=list(job.SERVICE_NAMES), baseline_max_requests=1000,
                              baseline_max_memberships=1000)
        self.assertEqual((report['lists_completed'], report['lists_failed']), (29, 1))
        self.assertEqual(report['countries_started'], ['GB'])
        self.assertEqual(report['countries_partial'], {'GB': ['GB:movie:9']})
        self.assertEqual(len(self.store.snapshots), 29)
        self.assertNotIn('GB:movie:9', self.store.snapshots)
        self.assertEqual(self.store.crate.history, prior)
        self.assertNotIn('GB:movie:9', self.store.intents)

    def test_missing_baseline_keeps_its_failure_streak_across_scheduled_days(self):
        self.ids = {'AR': []}
        original = self.respond
        def unavailable(url, **kwargs):
            if '/discover/movie' in url:
                raise job.IncompleteList('Expected 2205 distinct titles, read 2203')
            return original(url, **kwargs)
        self.session.get.side_effect = unavailable
        for day in (17, 18, 19):
            class ScheduledDay(FixedDateTime):
                @classmethod
                def now(cls, tz=None):
                    return datetime(2026, 10, day, 14, tzinfo=timezone.utc)
            with patch(__name__ + '.FixedDateTime', ScheduledDay):
                report = self.run_job()
            failure = next(row for row in report['lists'] if 'error' in row)
            self.assertEqual(failure['consecutive_failure_days'], day - 16)
            self.assertNotIn('AR:movie:8', self.store.snapshots)
            self.assertEqual(report['countries_partial'], {'AR': ['AR:movie:8']})
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        # One failure among 200 is below the percentage gate; the third day
        # still fails even though a first-read checkpoint has never existed.
        report['lists_completed'] = 199
        with self.assertRaisesRegex(RuntimeError, '3 consecutive days'):
            namespace['main'](report)

    def test_report_warns_when_the_next_country_cannot_fit_after_progress(self):
        self.ids = {'AR': [42], 'DE': [42]}
        report = self.run_job(baseline_max_memberships=3)
        self.assertEqual(report['baseline_deferred_country'], 'DE')
        self.assertEqual(report['baseline_deferred_reason'], 'memberships')
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        with self.assertWarnsRegex(RuntimeWarning, 'DE.*memberships'):
            self.assertIs(namespace['main'](report), report)

    def test_explicitly_paused_expansion_does_not_alert_as_budget_exhaustion(self):
        self.checkpoint('US', 'movie')
        self.checkpoint('US', 'show')
        report = self.run_job(baseline_max_requests=0)
        self.assertEqual(report['lists_completed'], 2)
        self.assertEqual(report['countries_started'], [])
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        with self.assertWarnsRegex(RuntimeWarning, 'AR.*requests'):
            self.assertIs(namespace['main'](report), report)

    def test_first_country_http_deferral_succeeds_but_oversized_memberships_alert(self):
        self.ids = {'AR': [42, 43]}
        for limits, budget in (({'baseline_max_memberships': 3}, 'memberships'),
                               ({'baseline_max_requests': 3, 'baseline_max_memberships': 10}, 'requests')):
            with self.subTest(limits=limits):
                report = self.run_job(**limits)
                self.assertEqual(report['baseline_deferred_country'], 'AR')
                self.assertEqual(report['baseline_deferred_reason'], 'country_exceeds_budget')
                namespace = {}
                exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
                self.assertEqual(report['baseline_deferred_budget'], budget)
                if budget == 'memberships':
                    with self.assertRaisesRegex(RuntimeError, 'AR.*budget'):
                        namespace['main'](report)
                else:
                    with self.assertWarnsRegex(RuntimeWarning, 'AR.*requests'):
                        self.assertIs(namespace['main'](report), report)
                self.assertEqual(self.store.snapshots, {})

    def test_new_baseline_request_budget_defers_without_failing_the_report(self):
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        for ids, budget, committed in (([], 1, 1), ([42], 3, 1), ([42, 43], 3, 0)):
            with self.subTest(ids=ids, budget=budget):
                self.setUp()
                self.ids = {'AR': ids}
                report = self.run_job(baseline_max_requests=budget, baseline_max_memberships=10)
                self.assertEqual(report['lists_completed'], committed)
                self.assertEqual(report['lists_failed'], 0)
                self.assertEqual(report['requests']['requests'], budget)
                self.assertEqual(report['baseline_deferred_country'], 'AR')
                self.assertEqual(report['baseline_deferred_budget'], 'requests')
                self.assertFalse(report.get('hard_budget_exceeded', False))
                with self.assertWarnsRegex(RuntimeWarning, 'AR.*requests'):
                    self.assertIs(namespace['main'](report), report)
                self.assertEqual(len(self.store.snapshots), committed)

    def test_hard_cap_during_each_baseline_step_remains_fatal_in_the_report(self):
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        client_type = job.TMDBClient
        for step, ids, remaining in (('discovery', [], 1), ('confirmation', [42], 3), ('publication', [42], 4)):
            with self.subTest(step=step):
                self.setUp()
                self.ids = {'AR': ids}
                def near_hard_cap(*args, **kwargs):
                    client = client_type(*args, **kwargs)
                    # Simulate the earlier countries' requests, then exercise
                    # the real client's 350k guard with just a few HTTP calls.
                    client.stats['requests'] = 350000 - remaining
                    return client
                original_lease = self.store.lease
                @contextmanager
                def lease(identity):
                    if step == 'publication' and identity == 'AR:show:8':
                        raise job.RequestBudgetExceeded('Daily list request budget exhausted',
                                                       endpoint='/tv/42/watch/providers')
                    with original_lease(identity) as owned:
                        yield owned
                with patch.object(job, 'TMDBClient', side_effect=near_hard_cap), patch.object(self.store, 'lease', lease):
                    report = self.run_job(baseline_max_memberships=10)
                self.assertEqual(report['requests']['requests'], 350000)
                self.assertEqual(report['requests_new_baselines'], remaining)
                self.assertEqual(report['lists_completed'], 1)
                self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})
                self.assertTrue(report.get('hard_budget_exceeded', False))
                self.assertFalse(report['rereads_budget_exceeded'])
                with self.assertRaisesRegex(RuntimeError, 'hard.*budget'):
                    namespace['main'](report)

    def test_baseline_request_deferral_during_publication_is_nonfatal(self):
        self.ids = {'AR': [42]}
        original_lease = self.store.lease
        @contextmanager
        def lease(identity):
            if identity == 'AR:show:8':
                raise job.BaselineBudgetExceeded('New baseline request budget exhausted')
            with original_lease(identity) as owned:
                yield owned
        with patch.object(self.store, 'lease', lease):
            report = self.run_job()
        self.assertFalse(report['hard_budget_exceeded'])
        self.assertEqual(report['baseline_deferred_country'], 'AR')
        self.assertEqual(report['baseline_deferred_budget'], 'requests')
        self.assertEqual(report['lists_completed'], 1)
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        with self.assertWarnsRegex(RuntimeWarning, 'AR.*requests'):
            self.assertIs(namespace['main'](report), report)

    def test_predicted_reread_hard_budget_overrun_is_fatal_in_the_report(self):
        namespace = {}
        exec((Path(job.__file__).parent / 'read_daily_provider_lists.flow/report.inline_script.py').read_text(), namespace)
        with self.assertRaisesRegex(RuntimeError, 'rereads.*budget'):
            namespace['main'](dict(lists_completed=199, lists_failed=0, lists=[],
                                   rereads_complete=True, rereads_budget_exceeded=True))

    def test_oldest_checkpoints_are_reread_first_after_budget_starvation(self):
        for country in ('AR', 'US'):
            for media in ('movie', 'show'):
                self.checkpoint(country, media)
        self.store.snapshots['US:show:8']['checked_at'] -= 86400000
        self.run_job(max_requests=1)
        discover = [(params['watch_region'], '/discover/tv' in url)
                    for url, params in self.calls if '/discover/' in url]
        self.assertEqual(discover, [('US', True)])

    def test_budget_during_later_confirmation_keeps_the_already_confirmed_list(self):
        self.ids = {'AR': [42]}
        report = self.run_job(baseline_max_requests=3)
        self.assertEqual(report['countries_started'], ['AR'])
        self.assertEqual(report['countries_remaining'], ['AR'])
        self.assertEqual(report['requests_new_baselines'], 3)
        self.assertEqual(report['baseline_deferred_reason'], 'requests')
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})
        self.assertEqual((report['lists_completed'], report['lists_failed']), (1, 0))
        self.assertEqual({row['media_type'] for row in self.store.crate.history.values()}, {'movie'})

    def test_budget_after_a_completed_empty_list_keeps_its_checkpoint(self):
        self.ids = {'AR': []}
        report = self.run_job(baseline_max_requests=1)
        self.assertEqual((report['lists_completed'], report['lists_failed']), (1, 0))
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})
        self.assertEqual(report['countries_partial'], {'AR': ['AR:show:8']})
        self.assertEqual(report['requests_new_baselines'], 1)
        self.assertEqual(report['baseline_deferred_reason'], 'requests')

    def test_publication_stop_reports_every_list_already_committed_in_its_country(self):
        for error_type in (job.RequestBudgetExceeded, job.TMDBAccessDenied, job.LeaseLost):
            for after_commit in (False, True):
                with self.subTest(error=error_type.__name__, after_commit=after_commit):
                    self.setUp()
                    self.ids = {'AR': [42]}
                    original_lease = self.store.lease
                    @contextmanager
                    def lease(identity):
                        stop = identity == 'AR:show:8'
                        if stop and not after_commit:
                            raise error_type('Injected publication stop')
                        with original_lease(identity) as owned:
                            yield owned
                        if stop:
                            raise error_type('Injected publication stop after commit')
                    output = io.StringIO()
                    with patch.object(self.store, 'lease', lease), redirect_stdout(output):
                        if error_type is job.RequestBudgetExceeded:
                            report = self.run_job()
                        else:
                            with self.assertRaises(error_type) as stopped:
                                self.run_job()
                            events = [json.loads(line) for line in output.getvalue().splitlines()
                                      if line.startswith('{')]
                            summaries = [event['report'] for event in events
                                         if event.get('event') == 'daily_list_run_stopped']
                            self.assertEqual(len(summaries), 1)
                            report = summaries[0]
                            self.assertEqual(stopped.exception.report, report)
                    expected = {'AR:movie:8', 'AR:show:8'} if after_commit else {'AR:movie:8'}
                    self.assertEqual(set(self.store.snapshots), expected)
                    self.assertEqual({row['key'] for row in report['lists']}, expected)
                    self.assertEqual(report['lists_completed'], len(expected))
                    self.assertEqual(report['countries_started'], ['AR'])
                    self.assertEqual(report['countries_partial'], {} if after_commit else {'AR': ['AR:show:8']})
                    self.assertEqual(report['countries_remaining'], [] if after_commit else ['AR'])
                    self.assertEqual(report['baseline_memberships'], len(expected))
                    self.assertEqual(report['requests_new_baselines'], 4)

    def test_twenty_failing_baselines_stop_http_work_across_partial_countries(self):
        self.ids = {country: [42] for country in ('AR', 'BS', 'CD', 'CO', 'CV', 'GH',
                                                 'ID', 'IQ', 'LC', 'MA', 'MC')}
        def unavailable(url, **kwargs):
            self.calls.append((url, kwargs['params']))
            return Mock(status_code=404)
        self.session.get.side_effect = unavailable
        output = io.StringIO()
        with redirect_stdout(output), self.assertRaisesRegex(job.TMDBReadError, '20 consecutive'):
            self.run_job(baseline_max_requests=100, baseline_max_memberships=100)
        failures = [json.loads(line) for line in output.getvalue().splitlines() if line.startswith('{')]
        self.assertEqual(len(failures), 20)
        self.assertEqual(len(self.calls), 20)
        self.assertEqual(self.store.snapshots, {})
        self.assertEqual(self.store.crate.history, {})

    def test_rereads_that_exhaust_the_hard_budget_report_no_new_countries(self):
        self.checkpoint('US', 'movie')
        self.checkpoint('US', 'show')
        report = self.run_job(max_requests=1)
        self.assertTrue(report['rereads_budget_exceeded'])
        self.assertFalse(report['rereads_complete'])
        self.assertEqual(report['countries_started'], [])
        self.assertEqual(report['requests_rereads'], 1)
        self.assertEqual(report['requests_new_baselines'], 0)
        self.assertEqual(report['baseline_deferred_reason'], 'rereads_exceed_hard_budget')
        self.assertFalse(any(key.startswith('AR:') or key.startswith('DE:') for key in self.store.snapshots))

    def test_failed_list_keeps_its_country_siblings_and_the_next_country_independent(self):
        self.ids = {'AR': [42], 'DE': [42]}
        respond = self.respond
        def fail_show(url, **kwargs):
            if '/discover/tv' in url and kwargs['params']['watch_region'] == 'AR':
                return Mock(status_code=404)
            return respond(url, **kwargs)
        self.session.get.side_effect = fail_show
        report = self.run_job(baseline_max_memberships=4)
        self.assertEqual(report['countries_started'], ['AR', 'DE'])
        self.assertEqual(report['countries_remaining'], ['AR'])
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8', 'DE:movie:8', 'DE:show:8'})
        self.assertEqual((report['lists_completed'], report['lists_failed']), (3, 1))
        failures = [item for item in report['lists'] if 'error' in item]
        self.assertEqual({item['key'] for item in failures}, {'AR:show:8'})
        failure = failures[0]
        self.assertEqual(failure['key'], 'AR:show:8')
        self.assertEqual(failure['endpoint'], '/discover/tv')
        self.assertEqual(failure['media_type'], 'show')

    def test_late_title_failure_cannot_publish_or_close_stays_for_its_list(self):
        from test_daily_provider_lists import TMDB
        seed = TMDB(ids=[99])
        seed.results = {'AR': {'flatrate': [{'provider_id': 8}]}}
        job.run_daily_lists(seed, self.store, countries=['AR'], service_ids=[8],
                            media_types=['show'], now=datetime(2026, 10, 15, 14))
        del self.store.snapshots['AR:show:8']  # History predates the list's first read.
        prior = deepcopy(self.store.crate.history)
        self.ids = {'AR': [42]}
        original = self.respond
        def fail_last_check(url, **kwargs):
            if '/tv/99/watch/providers' in url:
                return Mock(status_code=400)
            return original(url, **kwargs)
        self.session.get.side_effect = fail_last_check
        report = self.run_job(baseline_max_memberships=10)
        self.assertEqual((report['lists_completed'], report['lists_failed']), (1, 1))
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})
        self.assertEqual(report['countries_started'], ['AR'])
        self.assertEqual(report['countries_remaining'], ['AR'])
        self.assertEqual(report['baseline_memberships'], 1)
        failures = [item for item in report['lists'] if 'error' in item]
        self.assertEqual((failures[0]['key'], failures[0]['tmdb_id']), ('AR:show:8', 99))
        for key, stay in prior.items():
            self.assertEqual(self.store.crate.history[key], stay)
        shows = [row for row in self.store.crate.history.values() if row['media_type'] == 'show']
        self.assertEqual([row['media_tmdb_id'] for row in shows], [99])
        self.assertIsNone(shows[0]['dropped_on'])
        movies = [row for row in self.store.crate.history.values() if row['media_type'] == 'movie']
        self.assertEqual({row['appeared_precision'] for row in movies}, {'unknown'})
        self.assertEqual({row['appeared_source'] for row in movies}, {'backfill'})

    def test_failed_first_list_retries_unknown_while_its_checkpointed_sibling_gets_exact_days(self):
        from test_availability_history import day
        self.ids = {'GB': [42]}
        phase = [1]
        def respond(url, **kwargs):
            params = kwargs['params']
            self.calls.append((url, params))
            if '/discover/' in url:
                if phase[0] == 1 and '/movie' in url and params['with_watch_providers'] == 9:
                    return Mock(status_code=404)
                ids = [43] if phase[0] == 2 and '/movie' in url else [42]
                return Mock(status_code=200, json=lambda: dict(page=1, total_pages=1,
                    total_results=1, results=[{'id': i} for i in ids]))
            tmdb_id = int(url.split('/')[-3])
            removed = phase[0] == 2 and '/movie/42/' in url
            body = dict(id=tmdb_id, results={} if removed else
                        {'GB': {'flatrate': [{'provider_id': 8}, {'provider_id': 9}]}})
            return Mock(status_code=200, json=lambda: body)
        self.session.get.side_effect = respond
        first = self.run_job(service_ids=[8, 9], baseline_max_memberships=10)
        self.assertEqual((first['lists_completed'], first['lists_failed']), (3, 1))
        self.assertEqual(first['countries_partial'], {'GB': ['GB:movie:9']})
        self.assertNotIn('GB:movie:9', self.store.snapshots)
        phase[0] = 2
        class FollowingDay(FixedDateTime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2026, 10, 18, 14, tzinfo=timezone.utc)
        with patch(__name__ + '.FixedDateTime', FollowingDay):
            second = self.run_job(service_ids=[8, 9], baseline_max_memberships=10)
        self.assertEqual((second['lists_completed'], second['lists_failed']), (4, 0))
        self.assertEqual(second['countries_partial'], {})
        self.assertEqual(second['countries_remaining'], [])
        movies = {(row['media_tmdb_id'], row['streaming_service_id']): row
                  for row in self.store.crate.history.values() if row['media_type'] == 'movie'}
        self.assertEqual((movies[42, 8]['dropped_precision'], movies[42, 8]['dropped_on']),
                         ('exact', day('2026-10-18')))
        self.assertEqual((movies[43, 8]['appeared_precision'], movies[43, 8]['appeared_on']),
                         ('exact', day('2026-10-18')))
        self.assertEqual((movies[43, 9]['appeared_precision'], movies[43, 9]['appeared_source']),
                         ('unknown', 'backfill'))
        self.assertNotIn((42, 9), movies)

    def test_zero_membership_budget_rereads_but_does_not_probe_new_countries(self):
        self.checkpoint('US', 'movie')
        self.checkpoint('US', 'show')
        report = self.run_job(baseline_max_memberships=0)
        self.assertEqual(report['requests_rereads'], 2)
        self.assertEqual(report['requests_new_baselines'], 0)
        self.assertEqual(report['countries_remaining'], ['AR', 'DE'])
        self.assertEqual(report['baseline_deferred_reason'], 'memberships')

    def test_next_day_rereads_new_checkpoints_before_starting_the_next_country(self):
        self.ids = {'AR': [42], 'DE': [42]}
        first = self.run_job()
        self.assertEqual(first['countries_started'], ['AR'])
        for snapshot in self.store.snapshots.values():
            snapshot['checked_at'] -= 86400000
        self.calls.clear()
        second = self.run_job()
        discover = [params['watch_region'] for url, params in self.calls if '/discover/' in url]
        self.assertEqual(discover, ['AR', 'AR', 'DE', 'DE'])
        self.assertEqual(second['countries_started'], ['DE'])
        self.assertEqual(second['countries_remaining'], [])
        self.assertTrue(second['ramp_complete'])
        self.assertEqual(second['requests_rereads'], 2)
        self.assertEqual(second['requests_new_baselines'], 4)
        self.calls.clear()
        for snapshot in self.store.snapshots.values():
            snapshot['checked_at'] -= 86400000
        third = self.run_job(baseline_max_requests=0)
        self.assertEqual(third['requests_rereads'], 4)
        self.assertEqual(third['requests_new_baselines'], 0)
        self.assertEqual(third['countries_started'], [])
        self.assertTrue(third['ramp_complete'])

    def test_retained_checkpoints_are_reread_even_if_tmdb_drops_the_country(self):
        self.checkpoint('US', 'movie')
        self.checkpoint('US', 'show')
        report = self.run_job(countries=['AR'], baseline_max_requests=0)
        self.assertEqual(report['requests_rereads'], 2)
        self.assertEqual(report['countries_remaining'], ['AR'])
        self.assertEqual(report['countries_started'], [])

    def test_windmill_entry_keeps_completed_lists_at_a_normal_budget_stop(self):
        # Windmill executes the entry script separately from its f.* import.
        entry = types.ModuleType('windmill_entry')
        source = Path(job.__file__).read_text()
        exec(compile(source, 'windmill_entry', 'exec'), entry.__dict__)
        self.ids = {'AR': [42]}
        with patch('wmill.get_variable', return_value='fixture-key'), \
             patch('requests.Session', return_value=self.session), \
             patch.object(entry, 'create_list_storage', return_value=self.store), \
             patch.object(job, 'create_list_storage', return_value=self.store):
            report = entry.main(countries=['AR'], service_ids=[8], dry_run=False,
                                baseline_max_requests=3, baseline_max_memberships=2,
                                requests_per_second=20)
        self.assertEqual(report['lists_failed'], 0)
        self.assertEqual(report['baseline_deferred_reason'], 'requests')
        self.assertEqual(report['countries_started'], ['AR'])
        self.assertEqual(set(self.store.snapshots), {'AR:movie:8'})

    def test_invalid_budgets_are_rejected_before_network_or_storage_access(self):
        for options in ({'max_requests': 350001}, {'max_requests': 0},
                        {'baseline_max_requests': -1}, {'baseline_max_memberships': -1},
                        {'baseline_max_memberships': True}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                self.run_job(**options)
        self.assertEqual(self.calls, [])

    def test_real_storage_dry_run_plans_the_ramp_without_data_publication(self):
        import mongomock
        from f.tmdb_api.daily_list_storage import ListStorage
        from test_daily_provider_lists import HistoryCrate
        db, crate = mongomock.MongoClient().db, HistoryCrate()
        self.store = ListStorage(db=db, connector=crate, dry_run=True)
        report = self.run_job()
        self.assertEqual(report['countries_started'], ['AR'])
        self.assertEqual(db.list_collection_names(), ['tmdb_daily_provider_list_leases'])
        self.assertEqual(db.tmdb_daily_provider_list_leases.count_documents({}), 0)
        self.assertEqual(crate.history, {})
        self.assertEqual(crate.writes, [])
        self.assertEqual(self.store.stats['planned_exact_arrivals'], 0)
        self.assertEqual(self.store.stats['planned_exact_drops'], 0)


@unittest.skipUnless(os.environ.get('TEST_MONGO_URL'), 'Opt in to a disposable localhost replica set')
class DailyRampMongoTests(unittest.TestCase):
    run_job = DailyRampTests.run_job
    respond = DailyRampTests.respond
    def setUp(self):
        DailyRampTests.setUp(self)
        from pymongo import MongoClient
        from urllib.parse import urlsplit
        url = os.environ['TEST_MONGO_URL']
        if urlsplit(url).hostname not in ('localhost', '127.0.0.1'):
            raise ValueError('Mongo test must use localhost')
        self.mongo = MongoClient(url)
        self.db = self.mongo['gw682_test_' + uuid4().hex]
        self.addCleanup(self.mongo.close)
        self.addCleanup(lambda: self.mongo.drop_database(self.db.name))

    def test_failed_baseline_streak_survives_a_new_adapter_and_clears_on_commit(self):
        from f.tmdb_api.daily_list_storage import ListStorage
        from test_daily_provider_lists import HistoryCrate
        self.ids = {'AR': []}
        original = self.respond
        def unavailable(url, **kwargs):
            if '/discover/movie' in url:
                raise job.IncompleteList('Expected 2205 distinct titles, read 2203')
            return original(url, **kwargs)
        self.session.get.side_effect = unavailable
        for day in (17, 18, 19):
            # Recreate storage as independent scheduled jobs do.
            self.store = ListStorage(db=self.db, connector=HistoryCrate(), dry_run=False)
            class ScheduledDay(FixedDateTime):
                @classmethod
                def now(cls, tz=None):
                    return datetime(2026, 10, day, 14, tzinfo=timezone.utc)
            with patch(__name__ + '.FixedDateTime', ScheduledDay):
                report = self.run_job()
            failure = next(row for row in report['lists'] if 'error' in row)
            self.assertEqual(failure['consecutive_failure_days'], day - 16)
            intent = self.db.tmdb_daily_provider_list_pending.find_one({'_id': 'AR:movie:8'})
            self.assertEqual(intent['consecutive_failure_days'], day - 16)
        self.session.get.side_effect = original
        self.run_job()
        self.assertEqual(self.db.tmdb_daily_provider_list_pending.count_documents({}), 0)
        self.assertEqual(self.db.tmdb_daily_provider_lists.count_documents({}), 2)

    def test_late_checkpoint_failure_retains_only_its_list_and_retries_it_independently(self):
        from pymongo.synchronous.collection import Collection
        from f.tmdb_api.daily_list_storage import ListStorage
        from test_daily_provider_lists import HistoryCrate
        self.ids = {'AR': [42]}
        crate = HistoryCrate()
        self.store = ListStorage(db=self.db, connector=crate, dry_run=False)
        replace = Collection.replace_one
        def fail_second(collection, selector, *args, **kwargs):
            if collection.name == 'tmdb_daily_provider_lists' and selector['_id'] == 'AR:show:8':
                raise RuntimeError('Injected late checkpoint failure')
            return replace(collection, selector, *args, **kwargs)
        with patch.object(Collection, 'replace_one', new=fail_second):
            failed = self.run_job()
        self.assertEqual((failed['lists_completed'], failed['lists_failed']), (1, 1))
        self.assertEqual(failed['countries_started'], ['AR'])
        self.assertEqual(self.db.tmdb_daily_provider_lists.count_documents({}), 1)
        self.assertEqual(self.db.tmdb_daily_provider_list_pending.count_documents({}), 1)
        # A retry keeps the completed sibling and reuses only the failed list's intent.
        recovered = self.run_job()
        self.assertEqual((recovered['lists_completed'], recovered['lists_failed']), (1, 0))
        self.assertEqual(recovered['lists_skipped'], 1)
        self.assertEqual(recovered['countries_started'], ['AR'])
        self.assertEqual(self.db.tmdb_daily_provider_lists.count_documents({}), 2)
        self.assertEqual(self.db.tmdb_daily_provider_list_pending.count_documents({}), 0)
        self.assertTrue(all(row['appeared_precision'] == 'unknown' for row in crate.history.values()))


if __name__ == '__main__':
    unittest.main()
