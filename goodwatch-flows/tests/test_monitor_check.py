"""Public checker orchestration against bounded API and durable ledger fixtures."""

import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.check import poll

NOW = datetime(2026, 9, 11, 12, tzinfo=timezone.utc)
PIPELINE = "f/tmdb_web/tmdb_init_providers"
SCHEDULE = {
    "path": PIPELINE,
    "script_path": PIPELINE,
    "schedule": "0 0 0 * * * *",
    "timezone": "UTC",
    "enabled": True,
}


class MemoryStore:
    def __init__(self) -> None:
        self.values = {}
        self.ledger = {}
        self.released = False

    def initialize(self) -> None:
        pass

    def acquire(self) -> bool:
        return True

    def assert_owner(self) -> None:
        pass

    def release(self) -> None:
        self.released = True

    def get(self, key):
        return copy.deepcopy(self.values.get(key))

    def put(self, key, kind, pipeline, value):
        self.values[key] = copy.deepcopy(value)

    def jobs(self, pipeline):
        return copy.deepcopy(self.ledger.get(pipeline, {}))

    def save_jobs(self, pipeline, jobs):
        self.ledger.setdefault(pipeline, {}).update(
            {job["id"]: copy.deepcopy(job) for job in jobs}
        )


class Api:
    def __init__(self, identifiers=None, jobs=None, schedules=None):
        self.identifiers = identifiers or []
        self.executions = jobs or {}
        self.schedules = schedules or [SCHEDULE]
        self.calls = []

    def __call__(self, path):
        self.calls.append(path)
        if path == "schedules/list":
            return self.schedules
        if path.startswith("jobs/queue/list"):
            return []
        if path.startswith("jobs/list_filtered_uuids"):
            return self.identifiers
        if path.startswith("jobs_u/get_root_job_id/"):
            return path.rsplit("/", 1)[-1]
        if path.startswith("jobs_u/get/"):
            return self.executions[path.rsplit("/", 1)[-1]]
        raise AssertionError(path)


class MonitorCheckTests(unittest.TestCase):
    def test_tracked_running_execution_completes_outside_incremental_inventory(
        self,
    ) -> None:
        store = MemoryStore()
        store.ledger[PIPELINE] = {
            "old": {
                "id": "old",
                "parent_resolved": True,
                "parent_job": None,
                "running": True,
                "started_at": "2026-09-09T20:00:00Z",
            }
        }
        api = Api(
            jobs={
                "old": {
                    "id": "old",
                    "success": True,
                    "running": False,
                    "started_at": "2026-09-09T20:00:00Z",
                    "completed_at": "2026-09-11T11:00:00Z",
                    "result": {"inserted": 4},
                }
            }
        )
        result = poll(api, store, NOW, notify=False)
        report = result["pipelines"][0]
        self.assertEqual(report["outcomes"]["useful"], 1)
        self.assertFalse(store.ledger[PIPELINE]["old"]["running"])
        self.assertTrue(store.released)
        self.assertIn("jobs_u/get/old", api.calls)

    def test_bounded_history_is_unknown_without_false_root_counts(
        self,
    ) -> None:
        jobs = {
            name: {
                "id": name,
                "success": True,
                "started_at": "2026-09-11T00:00:00Z",
                "duration_ms": 1000,
                "result": {"processed": 2},
            }
            for name in ["a", "b", "c"]
        }
        result = poll(
            Api(["a", "b", "c"], jobs),
            MemoryStore(),
            NOW,
            notify=False,
            max_resolutions=1,
        )
        report = result["pipelines"][0]
        self.assertEqual(report["root_count"], 1)
        self.assertEqual(report["inventory_candidate_count"], 3)
        self.assertEqual(report["uninspected_count"], 2)
        self.assertEqual(report["status"], "unknown")
        self.assertEqual(result["resolved_this_poll"], 1)

    def test_api_inventory_failure_does_not_claim_workflow_failure_from_infrastructure(
        self,
    ) -> None:
        base = Api()

        def api(path):
            if path.startswith("jobs/list_filtered_uuids"):
                raise RuntimeError("unavailable")
            return base(path)

        result = poll(api, MemoryStore(), NOW, notify=False)
        self.assertEqual(result["infrastructure"]["windmill_api"], "degraded")
        self.assertEqual(result["pipelines"][0]["status"], "unknown")
        self.assertEqual(result["pipelines"][0]["causes"], [])

    def test_lease_overlap_does_not_call_api(self) -> None:
        store = MemoryStore()
        store.acquire = lambda: False
        api = Api()
        self.assertEqual(poll(api, store, NOW)["status"], "overlap")
        self.assertEqual(api.calls, [])

    def test_all_daily_schedules_are_reported_even_without_resolution_budget(
        self,
    ) -> None:
        from f.monitoring.check import DAILY_PATHS

        schedules = [
            {**SCHEDULE, "path": path, "script_path": path}
            for path in DAILY_PATHS
        ]
        result = poll(
            Api(["uninspected"], schedules=schedules),
            MemoryStore(),
            NOW,
            notify=False,
            max_resolutions=0,
        )
        self.assertEqual(len(result["pipelines"]), 8)
        self.assertEqual(result["daily_paths_missing"], [])
        self.assertTrue(
            all(
                report["status"] == "unknown" for report in result["pipelines"]
            )
        )

    def test_schedule_api_outage_records_infrastructure_without_recovering_incidents(
        self,
    ) -> None:
        store = MemoryStore()

        def unavailable(path):
            raise RuntimeError("unavailable")

        result = poll(unavailable, store, NOW, notify=False)
        self.assertEqual(result["status"], "infrastructure_failure")
        self.assertEqual(
            result["infrastructure"]["windmill_api"], "unavailable"
        )
        self.assertIn("latest-check-failure", store.values)
        self.assertNotIn("pipeline:" + PIPELINE, store.values)
        self.assertTrue(store.released)


if __name__ == "__main__":
    unittest.main()
