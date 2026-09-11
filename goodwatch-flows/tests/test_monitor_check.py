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

    def test_backlog_reports_persist_independent_progress_and_group_incidents(
        self,
    ) -> None:
        from datetime import timedelta

        store = MemoryStore()
        country = {
            "complete": True,
            "overdue_country_count": 12,
            "overdue_title_count": 4,
            "oldest_due_at": "2026-09-11T08:00:00Z",
        }
        publication = {
            "complete": True,
            "overdue_title_count": 0,
            "outstanding_demand": 0,
        }

        def collect(ledger, jobs, now, remaining_seconds):
            self.assertIs(ledger, store)
            self.assertLessEqual(remaining_seconds, 60)
            return {"country": country, "publication": publication}

        first = poll(
            Api(), store, NOW, notify=False, backlog_collector=collect, clock=lambda: 0
        )
        second = poll(
            Api(),
            store,
            NOW + timedelta(hours=1),
            notify=False,
            backlog_collector=collect,
            clock=lambda: 0,
        )
        self.assertEqual(len(second["pipelines"]), 3)
        self.assertEqual(
            second["backlog_status_counts"], {"unhealthy": 1, "healthy": 1}
        )
        self.assertIn("backlog-progress", store.values)
        self.assertTrue(
            store.values["pipeline:f/monitoring/country_backlog"]["incident"][
                "active"
            ]
        )
        self.assertIn(PIPELINE, second["daily_paths_present"])

    def test_backlog_collection_failure_reports_unknown_without_false_recovery(
        self,
    ) -> None:
        store = MemoryStore()

        def unavailable(*args):
            raise RuntimeError("sensitive upstream details must not escape")

        result = poll(
            Api(), store, NOW, notify=False, backlog_collector=unavailable
        )
        self.assertEqual(result["infrastructure"]["backlogs"], "degraded")
        self.assertEqual(result["backlog_status_counts"], {"unknown": 2})
        self.assertNotIn("sensitive", str(result))

    def test_workflow_collection_reserves_budget_for_backlog_queries(
        self,
    ) -> None:
        elapsed = [0.0]
        base = Api(["uninspected"])

        def api(path):
            elapsed[0] += 10
            return base(path)

        admitted = []

        def collect(store, jobs, now, remaining_seconds):
            admitted.append(remaining_seconds)
            return {
                "country": {
                    "complete": True,
                    "overdue_country_count": 0,
                    "overdue_title_count": 0,
                },
                "publication": {"complete": True, "overdue_title_count": 0},
            }

        result = poll(
            api,
            MemoryStore(),
            NOW,
            notify=False,
            backlog_collector=collect,
            budget_seconds=100,
            clock=lambda: elapsed[0],
        )
        self.assertEqual(result["resolved_this_poll"], 0)
        self.assertEqual(admitted, [60])
        self.assertEqual(result["backlog_status_counts"], {"healthy": 2})

    def test_legacy_completed_observation_is_refreshed_for_new_evidence(
        self,
    ) -> None:
        store = MemoryStore()
        store.ledger[PIPELINE] = {
            "old": {
                "id": "old",
                "parent_resolved": True,
                "parent_job": None,
                "success": True,
                "running": False,
                "started_at": "2026-09-11T00:00:00Z",
                "completed_at": "2026-09-11T00:01:00Z",
            }
        }
        api = Api(
            jobs={
                "old": {
                    "id": "old",
                    "success": True,
                    "started_at": "2026-09-11T00:00:00Z",
                    "duration_ms": 60000,
                    "result": {"processed": 2},
                }
            }
        )
        poll(api, store, NOW, notify=False)
        self.assertIn("jobs_u/get/old", api.calls)
        self.assertEqual(
            store.ledger[PIPELINE]["old"]["observation_version"], 2
        )

    def test_inflight_source_success_uses_snapshot_completion_for_progress_and_recovery(
        self,
    ) -> None:
        from datetime import timedelta

        elapsed = [1000.0]
        store = MemoryStore()
        earlier = NOW - timedelta(hours=1)
        store.values["backlog-progress"] = {
            "country": {
                "last_progress_at": earlier.isoformat(),
                "count": 12,
                "pending_count": 12,
                "oldest_due_at": "2026-09-11T08:00:00Z",
                "last_success_at": earlier.isoformat(),
                "observation_complete": True,
            }
        }
        store.values["pipeline:f/monitoring/country_backlog"] = {
            "incident": {
                "active": True,
                "opened_at": earlier.isoformat(),
                "causes": ["country_backlog_stalled"],
                "pending_notification": None,
                "last_notified_at": earlier.isoformat(),
            }
        }

        def collect(ledger, jobs, now, remaining_seconds):
            elapsed[0] += 120
            return {
                "country": {
                    "complete": True,
                    "overdue_country_count": 12,
                    "overdue_title_count": 4,
                    "oldest_due_at": "2026-09-11T08:00:00Z",
                    "last_success_at": (
                        NOW + timedelta(seconds=90)
                    ).isoformat(),
                },
                "publication": {"complete": True, "overdue_title_count": 0},
            }

        result = poll(
            Api(),
            store,
            NOW,
            notify=False,
            backlog_collector=collect,
            clock=lambda: elapsed[0],
        )
        completed = (NOW + timedelta(seconds=120)).isoformat()
        country = next(
            report
            for report in result["pipelines"]
            if report["path"] == "f/monitoring/country_backlog"
        )
        self.assertEqual(country["status"], "healthy")
        self.assertTrue(country["progress_observed"])
        self.assertEqual(country["observed_at"], completed)
        self.assertEqual(result["backlog_observed_at"], completed)
        self.assertEqual(
            store.values["backlog-progress"]["country"]["last_observed_at"],
            completed,
        )
        self.assertEqual(
            store.values["pipeline:f/monitoring/country_backlog"]["incident"][
                "recovered_at"
            ],
            completed,
        )


if __name__ == "__main__":
    unittest.main()
