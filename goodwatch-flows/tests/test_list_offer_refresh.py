"""List handoff failure recovery and real shared-publisher reconciliation."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_api import list_offer_refresh as refresh
from f.tmdb_api.daily_provider_lists import RequestBudgetExceeded
from f.tmdb_api.provider_evidence import capture_provider_check, utc_ms, list_scope_excludes
from test_streaming_publication import load_copy, Crate, availability
from f.sync.availability_history import HistoryTitle, ListRead, OfferKey, Stay
from test_availability_history import HistoryCrate
from test_streaming_publication import key as availability_key_tuple
from f.tmdb_api.daily_list_storage import ListStorage

spec = importlib.util.spec_from_file_location('backfill_list_title_offers',
    Path(__file__).parents[1] / 'scripts/backfill_list_title_offers.py')
backfill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backfill)


class API:
    def __init__(self, results=None):
        self.results, self.calls = results or {}, []
        self.stats = dict(requests=0)

    def get(self, path):
        self.calls.append(path)
        self.stats['requests'] += 1
        return {'id': int(path.split('/')[2]), 'results': deepcopy(self.results)}


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = datetime.now(timezone.utc)
        self.old = self.now - timedelta(days=1)
        self.db.tmdb_movie_details.insert_one({'tmdb_id': 42, 'updated_at': self.old,
                                              'is_selected': True})
        self.crate = Mock()
        self.crate.select.return_value = [{'tmdb_id': 42}]
        self.api, self.publish = API(), Mock(return_value={})

    def enqueue(self, scopes=None):
        refresh.enqueue(self.db, 'movie', 42, scopes or {'DE_8': utc_ms(self.old)})

    def seed_work(self, count):
        self.db.tmdb_movie_details.delete_many({})
        self.db.tmdb_movie_details.insert_many([dict(tmdb_id=i, updated_at=self.old) for i in range(1, count + 1)])
        for tmdb_id in range(1, count + 1):
            refresh.enqueue(self.db, 'movie', tmdb_id, {'DE_8': utc_ms(self.old)})
        self.crate.select.return_value = [{'tmdb_id': i} for i in range(1, count + 1)]

    def drain(self, **kwargs):
        return refresh.drain(self.api, self.db, self.crate, dry_run=False,
                             publish=self.publish, clock=lambda: self.now, **kwargs)

    def test_many_countries_and_services_get_one_refetch_and_publication(self):
        self.enqueue()
        self.enqueue({'US_8': utc_ms(self.old), 'DE_9': utc_ms(self.old)})
        result = self.drain()
        self.assertEqual(result['published'], 1)
        self.assertEqual(self.api.calls, ['/movie/42/watch/providers'])
        self.publish.assert_called_once_with(self.crate, 'movie', [42])
        source = self.db.tmdb_movie_details.find_one({'tmdb_id': 42})
        from f.tmdb_api.models import TmdbMovieDetails
        # The next regular crawler must be able to load the strict document.
        TmdbMovieDetails._from_son(source)
        self.assertNotIn('id', source['watch_providers'])
        self.assertEqual(len(source['watch_providers_list_scopes']), 3)
        # Offers-only fetching must not satisfy or take over the details queue.
        self.assertEqual(source['updated_at'], self.old.replace(tzinfo=None, microsecond=self.old.microsecond // 1000 * 1000))
        self.assertTrue(source['is_selected'])
        self.assertEqual(result['remaining'], 0)

    def test_dry_run_has_no_network_publication_or_mongo_writes(self):
        self.enqueue()
        before = list(self.db.tmdb_list_offer_refresh.find())
        result = refresh.drain(None, self.db, self.crate)
        self.assertEqual(result['selected'], 1)
        self.assertEqual(before, list(self.db.tmdb_list_offer_refresh.find()))
        self.assertFalse(self.crate.select.called)
        self.assertEqual(self.api.calls, [])
        refresh.drain(None, self.db, self.crate, dry_run=None)
        self.assertEqual(before, list(self.db.tmdb_list_offer_refresh.find()))

    def test_fresh_offer_preview_uses_the_shared_transformations_without_any_write(self):
        class PreviewCrate(HistoryCrate):
            def select(self, sql, params=None):
                if sql.startswith('SELECT tmdb_id FROM'):
                    return [{'tmdb_id': tmdb_id} for tmdb_id in
                            (params[0] if isinstance(params[0], list) else [params[0]])]
                return super().select(sql, params)
        crate = PreviewCrate()
        self.enqueue()
        self.api.results = {'DE': {'link': 'https://tmdb/de', 'flatrate': [{'provider_id': 8, 'display_priority': 1}]}}
        source_before = self.db.tmdb_movie_details.find_one()
        queue_before = list(self.db.tmdb_list_offer_refresh.find())
        result = refresh.preview_pending(self.api, self.db, crate, clock=lambda: self.now)
        self.assertEqual(result['failed'], 0)
        self.assertEqual(result['plans'][0]['aggregate']['streaming_availabilities'], ['DE_8'])
        self.assertEqual(result['plans'][0]['offers_upsert'][0]['streaming_service_id'], 8)
        self.assertEqual(result['plans'][0]['history_upsert'][0]['country_code'], 'DE')
        self.assertEqual(result['plans'][0]['vector_streaming_availability'], ['8_DE'])
        self.assertEqual(self.db.tmdb_movie_details.find_one(), source_before)
        self.assertEqual(list(self.db.tmdb_list_offer_refresh.find()), queue_before)
        self.assertEqual(crate.writes, [])
        self.assertEqual(result['requests']['requests'], 1)

    def test_publication_failure_and_newer_enqueues_remain_pending(self):
        self.enqueue()
        self.publish.side_effect = RuntimeError('private upstream failure')
        result = self.drain()
        self.assertEqual((result['failed'], result['remaining']), (1, 1))
        self.assertNotIn('private', str(result))
        self.publish.side_effect = lambda *args: self.enqueue({'GB_8': utc_ms(self.now)})
        result = self.drain()
        self.assertEqual(result['remaining'], 1)
        self.publish.side_effect = None
        self.assertEqual(self.drain()['remaining'], 0)

    def test_hard_budget_propagates_without_acknowledging(self):
        self.enqueue()
        self.api.get = Mock(side_effect=RequestBudgetExceeded('limit'))
        with self.assertRaises(RequestBudgetExceeded):
            self.drain()
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one()['pending'])
        self.publish.assert_not_called()

    def test_runtime_budget_preserves_pending_work_before_the_flow_timeout(self):
        self.enqueue()
        result = self.drain(max_seconds=0)
        self.assertEqual(result['deferred_reason'], 'runtime_budget')
        self.assertEqual(result['remaining'], 1)
        self.assertEqual(self.api.calls, [])

    def test_publication_outage_stops_after_twenty_requests_and_never_reselects_failures(self):
        self.seed_work(100)
        self.publish.side_effect = RuntimeError('Qdrant unavailable')
        result = self.drain()
        self.assertEqual((result['selected'], result['failed'], result['published']), (20, 20, 0))
        self.assertEqual(result['deferred_reason'], 'consecutive_failures')
        self.assertEqual(len(self.api.calls), 20)
        self.assertEqual(result['remaining'], 100)
        self.assertEqual(self.db.tmdb_list_offer_refresh.count_documents({'failure_day': {'$exists': True}}), 20)
        self.assertIn([('pending', 1), *refresh.QUEUE_SORT],
                      [index['key'] for index in self.db.tmdb_list_offer_refresh.index_information().values()])

    def test_source_outage_stops_before_spending_requests_on_the_entire_queue(self):
        self.seed_work(100)
        self.db.tmdb_movie_details.delete_many({})
        result = self.drain()
        self.assertEqual((result['selected'], result['failed']), (20, 20))
        self.assertEqual(self.api.calls, [])
        self.publish.assert_not_called()

    def test_failure_stop_budget_carries_across_publication_batches(self):
        self.seed_work(100)
        calls = []
        def publish(connector, media, ids):
            calls.append(ids)
            if len(calls) == 1:
                return {ids[-1]: 'history_publication_failed'}
            raise RuntimeError('Qdrant unavailable')
        self.publish.side_effect = publish
        result = self.drain()
        self.assertEqual([len(ids) for ids in calls], [20, 19])
        self.assertEqual((result['published'], result['failed'], len(self.api.calls)), (19, 20, 39))
        self.assertEqual(result['deferred_reason'], 'consecutive_failures')

    def test_individual_history_failure_does_not_prevent_acknowledging_the_rest_of_the_batch(self):
        self.seed_work(20)
        self.publish.return_value = {3: 'history_publication_failed'}
        result = self.drain()
        self.assertEqual((result['published'], result['failed'], result['remaining']), (19, 1, 1))
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one({'_id': 'movie:3'})['pending'])

    def test_batch_publisher_vectors_only_successful_streaming_titles(self):
        from f.sync.copy import tmdb_streaming, vector_data
        from f.db import qdrant
        publication = dict(history_errors={2: 'fixture'}, titles={
            '1': dict(provider_state='present', streaming_availability=['8_DE']),
            '2': dict(provider_state='present', streaming_availability=[]),
            '3': dict(provider_state='quarantined', streaming_availability=None),
        })
        with patch.object(tmdb_streaming, 'copy_media', return_value={'publication': publication}) as copy, \
             patch.object(vector_data, 'copy_to_qdrant') as vectors, patch.object(qdrant, 'QdrantConnector'):
            failed = refresh.publish_offers(self.crate, 'movie', [1, 2, 3, 4])
        self.assertEqual(set(failed), {2, 3, 4})
        self.assertEqual(vectors.call_args.args[2], {'tmdb_id': {'$in': [1]}})
        self.assertTrue(vectors.call_args.kwargs['strict_writes'])
        self.assertFalse(vectors.call_args.kwargs['delete_flagged'])
        self.assertTrue(copy.call_args.kwargs['targeted_batch'])

    def test_remaining_time_is_checked_again_before_a_prepared_batch_is_published(self):
        self.enqueue()
        with patch.object(refresh.time, 'monotonic', side_effect=[0, 0, 0, 2, 2]):
            result = self.drain(max_seconds=1)
        self.assertEqual(result['remaining'], 1)
        self.assertEqual(result['deferred_reason'], 'runtime_budget')
        self.publish.assert_not_called()

    def test_1000_titles_share_index_catalog_and_vector_setup(self):
        from f.sync.copy import tmdb_streaming, vector_data
        from f.db import qdrant
        class RecordingCrate(HistoryCrate):
            def __init__(self):
                super().__init__()
                self.selects = []
            def select(self, sql, params=None):
                self.selects.append(sql)
                if sql.startswith('SELECT tmdb_id FROM'):
                    return [{'tmdb_id': tmdb_id} for tmdb_id in params[0]]
                return super().select(sql, params)
        self.seed_work(1000)
        self.api.results = {'DE': {'link': 'https://tmdb/de', 'flatrate': [{'provider_id': 8, 'display_priority': 1}]}}
        crate = RecordingCrate()
        with patch.object(tmdb_streaming, 'get_db', return_value=self.db), \
             patch.object(self.db.tmdb_movie_details, 'create_index', wraps=self.db.tmdb_movie_details.create_index) as details_index, \
             patch.object(self.db.tmdb_movie_providers, 'create_index', wraps=self.db.tmdb_movie_providers.create_index) as providers_index, \
             patch.object(vector_data, 'copy_to_qdrant') as vectors, patch.object(qdrant, 'QdrantConnector'), \
             patch('builtins.print'):
            result = refresh.drain(self.api, self.db, crate, dry_run=False, clock=lambda: self.now)
        self.assertEqual(result['published'], 1000)
        self.assertEqual(result['publication_batches'], 50)
        self.assertEqual((details_index.call_count, providers_index.call_count, vectors.call_count), (50, 150, 50))
        self.assertEqual(sum('FROM streaming_service' in sql for sql in crate.selects), 50)
        self.assertEqual(sum('FROM streaming_availability' in sql for sql in crate.selects), 50)
        self.assertEqual(len(crate.media), 1000)
        self.assertEqual(len(self.api.calls), 1000)
        print(json.dumps(dict(benchmark='1000_titles_actual_copier_in_memory_io', **result)), flush=True)

    def test_movie_and_show_ids_stay_distinct(self):
        self.enqueue()
        refresh.enqueue(self.db, 'show', 42, {'DE_8': utc_ms(self.old)})
        self.db.tmdb_tv_details.insert_one({'tmdb_id': 42, 'updated_at': self.old})
        result = self.drain()
        self.assertEqual(result['published'], 2)
        self.assertEqual(set(self.api.calls), {'/movie/42/watch/providers', '/tv/42/watch/providers'})

    def test_missing_or_deleted_source_is_retained_for_full_ingestion(self):
        self.enqueue()
        self.db.tmdb_movie_details.delete_many({})
        result = self.drain()
        self.assertEqual(result['failed'], 1)
        self.assertEqual(result['remaining'], 1)
        self.assertEqual(self.api.calls, [])

    def test_duplicate_details_are_deferred_without_an_arbitrary_source_update(self):
        self.enqueue()
        self.db.tmdb_movie_details.insert_one({'tmdb_id': 42})
        result = self.drain()
        self.assertEqual(result['failures'][0]['reason'], 'duplicate_details_identity')
        self.assertEqual(self.api.calls, [])

    def test_daily_work_precedes_backfill_and_lease_loss_is_not_swallowed(self):
        refresh.enqueue(self.db, 'movie', 1, {'DE_8': utc_ms(self.old)})
        refresh.enqueue(self.db, 'movie', 42, {'DE_8': utc_ms(self.old)}, priority=1)
        self.drain(limit=1)
        self.assertEqual(self.api.calls, ['/movie/42/watch/providers'])
        self.enqueue()
        from f.tmdb_api.daily_list_storage import LeaseLost
        self.publish.side_effect = LeaseLost('fixture')
        with self.assertRaises(LeaseLost):
            self.drain()
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one({'_id': 'movie:42'})['pending'])

    def test_intent_precedes_history_and_survives_its_failure(self):
        payload = dict(id=42, results={'DE': {'flatrate': [dict(provider_id=8)]}})
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42, self.now, bypass_cache=True)
        key = OfferKey(42, 'movie', 'DE', 8, 'flatrate')
        title = HistoryTitle(42, dict(watch_providers=payload, watch_providers_check=proof),
                             {key: key._asdict()}, {}, [], [], ListRead('DE', 8, utc_ms(self.now)))
        self.crate.select.return_value = []
        store = ListStorage(db=self.db, connector=self.crate, dry_run=False)
        store.publish('movie', title, lambda: None)
        with patch('f.tmdb_api.daily_list_storage.publish_history', side_effect=RuntimeError('failure')):
            with self.assertRaises(RuntimeError):
                store.flush()
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one()['pending'])
        self.assertEqual(self.db.tmdb_daily_provider_lists.count_documents({}), 0)

    def test_only_unchanged_matching_offers_skip_a_refetch(self):
        payload = dict(id=42, results={'DE': {'flatrate': [dict(provider_id=8)]}})
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42, self.now, bypass_cache=True)
        key = OfferKey(42, 'movie', 'DE', 8, 'flatrate')
        title = HistoryTitle(42, dict(watch_providers=payload, watch_providers_check=proof),
                             {key: key._asdict()}, {}, [], [], ListRead('DE', 8, utc_ms(self.now),
                                                                       previous_offers=('flatrate',), previous_present=True))
        self.crate.select.side_effect = [[dict(media_tmdb_id=42, streaming_type='flatrate')],
            [dict(tmdb_id=42, has_offer=True, has_country=True, has_service=True)]]
        self.assertEqual(refresh.enqueue_list_mismatches(self.db, self.crate, 'movie', [title]), [])
        self.assertEqual(self.db.tmdb_list_offer_refresh.count_documents({}), 0)
        title.list_read.previous_offers = ()
        title.list_read.previous_present = False
        title.list_read.previous_at = utc_ms(self.old)
        self.crate.select.side_effect = [[dict(media_tmdb_id=42, streaming_type='flatrate')],
            [dict(tmdb_id=42, has_offer=True, has_country=True, has_service=True)]]
        self.assertEqual(len(refresh.enqueue_list_mismatches(self.db, self.crate, 'movie', [title])), 1)
        self.assertTrue(self.db.tmdb_list_offer_refresh.find_one()['pending'])

    def test_matching_baseline_members_are_not_queued_but_real_mismatches_are(self):
        key = OfferKey(42, 'movie', 'DE', 8, 'flatrate')
        title = HistoryTitle(42, dict(watch_providers_check={'checked_at': utc_ms(self.now)}),
                             {key: key._asdict()}, {}, [], [], ListRead('DE', 8, utc_ms(self.now)))
        self.crate.select.side_effect = [[dict(media_tmdb_id=42, streaming_type='flatrate')],
            [dict(tmdb_id=42, has_offer=True, has_country=True, has_service=True)]]
        self.assertEqual(refresh.enqueue_list_mismatches(self.db, self.crate, 'movie', [title]), [])
        self.crate.select.side_effect = [[], [dict(tmdb_id=42, has_offer=False, has_country=False, has_service=False)]]
        self.assertEqual(len(refresh.enqueue_list_mismatches(self.db, self.crate, 'movie', [title])), 1)


class ListScopePublicationTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = datetime.now(timezone.utc)
        payload = {'id': 42, 'results': {'US': {'link': 'https://tmdb/us', 'flatrate': [{'provider_id': 8}]}}}
        self.details = dict(tmdb_id=42, updated_at=self.now, watch_providers=payload,
            watch_providers_check=capture_provider_check({'id': 42, 'watch/providers': payload}, 42, self.now, bypass_cache=True),
            watch_providers_list_scopes={'DE_8': dict(checked_at=utc_ms(self.now), kinds=[])})
        self.db.tmdb_tv_details.insert_one(deepcopy(self.details))
        self.copy = load_copy(self.db)

    def test_absent_country_removes_scoped_api_scraped_and_legacy_offers_only(self):
        self.db.tmdb_tv_providers.insert_one(dict(tmdb_id=42, country_code='DE',
            updated_at=self.now - timedelta(days=1), streaming_links=[dict(
                provider_name='Netflix', stream_type='flatrate', stream_url='https://old')]))
        crate = Crate([
            availability('DE'), availability('DE', streaming_service_id=9),
            availability('DE', streaming_type='rent', tmdb_link='https://tmdb/de'),
            availability('DE', streaming_type='ads', stream_url=None, price_dollar=None, quality=None),
            availability('GB'),
        ])
        self.copy(crate, {'tmdb_id': {'$in': [42]}}, 'show', recent_only=False, mapping_refresh_limit=0)
        self.assertFalse(any(r['country_code'] == 'DE' and r['streaming_service_id'] == 8
                             and r['streaming_type'] != 'rent' for r in crate.rows))
        self.assertTrue(any(r['country_code'] == 'DE' and r['streaming_type'] == 'rent' for r in crate.rows))
        self.assertTrue(any(r['country_code'] == 'GB' for r in crate.rows))
        self.assertIn('US_8', crate.media[42]['streaming_availabilities'])

    def test_unverified_or_newer_web_source_is_not_erased(self):
        self.assertFalse(list_scope_excludes(self.details, 'DE', 8, 'flatrate', utc_ms(self.now) + 1))
        self.assertTrue(list_scope_excludes(self.details, 'DE', 8, 'flatrate'))
        self.details['watch_providers_check']['cache_bypassed'] = False
        self.assertTrue(list_scope_excludes(self.details, 'DE', 8, 'flatrate'))
        self.details['watch_providers_check'] = {}
        self.details['watch_providers_error'] = 'provider_request_failed'
        self.assertTrue(list_scope_excludes(self.details, 'DE', 8, 'flatrate'))

    def test_scheduled_batch_respects_the_same_scoped_drops(self):
        crate = Crate([availability('DE')])
        self.copy(crate, {}, 'show', recent_only=False, mapping_refresh_limit=0)
        self.assertFalse(any(r['country_code'] == 'DE' for r in crate.rows))
        self.assertEqual(crate.media[42]['streaming_availabilities'], ['US_8'])

    def test_newer_fresh_positive_supersedes_old_scoped_negative(self):
        payload = dict(id=42, results={'DE': {'flatrate': [dict(provider_id=8)]}})
        self.details['watch_providers'] = payload
        self.details['watch_providers_check'] = capture_provider_check(
            {'id': 42, 'watch/providers': payload}, 42, self.now + timedelta(seconds=1), bypass_cache=True)
        self.assertFalse(list_scope_excludes(self.details, 'DE', 8, 'flatrate'))

    def test_inflight_cached_country_cannot_undo_an_already_published_arrival(self):
        payload = dict(results={'DE': {}})
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {
            'watch_providers': payload,
            'watch_providers_check': capture_provider_check({'id': 42, 'watch/providers': payload}, 42, self.now, bypass_cache=False),
            'watch_providers_list_scopes': {'DE_8': dict(checked_at=utc_ms(self.now), kinds=['flatrate'])},
        }})
        crate = Crate([availability('DE', tmdb_link='https://tmdb/de', stream_url=None, price_dollar=None, quality=None)])
        self.copy(crate, {'tmdb_id': {'$in': [42]}}, 'show', recent_only=False, mapping_refresh_limit=0)
        self.assertTrue(any(row['country_code'] == 'DE' and row['streaming_service_id'] == 8 for row in crate.rows))

    def test_backfill_closes_a_disproved_stay_even_when_its_child_was_already_missing(self):
        crate = HistoryCrate()
        observed_at = utc_ms(self.now - timedelta(days=2))
        for country, service in [('DE', 8), ('DE', 9), ('GB', 8)]:
            row = Stay(media_tmdb_id=42, media_type='show', country_code=country,
                       streaming_service_id=service, streaming_type='flatrate', observed_at=observed_at,
                       appeared_on=observed_at // 86400000 * 86400000).model_dump()
            crate.history[availability_key_tuple(row) + (observed_at,)] = row
        self.copy(crate, {'tmdb_id': {'$in': [42]}}, 'show', recent_only=False, mapping_refresh_limit=0)
        old = {(r['country_code'], r['streaming_service_id']): r for r in crate.history.values() if r['country_code'] != 'US'}
        self.assertEqual(old[('DE', 8)]['dropped_on'], utc_ms(self.now) // 86400000 * 86400000)
        self.assertIsNone(old[('DE', 9)]['dropped_on'])
        self.assertIsNone(old[('GB', 8)]['dropped_on'])


class BackfillTests(unittest.TestCase):
    def test_refresh_alerts_keep_the_one_percent_and_three_day_thresholds(self):
        path = Path(__file__).parents[1] / 'windmill/f/tmdb_api/read_daily_provider_lists.flow/report.inline_script.py'
        spec = importlib.util.spec_from_file_location('daily_list_report', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        report = dict(lists_completed=4170, lists_failed=0,
                      offer_refresh=dict(selected=100, failed=1, max_failure_days=1))
        module.main(deepcopy(report))
        for failed, days in [(2, 1), (1, 3)]:
            report['offer_refresh'].update(failed=failed, max_failure_days=days)
            with self.assertRaises(RuntimeError):
                module.main(deepcopy(report))

    def test_source_preflight_reports_duplicate_deleted_and_quarantined_identities_without_writes(self):
        db = mongomock.MongoClient().db
        db.tmdb_movie_details.insert_many([{'tmdb_id': 1}, {'tmdb_id': 1}, {'tmdb_id': 2, 'tmdb_deleted': True}, {'tmdb_id': 3}])
        db.provider_identity_unresolved.insert_one({'media': 'movie', 'tmdb_id': 3, 'status': 'unresolved'})
        rows = [dict(media_type='movie', tmdb_id=i, country='DE', service_id=8,
                     direction='arrival', checked_at=1, catalog_present=True) for i in (1, 2, 3, 4)]
        plan = backfill.manifest(rows)
        result = backfill.source_eligibility(db, plan)
        self.assertEqual(result['blocked_titles'], 4)
        self.assertEqual(result['reasons']['movie:1'], ['duplicate_details_identity'])
        self.assertEqual(result['reasons']['movie:3'], ['quarantined'])
        self.assertEqual(db.tmdb_list_offer_refresh.count_documents({}), 0)

    def test_union_of_types_and_rent_aggregate_are_not_false_drops(self):
        history = [dict(media_tmdb_id=42, streaming_service_id=8, streaming_type=kind,
                        observed_at=100, dropped_on=dropped) for kind, dropped in [('flatrate', 200), ('ads', None)]]
        offers = [dict(media_tmdb_id=42, streaming_service_id=8, streaming_type='ads')]
        parents = {42: dict(streaming_availabilities=['DE_8'], streaming_country_codes=['DE'], streaming_service_ids=[8])}
        self.assertEqual(backfill.compare_scope('movie', 'DE', history, offers, parents), [])
        history[1]['dropped_on'] = 200
        offers[0]['streaming_type'] = 'rent'
        self.assertEqual(backfill.compare_scope('movie', 'DE', history, offers, parents), [])

    def test_arrivals_drops_and_aggregate_only_mismatches_are_counted(self):
        history = [dict(media_tmdb_id=i, streaming_service_id=8, streaming_type='flatrate', observed_at=100,
                        dropped_on=200 if i == 2 else None) for i in (1, 2, 3)]
        offers = [dict(media_tmdb_id=i, streaming_service_id=8, streaming_type='flatrate') for i in (2, 3)]
        parents = {i: dict(streaming_availabilities=['DE_8'], streaming_country_codes=['DE'], streaming_service_ids=[8])
                   for i in (1, 2)}
        rows = backfill.compare_scope('movie', 'DE', history, offers, parents)
        plan = backfill.manifest(rows)
        plan['scan_complete'] = True
        self.assertEqual((plan['summary']['titles'], plan['summary']['arrivals'], plan['summary']['drops']), (3, 2, 1))
        db = mongomock.MongoClient().db
        backfill.enqueue_manifest(db, plan)
        self.assertEqual(db.tmdb_list_offer_refresh.count_documents({}), 0)
        backfill.enqueue_manifest(db, plan, dry_run=False)
        self.assertEqual(db.tmdb_list_offer_refresh.count_documents({}), 3)
        plan['rows'][0]['tmdb_id'] = 99
        with self.assertRaises(ValueError):
            backfill.enqueue_manifest(db, plan, dry_run=False)


if __name__ == '__main__':
    unittest.main()
