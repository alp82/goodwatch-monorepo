#!/usr/bin/env python3
"""Read-only HTTP watcher: historical Q43 default, opt-in Q60 rolling-upgrade policy."""
import argparse
import concurrent.futures
from collections import deque
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


class Q60Policy:
    """Three unexpected probes per endpoint, or three slow probes globally in 60s."""

    def __init__(self):
        self.failures = {}
        self.slow = deque()

    def observe(self, path, status, seconds, exit_code, expected=200, at=None):
        at = time.monotonic() if at is None else at
        self.failures[path] = self.failures.get(path, 0) + 1 if exit_code or status != expected else 0
        while self.slow and self.slow[0] <= at - 60:
            self.slow.popleft()
        if seconds > 3.0:
            self.slow.append(at)
        alarm = self.failures[path] >= 3 or len(self.slow) >= 3
        return self.failures[path], len(self.slow), alarm


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
    policy = getattr(args, "policy", "q43")
    q60 = Q60Policy() if policy == "q60" else None
    heartbeat, phase_file = Path(args.heartbeat), Path(args.phase_file)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        while not (args.stop_file and Path(args.stop_file).exists()):
            start = time.monotonic()
            heartbeat.write_text(str(time.time()) + "\n")
            pending = [pool.submit(probe, path, expected) for path, expected in ENDPOINTS]
            for future in concurrent.futures.as_completed(pending):
                path, expected, status, seconds, exit_code, started_utc = future.result()
                slow_count = None
                if q60 is not None:
                    failures[path], slow_count, alarm = q60.observe(path, status, seconds, exit_code, expected)
                else:
                    failures[path], alarm = assess(status, seconds, exit_code, failures[path], expected)
                phase = phase_file.read_text().strip()
                if phase not in PHASES:
                    raise ValueError("Invalid phase; stop progression")
                record = {
                    "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "probe_started_utc": started_utc, "phase": phase, "path": path,
                    "expected": expected, "status": status, "seconds": seconds,
                    "exit": exit_code, "failure_streak": failures[path], "alarm": alarm,
                    "policy": policy, "slow_responses_60s": slow_count,
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
    parser.add_argument("--policy", choices=("q43", "q60"), default="q43")
    args = parser.parse_args()
    try:
        watch(args)
    except Exception as error:
        marker(args.abort_file, {"monitor_error": type(error).__name__})
        raise


if __name__ == "__main__":
    main()
