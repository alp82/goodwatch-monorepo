"""Opened demand is an additive nullable timestamp, not a queue reset."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    spec = importlib.util.spec_from_file_location("opened_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_only_adds_idempotent_timestamp(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "windmill"))
    migration = load(ROOT / "scripts/migrate_opened_demand.py")
    calls = []

    class Cursor:
        def execute(self, sql):
            calls.append(sql)

    migration.migrate(Cursor())
    migration.migrate(Cursor())
    assert calls == [migration.SQL, migration.SQL]
    assert migration.SQL == "ALTER TABLE crawl_priority ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE"
    schema = load(ROOT / "windmill/f/sync/models/crate_schemas.py").SCHEMAS["crawl_priority"]
    assert schema["columns"]["last_opened_at"] == "TIMESTAMP WITH TIME ZONE"
    for field in ("demand", "acknowledged_demand", "claimed_demand", "last_success_at", "lease_token", "lease_expires_at"):
        assert field in schema["columns"]


def test_metadata_acknowledgment_preserves_opened_timestamp_and_cooldown():
    existing = load(ROOT / "tests/test_priority_queue.py")

    class OpenedCrate(existing.MemoryCrate):
        def run(self, sql, params):
            # Validate the real claim/ack SQL rather than assuming the memory adapter models every field.
            assert "last_opened_at" not in sql
            super().run(sql, params)

    db = OpenedCrate()
    db.row["last_opened_at"] = db.row["now_ms"]
    lease = existing.queue.claim(db, "movie", 10679)
    db.impression()
    db.row["last_opened_at"] += 500
    accepted_open = db.row["last_opened_at"]
    existing.queue.acknowledge(db, lease)
    assert db.row["last_opened_at"] == accepted_open
    assert db.row["demand"] - db.row["acknowledged_demand"] == 1
    assert db.row["last_success_ms"] == db.row["now_ms"]
    assert existing.queue.claim(db, "movie", 10679) is None
    assert existing.queue.COOLDOWN_MS == 7 * 24 * 60 * 60 * 1000
