"""Public Windmill observation boundary: root identity and descendant outcomes."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.collection import observe_execution


class WorkflowCollectionTests(unittest.TestCase):
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
