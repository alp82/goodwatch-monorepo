"""Offline migration checks; no database credentials or live services required."""

from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
import importlib.util
import io
import json
import os
from uuid import uuid4
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "priority_migration", Path(__file__).parents[1] / "scripts/migrate_priority_queue.py"
)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def row(media_type="movie", tmdb_id=1, demand=7):
    return dict(zip(migration.FIELDS, (media_type, tmdb_id, demand, 1000, 2000, None)))


class SourceReconciliationTest(unittest.TestCase):
    def test_zero_duplicates_preserve_latest_timestamps_and_originals(self):
        older = datetime(2025, 3, 22)
        newer = datetime(2025, 11, 7)
        audit = []
        result = list(migration.source_rows(
            [(284054, 0, older, older, older), (284054, 0, older, newer, newer)],
            "movie", True, audit,
        ))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["demand"], 0)
        self.assertEqual(result[0]["last_success_at"], migration.timestamp(newer))
        self.assertEqual(len(audit[0]["source_rows"]), 2)
        self.assertEqual(audit[0]["exported_row"], result[0])

    def test_duplicates_require_explicit_policy_and_never_merge_nonzero_demand(self):
        for enabled, demands in [(False, (0, 0)), (True, (1, 0)), (True, (0, 1)), (True, (1, 1))]:
            with self.subTest(enabled=enabled, demands=demands), self.assertRaisesRegex(ValueError, "merging is forbidden"):
                list(migration.source_rows([(1, d, None, None, None) for d in demands], "movie", enabled, []))


