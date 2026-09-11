"""Grouped backlog incidents from aggregate, payload-free source evidence."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.backlog_health import assess_backlogs

NOW = datetime(2026, 9, 11, 12, tzinfo=timezone.utc)
COUNTRY = {
    "complete": True,
    "overdue_country_count": 12,
    "overdue_title_count": 4,
    "oldest_due_at": "2026-09-11T08:00:00Z",
    "last_success_at": None,
    "excluded": {"fresh": 100, "backoff": 50, "leased": 2},
    "external_failure_count": 50,
}
PUBLICATION = {
    "complete": True,
    "overdue_title_count": 0,
    "outstanding_demand": 0,
    "oldest_unacknowledged_at": None,
    "last_acknowledged_at": None,
    "excluded": {"leased": 1, "cooldown": 3},
}


class BacklogHealthTests(unittest.TestCase):
    def test_initial_backlog_observes_then_stalls_as_one_country_incident(
        self,
    ) -> None:
        first = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        self.assertEqual(first["reports"][0]["status"], "healthy")
        self.assertFalse(first["reports"][0]["progress_observed"])
        later = assess_backlogs(
            COUNTRY, PUBLICATION, first["progress"], NOW + timedelta(hours=1)
        )
        self.assertEqual(len(later["reports"]), 2)
        country = later["reports"][0]
        self.assertEqual(country["status"], "unhealthy")
        self.assertIn("country_backlog_stalled", country["causes"])
        self.assertEqual(country["overdue_country_count"], 12)
        self.assertEqual(country["overdue_title_count"], 4)
        self.assertEqual(
            country["oldest_overdue_at"], "2026-09-11T08:00:00+00:00"
        )
        self.assertEqual(country["external_failure_count"], 50)
        self.assertEqual(later["reports"][1]["status"], "healthy")

    def test_success_reduction_or_oldest_advancement_is_group_progress(
        self,
    ) -> None:
        first = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        for changed in [
            {
                **COUNTRY,
                "last_success_at": (NOW + timedelta(minutes=50)).isoformat(),
            },
            {**COUNTRY, "overdue_country_count": 11},
            {**COUNTRY, "oldest_due_at": "2026-09-11T09:00:00Z"},
        ]:
            with self.subTest(changed=changed):
                result = assess_backlogs(
                    changed,
                    PUBLICATION,
                    first["progress"],
                    NOW + timedelta(hours=1),
                )
                self.assertEqual(result["reports"][0]["status"], "healthy")

    def test_new_backlog_growth_does_not_masquerade_as_progress(self) -> None:
        first = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        result = assess_backlogs(
            {**COUNTRY, "overdue_country_count": 20},
            PUBLICATION,
            first["progress"],
            NOW + timedelta(hours=1),
        )
        self.assertEqual(result["reports"][0]["status"], "unhealthy")

    def test_fresh_backoff_leased_and_upstream_blocked_countries_do_not_alert(
        self,
    ) -> None:
        initial = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        empty = {
            **COUNTRY,
            "overdue_country_count": 0,
            "overdue_title_count": 0,
            "oldest_due_at": None,
        }
        result = assess_backlogs(
            empty, PUBLICATION, initial["progress"], NOW + timedelta(hours=4)
        )
        self.assertEqual(result["reports"][0]["status"], "healthy")
        self.assertEqual(result["reports"][0]["excluded"], COUNTRY["excluded"])
        self.assertEqual(
            result["reports"][0]["external_failure_classification"],
            "tolerable_external_backoff",
        )
        blocked = {
            **COUNTRY,
            "upstream_blocked_until": (NOW + timedelta(hours=5)).isoformat(),
        }
        result = assess_backlogs(
            blocked, PUBLICATION, initial["progress"], NOW + timedelta(hours=4)
        )
        self.assertEqual(result["reports"][0]["status"], "healthy")
        self.assertEqual(result["reports"][0]["overdue_country_count"], 0)

    def test_within_grace_is_not_overdue_and_partial_publication_does_not_hide_countries(
        self,
    ) -> None:
        recent = {
            **COUNTRY,
            "oldest_due_at": (NOW - timedelta(minutes=10)).isoformat(),
        }
        result = assess_backlogs(recent, PUBLICATION, None, NOW)
        self.assertEqual(result["reports"][0]["overdue_country_count"], 0)
        initial = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        partial = {
            **PUBLICATION,
            "last_acknowledged_at": (NOW + timedelta(minutes=59)).isoformat(),
        }
        result = assess_backlogs(
            COUNTRY, partial, initial["progress"], NOW + timedelta(hours=1)
        )
        self.assertEqual(result["reports"][0]["status"], "unhealthy")
        self.assertEqual(result["reports"][1]["status"], "healthy")

    def test_unknown_collection_preserves_uncertainty_without_false_recovery(
        self,
    ) -> None:
        initial = assess_backlogs(COUNTRY, PUBLICATION, None, NOW)
        result = assess_backlogs(
            {"complete": False},
            PUBLICATION,
            initial["progress"],
            NOW + timedelta(hours=2),
        )
        self.assertEqual(result["reports"][0]["status"], "unknown")
        recovered_collection = assess_backlogs(
            COUNTRY, PUBLICATION, result["progress"], NOW + timedelta(hours=3)
        )
        self.assertEqual(
            recovered_collection["reports"][0]["status"], "healthy"
        )

    def test_exhausted_publication_after_successful_scrape_is_not_a_source_failure(
        self,
    ) -> None:
        pending = {
            **PUBLICATION,
            "overdue_title_count": 1,
            "outstanding_demand": 9,
            "oldest_unacknowledged_at": "2026-09-11T08:00:00Z",
            "source_success_at": "2026-09-11T09:00:00Z",
            "last_failure_at": "2026-09-11T10:00:00Z",
            "last_failure_classification": "attempts_exhausted",
            "failure_unacknowledged": True,
        }
        result = assess_backlogs(COUNTRY, pending, None, NOW)
        self.assertEqual(result["reports"][1]["status"], "unhealthy")
        self.assertIn(
            "publication_retry_exhausted", result["reports"][1]["causes"]
        )
        self.assertEqual(
            result["reports"][1]["failure_stage"],
            "publication_after_source_success",
        )
        # A different title can acknowledge later without resolving this failure.
        result = assess_backlogs(
            COUNTRY,
            {**pending, "last_acknowledged_at": "2026-09-11T11:00:00Z"},
            None,
            NOW,
        )
        self.assertEqual(result["reports"][1]["status"], "unhealthy")
        cleared = {
            **PUBLICATION,
            "last_failure_classification": "attempts_exhausted",
            "failure_unacknowledged": False,
        }
        result = assess_backlogs(
            COUNTRY, cleared, result["progress"], NOW + timedelta(hours=1)
        )
        self.assertEqual(result["reports"][1]["status"], "healthy")

    def test_publication_stalls_without_acknowledgment_and_recovers_on_progress(
        self,
    ) -> None:
        pending = {
            **PUBLICATION,
            "overdue_title_count": 3,
            "outstanding_demand": 20,
            "oldest_unacknowledged_at": "2026-09-11T08:00:00Z",
            "age_basis": "monitor_observation",
        }
        initial = assess_backlogs(COUNTRY, pending, None, NOW)
        stalled = assess_backlogs(
            COUNTRY, pending, initial["progress"], NOW + timedelta(hours=2)
        )
        self.assertIn(
            "publication_unacknowledged", stalled["reports"][1]["causes"]
        )
        self.assertEqual(
            stalled["reports"][1]["age_basis"], "monitor_observation"
        )
        progress = {
            **pending,
            "last_acknowledged_at": (NOW + timedelta(hours=2)).isoformat(),
        }
        recovered = assess_backlogs(
            COUNTRY,
            progress,
            stalled["progress"],
            NOW + timedelta(hours=2, minutes=5),
        )
        self.assertEqual(recovered["reports"][1]["status"], "healthy")

    def test_partial_counts_are_lower_bounds_and_cannot_claim_recovery(
        self,
    ) -> None:
        partial = {**COUNTRY, "complete": False, "lower_bound": True}
        result = assess_backlogs(partial, PUBLICATION, None, NOW)
        self.assertEqual(result["reports"][0]["status"], "unknown")
        self.assertTrue(result["reports"][0]["counts_are_lower_bounds"])
        self.assertEqual(result["reports"][0]["overdue_country_count"], 12)

    def test_unchanged_old_success_watermark_is_not_new_progress(self) -> None:
        snapshot = {**COUNTRY, "last_success_at": "2026-09-11T07:00:00Z"}
        initial = assess_backlogs(snapshot, PUBLICATION, None, NOW)
        stalled = assess_backlogs(
            snapshot,
            PUBLICATION,
            initial["progress"],
            NOW + timedelta(hours=1),
        )
        self.assertEqual(stalled["reports"][0]["status"], "unhealthy")

    def test_movie_uncertainty_does_not_hide_tv_stall_or_recovery(
        self,
    ) -> None:
        country = {
            "complete": False,
            "partitions": [
                {"media_type": "movie", "complete": False},
                {**COUNTRY, "media_type": "tv"},
            ],
        }
        first = assess_backlogs(country, PUBLICATION, None, NOW)
        stalled = assess_backlogs(
            country, PUBLICATION, first["progress"], NOW + timedelta(hours=1)
        )
        reports = {report["path"]: report for report in stalled["reports"]}
        self.assertEqual(len(reports), 3)
        self.assertEqual(
            reports["f/monitoring/country_backlog_movie"]["status"], "unknown"
        )
        self.assertEqual(
            reports["f/monitoring/country_backlog_tv"]["status"], "unhealthy"
        )
        self.assertEqual(
            reports["f/monitoring/country_backlog_tv"]["media_type"], "tv"
        )
        self.assertEqual(
            reports["f/monitoring/publication_backlog"]["status"], "healthy"
        )
        self.assertEqual(
            set(stalled["progress"]),
            {"country_movie", "country_tv", "publication"},
        )
        recovered = {
            **country,
            "partitions": [
                country["partitions"][0],
                {
                    **country["partitions"][1],
                    "last_success_at": (NOW + timedelta(hours=1)).isoformat(),
                },
            ],
        }
        final = assess_backlogs(
            recovered,
            PUBLICATION,
            stalled["progress"],
            NOW + timedelta(hours=1, minutes=5),
        )
        self.assertEqual(final["reports"][0]["status"], "unknown")
        self.assertEqual(final["reports"][1]["status"], "healthy")
        self.assertEqual(
            sum(
                report["path"] == "f/monitoring/publication_backlog"
                for report in final["reports"]
            ),
            1,
        )


if __name__ == "__main__":
    unittest.main()
