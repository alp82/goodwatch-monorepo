"""Read the daily recent-release recheck plan; never reserve the regular queue.

Crate dates are indexed, unlike the release dates in the Mongo details collections.
The existing details fetch accepts Mongo object IDs. Publication stays with the
scheduled f/sync/copy/tmdb_streaming writer. See docs/recent-release-rechecks.md.
"""
from datetime import datetime, timedelta, timezone

MAX_TITLES = 20000
BATCH_SIZE = 50
RELEASE_DAYS = 30
UPCOMING_DAYS = 7
# Provisional same-day retry cutoff; cached research did not establish TMDB's update time.
TMDB_UPDATE_DONE_UTC_HOUR = 12


def select_recheck(crate, db, now: datetime) -> dict:
    now = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start, end = today - timedelta(days=RELEASE_DAYS - 1), today + timedelta(days=UPCOMING_DAYS + 1)
    checked_since = int((today + timedelta(hours=TMDB_UPDATE_DONE_UTC_HOUR)).timestamp() * 1000)
    already_checked = 0
    candidates = 0
    unavailable = 0
    titles = []
    date_params = (int(start.timestamp() * 1000), int(end.timestamp() * 1000), MAX_TITLES + 1)
    digital_ids = {int(row["tmdb_id"]) for row in crate.select(
        "SELECT DISTINCT media_tmdb_id AS tmdb_id FROM release_event "
        "WHERE media_type = 'movie' AND release_type = 4 "
        "AND release_date >= ? AND release_date < ? ORDER BY media_tmdb_id LIMIT ?",
        date_params,
    )}
    digital_only_ids = set()
    for kind, field, collection in (
        ("movie", "release_date", "tmdb_movie_details"),
        ("show", "first_air_date", "tmdb_tv_details"),
    ):
        rows = crate.select(
            f"SELECT DISTINCT tmdb_id FROM {kind} WHERE {field} >= ? AND {field} < ? ORDER BY tmdb_id LIMIT ?",
            date_params,
        )
        ids = {int(row["tmdb_id"]) for row in rows}
        if kind == "movie":
            digital_only_ids = digital_ids - ids
            ids |= digital_ids
        candidates += len(ids)
        if candidates > MAX_TITLES:
            raise RuntimeError(f"Recent releases exceed the {MAX_TITLES} title daily budget; no fetches started")
        projection = {"tmdb_id": 1, "watch_providers_check.checked_at": 1,
                      "watch_providers_check.cache_bypassed": 1, "watch_providers_error": 1}
        seen = set()
        query = {"tmdb_id": {"$in": sorted(ids)}, "tmdb_deleted": {"$ne": True}, "is_selected": {"$ne": True}}
        for doc in db[collection].find(query, projection).sort([("tmdb_id", 1), ("_id", 1)]):
            if doc["tmdb_id"] in seen:
                continue
            seen.add(doc["tmdb_id"])
            proof = doc.get("watch_providers_check") or {}
            checked_at = proof.get("checked_at")
            if (proof.get("cache_bypassed") is True and isinstance(checked_at, (int, float))
                    and checked_at >= checked_since and not doc.get("watch_providers_error")):
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
        "release_from": start.date().isoformat(), "release_through": (end - timedelta(days=1)).date().isoformat(),
        "candidates": candidates, "already_checked": already_checked, "unavailable": unavailable,
        "selected": len(titles), "movies": sum(t["media_type"] == "movie" for t in titles),
        "shows": sum(t["media_type"] == "show" for t in titles),
        "digital_movies": sum(t["media_type"] == "movie" and t["tmdb_id"] in digital_ids for t in titles),
        "digital_only_movies": sum(t["media_type"] == "movie" and t["tmdb_id"] in digital_only_ids for t in titles),
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
