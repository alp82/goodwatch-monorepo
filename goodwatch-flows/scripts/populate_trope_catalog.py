#!/usr/bin/env python3
"""Populate every missing general trope description in one resumable, explicitly invoked run.

`run --all` continues until the saved queue is processed or a source/backend hard stop occurs. The default request
budget is 200. `--until-complete` keeps one job alive through source cooldowns and transient backend/network
failures with capped backoff; code/configuration errors and manual-review gaps stop explicitly. No scheduler is installed. Source requests use the existing identifying recovery client at >=6 sec;
403, 429 and challenges stop the site. State, raw responses and journals remain under the chosen output directory.
"""
import argparse
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import math
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
import sys
import time

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / "windmill"), str(FLOWS / "scripts")]
from import_trope_catalog import Crate, settings
from f.tvtropes_catalog.catalog import canonical_url, import_records, normalize_record
from recover_tvtropes import BudgetExhausted, DEFAULT_STATE, FetchError, LocalClient, SiteBlocked, State, utcnow

CACHE = Path.home() / ".cache/goodwatch/trope-catalog"
DEFAULT_OUTPUT = CACHE / ("full-" + datetime.now(timezone.utc).date().isoformat())
DEFAULT_LOCK = CACHE / ".fetch-worker.lock"
DEFAULT_PACE = CACHE / ".last-source-request.json"
TERMINAL = {"stored", "already_present", "review"}


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w") as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def append_json(path, value):
    with Path(path).open("a") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def read_journal(path, *, repair=False):
    path = Path(path)
    if not path.exists():
        return []
    lines = path.read_bytes().splitlines(keepends=True)
    rows, good = [], 0
    for index, line in enumerate(lines):
        try:
            rows.append(json.loads(line))
        except (ValueError, UnicodeDecodeError):
            if index != len(lines) - 1 or line.endswith(b"\n"):
                raise ValueError(f"Corrupt journal {path.name}") from None
            if repair:
                with path.open("r+b") as handle:
                    handle.truncate(good)
            break
        good += len(line)
    if repair and rows and path.stat().st_size:
        # A complete final JSON object can survive a crash without its line terminator.
        with path.open("r+b") as handle:
            handle.seek(-1, os.SEEK_END)
            if handle.read(1) != b"\n":
                handle.seek(0, os.SEEK_END)
                handle.write(b"\n")
                handle.flush()
                os.fsync(handle.fileno())
    return rows


@contextmanager
def worker_lock(path=DEFAULT_LOCK):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another trope source worker already holds the shared lock") from None
        try:
            handle.seek(0)
            handle.truncate()
            handle.write(json.dumps({"pid": os.getpid(), "started_at": utcnow().isoformat()}))
            handle.flush()
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def worker_is_running(path=DEFAULT_LOCK):
    path = Path(path)
    if not path.exists():
        return False
    with path.open("r") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        fcntl.flock(handle, fcntl.LOCK_UN)
        return False


def missing_entries(db, page_size=1000):
    if not 1 <= page_size <= 1000:
        raise ValueError("page_size must be 1–1000")
    after = None
    while True:
        rows = db.select("SELECT name,url FROM trope_catalog WHERE description IS NULL"
                         + (" AND name > ?" if after is not None else "")
                         + f" ORDER BY name LIMIT {page_size}", (after,) if after is not None else ())
        if not rows:
            return
        for row in rows:
            name = row.get("name")
            if not isinstance(name, str) or (after is not None and name <= after):
                raise ValueError("Catalog keyset pagination did not advance")
            after = name
            yield {"name": name, "url": row.get("url")}
        if len(rows) < page_size:
            return


