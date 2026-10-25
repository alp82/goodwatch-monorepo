"""Opt-in local Crate regression for large profile snapshots.

TROPE_TEST_CRATE_URL=http://127.0.0.1:PORT python -m unittest discover -s goodwatch-flows/tests -p test_profile_trope_snapshot_crate.py
Optionally set TROPE_TEST_PAYLOAD to a captured profile JSON file. Otherwise a deterministic 1.7 MB snapshot is used.
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

spec = importlib.util.spec_from_file_location("snapshot_size_initializer_test", ROOT / "windmill/f/sync/init/cratedb.py")
initializer = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
    spec.loader.exec_module(initializer)


@unittest.skipUnless(os.environ.get("TROPE_TEST_CRATE_URL"), "Set TROPE_TEST_CRATE_URL to an isolated local CrateDB")
class ProfileTropeSnapshotCrateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ["TROPE_TEST_CRATE_URL"].rstrip("/")
        if urlsplit(url).hostname not in ("127.0.0.1", "localhost", "::1"):
            raise ValueError("This regression runs only against an explicitly supplied isolated local CrateDB")
        cls.endpoint = url + "/_sql"
        path = os.environ.get("TROPE_TEST_PAYLOAD")
        cls.payload = Path(path).read_text() if path else json.dumps({"pool": [{"k": f"movie-{i}", "description": "x" * 1700} for i in range(1000)]})
        if len(cls.payload.encode()) < 1_000_000:
            raise ValueError("Snapshot fixture must exceed 1 MB to exercise the reported failure")
        cls.created = []

    @classmethod
    def tearDownClass(cls):
        for table in cls.created:
            cls.sql(f"DROP TABLE IF EXISTS {table}")

    @classmethod
    def sql(cls, stmt, args=()):
        request = Request(cls.endpoint, data=json.dumps({"stmt": stmt, "args": list(args)}).encode(), headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=20) as response:
            return json.load(response)

    def table(self, schema):
        name = "test_trope_snapshot_" + uuid4().hex
        self.sql(initializer.create_table_sql(name, schema))
        self.created.append(name)
        return name

    def test_legacy_text_docvalues_reproduces_the_large_snapshot_failure(self):
        schema = deepcopy(SCHEMAS["profile_tropes_snapshot"])
        schema["columns"]["pool"] = "TEXT INDEX OFF"
        table = self.table(schema)
        with self.assertRaises(HTTPError) as raised:
            self.sql(f"INSERT INTO {table} (owner_id,read_from,pool) VALUES (?,?,?)", ("owner", 1, self.payload))
        try:
            message = json.load(raised.exception)["error"]["message"]
        finally:
            raised.exception.close()
        self.assertIn("32766", message)
        self.assertIn("DocValuesField", message)

    def test_full_size_snapshot_roundtrips_through_the_standard_schema(self):
        table = self.table(SCHEMAS["profile_tropes_snapshot"])
        self.sql(f"INSERT INTO {table} (owner_id,read_from,pool) VALUES (?,?,?)", ("owner", 1, self.payload))
        self.sql(f"REFRESH TABLE {table}")
        stored = self.sql(f"SELECT read_from,pool FROM {table} WHERE owner_id=?", ("owner",))["rows"]
        self.assertEqual(stored, [[1, self.payload]])


if __name__ == "__main__":
    unittest.main()
