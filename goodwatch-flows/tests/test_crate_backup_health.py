"""Crate snapshot age incidents: stale, missing, and unreadable."""

import copy
import io
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.backup_check import bounded, check_backup, collect_backup
from f.monitoring.backup_health import BACKUP_PATH, REPOSITORY, assess_backup
from f.monitoring.notifications import DETAIL_PATTERN, deliver_notification

import re

NOW = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)
WEBHOOK = "https://discord.com/api/webhooks/123/token"


def snapshot(age: timedelta, name: str = "hourly_20261005_090500"):
    finished = int((NOW - age).timestamp() * 1000)
    return {"complete": True, "newest": {"name": name, "finished": finished}}


class MemoryStore:
    def __init__(self, busy_attempts: int = 0) -> None:
        self.values = {}
        self.busy_attempts = busy_attempts
        self.acquired = 0
        self.released = 0

    def initialize(self) -> None:
        pass

    def acquire(self) -> bool:
        if self.busy_attempts > 0:
            self.busy_attempts -= 1
            return False
        self.acquired += 1
        return True

    def assert_owner(self) -> None:
        pass

    def release(self) -> None:
        self.released += 1

    def get(self, key):
        return copy.deepcopy(self.values.get(key))

    def put(self, key, kind, pipeline, value):
        self.values[key] = copy.deepcopy(value)


class Database:
    def __init__(self, rows=None, error=None):
        self.rows = rows or []
        self.error = error
        self.calls = []

    def select(self, sql, params=None):
        self.calls.append((sql, params))
        if self.error:
            raise self.error
        return self.rows


class AssessmentTests(unittest.TestCase):
    def test_recent_snapshot_is_healthy(self) -> None:
        report = assess_backup(snapshot(timedelta(hours=2, minutes=59)), NOW)
        self.assertEqual(report["path"], BACKUP_PATH)
        self.assertEqual(report["status"], "healthy")
        self.assertEqual(report["causes"], [])
        self.assertEqual(report["newest_snapshot_age_hours"], 3.0)

    def test_snapshot_older_than_three_hours_is_stale(self) -> None:
        report = assess_backup(snapshot(timedelta(hours=3, minutes=1)), NOW)
        self.assertEqual(report["status"], "unhealthy")
        self.assertEqual(report["causes"], ["crate_backup_stale"])
        self.assertIn("hourly_20261005_090500", report["detail"])
        self.assertIn("2026-10-05 08:59 UTC", report["detail"])

    def test_zero_rows_is_an_incident_not_unknown(self) -> None:
        for observation in [
            {"complete": True, "newest": None},
            {"complete": True, "newest": {"name": "x", "finished": None}},
        ]:
            with self.subTest(observation=observation):
                report = assess_backup(observation, NOW)
                self.assertEqual(report["status"], "unhealthy")
                self.assertEqual(report["causes"], ["crate_backup_missing"])

    def test_failed_read_is_an_incident_not_unknown(self) -> None:
        for observation in [{"complete": False}, {}]:
            with self.subTest(observation=observation):
                report = assess_backup(observation, NOW)
                self.assertEqual(report["status"], "unhealthy")
                self.assertEqual(report["causes"], ["crate_backup_unreadable"])
                self.assertFalse(report["observation_complete"])

    def test_every_detail_fits_the_notification_allowlist(self) -> None:
        for observation in [
            snapshot(timedelta(hours=1)),
            snapshot(timedelta(days=5), name="weekly_<@everyone>"),
            {"complete": True, "newest": None},
            {"complete": False},
        ]:
            with self.subTest(observation=observation):
                detail = assess_backup(observation, NOW)["detail"]
                self.assertTrue(re.fullmatch(DETAIL_PATTERN, detail), detail)


