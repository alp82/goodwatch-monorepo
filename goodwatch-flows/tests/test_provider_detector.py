"""Provider detector acceptance with disposable Mongo and admitted fake HTTP."""
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_api import provider_detector as detector
from f.tmdb_api import provider_observations as evidence
from f.tmdb_api.daily_provider_lists import TMDBDeletedTitle, TMDBReadError
from f.tmdb_api.provider_evidence import DAY, utc_ms


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 22, 1)
        self.sleeps = []

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += timedelta(seconds=seconds)


def payload(tmdb_id, service=8):
    return {'id': tmdb_id, 'results': {'US': {
        'link': f'https://www.themoviedb.org/movie/{tmdb_id}/watch?locale=US',
        'flatrate': [{'provider_id': service}]}}}


class Catalog:
    def __init__(self):
        self.parents = {'movie': [], 'show': []}
        self.opens = {'movie': [], 'show': []}
        self.calls = []

    def select(self, sql, params):
        self.calls.append((sql, params))
        if 'FROM crawl_priority' in sql:
            return [{'tmdb_id': value} for value in self.opens[params[0]]]
        return deepcopy(self.parents[params[0]])


class API:
    def __init__(self):
        self.before_request = lambda: None
        self.responses = {}
        self.calls = []
        self.stats = {'requests': 0}

    def get(self, path):
        self.before_request()
        self.stats['requests'] += 1
        self.calls.append(path)
        tmdb_id = int(path.split('/')[2])
        response = self.responses.get(tmdb_id, payload(tmdb_id))
        if isinstance(response, Exception):
            raise response
        return deepcopy(response)


class DetectorTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.clock, self.crate, self.api = Clock(), Catalog(), API()
        self.publish = Mock(return_value={})

    def seed(self, tmdb_id=42, popularity=10, *, registered=False, parent=True):
        self.db.tmdb_movie_details.insert_one(dict(tmdb_id=tmdb_id, original_title='A title', popularity=popularity,
            provider_detector_registered=registered, updated_at=self.clock() - timedelta(days=20), is_selected=True))
        if parent:
            self.crate.parents['movie'].append(dict(tmdb_id=tmdb_id, popularity=popularity,
                                                    tmdb_url=f'https://www.themoviedb.org/movie/{tmdb_id}'))

    def run_job(self, mode='shadow', **kwargs):
        return detector.run_detector(self.db, self.crate, mode=mode, clock=self.clock,
            sleeper=self.clock.sleep, client=self.api, publish=self.publish, **kwargs)

    def snapshot(self):
        return {name: list(self.db[name].find()) for name in self.db.list_collection_names()}

    def test_preview_has_no_http_or_mongo_writes(self):
        self.seed()
        before = self.snapshot()
        with patch.object(detector, 'TMDBClient', side_effect=AssertionError('HTTP forbidden')):
            result = self.run_job('preview')
        self.assertEqual(result['due'], 1)
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(self.api.calls)
        self.assertTrue(all('tmdb_providers_updated_at IS NOT NULL' in sql or 'last_opened_at' in sql
                            for sql, _ in self.crate.calls))

    def test_shadow_observations_are_isolated_and_reused(self):
        self.seed()
        before = self.db.tmdb_movie_details.find_one()
        first = self.run_job()
        self.assertEqual(first['observed'], 1)
        source = self.db.tmdb_movie_details.find_one()
        self.assertIn('watch_providers_shadow', source)
        self.assertNotIn('watch_providers', source)
        self.assertEqual(source['updated_at'], before['updated_at'])
        self.assertTrue(source['is_selected'])
        self.assertEqual(list(self.db.tmdb_movie_providers.find()), [])
        self.publish.assert_not_called()
        self.run_job()
        self.assertEqual(len(self.api.calls), 1)

    def test_shadow_diff_preserves_live_and_history_publication_intent(self):
        self.seed()
        live = evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock() - timedelta(days=2))
        self.api.responses[42] = payload(42, 9)
        result = self.run_job()
        self.assertEqual(result['changed_pairs'], {'popular': 1})
        source = self.db.tmdb_movie_details.find_one()
        self.assertEqual(source['watch_providers_check'], live['proof'])
        self.assertEqual(source['watch_providers_publication_pending'], live['revision'])
        self.publish.assert_not_called()

    def test_shadow_ingests_newer_live_reader_evidence_without_duplicate_http(self):
        self.seed()
        old = self.clock() - timedelta(days=2)
        evidence.save_observation(self.db, 'movie', 42, payload(42), old, shadow=True)
        fresh = evidence.save_observation(self.db, 'movie', 42, payload(42, 9), self.clock())
        result = self.run_job()
        self.assertFalse(self.api.calls)
        self.assertEqual(result['reused'], 1)
        self.assertEqual(result['changed_pairs'], {'popular': 1})
        self.assertEqual(evidence.read_observation(self.db, 'movie', 42, shadow=True)['checked_at'], fresh['checked_at'])
        self.assertEqual(self.db.tmdb_movie_details.find_one()['watch_providers_publication_pending'], fresh['revision'])

    def test_first_shadow_baseline_copies_fresh_live_time_without_http(self):
        self.seed()
        fresh = evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock())
        result = self.run_job()
        self.assertFalse(self.api.calls)
        shadow = self.db.tmdb_movie_details.find_one()['watch_providers_shadow']
        self.assertEqual(shadow['watch_providers_check'], fresh['proof'])
        self.assertEqual(result['changed_pairs'], {'popular': 0})

    def test_fresh_pending_publication_retries_without_api_or_metadata_work(self):
        self.seed()
        live = evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock())
        self.publish.return_value = {42: 'writer_busy'}
        result = self.run_job('publish')
        self.assertEqual(result['failed'], 1)
        self.assertFalse(self.api.calls)
        self.assertEqual(self.db.tmdb_movie_details.find_one()['watch_providers_publication_pending'], live['revision'])
        self.publish.return_value = {}
        result = self.run_job('publish')
        self.assertEqual(result['published'], 1)
        self.assertFalse(self.api.calls)
        self.assertNotIn('watch_providers_publication_pending', self.db.tmdb_movie_details.find_one())
        self.assertTrue(self.db.tmdb_movie_details.find_one()['is_selected'])
        self.assertEqual(self.db.tmdb_movie_providers.count_documents({}), 1)

    def test_publish_saves_baseline_and_explicit_ids_then_acknowledges_revision(self):
        self.seed()
        result = self.run_job('publish')
        self.assertEqual(result['observed'], 1)
        self.assertEqual(result['changed_pairs'], {'popular': 0})
        self.publish.assert_called_once_with(self.crate, 'movie', [42])
        current = evidence.read_observation(self.db, 'movie', 42)
        self.assertIsNotNone(current)
        self.assertNotIn('previous_day', current['proof'])
        self.assertNotIn('watch_providers_publication_pending', self.db.tmdb_movie_details.find_one())

    def test_registry_keeps_empty_titles_and_registers_new_accepted_opens(self):
        self.seed(42, popularity=0, registered=True, parent=False)
        self.seed(43, popularity=0, parent=False)
        self.seed(44, popularity=0, parent=False)  # Raw imports alone are excluded.
        self.crate.opens['movie'] = [43]
        evidence.save_observation(self.db, 'movie', 42, {'results': {'US': {}}}, self.clock())
        result = self.run_job()
        self.assertEqual(result['registered'], 2)
        self.assertEqual(self.api.calls, ['/movie/43/watch/providers'])
        self.assertTrue(self.db.tmdb_movie_details.find_one({'tmdb_id': 43})['provider_detector_registered'])
        self.assertFalse(self.db.tmdb_movie_details.find_one({'tmdb_id': 44})['provider_detector_registered'])

    def test_unseen_cold_baseline_slot_and_deferred_carry_survive_next_day(self):
        slot = utc_ms(self.clock()) // DAY % 7
        ids = [value for value in range(1, 100) if detector.day_slot('movie', value) == slot][:2]
        for value in ids:
            self.seed(value, popularity=0)
        first = self.run_job(max_titles=1)
        self.assertEqual(first['due'], 2)
        remaining = self.db.tmdb_movie_details.find_one({'tmdb_id': ids[1]})
        self.assertEqual(remaining['provider_detector_shadow_due_at'], datetime(2026, 10, 22, 1))
        self.clock.now += timedelta(days=1)
        second = self.run_job(max_titles=1)
        self.assertEqual(second['observed'], 1)
        self.assertIsNotNone(evidence.read_observation(self.db, 'movie', ids[1], shadow=True))
        self.assertNotIn('provider_detector_shadow_due_at', self.db.tmdb_movie_details.find_one({'tmdb_id': ids[1]}))

    def test_daily_vs_weekly_recomputes_after_accepted_open(self):
        self.seed(popularity=0, registered=True)
        evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock() - timedelta(days=2))
        self.assertEqual(self.run_job()['observed'], 0)
        self.crate.opens['movie'] = [42]
        result = self.run_job()
        self.assertEqual(result['observed'], 1)
        self.assertEqual(result['changed_pairs'], {'opened': 0})

    def test_failed_response_retains_due_and_valid_provider_evidence(self):
        self.seed()
        before = evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock() - timedelta(days=2))
        self.api.responses[42] = TMDBReadError('HTTP 503', http_status=503)
        result = self.run_job('publish')
        self.assertEqual(result['failed'], 1)
        self.assertEqual(evidence.read_observation(self.db, 'movie', 42)['proof'], before['proof'])
        self.assertEqual(self.run_job('preview')['due'], 1)

    def test_api_confirmed_deletion_shadow_never_marks_live_deleted(self):
        self.seed()
        self.api.responses[42] = TMDBDeletedTitle('deleted', endpoint='/movie/42/watch/providers', http_status=404)
        result = self.run_job()
        self.assertEqual(result['deleted'], 1)
        self.assertFalse(self.db.tmdb_movie_details.find_one().get('tmdb_deleted'))
        self.assertEqual(self.db.tmdb_movie_details.find_one()['provider_detector_shadow_error'], 'tmdb_not_found')
        with patch('f.tmdb_api.deleted_propagation.propagate_tmdb_deleted') as propagate:
            result = self.run_job('publish')
        self.assertEqual(result['deleted'], 1)
        self.assertTrue(self.db.tmdb_movie_details.find_one()['tmdb_deleted'])
        propagate.assert_called_once_with('movie', [42], True)

    def test_unconfirmed_404_does_not_delete(self):
        self.seed()
        self.api.responses[42] = TMDBReadError('HTTP 404', http_status=404)
        self.assertEqual(self.run_job('publish')['failed'], 1)
        self.assertFalse(self.db.tmdb_movie_details.find_one().get('tmdb_deleted'))

    def test_page_404_api_present_refreshes_canonical_url_and_clears_confirmation(self):
        self.seed()
        self.db.tmdb_movie_providers.insert_one(dict(tmdb_id=42, country_code='US', country_identity_ready=True,
            tmdb_watch_url='https://www.themoviedb.org/movie/42-old/watch?locale=US', api_confirmation_pending=True,
            next_fetch_at=self.clock() + timedelta(days=1), consecutive_failures=3))
        evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock())
        self.run_job('publish')
        self.assertEqual(len(self.api.calls), 1)  # Confirmation is fresh even when ordinary evidence is recent.
        country = self.db.tmdb_movie_providers.find_one()
        self.assertNotIn('api_confirmation_pending', country)
        self.assertEqual(country['tmdb_watch_url'], payload(42)['results']['US']['link'])
        self.assertEqual(country['next_fetch_at'], self.clock() + timedelta(days=1))
        self.assertEqual(country['consecutive_failures'], 3)

    def test_budget_exhaustion_preserves_due_work_across_reruns(self):
        self.seed()
        self.db.tmdb_streaming_upstream.insert_one(dict(_id=detector.CONTROL_ID,
            request_day=utc_ms(self.clock()) // DAY, requests=100000))
        result = self.run_job()
        self.assertEqual(result['deferred_reason'], 'daily_budget_exhausted')
        self.assertFalse(self.api.calls)
        self.assertIn('provider_detector_shadow_due_at', self.db.tmdb_movie_details.find_one())
        self.clock.now += timedelta(days=1)
        self.assertEqual(self.run_job()['observed'], 1)
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one()['requests'], 1)

    def test_window_and_daily_list_preempt_without_writes(self):
        self.seed()
        self.clock.now = self.clock.now.replace(hour=12)
        before = self.snapshot()
        self.assertEqual(self.run_job()['deferred_reason'], 'window_closed')
        self.assertEqual(self.snapshot(), before)
        self.clock.now = self.clock.now.replace(hour=1)
        self.db.tmdb_daily_provider_list_leases.insert_one(dict(_id='run', expires_at=self.clock() + timedelta(minutes=5)))
        before = self.snapshot()
        self.assertEqual(self.run_job()['deferred_reason'], 'daily_list_active')
        self.assertEqual(self.snapshot(), before)

    def test_publisher_cannot_acknowledge_a_newer_provider_revision(self):
        self.seed()
        original = evidence.save_observation(self.db, 'movie', 42, payload(42), self.clock())
        def racing_publish(*args):
            evidence.save_observation(self.db, 'movie', 42, payload(42, 9), self.clock() + timedelta(seconds=1))
            return {}
        self.publish.side_effect = racing_publish
        self.run_job('publish')
        pending = self.db.tmdb_movie_details.find_one()['watch_providers_publication_pending']
        self.assertNotEqual(pending, original['revision'])


class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.clock = Clock()

    def admission(self, **kwargs):
        return detector.Admission(self.db, clock=self.clock, sleeper=self.clock.sleep, **kwargs)

    def test_shared_spacing_and_budget_survive_rerun(self):
        with self.admission(max_requests=2).lease() as first:
            first.before_request()
        with self.admission(max_requests=2).lease() as second:
            second.before_request()
            with self.assertRaisesRegex(detector.DetectorStopped, 'daily_budget_exhausted'):
                second.before_request()
        self.assertTrue(self.clock.sleeps)
        self.assertGreaterEqual(sum(self.clock.sleeps), 1 / 3)
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one()['requests'], 2)

    def test_active_run_and_lost_lease_fail_closed(self):
        with self.admission().lease() as first:
            with self.assertRaisesRegex(detector.DetectorStopped, 'run_active'):
                with self.admission().lease():
                    pass
            self.db.tmdb_streaming_upstream.delete_one({'_id': detector.CONTROL_ID})
            with self.assertRaisesRegex(detector.DetectorStopped, 'run_lease_lost'):
                first.before_request()

    def test_retry_budget_preemption_checks_window_and_list_on_every_attempt(self):
        with self.admission().lease() as admission:
            admission.before_request()
            self.db.tmdb_daily_provider_list_leases.insert_one(dict(_id='run', expires_at=self.clock() + timedelta(minutes=1)))
            with self.assertRaisesRegex(detector.DetectorStopped, 'daily_list_active'):
                admission.before_request()
            self.db.tmdb_daily_provider_list_leases.delete_one({'_id': 'run'})
            self.clock.now = self.clock.now.replace(hour=12)
            with self.assertRaisesRegex(detector.DetectorStopped, 'window_closed'):
                admission.before_request()
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one()['requests'], 1)


if __name__ == '__main__':
    unittest.main()
