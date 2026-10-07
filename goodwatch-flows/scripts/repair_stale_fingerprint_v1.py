"""Rewrite fingerprint_v1 from fingerprint_v1_raw for the points listed for issue #223.

For the listed points the fingerprint publish (f/sync/copy/vector_data) stored an older
analysis in fingerprint_v1, while fingerprint_v1_raw and the `fingerprint_scores_v1` payload
hold the title's current scores. This script sends each such point's own fingerprint_v1_raw
as its fingerprint_v1 (Qdrant normalizes a Cosine vector on write, as it does for the
publish). It writes that one named vector and nothing else: no other vector, no payload, no
point is created or deleted, and no point outside the list is touched.

A point is repaired only when, read at that moment, all of this holds: it exists and is the
listed title; fingerprint_v1_raw has 74 values; they equal the payload scores in CoreScores
order; and fingerprint_v1 differs from the normalized raw vector by more than TOLERANCE in
some component. Every other point is skipped with a reason.

Without `--execute` nothing is written (dry run). With it, each batch is re-read
immediately before its write, the old fingerprint_v1 of every point is saved to a backup
file first, and every written point is read back and checked. `--revert BACKUP` writes the
saved vectors back for the points that still hold what the repair wrote (dry run without
`--execute`).

The publish also writes these points. A publish that runs between a batch's re-read and its
write can be overwritten with the fingerprint of the scores read a moment earlier; the
read-back reports such a point as failed and a second run repairs it. So `--execute` refuses
to start, and stops between batches, while f/sync/copy/vector_data runs or is about to. Until
the publish itself is fixed it can store an older analysis again for a title it rewrites.

Credentials come from the environment (QDRANT_URL with the REST or gRPC port,
QDRANT_API_KEY; WMILL_TOKEN or ~/.config/windmill/remotes.ndjson for the job check).
`--env-file` reads the two QDRANT_ settings from a file when the environment lacks them.
"""
import argparse
import hashlib
import json
import math
import os
import statistics
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

_WINDMILL = Path(__file__).resolve().parents[1] / "windmill"
sys.path.insert(0, os.environ.get("GOODWATCH_WINDMILL_DIR") or str(_WINDMILL))
from qdrant_client import QdrantClient, models as qm

from f.dna.models import CoreScores
from f.sync.copy.qdrant_retry import (
    REQUEST_TIMEOUT_SECONDS, PublicationFailure, classify_error, write_with_retry,
)
from f.sync.models.qdrant_models import QdrantMediaPoint
from f.sync.models.qdrant_schemas import FINGERPRINT_RAW_VECTOR, FINGERPRINT_VECTOR, MEDIA_COLLECTION

CATEGORY = "mongo_vector_fingerprint_stale"
DIMENSIONS = 74
# Largest component difference between two unit vectors that still counts as the same
# vector. One score changing by 1 moves a component by about 0.01; float32 noise is 1e-7.
TOLERANCE = 1e-4
BATCH_SIZE = 200
PAUSE_SECONDS = 2.0
READ_ATTEMPTS = 3

COPY_SCRIPT = "f/sync/copy/vector_data"
OTHER_WRITERS = ("f/priority/", "f/search/embed_titles")
WMILL_URL = os.environ.get("WMILL_URL", "http://10.0.0.10:9000").rstrip("/")
WMILL_WORKSPACE = os.environ.get("WMILL_WORKSPACE", "goodwatch")
# Refuse to write when the next scheduled publish starts within this many minutes.
MINUTES_BEFORE_COPY = 15

COSINE_BUCKETS = (0.5, 0.7, 0.8, 0.9, 0.95, 0.99, 0.999)


class Stop(Exception):
    """The run must end now; nothing further is written."""


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


# ---- Vectors ---------------------------------------------------------------


def unit(vector: list) -> list | None:
    length = math.sqrt(sum(value * value for value in vector))
    return [value / length for value in vector] if length > 0 else None


