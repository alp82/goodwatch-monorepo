"""Folded ledger history: a poll reads recent rows, and reports stay the same."""

import copy
import random
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
sys.path.insert(0, str(Path(__file__).parent))
from f.monitoring import check
from f.monitoring.check import boundary_id, poll
from f.monitoring.health import assess_pipeline, empty_history, fold_history
from test_monitor_check import Api, MemoryStore

NOW = datetime(2026, 11, 13, 12, tzinfo=timezone.utc)
OBSERVATION_START = datetime(2026, 9, 9, 21, 1, 10, tzinfo=timezone.utc)
THRESHOLDS = {
    "runtime_seconds": 3600,
    "grace_seconds": 600,
    "progress_seconds": 86400,
    "consecutive_failures": 3,
}
PATH = "f/priority/crawl_all"
SCHEDULE = {"path": PATH, "script_path": PATH, "schedule": "0 0 * * * *",
            "timezone": "UTC", "enabled": True}


def job_id(at: datetime, n: int = 0) -> str:
    """A Windmill-style id: the creation time comes first."""
    return boundary_id(at)[:-12] + f"{n:012x}"


def random_root(rng: random.Random, n: int, at: datetime) -> dict:
    kind = rng.choice(["useful", "useful", "no_work", "failure", "overlap",
                       "cancelled", "unknown", "external_deferred"])
    job = {
        "id": job_id(at, n),
        "parent_resolved": rng.random() > 0.05,
        "parent_job": None if rng.random() > 0.05 else "parent",
        "started_at": (at - timedelta(minutes=1)).isoformat(),
        "completed_at": at.isoformat(),
        "success": kind not in {"failure", "cancelled"},
        "outcome": kind,
        "canceled": kind == "cancelled",
        "tolerable_external_failure_count": rng.choice([0, 0, 2]),
    }
    if rng.random() < 0.1:
        job["material_child_failures"] = ["child"]
    if rng.random() < 0.1:
        job["material_outcome_failures"] = ["error"]
    if rng.random() < 0.05:
        job["missing_descendants"] = ["gone"]
    return job


class FoldedAssessmentTests(unittest.TestCase):
    def test_folding_old_rows_in_any_order_keeps_the_report(self) -> None:
        for seed in range(200):
            rng = random.Random(seed)
            jobs = []
            for n in range(rng.randint(0, 60)):
                # Some rows share a time, like runs that finish in the same second.
                hours = rng.choice([1, 5, 30, 60, 60, 200, 2000])
                jobs.append(random_root(rng, n, NOW - timedelta(hours=hours)))
            if rng.random() < 0.3:
                jobs.append({**random_root(rng, 99, NOW), "running": True,
                             "success": None, "completed_at": None,
                             "started_at": (NOW - timedelta(hours=2)).isoformat()})
            schedule = {**SCHEDULE, "schedule": rng.choice(
                ["0 0 * * * *", "0 */20 * * * *", "0 0 6 * * *"])}
            expected = assess_pipeline(
                schedule, copy.deepcopy(jobs), NOW, OBSERVATION_START, THRESHOLDS)
            # Rows older than slot coverage fold; they arrive in several batches.
            old = [job for job in jobs if job["completed_at"]
                   and datetime.fromisoformat(job["completed_at"])
                   < NOW - timedelta(hours=49)]
            if "6 * * *" in schedule["schedule"]:
                old = []
            rng.shuffle(old)
            history = empty_history()
            cut = rng.randint(0, len(old))
            fold_history(history, old[:cut], NOW - timedelta(hours=1), OBSERVATION_START)
            fold_history(history, old[cut:], NOW, OBSERVATION_START)
            history = copy.deepcopy(history)
            recent = [job for job in jobs if job not in old]
            actual = assess_pipeline(
                schedule, recent, NOW, OBSERVATION_START, THRESHOLDS, history)
            self.assertEqual(actual, expected, f"seed {seed}")


def execution(at: datetime, n: int, success: bool = True) -> dict:
    return {
        "id": job_id(at, n),
        "parent_job": None,
        "success": success,
        "started_at": at.isoformat(),
        "duration_ms": 1000,
        "result": {"inserted": 1} if success else {"error": "failed"},
    }


