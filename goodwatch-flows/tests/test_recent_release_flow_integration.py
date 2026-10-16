"""Opt-in inert Windmill previews: no fetches or database access.

TEST_WINDMILL_API / TEST_WINDMILL_TOKEN, as in the other flow boundary tests.
The real loop and report run; the selector and fetch are inert Python scripts.
"""
import time
import unittest

import yaml

from test_dna_flow_boundaries_integration import API, TOKEN, ROOT, api


@unittest.skipUnless(API and TOKEN, "Set TEST_WINDMILL_API and TEST_WINDMILL_TOKEN")
class RecentReleaseFlowTests(unittest.TestCase):
    def preview(self, batches, failed=0):
        flow = yaml.safe_load((ROOT / "f/tmdb_api/recheck_recent_releases.flow/flow.yaml").read_text())
        modules = flow["value"]["modules"]
        # Assert the wiring before substituting production work.
        self.assertEqual(modules[0]["value"]["path"], "f/tmdb_api/recent_releases")
        fetch = modules[1]["value"]["modules"][0]["value"]
        self.assertEqual(fetch["path"], "f/tmdb_api/tmdb_fetch_details_from_api/fetch")
        plan = {"selected": sum(len(b["movie_ids"]) + len(b["tv_ids"]) for b in batches), "batches": batches}
        modules[0]["value"] = {
            "type": "rawscript", "language": "python3", "lock": "", "input_transforms": {},
            "content": "def main():\n    return " + repr(plan),
        }
        modules[1]["value"]["modules"][0]["value"] = {
            "type": "rawscript", "language": "python3", "lock": "",
            "input_transforms": fetch["input_transforms"],
            "content": (
                "def main(next_ids: dict):\n"
                "    return dict(count_new_entries=len(next_ids['movie_ids']) + len(next_ids['tv_ids']), "
                f"count_failed_entries={failed}, next_ids=next_ids)\n"
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

    def test_empty_selection_does_not_fetch_anything(self):
        job = self.preview([])
        self.assertTrue(job.get("success"), job.get("result"))
        self.assertEqual(job["result"]["count_new_entries"], 0)

    def test_partial_fetch_failure_fails_the_daily_run(self):
        job = self.preview([{"movie_ids": ["movie-a"], "tv_ids": []}], failed=1)
        self.assertFalse(job.get("success"))
        self.assertIn("failed titles", str(job["result"]))


if __name__ == "__main__":
    unittest.main()
