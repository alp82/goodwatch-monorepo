"""Network round trips and concurrency at the actual drain/publication boundary."""
import sys
import threading
import time
import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path[:0] = [str(Path(__file__).parent), str(Path(__file__).parents[1] / 'windmill')]
import test_list_offer_refresh as fixtures
from f.sync.copy import vector_data
from f.sync.copy import tmdb_streaming
from f.tmdb_api import list_offer_refresh as refresh
from f.tmdb_api import daily_provider_lists as daily

BUILD_PAYLOAD = vector_data._build_payload


class ConcurrentDrainTests(unittest.TestCase):
    def test_provider_latency_overlaps_with_a_bounded_number_of_workers(self):
        fixture = fixtures.RefreshTests()
        fixture.setUp()
        fixture.seed_work(40)
        get = fixture.api.get
        lock = threading.Lock()
        active = peak = 0

        def delayed(path):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            try:
                time.sleep(.02)
                return get(path)
            finally:
                with lock:
                    active -= 1

        fixture.api.get = delayed
        result = fixture.drain()
        self.assertEqual(result['published'], 40)
        self.assertEqual(len(fixture.api.calls), 40)
        self.assertGreater(peak, 1, 'The drain must overlap provider HTTP latency')
        self.assertLessEqual(peak, 6)

    def test_parallel_preparation_cannot_overspend_the_shared_http_budget(self):
        fixture = fixtures.RefreshTests()
        fixture.setUp()
        fixture.seed_work(40)
        session = Mock()
        def response(url, **kwargs):
            tmdb_id = int(url.split('/')[-3])
            return Mock(status_code=200, json=lambda: {'id': tmdb_id, 'results': {}})
        session.get.side_effect = response
        with patch('wmill.get_variable', return_value='test-key'), patch('requests.Session', return_value=session):
            fixture.api = daily.TMDBClient(requests_per_second=20, max_requests=5)
            with self.assertRaises(daily.RequestBudgetExceeded):
                fixture.drain()
        self.assertEqual(fixture.api.stats['requests'], 5)
        self.assertEqual(session.get.call_count, 5)
        fixture.publish.assert_not_called()
        self.assertEqual(fixture.db.tmdb_list_offer_refresh.count_documents({'pending': True}), 40)

    def test_one_bad_response_does_not_discard_other_completed_titles(self):
        fixture = fixtures.RefreshTests()
        fixture.setUp()
        fixture.seed_work(20)
        get = fixture.api.get
        fixture.api.get = lambda path: {'id': -1, 'results': {}} if path == '/movie/11/watch/providers' else get(path)
        result = fixture.drain()
        self.assertEqual((result['published'], result['failed'], result['remaining']), (19, 1, 1))
        self.assertEqual(result['failures'][0]['identity'], 'movie:11')

    def test_batch_acknowledgment_keeps_each_intents_version_fence(self):
        fixture = fixtures.RefreshTests()
        fixture.setUp()
        fixture.seed_work(20)
        fixture.publish.side_effect = lambda *args: refresh.enqueue(
            fixture.db, 'movie', 1, {'DE_8': refresh.utc_ms(fixture.now)})
        with patch.object(fixture.db.tmdb_list_offer_refresh, 'update_many',
                          wraps=fixture.db.tmdb_list_offer_refresh.update_many) as acknowledge:
            result = fixture.drain()
        self.assertEqual(acknowledge.call_count, 1)
        # The new version created during publication must survive the group ack.
        self.assertTrue(fixture.db.tmdb_list_offer_refresh.find_one({'_id': 'movie:1'})['pending'])
        self.assertEqual(result['remaining'], 1)

    def test_streaming_source_reads_overlap_crate_reads_without_sharing_its_cursor(self):
        fixture = fixtures.RefreshTests()
        fixture.setUp()
        fixture.seed_work(20)
        fixture.api.results = {'DE': {'flatrate': [{'provider_id': 8}]}}
        from test_availability_history import HistoryCrate
        started, release = threading.Event(), threading.Event()
        source_read = tmdb_streaming.fetch_all_documents_in_batch
        caller = threading.get_ident()
        class Crate(HistoryCrate):
            def select(self, sql, params=None):
                self_test.assertEqual(threading.get_ident(), caller)
                if sql.startswith('SELECT tmdb_id FROM'):
                    return [{'tmdb_id': tmdb_id} for tmdb_id in params[0]]
                if 'FROM streaming_availability' in sql:
                    self_test.assertTrue(started.wait(1))
                    self_test.assertFalse(release.is_set())
                    release.set()
                return super().select(sql, params)
        self_test = self
        def providers(*args):
            started.set()
            if not release.wait(2):
                raise AssertionError('Mongo and Crate reads were serialized')
            return source_read(*args)
        with patch.object(tmdb_streaming, 'get_db', return_value=fixture.db), \
             patch.object(tmdb_streaming, 'fetch_all_documents_in_batch', side_effect=providers), \
             patch.object(vector_data, 'copy_to_qdrant'), patch('f.db.qdrant.QdrantConnector'):
            result = refresh.drain(fixture.api, fixture.db, Crate(), dry_run=False)
        self.assertEqual((result['published'], result['failed']), (20, 0))


class VectorLeaseTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.ids = list(range(1, 21))
        self.db.tmdb_movie_details.insert_many([{'tmdb_id': i} for i in self.ids])
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        for name, value in (
            ('get_db', self.db), ('_driver_batches', [self.ids]),
            ('_collection_vector_names', set()), ('flagged_among', set()),
            ('flag_spike', False), ('flagged_oldest_first', []),
            ('delete_titles_from_qdrant', 0),
            ('_published_streaming', {i: ['8_DE'] for i in self.ids}),
        ):
            self.stack.enter_context(patch.object(vector_data, name, return_value=value))
        self.stack.enter_context(patch.object(vector_data.TmdbMovieDetails, '_get_collection',
                                              return_value=self.db.tmdb_movie_details))
        self.stack.enter_context(patch.object(vector_data, '_build_payload',
            side_effect=lambda **kw: ({'tmdb_id': kw['tmdb_id']}, {'fingerprint_v1': [.1]})))
        self.write = self.stack.enter_context(patch.object(vector_data, 'write_with_retry',
            side_effect=lambda client, collection, operations, owned: (
                owned(), dict(attempts=1, retries=0, errors={}))[1]))

    def copy(self, strict=True, delete_flagged=True, defer_busy=False):
        return vector_data.copy_to_qdrant(Mock(), 'movie', {'tmdb_id': {'$in': self.ids}},
                                         recent_only=False, strict_writes=strict,
                                         delete_flagged=delete_flagged, defer_busy=defer_busy)

    def test_one_group_ownership_check_replaces_per_title_round_trips(self):
        with patch.object(self.db.provider_identity_maintenance, 'find_one',
                          wraps=self.db.provider_identity_maintenance.find_one) as maintenance:
            result = self.copy()
        self.assertEqual(result['upserts'], 20)
        self.assertLessEqual(maintenance.call_count, 10)
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_busy_title_prevents_strict_publication_and_releases_only_our_leases(self):
        self.db.streaming_publication_leases.insert_one(dict(
            _id='movie:20', token='other', expires_at=datetime.utcnow() + timedelta(minutes=15)))
        with self.assertRaisesRegex(RuntimeError, '[Bb]usy'):
            self.copy()
        self.write.assert_not_called()
        self.assertEqual(list(self.db.streaming_publication_leases.find({}, {'_id': 1})), [{'_id': 'movie:20'}])

    def test_offer_refresh_drops_only_busy_vector_ids_and_publishes_the_others(self):
        self.db.streaming_publication_leases.insert_one(dict(
            _id='movie:20', token='other', expires_at=datetime.utcnow() + timedelta(minutes=15)))
        result = self.copy(defer_busy=True)
        self.assertEqual(result['upserts'], 19)
        self.assertEqual(result['busy_ids'], [20])
        ids = [p.payload['tmdb_id'] for p in self.write.call_args.args[2][0].upsert.points]
        self.assertEqual(ids, list(range(1, 20)))
        self.assertEqual(self.db.streaming_publication_leases.find_one({'_id': 'movie:20'})['token'], 'other')
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 1)

    def test_busy_vector_title_remains_pending_after_the_full_drain_handoff(self):
        now = datetime.utcnow()
        for tmdb_id in self.ids:
            refresh.enqueue(self.db, 'movie', tmdb_id, {'DE_8': refresh.utc_ms(now)})
        self.db.streaming_publication_leases.insert_one(dict(
            _id='movie:20', token='other', expires_at=now + timedelta(minutes=15)))
        publication = {'titles': {str(i): dict(provider_state='present', streaming_availability=['8_DE'])
                                  for i in self.ids}}
        crate = Mock()
        crate.select.return_value = [{'tmdb_id': i} for i in self.ids]
        with patch.object(tmdb_streaming, 'copy_media', return_value={'publication': publication}), \
             patch('f.db.qdrant.QdrantConnector'):
            result = refresh.drain(fixtures.API(), self.db, crate, dry_run=False)
        self.assertEqual((result['published'], result['failed'], result['deferred'], result['remaining']), (19, 0, 1, 1))
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one({'_id': 'movie:20'})['pending'])
        self.assertEqual(self.db.tmdb_list_offer_refresh.count_documents({'pending': False}), 19)

    def test_replaced_lease_fences_vector_writes_and_cleanup(self):
        def replace(*args):
            self.db.streaming_publication_leases.update_one({'_id': 'movie:1'}, {'$set': {'token': 'new'}})
            return {i: ['8_DE'] for i in self.ids}
        with patch.object(vector_data, '_published_streaming', side_effect=replace):
            with self.assertRaisesRegex(RuntimeError, 'lease lost'):
                self.copy()
        self.assertEqual(self.db.streaming_publication_leases.find_one({'_id': 'movie:1'})['token'], 'new')
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 1)

    def test_offers_only_skips_global_delete_scan_but_still_excludes_flagged_titles(self):
        with patch.object(vector_data, 'flag_spike', side_effect=AssertionError('Global deletion scan')), \
             patch.object(vector_data, 'flagged_among', return_value={1}):
            result = self.copy(delete_flagged=False)
        self.assertEqual(result['upserts'], 19)
        self.assertEqual(result['deleted_titles'], {'skipped': True, 'reason': 'offers_only'})
        ids = [p.payload['tmdb_id'] for p in self.write.call_args.args[2][0].upsert.points]
        self.assertNotIn(1, ids)

    def test_targeted_projection_preserves_every_written_payload_and_vector(self):
        from test_vector_fingerprint_source import SCORES
        self.db.tmdb_movie_details.update_many({}, {'$set': {
            'title': 'Fixture', 'original_title': 'Original', 'poster_path': '/poster', 'backdrop_path': '/backdrop',
            'release_date': '2020-01-02', 'first_air_date': '2021-01-02', 'genres': [{'name': 'Drama'}],
            'vote_count': 22, 'vote_average': 7.2, 'credits': {'irrelevant': 'x' * 10000},
            'watch_providers': {'results': {'US': {'link': 'tmdb', 'flatrate': [{'provider_id': 8}]}}}}})
        for tmdb_id in self.ids:
            self.db.dna_movie.insert_one(dict(tmdb_id=tmdb_id, vector_fingerprint=[.1], dna={
                'fingerprint': {'scores': SCORES}, 'social_suitability': {'family': 3},
                'viewing_context': {'is_binge_friendly': 4}, 'is_anime': True,
                'production_info': {'method': 'animation'}, 'unused_prose': 'x' * 10000}))
            self.db.tv_tropes_movie_tags.insert_one(dict(tmdb_id=tmdb_id, tropes=[{'name': 'Trope', 'unused': 'prose'}]))
            for name in ('imdb_movie_rating', 'metacritic_movie_rating', 'rotten_tomatoes_movie_rating'):
                self.db[name].insert_one(dict(tmdb_id=tmdb_id, user_score_normalized_percent=80,
                    meta_score_normalized_percent=70, audience_score_normalized_percent=90,
                    tomato_score_normalized_percent=60, user_score_vote_count=10, meta_score_vote_count=11,
                    audience_score_vote_count=12, tomato_score_vote_count=13, unused='x' * 10000))
        written = []
        def write(client, collection, operations, owned):
            owned()
            written.append([p.model_dump() for p in operations[0].upsert.points])
            return dict(attempts=1, retries=0, errors={})
        self.write.side_effect = write
        with patch.object(vector_data, '_build_payload', side_effect=BUILD_PAYLOAD):
            self.copy(strict=False)
            with patch.object(self.db.tmdb_movie_providers, 'find', side_effect=AssertionError('Unused provider download')):
                self.copy(strict=True)
        self.assertEqual(written[0], written[1])
        self.assertTrue(all(p['payload']['streaming_availability'] == ['8_DE'] for p in written[1]))


if __name__ == '__main__':
    unittest.main()
