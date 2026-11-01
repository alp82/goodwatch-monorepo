# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Maintain the Letterboxd movie queue from TMDB; never imports titles upstream."""
from datetime import datetime, timedelta

from pymongo import UpdateOne

from f.external_ids.imdb_ids import effective_imdb_id

COLLECTION = "letterboxd_movie_rating"
EPOCH = datetime(1970, 1, 1)


def ensure_indexes(db):
    collection = db[COLLECTION]
    collection.create_index("tmdb_id", unique=True)
    collection.create_index([("popularity", -1), ("next_crawl_at", 1)], name="letterboxd_due")
    collection.create_index("updated_at")


def seed(db, full=False, tmdb_ids=None, now=None):
    now = now or datetime.utcnow()
    state = db.critic_site_state.find_one({"_id": "letterboxd"}) or {}
    previous = state.get("seeded_through")
    full_scan = tmdb_ids is None and (full or not previous or state.get("seed_scan_started_at") is not None)
    query = {"updated_at": {"$gte": previous - timedelta(days=2)}} if previous and not full else {}
    if tmdb_ids is not None:
        query = {"tmdb_id": {"$in": tmdb_ids}}
    elif full_scan:
        query = {}
        if state.get("seed_scan_after") is not None:
            query["_id"] = {"$gt": state["seed_scan_after"]}
        now = state.get("seed_scan_started_at") or now
        db.critic_site_state.update_one({"_id": "letterboxd"}, {"$set": {"seed_scan_started_at": now}}, upsert=True)
    fields = {"tmdb_id": 1, "imdb_id": 1, "imdb_id_override": 1, "popularity": 1, "tmdb_deleted": 1}
    batch, count = [], 0
    for row in db.tmdb_movie_details.find(query, fields).sort("_id", 1).batch_size(1000):
        imdb_id, _ = effective_imdb_id(row, True)
        # Rows without an IMDb id cannot be resolved without a force-import URL.
        if not imdb_id:
            continue
        batch.append(UpdateOne({"tmdb_id": row["tmdb_id"]}, {
            "$set": {"imdb_id": imdb_id, "popularity": row.get("popularity") or 0,
                     "tmdb_deleted": bool(row.get("tmdb_deleted"))},
            "$setOnInsert": {"created_at": now, "next_crawl_at": EPOCH}}, upsert=True))
        if len(batch) == 1000:
            db[COLLECTION].bulk_write(batch, ordered=False)
            count += len(batch)
            batch = []
            if full_scan:
                db.critic_site_state.update_one({"_id": "letterboxd"}, {"$set": {"seed_scan_after": row["_id"]}})
            if count % 10000 == 0:
                print(f"Letterboxd queue: {count} movies seeded this run", flush=True)
    if batch:
        db[COLLECTION].bulk_write(batch, ordered=False)
        count += len(batch)
    if tmdb_ids is None:
        update = {"$max": {"seeded_through": now}}
        if full_scan:
            update["$unset"] = {"seed_scan_started_at": "", "seed_scan_after": ""}
        db.critic_site_state.update_one({"_id": "letterboxd"}, update, upsert=True)
    return {"queued_or_refreshed": count, "full": full}


def main(full: bool = False):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    init_mongodb()
    try:
        db = get_db()
        ensure_indexes(db)
        return seed(db, full=full)
    finally:
        close_mongodb()
