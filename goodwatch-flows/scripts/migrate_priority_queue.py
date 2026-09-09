"""Offline priority snapshot transfer. Never updates or deletes Postgres rows.

Run with uv run --no-project --with crate --with psycopg2-binary --with python-dotenv --with requests.
Export after pausing writers/consumers; keep them paused through import and verify.
Credentials come from an env file, optionally Windmill's existing local CLI profile.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit, urlunsplit

BATCH_SIZE = 1000
FIELDS = ("media_type", "tmdb_id", "demand", "created_at", "updated_at", "last_success_at")


def timestamp(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def crate_hosts(config):
    hosts = []
    default_port = int(config.get("CRATE_PORT") or 4200)
    if not 1 <= default_port <= 65535:
        raise ValueError("Invalid CRATE_PORT")
    for raw in config["CRATE_HOSTS"].split(","):
        raw = raw.strip()
        if not raw:
            continue
        parsed = urlsplit(raw if "://" in raw else f"http://{raw}")
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("Invalid CrateDB HTTP host")
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ValueError("CrateDB hosts must contain only scheme, host and port")
        host = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
        hosts.append(urlunsplit((parsed.scheme, f"{host}:{parsed.port or default_port}", "", "", "")))
    if not hosts:
        raise ValueError("CRATE_HOSTS must contain at least one host")
    return hosts


def settings(args, prefix):
    from dotenv import dotenv_values

    config = {**dotenv_values(args.env_file), **os.environ}
    if args.windmill_workspace:
        import requests

        profile = next(
            json.loads(line)
            for line in (Path.home() / ".config/windmill/remotes.ndjson").read_text().splitlines()
            if json.loads(line).get("name") == args.windmill_workspace
        )
        names = ("HOST", "PORT", "DB", "USER", "PASS") if prefix == "POSTGRES" else ("HOSTS", "USER", "PASS")
        for name in names:
            key = f"{prefix}_{name}"
            response = requests.get(
                f"{profile['remote'].rstrip('/')}/api/w/{profile['workspaceId']}/variables/get_value/u/Alp/{key}",
                headers={"Authorization": f"Bearer {profile['token']}"},
                timeout=15,
            )
            response.raise_for_status()
            config[key] = response.json()
    return config


def rows(path):
    previous = None
    with Path(path).open() as stream:
        for number, line in enumerate(stream, 1):
            row = json.loads(line)
            if not isinstance(row, dict) or set(row) != set(FIELDS):
                raise ValueError(f"Unexpected fields on snapshot line {number}")
            if row["media_type"] not in ("movie", "show"):
                raise ValueError(f"Invalid media type on line {number}")
            if type(row["tmdb_id"]) is not int or not 0 < row["tmdb_id"] < 2**31:
                raise ValueError(f"Invalid TMDB ID on line {number}")
            if type(row["demand"]) is not int or not 0 <= row["demand"] < 2**63:
                raise ValueError(f"Invalid priority on line {number}")
            for field in ("created_at", "updated_at", "last_success_at"):
                if row[field] is not None and (type(row[field]) is not int or not -(2**63) <= row[field] < 2**63):
                    raise ValueError(f"Invalid timestamp on line {number}")
            key = (row["media_type"], row["tmdb_id"])
            if previous is not None and key <= previous:
                raise ValueError(f"Snapshot keys must be unique and sorted: {key} on line {number}")
            previous = key
            yield row


def inspect(path):
    totals = {kind: {"rows": 0, "demand": 0} for kind in ("movie", "show")}
    digest = hashlib.sha256()
    for row in rows(path):
        totals[row["media_type"]]["rows"] += 1
        totals[row["media_type"]]["demand"] += row["demand"]
        digest.update(json.dumps(row, sort_keys=True).encode())
    return {"totals": totals, "sha256": digest.hexdigest()}


def source_rows(cursor, media_type, reconcile_zero_duplicates, audit):
    pending = None
    for tmdb_id, priority, created, updated, reset in cursor:
        row = dict(zip(FIELDS, (media_type, tmdb_id, priority, timestamp(created), timestamp(updated), timestamp(reset))))
        if pending is not None and pending["tmdb_id"] == tmdb_id:
            if not reconcile_zero_duplicates or pending["demand"] != 0 or priority != 0:
                raise ValueError(f"Duplicate source key: {media_type} {tmdb_id}; automatic demand merging is forbidden")
            merged = {**pending}
            for field, combine in (("created_at", min), ("updated_at", max), ("last_success_at", max)):
                values = [value for value in (pending[field], row[field]) if value is not None]
                merged[field] = combine(values) if values else None
            audit.append({"source_rows": [pending, row], "exported_row": merged})
            pending = merged
        else:
            if pending is not None:
                yield pending
            pending = row
    if pending is not None:
        yield pending


def export(args):
    import psycopg2

    config = settings(args, "POSTGRES")
    connection = psycopg2.connect(
        host=config["POSTGRES_HOST"], port=config["POSTGRES_PORT"],
        dbname=config["POSTGRES_DB"], user=config["POSTGRES_USER"],
        password=config["POSTGRES_PASS"], connect_timeout=10,
    )
    temporary = None
    audit = []
    try:
        connection.set_session(readonly=True, isolation_level="REPEATABLE READ")
        # A failed export must never leave a partial file that looks importable.
        destination = Path(args.snapshot)
        if destination.exists():
            raise FileExistsError(destination)
        fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".partial", dir=destination.parent)
        with os.fdopen(fd, "w") as output:
            for media_type, table in (("movie", "priority_queue_movie"), ("show", "priority_queue_tv")):
                with connection.cursor(name=f"export_{media_type}") as cursor:
                    cursor.itersize = BATCH_SIZE
                    cursor.execute(f"SELECT tmdb_id, priority, created_at, updated_at, reset_at FROM {table} ORDER BY tmdb_id")
                    for row in source_rows(cursor, media_type, getattr(args, "reconcile_zero_duplicates", False), audit):
                        output.write(json.dumps(row) + "\n")
            output.flush()
            os.fsync(output.fileno())
        summary = inspect(temporary)
        if audit:
            audit_path = str(destination) + ".reconciliation.json"
            audit_fd = os.open(audit_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(audit_fd, "w") as audit_file:
                json.dump(audit, audit_file, indent=2)
                audit_file.flush()
                os.fsync(audit_file.fileno())
            summary["reconciled_zero_priority_duplicates"] = len(audit)
            summary["reconciliation_file"] = audit_path
        # Atomic exclusive publication: never overwrite an existing rollback snapshot.
        os.link(temporary, destination)
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)
        connection.close()
    print(json.dumps(summary, indent=2))


def batches(path):
    batch = []
    for row in rows(path):
        if batch and (len(batch) == BATCH_SIZE or row["media_type"] != batch[0]["media_type"]):
            yield batch
            batch = []
        batch.append(row)
    if batch:
        yield batch


def transfer(args):
    from crate import client

    expected = inspect(args.snapshot)  # Validate the whole snapshot before writing.
    config = settings(args, "CRATE")
    hosts = crate_hosts(config)
    connection = client.connect(hosts, username=config["CRATE_USER"], password=config["CRATE_PASS"])
    cursor = connection.cursor()
    try:
        if args.action == "import":
            sql = """INSERT INTO crawl_priority
                (media_type,tmdb_id,demand,created_at,updated_at,last_success_at,acknowledged_demand,claimed_demand)
                VALUES (?,?,?,?,?,?,0,0) ON CONFLICT (media_type,tmdb_id) DO NOTHING"""
            for batch in batches(args.snapshot):
                results = cursor.executemany(sql, [tuple(row[field] for field in FIELDS) for row in batch])
                if len(results) != len(batch) or any(r.get("rowcount") not in (0, 1) or r.get("error_message") or r.get("error") for r in results):
                    raise RuntimeError("Queue import partially failed; writers must remain paused. Resume using the same snapshot.")
        cursor.execute("REFRESH TABLE crawl_priority")
        for batch in batches(args.snapshot):
            placeholders = ",".join("?" for _ in batch)
            cursor.execute(
                f"""SELECT media_type,tmdb_id,demand,CAST(created_at AS BIGINT),CAST(updated_at AS BIGINT),
                CAST(last_success_at AS BIGINT),acknowledged_demand,claimed_demand,lease_token,lease_expires_at
                FROM crawl_priority WHERE media_type=? AND tmdb_id IN ({placeholders}) ORDER BY tmdb_id""",
                [batch[0]["media_type"], *[row["tmdb_id"] for row in batch]],
            )
            actual = cursor.fetchall()
            baseline = [tuple(row[field] for field in FIELDS) + (0, 0, None, None) for row in batch]
            if [tuple(row) for row in actual] != baseline:
                raise RuntimeError("Target differs from the snapshot. Do not overwrite live demand or merge counters automatically.")
        cursor.execute("SELECT count(*) FROM crawl_priority")
        if cursor.fetchone()[0] != sum(value["rows"] for value in expected["totals"].values()):
            raise RuntimeError("Target contains extra rows; reconcile them before cutover")
        print(json.dumps({"verified": True, **expected}, indent=2))
    finally:
        cursor.close()
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("export", "inspect", "import", "verify"))
    parser.add_argument("snapshot", help="Local JSONL snapshot path")
    parser.add_argument("--env-file", default="goodwatch-webapp/.env")
    parser.add_argument("--windmill-workspace", help="Existing Windmill CLI profile name, e.g. goodwatch")
    parser.add_argument("--writers-paused", action="store_true", help="Confirm all queue writers and consumers are paused")
    parser.add_argument("--reconcile-zero-duplicates", action="store_true", help="Export only: reconcile duplicate zero-demand rows, preserving originals in a sidecar audit file; nonzero duplicates still fail")
    args = parser.parse_args()
    if args.action in ("export", "import", "verify") and not args.writers_paused:
        parser.error("Pause queue writers and consumers, then supply --writers-paused")
    if args.action == "inspect":
        print(json.dumps(inspect(args.snapshot), indent=2))
    elif args.action == "export":
        export(args)
    else:
        transfer(args)


if __name__ == "__main__":
    main()
