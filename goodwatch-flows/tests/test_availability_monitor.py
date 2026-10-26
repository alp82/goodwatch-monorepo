"""Bounded availability monitoring uses scratch stores, never source HTTP."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
import os
from uuid import uuid4
from urllib.parse import urlsplit
from pymongo import MongoClient
from unittest.mock import Mock
import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.monitoring.backlog_collection import collect_availability, iso
from f.monitoring.backlog_health import assess_availability, assess_backlogs
from f.monitoring.collection import source_evidence, outcome_evidence
from f.monitoring.incidents import actionable_causes, record_incident
from f.monitoring.notifications import format_notification
from f.tmdb_api.provider_evidence import utc_ms

NOW = datetime(2026, 10, 26, 12, tzinfo=timezone.utc)


class AvailabilityCollectionTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient(tz_aware=True).db
        self.crate = Mock()
        self.crate.select.return_value = []
        self.collection = self.db.tmdb_movie_providers
        for media in ('movie','tv'):
            col = self.db[f'tmdb_{media}_providers']
            col.create_index([('tmdb_id',1)])
            col.create_index([('provider_change_pending',1),('provider_change_pending_since',1),('tmdb_id',1)],name='availability_pending_changes')
            col.create_index([('parse_failed_at',1)],name='availability_parse_failures')

    def country(self, tmdb_id=42, **fields):
        return self.collection.insert_one(dict(tmdb_id=tmdb_id, country_code='US',
            provider_title_observed_at=NOW-timedelta(days=3), **fields)).inserted_id

    def collect(self, **kwargs):
        return collect_availability(self.db, self.crate, NOW, **kwargs)

    def test_bson_int64_timestamps_are_accepted_but_booleans_are_not(self):
        from bson.int64 import Int64
        self.assertEqual(iso(Int64(utc_ms(NOW))), NOW.isoformat())
        with self.assertRaises(ValueError):
            iso(True)

    def test_expired_open_remains_pending_through_lease_and_backoff(self):
        at=NOW-timedelta(hours=25)
        self.crate.select.return_value=[dict(media_type='movie',tmdb_id=42,last_opened_at=utc_ms(at))]
        self.country(updated_at=at-timedelta(days=1),lease_expires_at=NOW+timedelta(hours=1),
                     consecutive_failures=2,next_fetch_at=NOW+timedelta(days=1))
        result=self.collect()
        self.assertEqual(result['opened']['count'],1)
        self.assertTrue(result['opened']['complete'])
        self.assertEqual(result['opened']['oldest_at'],at.isoformat())

    def test_satisfied_and_excluded_countries_do_not_spend_pending_row_cap(self):
        at=NOW-timedelta(hours=25)
        self.crate.select.return_value=[dict(media_type='movie',tmdb_id=42,last_opened_at=utc_ms(at))]
        self.country(updated_at=NOW)
        self.country(43,tmdb_deleted=True)
        self.collection.insert_one(dict(tmdb_id=42,country_code='NE',provider_title_observed_at=NOW))
        result=self.collect(max_pairs=1)
        self.assertEqual(result['opened']['count'],0)
        self.assertEqual(result['rows_scanned'],0)
        self.assertTrue(result['complete'])

    def test_old_open_pages_continue_after_fresh_first_page(self):
        at=utc_ms(NOW-timedelta(hours=25))
        self.crate.select.side_effect=[
            [dict(media_type='movie',tmdb_id=41,last_opened_at=at)],
            [dict(media_type='movie',tmdb_id=42,last_opened_at=at)], []]
        self.country(41,updated_at=NOW)
        self.country(42)
        result=self.collect(max_opens=1)
        self.assertEqual(result['opened']['count'],1)
        self.assertEqual(self.crate.select.call_count,3)
        self.assertIn('last_opened_at > ?',self.crate.select.call_args_list[1].args[0])

    def test_first_pending_change_age_and_parse_classification(self):
        self.country(provider_change_pending=True,provider_change_pending_since=utc_ms(NOW-timedelta(days=2)),
            provider_change_observed_at=utc_ms(NOW),failure_classification='parse',failed_at=NOW-timedelta(minutes=15),parse_failed_at=NOW-timedelta(minutes=15))
        result=self.collect()
        self.assertEqual(result['changed']['count'],1)
        self.assertEqual(result['parse']['count'],1)
        self.assertTrue(result['complete'])

    def test_later_transport_failure_does_not_claim_parse_recovery(self):
        key = self.country(parse_failed_at=NOW-timedelta(minutes=20),
                           failed_at=NOW, failure_classification='transport')
        self.assertEqual(self.collect()['parse']['count'], 1)
        self.collection.update_one({'_id': key}, {'$set': {'failure_classification': 'http'}})
        self.assertEqual(self.collect()['parse']['count'], 1)
        # Only a successful parser clears the durable unresolved marker.
        self.collection.update_one({'_id': key}, {'$unset': {'parse_failed_at': ''}})
        self.assertEqual(self.collect()['parse']['count'], 0)

    def test_cap_is_lower_bound_and_never_healthy_zero(self):
        self.country(provider_change_pending=True,provider_change_pending_since=utc_ms(NOW-timedelta(days=2)))
        self.country(43,provider_change_pending=True,provider_change_pending_since=utc_ms(NOW-timedelta(days=2)))
        result=self.collect(max_pairs=1)
        self.assertFalse(result['changed']['complete'])
        self.assertEqual(result['rows_scanned'],1)
        reports=assess_availability(result,None,NOW)['reports']
        self.assertEqual(reports[1]['status'],'unhealthy')
        self.assertTrue(reports[1]['counts_are_lower_bounds'])
        self.assertEqual(reports[2]['status'],'unknown')

    def test_missing_age_and_database_error_stay_unknown(self):
        self.country(provider_change_pending=True)
        result=self.collect()
        self.assertFalse(result['changed']['complete'])
        self.crate.select.side_effect=TimeoutError('bounded query')
        self.assertFalse(self.collect()['opened']['complete'])
        self.assertFalse(self.collect(budget_seconds=0)['complete'])


@unittest.skipUnless(os.environ.get('MONITOR_TEST_MONGO_URI'), 'disposable Mongo URI required')
class RealMongoAvailabilityTests(AvailabilityCollectionTests):
    def setUp(self):
        uri = os.environ['MONITOR_TEST_MONGO_URI']
        parsed = urlsplit(uri)
        if parsed.hostname != '127.0.0.1' or parsed.port not in (27189, 32886):
            raise ValueError('Only the approved disposable localhost Mongo is allowed')
        self.client = MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=3000)
        self.db = self.client['availability_monitor_test_' + uuid4().hex]
        self.addCleanup(self.client.close)
        self.addCleanup(lambda: self.client.drop_database(self.db.name))
        self.crate = Mock()
        self.crate.select.return_value = []
        self.collection = self.db.tmdb_movie_providers
        for media in ('movie', 'tv'):
            col = self.db[f'tmdb_{media}_providers']
            col.create_index([('tmdb_id', 1)])
            col.create_index([('provider_change_pending', 1), ('provider_change_pending_since', 1), ('tmdb_id', 1)], name='availability_pending_changes')
            col.create_index([('parse_failed_at', 1)], name='availability_parse_failures')


class AvailabilityHealthTests(unittest.TestCase):
    def snapshot(self, count=3, complete=True):
        return {name:dict(complete=complete,count=count if name=='parse' else 0,
            oldest_at=(NOW-timedelta(hours=25)).isoformat() if count and name=='parse' else None)
            for name in ('opened','changed','parse')}

    def test_parse_needs_three_distinct_failures_and_ten_minutes(self):
        initial=assess_availability(self.snapshot(),None,NOW)
        self.assertEqual(initial['reports'][2]['status'],'healthy')
        later=assess_availability(self.snapshot(),initial['progress'],NOW+timedelta(minutes=10))
        self.assertEqual(later['reports'][2]['causes'],['sustained_parse_errors'])
        isolated=assess_availability(self.snapshot(1),initial['progress'],NOW+timedelta(hours=1))
        self.assertEqual(isolated['reports'][2]['causes'],[])
        self.assertIsNone(isolated['progress']['parse_first_observed_at'])

    def test_partial_never_reports_recovery_or_accumulates_clean_window(self):
        first=assess_availability(self.snapshot(),None,NOW)
        active=assess_availability(self.snapshot(),first['progress'],NOW+timedelta(minutes=10))
        missing=assess_availability(self.snapshot(0,False),active['progress'],NOW+timedelta(minutes=15))
        self.assertEqual(missing['reports'][2]['status'],'unknown')
        resumed=assess_availability(self.snapshot(),missing['progress'],NOW+timedelta(minutes=20))
        self.assertEqual(resumed['reports'][2]['status'],'unhealthy')
        recovered=assess_availability(self.snapshot(0),resumed['progress'],NOW+timedelta(minutes=25))
        self.assertIsNone(recovered['progress']['parse_first_observed_at'])

    def test_alert_copy_describes_the_actual_availability_issue(self):
        text = format_notification(dict(pipeline='f/monitoring/availability_parse', kind='incident',
            causes=['sustained_parse_errors'], source_pipeline='f/tmdb_web/tmdb_crawl_providers'))
        self.assertIn('three country page parses', text)
        self.assertNotIn('delivery check', text)

    def test_new_causes_are_actionable_and_existing_assessment_routes_them(self):
        for cause in ('availability_opened_overdue','availability_changed_overdue','sustained_parse_errors'):
            self.assertEqual(actionable_causes({'causes':[cause]}),[cause])
        country={'complete':False,'availability':self.snapshot()}
        result=assess_backlogs(country,{'complete':False},None,NOW)
        self.assertEqual(len(result['reports']),5)
        self.assertIn('availability',result['progress'])


class BatchSourceEvidenceTests(unittest.TestCase):
    def observed(self):
        return dict(source_success_count=0,source_failure_count=0,tolerable_external_failure_count=0,
                    source_last_success_at=None,evidence_incomplete=False)

    def test_batch_success_parse_and_saved_http_are_counted_separately(self):
        rows=[{'outcome':'fetched'}, {'outcome':'failed','failure_classification':'parse','retry_saved':True},
              {'outcome':'failed','failure_classification':'http','retry_saved':True}]
        observed=self.observed()
        source_evidence(dict(script_path='f/tmdb_web/tmdb_crawl_providers/batch',success=True,
                             completed_at=NOW.isoformat(),result=rows),observed)
        self.assertEqual(observed['source_success_count'],1)
        self.assertEqual(observed['source_failure_count'],2)
        self.assertEqual(observed['source_parse_failure_count'],1)
        self.assertEqual(observed['tolerable_external_failure_count'],1)
        self.assertEqual(outcome_evidence(rows[1],True)[0],'failure')
        self.assertEqual(outcome_evidence(rows[2],True)[1],[])

    def test_oversized_batch_is_bounded_and_incomplete(self):
        observed=self.observed()
        source_evidence(dict(script_path='f/tmdb_web/tmdb_crawl_providers/batch',success=True,
                             completed_at=NOW.isoformat(),result=[{'outcome':'fetched'}]*21),observed)
        self.assertEqual(observed['source_success_count'],20)
        self.assertTrue(observed['evidence_incomplete'])


if __name__=='__main__':
    unittest.main()
