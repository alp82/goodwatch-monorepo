#!/usr/bin/env python3
"""Q43 read-only HTTP watcher. Writes local alarms; never changes production settings."""
import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import subprocess
import time

ENDPOINTS = (
    ("/movie/629-the-usual-suspects", 200),
    ("/show/1396-breaking-bad", 200),
    ("/discover", 200),
    ("/mcp", 401),
    ("/.well-known/oauth-protected-resource/mcp", 200),
)
PHASES = {"baseline", "pre_stop", "stopping", "recovery", "rebalancing", "complete"}


def assess(status, seconds, exit_code, previous_failures, expected=200):
    failures = previous_failures + 1 if exit_code or status != expected else 0
    return failures, bool(failures or seconds > 3.0)


def probe(path, expected):
    start = time.monotonic()
    started_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = subprocess.run(
        ["curl", "-s", "--max-time", "5", "-o", "/dev/null", "-w",
         "%{http_code} %{time_total}", "https://goodwatch.app" + path],
        capture_output=True, text=True, timeout=7,
    )
    try:
        parts = result.stdout.split()
        status, seconds = int(parts[0]), float(parts[1])
    except (IndexError, ValueError):
        status, seconds = 0, time.monotonic() - start
    return path, expected, status, seconds, result.returncode, started_utc


def marker(path, record):
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return
    with os.fdopen(fd, "w") as output:
        output.write(json.dumps(record) + "\n")


def watch(args):
    failures = {path: 0 for path, _ in ENDPOINTS}
    heartbeat, phase_file = Path(args.heartbeat), Path(args.phase_file)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        while not (args.stop_file and Path(args.stop_file).exists()):
            start = time.monotonic()
            heartbeat.write_text(str(time.time()) + "\n")
            pending = [pool.submit(probe, path, expected) for path, expected in ENDPOINTS]
            for future in concurrent.futures.as_completed(pending):
                path, expected, status, seconds, exit_code, started_utc = future.result()
                failures[path], alarm = assess(status, seconds, exit_code, failures[path], expected)
                phase = phase_file.read_text().strip()
                if phase not in PHASES:
                    raise ValueError("Invalid phase; stop progression")
                record = {
                    "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "probe_started_utc": started_utc, "phase": phase, "path": path,
                    "expected": expected, "status": status, "seconds": seconds,
                    "exit": exit_code, "failure_streak": failures[path], "alarm": alarm,
                }
                print(json.dumps(record), flush=True)
                if alarm:
                    marker(args.abort_file, record)
            heartbeat.write_text(str(time.time()) + "\n")
            if args.stop_file and Path(args.stop_file).exists():
                break
            time.sleep(max(0, 10 - (time.monotonic() - start)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("phase-file", "abort-file", "heartbeat"):
        parser.add_argument("--" + option, required=True)
    parser.add_argument("--stop-file")
    args = parser.parse_args()
    try:
        watch(args)
    except Exception as error:
        marker(args.abort_file, {"monitor_error": type(error).__name__})
        raise


if __name__ == "__main__":
    main()
