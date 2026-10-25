import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "windmill"))
with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
    spec = importlib.util.spec_from_file_location("trope_lengths_test", ROOT / "windmill/f/sync/backfill/trope_lengths.py")
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)


class Connector:
    def __init__(self, schema=True):
        self.schema = schema
        self.writes = []
        self.calls = []
        self.remaining = {"movie": [1, 2, 3], "show": [4]}

    def table_exists(self, name):
        return self.schema

    def get_existing_columns(self, name):
        return ["content_length"] if self.schema else []

    def select(self, sql, params):
        self.calls.append((sql, params))
        media_type, after = params
        return [{"media_tmdb_id": value} for value in self.remaining[media_type] if value > after][:2]

    def run(self, sql, params=None):
        self.writes.append((sql, params))


class TropeLengthsTests(unittest.TestCase):
    def test_dry_run_never_changes_schema_or_rows(self):
        connector = Connector(False)
        self.assertEqual(migration.prepare(connector)["schema_changes"], 2)
        self.assertEqual(connector.writes, [])

    def test_keyset_batches_visit_each_title_once(self):
        connector = Connector()
        result = migration.prepare(connector, dry_run=False, batch_size=2)
        self.assertEqual(result["titles"], 4)
        self.assertEqual([params for _, params in connector.writes], [("movie", 1, 2), ("movie", 3), ("show", 4)])
        self.assertTrue(all("content_length IS NULL" in sql for sql, _ in connector.writes))
        self.assertTrue(all("OFFSET" not in sql for sql, _ in connector.calls))

    def test_dry_run_reports_all_batches_without_writing(self):
        connector = Connector()
        self.assertEqual(migration.prepare(connector, batch_size=2)["titles"], 4)
        self.assertEqual(connector.writes, [])

    def test_rejects_unbounded_batch_sizes(self):
        for size in (0, -1, 501):
            with self.assertRaises(ValueError):
                migration.prepare(Connector(), batch_size=size)


if __name__ == "__main__":
    unittest.main()
