"""Regressions requested in the #681 review."""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

import test_availability_history as fixtures
from test_availability_history import day
from f.sync.availability_history import premiere_day
from f.tmdb_api.provider_evidence import capture_provider_check


class PremiereAndProofTests(unittest.TestCase):
    def test_original_premiere_window_includes_seven_days_only(self):
        for date, expected in [('2026-10-08', day('2026-10-08')),
                               ('2026-10-07', None), ('2011-12-04', None), ('2026-10-16', None)]:
            with self.subTest(date=date):
                self.assertEqual(premiere_day({'networks': [{'id': 213}], 'first_air_date': date},
                                             'show', 8, day('2026-10-15')), expected)

    def test_prime_video_and_country_digital_premiere(self):
        details = {'production_companies': [{'id': 210099}], 'release_dates': {'results': [
            {'iso_3166_1': 'DE', 'release_dates': [{'type': 4, 'release_date': '2026-10-09'}]},
            {'iso_3166_1': 'US', 'release_dates': [{'type': 4, 'release_date': '2026-10-12'}]}]}}
        self.assertEqual(premiere_day(details, 'movie', 119, day('2026-10-15'), 'US'), day('2026-10-12'))
        self.assertEqual(premiere_day(details, 'movie', 119, day('2026-10-15'), 'FR'), day('2026-10-09'))
        self.assertEqual(premiere_day({'networks': [{'id': 1024}], 'first_air_date': '2026-10-12'},
                                     'show', 119, day('2026-10-15')), day('2026-10-12'))

    def test_only_fresh_subscription_offers_are_retained(self):
        payload = {'id': 42, 'watch/providers': {'results': {'US': {
            kind: [{'provider_id': 8}] for kind in ('flatrate', 'free', 'ads', 'rent', 'buy')}}}}
        fresh = capture_provider_check(payload, 42, datetime(2026, 10, 14), bypass_cache=True)
        self.assertEqual(fresh['offers'], ['US:8:ads', 'US:8:flatrate', 'US:8:free'])
        cached = capture_provider_check(payload, 42, datetime(2026, 10, 15), previous=fresh)
        self.assertNotIn('offers', cached)
        self.assertEqual(cached['previous_day']['offers'], fresh['offers'])
        self.assertEqual(cached['last_uncached']['offers'], fresh['offers'])


