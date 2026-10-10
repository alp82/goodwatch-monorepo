"""Native import journals must work both on fresh installs and after an upgrade."""
import importlib.util
import re
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "goodwatch-flows/windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class NativeImportSchemaTests(unittest.TestCase):
    def test_migration_uses_the_initializer_column_definitions(self):
        sql = (ROOT / "docs/implementation/imports/native-import-schema.sql").read_text()
        additions = re.findall(r"ALTER TABLE doc\.(\w+) ADD COLUMN (\w+) ([^;]+);", sql)
        self.assertEqual(len(additions), 17)
        for table, column, definition in additions:
            with self.subTest(table=table, column=column):
                self.assertEqual(definition, SCHEMAS[table]["columns"][column])

    def test_fresh_tables_support_large_journals_and_existing_identity_keys(self):
        spec = importlib.util.spec_from_file_location(
            "native_import_init_test", ROOT / "goodwatch-flows/windmill/f/sync/init/cratedb.py"
        )
        initializer = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
            spec.loader.exec_module(initializer)
        sql = initializer.create_table_sql("user_import_item", SCHEMAS["user_import_item"])
        self.assertIn("payload TEXT INDEX OFF STORAGE WITH (columnstore = false)", sql)
        self.assertIn("PRIMARY KEY (import_id, row_index)", sql)
        self.assertIn("episode_tmdb_id BIGINT", sql)
        self.assertIn("watched_at TIMESTAMP WITH TIME ZONE", sql)
        self.assertIn("created_at TIMESTAMP WITH TIME ZONE NOT NULL", initializer.create_table_sql(
            "user_import", SCHEMAS["user_import"]
        ))


if __name__ == "__main__":
    unittest.main()