def max_difference(a: list, b: list) -> float:
    """Largest component difference of the two vectors' unit vectors."""
    return max(abs(x - y) for x, y in zip(unit(a), unit(b)))


def cosine(a: list, b: list) -> float:
    return sum(x * y for x, y in zip(unit(a), unit(b)))


def scores_in_order(scores) -> list | None:
    """The payload scores in CoreScores order, as the publish builds fingerprint_v1_raw."""
    if not isinstance(scores, dict):
        return None
    try:
        validated = CoreScores(**scores)
    except Exception:
        return None
    return [float(getattr(validated, name)) for name in CoreScores.model_fields]


# ---- The list --------------------------------------------------------------


def load_listed(path: str, limit: int | None) -> list[dict]:
    """The listed points of CATEGORY, in file order. Any defect in the list ends the run."""
    listed, seen = [], set()
    with open(path) as lines:
        for number, line in enumerate(lines, 1):
            if not line.strip():
                continue
            entry = json.loads(line)
            if entry.get("category") != CATEGORY:
                continue
            point_id = entry["point_id"]
            if point_id != QdrantMediaPoint.make_point_id(entry["media_type"], entry["tmdb_id"]):
                raise SystemExit(f"{path}:{number}: point_id does not belong to the title")
            if point_id in seen:
                raise SystemExit(f"{path}:{number}: point {point_id} is listed twice")
            seen.add(point_id)
            listed.append({key: entry.get(key) for key in ("point_id", "media_type", "tmdb_id", "expected_scores")})
    return listed[:limit] if limit is not None else listed


# ---- Reads -----------------------------------------------------------------


def with_read_retry(read):
    for attempt in range(1, READ_ATTEMPTS + 1):
        try:
            return read()
        except Exception as error:
            classification, transient = classify_error(error)
            if not transient or attempt == READ_ATTEMPTS:
                raise Stop(f"Qdrant read failed ({classification}): {type(error).__name__}") from None
            time.sleep(2.0 * attempt)


def read_fingerprints(client: QdrantClient, collection: str, ids: list) -> dict:
    """point id -> {fingerprint, raw, payload} for the points that exist."""
    points = with_read_retry(lambda: client.retrieve(
        collection_name=collection, ids=ids,
        with_payload=["tmdb_id", "media_type", "fingerprint_scores_v1"],
        with_vectors=[FINGERPRINT_VECTOR, FINGERPRINT_RAW_VECTOR],
    ))
    found = {}
    for point in points:
        vectors = point.vector if isinstance(point.vector, dict) else {}
        found[point.id] = {
            "fingerprint": vectors.get(FINGERPRINT_VECTOR),
            "raw": vectors.get(FINGERPRINT_RAW_VECTOR),
            "payload": point.payload or {},
        }
    return found


def _digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def read_surroundings(client: QdrantClient, collection: str, ids: list) -> dict:
    """point id -> a hash of the whole payload and one of each named vector except fingerprint_v1."""
    points = with_read_retry(lambda: client.retrieve(
        collection_name=collection, ids=ids, with_payload=True, with_vectors=True,
    ))
    found = {}
    for point in points:
        vectors = point.vector if isinstance(point.vector, dict) else {"": point.vector}
        found[point.id] = {
            "payload": _digest(point.payload),
            "vectors": {
                name: _digest(value.model_dump() if hasattr(value, "model_dump") else value)
                for name, value in sorted(vectors.items()) if name != FINGERPRINT_VECTOR
            },
        }
    return found


def changed_surroundings(before: dict | None, after: dict | None) -> list[str]:
    """What differs between two read_surroundings entries of one point; empty when nothing does."""
    if before is None or after is None:
        return ["point missing"]
    changed = [] if before["payload"] == after["payload"] else ["payload"]
    for name in sorted(set(before["vectors"]) | set(after["vectors"])):
        if before["vectors"].get(name) != after["vectors"].get(name):
            changed.append(name)
    return changed


# ---- Decision --------------------------------------------------------------


