"""Shared provider persistence uses disposable Mongo; never calls TMDB."""
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
import sys
import os
import unittest
from urllib.parse import urlsplit
from uuid import uuid4
from unittest.mock import patch

import mongomock
from bson import BSON
from pymongo import MongoClient
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_api import provider_observations as observations
from f.tmdb_api.provider_evidence import snapshot_id, utc_ms


def payload(*ids, country='US'):
    return {'results': {country: {'flatrate': [{'provider_id': value} for value in ids]}}}


class ObservationTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = datetime(2026, 10, 22, 12)
        self.db.tmdb_movie_details.insert_one(dict(tmdb_id=42, updated_at=self.now - timedelta(days=20),
            is_selected=True, selected_at=self.now, lease_token='metadata-owner'))
        for country in ('US', 'DE'):
            self.db.tmdb_movie_providers.insert_one(dict(tmdb_id=42, country_code=country))

    def save(self, data, at=None, **kwargs):
        return observations.save_observation(self.db, 'movie', 42, data, at or self.now, **kwargs)

    def test_baseline_and_provider_only_fields(self):
        before = self.db.tmdb_movie_details.find_one()
        result = self.save(payload(8))
        self.assertEqual(result['changed_countries'], [])
        after = self.db.tmdb_movie_details.find_one()
        for field in ('updated_at', 'is_selected', 'selected_at', 'lease_token'):
            self.assertEqual(after[field], before[field])
        self.assertEqual(result['proof']['payload_hash'], snapshot_id(after['watch_providers']))
        self.assertFalse(self.db.tmdb_movie_providers.find_one({'country_code': 'US'}).get('provider_change_pending'))
        self.assertNotIn('previous_day', result['proof'])

    def test_membership_diff_ignores_names_order_and_links(self):
        self.save(payload(8, 9))
        data = payload(9, 8, 8)
        data['results']['US']['link'] = 'https://new-page'
        data['results']['US']['flatrate'][0]['provider_name'] = 'Renamed'
        self.assertEqual(self.save(data, self.now + timedelta(hours=1))['changed_countries'], [])
        data['results']['US']['rent'] = [{'provider_id': 2}]
        self.assertEqual(self.save(data, self.now + timedelta(hours=2))['changed_countries'], ['US'])

    def test_coalescing_retains_oldest_pending_age_and_only_matching_success_clears_it(self):
        from f.tmdb_web import country_state
        col = self.db.tmdb_movie_providers
        self.save(payload(8))
        first = self.now + timedelta(hours=1)
        self.save(payload(9), first)
        row = col.find_one({'country_code': 'US'})
        claimed = country_state.claim(self.db, col, row['_id'], now=first, availability_tier='changed')
        self.assertIsNotNone(claimed)
        self.save(payload(10), first + timedelta(minutes=1))
        pending = col.find_one({'_id': row['_id']})
        self.assertEqual(pending['provider_change_pending_since'], utc_ms(first))
        self.assertEqual(pending['provider_change_observed_at'], utc_ms(first + timedelta(minutes=1)))
        # A page for the older revision does not clear the newer work's age.
        self.assertTrue(country_state.save_success(col, claimed, [], first + timedelta(minutes=2)))
        self.assertTrue(col.find_one({'_id': row['_id']})['provider_change_pending'])
        newer = country_state.claim(self.db, col, row['_id'], now=first + timedelta(minutes=3), availability_tier='changed')
        self.assertIsNotNone(newer)
        self.assertTrue(country_state.save_success(col, newer, [], first + timedelta(minutes=4)))
        self.assertNotIn('provider_change_pending_since', col.find_one({'_id': row['_id']}))
        # The next distinct pending period starts its own age.
        self.save(payload(11), first + timedelta(hours=1))
        self.assertEqual(col.find_one({'_id': row['_id']})['provider_change_pending_since'],
                         utc_ms(first + timedelta(hours=1)))

    def test_stale_equal_and_invalid_do_not_refresh_evidence(self):
        saved = self.save(payload(8))
        self.assertEqual(self.save(payload(9), self.now - timedelta(seconds=1))['status'], 'stale')
        self.assertEqual(self.save(payload(9))['status'], 'stale')
        self.assertEqual(self.save(payload(8))['status'], 'reused')
        for bad in ({'id': 43, **payload(9)}, {}, {'results': {'US': {'mystery': []}}},
                    {'results': {}, 'total_pages': 2}, {'success': False, 'results': {}}):
            self.assertEqual(self.save(bad, self.now + timedelta(hours=1))['status'], 'invalid')
        self.assertEqual(observations.read_observation(self.db, 'movie', 42)['proof'], saved['proof'])

    def test_bson_int64_timestamps_remain_valid_ordered_provider_evidence(self):
        from f.tmdb_api.provider_evidence import api_excludes_older_web_offer
        self.save(payload(9))
        source = self.db.tmdb_movie_details.find_one()
        source = BSON.encode(source).decode()
        self.db.tmdb_movie_details.replace_one({'_id': source['_id']}, source)
        proof_at = source['watch_providers_check']['checked_at']
        self.assertIsNot(type(proof_at), int)  # Real BSON decoding yields Int64.
        self.assertIsNotNone(observations.read_observation(self.db, 'movie', 42))
        self.assertEqual(self.save(payload(9), proof_at)['status'], 'reused')
        self.assertEqual(self.save(payload(8), self.now - timedelta(seconds=1))['status'], 'stale')
        self.assertTrue(api_excludes_older_web_offer(source, 'US', 'flatrate', 8,
                                                    utc_ms(self.now - timedelta(seconds=1))))
        source['watch_providers_check']['checked_at'] = True
        self.assertIsNone(observations.observation(source))

    def test_omission_unknown_and_explicit_empty(self):
        self.save({'results': {'US': {'free': [{'provider_id': 8}]}, 'DE': {}}})
        de = self.db.tmdb_movie_providers.find_one({'country_code': 'DE'})
        self.assertTrue(de['provider_verified_empty'])
        changed = self.save({'results': {'US': {}}}, self.now + timedelta(hours=1))
        self.assertEqual(changed['changed_countries'], ['US'])
        self.assertFalse(self.db.tmdb_movie_providers.find_one({'country_code': 'DE'})['provider_verified_empty'])
        self.assertTrue(self.db.tmdb_movie_providers.find_one({'country_code': 'US'})['provider_verified_empty'])
        # Omitted DE has not been rechecked or marked as a provider change.
        self.assertEqual(self.db.tmdb_movie_providers.find_one({'country_code': 'DE'})['provider_observed_at'], self.now)
        self.assertFalse(self.db.tmdb_movie_providers.find_one({'country_code': 'DE'}).get('provider_change_pending'))

    def test_cached_empty_does_not_establish_verified_absence(self):
        self.save({'results': {'US': {}}}, cache_bypassed=False)
        self.assertFalse(self.db.tmdb_movie_providers.find_one({'country_code': 'US'})['provider_verified_empty'])

    def test_cas_loser_cannot_replace_newer_observation_or_proof(self):
        self.save(payload(8))
        collection = self.db.tmdb_movie_details
        original = collection.update_one
        raced = False
        def update(selector, changes, **kwargs):
            nonlocal raced
            if not raced and 'watch_providers_check' in changes.get('$set', {}):
                raced = True
                self.save(payload(10), self.now + timedelta(days=2))
            return original(selector, changes, **kwargs)
        with patch.object(collection, 'update_one', side_effect=update):
            result = self.save(payload(9), self.now + timedelta(days=1))
        self.assertEqual(result['status'], 'stale')
        current = observations.read_observation(self.db, 'movie', 42)
        self.assertEqual(current['payload']['results']['US']['flatrate'][0]['provider_id'], 10)
        self.assertEqual(current['proof']['previous_day']['checked_at'], utc_ms(self.now))

    def test_projection_retry_and_publication_ack_are_revision_fenced(self):
        self.save(payload(8))
        with patch.object(observations, 'propagate_pending', side_effect=RuntimeError('crash')):
            with self.assertRaises(RuntimeError):
                self.save(payload(9), self.now + timedelta(days=1))
        observations.propagate_pending(self.db, 'movie', 42)
        old_revision = self.db.tmdb_movie_providers.find_one({'country_code': 'US'})['provider_change_revision']
        self.db.tmdb_movie_providers.update_one({'country_code': 'US'}, {'$set': {'provider_change_pending': False}})
        observations.propagate_pending(self.db, 'movie', 42)
        self.assertFalse(self.db.tmdb_movie_providers.find_one({'country_code': 'US'})['provider_change_pending'])
        newer = self.save(payload(10), self.now + timedelta(days=2))
        self.assertFalse(observations.acknowledge_publication(self.db, 'movie', 42, old_revision))
        self.assertEqual(self.db.tmdb_movie_details.find_one()['watch_providers_publication_pending'], newer['revision'])
        self.assertTrue(observations.acknowledge_publication(self.db, 'movie', 42, newer['revision']))

    def test_uncached_proof_continuity_survives_cached_metadata(self):
        first = self.save(payload(8))
        cached = self.save(payload(8), self.now + timedelta(days=1), cache_bypassed=False)
        self.assertEqual(cached['proof']['last_uncached']['checked_at'], first['checked_at'])
        fresh = self.save(payload(9), self.now + timedelta(days=2))
        self.assertEqual(fresh['proof']['previous_day']['checked_at'], first['checked_at'])
        self.assertEqual(fresh['proof']['previous_day']['offers'], ['US:8:flatrate'])

    def test_shadow_and_preview_do_not_mutate_live_records(self):
        self.save(payload(8))
        before = deepcopy(self.db.tmdb_movie_details.find_one())
        countries = list(self.db.tmdb_movie_providers.find())
        self.save(payload(9), self.now + timedelta(days=1), dry_run=True)
        self.assertEqual(self.db.tmdb_movie_details.find_one(), before)
        shadow = self.save(payload(10), self.now + timedelta(days=2), shadow=True)
        self.assertEqual(shadow['changed_countries'], ['US'])
        after = self.db.tmdb_movie_details.find_one()
        isolated = after.pop('watch_providers_shadow')
        self.assertEqual(after, before)
        self.assertEqual(list(self.db.tmdb_movie_providers.find()), countries)
        self.assertEqual(observations.read_observation(self.db, 'movie', 42, shadow=True)['proof'], isolated['watch_providers_check'])
        self.assertEqual(observations.read_observation(self.db, 'movie', 42)['checked_at'], utc_ms(self.now))

    def test_deleted_preserves_payload_and_cannot_follow_newer_success(self):
        first = self.save(payload(8))
        self.assertEqual(observations.save_deleted_observation(self.db, 'movie', 42, self.now - timedelta(days=1))['status'], 'stale')
        self.assertEqual(observations.save_deleted_observation(self.db, 'movie', 42, self.now + timedelta(days=1))['status'], 'deleted')
        document = self.db.tmdb_movie_details.find_one()
        self.assertEqual(document['watch_providers_check'], first['proof'])
        self.assertEqual(document['updated_at'], self.now - timedelta(days=20))
        self.assertIsNone(observations.read_observation(self.db, 'movie', 42))
        self.assertEqual(self.save({'results': {}}, self.now + timedelta(days=2))['status'], 'missing')


    def test_old_failed_attempt_cannot_replace_newer_success_bookkeeping(self):
        self.save(payload(8))
        observations.record_attempt(self.db, 'movie', 42, self.now - timedelta(hours=1), 'old_failure')
        current = self.db.tmdb_movie_details.find_one()
        self.assertEqual(current['watch_providers_error'], '')
        self.assertEqual(current['watch_providers_attempted_at'], self.now)

    def test_corrupt_hash_is_not_reusable(self):
        self.save(payload(8))
        self.db.tmdb_movie_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers_check.payload_hash': 'corrupt'}})
        self.assertIsNone(observations.read_observation(self.db, 'movie', 42))