class CollectionTests(unittest.TestCase):
    def test_reads_the_newest_successful_snapshot_of_the_repository(self) -> None:
        row = {"name": "hourly_a", "finished": 1}
        db = Database([row])
        self.assertEqual(collect_backup(db), {"complete": True, "newest": row})
        sql, params = db.calls[0]
        self.assertIn("sys.snapshots", sql)
        self.assertIn("state = 'SUCCESS'", sql)
        self.assertEqual(params, (REPOSITORY,))

    def test_zero_rows_is_complete_with_no_snapshot(self) -> None:
        self.assertEqual(
            collect_backup(Database([])), {"complete": True, "newest": None}
        )

    def test_query_error_is_incomplete_and_hides_the_message(self) -> None:
        result = collect_backup(Database(error=RuntimeError("secret host")))
        self.assertEqual(result, {"complete": False})

    def test_read_that_hangs_is_cut_off(self) -> None:
        release = Event()
        self.addCleanup(release.set)
        self.assertEqual(
            bounded(lambda: release.wait(30) and {}, 0.05), {"complete": False}
        )

    def test_read_that_raises_is_incomplete(self) -> None:
        def broken():
            raise RuntimeError("connection failed")

        self.assertEqual(bounded(broken, 1), {"complete": False})


class CheckTests(unittest.TestCase):
    def run_check(self, observation, store, webhook=None, **options):
        return check_backup(
            lambda: observation,
            store,
            webhook,
            clock=lambda: NOW,
            sleep=lambda seconds: None,
            **options,
        )

    def test_stale_snapshot_opens_an_incident_and_a_fresh_one_recovers(self) -> None:
        store = MemoryStore()
        report = self.run_check(snapshot(timedelta(hours=5)), store)
        self.assertEqual(report["notification"]["transition"], "opened")
        state = store.values["pipeline:" + BACKUP_PATH]["incident"]
        self.assertTrue(state["active"])
        self.assertEqual(state["causes"], ["crate_backup_stale"])

        report = self.run_check(snapshot(timedelta(minutes=30)), store)
        self.assertEqual(report["notification"]["transition"], "recovered")
        self.assertFalse(store.values["pipeline:" + BACKUP_PATH]["incident"]["active"])
        self.assertEqual(store.acquired, store.released)

    def test_zero_rows_and_failed_read_open_incidents(self) -> None:
        for observation, cause in [
            ({"complete": True, "newest": None}, "crate_backup_missing"),
            ({"complete": False}, "crate_backup_unreadable"),
        ]:
            with self.subTest(cause=cause):
                store = MemoryStore()
                report = self.run_check(observation, store)
                self.assertEqual(report["notification"]["transition"], "opened")
                self.assertEqual(report["causes"], [cause])

    def test_waits_for_the_lease_of_the_five_minute_check(self) -> None:
        store = MemoryStore(busy_attempts=3)
        report = self.run_check(snapshot(timedelta(hours=1)), store)
        self.assertEqual(report["status"], "healthy")
        self.assertEqual(store.acquired, 1)

    def test_lease_that_stays_busy_fails_the_job(self) -> None:
        store = MemoryStore(busy_attempts=10**6)
        with self.assertRaisesRegex(RuntimeError, "lease busy"):
            self.run_check(snapshot(timedelta(hours=5)), store)
        self.assertEqual(store.values, {})

    def test_incident_message_names_the_cause_and_the_snapshot(self) -> None:
        store = MemoryStore()
        opener = Mock()
        opener.open.return_value = io.BytesIO(b'{"id":"998877"}')
        with patch("f.monitoring.notifications.build_opener", return_value=opener):
            report = self.run_check(snapshot(timedelta(hours=5)), store, WEBHOOK)
        self.assertTrue(report["notification"]["delivery"]["delivered"])
        content = json.loads(opener.open.call_args.args[0].data)["content"]
        self.assertIn("incident: f/monitoring/crate_backup", content)
        self.assertIn("Cause: crate_backup_stale", content)
        self.assertIn("hourly_20261005_090500", content)
        self.assertIn("5.0 hours ago (limit 3 hours)", content)
        self.assertNotIn("No resolved execution", content)

    def test_all_backup_causes_are_deliverable(self) -> None:
        opener = Mock()
        opener.open.side_effect = lambda *a, **k: io.BytesIO(b'{"id":"1"}')
        with patch("f.monitoring.notifications.build_opener", return_value=opener):
            for observation in [
                snapshot(timedelta(hours=5)),
                {"complete": True, "newest": None},
                {"complete": False},
            ]:
                report = assess_backup(observation, NOW)
                notice = {
                    "kind": "incident",
                    "pipeline": report["path"],
                    "causes": report["causes"],
                    "job_id": None,
                    "detail": report["detail"],
                }
                with self.subTest(causes=report["causes"]):
                    self.assertTrue(
                        deliver_notification(WEBHOOK, notice)["delivered"]
                    )


if __name__ == "__main__":
    unittest.main()
