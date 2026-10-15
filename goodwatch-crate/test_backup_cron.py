"""Regression for #562's mutating cron readback and preservation of other jobs."""

from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import configure_backup_cron as cron


BASELINE = cron.MARKER + "\n" + cron.SCHEDULE + cron.COMMAND + "\n"


class BackupCronTest(unittest.TestCase):
    def test_listing_uses_l_never_stdin_install(self):
        with patch.object(cron.subprocess, "run", return_value=subprocess.CompletedProcess(
                [], 0, BASELINE, "")) as run:
            self.assertEqual(cron.read_crontab(), BASELINE)
        self.assertEqual(run.call_args.args[0], ["crontab", "-l"])
        self.assertEqual(run.call_args.kwargs["stdin"], subprocess.DEVNULL)

    def test_preserves_unrelated_entries_and_real_newlines(self):
        other = "MAILTO=root\n# unrelated\n1 * * * * /bin/true\n"
        current = other + BASELINE
        desired = cron.desired_crontab(current, "goodwatch_backup", "/root/backup-secret")
        self.assertTrue(desired.startswith(other + cron.MARKER + "\n"))
        self.assertEqual(len(desired.splitlines()), len(current.splitlines()))
        self.assertTrue(desired.endswith(cron.COMMAND + "\n"))
        self.assertEqual(cron.desired_crontab(desired, "goodwatch_backup", "/root/backup-secret"), desired)

    def test_refuses_missing_duplicate_or_changed_job(self):
        for current in ("", BASELINE * 2, BASELINE.replace("5 *", "6 *"), BASELINE.replace(cron.MARKER, "# different")):
            with self.subTest(current=current), self.assertRaises(ValueError):
                cron.desired_crontab(current, "goodwatch_backup", "/root/secret")

    def test_rejects_cron_metacharacters_and_relative_path(self):
        for path in ("relative", "/root/secret%bad", "/root/secret\nbad"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                cron.desired_crontab(BASELINE, "goodwatch_backup", path)

    def test_install_uses_named_file_and_detects_empty_readback(self):
        for readback_ok in (True, False):
            with self.subTest(readback_ok=readback_ok), tempfile.TemporaryDirectory() as tmp:
                secret = Path(tmp) / "secret"
                secret.write_text("fixture")
                secret.chmod(0o600)
                desired = cron.desired_crontab(BASELINE, "goodwatch_backup", str(secret))
                with patch.object(cron.Path, "stat", autospec=True) as stat, \
                     patch.object(cron, "read_crontab", side_effect=[BASELINE, BASELINE, desired if readback_ok else ""]), \
                     patch.object(cron.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as run:
                    stat.return_value.st_mode = 0o100600
                    stat.return_value.st_uid = 0
                    if readback_ok:
                        self.assertIn("Installed", cron.configure("goodwatch_backup", str(secret), tmp, True))
                    else:
                        with self.assertRaisesRegex(RuntimeError, "readback mismatch"):
                            cron.configure("goodwatch_backup", str(secret), tmp, True)
                argv = run.call_args.args[0]
                self.assertEqual(argv[0], "crontab")
                self.assertNotEqual(argv[1], "-")
                self.assertEqual(Path(argv[1]).read_text(), desired)
                # No blind retry or implicit rollback after the failed readback.
                self.assertEqual(run.call_count, 1)


if __name__ == "__main__":
    unittest.main()