def prepare_queue(db, output, *, refresh=False):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    path = output / "queue.json"
    manifest_path = output / "queue-manifest.json"
    if path.exists():
        entries = json.loads(path.read_text())
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest = json.loads(manifest_path.read_text())
        if manifest["sha256"] != digest:
            raise ValueError("Queue changed outside the worker; use a separate output directory")
        if not refresh:
            return entries
        by_name = {row["name"]: row for row in entries}
        by_name.update((row["name"], row) for row in missing_entries(db))
        entries = sorted(by_name.values(), key=lambda row: row["name"])
    else:
        entries = list(missing_entries(db))
    atomic_json(path, entries)
    atomic_json(manifest_path, {"created_at": utcnow().isoformat(), "entries": len(entries),
                               "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                               "scope": "all trope_catalog rows with description IS NULL"})
    return entries


def source_cache(output, saved=()):
    pages, metadata = {}, {}
    for directory in [*map(Path, saved), Path(output)]:
        events = read_journal(directory / "requests.jsonl")
        if not events:
            for filename in ("run.json", "progress.json"):
                path = directory / filename
                if path.exists():
                    events = json.loads(path.read_text()).get("log", [])
                    if events:
                        break
        for event in events:
            path = directory / event.get("source_file", "missing")
            url = event.get("requested_url")
            if not url or event.get("status") not in (200, 404, 410) or event.get("blocked") or not path.is_file():
                continue
            if hashlib.sha256(gzip.decompress(path.read_bytes())).hexdigest() != event.get("sha256"):
                continue
            pages[url] = {"path": path, "run": str(directory), "status": event["status"], "url": event.get("url") or url}
            if event.get("started_at") or url not in metadata:
                metadata[url] = event
    return pages, metadata


class DurablePacedClient(LocalClient):
    """The recovery client plus a shared on-disk start time, so restarting cannot create a burst."""
    def __init__(self, *args, pace_path=DEFAULT_PACE, wall_clock=time.time, **kwargs):
        super().__init__(*args, **kwargs)
        self.pace_path, self.wall_clock = Path(pace_path), wall_clock

    def get(self, url):
        if url not in self.saved and self.requests < self.max_requests:
            previous = json.loads(self.pace_path.read_text()).get("at", 0) if self.pace_path.exists() else 0
            self.sleep(max(0, self.delay - (self.wall_clock() - previous)))
            atomic_json(self.pace_path, {"at": self.wall_clock()})
        return super().get(url)


def transient_backend_error(error):
    """Retry only recognized transport/availability failures; SQL/data/configuration bugs must stop."""
    if isinstance(error, HTTPError):
        return error.code in (502, 503, 504)
    if isinstance(error, (TimeoutError, ConnectionError, URLError)):
        return True
    message = str(error)
    if isinstance(error, RuntimeError) and (
        message.startswith("No CrateDB coordinator answered the read")
        or message.startswith("CrateDB write transport failed")
        or re.match(r"CrateDB SQL error \((?:502|503|504)\d*\)", message)
        or any(kind in message for kind in ("NoShardAvailableActionException", "UnavailableShardsException", "NodeNotConnectedException", "ConnectTransportException"))
    ):
        return True
    # The Windmill settings loader deliberately suppresses transport details; its exception context retains status.
    context = getattr(error, "__context__", None)
    return isinstance(context, URLError) and (not hasattr(context, "code") or context.code in (502, 503, 504))


def reconcile_catalog(db, entries, latest, record_outcome, batch_size=1000):
    """Resolve external fills and requeue genuinely missing rows. Never read the heavy per-title trope table."""
    present = set()
    for start in range(0, len(entries), batch_size):
        names = [row["name"] for row in entries[start:start+batch_size]]
        marks = ",".join("?" for _ in names)
        rows = db.select(f"SELECT name FROM trope_catalog WHERE description IS NOT NULL AND name IN ({marks}) LIMIT {len(names)}", tuple(names))
        present.update(row["name"] for row in rows)
    for entry in entries:
        previous = latest.get(entry["name"], {})
        if entry["name"] in present:
            if previous.get("status") not in ("stored", "already_present"):
                record_outcome(entry, "already_present", reconciled=True)
        elif previous.get("status") in ("stored", "already_present"):
            record_outcome(entry, "queued", error="description_missing_in_catalog")


def run(db, output, *, all_requests=False, max_requests=200, delay=6, state_path=DEFAULT_STATE,
        lock_path=DEFAULT_LOCK, pace_path=DEFAULT_PACE, refresh_queue=False, retry_review=False,
        saved=(), client=None, extractor=None, batch_size=1, emit=None, _lock_held=False):
    if delay < 6 or max_requests < 1 or not 1 <= batch_size <= 100:
        raise ValueError("Use delay>=6, max_requests>=1 and batch_size between1 and100")
    output = Path(output)
    emit = emit or (lambda value: print(json.dumps(value, ensure_ascii=False), flush=True))
    with nullcontext() if _lock_held else worker_lock(lock_path):
        queue = prepare_queue(db, output, refresh=refresh_queue)
        requests_path, outcomes_path = output / "requests.jsonl", output / "outcomes.jsonl"
        requests = read_journal(requests_path, repair=True)
        outcomes = read_journal(outcomes_path, repair=True)
        queue_urls = {row["name"]: row["url"] for row in queue}
        latest = {row["name"]: row for row in outcomes if row["name"] in queue_urls and row.get("queue_url") == queue_urls[row["name"]]}
        pages, source_metadata = source_cache(output, saved)
        state = State(Path(state_path))
        shared_state_path = Path(lock_path).with_name(".source-block-state.json")
        shared_state = State(shared_state_path)
        client = client or DurablePacedClient(output / "sources", delay, math.inf if all_requests else max_requests,
                                             saved=pages, pace_path=pace_path)
        client.saved.update(pages)
        if extractor is None:
            # Fail before any source request when the strict parser dependency is unavailable.
            from bs4 import BeautifulSoup
            BeautifulSoup("", "html5lib")
            from f.tvtropes_catalog.descriptions import extract_description
            extractor = extract_description
        pending, client_log_cursor, failures = [], 0, 0
        stop, phase, started = None, "running", utcnow().isoformat()
        retryable, error_type = False, None

        def active_block():
            deadlines = [deadline for deadline in (state.blocked(utcnow()), shared_state.blocked(utcnow())) if deadline]
            return max(deadlines) if deadlines else None

        def checkpoint():
            counts = {key: sum(row.get("status") == key for row in latest.values())
                      for key in ("stored", "already_present", "review", "ready", "fetch_error")}
            value = {"phase": phase, "pid": os.getpid(), "started_at": started, "updated_at": utcnow().isoformat(),
                     "queue": len(queue), **counts, "pending": len(queue) - sum(counts[key] for key in TERMINAL),
                     "requests": sum(not event.get("saved_from") for event in requests),
                     "requests_this_run": client.requests, "stop": stop, "retryable": retryable, "error_type": error_type,
                     "blocked_until": active_block().isoformat() if active_block() else None}
            atomic_json(output / "progress.json", value)
            return value

        def outcome(entry, status, **extra):
            row = {"name": entry["name"], "queue_url": entry["url"], "status": status,
                   "at": utcnow().isoformat(), **extra}
            append_json(outcomes_path, row)
            latest[entry["name"]] = row
            checkpoint()
            emit({"name": entry["name"], "status": status})

        def flush():
            if not pending:
                return
            import_records(db, [row[1] for row in pending], apply=True)
            for entry, record in pending:
                outcome(entry, "stored", record=record)
            pending.clear()

        def persist_requests():
            nonlocal client_log_cursor
            for event in client.log[client_log_cursor:]:
                event = dict(event)
                # A replay inherits the original fetch timestamp, not this run's replay time.
                previous = source_metadata.get(event.get("requested_url"), {})
                if event.get("saved_from") and previous.get("started_at"):
                    event["started_at"] = previous["started_at"]
                append_json(requests_path, event)
                requests.append(event)
                url = event.get("requested_url")
                path = output / event.get("source_file", "missing")
                if url and event.get("status") in (200, 404, 410) and not event.get("blocked") and path.is_file():
                    client.saved[url] = {"path": path, "run": str(output), "status": event["status"], "url": event.get("url") or url}
                    source_metadata[url] = event
            client_log_cursor = len(client.log)
            checkpoint()

        checkpoint()
        try:
            reconcile_catalog(db, queue, latest, outcome)
            blocked = active_block()
            if blocked:
                stop = "source_blocked_until_recorded_deadline"
            else:
                for entry in queue:
                    previous = latest.get(entry["name"], {})
                    if previous.get("status") in TERMINAL and not (retry_review and previous["status"] == "review"):
                        continue
                    if previous.get("status") == "ready":
                        pending.append((entry, normalize_record(previous["record"])))
                        if len(pending) >= batch_size:
                            flush()
                        continue
                    try:
                        valid_url = canonical_url(entry["url"])
                    except ValueError:
                        valid_url = None
                    if not valid_url:
                        outcome(entry, "review", error="missing_or_invalid_main_url")
                        continue
                    if not all_requests and client.requests >= max_requests and valid_url not in client.saved:
                        stop = "request_budget_exhausted"
                        break
                    state = State(Path(state_path))
                    shared_state = State(shared_state_path)
                    if active_block():
                        stop = "source_blocked_until_recorded_deadline"
                        break
                    try:
                        try:
                            page = client.get(valid_url)
                        finally:
                            persist_requests()
                    except SiteBlocked as error:
                        state.add_block(error.until, error.reason, valid_url, utcnow())
                        state.save()
                        shared_state.add_block(error.until, error.reason, valid_url, utcnow())
                        shared_state.save()
                        outcome(entry, "fetch_error", error="source_blocked")
                        stop = "source_blocked_no_retry"
                        break
                    except BudgetExhausted:
                        stop = "request_budget_exhausted"
                        break
                    except FetchError:
                        failures += 1
                        outcome(entry, "fetch_error", error="network_failure")
                        if failures >= 3:
                            stop = "three_consecutive_network_or_server_failures"
                            break
                        continue
                    if page.status >= 500:
                        failures += 1
                        outcome(entry, "fetch_error", error="source_server_failure", http_status=page.status)
                        if failures >= 3:
                            stop = "three_consecutive_network_or_server_failures"
                            break
                        continue
                    failures = 0
                    if page.status != 200:
                        outcome(entry, "review", error="non_200_source", http_status=page.status)
                        continue
                    try:
                        result = extractor(page.text, entry["name"], page.url)
                    except Exception as error:
                        outcome(entry, "review", error="extraction_error:" + type(error).__name__)
                        continue
                    if result.get("error") or not result.get("description"):
                        outcome(entry, "review", error=result.get("error") or "no_definition", extraction=result)
                        continue
                    evidence = source_metadata.get(valid_url, {})
                    try:
                        record = normalize_record({"name": entry["name"], "url": result.get("canonical_url") or page.url,
                                                   "description": result["description"], "source_hash": evidence.get("sha256"),
                                                   "fetched_at": evidence.get("started_at")})
                        if not record["source_hash"] or record["fetched_at"] is None:
                            raise ValueError("Missing captured source provenance")
                    except ValueError as error:
                        # Validation diagnostics contain only the public source name/record, never transport headers.
                        outcome(entry, "review", error="invalid_record_or_missing_provenance", validation_error=str(error), extraction=result)
                        continue
                    outcome(entry, "ready", record=record, extraction=result)
                    pending.append((entry, record))
                    if len(pending) >= batch_size:
                        flush()
                flush()
        except KeyboardInterrupt:
            stop = "interrupted_resume_available"
        except Exception as error:
            # The source and database clients can carry headers/credentials in exception representations.
            # Retain a replayable ready record and log only the error type, never raw exception text.
            stop = "worker_error:" + type(error).__name__
            retryable, error_type = transient_backend_error(error), type(error).__name__
        finally:
            state.save()
            pending_count = len(queue) - sum(row.get("status") in TERMINAL for row in latest.values())
            phase = "stopped" if stop else "pending" if pending_count else "needs_review" if any(row.get("status") == "review" for row in latest.values()) else "complete"
            report = checkpoint()
            emit(report)
        return report


def until_complete(output, *, db=None, db_factory=None, retry_initial=60, retry_max=3600,
                   clock=time.time, sleep=time.sleep, run_once=None, emit=None, **options):
    """One foreground job owns the lock through work and waits. No cron or external restart loop is installed."""
    if retry_initial < 1 or retry_max < retry_initial:
        raise ValueError("Retry delays must satisfy 1 <= retry_initial <= retry_max")
    if db is None and db_factory is None:
        raise ValueError("Supply db or db_factory")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    emit = emit or (lambda value: print(json.dumps(value, ensure_ascii=False), flush=True))
    run_once = run_once or run
    lock_path = options.get("lock_path", DEFAULT_LOCK)
    control_path = output / "supervisor.json"
    control = json.loads(control_path.read_text()) if control_path.exists() else {}
    attempt = int(control.get("retry_attempt", 0))
    last_progress = int(control.get("completed", 0))
    report = {}
    options.update(all_requests=True, _lock_held=True, emit=emit)

    def persist_wait(value, phase, resume_at):
        waiting = {**value, "phase": phase, "pid": os.getpid(), "updated_at": datetime.fromtimestamp(clock(), timezone.utc).isoformat(),
                   "resume_at": datetime.fromtimestamp(resume_at, timezone.utc).isoformat(), "retry_attempt": attempt}
        atomic_json(output / "progress.json", waiting)
        atomic_json(control_path, {"phase": phase, "resume_at": resume_at, "retry_attempt": attempt,
                                   "completed": last_progress, "updated_at": waiting["updated_at"]})
        return waiting

    def wait(value, phase, resume_at):
        waiting = persist_wait(value, phase, resume_at)
        emit(waiting)
        while clock() < resume_at:
            # Heartbeats make long source cooldowns visible without issuing any request before the deadline.
            sleep(min(30, max(0, resume_at - clock())))
            waiting = persist_wait(value, phase, resume_at)
        return waiting

    with worker_lock(lock_path):
        try:
            if control.get("phase") in ("cooldown", "retry_wait") and float(control.get("resume_at", 0)) > clock():
                path = output / "progress.json"
                previous = json.loads(path.read_text()) if path.exists() else {}
                wait(previous, control["phase"], float(control["resume_at"]))
            while True:
                try:
                    if db is None:
                        db = db_factory()
                    report = run_once(db, output, **options)
                except Exception as error:
                    # Startup/configuration failures occur before run() can create its first checkpoint.
                    report = {"phase": "stopped", "stop": "startup_error:" + type(error).__name__,
                              "retryable": transient_backend_error(error), "error_type": type(error).__name__,
                              "pid": os.getpid(), "updated_at": datetime.fromtimestamp(clock(), timezone.utc).isoformat()}
                completed = int(report.get("stored", 0)) + int(report.get("already_present", 0))
                if completed > last_progress:
                    attempt = 0
                last_progress = max(last_progress, completed)
                if report.get("phase") == "complete" and not report.get("pending") and not report.get("review"):
                    atomic_json(control_path, {"phase": "complete", "completed": last_progress, "retry_attempt": 0})
                    return report
                reason = report.get("stop")
                if reason in ("source_blocked_until_recorded_deadline", "source_blocked_no_retry"):
                    deadline = report.get("blocked_until")
                    if not deadline:
                        # The deadline may have expired between the runner's stop and final checkpoint.
                        resume_at = clock() + retry_initial
                    else:
                        resume_at = max(clock(), datetime.fromisoformat(deadline).timestamp())
                    report = wait(report, "cooldown", resume_at)
                    continue
                retryable_pending = report.get("phase") == "pending" and int(report.get("pending", 0)) > 0
                if report.get("retryable") or reason == "three_consecutive_network_or_server_failures" or retryable_pending:
                    interval = min(retry_max, retry_initial * (2 ** min(attempt, 30)))
                    attempt += 1
                    report = wait(report, "retry_wait", clock() + interval)
                    if db_factory is not None:
                        db = None
                    continue
                if report.get("phase") == "needs_review":
                    report = {**report, "stop": "manual_review_required", "retryable": False}
                # Code, schema, credentials and unresolved semantic-review errors do not get automatic retries.
                atomic_json(output / "progress.json", report)
                atomic_json(control_path, {"phase": report.get("phase", "stopped"), "stop": report.get("stop"),
                                           "completed": last_progress, "retry_attempt": attempt})
                emit(report)
                return report
        except KeyboardInterrupt:
            report = {**report, "phase": "stopped", "stop": "interrupted_resume_available", "retryable": False,
                      "updated_at": datetime.fromtimestamp(clock(), timezone.utc).isoformat()}
            atomic_json(output / "progress.json", report)
            emit(report)
            return report


def status(output, *, lock_path=DEFAULT_LOCK, db=None):
    output = Path(output)
    path = output / "progress.json"
    result = json.loads(path.read_text()) if path.exists() else {"phase": "not_started"}
    result["worker_running"] = worker_is_running(lock_path)
    if db is not None:
        result["database"] = db.select("SELECT count(*) AS total,count(description) AS described FROM trope_catalog")[0]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=("queue", "run", "status"), default="run")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--pace-state", type=Path, default=DEFAULT_PACE)
    parser.add_argument("--all", action="store_true", help="Continue without a request-count limit until processed or hard-stopped")
    parser.add_argument("--until-complete", action="store_true", help="One continuous job: wait through source cooldowns and retry only recognized transient failures")
    parser.add_argument("--retry-initial", type=float, default=60)
    parser.add_argument("--retry-max", type=float, default=3600)
    parser.add_argument("--max-requests", type=int, default=200)
    parser.add_argument("--delay", type=float, default=6)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--refresh-queue", action="store_true")
    parser.add_argument("--retry-review", action="store_true", help="Re-extract rejected saved sources without bypassing source blocks")
    parser.add_argument("--saved", type=Path, action="append", default=[])
    parser.add_argument("--with-database", action="store_true", help="Include live database counts in status")
    args = parser.parse_args()
    if args.command == "status":
        print(json.dumps(status(args.output, lock_path=args.lock, db=Crate(settings()) if args.with_database else None), indent=2))
        return
    if args.until_complete and args.command != "run":
        parser.error("--until-complete is only valid for run")
    db = None if args.until_complete else Crate(settings())
    if args.command == "queue":
        with worker_lock(args.lock):
            entries = prepare_queue(db, args.output, refresh=args.refresh_queue)
        print(json.dumps({"queued": len(entries), "output": str(args.output)}))
        return
    options = dict(max_requests=args.max_requests, delay=args.delay, state_path=args.state, lock_path=args.lock,
                   pace_path=args.pace_state, refresh_queue=args.refresh_queue, retry_review=args.retry_review,
                   saved=args.saved, batch_size=args.batch_size)
    if args.until_complete:
        result = until_complete(args.output, db_factory=lambda: Crate(settings()), retry_initial=args.retry_initial,
                                retry_max=args.retry_max, **options)
    else:
        result = run(db, args.output, all_requests=args.all, **options)
    if result.get("stop") or result.get("phase") != "complete" or result.get("pending") or result.get("review"):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
