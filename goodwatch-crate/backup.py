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
CRATE_HOST = "http://127.0.0.1:4200"
REPO_NAME = "goodwatch-db-backup"
RETENTION_DAYS = 90
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

def create_snapshot():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_name = f"snap_{timestamp}"
    print(f"Creating snapshot: {snapshot_name}...")
    
    # wait_for_completion=true ensures we don't exit until Crate finishes writing
    stmt = f"CREATE SNAPSHOT \"{REPO_NAME}\".\"{snapshot_name}\" ALL WITH (wait_for_completion=true)"
    res = run_sql(stmt)
    
    if res and res.get('rowcount', -1) >= 0:
        print("Snapshot created successfully.")
    else:
        print("Snapshot creation failed.")

def clean_old_snapshots():
    print("Checking for expired snapshots...")
    
    # CrateDB stores 'created' as a timestamp in milliseconds
    stmt = f"SELECT name, created FROM sys.snapshots WHERE repository = '{REPO_NAME}'"
    data = run_sql(stmt)
    
    if not data or 'rows' not in data:
        return

    current_ms = time.time() * 1000
    retention_ms = RETENTION_DAYS * 24 * 60 * 60 * 1000
    cutoff_ms = current_ms - retention_ms

    for row in data['rows']:
        snap_name = row[0]
        snap_created = row[1]

        if snap_created < cutoff_ms:
            print(f"Deleting expired snapshot: {snap_name}")
            run_sql(f"DROP SNAPSHOT \"{REPO_NAME}\".\"{snap_name}\"")

if __name__ == "__main__":
    create_snapshot()
    clean_old_snapshots()