"""Opt-in Windmill orchestration checks with inert script/child-flow substitutes.

Set TEST_WINDMILL_API to the workspace API URL and TEST_WINDMILL_TOKEN.
Requires PyYAML. Preview jobs perform no crawling, database writes or inference.
"""
import copy
import json
import os
from pathlib import Path
import time
import unittest
from urllib.request import Request, urlopen

ROOT = Path(__file__).parents[1] / "windmill"
API = os.environ.get("TEST_WINDMILL_API")
TOKEN = os.environ.get("TEST_WINDMILL_TOKEN")


def api(path, body=None):
    request = Request(
        API.rstrip("/") + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    with urlopen(request, timeout=30) as response:
        data = response.read().decode()
        try:
            return json.loads(data)
        except ValueError:
            return data


def inert_modules(modules):
    for module in modules:
        value = module["value"]
        if value["type"] == "branchall":
            for branch in value["branches"]:
                inert_modules(branch["modules"])
        elif value["type"] in ("script", "flow", "rawscript"):
            path = value.get("path", module.get("summary", module["id"]))
            module["value"] = {
                "type": "rawscript", "language": "python3", "lock": "",
                "input_transforms": {},
                "content": "def main():\n    return " + repr({"called": path}) + "\n",
            }
        else:
            raise ValueError("Unsupported module type: " + value["type"])


@unittest.skipUnless(API and TOKEN, "Set TEST_WINDMILL_API and TEST_WINDMILL_TOKEN")
class DNAFlowBoundaries(unittest.TestCase):
    def run_boundary(self, path):
        import yaml
        flow = copy.deepcopy(yaml.safe_load((ROOT / (path + ".flow") / "flow.yaml").read_text()))
        inert_modules(flow["value"]["modules"])
        job_id = api("/jobs/run/preview_flow", {
            "value": flow["value"], "schema": flow["schema"], "args": {},
            "path": "f/dna/flow_boundary_check",
        })
        print("Boundary preview:", job_id, flush=True)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            job = api("/jobs_u/get/" + job_id)
            if job.get("type") == "CompletedJob":
                break
            time.sleep(1)
        else:
            self.fail("Preview did not finish within 180 seconds: " + job_id)
        self.assertTrue(job.get("success"), job.get("result"))
        called = []
        seen = set()

        def collect(current):
            if current["id"] in seen:
                return
            seen.add(current["id"])
            result = current.get("result")
            if isinstance(result, dict) and "called" in result:
                called.append(result["called"])
            for module in (current.get("flow_status") or {}).get("modules", []):
                children = module.get("flow_jobs") or [module.get("job")]
                for child in children:
                    if child:
                        collect(api("/jobs_u/get/" + child))
        collect(job)
        return called

    def test_priority_crawl_publishes_without_generating_dna(self):
        called = self.run_boundary("f/priority/crawl_all")
        self.assertIn("f/priority/publish", called)
        self.assertIn("f/priority/reset", called)
        self.assertFalse([path for path in called if path.startswith("f/dna/")], called)

    def test_dedicated_dna_flow_reaches_fingerprint_persistence(self):
        called = self.run_boundary("f/dna/generate_dna")
        for path in ("f/dna/generate/next", "f/dna/crawl_all_by_id", "f/dna/generate/vectors"):
            self.assertIn(path, called)
