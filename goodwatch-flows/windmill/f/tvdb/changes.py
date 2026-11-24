# extra_requirements:
# requests
# pymongo
# mongoengine
# wmill

"""Replay TVDB update pages into durable queues; periodic sweeps cover unrouteable edits."""

from contextlib import contextmanager
from datetime import timezone
from time import monotonic, perf_counter

from pymongo import timeout

from f.sync.copy.sync_state import utc_now
from f.tvdb.api import Deferred
from f.tvdb.store import EPOCH, exclusive, runtime

TYPES = (
    "movies",
    "series",
    "seriespeople",
    "people",
    "award_categories",
    "award_nominees",
)
SETUP_TIMEOUT_SECONDS = 60
LEASE_CLEANUP_SECONDS = 30


@contextmanager
def measure(timings, stage, *, kind=None, page=None):
    start = perf_counter()
    try:
        yield
    except Exception as error:
        print(
            f"TVDB Changes stage={stage} kind={kind} page={page} "
            f"seconds={perf_counter() - start:.2f} error={type(error).__name__}",
            flush=True,
        )
        raise
    finally:
        timings[stage] = round(timings.get(stage, 0) + perf_counter() - start, 3)


def apply_page(db, kind, events):
    records = set()
    for event in events:
        record = event.get("recordId")
        if type(record) is not int or event.get("methodInt") not in (1, 2, 3):
            raise ValueError("Malformed TVDB update event")
        records.add(record)
    if not records:
        return

    ids = {"$in": sorted(records)}
    due = {"$set": {"due_at": EPOCH}}
    if kind in ("movies", "series"):
        media_type = "movie" if kind == "movies" else "show"
        db.tvdb_titles.update_many(
            {"media_type": media_type, "$or": [{"tvdb_id": ids}, {"source_tvdb_id": ids}]},
            due,
        )
        db.tvdb_entities.update_many({"kind": media_type, "tvdb_id": ids}, due)
    elif kind == "seriespeople":
        # New credits are picked up by title updates and the reconciliation cycle.
        db.tvdb_titles.update_many({"characters.id": ids}, due)
    elif kind == "people":
        db.tvdb_entities.update_many({"kind": "person", "tvdb_id": ids}, due)
    elif kind == "award_categories":
        db.tvdb_categories.update_many({"_id": ids}, due)
        db.tvdb_state.update_one({"_id": "awards-index"}, due, upsert=True)
    else:
        # The category sweep discovers new nominee IDs with no known category.
        db.tvdb_categories.update_many({"nominees.id": ids}, due)


def run(db, api, max_seconds=240, timer=monotonic):
    deadline, initial = timer() + max_seconds, api.requests
    timings = {}
    report = {"pages": 0, "events": 0, "timings_seconds": timings}
    for kind in TYPES:
        if timer() >= deadline:
            report["incomplete"] = True
            break
        key = "updates:" + kind
        with measure(timings, "checkpoint_read", kind=kind):
            state = db.tvdb_state.find_one({"_id": key}) or {}
        now = int(utc_now().replace(tzinfo=timezone.utc).timestamp())
        # Keep the same lower bound until the last page is applied.
        since = state.get("pending_since", state.get("through", now - 86400) - 300)
        page = state.get("page", 0)
        through = state.get("pending_through", now)
        while timer() < deadline:
            try:
                with measure(timings, "api_fetch", kind=kind, page=page):
                    body = api.get(f"/updates?since={since}&type={kind}&page={page}")
            except Deferred:
                report.update(deferred=True, incomplete=True, requests=api.requests - initial)
                return report
            if timer() >= deadline:
                break
            events = body["data"]
            if not isinstance(events, list) or not isinstance(body.get("links"), dict):
                raise TypeError("Malformed TVDB updates page")
            with measure(timings, "apply_page", kind=kind, page=page):
                apply_page(db, kind, events)
            has_next = bool(body["links"].get("next"))
            checkpoint = (
                {"$set": {"pending_since": since, "pending_through": through, "page": page + 1}}
                if has_next else
                {"$set": {"through": through},
                 "$unset": {"pending_since": "", "pending_through": "", "page": ""}}
            )
            with measure(timings, "checkpoint_write", kind=kind, page=page):
                db.tvdb_state.update_one({"_id": key}, checkpoint, upsert=True)
            report["pages"] += 1
            report["events"] += len(events)
            if not has_next:
                break
            page += 1
        if timer() >= deadline:
            report["incomplete"] = True
            break
    report["requests"] = api.requests - initial
    return report


def main(max_minutes: float = 4):
    from f.db.mongodb import close_mongodb

    deadline = monotonic() + max_minutes * 60
    timings = {}
    try:
        with timeout(min(SETUP_TIMEOUT_SECONDS, max_minutes * 60)):
            with measure(timings, "setup"):
                db, api = runtime()
        with timeout(max(0, deadline - monotonic()) + LEASE_CLEANUP_SECONDS):
            with exclusive(db, "updates", 10):
                remaining = deadline - monotonic()
                if remaining <= 0:
                    return {"pages": 0, "events": 0, "incomplete": True,
                            "timings_seconds": timings}
                api.deadline = deadline
                with timeout(remaining):
                    report = run(db, api, remaining)
                report["timings_seconds"].update(timings)
                return report
    finally:
        close_mongodb()
