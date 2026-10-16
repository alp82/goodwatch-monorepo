#!/usr/bin/env python3
"""Stage the existing hourly backup's credentials, without running a backup.

Dry-run by default; --apply installs a protected named file and checks exact
readback. Never use `crontab -` for readback: that replaces the schedule from
stdin and an inherited EOF silently installs an empty schedule (#562).
"""

import argparse
import datetime
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import tempfile


COMMAND = ("/root/.local/bin/uv run "
           "/root/goodwatch/goodwatch-monorepo/goodwatch-crate/backup.py "
           ">> /var/log/backup_crate.log 2>&1")
SCHEDULE = "5 * * * * "
MARKER = "#Ansible: CrateDB Backup"


def read_crontab():
    # Explicit EOF makes an accidental stdin-consuming command deterministic;
    # the regression test also checks this argv is the non-mutating list form.
    result = subprocess.run(["crontab", "-l"], stdin=subprocess.DEVNULL,
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Cannot list existing crontab; nothing installed")
    return result.stdout


def desired_crontab(current, user, password_file):
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", user):
        raise ValueError("Invalid backup role")
    # Cron treats % and newlines specially even inside shell quotes.
    if not password_file.startswith("/") or any(c in password_file for c in "\r\n%"):
        raise ValueError("Password file must be an absolute path without cron metacharacters")
    job = (SCHEDULE + "CRATE_BACKUP_USER=" + shlex.quote(user)
           + " CRATE_BACKUP_PASSWORD_FILE=" + shlex.quote(password_file) + " " + COMMAND)
    lines = current.splitlines(keepends=True)
    matches = [i for i, line in enumerate(lines)
               if not line.lstrip().startswith("#") and "/goodwatch-crate/backup.py" in line]
    if len(matches) != 1:
        raise ValueError("Expected exactly one existing Crate backup job; nothing installed")
    index = matches[0]
    if index == 0 or lines[index - 1].rstrip("\n") != MARKER:
        raise ValueError("Existing backup job is not the expected Ansible entry")
    if lines[index].rstrip("\n") not in (SCHEDULE + COMMAND, job):
        raise ValueError("Existing backup command changed; nothing installed")
    lines[index] = job + "\n"
    return "".join(lines)


def protected_write(directory, prefix, content):
    fd, name = tempfile.mkstemp(dir=directory, prefix=prefix)
    with os.fdopen(fd, "w") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    return Path(name)


def configure(user, password_file, state_directory, apply=False):
    secret = Path(password_file).stat()
    if not stat.S_ISREG(secret.st_mode) or secret.st_uid != 0 or secret.st_mode & 0o077:
        raise ValueError("Backup password file must be a root-only regular file")
    before = read_crontab()
    after = desired_crontab(before, user, password_file)
    if after == before:
        return "Unchanged: exact credential schedule verified"
    if not apply:
        return "Dry run: one existing backup job would gain credentials"
    directory = Path(state_directory)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory_stat = directory.stat()
    if directory_stat.st_uid != 0 or directory_stat.st_mode & 0o077:
        raise ValueError("State directory must be root-only")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ-")
    protected_write(directory, "crontab.before-" + stamp, before)
    staged = protected_write(directory, "crontab.staged-" + stamp, after)
    if read_crontab() != before:
        raise RuntimeError("Crontab changed during staging; nothing installed")
    result = subprocess.run(["crontab", str(staged)], stdin=subprocess.DEVNULL,
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Cron install failed; inspect state before any retry")
    if read_crontab() != after:
        raise RuntimeError("STOP: cron readback mismatch; no automatic retry or rollback")
    return "Installed: exact credential schedule verified; rollback and staged files retained"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", default="goodwatch_backup")
    parser.add_argument("--password-file", default="/root/.config/goodwatch/crate-backup-password")
    parser.add_argument("--state-directory", default="/root/.config/goodwatch/crate-rollout-562")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        print(configure(args.user, args.password_file, args.state_directory, args.apply))
    except (OSError, ValueError, RuntimeError) as error:
        # OSError may include filesystem paths; never print cron content or secret values.
        print("STOP: " + (str(error) if not isinstance(error, OSError) else type(error).__name__))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