class FoldedPollTests(unittest.TestCase):
    """An hourly schedule with 10 days of runs; Windmill lists the last 7."""

    def setUp(self) -> None:
        self.runs = {}
        for hour in range(1, 240):
            run = execution(NOW - timedelta(hours=hour), 0, success=hour % 7 != 3)
            self.runs[run["id"]] = run
        self.listed = sorted(
            identity for identity, run in self.runs.items()
            if datetime.fromisoformat(run["started_at"]) > NOW - timedelta(days=7)
        )

    def api(self, now: datetime, extra: dict | None = None) -> Api:
        # Windmill has only the runs it lists.
        runs = {i: self.runs[i] for i in self.listed} | (extra or {})
        api = Api(jobs=runs, schedules=[SCHEDULE])
        api.identifiers = self.listed + sorted(extra or {})
        return api

    def seeded_store(self) -> MemoryStore:
        """A ledger like production's: every run observed, before folding."""
        store = MemoryStore()
        poll(self.api(NOW), store, NOW, notify=False)
        store.values.pop("history:" + PATH)
        # Older than Windmill keeps: observed once, then lost from Windmill.
        for identity, run in self.runs.items():
            if identity not in store.ledger[PATH]:
                store.ledger[PATH][identity] = {
                    **run, "observation_version": 2, "parent_resolved": True,
                    "completed_at": (datetime.fromisoformat(run["started_at"])
                                     + timedelta(seconds=1)).isoformat(),
                    "outcome": "useful" if run["success"] else "failure",
                }
        return store

    def unfolded_report(self, store: MemoryStore, now: datetime, api: Api) -> dict:
        reference = copy.deepcopy(store)
        reference.values.pop("history:" + PATH, None)
        with mock.patch.object(check, "folds_history", return_value=False):
            result = poll(api, reference, now, notify=False)
        return result["pipelines"][0]

    def test_second_poll_reads_two_days_and_reports_the_same(self) -> None:
        store = self.seeded_store()
        expected = self.unfolded_report(store, NOW, self.api(NOW))
        first = poll(self.api(NOW), store, NOW, notify=False)["pipelines"][0]
        self.assertEqual(first, expected)
        history = store.values["history:" + PATH]
        self.assertEqual(history["boundary"], boundary_id(NOW - timedelta(hours=49)))
        self.assertEqual(history["pending"], [])

        later = NOW + timedelta(minutes=5)
        expected = self.unfolded_report(store, later, self.api(later))
        store.reads = []
        api = self.api(later)
        second = poll(api, store, later, notify=False)["pipelines"][0]
        self.assertEqual(second, expected)
        self.assertEqual(second["root_count"], 239)
        self.assertEqual(second["uninspected_count"], 0)
        # The 49 hourly runs from the boundary on; nothing else is read.
        self.assertEqual(store.reads, [("recent", PATH, 49)])
        self.assertFalse([c for c in api.calls if c.startswith("jobs_u/get/")])

    def test_a_crash_after_saving_rows_neither_loses_nor_repeats_them(self) -> None:
        store = self.seeded_store()
        # A listed run older than the boundary that no poll has resolved yet.
        late = self.listed[10]
        del store.ledger[PATH][late]
        poll(self.api(NOW), store, NOW, notify=False, max_resolutions=0)
        self.assertEqual(store.values["history:" + PATH]["unobserved"], [late])
        # The next poll resolves it, then dies before writing the history.
        later = NOW + timedelta(minutes=5)
        original = store.put

        def crash(key, kind, pipeline, value):
            if key.startswith("history:"):
                raise RuntimeError("crash")
            original(key, kind, pipeline, value)

        store.put = crash
        with self.assertRaises(RuntimeError):
            poll(self.api(later), store, later, notify=False)
        store.put = original
        self.assertIn(late, store.ledger[PATH])

        for minutes in (10, 15):
            now = NOW + timedelta(minutes=minutes)
            expected = self.unfolded_report(store, now, self.api(now))
            report = poll(self.api(now), store, now, notify=False)["pipelines"][0]
            self.assertEqual(report["root_count"], 239)
            self.assertEqual(report["uninspected_count"], 0)
            self.assertEqual(report, expected)
        self.assertEqual(store.values["history:" + PATH]["unobserved"], [])

    def test_incomplete_rows_wait_while_windmill_lists_them(self) -> None:
        store = self.seeded_store()
        listed_old = self.listed[0]
        gone_old = min(store.ledger[PATH])
        # Its descendant can't be read, so it stays incomplete.
        self.runs[listed_old]["flow_status"] = {"modules": [{"job": "gone"}]}
        for identity in (listed_old, gone_old):
            store.ledger[PATH][identity].update(
                evidence_incomplete=True, unresolved_descendants=["child"])
        api = self.api(NOW)
        report = poll(api, store, NOW, notify=False)["pipelines"][0]
        history = store.values["history:" + PATH]
        self.assertIn(listed_old, history["pending"])
        self.assertNotIn(gone_old, history["pending"])
        self.assertEqual(history["unresolved_count"], 1)
        # Kept as observed, not replaced by a lookup error.
        self.assertNotIn("jobs_u/get/" + gone_old, api.calls)
        self.assertEqual(report["root_count"], 239)

        later = NOW + timedelta(minutes=5)
        api = self.api(later)
        report = poll(api, store, later, notify=False)["pipelines"][0]
        self.assertEqual(report["unresolved_count"], 2)
        self.assertIn("jobs_u/get/" + listed_old, api.calls)
        self.assertNotIn("jobs_u/get/" + gone_old, api.calls)
        self.assertIn(listed_old, store.values["history:" + PATH]["pending"])

    def test_the_boundary_waits_while_the_run_list_is_unavailable(self) -> None:
        store = self.seeded_store()
        poll(self.api(NOW), store, NOW, notify=False)
        boundary = store.values["history:" + PATH]["boundary"]
        later = NOW + timedelta(hours=3)
        api = self.api(later)

        def no_list(path):
            if path.startswith("jobs/list_filtered_uuids"):
                raise RuntimeError("unavailable")
            return api(path)

        report = poll(no_list, store, later, notify=False)["pipelines"][0]
        self.assertEqual(store.values["history:" + PATH]["boundary"], boundary)
        self.assertEqual(report["root_count"], 239)

    def test_a_pending_row_a_read_misses_stays_pending(self) -> None:
        store = self.seeded_store()
        listed_old = self.listed[0]
        self.runs[listed_old]["flow_status"] = {"modules": [{"job": "gone"}]}
        store.ledger[PATH][listed_old].update(
            evidence_incomplete=True, unresolved_descendants=["child"])
        poll(self.api(NOW), store, NOW, notify=False)
        self.assertIn(listed_old, store.values["history:" + PATH]["pending"])
        recent = store.recent_jobs

        def not_yet_visible(pipeline, boundary, keys):
            rows = recent(pipeline, boundary, keys)
            rows.pop(listed_old, None)
            return rows

        store.recent_jobs = not_yet_visible
        later = NOW + timedelta(minutes=5)
        poll(self.api(later), store, later, notify=False)
        store.recent_jobs = recent
        self.assertIn(listed_old, store.values["history:" + PATH]["pending"])
        now = NOW + timedelta(minutes=10)
        report = poll(self.api(now), store, now, notify=False)["pipelines"][0]
        self.assertEqual(report["root_count"], 239)

    def test_a_poll_with_a_day_long_interval_reads_every_row(self) -> None:
        store = self.seeded_store()
        poll(self.api(NOW), store, NOW, notify=False)
        later = NOW + timedelta(minutes=5)
        store.reads = []
        with mock.patch.object(check, "folds_history", return_value=False):
            report = poll(self.api(later), store, later, notify=False)
        self.assertEqual(store.reads, [("all", PATH, 239)])
        self.assertEqual(report["pipelines"][0]["root_count"], 239)
        now = NOW + timedelta(minutes=10)
        expected = self.unfolded_report(store, now, self.api(now))
        self.assertEqual(
            poll(self.api(now), store, now, notify=False)["pipelines"][0], expected)

    def test_a_missed_pending_row_resolved_by_backfill_is_counted_once(self) -> None:
        store = self.seeded_store()
        listed_old = self.listed[0]
        store.ledger[PATH][listed_old].update(
            evidence_incomplete=True, unresolved_descendants=["child"])
        # Not refreshed in this poll, so it stays pending.
        poll(self.api(NOW), store, NOW, notify=False, max_resolutions=0)
        self.assertIn(listed_old, store.values["history:" + PATH]["pending"])
        recent = store.recent_jobs

        def not_yet_visible(pipeline, boundary, keys):
            rows = recent(pipeline, boundary, keys)
            rows.pop(listed_old, None)
            return rows

        # The read misses it; the poll resolves the listed run and folds it.
        store.recent_jobs = not_yet_visible
        later = NOW + timedelta(minutes=5)
        poll(self.api(later), store, later, notify=False)
        store.recent_jobs = recent
        self.assertNotIn(listed_old, store.values["history:" + PATH]["pending"])
        for minutes in (10, 15):
            now = NOW + timedelta(minutes=minutes)
            report = poll(self.api(now), store, now, notify=False)["pipelines"][0]
            self.assertEqual(report["root_count"], 239)

    def test_a_poll_reading_every_row_leaves_folded_rows_alone(self) -> None:
        store = self.seeded_store()
        gone_old = min(store.ledger[PATH])
        store.ledger[PATH][gone_old].update(
            evidence_incomplete=True, unresolved_descendants=["child"])
        poll(self.api(NOW), store, NOW, notify=False)
        later = NOW + timedelta(minutes=5)
        api = self.api(later)
        with mock.patch.object(check, "folds_history", return_value=False):
            poll(api, store, later, notify=False)
        self.assertNotIn("jobs_u/get/" + gone_old, api.calls)
        now = NOW + timedelta(minutes=10)
        report = poll(self.api(now), store, now, notify=False)["pipelines"][0]
        self.assertEqual(report["root_count"], 239)
        self.assertEqual(report["unresolved_count"], 1)


