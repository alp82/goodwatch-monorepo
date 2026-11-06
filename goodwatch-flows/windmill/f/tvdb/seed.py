# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Seed a resumable TVDB queue from our TMDB catalog, without fetching API data."""

from datetime import timedelta

from f.external_ids.imdb_ids import effective_imdb_id
from f.sync.copy.sync_state import utc_now
from f.tvdb.store import EPOCH, exclusive, indexes, record_run
from pymongo import UpdateOne


def run(db, max_seconds=240, clock=utc_now):
    start = clock()
    counts = {}
    indexes(db)
    for media_type, source in [
        ("movie", "tmdb_movie_details"),
        ("show", "tmdb_tv_details"),
    ]:
        key = "seed:" + media_type
        state = db.tvdb_state.find_one({"_id": key}) or {}
        full = not state.get("through") or state.get("scan_after") is not None
        if (
            not full
            and state.get("finished_at")
            and start - state["finished_at"] < timedelta(hours=1)
        ):
            counts[media_type] = 0
            continue
        scan_started = state.get("scan_started_at", start)
        if full:
            db.tvdb_state.update_one(
                {"_id": key}, {"$set": {"scan_started_at": scan_started}}, upsert=True
            )
        query = {}
        if full and state.get("scan_after") is not None:
            query["_id"] = {"$gt": state["scan_after"]}
        if not full:
            query["updated_at"] = {"$gte": state["through"] - timedelta(hours=48)}
        rows = (
            db[source]
            .find(
                query,
                {
                    "tmdb_id": 1,
                    "imdb_id": 1,
                    "imdb_id_override": 1,
                    "external_ids": 1,
                    "popularity": 1,
                    "tmdb_deleted": 1,
                },
            )
            .sort("_id", 1)
            .batch_size(1000)
        )
        batch, scanned, after = [], 0, None

        def flush(batch=batch):
            if batch:
                db.tvdb_titles.bulk_write(batch, ordered=False)
                batch.clear()

        for row in rows:
            if clock() - start >= timedelta(seconds=max_seconds):
                flush()
                # Full scans resume by _id. Incremental scans deliberately replay their window.
                if full and after is not None:
                    db.tvdb_state.update_one(
                        {"_id": key}, {"$set": {"scan_after": after}}, upsert=True
                    )
                return counts | {media_type: scanned, "incomplete": True}
            imdb, _ = effective_imdb_id(row, media_type == "movie")
            tvdb = (row.get("external_ids") or {}).get("tvdb_id")
            if imdb or tvdb:
                batch.append(
                    UpdateOne(
                        {"_id": f"{media_type}:{row['tmdb_id']}"},
                        {
                            "$set": {
                                "media_type": media_type,
                                "tmdb_id": row["tmdb_id"],
                                "imdb_id": imdb,
                                "source_tvdb_id": tvdb,
                                "tmdb_deleted": bool(row.get("tmdb_deleted")),
                                "priority": row.get("popularity") or 0,
                            },
                            "$setOnInsert": {"due_at": EPOCH, "created_at": start},
                        },
                        upsert=True,
                    )
                )
            if row.get("tmdb_deleted"):
                db.tvdb_titles.update_one(
                    {"_id": f"{media_type}:{row['tmdb_id']}"},
                    {
                        "$set": {
                            "characters": [],
                            "status": "removed",
                            "publish_pending": True,
                            "updated_at": clock(),
                        }
                    },
                    upsert=False,
                )
            scanned += 1
            after = row["_id"]
            if len(batch) >= 1000:
                flush()
                if full:
                    db.tvdb_state.update_one(
                        {"_id": key}, {"$set": {"scan_after": after}}, upsert=True
                    )
        flush()
        db.tvdb_state.update_one(
            {"_id": key},
            {
                "$set": {
                    "through": scan_started if full else start,
                    "finished_at": clock(),
                },
                "$unset": {"scan_after": "", "scan_started_at": ""},
            },
            upsert=True,
        )
        counts[media_type] = scanned
    return counts


def main():
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        with exclusive(db, "seed", 10):
            return record_run(db, "seed", run(db))
    finally:
        close_mongodb()