@unittest.skipUnless(os.environ.get('PROVIDER_TEST_MONGO_URI'), 'disposable loopback Mongo required')
class PendingAgeMongoTests(unittest.TestCase):
    def setUp(self):
        uri = os.environ['PROVIDER_TEST_MONGO_URI']
        if urlsplit(uri).hostname not in ('127.0.0.1', 'localhost', '::1'):
            raise ValueError('Only disposable loopback Mongo is allowed')
        self.client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        self.db = self.client['provider_pending_test_' + uuid4().hex]
        self.addCleanup(self.client.close)
        self.addCleanup(lambda: self.client.drop_database(self.db.name))
        self.now = datetime(2026, 10, 22, 12)
        self.db.tmdb_movie_details.insert_one(dict(tmdb_id=42))
        self.db.tmdb_movie_providers.insert_one(dict(tmdb_id=42, country_code='US'))

    save = ObservationTests.save
    test_atomic_coalescing_and_revision_fenced_completion = ObservationTests.test_coalescing_retains_oldest_pending_age_and_only_matching_success_clears_it


class MetadataRaceTests(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('provider_observation_test', host='mongodb://localhost', mongo_client_class=mongomock.MongoClient)

    def tearDown(self):
        disconnect()

    def test_metadata_full_document_cannot_replace_provider_winner(self):
        from f.tmdb_api.models import TmdbMovieDetails
        with patch('wmill.get_variable', return_value='unused'):
            from f.tmdb_api.tmdb_fetch_details_from_api import fetch
        import asyncio
        entry = TmdbMovieDetails(tmdb_id=42, title='Old', updated_at=datetime(2026, 10, 1)).save()
        db = entry._get_db()
        now = datetime(2026, 10, 22)
        observations.save_observation(db, 'movie', 42, payload(8), now)
        loaded = TmdbMovieDetails.objects.get(tmdb_id=42)
        # The metadata request finishes first; its save runs after another API writer.
        loaded._provider_observed_at = now + timedelta(hours=1)
        latest = observations.save_observation(db, 'movie', 42, payload(10), now + timedelta(hours=2))
        db.tmdb_movie_details.update_one({'tmdb_id': 42}, {'$set': {'provider_detector_registered': True}})
        with patch('builtins.print'):
            asyncio.run(fetch.convert_and_save_details(loaded, {'id': 42, 'title': 'New', 'watch/providers': payload(9)}, bypass_cache=True))
        result = db.tmdb_movie_details.find_one({'tmdb_id': 42})
        self.assertEqual(result['title'], 'New')
        self.assertEqual(result['watch_providers_check'], latest['proof'])
        self.assertEqual(result['watch_providers'], latest['payload'])
        self.assertTrue(result['provider_detector_registered'])


    def test_slow_metadata_success_cannot_resurrect_newer_api_deletion(self):
        from f.tmdb_api.models import TmdbMovieDetails
        with patch('wmill.get_variable', return_value='unused'):
            from f.tmdb_api.tmdb_fetch_details_from_api import fetch
        import asyncio
        entry = TmdbMovieDetails(tmdb_id=42, title='Old').save()
        db = entry._get_db()
        now = datetime(2026, 10, 22)
        observations.save_observation(db, 'movie', 42, payload(8), now)
        loaded = TmdbMovieDetails.objects.get(tmdb_id=42)
        loaded._provider_observed_at = now + timedelta(hours=1)
        observations.save_deleted_observation(db, 'movie', 42, now + timedelta(hours=2))
        with patch('builtins.print'):
            asyncio.run(fetch.convert_and_save_details(loaded, {'id': 42, 'title': 'New', 'watch/providers': payload(9)}, bypass_cache=True))
        self.assertTrue(db.tmdb_movie_details.find_one({'tmdb_id': 42})['tmdb_deleted'])


class ListReuseTests(unittest.TestCase):
    setUp = ObservationTests.setUp
    save = ObservationTests.save

    def test_shared_same_day_reuse_keeps_actual_time_and_conflict_recheck(self):
        from f.tmdb_api.daily_provider_lists import TitleChecks
        from unittest.mock import Mock
        self.save(payload(8))
        client = Mock()
        client.get.return_value = {'id': 42, **payload(9)}
        later = self.now + timedelta(hours=1)
        with TitleChecks(client, lambda: later, self.db, dry_run=False) as reads:
            result = reads.read('movie', [42], 'US', 8, {42}, utc_ms(later))[0]
            self.assertEqual(result[2]['checked_at'], utc_ms(self.now))
            client.get.assert_not_called()
            # A list read after the shared check contradicts it: bypass the cache.
            result = reads.read('movie', [42], 'US', 8, set(), utc_ms(later))[0]
            self.assertEqual(result[2]['checked_at'], utc_ms(later))
            client.get.assert_called_once()
        self.assertEqual(observations.read_observation(self.db, 'movie', 42)['proof'], result[2])

    def test_cached_or_yesterdays_shared_observation_cannot_replace_list_check(self):
        from f.tmdb_api.daily_provider_lists import TitleChecks
        from unittest.mock import Mock
        self.save(payload(8), cache_bypassed=False)
        client = Mock()
        client.get.return_value = {'id': 42, **payload(8)}
        later = self.now + timedelta(days=1)
        with TitleChecks(client, lambda: later, self.db, dry_run=False) as reads:
            result = reads.read('movie', [42], 'US', 8, {42}, utc_ms(later))[0]
        client.get.assert_called_once()
        self.assertEqual(result[2]['checked_at'], utc_ms(later))


class RequestAdmissionTests(unittest.TestCase):
    def test_hook_charges_every_retry_before_wire(self):
        from f.tmdb_api import daily_provider_lists as job
        from unittest.mock import Mock
        import itertools
        refused, success = Mock(status_code=500), Mock(status_code=200)
        success.json.return_value = {'id': 42, **payload(8)}
        session, admitted = Mock(), Mock()
        session.get.side_effect = [refused, success]
        ticks = itertools.count()
        with patch('wmill.get_variable', return_value='unused'), patch('requests.Session', return_value=session), \
             patch.object(job.time, 'monotonic', side_effect=lambda: next(ticks)):
            client = job.TMDBClient(before_request=admitted)
            client.get('/movie/42/watch/providers')
        self.assertEqual(admitted.call_count, 2)
        self.assertEqual(session.get.call_count, 2)
        self.assertEqual(client.stats['retries'], 1)

    def test_rejected_admission_makes_no_wire_request(self):
        from f.tmdb_api import daily_provider_lists as job
        from unittest.mock import Mock
        session = Mock()
        with patch('wmill.get_variable', return_value='unused'), patch('requests.Session', return_value=session):
            client = job.TMDBClient(before_request=Mock(side_effect=job.RequestBudgetExceeded('shared limit')))
            with self.assertRaises(job.RequestBudgetExceeded):
                client.get('/movie/42/watch/providers')
        session.get.assert_not_called()


if __name__ == '__main__':
    unittest.main()