def decide(entry: dict, point: dict | None) -> dict:
    """What to do with one listed point, judged by the point as it is now.

    `action` is "repair" or "skip". The list's `expected_scores` are only reported
    (`raw_equals_snapshot`); they don't decide anything.
    """
    def skip(reason: str, **facts) -> dict:
        return {"action": "skip", "reason": reason, **facts}

    if point is None:
        return skip("point_missing")
    payload, raw, fingerprint = point["payload"], point["raw"], point["fingerprint"]
    if payload.get("media_type") != entry["media_type"] or payload.get("tmdb_id") != entry["tmdb_id"]:
        return skip("not_the_listed_title")
    if not isinstance(raw, list) or len(raw) != DIMENSIONS:
        return skip("raw_missing" if raw is None else "raw_malformed")
    facts = {"raw_equals_snapshot": raw == [float(score) for score in entry["expected_scores"] or []]}
    if "fingerprint_scores_v1" not in payload:
        return skip("payload_scores_missing", **facts)
    scores = scores_in_order(payload["fingerprint_scores_v1"])
    if scores is None:
        return skip("payload_scores_invalid", **facts)
    if raw != scores:
        return skip("raw_differs_from_payload", **facts)
    if unit(raw) is None:
        return skip("raw_all_zero", **facts)
    if not isinstance(fingerprint, list) or len(fingerprint) != DIMENSIONS or unit(fingerprint) is None:
        return skip("fingerprint_missing" if fingerprint is None else "fingerprint_malformed", **facts)
    facts.update(max_difference=max_difference(fingerprint, raw), cosine=cosine(fingerprint, raw))
    if facts["max_difference"] <= TOLERANCE:
        return skip("already_consistent", **facts)
    return {"action": "repair", "reason": "fingerprint_differs_from_raw", **facts}


# ---- Writes ----------------------------------------------------------------


def fingerprint_only_update(vectors_by_id: dict, listed_ids: set) -> list:
    """One update_vectors operation that names only fingerprint_v1, for listed points only."""
    outside = set(vectors_by_id) - listed_ids
    if outside:
        raise Stop(f"refusing to write {len(outside)} points that are not on the list")
    for vector in vectors_by_id.values():
        if not isinstance(vector, list) or len(vector) != DIMENSIONS:
            raise Stop("refusing to write a vector that does not have 74 values")
    return [qm.UpdateVectorsOperation(update_vectors=qm.UpdateVectors(points=[
        qm.PointVectors(id=point_id, vector={FINGERPRINT_VECTOR: vector})
        for point_id, vector in vectors_by_id.items()
    ]))]


def write_fingerprints(client: QdrantClient, collection: str, vectors_by_id: dict, listed_ids: set) -> dict:
    """Send the batch with the publish's retry policy (wait=True, bounded attempts and time)."""
    return write_with_retry(
        client, collection, fingerprint_only_update(vectors_by_id, listed_ids), lambda: None,
    )


# ---- Windmill --------------------------------------------------------------


def _windmill_get(path: str, query: dict) -> list:
    token = os.environ.get("WMILL_TOKEN")
    if not token:
        with open(os.path.expanduser("~/.config/windmill/remotes.ndjson")) as remotes:
            token = next(json.loads(line)["token"] for line in remotes if line.strip())
    request = urllib.request.Request(
        f"{WMILL_URL}/api/w/{WMILL_WORKSPACE}/{path}?{urllib.parse.urlencode(query)}",
        headers={"Authorization": "Bearer " + token}, method="GET",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read())


