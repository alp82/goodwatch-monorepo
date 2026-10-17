"""Upstream diagnostics and one durable incident/recovery per blocking episode."""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import mongomock
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.monitoring.backlog_collection import collect_countries
from f.monitoring.health import assess_upstream, apply_upstream_cause, PROVIDER_PIPELINE
from f.monitoring.incidents import record_incident
from f.monitoring.notifications import format_notification, deliver_notification
from test_workflow_incidents import MemoryStore
from test_monitor_check import Api, MemoryStore as PollStore
from f.monitoring.check import poll

NOW = datetime(2026, 10, 17, 12, tzinfo=timezone.utc)


def snapshot(age, until=None):
    return {'complete': True, 'upstream': {
        'blocked_since': (NOW - timedelta(hours=age)).isoformat(),
        'blocked_until': (until or NOW + timedelta(hours=1)).isoformat(),
        'block_reason': 'challenge', 'consecutive_blocks': 3,
    }}


class UpstreamMonitorTests(unittest.TestCase):
    def test_closed_gate_explains_successful_empty_runs_even_after_deadline(self):
        for until in [NOW + timedelta(hours=1), NOW - timedelta(minutes=1)]:
            upstream = assess_upstream(snapshot(3, until), NOW)
            report = {'path': PROVIDER_PIPELINE, 'status': 'unknown', 'causes': []}
            apply_upstream_cause(report, upstream)
            self.assertEqual(report['progress_cause'], 'upstream_blocked')
            self.assertEqual(report['upstream']['block_reason'], 'challenge')
            self.assertIn('lack_of_progress', report['causes'])
            self.assertNotIn('missing_descendants', report['causes'])
            self.assertEqual(report['probe_due'], until < NOW)
            self.assertEqual(report['retry_in_seconds'], max(0, (until - NOW).total_seconds()))

    def test_collection_retains_closed_gate_after_deadline_and_avoids_country_scans(self):
        db = mongomock.MongoClient(tz_aware=True).test
        data = snapshot(3, NOW - timedelta(minutes=1))['upstream']
        data = {key: datetime.fromisoformat(value) if key in ['blocked_since', 'blocked_until'] else value for key, value in data.items()}
        db.tmdb_streaming_upstream.insert_one({'_id': 'tmdb_watch', **data})
        result = collect_countries(db, NOW)
        self.assertTrue(result['complete'])
        self.assertEqual(result['upstream']['block_reason'], 'challenge')
        self.assertEqual(assess_upstream(result, NOW)['status'], 'unhealthy')
        self.assertNotIn('partitions', result)

    def test_two_hour_threshold_deduplication_unknown_and_one_recovery(self):
        store, sent = MemoryStore(), []
        def deliver(url, notice):
            sent.append(notice)
            return {'delivered': True, 'message_id': str(len(sent)), 'retry_after_seconds': 0}
        for age in [0, 1, 1.99, 2, 3, 5, 24]:
            report = assess_upstream(snapshot(age), NOW)
            record_incident(store, report, NOW, 'test-webhook', deliver)
        self.assertEqual([n['kind'] for n in sent], ['incident'])
        self.assertIn('at least 2 hours', format_notification(sent[0]))
        record_incident(store, assess_upstream({}, NOW), NOW, 'test-webhook', deliver)
        self.assertEqual(len(sent), 1)
        open_report = assess_upstream({'upstream': {}}, NOW)
        record_incident(store, open_report, NOW, 'test-webhook', deliver)
        record_incident(store, open_report, NOW, 'test-webhook', deliver)
        self.assertEqual([n['kind'] for n in sent], ['incident', 'recovery'])
        self.assertIn('reopened', format_notification(sent[-1]))

    def test_short_block_does_not_send_alert_or_recovery(self):
        store = MemoryStore()
        with patch('f.monitoring.notifications.build_opener') as http:
            for report in [assess_upstream(snapshot(1), NOW), assess_upstream({'upstream': {}}, NOW)]:
                record_incident(store, report, NOW, 'test-webhook', lambda *_: self.fail('False alert'))
            http.assert_not_called()

    def test_new_cause_is_accepted_by_existing_delivery_validation(self):
        notice = {'pipeline': 'f/monitoring/tmdb_watch_upstream', 'source_pipeline': PROVIDER_PIPELINE,
                  'kind': 'incident', 'causes': ['upstream_blocked'], 'job_id': None}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, *_): return b'{"id":"123"}'
        with patch('f.monitoring.notifications.build_opener') as opener:
            opener.return_value.open.return_value = Response()
            self.assertTrue(deliver_notification('https://discord.com/api/webhooks/123/test', notice)['delivered'])

    def test_checker_attaches_cause_and_has_separate_upstream_recovery_evidence(self):
        api = Api(schedules=[{'path': PROVIDER_PIPELINE, 'script_path': PROVIDER_PIPELINE,
                            'schedule': '0 */5 * * * *', 'timezone': 'UTC', 'enabled': True}])
        collector = lambda *_: {'country': snapshot(3), 'publication': {'complete': False}}
        result = poll(api, PollStore(), NOW, notify=False, backlog_collector=collector)
        pipeline = next(p for p in result['pipelines'] if p['path'] == PROVIDER_PIPELINE)
        self.assertEqual(pipeline['progress_cause'], 'upstream_blocked')
        self.assertTrue(any(p['path'] == 'f/monitoring/tmdb_watch_upstream' for p in result['pipelines']))


if __name__ == '__main__':
    unittest.main()
