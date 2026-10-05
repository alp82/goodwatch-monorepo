"""Backup run logic against a stubbed run_sql. No request leaves the process.

Run: uv run --with requests python -m unittest discover -s goodwatch-crate
"""

import contextlib
import datetime
import fcntl
import io
import re
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import backup

# A Monday at 04:05: only the hourly tier is due.
NOW = datetime.datetime(2026, 10, 5, 4, 5, 0)
HOUR_MS = 3600 * 1000


class FakeCrate:
    """Stands in for run_sql and keeps the snapshots in memory."""

    def __init__(self, snapshots=None):
        self.snapshots = dict(snapshots or {})  # name -> [state, finished]
        self.statements = []
        self.fail = None  # a statement prefix that returns None
        self.disabled = False  # a disabled repository lists 0 rows
        self.created_state = "SUCCESS"

    def __call__(self, stmt, timeout=None):
        self.statements.append((stmt, timeout))
        if self.fail and stmt.startswith(self.fail):
            return None
        name = stmt.split('"')[3] if '"' in stmt else None
        if stmt.startswith("CREATE SNAPSHOT"):
            self.snapshots[name] = [self.created_state, time.time() * 1000]
            return {"rowcount": 1}
        if stmt.startswith("DROP SNAPSHOT"):
            del self.snapshots[name]
            return {"rowcount": 1}
        if self.disabled:
            return {"rows": []}
        return {"rows": [[n, s, f] for n, (s, f) in self.snapshots.items()]}

    def dropped(self):
        return [s.split('"')[3] for s, _ in self.statements if s.startswith("DROP")]