def copy_job_state() -> dict:
    """Whether the fingerprint publish runs now, when it is next due, and which other writers run."""
    running = [job.get("script_path") or "" for job in _windmill_get("jobs/queue/list", {"running": "true", "per_page": 200})
               if job.get("running")]
    queued = _windmill_get("jobs/queue/list", {"script_path_exact": COPY_SCRIPT, "per_page": 50})
    due = sorted(job["scheduled_for"] for job in queued
                 if job.get("script_path") == COPY_SCRIPT and not job.get("running") and job.get("scheduled_for"))
    minutes = None
    if due:
        start = datetime.fromisoformat(due[0].replace("Z", "+00:00"))
        minutes = round((start - datetime.now(timezone.utc)).total_seconds() / 60, 1)
    return {
        "copy_running": any(path.startswith(COPY_SCRIPT) for path in running)
        or any(job.get("running") for job in queued if job.get("script_path") == COPY_SCRIPT),
        "minutes_until_next_copy": minutes,
        "other_writers_running": sorted({path for path in running if path.startswith(OTHER_WRITERS)}),
    }


def ensure_no_copy_job(skip_check: bool) -> dict | None:
    """Raise Stop when the publish runs or is due soon. With skip_check, only say what to check."""
    if skip_check:
        print(f"Job check skipped. Make sure {COPY_SCRIPT} is not running and not due within "
              f"{MINUTES_BEFORE_COPY} minutes (it starts every 4 hours at :30 and takes about 8 minutes).",
              file=sys.stderr, flush=True)
        return None
    try:
        state = copy_job_state()
    except Exception as error:
        raise Stop(f"could not list Windmill jobs ({type(error).__name__}). Check by hand that {COPY_SCRIPT} "
                   "is not running, then pass --skip-job-check") from None
    if state["copy_running"]:
        raise Stop(f"{COPY_SCRIPT} is running; start again when it has finished")
    minutes = state["minutes_until_next_copy"]
    if minutes is not None and minutes < MINUTES_BEFORE_COPY:
        raise Stop(f"{COPY_SCRIPT} starts in {minutes} minutes; start again when it has finished")
    return state


# ---- Runs ------------------------------------------------------------------


