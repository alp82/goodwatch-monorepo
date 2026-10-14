"""Exposure DDL matches fresh installs, without connecting to Crate."""
import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "goodwatch-flows/windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class ListExposureSchemaTests(unittest.TestCase):
    def test_deployment_ddl_matches_initializer(self):
        spec = importlib.util.spec_from_file_location(
            "exposure_init_test", ROOT / "goodwatch-flows/windmill/f/sync/init/cratedb.py"
        )
        initializer = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
            spec.loader.exec_module(initializer)
        expected = initializer.create_table_sql("user_list_exposure", SCHEMAS["user_list_exposure"])
        ddl = (ROOT / "docs/implementation/exposure-log/schema.sql").read_text()
        ddl = " ".join(line for line in ddl.splitlines() if not line.startswith("--"))
        ddl = " ".join(ddl.split()).replace("( ", "(").replace(" )", ")").rstrip(";")
        self.assertEqual(ddl.replace("IF NOT EXISTS doc.", ""), expected)

    def test_arrays_preserve_title_keys_and_nullable_matches(self):
        schema = SCHEMAS["user_list_exposure"]
        self.assertEqual(schema["columns"]["title_keys"], "ARRAY(BIGINT)")
        self.assertEqual(schema["columns"]["positions"], "ARRAY(INTEGER)")
        self.assertEqual(schema["columns"]["taste_matches"], "ARRAY(INTEGER)")
        self.assertEqual(schema["primary_key"], ["user_id", "list_id"])
        self.assertEqual(schema["clustered_by"], "user_id")
        self.assertFalse(schema["timestamps"])


if __name__ == "__main__":
    unittest.main()
