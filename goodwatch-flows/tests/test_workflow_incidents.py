import copy
from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.incidents import record_incident


class MemoryStore:
    def __init__(self):
        self.rows = {}

    def get(self, key):
        return copy.deepcopy(self.rows.get(key))

    def put(self, key, kind, pipeline, value):
        self.rows[key] = copy.deepcopy(value)

    def assert_owner(self):
        pass


class WorkflowIncidentTests(unittest.TestCase):
    def test_incident_persists_before_send_and_success_deduplicates(self):
        store = MemoryStore()
        sent = []
        now = datetime(2026, 9, 11, tzinfo=timezone.utc)
        report = {"path": "f/demo/run", "status": "unhealthy",
                  "causes": ["excessive_runtime"], "latest_job_id": None}

        def send(url, notification):
            self.assertTrue(store.get("pipeline:f/demo/run")["incident"]["active"])
            sent.append(notification)
            return {"delivered": True, "message_id": "123", "error_code": None,
                    "retry_after_seconds": 0, "permanent_failure": False}

        record_incident(store, report, now, "private-test-url", send)
        record_incident(store, report, now + timedelta(minutes=5), "private-test-url", send)
        self.assertEqual(len(sent), 1)
        self.assertNotIn("private-test-url", str(store.rows))

    def test_failed_delivery_retains_incident_and_global_backoff(self):
        store = MemoryStore()
        sent = []
        now = datetime(2026, 9, 11, tzinfo=timezone.utc)
        report = {"path": "f/demo/run", "status": "unhealthy",
                  "causes": ["excessive_runtime"], "latest_job_id": None}

        def send(url, notification):
            sent.append(notification)
            return {"delivered": False, "message_id": None,
                    "error_code": "rate_limited", "retry_after_seconds": 3600,
                    "permanent_failure": False}

        record_incident(store, report, now, "private-url", send)
        record_incident(store, report, now + timedelta(minutes=35), "private-url", send)
        other = {**report, "path": "f/demo/other"}
        record_incident(store, other, now + timedelta(minutes=40), "private-url", send)
        state = store.get("pipeline:f/demo/run")["incident"]
        self.assertTrue(state["active"])
        self.assertIsNotNone(state["pending_notification"])
        self.assertEqual(state["last_delivery"]["error_code"], "rate_limited")
        self.assertEqual(len(sent), 1)

    def test_reconfigured_webhook_retries_pending_incident_immediately(self):
        store = MemoryStore()
        sent = []
        now = datetime(2026, 9, 11, tzinfo=timezone.utc)
        report = {"path": "f/demo/run", "status": "unhealthy",
                  "causes": ["excessive_runtime"], "latest_job_id": None}

        def send(url, notification):
            sent.append(url)
            return {"delivered": False, "message_id": None, "error_code": "http_404",
                    "retry_after_seconds": 1800, "permanent_failure": True}

        record_incident(store, report, now, "old-url", send)
        record_incident(store, report, now + timedelta(minutes=5), "old-url", send)
        record_incident(store, report, now + timedelta(minutes=6), "new-url", send)
        self.assertEqual(sent, ["old-url", "new-url"])


if __name__ == "__main__":
    unittest.main()