class MemoryTarget:
    def __init__(self, initial=(), fail_at=None):
        self.data = {(item[0], item[1]): tuple(item) for item in initial}
        self.fail_at = fail_at
        self.write_calls = 0
        self.result = []
        self.closed = 0

    def cursor(self):
        return self

    def executemany(self, sql, values):
        assert "DO NOTHING" in sql
        result = []
        for values_row in values:
            self.write_calls += 1
            if self.write_calls == self.fail_at:
                result.append({"rowcount": -2, "error_message": "unavailable shard"})
                continue
            key = tuple(values_row[:2])
            if key in self.data:
                result.append({"rowcount": 0})
            else:
                self.data[key] = tuple(values_row) + (0, 0, None, None)
                result.append({"rowcount": 1})
        return result

    def execute(self, sql, params=None):
        if "count(*)" in sql:
            self.result = [(len(self.data),)]
        elif sql.startswith("REFRESH"):
            pass
        else:
            self.result = sorted(
                [item for (kind, identifier), item in self.data.items()
                 if kind == params[0] and identifier in params[1:]],
                key=lambda item: item[1],
            )

    def fetchall(self):
        return self.result

    def fetchone(self):
        return self.result[0]

    def close(self):
        self.closed += 1


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "snapshot.jsonl"

    def snapshot(self, items):
        self.path.write_text("".join(json.dumps(item) + "\n" for item in items))
        return str(self.path)

    def transfer(self, target, action="import"):
        connect = SimpleNamespace(connect=lambda *args, **kwargs: target)
        with patch.dict("sys.modules", {"crate": SimpleNamespace(client=connect)}), patch.object(
            migration, "settings", return_value={"CRATE_HOSTS": "localhost:4200", "CRATE_USER": "crate", "CRATE_PASS": ""}
        ), redirect_stdout(io.StringIO()):
            migration.transfer(SimpleNamespace(snapshot=str(self.path), action=action))

    def test_timezone_aware_timestamps_preserve_instant(self):
        utc = datetime(2026, 9, 9, 10, 30, 1, 123000, timezone.utc)
        berlin = utc.astimezone(timezone(timedelta(hours=2)))
        self.assertEqual(migration.timestamp(utc), migration.timestamp(berlin))
        self.assertEqual(migration.timestamp(utc.replace(tzinfo=None)), migration.timestamp(utc))
        self.assertEqual(migration.timestamp(utc) % 1000, 123)
        self.assertIsNone(migration.timestamp(None))

    def test_host_normalization_preserves_explicit_ports_and_tls(self):
        self.assertEqual(migration.crate_hosts({"CRATE_HOSTS": " 10.0.0.11:4201,10.0.0.12,https://db.example:443/, , [::1]:4202", "CRATE_PORT": "4200"}), [
            "http://10.0.0.11:4201", "http://10.0.0.12:4200", "https://db.example:443", "http://[::1]:4202"
        ])

    def test_invalid_hosts_are_rejected(self):
        for host in ("", " , ", "postgres://localhost", "http://user:secret@host", "http://host/path", "http://host?query", "http://host:99999"):
            with self.subTest(host=host), self.assertRaises(ValueError):
                migration.crate_hosts({"CRATE_HOSTS": host})

    def test_snapshot_validation_rejects_invalid_types_and_overflow(self):
        invalid = [("tmdb_id", True), ("tmdb_id", 0), ("tmdb_id", 2**31), ("demand", True), ("demand", -1), ("demand", 2**63), ("media_type", "tv"), ("created_at", True), ("updated_at", 2**63), ("last_success_at", "2026-09-09")]
        for field, value in invalid:
            with self.subTest(field=field, value=value):
                item = row()
                item[field] = value
                with self.assertRaises(ValueError):
                    migration.inspect(self.snapshot([item]))
        for item in ([], None, {**row(), "unexpected": 1}):
            with self.subTest(item=item), self.assertRaises(ValueError):
                migration.inspect(self.snapshot([item]))

    def test_duplicate_or_unsorted_keys_rejected(self):
        for items in ([row(), row()], [row(tmdb_id=2), row()], [row("show"), row()]):
            with self.subTest(items=items), self.assertRaises(ValueError):
                migration.inspect(self.snapshot(items))

    def test_digest_is_independent_of_json_field_order(self):
        a = migration.inspect(self.snapshot([row()]))
        b = migration.inspect(self.snapshot([dict(reversed(list(row().items())))]))
        self.assertEqual(a, b)
        self.assertEqual(a["totals"]["movie"], {"rows": 1, "demand": 7})

    def test_batches_separate_media_types_and_respect_limit(self):
        self.snapshot([row(tmdb_id=i) for i in (1, 2, 3)] + [row("show")])
        with patch.object(migration, "BATCH_SIZE", 2):
            self.assertEqual([len(batch) for batch in migration.batches(self.path)], [2, 1, 1])

    def test_all_rows_validated_before_any_target_connection(self):
        self.snapshot([row(), row(tmdb_id=2, demand=-1)])
        with patch.dict("sys.modules", {"crate": SimpleNamespace(client=None)}), patch.object(migration, "settings") as settings:
            with self.assertRaises(ValueError):
                migration.transfer(SimpleNamespace(snapshot=str(self.path), action="import"))
            settings.assert_not_called()

    def test_restart_is_idempotent_and_preserves_timestamps(self):
        self.snapshot([row(), row("show", 3, 9)])
        target = MemoryTarget()
        self.transfer(target)
        before = dict(target.data)
        self.transfer(target)
        self.assertEqual(target.data, before)
        self.assertEqual(target.data[("movie", 1)], tuple(row().values()) + (0, 0, None, None))

    def test_partial_bulk_failure_can_resume_from_same_snapshot(self):
        self.snapshot([row(), row(tmdb_id=2)])
        target = MemoryTarget(fail_at=2)
        with self.assertRaisesRegex(RuntimeError, "partially failed"):
            self.transfer(target)
        self.assertEqual(len(target.data), 1)
        self.assertEqual(target.closed, 2)
        target.fail_at = None
        self.transfer(target)
        self.assertEqual(len(target.data), 2)
        self.assertEqual(target.data[("movie", 1)][2], 7)

    def test_conflicting_live_demand_and_leases_are_not_overwritten(self):
        self.snapshot([row()])
        baseline = tuple(row().values()) + (0, 0, None, None)
        for index, value in ((2, 100), (6, 3), (7, 7), (8, "live-lease"), (9, 99999)):
            with self.subTest(index=index):
                live = list(baseline)
                live[index] = value
                target = MemoryTarget([live])
                with self.assertRaisesRegex(RuntimeError, "differs"):
                    self.transfer(target)
                self.assertEqual(target.data[("movie", 1)], tuple(live))

    def test_verify_does_not_write_and_rejects_missing_or_extra_rows(self):
        self.snapshot([row()])
        baseline = tuple(row().values()) + (0, 0, None, None)
        for items, message in (([], "differs"), ([baseline, tuple(row("show").values()) + (0, 0, None, None)], "extra rows")):
            with self.subTest(items=items):
                target = MemoryTarget(items)
                with self.assertRaisesRegex(RuntimeError, message):
                    self.transfer(target, "verify")
                self.assertEqual(target.write_calls, 0)

    def test_empty_snapshot_verifies_only_empty_target(self):
        self.snapshot([])
        self.transfer(MemoryTarget())
        target = MemoryTarget([tuple(row().values()) + (0, 0, None, None)])
        with self.assertRaisesRegex(RuntimeError, "extra rows"):
            self.transfer(target)

    def test_failed_export_never_publishes_partial_snapshot(self):
        class SourceCursor:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def execute(self, sql): pass
            def __iter__(self):
                yield (1, 7, None, None, None)
                raise RuntimeError("source connection lost")

        connection = SimpleNamespace(set_session=lambda **kwargs: None, cursor=lambda **kwargs: SourceCursor(), close=lambda: None)
        config = {f"POSTGRES_{name}": "unused" for name in ("HOST", "PORT", "DB", "USER", "PASS")}
        with patch.dict("sys.modules", {"psycopg2": SimpleNamespace(connect=lambda **kwargs: connection)}), patch.object(migration, "settings", return_value=config):
            with self.assertRaisesRegex(RuntimeError, "source connection lost"):
                migration.export(SimpleNamespace(snapshot=str(self.path)))
        self.assertFalse(self.path.exists())
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])


    def test_successful_export_is_private_complete_and_refuses_overwrite(self):
        class SourceCursor:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def execute(self, sql): pass
            def __iter__(self):
                yield (1, 7, datetime(2026, 1, 1, tzinfo=timezone.utc), None, None)

        connection = SimpleNamespace(set_session=lambda **kwargs: None, cursor=lambda **kwargs: SourceCursor(), close=lambda: None)
        config = {f"POSTGRES_{name}": "unused" for name in ("HOST", "PORT", "DB", "USER", "PASS")}
        with patch.dict("sys.modules", {"psycopg2": SimpleNamespace(connect=lambda **kwargs: connection)}), patch.object(migration, "settings", return_value=config), redirect_stdout(io.StringIO()):
            migration.export(SimpleNamespace(snapshot=str(self.path)))
            before = self.path.read_bytes()
            with self.assertRaises(FileExistsError):
                migration.export(SimpleNamespace(snapshot=str(self.path)))
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual([item["media_type"] for item in migration.rows(self.path)], ["movie", "show"])
        self.assertEqual(list(Path(self.directory.name).iterdir()), [self.path])


