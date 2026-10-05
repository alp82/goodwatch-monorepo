#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///

import datetime
import fcntl
import sys
import time

import requests

# --- CONFIGURATION ---
CRATE_HOST = "http://10.0.0.11:4200"
REPO_NAME = "goodwatch-db-backup-v2"
# Tiered retention (matches goodwatch-qdrant/backup.py pattern).
# CrateDB snapshots are incremental: adding daily/weekly alongside hourly
# does not duplicate segment storage, but old segments are only freed once
# no snapshot references them, so retention directly bounds repo size.
RETENTION = {
    "hourly_": datetime.timedelta(hours=3),
    "daily_": datetime.timedelta(days=3),
    "weekly_": datetime.timedelta(days=21),
}

# Only one run at a time. /var/lock is a tmpfs, so a reboot clears the file.
LOCK_FILE = "/var/lock/backup_crate.lock"

# Request timeouts in seconds. Measured on October 5, 2026: a snapshot takes
# about 6 minutes, one DROP SNAPSHOT about 14 minutes, and a read of
# sys.snapshots 15 to 90 seconds. A timeout stops the wait, not the statement
# on the server.
CONNECT_TIMEOUT = 10
CREATE_TIMEOUT = 30 * 60
DROP_TIMEOUT = 30 * 60
LIST_TIMEOUT = 5 * 60

# The cron job starts a run every hour, so a run must stay well under an hour.
# Cleanup drops at most MAX_DROPS_PER_RUN snapshots, oldest first, and starts
# no drop later than CLEANUP_BUDGET seconds into the run. The rest waits for
# the next run.
MAX_DROPS_PER_RUN = 2
CLEANUP_BUDGET = 25 * 60

EXIT_FAILED = 1
EXIT_LOCKED = 75
# ---------------------

SQL_URL = f"{CRATE_HOST}/_sql"


class BackupError(Exception):
    """A step of the backup failed. The run stops and exits non-zero."""


def log(message):
    """Prints a line with a UTC timestamp."""
    now = datetime.datetime.now(datetime.timezone.utc)
    print(f"{now:%Y-%m-%dT%H:%M:%SZ} {message}", flush=True)


def run_sql(stmt, timeout=DROP_TIMEOUT):
    """Executes a SQL statement via HTTP API. Returns None on any error."""
    try:
        response = requests.post(
            SQL_URL, json={"stmt": stmt}, timeout=(CONNECT_TIMEOUT, timeout)
        )
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as e:
        body = e.response.text if e.response is not None else ""
        log(f"Error executing SQL: {stmt}\n{e}\n{body}")
        return None
    except Exception as e:
        log(f"Error executing SQL: {stmt}\n{e}")
        return None


def acquire_lock():
    """Returns the open lock file, or None if another run holds the lock."""
    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock.close()
        return None
    return lock


def create_snapshot(prefix, timestamp):
    snapshot_name = f"{prefix}{timestamp}"
    log(f"Creating snapshot: {snapshot_name}...")

    stmt = f'CREATE SNAPSHOT "{REPO_NAME}"."{snapshot_name}" ALL WITH (wait_for_completion=true)'
    res = run_sql(stmt, timeout=CREATE_TIMEOUT)

    if not res or res.get("rowcount", -1) < 0:
        raise BackupError(f"Snapshot creation failed: {snapshot_name}")
    log("Snapshot created successfully.")
    return snapshot_name


def list_snapshots():
    """Returns [name, state, finished] rows for all snapshots in the repository."""
    stmt = f"SELECT name, state, finished FROM sys.snapshots WHERE repository = '{REPO_NAME}'"
    data = run_sql(stmt, timeout=LIST_TIMEOUT)

    if not data or "rows" not in data:
        raise BackupError("Could not read sys.snapshots.")
    if not data["rows"]:
        # A disabled repository returns 0 rows without an error.
        raise BackupError(
            f"sys.snapshots has 0 rows for {REPO_NAME}. The repository is "
            "probably disabled. See goodwatch-crate/README.md."
        )
    return data["rows"]


def expired_snapshots(rows, now_ms):
    """Returns the names of expired snapshots, oldest first."""
    expired = []
    for snap_name, _, snap_finished in rows:
        for prefix, max_age in RETENTION.items():
            if snap_name.startswith(prefix):
                if snap_finished and snap_finished < now_ms - max_age.total_seconds() * 1000:
                    expired.append((snap_finished, snap_name))
                break
    return [snap_name for _, snap_name in sorted(expired)]


def clean_old_snapshots(deadline):
    """Drops expired snapshots until the per-run bound or the deadline is reached."""
    log("Checking for expired snapshots...")

    expired = expired_snapshots(list_snapshots(), time.time() * 1000)
    dropped = 0

    for snap_name in expired:
        if dropped >= MAX_DROPS_PER_RUN or time.monotonic() >= deadline:
            break
        log(f"Deleting expired snapshot: {snap_name}")
        if run_sql(f'DROP SNAPSHOT "{REPO_NAME}"."{snap_name}"', timeout=DROP_TIMEOUT) is None:
            raise BackupError(f"Snapshot deletion failed: {snap_name}")
        dropped += 1

    log(f"Deleted {dropped} of {len(expired)} expired snapshot(s).")


def verify_snapshots(snapshot_names):
    """Checks that each snapshot of this run is in sys.snapshots as SUCCESS."""
    log("Verifying the snapshots of this run...")

    states = {name: state for name, state, _ in list_snapshots()}
    for snapshot_name in snapshot_names:
        state = states.get(snapshot_name, "missing")
        if state != "SUCCESS":
            raise BackupError(f"Snapshot {snapshot_name} is {state}, expected SUCCESS.")
    log(f"Verified: {', '.join(snapshot_names)}")


def run_backup(now):
    started = time.monotonic()
    timestamp = now.strftime("%Y%m%d_%H%M%S")

    # Create first, so that a slow or failing cleanup can't cost a snapshot.
    created = [create_snapshot("hourly_", timestamp)]
    if now.hour == 0:
        created.append(create_snapshot("daily_", timestamp))
        if now.weekday() == 6:
            created.append(create_snapshot("weekly_", timestamp))

    clean_old_snapshots(deadline=started + CLEANUP_BUDGET)

    # Verify last: an I/O error during a drop can disable the repository.
    verify_snapshots(created)


def main(now=None):
    lock = acquire_lock()
    if lock is None:
        log("Another backup run holds the lock. Exiting without a snapshot.")
        return EXIT_LOCKED

    try:
        run_backup(now or datetime.datetime.now())
    except BackupError as e:
        log(f"BACKUP FAILED: {e}")
        return EXIT_FAILED
    finally:
        lock.close()

    log("Backup run finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
