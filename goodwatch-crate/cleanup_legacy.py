#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///

# One-shot: drops snapshots in the CrateDB backup repo that don't match
# the tiered-retention prefixes used by backup.py. Safe to re-run.

from backup import REPO_NAME, RETENTION, run_sql

KNOWN_PREFIXES = tuple(RETENTION.keys())


def list_snapshots():
    stmt = f"SELECT name FROM sys.snapshots WHERE repository = '{REPO_NAME}'"
    data = run_sql(stmt)
    if not data or "rows" not in data:
        return []
    return [row[0] for row in data["rows"]]


def main():
    names = list_snapshots()
    legacy = [n for n in names if not n.startswith(KNOWN_PREFIXES)]

    if not legacy:
        print("No legacy snapshots found.")
        return

    print(f"Found {len(legacy)} legacy snapshot(s):")
    for n in legacy:
        print(f"  {n}")

    confirm = input("Drop all of these? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    for n in legacy:
        print(f"Dropping {n}...")
        run_sql(f'DROP SNAPSHOT "{REPO_NAME}"."{n}"')

    print("Done.")


if __name__ == "__main__":
    main()
