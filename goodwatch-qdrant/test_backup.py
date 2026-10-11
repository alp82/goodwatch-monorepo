import datetime
import io
import json
from contextlib import redirect_stdout
import importlib.util
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class FixedClock(datetime.datetime):
    current = datetime.datetime(2026, 10, 11, 13)

    @classmethod
    def now(cls, tz=None):
        return cls.current.replace(tzinfo=tz) if tz else cls.current


class BackupRotationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.directory = self.root / "fixture"
        self.directory.mkdir()
        self.addCleanup(patch.stopall)
        patch.object(backup, "BACKUP_ROOT", self.root).start()
        patch.object(backup, "BACKUP_LOCK", self.root / "backup.lock", create=True).start()
        patch.object(backup.datetime, "datetime", FixedClock).start()
        FixedClock.current = datetime.datetime(2026, 10, 11, 13)
        self.snapshot = self.directory / "raw.snapshot"
        self.snapshot.write_bytes(b"fixture archive contents")
        self.checksum = self.directory / "raw.snapshot.checksum"
        self.checksum.write_bytes(b"fixture checksum")
        for path in (self.snapshot, self.checksum):
            os.utime(path, (FixedClock.current.timestamp(), FixedClock.current.timestamp()))

    def test_competing_rotation_is_rejected_without_touching_recovery_files(self):
        holder = subprocess.Popen([sys.executable, "-c",
            "import fcntl,sys; f=open(sys.argv[1],'w'); fcntl.flock(f,fcntl.LOCK_EX); print('held',flush=True); sys.stdin.read()",
            str(backup.BACKUP_LOCK)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(holder.stdout.readline().strip(), "held")
            with self.assertRaises(BlockingIOError):
                backup.rotate_and_clean("fixture", self.snapshot.name)
        finally:
            holder.communicate(timeout=5)
        self.assertEqual(self.snapshot.read_bytes(), b"fixture archive contents")
        self.assertEqual(self.checksum.read_bytes(), b"fixture checksum")
        self.assertFalse(list(self.directory.glob("hourly_*")))

    def test_hourly_publication_moves_snapshot_and_checksum_without_copying(self):
        original = [path.stat().st_ino for path in (self.snapshot, self.checksum)]
        backup.rotate_and_clean("fixture", self.snapshot.name)
        published = self.directory / "hourly_20261011_130000.snapshot"
        self.assertEqual(published.read_bytes(), b"fixture archive contents")
        self.assertEqual(published.with_name(published.name + ".checksum").read_bytes(), b"fixture checksum")
        self.assertEqual([path.stat().st_ino for path in (published, published.with_name(published.name + ".checksum"))], original)
        self.assertFalse(self.snapshot.exists())
        self.assertFalse(self.checksum.exists())

    def test_sunday_midnight_daily_and_weekly_share_archive_and_checksum(self):
        FixedClock.current = datetime.datetime(2026, 10, 11)
        for path in (self.snapshot, self.checksum):
            os.utime(path, (FixedClock.current.timestamp(), FixedClock.current.timestamp()))
        backup.rotate_and_clean("fixture", self.snapshot.name)
        snapshots = [self.directory / f"{kind}_20261011_000000.snapshot" for kind in ("hourly", "daily", "weekly")]
        self.assertEqual(len({path.stat().st_ino for path in snapshots}), 1)
        self.assertEqual(len({path.with_name(path.name + ".checksum").stat().st_ino for path in snapshots}), 1)
        snapshots[0].unlink()
        snapshots[0].with_name(snapshots[0].name + ".checksum").unlink()
        for path in snapshots[1:]:
            self.assertEqual(path.read_bytes(), b"fixture archive contents")
            self.assertEqual(path.with_name(path.name + ".checksum").read_bytes(), b"fixture checksum")

    def test_retained_archive_and_checksum_are_synced_before_cache_release(self):
        operations = []
        real_sync, real_advise = os.fsync, os.posix_fadvise
        def sync(fd):
            operations.append(("sync", os.fstat(fd).st_ino))
            real_sync(fd)
        def advise(fd, offset, length, advice):
            operations.append(("release", os.fstat(fd).st_ino))
            self.assertEqual((offset, length, advice), (0, 0, os.POSIX_FADV_DONTNEED))
            real_advise(fd, offset, length, advice)
        with patch.object(backup.os, "fsync", side_effect=sync), patch.object(backup.os, "posix_fadvise", side_effect=advise):
            backup.rotate_and_clean("fixture", self.snapshot.name)
        published = self.directory / "hourly_20261011_130000.snapshot"
        for path in (published, published.with_name(published.name + ".checksum")):
            inode = path.stat().st_ino
            self.assertIn(("release", inode), operations)
            self.assertLess(operations.index(("sync", inode)), operations.index(("release", inode)))

    def test_published_directory_entries_are_synced_before_cache_release(self):
        operations = []
        real_sync, real_advise = os.fsync, os.posix_fadvise
        def sync(fd):
            operations.append(("sync", os.fstat(fd).st_ino))
            real_sync(fd)
        def advise(fd, *args):
            operations.append(("release", os.fstat(fd).st_ino))
            real_advise(fd, *args)
        with patch.object(backup.os, "fsync", side_effect=sync), patch.object(backup.os, "posix_fadvise", side_effect=advise):
            backup.rotate_and_clean("fixture", self.snapshot.name)
        directory_sync = ("sync", self.directory.stat().st_ino)
        self.assertIn(directory_sync, operations)
        self.assertLess(operations.index(directory_sync), next(i for i, (kind, _) in enumerate(operations) if kind == "release"))

    def test_failed_checksum_publish_restores_pair_and_keeps_previous_backups(self):
        old = self.directory / "hourly_previous.snapshot"
        old.write_bytes(b"previous recovery archive")
        os.utime(old, (FixedClock.current.timestamp() - 4 * 3600,) * 2)
        real_rename = os.rename
        def rename(source, destination, *args, **kwargs):
            if Path(source) == self.checksum:
                raise OSError("fixture rename failure")
            return real_rename(source, destination, *args, **kwargs)
        with patch.object(backup.os, "rename", side_effect=rename):
            with self.assertRaises(OSError):
                backup.rotate_and_clean("fixture", self.snapshot.name)
        self.assertEqual(self.snapshot.read_bytes(), b"fixture archive contents")
        self.assertEqual(self.checksum.read_bytes(), b"fixture checksum")
        self.assertEqual(old.read_bytes(), b"previous recovery archive")
        self.assertFalse((self.directory / "hourly_20261011_130000.snapshot").exists())

    def test_collision_preserves_existing_archive_and_raw_pair(self):
        existing = self.directory / "hourly_20261011_130000.snapshot"
        existing.write_bytes(b"existing recovery point")
        with self.assertRaises(FileExistsError):
            backup.rotate_and_clean("fixture", self.snapshot.name)
        self.assertEqual(existing.read_bytes(), b"existing recovery point")
        self.assertTrue(self.snapshot.exists())
        self.assertTrue(self.checksum.exists())

    def test_publication_and_advice_failures_restore_pair_without_retention(self):
        for failure in ("link", "directory_sync", "advice"):
            with self.subTest(failure=failure):
                FixedClock.current = datetime.datetime(2026, 10, 11)
                for path in (self.snapshot, self.checksum):
                    os.utime(path, (FixedClock.current.timestamp(),) * 2)
                old = self.directory / "hourly_previous.snapshot"
                old.write_bytes(b"previous recovery archive")
                os.utime(old, (FixedClock.current.timestamp() - 4 * 3600,) * 2)
                if failure == "link":
                    real_link = os.link
                    def link(source, destination, *args, **kwargs):
                        if str(destination).endswith(".checksum"):
                            raise OSError("fixture failure")
                        return real_link(source, destination, *args, **kwargs)
                    target, name, effect = backup.os, "link", link
                elif failure == "directory_sync":
                    real_sync = os.fsync
                    def sync(fd):
                        if os.fstat(fd).st_ino == self.directory.stat().st_ino:
                            raise OSError("fixture failure")
                        return real_sync(fd)
                    target, name, effect = backup.os, "fsync", sync
                else:
                    def advise(*args):
                        raise OSError("fixture failure")
                    target, name, effect = backup.os, "posix_fadvise", advise
                with patch.object(target, name, side_effect=effect):
                    with self.assertRaises(OSError):
                        backup.rotate_and_clean("fixture", self.snapshot.name)
                self.assertEqual(self.snapshot.read_bytes(), b"fixture archive contents")
                self.assertEqual(self.checksum.read_bytes(), b"fixture checksum")
                self.assertEqual(old.read_bytes(), b"previous recovery archive")
                self.assertEqual(list(self.directory.glob("*20261011*")), [])

    def test_retention_keeps_boundary_and_longer_lived_aliases(self):
        timestamp = FixedClock.current.timestamp()
        for prefix, seconds in (("hourly", 3 * 3600), ("daily", 3 * 86400), ("weekly", 21 * 86400)):
            for age, name in ((seconds, "boundary"), (seconds + 1, "expired")):
                for suffix in ("", ".checksum"):
                    path = self.directory / f"{prefix}_{name}.snapshot{suffix}"
                    path.write_bytes(b"prior recovery")
                    os.utime(path, (timestamp - age,) * 2)
        backup.rotate_and_clean("fixture", self.snapshot.name)
        for prefix in ("hourly", "daily", "weekly"):
            for suffix in ("", ".checksum"):
                self.assertTrue((self.directory / f"{prefix}_boundary.snapshot{suffix}").exists())
                self.assertFalse((self.directory / f"{prefix}_expired.snapshot{suffix}").exists())

    def test_snapshot_without_checksum_remains_recoverable(self):
        self.checksum.unlink()
        backup.rotate_and_clean("fixture", self.snapshot.name)
        published = self.directory / "hourly_20261011_130000.snapshot"
        self.assertEqual(published.read_bytes(), b"fixture archive contents")
        self.assertFalse(published.with_name(published.name + ".checksum").exists())

    def test_phase_events_are_allowlisted_and_advice_failure_skips_retention(self):
        output = io.StringIO()
        with redirect_stdout(output), patch.object(backup.os, "posix_fadvise", side_effect=OSError("private fixture path")):
            with self.assertRaises(OSError):
                backup.rotate_and_clean("fixture", self.snapshot.name)
        events = [json.loads(line) for line in output.getvalue().splitlines() if line.startswith("{")]
        self.assertEqual([(event["phase"], event["status"]) for event in events],
                         [("publish", "started"), ("cache_advice", "started"),
                          ("cache_advice", "failed"), ("publish", "failed")])
        for event in events:
            self.assertLessEqual(set(event), {"event", "at", "collectionClass", "phase", "status", "elapsedMs", "adviceAccepted"})
            self.assertEqual(event["collectionClass"], "other")
            self.assertIsNotNone(datetime.datetime.fromisoformat(event["at"]).tzinfo)
        self.assertFalse(events[2]["adviceAccepted"])
        self.assertNotIn("private fixture path", output.getvalue())

    def test_failed_rollback_retains_every_recovery_component_and_skips_retention(self):
        old = self.directory / "hourly_previous.snapshot"
        old.write_bytes(b"previous recovery archive")
        os.utime(old, (FixedClock.current.timestamp() - 4 * 3600,) * 2)
        real_rename = os.rename
        def rename(source, destination, *args, **kwargs):
            if Path(source) == self.checksum or Path(destination) == self.snapshot:
                raise OSError("fixture publish or rollback failure")
            return real_rename(source, destination, *args, **kwargs)
        with patch.object(backup.os, "rename", side_effect=rename):
            with self.assertRaises(OSError):
                backup.rotate_and_clean("fixture", self.snapshot.name)
        self.assertEqual((self.directory / "hourly_20261011_130000.snapshot").read_bytes(), b"fixture archive contents")
        self.assertEqual(self.checksum.read_bytes(), b"fixture checksum")
        self.assertEqual(old.read_bytes(), b"previous recovery archive")

    def test_phase_collection_classes_use_actual_fixed_collection_names(self):
        output = io.StringIO()
        with redirect_stdout(output):
            for collection in ("media_fingerprint_v1", "search_reference_profiles", "private_collection"):
                backup.emit_phase(collection, "snapshot", "started")
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual([event["collectionClass"] for event in events], ["media", "reference", "other"])
        self.assertNotIn("private_collection", output.getvalue())


if __name__ == "__main__":
    unittest.main()
