# extra_requirements:
# requests
# pymongo
# mongoengine
# wmill

"""Replay TVDB update pages into durable queues; periodic sweeps cover unrouteable edits."""

from datetime import timezone
from time import monotonic

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


def run(db, api, max_seconds=240, timer=monotonic):
    start, initial = timer(), api.requests
    report = {"pages": 0, "events": 0}
    for kind in TYPES:
        key = "updates:" + kind
        state = db.tvdb_state.find_one({"_id": key}) or {}
        now = utc_now()
        # Freeze the lower bound for pagination. Commit only after the last page is durably applied.
        since = state.get(
            "pending_since",
            state.get(
                "through", int(now.replace(tzinfo=timezone.utc).timestamp()) - 86400
            )
            - 300,
        )
        page = state.get("page", 0)
        through = state.get(
            "pending_through", int(now.replace(tzinfo=timezone.utc).timestamp())
        )
        while timer() - start < max_seconds:
            body = api.get(f"/updates?since={since}&type={kind}&page={page}")
            events = body["data"]
            if not isinstance(events, list) or not isinstance(body.get("links"), dict):
                raise TypeError("Malformed TVDB updates page")
            for event in events:
                record = event.get("recordId")
                if type(record) is not int or event.get("methodInt") not in (1, 2, 3):
                    raise ValueError("Malformed TVDB update event")
                if kind in ("movies", "series"):
                    media_type = "movie" if kind == "movies" else "show"
                    db.tvdb_titles.update_many(
                        {
                            "media_type": media_type,
                            "$or": [{"tvdb_id": record}, {"source_tvdb_id": record}],
                        },
                        {"$set": {"due_at": EPOCH}},
                    )
                    db.tvdb_entities.update_many(
                        {"kind": media_type, "tvdb_id": record},
                        {"$set": {"due_at": EPOCH}},
                    )
                elif kind == "seriespeople":
                    db.tvdb_titles.update_many(
                        {"characters.id": record}, {"$set": {"due_at": EPOCH}}
                    )
                    # New credits are picked up by title updates and the fixed reconciliation cycle.
                elif kind == "people":
                    db.tvdb_entities.update_many(
                        {"kind": "person", "tvdb_id": record},
                        {"$set": {"due_at": EPOCH}},
                    )
                elif kind == "award_categories":
                    db.tvdb_categories.update_one(
                        {"_id": record}, {"$set": {"due_at": EPOCH}}
                    )
                    db.tvdb_state.update_one(
                        {"_id": "awards-index"},
                        {"$set": {"due_at": EPOCH}},
                        upsert=True,
                    )
                else:
                    db.tvdb_categories.update_many(
                        {"nominees.id": record}, {"$set": {"due_at": EPOCH}}
                    )
                    # New nominee IDs have no category in the feed; the daily category sweep discovers them.
                report["events"] += 1
            report["pages"] += 1
            if not body["links"].get("next"):
                db.tvdb_state.update_one(
                    {"_id": key},
                    {
                        "$set": {"through": through},
                        "$unset": {
                            "pending_since": "",
                            "pending_through": "",
                            "page": "",
                        },
                    },
                    upsert=True,
                )
                break
            page += 1
            db.tvdb_state.update_one(
                {"_id": key},
                {
                    "$set": {
                        "pending_since": since,
                        "pending_through": through,
                        "page": page,
                    }
                },
                upsert=True,
            )
        if timer() - start >= max_seconds:
            report["incomplete"] = True
            break
    report["requests"] = api.requests - initial
    return report


def main(max_minutes: float = 4):
    from f.db.mongodb import close_mongodb

    db, api = runtime()
    try:
        with exclusive(db, "updates", 10):
            try:
                return run(db, api, int(max_minutes * 60))
            except Deferred:
                return {"deferred": True}
    finally:
        close_mongodb()
