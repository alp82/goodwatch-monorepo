#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///

import requests
import datetime
import time

# --- CONFIGURATION ---
CRATE_HOST = "http://10.0.0.11:4200"
REPO_NAME = "goodwatch-db-backup"
# Tiered retention (matches goodwatch-qdrant/backup.py pattern).
# CrateDB snapshots are incremental: adding daily/weekly alongside hourly
# does not duplicate segment storage, but old segments are only freed once
# no snapshot references them — so retention directly bounds repo size.
RETENTION = {
    "hourly_": datetime.timedelta(hours=3),
    "daily_": datetime.timedelta(days=3),
    "weekly_": datetime.timedelta(days=21),
}
# ---------------------

SQL_URL = f"{CRATE_HOST}/_sql"


def run_sql(stmt):
    """Executes a SQL statement via HTTP API"""
    try:
        response = requests.post(SQL_URL, json={"stmt": stmt})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error executing SQL: {stmt}\n{e}")
        return None


def create_snapshot(prefix, timestamp):
    snapshot_name = f"{prefix}{timestamp}"
    print(f"Creating snapshot: {snapshot_name}...")

    stmt = f'CREATE SNAPSHOT "{REPO_NAME}"."{snapshot_name}" ALL WITH (wait_for_completion=true)'
    res = run_sql(stmt)

    if res and res.get("rowcount", -1) >= 0:
        print("Snapshot created successfully.")
    else:
        print("Snapshot creation failed.")


def clean_old_snapshots():
    print("Checking for expired snapshots...")

    stmt = f"SELECT name, finished FROM sys.snapshots WHERE repository = '{REPO_NAME}'"
    data = run_sql(stmt)

    if not data or "rows" not in data:
        return

    now_ms = time.time() * 1000

    for snap_name, snap_finished in data["rows"]:
        for prefix, max_age in RETENTION.items():
            if snap_name.startswith(prefix):
                if snap_finished < now_ms - max_age.total_seconds() * 1000:
                    print(f"Deleting expired snapshot: {snap_name}")
                    run_sql(f'DROP SNAPSHOT "{REPO_NAME}"."{snap_name}"')
                break


if __name__ == "__main__":
    now = datetime.datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S")

    create_snapshot("hourly_", timestamp)
    if now.hour == 0:
        create_snapshot("daily_", timestamp)
        if now.weekday() == 6:
            create_snapshot("weekly_", timestamp)

    clean_old_snapshots()
