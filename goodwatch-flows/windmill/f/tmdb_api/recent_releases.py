"""Read the daily recent-release recheck plan; never reserve the regular queue.

Crate dates are indexed, unlike the release dates in the Mongo details collections.
The existing details fetch accepts Mongo object IDs. Publication stays with the
scheduled f/sync/copy/tmdb_streaming writer. See docs/recent-release-rechecks.md.
"""
from datetime import datetime, timedelta, timezone

MAX_TITLES = 20000
BATCH_SIZE = 50


def select_recheck(crate, db, now: datetime) -> dict:
    now = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start, end = today - timedelta(days=29), today + timedelta(days=1)
    checked_since = int((today + timedelta(hours=12)).timestamp() * 1000)
    already_checked = 0
    candidates = 0
    unavailable = 0
    titles = []
    for kind, field, collection in (
        ("movie", "release_date", "tmdb_movie_details"),
        ("show", "first_air_date", "tmdb_tv_details"),
    ):
        rows = crate.select(
            f"SELECT DISTINCT tmdb_id FROM {kind} WHERE {field} >= ? AND {field} < ? ORDER BY tmdb_id LIMIT ?",
            (int(start.timestamp() * 1000), int(end.timestamp() * 1000), MAX_TITLES + 1),
        )
        ids = [int(row["tmdb_id"]) for row in rows]
        candidates += len(ids)
        if candidates > MAX_TITLES:
            raise RuntimeError(f"Recent releases exceed the {MAX_TITLES} title daily budget; no fetches started")
        projection = {"tmdb_id": 1, "watch_providers_check.checked_at": 1, "watch_providers_error": 1}
        seen = set()
        query = {"tmdb_id": {"$in": ids}, "tmdb_deleted": {"$ne": True}}
        for doc in db[collection].find(query, projection).sort([("tmdb_id", 1), ("_id", 1)]):
            if doc["tmdb_id"] in seen:
                continue
            seen.add(doc["tmdb_id"])
            checked_at = (doc.get("watch_providers_check") or {}).get("checked_at")
            if isinstance(checked_at, (int, float)) and checked_at >= checked_since and not doc.get("watch_providers_error"):
                already_checked += 1
                continue
            titles.append({"media_type": kind, "tmdb_id": doc["tmdb_id"], "id": str(doc["_id"])})
        unavailable += len(ids) - len(seen)
    batches = []
    for offset in range(0, len(titles), BATCH_SIZE):
        batch = titles[offset:offset + BATCH_SIZE]
        batches.append({
            "movie_ids": [t["id"] for t in batch if t["media_type"] == "movie"],
            "tv_ids": [t["id"] for t in batch if t["media_type"] == "show"],
        })
    return {
        "release_from": start.date().isoformat(), "release_through": today.date().isoformat(),
        "candidates": candidates, "already_checked": already_checked, "unavailable": unavailable,
        "selected": len(titles), "movies": sum(t["media_type"] == "movie" for t in titles),
        "shows": sum(t["media_type"] == "show" for t in titles),
        "titles": titles, "batches": batches,
    }


def main():
    from mongoengine import get_db
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import init_mongodb, close_mongodb

    crate = CrateConnector()
    try:
        init_mongodb()
        try:
            return select_recheck(crate, get_db(), datetime.now(timezone.utc))
        finally:
            close_mongodb()
    finally:
        crate.disconnect()