# Reuse the publisher fixture without inheriting/duplicating its test cases.
class HistoryReviewTests(unittest.TestCase):
    setUp = fixtures.HistoryTests.setUp
    observe = fixtures.HistoryTests.observe
    publish = fixtures.HistoryTests.publish

    def test_backfill_clock_skew_clamps_drop_to_open_day(self):
        self.observe('2026-10-15T12:00:00')
        self.publish()
        old_key, stay = next(iter(self.crate.history.items()))
        stay['observed_at'] = day('2026-10-16T12:00:00')
        self.crate.history = {old_key[:-1] + (stay['observed_at'],): stay}
        self.observe('2026-10-15T11:00:00', ())
        self.publish()
        closed = [r for r in self.crate.history.values() if r['dropped_on'] is not None]
        self.assertEqual((closed[-1]['dropped_on'], closed[-1]['dropped_precision']), (day('2026-10-16'), 'unknown'))
        self.assertEqual(self.crate.rows, [])

    def test_reopen_collision_gets_new_key_and_unknown_precision(self):
        self.observe('2026-10-15T12:00:00')
        self.publish()
        self.observe('2026-10-15T13:00:00', ())
        self.publish()
        self.observe('2026-10-15T12:00:00')
        self.publish()
        stays = sorted(self.crate.history.values(), key=lambda r: r['observed_at'])
        self.assertEqual(len(stays), 2)
        self.assertEqual(stays[1]['observed_at'], stays[0]['observed_at'] + 1)
        self.assertEqual(stays[1]['appeared_precision'], 'unknown')

    def test_missing_source_time_uses_copy_day(self):
        from f.sync.availability_history import HistoryTitle, publish_history
        from test_streaming_publication import key
        row = dict(media_tmdb_id=42, media_type='show', country_code='US', streaming_service_id=8, streaming_type='flatrate')
        publish_history(self.crate, 'show', [HistoryTitle(42, {}, {key(row): row}, {}, [], [])], lambda: None)
        stay = next(iter(self.crate.history.values()))
        self.assertEqual(stay['appeared_on'], day(datetime.utcnow().strftime('%Y-%m-%d')))
        self.assertEqual(stay['appeared_precision'], 'unknown')

    def test_missing_observation_time_cannot_make_premiere_exact(self):
        from f.sync.availability_history import HistoryTitle, publish_history
        from test_streaming_publication import key
        row = dict(media_tmdb_id=42, media_type='show', country_code='US', streaming_service_id=8, streaming_type='flatrate')
        details = {'networks': [{'id': 213}], 'first_air_date': datetime.utcnow().strftime('%Y-%m-%d')}
        publish_history(self.crate, 'show', [HistoryTitle(42, details, {key(row): row}, {}, [], [])], lambda: None)
        self.assertEqual(next(iter(self.crate.history.values()))['appeared_precision'], 'unknown')

    def test_unchanged_scheduled_batches_read_pending_markers_once_per_run(self):
        from f.sync.copy import tmdb_streaming
        self.observe(datetime.utcnow().strftime('%Y-%m-%dT12:00:00'))
        doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
        doc.pop('_id')
        self.db.tmdb_tv_details.insert_one(doc | {'tmdb_id': 43})
        self.publish(scheduled=True)
        self.db.tmdb_tv_details.update_many({}, {'$set': {'updated_at': datetime.utcnow() + timedelta(minutes=1)}})
        store = self.db.streaming_history_pending
        with patch.object(store, 'find', wraps=store.find) as find, \
             patch.object(tmdb_streaming, 'SCHEDULED_BATCH_SIZE', 1):
            self.publish(scheduled=True)
        self.assertEqual(find.call_count, 1)
        self.assertEqual(len(self.crate.history), 2)

    def test_retry_marker_created_after_run_selection_is_reused_under_lease(self):
        from f.sync.availability_history import HistoryTitle, publish_history
        from test_streaming_publication import key
        row = dict(media_tmdb_id=42, media_type='show', country_code='US', streaming_service_id=8, streaming_type='flatrate')
        self.db.streaming_history_pending.insert_one({'_id': 'show:42'})
        result = publish_history(self.crate, 'show', [HistoryTitle(42, {}, {key(row): row}, {}, [], [])],
                                 lambda: None, self.db.streaming_history_pending, known_pending=set())
        self.assertEqual(result.errors, {})
        self.assertEqual(result.pending, ['show:42'])
        self.assertEqual(len(self.crate.history), 1)

    def test_close_compares_days_not_milliseconds(self):
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.observe('2026-10-14T12:00:00')
        self.publish()
        old_key, stay = next(iter(self.crate.history.items()))
        stay['observed_at'] = day('2026-10-15T12:00:00')  # Backfill copy clock ahead of read clock.
        self.crate.history = {old_key[:-1] + (stay['observed_at'],): stay}
        previous = capture_provider_check({'id': 42, 'watch/providers': {'results': {
            'US': {'flatrate': [{'provider_id': 8}]}}}}, 42, datetime(2026, 10, 14, 12), bypass_cache=True)
        self.observe('2026-10-15T11:00:00', ())
        doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
        proof = capture_provider_check({'id': 42, 'watch/providers': doc['watch_providers']},
                                       42, datetime(2026, 10, 15, 11), previous=previous, bypass_cache=True)
        self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'watch_providers_check': proof}})
        self.publish()
        stay = next(iter(self.crate.history.values()))
        self.assertEqual((stay['dropped_on'], stay['dropped_precision']), (day('2026-10-15'), 'exact'))

    def test_failed_history_title_is_skipped_but_batch_continues_and_records_error(self):
        self.observe(datetime.utcnow().strftime('%Y-%m-%dT12:00:00'))
        doc = self.db.tmdb_tv_details.find_one({'tmdb_id': 42})
        doc.pop('_id')
        self.db.tmdb_tv_details.insert_one(doc | {'tmdb_id': 43})
        upsert = self.crate.upsert_many
        def fail_one(table, records, **kwargs):
            if table == 'availability_history' and any(r.media_tmdb_id == 42 for r in records):
                raise ValueError('bad history row')
            return upsert(table, records, **kwargs)
        with patch.object(self.crate, 'upsert_many', side_effect=fail_one):
            result = self.publish(scheduled=True)
        self.assertEqual([row['media_tmdb_id'] for row in self.crate.rows], [43])
        self.assertEqual(result['publication']['status'], 'partial_success')
        self.assertIn('bad history row', self.db.streaming_history_pending.find_one({'_id': 'show:42'})['error'])
        self.assertIsNone(self.db.streaming_history_pending.find_one({'_id': 'show:43'}))
        self.assertEqual(self.db.sync_watermarks.count_documents({}), 1)
        self.publish(scheduled=True)
        self.assertEqual({row['media_tmdb_id'] for row in self.crate.rows}, {42, 43})
        self.assertEqual(self.db.streaming_history_pending.count_documents({}), 0)
