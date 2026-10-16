"""History through the streaming publisher, with Mongo/Crate at the test seam."""
import sys
import unittest
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import mongomock
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.sync.copy import tmdb_streaming
from f.tmdb_api.provider_evidence import snapshot_id
from test_streaming_publication import Crate, key


def day(value):
    return int(datetime.fromisoformat(value).replace(tzinfo=timezone.utc).timestamp() * 1000)


class HistoryCrate(Crate):
    def __init__(self, rows=()):
        super().__init__(rows)
        self.history = {}

    def select(self, sql, params=None):
        if 'FROM availability_history' in sql:
            return deepcopy([r for r in self.history.values()
                             if r['media_tmdb_id'] in params[0] and r['media_type'] == params[1]])
        return super().select(sql, params)

    def upsert_many(self, table, records, **kwargs):
        if table != 'availability_history':
            return super().upsert_many(table, records, **kwargs)
        self.writes.append(table)
        for record in records:
            row = record.model_dump()
            self.history[key(row) + (row['observed_at'],)] = row
        return {'records_received': len(records), 'rows_upserted': len(records)}


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.crate = HistoryCrate()

    def observe(self, at, offers=(8,), media_type='show', **fields):
        results = {'US': {'link': 'https://tmdb', 'flatrate': [
            {'provider_id': service, 'display_priority': 1} for service in offers]}}
        payload = {'results': results}
        collection = self.db.tmdb_tv_details if media_type == 'show' else self.db.tmdb_movie_details
        collection.replace_one({'tmdb_id': 42}, {'tmdb_id': 42, 'updated_at': datetime.fromisoformat(at),
            'watch_providers': payload, 'watch_providers_error': '',
            'watch_providers_check': {'checked_at': day(at), 'payload_hash': snapshot_id(payload),
                                      'countries': ['US'], 'cache_bypassed': True}, **fields}, upsert=True)

    def publish(self, scheduled=False, media_type='show'):
        with patch.object(tmdb_streaming, 'get_db', return_value=self.db):
            return tmdb_streaming.copy_media(self.crate, {} if scheduled else {'tmdb_id': {'$in': [42]}},
                                             media_type, recent_only=scheduled)

    def test_first_offer_opens_unknown_stay_in_both_writer_paths(self):
        for scheduled in (False, True):
            with self.subTest(scheduled=scheduled):
                self.crate = HistoryCrate()
                self.observe(datetime.utcnow().strftime('%Y-%m-%dT12:00:00'))
                self.publish(scheduled)
                self.assertEqual(len(self.crate.history), 1)
                stay = next(iter(self.crate.history.values()))
                self.assertEqual(stay['appeared_precision'], 'unknown')
                self.assertIsNone(stay['dropped_on'])
                self.assertEqual(stay['streaming_type'], 'flatrate')

    def test_consecutive_fresh_title_reads_make_arrival_and_drop_exact(self):
        from f.tmdb_api.provider_evidence import capture_provider_check
        previous = None
        for at, offers in [('2026-10-14T23:59:00', ()), ('2026-10-15T00:01:00', (8,)),
                           ('2026-10-15T12:00:00', (8,)), ('2026-10-16T13:00:00', ())]:
            self.observe(at, offers)
            doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
            proof = capture_provider_check({'id': 42, 'watch/providers': doc['watch_providers']},
                                           42, datetime.fromisoformat(at), previous=previous, bypass_cache=True)
            self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers_check': proof}})
            self.publish()
            previous = proof
        stay = next(iter(self.crate.history.values()))
        self.assertEqual(stay['appeared_on'], day('2026-10-15'))
        self.assertEqual(stay['appeared_after'], day('2026-10-14'))
        self.assertEqual(stay['appeared_precision'], 'exact')
        self.assertEqual(stay['dropped_on'], day('2026-10-16'))
        self.assertEqual(stay['dropped_precision'], 'exact')
        self.assertEqual(stay['last_seen_on'], day('2026-10-15'))

    def test_original_network_and_studio_use_premiere_only_on_first_stay(self):
        for media_type, fields in [
            ('show', {'networks': [{'id': 213}], 'first_air_date': '2026-10-10'}),
            ('movie', {'production_companies': [{'id': 178464}], 'release_dates': {'results': [
                {'release_dates': [{'type': 3, 'release_date': '2026-10-01'},
                                   {'type': 4, 'release_date': '2026-10-10'}]}]}}),
        ]:
            with self.subTest(media_type=media_type):
                self.crate = HistoryCrate()
                self.observe('2026-10-15T12:00:00', (8, 9), media_type, **fields)
                self.publish(media_type=media_type)
                original = next(r for r in self.crate.history.values() if r['streaming_service_id'] == 8)
                licensed = next(r for r in self.crate.history.values() if r['streaming_service_id'] == 9)
                self.assertEqual((original['appeared_on'], original['appeared_precision'], original['appeared_source']),
                                 (day('2026-10-10'), 'exact', 'premiere'))
                self.assertEqual(licensed['appeared_precision'], 'unknown')
                self.observe('2026-10-15T13:00:00', (), media_type, **fields)
                self.publish(media_type=media_type)
                self.observe('2026-10-15T14:00:00', (8,), media_type, **fields)
                self.publish(media_type=media_type)
                stays = [r for r in self.crate.history.values() if r['streaming_service_id'] == 8]
                self.assertEqual(len(stays), 2)
                self.assertEqual(stays[1]['appeared_on'], day('2026-10-15'))
                self.assertEqual(stays[1]['appeared_source'], 'title')

    def test_unchanged_fresh_read_preserves_stay_without_history_database_work(self):
        self.observe('2026-10-15T12:00:00')
        self.publish()
        before = deepcopy(self.crate.history)
        select = self.crate.select
        def without_history(sql, params=None):
            if 'availability_history' in sql:
                raise AssertionError('Unchanged offers must not read history')
            return select(sql, params)
        self.observe('2026-10-16T12:00:00')
        with patch.object(self.crate, 'select', side_effect=without_history):
            self.publish()
        self.assertEqual(self.crate.history, before)

    def test_unknown_gap_failure_and_no_change_do_not_invent_observations(self):
        self.observe('2026-10-12T12:00:00')
        self.publish()
        original = deepcopy(self.crate.history)
        self.observe('2026-10-15T12:00:00', (), watch_providers_error='failed')
        # Retained API payload remains after a failed fetch, as in production.
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers': {'results': {}}}})
        self.publish()
        self.assertEqual(self.crate.history, original)
        self.observe('2026-10-16T12:00:00', ())
        self.publish()
        stay = next(iter(self.crate.history.values()))
        self.assertEqual(stay['dropped_precision'], 'unknown')
        self.assertEqual(stay['last_seen_on'], day('2026-10-12'))

    def test_gap_cached_previous_read_or_previous_presence_never_claim_exact_arrival(self):
        from f.tmdb_api.provider_evidence import capture_provider_check
        for prior_day, fresh, old_offers in [('2026-10-13', True, ()), ('2026-10-14', False, ()),
                                               ('2026-10-14', True, (8,))]:
            with self.subTest(prior_day=prior_day, bypass_cache=fresh, old_offers=old_offers):
                self.crate = HistoryCrate()
                self.observe(prior_day, old_offers)
                doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
                previous = capture_provider_check({'id': 42, 'watch/providers': doc['watch_providers']},
                    42, datetime.fromisoformat(prior_day), bypass_cache=fresh)
                self.observe('2026-10-15', (8,))
                doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
                proof = capture_provider_check({'id': 42, 'watch/providers': doc['watch_providers']},
                    42, datetime(2026, 10, 15), bypass_cache=True, previous=previous)
                self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers_check': proof}})
                self.publish()
                self.assertEqual(next(iter(self.crate.history.values()))['appeared_precision'], 'unknown')

    def test_offer_failure_after_history_is_safe_to_retry(self):
        self.observe('2026-10-15T12:00:00')
        upsert = self.crate.upsert_many
        def fail_offers(table, *args, **kwargs):
            if table == 'streaming_availability':
                raise TimeoutError('offer write failed')
            return upsert(table, *args, **kwargs)
        with patch.object(self.crate, 'upsert_many', side_effect=fail_offers):
            with self.assertRaises(TimeoutError):
                self.publish()
        self.assertEqual(len(self.crate.history), 1)
        self.assertEqual(len(self.crate.rows), 0)
        self.publish()
        self.assertEqual(len(self.crate.history), 1)
        self.assertEqual(len(self.crate.rows), 1)

    def test_history_write_failure_keeps_marker_and_advances_watermark(self):
        self.observe(datetime.utcnow().strftime('%Y-%m-%dT12:00:00'))
        upsert = self.crate.upsert_many
        def fail_history(table, *args, **kwargs):
            if table == 'availability_history':
                raise TimeoutError('history write failed')
            return upsert(table, *args, **kwargs)
        with patch.object(self.crate, 'upsert_many', side_effect=fail_history):
            result = self.publish(scheduled=True)
        self.assertEqual(self.crate.rows, [])
        self.assertEqual(result['publication']['status'], 'partial_success')
        self.assertIn('history write failed', self.db.streaming_history_pending.find_one({})['error'])
        self.assertEqual(self.db.sync_watermarks.count_documents({}), 1)

    def test_paid_offers_do_not_create_history(self):
        self.observe('2026-10-15T12:00:00')
        doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
        payload = doc['watch_providers']
        payload['results']['US']['rent'] = payload['results']['US'].pop('flatrate')
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers': payload,
            'watch_providers_check.payload_hash': snapshot_id(payload)}})
        self.publish()
        self.assertEqual(self.crate.history, {})
        self.assertEqual(self.crate.rows[0]['streaming_type'], 'rent')

    def test_legacy_api_insert_still_opens_unknown_history_without_proof(self):
        self.observe('2026-10-15T12:00:00')
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$unset': {'watch_providers_check': ''}})
        self.publish()
        self.assertEqual(len(self.crate.history), 1)
        self.assertEqual(next(iter(self.crate.history.values()))['appeared_precision'], 'unknown')

    def test_unknown_arrival_prefers_api_day_over_newer_scrape_day(self):
        from test_provider_identity import clickout_url
        self.observe('2026-10-12T12:00:00', ())
        self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'US',
            'updated_at': datetime(2026, 10, 15, 12), 'streaming_links': [{
                'stream_url': clickout_url('Netflix'), 'provider_name': 'Netflix',
                'stream_type': 'flatrate', 'quality': 'HD'}]})
        self.publish()
        stay = next(iter(self.crate.history.values()))
        self.assertEqual(stay['appeared_on'], day('2026-10-12'))
        self.assertEqual(stay['appeared_precision'], 'unknown')


    def test_changed_snapshot_after_partial_insert_closes_the_pending_stay(self):
        self.observe('2026-10-15T12:00:00')
        upsert = self.crate.upsert_many
        def fail_offers(table, *args, **kwargs):
            if table == 'streaming_availability':
                raise TimeoutError('offer write failed')
            return upsert(table, *args, **kwargs)
        with patch.object(self.crate, 'upsert_many', side_effect=fail_offers):
            with self.assertRaises(TimeoutError):
                self.publish()
        self.observe('2026-10-16T12:00:00', ())
        self.publish()
        self.assertEqual(len(self.crate.history), 1)
        self.assertEqual(next(iter(self.crate.history.values()))['dropped_on'], day('2026-10-16'))
        self.assertEqual(self.crate.rows, [])

    def test_changed_snapshot_after_partial_delete_opens_a_return(self):
        self.observe('2026-10-15T12:00:00')
        self.publish()
        self.observe('2026-10-16T12:00:00', ())
        run = self.crate.run
        def fail_delete(sql, params=None):
            if sql.startswith('DELETE FROM streaming_availability'):
                raise TimeoutError('offer deletion failed')
            return run(sql, params)
        with patch.object(self.crate, 'run', side_effect=fail_delete):
            with self.assertRaises(TimeoutError):
                self.publish()
        self.observe('2026-10-17T12:00:00')
        self.publish()
        self.assertEqual(len(self.crate.history), 2)
        self.assertEqual(sum(row['dropped_on'] is None for row in self.crate.history.values()), 1)
        self.assertEqual(len(self.crate.rows), 1)


    def test_scheduled_copy_recovers_pending_title_outside_the_watermark(self):
        self.observe('2026-09-01T12:00:00')
        upsert = self.crate.upsert_many
        def fail_offers(table, *args, **kwargs):
            if table == 'streaming_availability':
                raise TimeoutError('targeted publication failed')
            return upsert(table, *args, **kwargs)
        with patch.object(self.crate, 'upsert_many', side_effect=fail_offers):
            with self.assertRaises(TimeoutError):
                self.publish()
        self.db.sync_watermarks.insert_one({'_id': 'tmdb_streaming:show',
            'completed_run_started_at': datetime.utcnow()})
        self.publish(scheduled=True)
        self.assertEqual(len(self.crate.rows), 1)
        self.assertEqual(self.db.streaming_history_pending.count_documents({}), 0)


    def test_recent_release_flow_reads_establish_exact_days_but_cached_reads_do_not(self):
        import asyncio
        from urllib.parse import parse_qs, urlparse
        from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
        from windmill_preview import load_flow
        with patch('wmill.get_variable', return_value='unused'):
            from f.tmdb_api.tmdb_fetch_details_from_api import fetch
        flow = load_flow('f/tmdb_api/recheck_recent_releases')
        batch = flow['value']['modules'][1]['value']['modules'][0]['value']
        self.assertEqual(batch['path'], 'f/tmdb_api/tmdb_fetch_details_from_api/fetch')
        self.assertEqual(batch['input_transforms']['bypass_cache'], {'type': 'static', 'value': True})
        flow_bypass = batch['input_transforms']['bypass_cache']['value']
        for media_type, model in [('movie', TmdbMovieDetails), ('show', TmdbTvDetails)]:
            for bypass in (flow_bypass, False):
                with self.subTest(media_type=media_type, bypass_cache=bypass):
                    self.db = mongomock.MongoClient().db
                    self.crate = HistoryCrate()
                    collection = self.db.tmdb_movie_details if media_type == 'movie' else self.db.tmdb_tv_details
                    entry = model(tmdb_id=42)
                    def save(document):
                        collection.replace_one({'tmdb_id': 42}, document.to_mongo().to_dict(), upsert=True)
                    for observed_day, offers in [(14, []), (15, [{'provider_id': 8}]), (16, [])]:
                        payload = {'id': 42, 'title': 'Example', 'name': 'Example',
                                   'watch/providers': {'results': {'US': {'link': 'https://tmdb', 'flatrate': offers}}}}
                        with patch.object(fetch.requests, 'get') as get, patch.object(fetch, 'datetime') as clock, \
                             patch.object(model, 'save', autospec=True, side_effect=save):
                            clock.utcnow.return_value = datetime(2026, 10, observed_day, 13)
                            get.return_value.json.return_value = deepcopy(payload)
                            result = asyncio.run(fetch.tmdb_fetch_details_from_api([entry], bypass_cache=bypass))
                        self.assertEqual(result['count_new_entries'], 1)
                        query = parse_qs(urlparse(get.call_args.args[0]).query)
                        self.assertEqual(len(query.get('cb', [])), 1 if bypass else 0)
                        proof = collection.find_one({'tmdb_id': 42})['watch_providers_check']
                        self.assertEqual(proof.get('cache_bypassed', False), bypass)
                        self.assertNotIn('fresh', proof)
                        self.publish(media_type=media_type)
                        if bypass and observed_day < 16:
                            # The ordinary details queue can fetch a cached copy
                            # after today's recheck and before tomorrow's.
                            for cached_at in (datetime(2026, 10, observed_day, 18),
                                              datetime(2026, 10, observed_day + 1, 8)):
                                with patch.object(fetch.requests, 'get') as get, patch.object(fetch, 'datetime') as clock, \
                                     patch.object(model, 'save', autospec=True, side_effect=save):
                                    clock.utcnow.return_value = cached_at
                                    get.return_value.json.return_value = deepcopy(payload)
                                    asyncio.run(fetch.tmdb_fetch_details_from_api([entry], bypass_cache=False))
                                self.assertFalse(entry.watch_providers_check.get('cache_bypassed'))
                    stay = next(iter(self.crate.history.values()))
                    self.assertEqual(stay['appeared_on'], day('2026-10-15'))
                    self.assertEqual(stay['dropped_on'], day('2026-10-16'))
                    self.assertEqual(stay['appeared_precision'], 'exact' if bypass else 'unknown')
                    self.assertEqual(stay['dropped_precision'], 'exact' if bypass else 'unknown')


