"""Persistence and ownership against disposable CrateDB, never production."""

import concurrent.futures
import json
import os
from pathlib import Path
import sys
import unittest
from urllib.request import Request, urlopen
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.store import MonitoringStore

URL = os.environ.get("TEST_CRATE_URL")


class LocalCrate:
    def __init__(self, table):
        self.table = table
        self.cur = self
        self.rowcount = 0

    def request(self, sql, **params):
        sql = sql.replace("workflow_monitoring", self.table)
        req = Request(URL + "/_sql", data=json.dumps({"stmt": sql, **params}).encode(),
                      headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=15) as response:
            return json.load(response)

    def run(self, sql, params=()):
        self.result = self.request(sql, args=params)
        self.rowcount = self.result["rowcount"]

    def select(self, sql, params=()):
        self.run(sql, params)
        return [dict(zip(self.result["cols"], row)) for row in self.result["rows"]]

    def executemany(self, sql, rows):
        return self.request(sql, bulk_args=rows)["results"]


@unittest.skipUnless(URL, "Set TEST_CRATE_URL to a disposable local CrateDB")
class WorkflowStoreIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.table = "monitor_test_" + uuid4().hex
        self.db = LocalCrate(self.table)
        self.store = MonitoringStore(self.db)
        self.store.initialize()

    def tearDown(self):
        self.db.run("DROP TABLE " + self.table)

    def test_reinitialization_and_durable_state_readback(self):
        self.store.initialize()
        self.assertTrue(self.store.acquire())
        self.store.put("pipeline:f/example", "pipeline", "f/example", {
            "active": True, "pending_notification": {"id": "incident-1"}})
        self.assertEqual(self.store.get("pipeline:f/example")["pending_notification"],
                         {"id": "incident-1"})
        self.store.save_jobs("f/example", [{"id": "job-1", "outcome": "useful"}])
        self.db.run("REFRESH TABLE workflow_monitoring")
        self.assertEqual(self.store.jobs("f/example")["job-1"]["outcome"], "useful")
        self.store.release()
        replacement = MonitoringStore(LocalCrate(self.table))
        self.assertTrue(replacement.acquire())
        self.assertTrue(replacement.get("pipeline:f/example")["active"])

    def test_large_report_roundtrips_without_index_term_limit(self):
        self.assertTrue(self.store.acquire())
        report = {"pipelines": [{"coverage": "x" * 40000}]}
        self.store.put("latest-report", "report", "", report)
        self.assertEqual(self.store.get("latest-report"), report)

    def test_concurrent_checkers_have_exactly_one_owner(self):
        def claim(_):
            return MonitoringStore(LocalCrate(self.table)).acquire()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(claim, range(2)))
        self.assertEqual(sum(results), 1)

    def test_expired_owner_cannot_write_or_release_replacement(self):
        self.assertTrue(self.store.acquire())
        self.db.run("UPDATE workflow_monitoring SET lease_expires_at = 0 "
                    "WHERE monitor_key = 'checker-lease'")
        replacement = MonitoringStore(LocalCrate(self.table))
        self.assertTrue(replacement.acquire())
        with self.assertRaisesRegex(RuntimeError, "lease"):
            self.store.put("stale", "pipeline", "f/example", {})
        self.store.release()
        replacement.put("current", "pipeline", "f/example", {"ok": True})
        self.assertEqual(replacement.get("current"), {"ok": True})


if __name__ == "__main__":
    unittest.main()