def old(hours):
    return ["SUCCESS", time.time() * 1000 - hours * HOUR_MS]


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        lock_file = str(Path(self.directory.name) / "backup.lock")
        patcher = mock.patch.object(backup, "LOCK_FILE", lock_file)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_main(self, crate, now=NOW):
        output = io.StringIO()
        with (
            mock.patch.object(backup, "run_sql", crate),
            contextlib.redirect_stdout(output),
        ):
            code = backup.main(now)
        return code, output.getvalue()

    def test_success_creates_first_then_cleans_then_verifies(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4), "snap_legacy": old(5000)})
        code, output = self.run_main(crate)

        self.assertEqual(code, 0)
        kinds = [stmt.split()[0] for stmt, _ in crate.statements]
        self.assertEqual(kinds, ["CREATE", "SELECT", "DROP", "SELECT"])
        self.assertIn("hourly_20261005_040500", crate.snapshots)
        self.assertEqual(crate.dropped(), ["hourly_20261005_000500"])
        self.assertIn("snap_legacy", crate.snapshots)
        self.assertIn("Backup run finished.", output)

    def test_every_log_line_starts_with_a_utc_timestamp(self):
        _, output = self.run_main(FakeCrate())
        for line in output.splitlines():
            self.assertRegex(line, r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ ")

    def test_statements_carry_timeouts_that_fit_the_measured_durations(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4)})
        self.run_main(crate)
        timeouts = {stmt.split()[0]: timeout for stmt, timeout in crate.statements}
        self.assertGreaterEqual(timeouts["CREATE"], 2 * 380)
        self.assertGreaterEqual(timeouts["DROP"], 2 * 856)
        self.assertGreaterEqual(timeouts["SELECT"], 2 * 90)

    def test_run_sql_passes_a_timeout_and_returns_none_on_error(self):
        with (
            mock.patch.object(backup.requests, "post") as post,
            contextlib.redirect_stdout(io.StringIO()),
        ):
            post.side_effect = backup.requests.Timeout("read timed out")
            self.assertIsNone(backup.run_sql("SELECT 1", timeout=7))
            self.assertEqual(
                post.call_args.kwargs["timeout"], (backup.CONNECT_TIMEOUT, 7)
            )
            backup.run_sql("SELECT 1")
            self.assertIsNotNone(post.call_args.kwargs["timeout"][1])

    def test_creation_failure_exits_non_zero_and_drops_nothing(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4)})
        crate.fail = "CREATE SNAPSHOT"
        code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_FAILED)
        self.assertEqual(len(crate.statements), 1)
        self.assertIn("BACKUP FAILED: Snapshot creation failed", output)

    def test_zero_rows_from_a_disabled_repository_exits_non_zero(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4)})
        crate.disabled = True
        code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_FAILED)
        self.assertEqual(crate.dropped(), [])
        self.assertIn("0 rows", output)

    def test_listing_error_exits_non_zero(self):
        crate = FakeCrate()
        crate.fail = "SELECT"
        code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_FAILED)
        self.assertIn("Could not read sys.snapshots", output)

    def test_held_lock_exits_at_once_with_its_own_code(self):
        crate = FakeCrate()
        with open(backup.LOCK_FILE, "w") as holder:
            fcntl.flock(holder, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_LOCKED)
        self.assertNotIn(code, (0, backup.EXIT_FAILED))
        self.assertEqual(crate.statements, [])
        self.assertIn("Another backup run holds the lock", output)

    def test_lock_is_free_again_after_a_run(self):
        self.assertEqual(self.run_main(FakeCrate())[0], 0)
        self.assertEqual(self.run_main(FakeCrate())[0], 0)

    def test_delete_failure_exits_non_zero(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4)})
        crate.fail = "DROP SNAPSHOT"
        code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_FAILED)
        self.assertIn("Snapshot deletion failed: hourly_20261005_000500", output)

    def test_cleanup_drops_at_most_two_per_run_oldest_first(self):
        crate = FakeCrate(
            {
                "hourly_c": old(5),
                "daily_a": old(200),
                "hourly_b": old(9),
                "weekly_d": old(4),
                "hourly_fresh": old(1),
            }
        )
        code, output = self.run_main(crate)

        self.assertEqual(code, 0)
        self.assertEqual(crate.dropped(), ["daily_a", "hourly_b"])
        self.assertIn("hourly_c", crate.snapshots)
        self.assertIn("Deleted 2 of 3 expired snapshot(s).", output)

    def test_cleanup_starts_no_drop_after_the_time_budget(self):
        crate = FakeCrate({"hourly_a": old(9), "hourly_b": old(5)})
        ticks = iter([0, backup.CLEANUP_BUDGET - 1, backup.CLEANUP_BUDGET])
        with mock.patch.object(backup.time, "monotonic", lambda: next(ticks)):
            code, _ = self.run_main(crate)

        self.assertEqual(code, 0)
        self.assertEqual(crate.dropped(), ["hourly_a"])

    def test_retention_keeps_each_tier_for_its_own_period(self):
        now_ms = 1_000 * 24 * HOUR_MS
        rows = [
            ["hourly_keep", "SUCCESS", now_ms - 2 * HOUR_MS],
            ["hourly_drop", "SUCCESS", now_ms - 4 * HOUR_MS],
            ["daily_keep", "SUCCESS", now_ms - 2 * 24 * HOUR_MS],
            ["daily_drop", "SUCCESS", now_ms - 4 * 24 * HOUR_MS],
            ["weekly_keep", "SUCCESS", now_ms - 20 * 24 * HOUR_MS],
            ["weekly_drop", "SUCCESS", now_ms - 22 * 24 * HOUR_MS],
            ["snap_legacy", "SUCCESS", now_ms - 300 * 24 * HOUR_MS],
            ["hourly_running", "IN_PROGRESS", None],
        ]
        self.assertEqual(
            backup.expired_snapshots(rows, now_ms),
            ["weekly_drop", "daily_drop", "hourly_drop"],
        )

    def test_snapshot_that_is_not_success_exits_non_zero(self):
        crate = FakeCrate()
        crate.created_state = "PARTIAL"
        code, output = self.run_main(crate)

        self.assertEqual(code, backup.EXIT_FAILED)
        self.assertIn("hourly_20261005_040500 is PARTIAL", output)

    def test_snapshot_missing_after_the_run_exits_non_zero(self):
        crate = FakeCrate({"hourly_20261005_000500": old(4)})
        real = crate.__call__

        def losing(stmt, timeout=None):
            result = real(stmt, timeout)
            if stmt.startswith("DROP"):
                crate.snapshots.pop("hourly_20261005_040500")
                crate.snapshots["daily_x"] = old(1)
            return result

        output = io.StringIO()
        with (
            mock.patch.object(backup, "run_sql", losing),
            contextlib.redirect_stdout(output),
        ):
            with self.assertRaises(backup.BackupError) as raised:
                backup.run_backup(NOW)
        self.assertIn("is missing", str(raised.exception))

    def test_midnight_adds_daily_and_sunday_midnight_adds_weekly(self):
        monday = FakeCrate()
        self.run_main(monday, datetime.datetime(2026, 10, 5, 0, 5, 1))
        self.assertEqual(
            sorted(monday.snapshots),
            ["daily_20261005_000501", "hourly_20261005_000501"],
        )

        sunday = FakeCrate()
        code, output = self.run_main(sunday, datetime.datetime(2026, 10, 4, 0, 5, 1))
        self.assertEqual(code, 0)
        self.assertEqual(
            [s.split('"')[3] for s, _ in sunday.statements[:3]],
            [
                "hourly_20261004_000501",
                "daily_20261004_000501",
                "weekly_20261004_000501",
            ],
        )
        self.assertTrue(re.search(r"Verified: hourly_.*daily_.*weekly_", output))

    def test_cleanup_legacy_still_imports_what_it_needs(self):
        import cleanup_legacy

        self.assertEqual(cleanup_legacy.KNOWN_PREFIXES, tuple(backup.RETENTION))


if __name__ == "__main__":
    unittest.main()
