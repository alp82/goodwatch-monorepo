"""Public workflow assessment fixtures, independent of Windmill collection."""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.health import assess_pipeline, incident_transition

NOW = datetime(2026, 9, 11, 12, tzinfo=timezone.utc)
START = datetime(2026, 9, 11, tzinfo=timezone.utc)
SCHEDULE = {
    "path": "daily",
    "schedule": "0 6 * * *",
    "timezone": "UTC",
    "enabled": True,
}
THRESHOLDS = {
    "runtime_seconds": 3600,
    "grace_seconds": 600,
    "progress_seconds": 86400,
    "consecutive_failures": 3,
}


def job(identity: str, **fields: object) -> dict:
    return {
        "id": identity,
        "parent_resolved": True,
        "parent_job": None,
        "started_at": "2026-09-11T06:00:00Z",
        "completed_at": "2026-09-11T06:10:00Z",
        "success": True,
        "outcome": "useful",
        **fields,
    }


class WorkflowHealthTests(unittest.TestCase):
    def test_only_resolved_roots_count_and_duplicates_do_not_inflate_success(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [
                job("root"),
                job("root"),
                job("child", parent_job="root"),
                job("unknown", parent_resolved=False),
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["root_count"], 1)
        self.assertEqual(report["outcomes"]["useful"], 1)
        self.assertEqual(report["unknown_parent_count"], 1)
        self.assertEqual(report["status"], "unknown")
        self.assertNotIn("args", str(report))

    def test_outcomes_distinguish_empty_overlap_cancelled_and_unproven_success(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [
                job("empty", outcome="no_work"),
                job("skip", is_skipped=True),
                job("cancel", canceled=True, success=False),
                job("failed", success=False),
                job("unproven", outcome=None),
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(
            report["outcomes"],
            {
                "no_work": 1,
                "overlap": 1,
                "cancelled": 1,
                "failure": 1,
                "success_unknown": 1,
            },
        )
        self.assertEqual(report["status"], "unknown")

    def test_cron_variants_and_future_daily_work(self) -> None:
        for cron in ["0 16 * * *", "0 0 16 * * *", "0 0 16 * * * 2026"]:
            with self.subTest(cron=cron):
                report = assess_pipeline(
                    {
                        **SCHEDULE,
                        "schedule": cron,
                        "timezone": "Europe/Berlin",
                    },
                    [],
                    NOW,
                    START,
                    THRESHOLDS,
                )
                self.assertEqual(report["due_count"], 0)
                self.assertEqual(
                    report["next_due"], "2026-09-11T14:00:00+00:00"
                )
                self.assertEqual(report["status"], "healthy")

    def test_completed_long_run_is_retained_even_when_started_before_observation(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [
                job(
                    "late",
                    started_at="2026-09-10T06:00:00Z",
                    completed_at="2026-09-11T07:00:00Z",
                )
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["root_count"], 1)
        self.assertEqual(report["last_useful_at"], "2026-09-11T07:00:00+00:00")
        self.assertEqual(report["outcomes"]["useful"], 1)

    def test_isolated_empty_or_overlap_is_not_stalled_progress(self) -> None:
        for outcome in ["no_work", "overlap"]:
            report = assess_pipeline(
                SCHEDULE,
                [job("neutral", outcome=outcome)],
                NOW,
                START,
                {**THRESHOLDS, "progress_seconds": 60},
            )
            self.assertEqual(report["status"], "healthy")
            self.assertEqual(report["causes"], [])

    def test_failures_are_consecutive_across_skips_but_recover_with_useful_work(
        self,
    ) -> None:
        jobs = [
            job("f1", success=False, completed_at="2026-09-11T06:01:00Z"),
            job(
                "skip", outcome="overlap", completed_at="2026-09-11T06:02:00Z"
            ),
            job("f2", success=False, completed_at="2026-09-11T06:03:00Z"),
            job("f3", success=False, completed_at="2026-09-11T06:04:00Z"),
        ]
        report = assess_pipeline(SCHEDULE, jobs, NOW, START, THRESHOLDS)
        self.assertIn("consecutive_failures", report["causes"])
        self.assertEqual(report["status"], "unhealthy")
        report = assess_pipeline(
            SCHEDULE, jobs + [job("recovered")], NOW, START, THRESHOLDS
        )
        self.assertEqual(report["status"], "healthy")

    def test_stalled_running_and_missing_descendants_are_unhealthy(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [
                job(
                    "stuck",
                    running=True,
                    success=None,
                    completed_at=None,
                    missing_descendants=["child-id"],
                )
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["status"], "unhealthy")
        self.assertIn("excessive_runtime", report["causes"])
        self.assertIn("missing_descendants", report["causes"])

    def test_material_tolerated_child_failure_stays_visible_and_unhealthy(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [job("degraded", material_child_failures=["failed-child"])],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["status"], "unhealthy")
        self.assertIn("material_child_failures", report["causes"])
        self.assertEqual(report["material_child_failure_count"], 1)

    def test_missing_due_execution_alerts_but_unresolved_identity_is_inconclusive(
        self,
    ) -> None:
        report = assess_pipeline(SCHEDULE, [], NOW, START, THRESHOLDS)
        self.assertEqual(report["missing_due_count"], 1)
        self.assertIn("missing_execution", report["causes"])
        report = assess_pipeline(
            SCHEDULE,
            [job("maybe", parent_resolved=False)],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["status"], "unknown")
        self.assertNotIn("missing_execution", report["causes"])

    def test_incomplete_history_and_invalid_cron_are_unknown_not_missing(
        self,
    ) -> None:
        for schedule in [
            {**SCHEDULE, "history_incomplete": True},
            {**SCHEDULE, "schedule": "invalid"},
        ]:
            report = assess_pipeline(schedule, [], NOW, START, THRESHOLDS)
            self.assertEqual(report["status"], "unknown")
            self.assertNotIn("missing_execution", report["causes"])

    def test_incident_persists_failed_delivery_without_flood_and_recovers_once(
        self,
    ) -> None:
        from datetime import timedelta

        report = {
            "path": "daily",
            "status": "unhealthy",
            "causes": ["missing_execution"],
            "latest_job_id": "root",
        }
        initial = incident_transition(None, report, NOW)
        self.assertEqual(initial["notification"]["kind"], "incident")
        state = {
            **initial["state"],
            "last_delivery_attempt_at": NOW.isoformat(),
        }
        retry = incident_transition(state, report, NOW + timedelta(minutes=5))
        self.assertIsNone(retry["notification"])
        later = incident_transition(state, report, NOW + timedelta(minutes=31))
        self.assertEqual(
            later["notification"]["id"], initial["notification"]["id"]
        )
        delivered = {
            **state,
            "pending_notification": None,
            "last_notified_at": NOW.isoformat(),
        }
        self.assertIsNone(
            incident_transition(
                delivered, report, NOW + timedelta(minutes=31)
            )["notification"]
        )
        unknown = incident_transition(
            delivered, {**report, "status": "unknown"}, NOW
        )
        self.assertTrue(unknown["state"]["active"])
        recovered = incident_transition(
            delivered,
            {**report, "status": "healthy", "causes": []},
            NOW + timedelta(hours=1),
        )
        self.assertEqual(recovered["notification"]["kind"], "recovery")
        acknowledged = {
            **recovered["state"],
            "pending_notification": None,
            "last_notified_at": (NOW + timedelta(hours=1)).isoformat(),
        }
        self.assertIsNone(
            incident_transition(
                acknowledged,
                {**report, "status": "healthy"},
                NOW + timedelta(hours=2),
            )["notification"]
        )

    def test_all_eight_daily_schedules_have_shutdown_coverage(self) -> None:
        daily = [
            ("populate_crate", "0 0 19 * * *", 1),
            ("initialize_dna", "0 0 3 * * *", 2),
            ("init_providers", "0 0 0 * * * *", 2),
            ("tvtropes", "0 0 2 * * *", 2),
            ("rotten", "0 0 5 * * *", 2),
            ("metacritic", "0 0 8 * * *", 2),
            ("imdb", "0 0 11 * * *", 2),
            ("tmdb", "0 30 9 * * *", 2),
        ]
        shutdown = datetime(2026, 9, 9, 21, 1, 10, tzinfo=timezone.utc)
        for path, cron, expected in daily:
            with self.subTest(path=path):
                result = assess_pipeline(
                    {
                        **SCHEDULE,
                        "path": path,
                        "schedule": cron,
                        "timezone": "Europe/Berlin",
                    },
                    [],
                    NOW,
                    shutdown,
                    THRESHOLDS,
                )
                self.assertEqual(result["due_count"], expected)
                self.assertTrue(result["cron_valid"])

    def test_resolved_duplicate_wins_and_future_queued_job_is_not_running(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [
                job("root", parent_resolved=False),
                job("root"),
                job(
                    "future",
                    started_at=None,
                    completed_at=None,
                    scheduled_for="2026-09-12T06:00:00Z",
                ),
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["root_count"], 1)
        self.assertEqual(report["unknown_parent_count"], 0)
        self.assertEqual(report["status"], "healthy")

    def test_sustained_failed_progress_alerts_before_failure_count_threshold(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [job("failed", success=False)],
            NOW,
            START,
            {**THRESHOLDS, "progress_seconds": 3600},
        )
        self.assertIn("lack_of_progress", report["causes"])
        self.assertNotIn("consecutive_failures", report["causes"])
        self.assertEqual(report["status"], "unhealthy")

    def test_reminder_is_deduplicated_until_delivery_is_acknowledged(
        self,
    ) -> None:
        from datetime import timedelta

        report = {
            "path": "daily",
            "status": "unhealthy",
            "causes": ["excessive_runtime"],
            "latest_job_id": "root",
        }
        state = {
            "active": True,
            "opened_at": START.isoformat(),
            "last_notified_at": START.isoformat(),
            "pending_notification": None,
        }
        planned = incident_transition(state, report, NOW)
        self.assertEqual(planned["notification"]["kind"], "reminder")
        repeated = incident_transition(
            planned["state"], report, NOW + timedelta(minutes=5)
        )
        self.assertEqual(
            repeated["notification"]["id"], planned["notification"]["id"]
        )

    def test_semantic_failure_and_material_outcome_errors_are_not_empty_success(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [job("invalid", outcome="failure")],
            NOW,
            START,
            {**THRESHOLDS, "consecutive_failures": 1},
        )
        self.assertEqual(report["outcomes"], {"failure": 1})
        self.assertEqual(report["status"], "unhealthy")
        report = assess_pipeline(
            {**SCHEDULE, "history_incomplete": True},
            [
                job(
                    "partial",
                    material_outcome_failures=["provider_identity_errors"],
                )
            ],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["status"], "unhealthy")
        self.assertIn("material_outcome_failures", report["causes"])
        self.assertEqual(report["material_outcome_failure_count"], 1)
        self.assertEqual(report["material_child_failure_count"], 0)

    def test_frequent_coverage_clips_old_slots_but_retains_root_totals(
        self,
    ) -> None:
        from datetime import timedelta

        jobs = [
            job(
                str(index),
                started_at=(NOW - timedelta(seconds=index * 20)).isoformat(),
                completed_at=(NOW - timedelta(seconds=index * 20)).isoformat(),
            )
            for index in range(8000)
        ]
        report = assess_pipeline(
            {**SCHEDULE, "schedule": "*/20 * * * * *"},
            jobs,
            NOW,
            NOW - timedelta(days=7),
            THRESHOLDS,
        )
        self.assertEqual(report["root_count"], 8000)
        self.assertEqual(report["due_count"], 8641)
        self.assertTrue(report["coverage_truncated"])
        self.assertEqual(report["coverage"][-1]["state"], "observed")
        self.assertEqual(report["status"], "healthy")

    def test_confirmed_incident_does_not_delay_new_recovery_notification(
        self,
    ) -> None:
        from datetime import timedelta

        previous = {
            "active": True,
            "opened_at": START.isoformat(),
            "pending_notification": None,
            "last_notified_at": NOW.isoformat(),
            "last_delivery_attempt_at": NOW.isoformat(),
        }
        result = incident_transition(
            previous,
            {"path": "daily", "status": "healthy", "causes": []},
            NOW + timedelta(seconds=60),
        )
        self.assertEqual(result["notification"]["kind"], "recovery")

    def test_cancellation_cannot_recover_genuine_failure_incident(
        self,
    ) -> None:
        failures = [
            job(
                f"failed-{index}",
                success=False,
                completed_at=f"2026-09-11T06:0{index}:00Z",
            )
            for index in range(3)
        ]
        initial = assess_pipeline(SCHEDULE, failures, NOW, START, THRESHOLDS)
        self.assertEqual(initial["status"], "unhealthy")
        active = incident_transition(None, initial, NOW)["state"]
        active.update(
            pending_notification=None, last_notified_at=NOW.isoformat()
        )
        canceled = job(
            "cancelled",
            canceled=True,
            success=False,
            completed_at="2026-09-11T06:05:00Z",
        )
        report = assess_pipeline(
            SCHEDULE, failures + [canceled], NOW, START, THRESHOLDS
        )
        self.assertEqual(report["outcomes"]["cancelled"], 1)
        self.assertNotEqual(report["status"], "healthy")
        transition = incident_transition(active, report, NOW)
        self.assertTrue(transition["state"]["active"])
        self.assertNotEqual(transition["transition"], "recovered")
        recovered = assess_pipeline(
            SCHEDULE,
            failures + [canceled, job("useful")],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(recovered["status"], "healthy")
        self.assertEqual(
            incident_transition(active, recovered, NOW)["transition"],
            "recovered",
        )

    def test_cancelled_running_incident_becomes_unknown_without_positive_completion(
        self,
    ) -> None:
        report = assess_pipeline(
            SCHEDULE,
            [job("cancelled", canceled=True, success=False)],
            NOW,
            START,
            THRESHOLDS,
        )
        self.assertEqual(report["status"], "unknown")
        transition = incident_transition(
            {"active": True, "causes": ["excessive_runtime"]}, report, NOW
        )
        self.assertTrue(transition["state"]["active"])

    def test_external_deferred_is_neutral_not_useful_and_does_not_reset_failure_streak(
        self,
    ) -> None:
        deferred = job(
            "deferred",
            outcome="external_deferred",
            tolerable_external_failure_count=4,
        )
        report = assess_pipeline(SCHEDULE, [deferred], NOW, START, THRESHOLDS)
        self.assertEqual(report["outcomes"], {"external_deferred": 1})
        self.assertEqual(report["status"], "healthy")
        self.assertEqual(report["tolerable_external_failure_count"], 4)
        failures = [
            job(
                str(index),
                success=False,
                completed_at=f"2026-09-11T06:0{index}:00Z",
            )
            for index in range(3)
        ]
        report = assess_pipeline(
            SCHEDULE, failures + [deferred], NOW, START, THRESHOLDS
        )
        self.assertIn("consecutive_failures", report["causes"])


if __name__ == "__main__":
    unittest.main()
