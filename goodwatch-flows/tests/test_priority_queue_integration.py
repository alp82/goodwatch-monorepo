"""Optional real CrateDB checks: TEST_CRATE_URL=http://127.0.0.1:<port>.

Run against a disposable local CrateDB. Each test uses its own temporary table.
"""

import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from uuid import uuid4

ROOT = Path(__file__).parents[1] / "windmill/f"
spec = importlib.util.spec_from_file_location(
    "queue_under_test", ROOT / "priority/queue.py"
)
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)
spec = importlib.util.spec_from_file_location(
    "schemas_under_test", ROOT / "sync/models/crate_schemas.py"
)
schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schemas)
URL = os.environ.get("TEST_CRATE_URL")


class HttpCrate:
    def __init__(self, table):
        self.table = table
        self.cur = SimpleNamespace(rowcount=0)

    def run(self, sql, params=()):
        request = Request(
            URL + "/_sql",
            data=json.dumps(
                {"stmt": sql.replace("crawl_priority", self.table), "args": params}
            ).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=15) as response:
                self.result = json.load(response)
        except HTTPError as error:
            raise RuntimeError(error.read().decode()) from error
        self.cur.rowcount = self.result["rowcount"]

    def select(self, sql, params=()):
        self.run(sql, params)
        return [dict(zip(self.result["cols"], row)) for row in self.result["rows"]]


@unittest.skipUnless(URL, "Set TEST_CRATE_URL to a disposable local CrateDB")
class QueueIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.table = "priority_test_" + uuid4().hex
        self.db = HttpCrate(self.table)
        spec = schemas.SCHEMAS["crawl_priority"]
        columns = spec["columns"] | {
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        }
        definitions = [f"{name} {dtype}" for name, dtype in columns.items()]
        definitions.append("PRIMARY KEY (media_type, tmdb_id)")
        self.db.run(
            f"CREATE TABLE {self.table} ({', '.join(definitions)}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 0)"
        )

    def tearDown(self):
        self.db.run(f"DROP TABLE {self.table}")

    def seed(self):
        self.db.run(
            "INSERT INTO crawl_priority (media_type, tmdb_id, demand) VALUES ('movie', 1, 10)"
        )
        self.db.run("REFRESH TABLE crawl_priority")

    def test_ranking_claim_ack_and_impressions(self):
        self.seed()
        self.assertEqual(queue.candidate_ids(self.db, "movie"), [1])
        lease = queue.claim(self.db, "movie", 1)
        self.assertEqual(lease["claimed_demand"], 10)
        self.db.run(
            "UPDATE crawl_priority SET demand = demand + 3 WHERE media_type = 'movie' AND tmdb_id = 1"
        )
        queue.acknowledge(self.db, lease)
        row = queue.read_entry(self.db, "movie", 1)
        self.assertEqual(row["demand"] - row["acknowledged_demand"], 3)
        self.assertIsNone(queue.claim(self.db, "movie", 1))
        self.db.run("REFRESH TABLE crawl_priority")
        self.assertEqual(queue.candidate_ids(self.db, "movie"), [])

    def test_concurrent_claims_have_one_owner(self):
        self.seed()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            leases = list(
                executor.map(
                    lambda _: queue.claim(HttpCrate(self.table), "movie", 1), range(2)
                )
            )
        self.assertEqual(sum(lease is not None for lease in leases), 1)

    def test_release_retains_demand_and_never_releases_another_owner(self):
        self.seed()
        old = queue.claim(self.db, "movie", 1)
        queue.release(self.db, old)
        self.assertEqual(
            queue.read_entry(self.db, "movie", 1)["acknowledged_demand"], 0
        )
        new = queue.claim(self.db, "movie", 1)
        queue.release(self.db, old)
        self.assertEqual(
            queue.read_entry(self.db, "movie", 1)["lease_token"], new["lease_token"]
        )

    def test_explicit_insert_visible_without_refresh_and_lease_retry(self):
        old = queue.claim(self.db, "show", 2, explicit=True)
        self.assertIsNotNone(old)
        self.db.run(
            "UPDATE crawl_priority SET lease_expires_at = 0 WHERE media_type = 'show' AND tmdb_id = 2"
        )
        new = queue.claim(self.db, "show", 2, explicit=True)
        with self.assertRaises(RuntimeError):
            queue.acknowledge(self.db, old)
        queue.acknowledge(self.db, new)


if __name__ == "__main__":
    unittest.main()