class FoldLedgerTests(unittest.TestCase):
    def plan(self, jobs: dict, ids: set, history: dict | None = None) -> dict:
        return {"jobs": jobs, "ids": ids, "history": history, "folded_ids": set(),
                "inventory_ok": True, "oldest_listed": min(ids) if ids else None,
                "queued": set()}

    def stub(self, identity: str) -> dict:
        return {"id": identity, "observation_version": 2, "parent_resolved": False,
                "lookup_error": "job_unavailable"}

    def test_a_run_the_queue_still_lists_is_not_folded_as_gone(self) -> None:
        old = job_id(NOW - timedelta(days=20))
        listed = job_id(NOW - timedelta(days=13))
        history = check.fold_ledger(
            self.plan({old: self.stub(old)}, {listed, old}), NOW)
        self.assertEqual(history["pending"], [old])

    def test_a_gone_run_that_finished_recently_waits_for_coverage(self) -> None:
        old = job_id(NOW - timedelta(days=20))
        listed = job_id(NOW - timedelta(days=13))
        row = {"id": old, "observation_version": 2, "parent_resolved": True,
               "parent_job": None, "success": True, "evidence_incomplete": True,
               "started_at": (NOW - timedelta(days=20)).isoformat(),
               "completed_at": (NOW - timedelta(hours=2)).isoformat()}
        history = check.fold_ledger(self.plan({old: row}, {listed}), NOW)
        self.assertEqual(history["pending"], [old])
        self.assertEqual(history["history"]["root_count"], 0)

    def test_an_unobserved_run_windmill_dropped_is_still_read_by_id(self) -> None:
        old = job_id(NOW - timedelta(days=15))
        listed = job_id(NOW - timedelta(days=13))
        first = check.fold_ledger(self.plan({}, {old, listed}), NOW)
        self.assertEqual(first["unobserved"], [old, listed])
        later = NOW + timedelta(days=1)
        second = check.fold_ledger(self.plan({}, {listed}, first), later)
        self.assertIn(old, second["unobserved"])

    def test_a_queued_run_not_yet_due_stays_unobserved(self) -> None:
        queued = job_id(NOW - timedelta(days=3))
        listed = job_id(NOW - timedelta(days=13))
        plan = self.plan({}, {listed})
        plan["queued"] = {queued}
        history = check.fold_ledger(plan, NOW)
        self.assertIn(queued, history["unobserved"])
        self.assertFalse(check.is_folded(queued, history))


if __name__ == "__main__":
    unittest.main()
