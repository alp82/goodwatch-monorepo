"""Opt-in inert Windmill previews: no fetches or database access.

TEST_WINDMILL_API / TEST_WINDMILL_TOKEN, as in the other flow boundary tests.
The real loop and report run; the selector and fetch are inert Python scripts.
"""
import time
import unittest

from windmill_preview import API, TOKEN, api, load_flow


class RecentReleaseReportTests(unittest.TestCase):
    def report(self, batches):
        flow = load_flow("f/tmdb_api/recheck_recent_releases")
        report = next(module for module in flow["value"]["modules"] if module["id"] == "report")
        namespace = {}
        exec(compile(report["value"]["content"], "report.inline_script.py", "exec"), namespace)
        return namespace["main"]({"selected": 3, "titles": [], "batches": []}, batches)

    def test_counts_all_exhausted_iterations_and_keeps_successful_batch_totals(self):
        with self.assertRaisesRegex(RuntimeError, "failed iterations: 2") as error:
            self.report([{"error": {"message": "first failure"}},
                         {"count_new_entries": 7, "count_deleted_entries": 1},
                         {"error": {"message": "second failure"}}])
        self.assertIn("'count_new_entries': 7", str(error.exception))
        self.assertIn("'count_deleted_entries': 1", str(error.exception))

    def test_missing_iteration_result_does_not_pass_as_success(self):
        with self.assertRaisesRegex(RuntimeError, "failed iterations: 1"):
            self.report([None])

    def test_successful_report_sums_counts_and_omits_the_plan_payload(self):
        self.assertEqual(self.report([{"count_new_entries": 2}, {"count_deleted_entries": 1}]), {
            "selected": 3, "count_new_entries": 2, "count_deleted_entries": 1,
            "count_failed_entries": 0, "failed_iterations": 0,
        })


@unittest.skipUnless(API and TOKEN, "Set TEST_WINDMILL_API and TEST_WINDMILL_TOKEN")
class RecentReleaseFlowTests(unittest.TestCase):
    def preview(self, batches, failed=0, crash_ids=()):
        flow = load_flow("f/tmdb_api/recheck_recent_releases")
        modules = flow["value"]["modules"]
        # Assert the wiring before substituting production work.
        self.assertEqual(modules[0]["value"]["path"], "f/tmdb_api/recent_releases")
        fetch = modules[1]["value"]["modules"][0]["value"]
        self.assertEqual(fetch["path"], "f/tmdb_api/tmdb_fetch_details_from_api/fetch")
        retry = modules[1]["value"]["modules"][0]["retry"]
        self.assertEqual(retry, {"constant": {"attempts": 2, "seconds": 60}})
        plan = {"selected": sum(len(b["movie_ids"]) + len(b["tv_ids"]) for b in batches), "batches": batches}
        modules[0]["value"] = {
            "type": "rawscript", "language": "python3", "lock": "", "input_transforms": {},
            "content": "def main():\n    return " + repr(plan),
        }
        modules[1]["value"]["modules"][0]["value"] = {
            "type": "rawscript", "language": "python3", "lock": "",
            "input_transforms": fetch["input_transforms"],
            "content": (
                "def main(next_ids: dict, bypass_cache: bool = False):\n"
                f"    if set(next_ids['movie_ids']) & set({crash_ids!r}): raise RuntimeError('Inert batch failure')\n"
                "    return dict(count_new_entries=len(next_ids['movie_ids']) + len(next_ids['tv_ids']), "
                f"count_failed_entries={failed}, next_ids=next_ids, bypass_cache=bypass_cache)\n"
            ),
        }
        job_id = api("/jobs/run/preview_flow", {
            "value": flow["value"], "schema": flow["schema"], "args": {},
            "path": "f/tmdb_api/recent_releases_inert_check",
        })
        print("Inert recheck preview:", job_id, flush=True)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            job = api("/jobs_u/get/" + job_id)
            if job.get("type") == "CompletedJob":
                return job
            time.sleep(1)
        self.fail("Preview timeout: " + job_id)

    def test_fetches_every_batch_with_the_existing_fetch_contract(self):
        batches = [{"movie_ids": ["movie-a", "movie-b"], "tv_ids": []},
                   {"movie_ids": [], "tv_ids": ["show-a"]}]
        job = self.preview(batches)
        self.assertTrue(job.get("success"), job.get("result"))
        self.assertEqual(job["result"]["count_new_entries"], 3)
        loop = next(m for m in job["flow_status"]["modules"] if m["id"] == "fetch")
        observed = [api("/jobs_u/get/" + child)["result"]["next_ids"] for child in loop["flow_jobs"]]
        self.assertEqual(observed, batches)
        self.assertTrue(all(api("/jobs_u/get/" + child)["result"]["bypass_cache"] for child in loop["flow_jobs"]))

    def test_empty_selection_does_not_fetch_anything(self):
        job = self.preview([])
        self.assertTrue(job.get("success"), job.get("result"))
        self.assertEqual(job["result"]["count_new_entries"], 0)

    def test_partial_fetch_failure_fails_the_daily_run(self):
        job = self.preview([{"movie_ids": ["movie-a"], "tv_ids": []}], failed=1)
        self.assertFalse(job.get("success"))
        self.assertIn("failed titles", str(job["result"]))

    def test_failed_iteration_does_not_prevent_later_batches_and_fails_report(self):
        batches = [{"movie_ids": ["broken"], "tv_ids": []},
                   {"movie_ids": ["later"], "tv_ids": []}]
        job = self.preview(batches, crash_ids=("broken",))
        self.assertFalse(job.get("success"))
        loop = next(m for m in job["flow_status"]["modules"] if m["id"] == "fetch")
        children = [api("/jobs_u/get/" + child) for child in loop["flow_jobs"]]
        self.assertEqual(len(children), 2)
        self.assertFalse(children[0]["success"])
        retry = children[0]["flow_status"]["retry"]
        self.assertEqual(retry["fail_count"], 2)
        self.assertEqual(len(retry["failed_jobs"]), 2)
        self.assertTrue(children[1]["success"])
        self.assertEqual(children[1]["result"]["next_ids"], batches[1])
        self.assertIn("failed iterations: 1", str(job["result"]))


if __name__ == "__main__":
    unittest.main()
