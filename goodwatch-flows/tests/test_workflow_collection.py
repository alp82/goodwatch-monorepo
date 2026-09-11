"""Public Windmill observation boundary: root identity and descendant outcomes."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.collection import observe_execution


class WorkflowCollectionTests(unittest.TestCase):
    def test_overlap_skip_placeholder_is_not_a_missing_execution(self):
        def api(path):
            if path.endswith("get/root"):
                return {
                    "id": "root", "parent_job": None, "success": True,
                    "is_skipped": True,
                    "result": "not allowed to overlap with running-root, scheduling next iteration",
                    "flow_status": {"step": 1, "modules": [
                        {"id": "a", "job": "00000000-0000-0000-0000-000000000000",
                         "type": "Success", "skipped": True},
                        {"id": "b", "type": "WaitingForPriorSteps"},
                    ]},
                }
            raise FileNotFoundError("not found")

        observed = observe_execution(api, "root")
        self.assertEqual(observed["outcome"], "overlap")
        self.assertEqual(observed["missing_descendants"], [])
        self.assertEqual(observed["unresolved_descendants"], [])

    def test_overlap_does_not_hide_real_missing_children_or_unskipped_zero_ids(self):
        for missing_id, skipped in [
            ("4b56e224-336c-4a09-b88e-4898337453fd", True),
            ("00000000-0000-0000-0000-000000000000", False),
        ]:
            with self.subTest(missing_id=missing_id, skipped=skipped):
                def api(path):
                    if path.endswith("get/root"):
                        return {
                            "id": "root", "parent_job": None, "success": True,
                            "is_skipped": True,
                            "flow_status": {"modules": [
                                {"job": missing_id, "type": "Success", "skipped": skipped},
                            ]},
                        }
                    raise FileNotFoundError("not found")

                observed = observe_execution(api, "root")
                self.assertEqual(observed["missing_descendants"], [missing_id])

    def test_saved_source_retry_is_explicit_and_identity_failure_is_material(self):
        for payload, tolerated in [
            ({"outcome": "failed", "rate_limit_reached": True}, 1),
            ({"outcome": "failed", "retry_saved": True, "error": "private upstream"}, 1),
            ({"outcome": "failed", "error": "private identity failure"}, 0),
        ]:
            jobs = {
                "root": {"id": "root", "parent_job": None, "success": True,
                         "script_path": "f/tmdb_web/tmdb_crawl_providers",
                         "result": [payload], "flow_status": {"modules": [{"job": "source"}]}},
                "source": {"id": "source", "parent_job": "root", "success": True,
                           "script_path": "f/tmdb_web/tmdb_crawl_providers/fetch", "result": payload},
            }
            result = observe_execution(lambda path: jobs[path.rsplit("/", 1)[-1]], "root")
            self.assertEqual(result["source_failure_count"], 1)
            self.assertEqual(result["tolerable_external_failure_count"], tolerated)
            self.assertEqual(result["outcome"], "external_deferred" if tolerated else "failure")
            self.assertNotIn("private", str(result))

    def test_publication_exhaustion_keeps_only_safe_summary_and_correlated_claim(self):
        import json
        failure = {"classification": "attempts_exhausted", "attempts": 4, "retries": 3,
                   "errors": {"grpc_unavailable": 4}, "private": "secret"}
        jobs = {
            "root": {"id": "root", "parent_job": None, "success": False,
                     "flow_status": {"modules": [{"job": "source"}, {"job": "publish"}]}},
            "source": {"id": "source", "script_path": "f/tmdb_web/tmdb_crawl_providers/fetch",
                       "success": True, "result": {"outcome": "fetched"}},
            "publish": {"id": "publish", "script_path": "f/priority/publish", "success": False,
                        "started_at": "2026-09-11T06:00:00Z", "duration_ms": 120000,
                        "args": {"next_ids": {"tv_ids": [42], "claims": [
                            {"media_type": "show", "tmdb_id": 42, "claimed_demand": 7, "lease_token": "secret"}]}},
                        "result": {"error": {"name": "PublicationFailure", "message":
                            "Qdrant publication failed (attempts exhausted): " + json.dumps(failure) + ". Demand remains unacknowledged"}}},
        }
        result = observe_execution(lambda path: jobs[path.rsplit("/", 1)[-1]], "root")
        self.assertEqual(result["source_success_count"], 1)
        self.assertEqual(result["publication_failure"], {
            "classification": "attempts_exhausted", "attempts": 4, "retries": 3,
            "job_id": "publish", "completed_at": "2026-09-11T06:02:00+00:00",
            "targets": [{"media_type": "show", "tmdb_id": 42, "claimed_demand": 7}]})
        self.assertEqual(result["publication_retry_count"], 3)
        self.assertNotIn("secret", str(result))
        self.assertNotIn("lease_token", str(result))
        self.assertIsNone(result["source_last_success_at"])
        for finished, expected in [
            ("2026-09-11T06:01:00Z", "2026-09-11T06:01:00+00:00"),
            ("2026-09-11T06:03:00Z", None),
        ]:
            jobs["source"]["completed_at"] = finished
            enriched = observe_execution(lambda path: jobs[path.rsplit("/", 1)[-1]], "root")
            self.assertEqual(enriched["publication_failure"].get("source_success_at"), expected)
        jobs["root"]["flow_status"] = {"modules": [{"job": "publish"}]}
        jobs["root"]["completed_at"] = "2026-09-11T06:05:00Z"
        unrelated = observe_execution(lambda path: jobs[path.rsplit("/", 1)[-1]], "root")
        self.assertIsNone(unrelated["source_last_success_at"])
        self.assertNotIn("source_success_at", unrelated["publication_failure"])


    def test_retained_publication_counts_are_not_doubled_by_parent_results(self):
        payload = {"acknowledged": 2, "movie": {"vectors": {"publication": {
            "batches": 1, "attempts": 2, "retries": 1, "errors": {"grpc_unavailable": 1}}},
            "streaming": {"publication": {"status": "partial_success", "titles": {
                "42": {"deferred_country_count": 3}}}}}}
        jobs = {
            "root": {"id": "root", "parent_job": None, "success": True, "result": payload,
                     "flow_status": {"modules": [{"job": "publish"}]}},
            "publish": {"id": "publish", "success": True, "script_path": "f/priority/publish", "result": payload},
        }
        result = observe_execution(lambda path: jobs[path.rsplit("/", 1)[-1]], "root")
        self.assertEqual(result["acknowledged_count"], 2)
        self.assertEqual(result["partial_country_count"], 3)
        self.assertEqual(result["publication_attempt_count"], 2)
        self.assertEqual(result["publication_retry_count"], 1)

    def test_missing_parent_is_resolved_through_root_endpoint(self):
        calls = []

        def api(path):
            calls.append(path)
            if path.endswith("get/root"):
                return {"id": "root", "success": True, "result": {"acknowledged": 2}}
            if path.endswith("get_root_job_id/root"):
                return "root"
            raise AssertionError(path)

        result = observe_execution(api, "root")
        self.assertTrue(result["parent_resolved"])
        self.assertIsNone(result["parent_job"])
        self.assertEqual(result["outcome"], "useful")
        self.assertIn("jobs_u/get_root_job_id/root", calls)

    def test_child_is_not_counted_as_root_and_failed_lookup_stays_unknown(self):
        def api(path):
            if path.endswith("get/child"):
                return {"id": "child", "success": True}
            if path.endswith("get_root_job_id/child"):
                return "root"
            raise ConnectionError("private credential must not be retained")

        child = observe_execution(api, "child")
        self.assertEqual(child["parent_job"], "root")
        unknown = observe_execution(api, "missing")
        self.assertFalse(unknown["parent_resolved"])
        self.assertNotIn("private", str(unknown))

    def test_missing_and_tolerated_failed_descendants_are_reported(self):
        def api(path):
            if path.endswith("get/root"):
                return {"id": "root", "parent_job": None, "success": True,
                        "result": {"acknowledged": 1},
                        "flow_status": {"modules": [
                            {"id": "a", "job": "failed", "type": "Failure"},
                            {"id": "b", "job": "missing", "type": "Success"},
                        ]}}
            if path.endswith("get/failed"):
                return {"id": "failed", "parent_job": "root", "success": False,
                        "args": {"secret": "private"}, "result": {"error": "private"}}
            raise FileNotFoundError("not found")

        result = observe_execution(api, "root")
        self.assertEqual(result["material_child_failures"], ["failed"])
        self.assertEqual(result["missing_descendants"], ["missing"])
        self.assertNotIn("private", str(result))

    def test_neutral_and_structured_failure_outcomes_are_distinct(self):
        for payload, expected in [
            ({"count_new_tv": 0, "count_new_movies": 0}, "no_work"),
            ({"count_new_tv": 0, "identity_error_count": 9}, "failure"),
            ([{"outcome": "fetched"}, {"outcome": "fetched"}], "useful"),
            (None, "unknown"),
        ]:
            with self.subTest(payload=payload):
                result = observe_execution(lambda _: {
                    "id": "root", "parent_job": None, "success": True,
                    "result": payload}, "root")
                self.assertEqual(result["outcome"], expected)

    def test_unfinished_child_of_completed_root_keeps_evidence_unknown(self):
        def api(path):
            if path.endswith("get/root"):
                return {"id": "root", "parent_job": None, "success": True,
                        "result": {"acknowledged": 1},
                        "flow_status": {"modules": [{"job": "child"}]}}
            return {"id": "child", "parent_job": "root", "running": True}

        result = observe_execution(api, "root")
        self.assertEqual(result["unresolved_descendants"], ["child"])
        self.assertTrue(result["evidence_incomplete"])


if __name__ == "__main__":
    unittest.main()