@unittest.skipUnless(os.environ.get("TEST_CRATE_URL"), "requires disposable TEST_CRATE_URL and crate package")
class RealMigrationTests(unittest.TestCase):
    def test_import_restart_and_conflict_using_real_driver(self):
        from crate import client

        url = os.environ["TEST_CRATE_URL"]
        schema = f"migration_test_{uuid4().hex}"
        connection = client.connect(url, schema=schema)
        cursor = connection.cursor()
        cursor.execute(f"""CREATE TABLE {schema}.crawl_priority (
            media_type TEXT, tmdb_id INTEGER, demand BIGINT,
            acknowledged_demand BIGINT, claimed_demand BIGINT,
            created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE,
            last_success_at TIMESTAMP WITH TIME ZONE, lease_token TEXT,
            lease_expires_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (media_type, tmdb_id)
        ) WITH (number_of_replicas=0)""")
        try:
            original_connect = client.connect
            def connect(*args, **kwargs):
                return original_connect(*args, **kwargs, schema=schema)
            with TemporaryDirectory() as directory:
                path = Path(directory) / "snapshot.jsonl"
                items = [row(), row("show", 3, 11)]
                path.write_text("".join(json.dumps(item) + "\n" for item in items))
                args = SimpleNamespace(snapshot=str(path), action="import")
                config = {"CRATE_HOSTS": url.removeprefix("http://"), "CRATE_USER": "crate", "CRATE_PASS": ""}
                with patch.object(client, "connect", side_effect=connect), patch.object(migration, "settings", return_value=config), redirect_stdout(io.StringIO()):
                    migration.transfer(args)
                    migration.transfer(args)
                    args.action = "verify"
                    migration.transfer(args)
                    cursor.execute("UPDATE crawl_priority SET demand = demand + 1 WHERE media_type='movie' AND tmdb_id=1")
                    args.action = "import"
                    with self.assertRaisesRegex(RuntimeError, "differs"):
                        migration.transfer(args)
                    cursor.execute("SELECT demand FROM crawl_priority WHERE media_type='movie' AND tmdb_id=1")
                    self.assertEqual(cursor.fetchone()[0], 8)
        finally:
            cursor.execute(f"DROP TABLE {schema}.crawl_priority")
            cursor.close()
            connection.close()


if __name__ == "__main__":
    unittest.main()
