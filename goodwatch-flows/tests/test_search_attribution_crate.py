"""Opt-in migration/accounting regression against an explicitly isolated local CrateDB.

SEARCH_ATTRIBUTION_TEST_CRATE_URL=http://127.0.0.1:PORT python3 -m unittest discover \
  -s goodwatch-flows/tests -p test_search_attribution_crate.py
"""
from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "windmill"))
from f.sync.models.crate_schemas import SCHEMAS

spec = importlib.util.spec_from_file_location("attribution_initializer_test", ROOT / "windmill/f/sync/init/cratedb.py")
initializer = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
    spec.loader.exec_module(initializer)


@unittest.skipUnless(os.environ.get("SEARCH_ATTRIBUTION_TEST_CRATE_URL"), "Requires an isolated local CrateDB")
class SearchAttributionCrateTests(unittest.TestCase):
    def sql(self, stmt, args=()):
        request = Request(self.endpoint, data=json.dumps({"stmt": stmt, "args": list(args)}).encode(), headers={"Content-Type": "application/json"})
        try:
            with urlopen(request, timeout=20) as response:
                return json.load(response)
        except HTTPError as error:
            error.add_note(error.read().decode())
            error.close()
            raise

    def test_legacy_rows_survive_migration_and_adjustments_group_with_their_estimate(self):
        url = os.environ["SEARCH_ATTRIBUTION_TEST_CRATE_URL"].rstrip("/")
        if urlsplit(url).hostname not in ("127.0.0.1", "localhost", "::1"):
            raise ValueError("Only an explicitly supplied isolated local CrateDB is allowed")
        self.endpoint = url + "/_sql"
        tables = {kind: "doc.test_attribution_" + uuid4().hex for kind in ("search_spending", "search_history")}
        self.addCleanup(lambda: [self.sql(f"DROP TABLE IF EXISTS {table}") for table in tables.values()])
        for kind, table in tables.items():
            schema = deepcopy(SCHEMAS[kind])
            del schema["columns"]["attribution"]
            self.sql(initializer.create_table_sql(table, schema))
            if kind == "search_spending":
                self.sql(f"INSERT INTO {table} (id,attempt_id,cache_key,event,budget_at,created_at,amount_nano) VALUES ('legacy','old','old','estimate',1000,1000,100)")
            else:
                self.sql(f"INSERT INTO {table} (id,created_at,elapsed_ms,charged_nano,outcome) VALUES ('legacy',1000,10,0,'cached')")

        migration = (ROOT.parent / "goodwatch-webapp/scripts/migrations/2026-11-11-search-attribution.sql").read_text()
        for kind, table in tables.items():
            migration = migration.replace("doc." + kind, table)
        for statement in migration.split(";"):
            if statement.strip():
                self.sql(statement)

        attribution = dict(version=1, consumer="web", surface="start", trigger="typing_pause", actor_kind="guest", search_id="search-1", reported_by="client")
        spending, history = tables.values()
        for row_id, event, amount in [("estimate", "estimate", 1000), ("settled", "settlement", -850)]:
            self.sql(f"INSERT INTO {spending} (id,attempt_id,cache_key,event,budget_at,created_at,amount_nano,attribution) VALUES (?, 'attempt', 'key', ?, 1000, 1000, ?, ?)", (row_id, event, amount, attribution))
        self.sql(f"INSERT INTO {history} (id,created_at,elapsed_ms,charged_nano,outcome,attribution) VALUES ('current',1000,10,0,'cached',?)", (attribution,))
        for table in tables.values():
            self.sql(f"REFRESH TABLE {table}")
            self.assertEqual(self.sql(f"SELECT attribution FROM {table} WHERE id='legacy'")["rows"], [[None]])
        self.assertEqual(self.sql(f"SELECT coalesce(attribution['trigger'],'unknown'),sum(amount_nano) FROM {spending} GROUP BY 1 ORDER BY 1")["rows"], [["typing_pause", 150], ["unknown", 100]])
        self.assertEqual(self.sql(f"SELECT attribution FROM {history} WHERE id='current'")["rows"], [[attribution]])
        for table in tables.values():
            with self.assertRaises(HTTPError) as raised:
                columns = "id,attempt_id,cache_key,event,budget_at,created_at,amount_nano,attribution" if table == spending else "id,created_at,elapsed_ms,charged_nano,outcome,attribution"
                values = "'invalid','attempt','key','estimate',1000,1000,100,?" if table == spending else "'invalid',1000,10,0,'cached',?"
                self.sql(f"INSERT INTO {table} ({columns}) VALUES ({values})", ({**attribution, "unbounded": "not allowed"},))
            self.assertIn("unbounded", raised.exception.__notes__[-1])


if __name__ == "__main__":
    unittest.main()