class FreshFetchTests(unittest.TestCase):
    def test_details_fetch_bypasses_cache_and_retains_yesterdays_proof(self):
        import asyncio
        from urllib.parse import parse_qs, urlparse
        from f.tmdb_api.models import TmdbTvDetails
        from f.tmdb_api.provider_evidence import capture_provider_check
        with patch('wmill.get_variable', return_value='unused'):
            from f.tmdb_api.tmdb_fetch_details_from_api import fetch
        entry = TmdbTvDetails(tmdb_id=42)
        payload = {'id': 42, 'watch/providers': {'results': {'US': {}}}}
        entry.watch_providers_check = capture_provider_check(payload, 42, datetime(2026, 10, 14), bypass_cache=True)
        with patch.object(fetch.requests, 'get') as get:
            fetch.fetch_tv_data(entry)
            fetch.fetch_tv_data(entry, bypass_cache=True)
            fetch.fetch_tv_data(entry, bypass_cache=True)
        urls = [call.args[0] for call in get.call_args_list]
        queries = [parse_qs(urlparse(url).query) for url in urls]
        self.assertNotIn('cb', queries[0])
        self.assertEqual(len(queries[1]['cb']), 1)
        self.assertEqual(len(queries[2]['cb']), 1)
        self.assertNotEqual(queries[1]['cb'], queries[2]['cb'])
        with patch.object(fetch, 'datetime') as clock, patch.object(TmdbTvDetails, 'save'):
            clock.utcnow.return_value = datetime(2026, 10, 15)
            asyncio.run(fetch.convert_and_save_details(entry, deepcopy(payload), bypass_cache=True))
        self.assertTrue(entry.watch_providers_check['cache_bypassed'])
        self.assertEqual(entry.watch_providers_check['previous_day']['checked_at'], day('2026-10-14'))

