"""The standard Windmill Crate initializer installs the general catalog and profile read model."""
from contextlib import redirect_stdout
import importlib.util
import io
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "windmill"))
from f.sync.models.crate_schemas import ARCHIVE_COLUMN_TYPES, SCHEMAS
from f.tvtropes_catalog.catalog import schema_sql


spec = importlib.util.spec_from_file_location("trope_catalog_initializer_test", ROOT / "windmill/f/sync/init/cratedb.py")
initializer = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"f.db.cratedb": SimpleNamespace(CrateConnector=object)}):
    spec.loader.exec_module(initializer)


class RecordingCrate:
    def __init__(self, tables=None):
        self.tables = tables or {}
        self.writes = []
        self.closed = False
        # The existing blob table is outside this change; avoid creating it during the table migration assertions.
        self.cur = SimpleNamespace(rowcount=1, execute=lambda *args: None)

    def table_exists(self, name):
        return name in self.tables

    def get_existing_columns(self, name):
        return self.tables[name]

    def run(self, sql, params=None):
        self.writes.append((sql, params))

    def disconnect(self):
        self.closed = True


def initialized_tables():
    return {name: {**{key: value.lower() for key, value in initializer.column_specs(schema).items()},
                   **{f"{parent}['{child}']": kind.lower()
                      for parent, children in schema.get("object_columns", {}).items() for child, kind in children.items()}}
            for name, schema in SCHEMAS.items()}


def run_initializer(connector, *, dry_run=False):
    output = io.StringIO()
    with patch.object(initializer, "CrateConnector", return_value=connector), redirect_stdout(output):
        initializer.init_database(dry_run=dry_run)
    return output.getvalue()


class TropeCatalogInitializerTests(unittest.TestCase):
    def test_fresh_install_creates_catalog_and_snapshot_and_excerpt_length(self):
        connector = RecordingCrate()
        run_initializer(connector)
        statements = [sql for sql, _ in connector.writes]
        catalog = next(sql for sql in statements if sql.startswith("CREATE TABLE trope_catalog "))
        snapshot = next(sql for sql in statements if sql.startswith("CREATE TABLE profile_tropes_snapshot "))
        excerpts = next(sql for sql in statements if sql.startswith("CREATE TABLE trope "))
        self.assertIn("name TEXT", catalog)
        self.assertIn("PRIMARY KEY (name)", catalog)
        self.assertIn("description TEXT INDEX OFF", catalog)
        self.assertIn("description_doc TEXT INDEX OFF STORAGE WITH (columnstore = false)", catalog)
        self.assertIn("source_hash TEXT", catalog)
        self.assertIn("fetched_at TIMESTAMP", catalog)
        self.assertNotIn("FULLTEXT", catalog)
        self.assertNotIn("created_at", catalog)
        self.assertIn("PRIMARY KEY (owner_id)", snapshot)
        self.assertIn("pool TEXT INDEX OFF STORAGE WITH (columnstore = false)", snapshot)
        self.assertIn("content_length INTEGER", excerpts)
        self.assertTrue(connector.closed)

    def test_existing_install_creates_new_tables_and_adds_length_column(self):
        tables = initialized_tables()
        del tables["trope_catalog"]
        del tables["profile_tropes_snapshot"]
        del tables["trope"]["content_length"]
        connector = RecordingCrate(tables)
        run_initializer(connector)
        changes = [sql for sql, _ in connector.writes if sql.startswith(("CREATE TABLE", "ALTER TABLE"))]
        self.assertEqual(len(changes), 3)
        self.assertTrue(any(sql.startswith("CREATE TABLE trope_catalog ") for sql in changes))
        self.assertTrue(any(sql.startswith("CREATE TABLE profile_tropes_snapshot ") for sql in changes))
        self.assertIn("ALTER TABLE trope ADD COLUMN content_length INTEGER", changes)

    def test_dry_run_reports_every_required_change_without_writes(self):
        connector = RecordingCrate()
        output = run_initializer(connector, dry_run=True)
        self.assertIn("Would run: CREATE TABLE trope_catalog ", output)
        self.assertIn("Would run: CREATE TABLE profile_tropes_snapshot ", output)
        self.assertIn("content_length INTEGER", output)
        self.assertEqual(connector.writes, [])
        self.assertTrue(connector.closed)

    def test_repeat_on_upgraded_install_does_not_change_schema(self):
        connector = RecordingCrate(initialized_tables())
        run_initializer(connector)
        changes = [sql for sql, _ in connector.writes if sql.startswith(("CREATE TABLE", "ALTER TABLE"))]
        self.assertEqual(changes, [])

    def test_existing_empty_archive_object_gets_all_nested_columns_in_dry_run(self):
        tables = initialized_tables()
        tables["trope_catalog"] = {key: value for key, value in tables["trope_catalog"].items() if "[" not in key}
        connector = RecordingCrate(tables)
        output = run_initializer(connector, dry_run=True)
        for child, kind in ARCHIVE_COLUMN_TYPES.items():
            self.assertIn(f"Would run: ALTER TABLE trope_catalog ADD COLUMN source_archive['{child}'] {kind}", output)
        self.assertEqual(connector.writes, [])

    def test_existing_partial_archive_mapping_adds_only_missing_children(self):
        tables = initialized_tables()
        del tables["trope_catalog"]["source_archive['byte_offset']"]
        connector = RecordingCrate(tables)
        run_initializer(connector)
        changes = [sql for sql, _ in connector.writes if sql.startswith("ALTER TABLE")]
        self.assertEqual(changes, ["ALTER TABLE trope_catalog ADD COLUMN source_archive['byte_offset'] BIGINT"])

    def test_standard_initializer_creates_uri_tables_with_typed_archive_mappings(self):
        connector = RecordingCrate()
        run_initializer(connector)
        statements = [sql for sql, _ in connector.writes]
        for table, key in (("trope_catalog_page", "url"), ("trope_catalog_reference", "reference_url")):
            sql = next(s for s in statements if s.startswith(f"CREATE TABLE {table} "))
            self.assertIn(f"PRIMARY KEY ({key})", sql)
            for child, kind in ARCHIVE_COLUMN_TYPES.items():
                self.assertIn(f"{child} {kind}", sql)
        page_sql = next(s for s in statements if s.startswith("CREATE TABLE trope_catalog_page "))
        self.assertIn("description TEXT INDEX OFF STORAGE WITH (columnstore = false)", page_sql)
        self.assertIn("description_doc TEXT INDEX OFF STORAGE WITH (columnstore = false)", page_sql)

    def test_existing_uri_tables_receive_missing_archive_children_without_other_changes(self):
        tables = initialized_tables()
        for table in ("trope_catalog_page", "trope_catalog_reference"):
            tables[table] = {key: value for key, value in tables[table].items() if "[" not in key}
        connector = RecordingCrate(tables)
        run_initializer(connector)
        alters = [sql for sql, _ in connector.writes if sql.startswith("ALTER TABLE")]
        self.assertEqual(len(alters), 2 * len(ARCHIVE_COLUMN_TYPES))
        self.assertTrue(all("source_archive[" in sql for sql in alters))

    def test_seed_tool_and_standard_initializer_declare_the_same_catalog(self):
        self.assertEqual(schema_sql().replace(" IF NOT EXISTS", ""), initializer.create_table_sql("trope_catalog", SCHEMAS["trope_catalog"]))


if __name__ == "__main__":
    unittest.main()
