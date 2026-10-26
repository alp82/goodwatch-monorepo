#!/usr/bin/env python3
"""Future Q40 read-only curl monitor. Writes local evidence/abort flags; never runs SQL."""
import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import subprocess
import time

PATHS = ("/movie/629-the-usual-suspects", "/discover", "/show/1396-breaking-bad")


def assess(status, seconds, exit_code, previous_failures):
    failures = previous_failures + 1 if exit_code or status != 200 else 0
    return failures, failures >= 3 or seconds > 3.0


def probe(path):
    started = time.monotonic()
    result = subprocess.run(
        ["curl", "-s", "--max-time", "5", "-o", "/dev/null", "-w",
         "%{http_code} %{time_total}", "https://goodwatch.app" + path],
        capture_output=True, text=True, timeout=7,
    )
    parts = result.stdout.split()
    try:
        status, seconds = int(parts[0]), float(parts[1])
    except (IndexError, ValueError):
        status, seconds = 0, time.monotonic() - started
    return path, status, seconds, result.returncode


def marker(path, record):
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return
    with os.fdopen(fd, "w") as output:
        output.write(json.dumps(record) + "\n")


def watch(args):
    failures = dict.fromkeys(PATHS, 0)
    heartbeat = Path(args.heartbeat)
    phase_file = Path(args.phase_file)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        while True:
            start = time.monotonic()
            heartbeat.write_text(str(time.time()) + "\n")
            futures = [pool.submit(probe, path) for path in PATHS]
            for future in concurrent.futures.as_completed(futures):
                path, status, seconds, exit_code = future.result()
                failures[path], alarm = assess(status, seconds, exit_code, failures[path])
                phase = phase_file.read_text().strip()
                if phase not in {"baseline", "drain", "stopping", "recovery", "complete"}:
                    raise ValueError("Invalid phase; controller must stop progression")
                record = {
                    "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "phase": phase, "path": path, "status": status, "seconds": seconds,
                    "exit": exit_code, "failure_streak": failures[path], "alarm": alarm,
                }
                print(json.dumps(record), flush=True)
                if alarm and phase == "drain":
                    marker(args.abort_file, record)
            heartbeat.write_text(str(time.time()) + "\n")
            time.sleep(max(0, 10 - (time.monotonic() - start)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("phase-file", "abort-file", "heartbeat"):
        parser.add_argument("--" + option, required=True)
    args = parser.parse_args()
    try:
        watch(args)
    except Exception as error:
        # Fail closed locally. Controller checks this marker and heartbeat before SIGTERM.
        marker(args.abort_file, {"monitor_error": type(error).__name__})
        raise


if __name__ == "__main__":
    main()
