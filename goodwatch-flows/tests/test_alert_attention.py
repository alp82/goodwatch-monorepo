"""Alert policy regressions drawn from the October 2026 Discord audit."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.monitoring.collection import observe_execution
from f.monitoring.health import incident_transition
from f.monitoring.incidents import record_incident
from test_workflow_incidents import MemoryStore

NOW = datetime(2026, 10, 15, tzinfo=timezone.utc)

class AttentionTests(unittest.TestCase):
    def test_successful_empty_loop_does_not_fetch_placeholder(self):
        def api(path):
            self.assertEqual(path, 'jobs_u/get/root')
            return {'id': 'root', 'parent_job': None, 'success': True, 'result': [],
                    'flow_status': {'modules': [{'id': 'b', 'type': 'Success',
                        'job': '00000000-0000-0000-0000-000000000000',
                        'skipped': False, 'flow_jobs': [], 'flow_jobs_success': []}]}}
        observed = observe_execution(api, 'root')
        self.assertEqual(observed['outcome'], 'no_work')
        self.assertEqual(observed['missing_descendants'], [])
        self.assertEqual(observed['unresolved_descendants'], [])

    def test_unchanged_incident_never_sends_periodic_reminder(self):
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['consecutive_failures']}
        state = {'active': True, 'causes': report['causes'], 'opened_at': NOW.isoformat(),
                 'last_notified_at': NOW.isoformat(), 'pending_notification': None}
        for days in [1, 7, 30]:
            self.assertIsNone(incident_transition(state, report, NOW + timedelta(days=days))['notification'])

    def test_unknown_children_do_not_send_or_retry_legacy_alert(self):
        store = MemoryStore()
        report = {'path': 'f/demo/run', 'status': 'unhealthy',
                  'causes': ['missing_descendants', 'lack_of_progress']}
        store.rows['pipeline:f/demo/run'] = {'incident': {
            'active': True, 'causes': report['causes'],
            'pending_notification': {'kind': 'reminder', 'causes': report['causes']}}}
        def send(*args):
            self.fail('Uncertain execution evidence must not notify')
        record_incident(store, report, NOW, 'private-url', send)
        self.assertEqual(store.rows['pipeline:f/demo/run']['report'], report)
        self.assertIsNone(store.rows['pipeline:f/demo/run']['incident']['pending_notification'])

    def test_single_child_failure_is_diagnostic_but_repeated_failures_alert(self):
        store = MemoryStore()
        sent = []
        def send(url, notification):
            sent.append(notification)
            return {'delivered': True, 'message_id': '123', 'retry_after_seconds': 0}
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['material_child_failures']}
        record_incident(store, report, NOW, 'private-url', send)
        self.assertEqual(sent, [])
        record_incident(store, {**report, 'causes': ['material_child_failures', 'consecutive_failures']}, NOW, 'private-url', send)
        self.assertEqual(len(sent), 1)

    def test_real_incident_escalates_once_and_recovers_once(self):
        store = MemoryStore()
        sent = []
        def send(url, notification):
            sent.append(notification)
            return {'delivered': True, 'message_id': str(len(sent)), 'retry_after_seconds': 0}
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['excessive_runtime']}
        record_incident(store, report, NOW, 'private-url', send)
        worse = {**report, 'causes': ['excessive_runtime', 'consecutive_failures']}
        record_incident(store, worse, NOW + timedelta(hours=1), 'private-url', send)
        record_incident(store, report, NOW + timedelta(hours=2), 'private-url', send)
        record_incident(store, worse, NOW + timedelta(days=7), 'private-url', send)
        healthy = {**report, 'status': 'healthy', 'causes': []}
        record_incident(store, healthy, NOW + timedelta(days=8), 'private-url', send)
        record_incident(store, healthy, NOW + timedelta(days=9), 'private-url', send)
        self.assertEqual([n['kind'] for n in sent], ['incident', 'escalation', 'recovery'])
        from f.monitoring.notifications import format_notification
        self.assertEqual(format_notification(sent[-1]), 'Resolved: Run. Checks are back to normal.')

    def test_undelivered_incident_does_not_generate_recovery(self):
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['consecutive_failures']}
        pending = incident_transition(None, report, NOW)
        recovered = incident_transition(pending['state'], {**report, 'status': 'healthy'}, NOW)
        self.assertIsNone(recovered['notification'])

    def test_legacy_reminder_is_discarded_but_new_failure_delivery_retries(self):
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['consecutive_failures']}
        prior = {'active': True, 'causes': report['causes'], 'last_notified_at': NOW.isoformat(),
                 'pending_notification': {'kind': 'reminder', 'causes': report['causes']}}
        self.assertIsNone(incident_transition(prior, report, NOW)['notification'])
        initial = incident_transition(None, report, NOW)
        attempted = {**initial['state'], 'last_delivery_attempt_at': NOW.isoformat()}
        retry = incident_transition(attempted, report, NOW + timedelta(minutes=31))
        self.assertEqual(retry['notification']['id'], initial['notification']['id'])

    def test_missing_schedule_requires_sustained_delay_and_stays_deduplicated(self):
        store = MemoryStore()
        sent = []
        def send(url, notification):
            sent.append(notification)
            return {'delivered': True, 'message_id': '123', 'retry_after_seconds': 0}
        report = {'path': 'f/demo/run', 'status': 'unhealthy', 'causes': ['missing_execution']}
        record_incident(store, report, NOW, 'private-url', send)
        self.assertEqual(sent, [])
        report['causes'].append('lack_of_progress')
        for hours in [1, 2, 24, 48]:
            record_incident(store, report, NOW + timedelta(hours=hours), 'private-url', send)
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]['causes'], ['missing_execution'])

if __name__ == '__main__':
    unittest.main()