def batches(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def plan(client: QdrantClient, collection: str, listed: list[dict], log, batch_size: int) -> tuple[list[dict], dict]:
    """Read and judge every listed point. Returns the repairable entries and the counts."""
    repairable, reasons, cosines, differs_from_snapshot = [], Counter(), [], 0
    for batch in batches(listed, batch_size):
        points = read_fingerprints(client, collection, [entry["point_id"] for entry in batch])
        for entry in batch:
            decision = decide(entry, points.get(entry["point_id"]))
            log({"phase": "plan", **_identity(entry), **decision})
            if decision.get("raw_equals_snapshot") is False:
                differs_from_snapshot += 1
            if decision["action"] == "repair":
                repairable.append(entry)
                cosines.append(decision["cosine"])
            else:
                reasons[decision["reason"]] += 1
        time.sleep(0.2)
    return repairable, {
        "listed": len(listed), "repairable": len(repairable), "skipped": dict(sorted(reasons.items())),
        "raw_differs_from_snapshot": differs_from_snapshot, "cosine_current_vs_new": cosine_summary(cosines),
    }


def cosine_summary(cosines: list) -> dict | None:
    if not cosines:
        return None
    ordered = sorted(cosines)
    edges = (-1.0,) + COSINE_BUCKETS + (1.0000001,)
    quantile = lambda q: round(ordered[min(len(ordered) - 1, int(q * len(ordered)))], 4)
    return {
        "min": round(ordered[0], 4), "p05": quantile(0.05), "p25": quantile(0.25), "median": quantile(0.5),
        "p75": quantile(0.75), "p95": quantile(0.95), "max": round(ordered[-1], 4),
        "mean": round(statistics.fmean(ordered), 4),
        "histogram": {
            (f"< {high}" if low < 0 else f">= {low}" if high > 1 else f"{low} to {high}"):
                sum(1 for value in ordered if low <= value < high)
            for low, high in zip(edges, edges[1:])
        },
    }


def _identity(entry: dict) -> dict:
    return {"point_id": entry["point_id"], "media_type": entry["media_type"], "tmdb_id": entry["tmdb_id"]}


def surroundings_self_test(client: QdrantClient, collection: str, entries: list[dict]) -> dict:
    """Read the payload and vector hashes of some points twice; without a writer they must be equal."""
    ids = [entry["point_id"] for entry in entries]
    started = time.monotonic()
    first = read_surroundings(client, collection, ids)
    seconds = round(time.monotonic() - started, 2)
    second = read_surroundings(client, collection, ids)
    differing = [point_id for point_id in ids if changed_surroundings(first.get(point_id), second.get(point_id))]
    names = Counter(name for point in first.values() for name in point["vectors"])
    return {"points": len(ids), "differing_between_two_reads": len(differing), "seconds_per_read": seconds,
            "other_vectors_present": dict(sorted(names.items()))}


def apply_batch(client, collection, batch, listed_ids, judge, log, backup, skip_job_check, counts: Counter) -> None:
    """Re-read one batch, write the points `judge` still selects, read them back and check them.
    Adds to `counts`; raises Stop when the write or the check of the batch failed.

    `judge(entry, point)` returns {"action": "write", "vector": ..., "expect": ...} or a skip.
    `expect(point)` tells whether a point read after the write holds what was written.
    """
    ensure_no_copy_job(skip_job_check)
    ids = [entry["point_id"] for entry in batch]
    before = read_surroundings(client, collection, ids)
    points = read_fingerprints(client, collection, ids)
    writes = {}
    for entry in batch:
        verdict = judge(entry, points.get(entry["point_id"]))
        if verdict["action"] == "write":
            writes[entry["point_id"]] = verdict
        else:
            counts[f"skipped_at_write:{verdict['reason']}"] += 1
            log({"phase": "write", **_identity(entry), "action": "skip", "reason": verdict["reason"]})
    if not writes:
        return
    if backup is not None:
        for entry in batch:
            if entry["point_id"] in writes:
                point = points[entry["point_id"]]
                backup.write(json.dumps({**_identity(entry), "saved_at": now(),
                                         "old_fingerprint_v1": point["fingerprint"],
                                         "raw_written_as_fingerprint_v1": point["raw"]}) + "\n")
        backup.flush()
        os.fsync(backup.fileno())
    failure, failed = None, 0
    try:
        result = write_fingerprints(
            client, collection, {point_id: verdict["vector"] for point_id, verdict in writes.items()}, listed_ids)
        counts["write_attempts"] += result["attempts"]
        counts["write_retries"] += result["retries"]
    except PublicationFailure as error:
        # Some or all of the batch may have been applied. The read-back below records the truth.
        failure = error.summary
    after_points = read_fingerprints(client, collection, list(writes))
    after = read_surroundings(client, collection, list(writes))
    for entry in batch:
        point_id = entry["point_id"]
        if point_id not in writes:
            continue
        holds_written = writes[point_id]["expect"](after_points.get(point_id))
        changed = changed_surroundings(before.get(point_id), after.get(point_id))
        counts["written" if failure is None else "in_failed_batch"] += 1
        counts["verified" if holds_written and not changed else "failed"] += 1
        failed += not (holds_written and not changed)
        if changed:
            counts["surroundings_changed"] += 1
        log({"phase": "write", **_identity(entry), "action": "write", "request_failed": failure is not None,
             "fingerprint_as_written": holds_written, "changed_besides_fingerprint_v1": changed})
    if failure is not None:
        raise Stop(f"write failed after retries: {json.dumps(failure, sort_keys=True)}")
    if failed:
        raise Stop(f"{failed} points of the last batch did not verify; see the result log")


def run_batches(client, collection, entries, listed_ids, judge, log, backup, args) -> tuple[Counter, str | None]:
    counts, stopped = Counter(), None
    try:
        for index, batch in enumerate(batches(entries, args.batch_size)):
            if index:
                time.sleep(args.pause)
            apply_batch(client, collection, batch, listed_ids, judge, log, backup, args.skip_job_check, counts)
            print(json.dumps({"batch": index + 1, **counts}), flush=True)
    except Stop as stop:
        stopped = str(stop)
    return counts, stopped


def repair_judge(entry: dict, point: dict | None) -> dict:
    decision = decide(entry, point)
    if decision["action"] != "repair":
        return decision
    raw = point["raw"]

    def expect(after: dict | None) -> bool:
        return (after is not None and after["raw"] == raw and isinstance(after["fingerprint"], list)
                and len(after["fingerprint"]) == DIMENSIONS and unit(after["fingerprint"]) is not None
                and max_difference(after["fingerprint"], raw) <= TOLERANCE)

    return {"action": "write", "vector": raw, "expect": expect}


def revert_judge(saved: dict):
    """Judge for --revert: write a saved vector back only where the repair's vector is still stored."""
    def judge(entry: dict, point: dict | None) -> dict:
        record = saved[entry["point_id"]]
        old, written = record["old_fingerprint_v1"], record["raw_written_as_fingerprint_v1"]
        fingerprint = point["fingerprint"] if point else None
        if not isinstance(fingerprint, list) or len(fingerprint) != DIMENSIONS or unit(fingerprint) is None:
            return {"action": "skip", "reason": "point_or_fingerprint_missing"}
        if max_difference(fingerprint, old) <= TOLERANCE:
            return {"action": "skip", "reason": "already_holds_saved_vector"}
        if max_difference(fingerprint, written) > TOLERANCE:
            return {"action": "skip", "reason": "changed_since_repair"}

        def expect(after: dict | None) -> bool:
            return (after is not None and isinstance(after["fingerprint"], list)
                    and len(after["fingerprint"]) == DIMENSIONS and unit(after["fingerprint"]) is not None
                    and max_difference(after["fingerprint"], old) <= TOLERANCE)

        return {"action": "write", "vector": old, "expect": expect}
    return judge


def load_backup(path: str, listed: list[dict]) -> tuple[list[dict], dict]:
    """The listed entries that the backup holds, and the saved record of each (the first one wins:
    it is the oldest state of a point that one backup file saw)."""
    by_id = {entry["point_id"]: entry for entry in listed}
    saved = {}
    with open(path) as lines:
        for line in lines:
            if not line.strip():
                continue
            record = json.loads(line)
            if record["point_id"] not in by_id:
                raise SystemExit(f"{path}: point {record['point_id']} is not on the list")
            if len(record["old_fingerprint_v1"]) != DIMENSIONS:
                raise SystemExit(f"{path}: point {record['point_id']} has no complete saved vector")
            saved.setdefault(record["point_id"], record)
    return [by_id[point_id] for point_id in saved], saved


def check_collection(client: QdrantClient, collection: str) -> None:
    vectors = client.get_collection(collection).config.params.vectors
    for name in (FINGERPRINT_VECTOR, FINGERPRINT_RAW_VECTOR):
        if not isinstance(vectors, dict) or name not in vectors or vectors[name].size != DIMENSIONS:
            raise SystemExit(f"{collection} has no {name} with {DIMENSIONS} dimensions")
    if vectors[FINGERPRINT_VECTOR].distance != qm.Distance.COSINE:
        raise SystemExit(f"{FINGERPRINT_VECTOR} is not a Cosine vector")


def qdrant_settings(env_file: str | None) -> tuple[str, str | None]:
    settings = {}
    if env_file:
        with open(env_file) as lines:
            for line in lines:
                key, separator, value = line.strip().partition("=")
                if separator and key in ("QDRANT_URL", "QDRANT_API_KEY"):
                    settings[key] = value.strip().strip("\"'")
    url = os.environ.get("QDRANT_URL") or settings.get("QDRANT_URL")
    if not url:
        raise SystemExit("QDRANT_URL is not set")
    return url, os.environ.get("QDRANT_API_KEY") or settings.get("QDRANT_API_KEY")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("list", help="stale_points.jsonl of issue #223")
    parser.add_argument("--collection", default=MEDIA_COLLECTION)
    parser.add_argument("--execute", action="store_true", help="write; without it nothing is written")
    parser.add_argument("--revert", metavar="BACKUP", help="write the vectors saved in this backup file back")
    parser.add_argument("--limit", type=int, help="only the first N listed points")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--pause", type=float, default=PAUSE_SECONDS, help="seconds between write batches")
    parser.add_argument("--out-dir", default=".", help="where the result log and the backup go")
    parser.add_argument("--env-file", help="file with QDRANT_URL and QDRANT_API_KEY lines")
    parser.add_argument("--skip-job-check", action="store_true",
                        help=f"write without asking Windmill whether {COPY_SCRIPT} runs")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1 or not 1 <= args.batch_size <= 500 or args.pause < 0:
        parser.error("--limit must be at least 1, --batch-size 1 to 500, --pause not negative")

    listed = load_listed(args.list, args.limit)
    listed_ids = {entry["point_id"] for entry in listed}
    mode = ("revert" if args.revert else "repair") + ("" if args.execute else "_dry_run")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / f"fingerprint_v1_{mode}_{stamp}.jsonl"
    backup_path = out_dir / f"fingerprint_v1_backup_{stamp}.jsonl"
    summary = {"mode": mode, "started": now(), "list": args.list, "collection": args.collection,
               "limit": args.limit, "tolerance": TOLERANCE}
    url, api_key = qdrant_settings(args.env_file)
    started = time.monotonic()
    stopped = None
    with closing(QdrantClient(
        url=url, api_key=api_key, prefer_grpc=url.endswith(":6334"), timeout=REQUEST_TIMEOUT_SECONDS,
    )) as client, open(log_path, "x") as log_file:
        def log(record: dict) -> None:
            log_file.write(json.dumps(record) + "\n")

        try:
            check_collection(client, args.collection)
            if args.execute:
                summary["jobs_at_start"] = ensure_no_copy_job(args.skip_job_check)
            else:
                try:
                    summary["jobs_at_start"] = copy_job_state()
                except Exception as error:
                    summary["jobs_at_start"] = f"not available: {type(error).__name__}"
            if args.revert:
                entries, saved = load_backup(args.revert, listed)
                summary.update(listed=len(listed), in_backup=len(entries))
                judge = revert_judge(saved)
                if args.execute:
                    counts, stopped = run_batches(client, args.collection, entries, listed_ids, judge, log, None, args)
                    summary.update(counts)
                else:
                    verdicts = Counter()
                    for batch in batches(entries, args.batch_size):
                        points = read_fingerprints(client, args.collection, [entry["point_id"] for entry in batch])
                        for entry in batch:
                            verdict = judge(entry, points.get(entry["point_id"]))
                            verdicts["would_write" if verdict["action"] == "write" else f"skipped:{verdict['reason']}"] += 1
                            log({"phase": "plan", **_identity(entry), "action": verdict["action"], "reason": verdict.get("reason")})
                    summary.update(verdicts)
            else:
                repairable, planned = plan(client, args.collection, listed, log, args.batch_size)
                summary.update(planned)
                print(json.dumps({"planned": planned}), flush=True)
                if args.execute and repairable:
                    with open(backup_path, "x") as backup:
                        summary["backup"] = str(backup_path)
                        counts, stopped = run_batches(
                            client, args.collection, repairable, listed_ids, repair_judge, log, backup, args)
                    summary.update({"written": 0, "verified": 0, "failed": 0, **counts})
                elif repairable:
                    summary["surroundings_self_test"] = surroundings_self_test(
                        client, args.collection, repairable[:args.batch_size])
        except Stop as stop:
            stopped = str(stop)
        summary.update(stopped=stopped, finished=now(), seconds=round(time.monotonic() - started, 1),
                       result_log=str(log_path))
        log({"summary": summary})
    print(json.dumps(summary, indent=1))
    if stopped:
        print(f"STOPPED: {stopped}", file=sys.stderr)
    return 2 if stopped else 0


if __name__ == "__main__":
    sys.exit(main())
