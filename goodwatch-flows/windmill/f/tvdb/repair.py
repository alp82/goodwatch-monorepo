# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Clear invalid normalized joins, retain evidence, and replay saved source snapshots."""

from f.sync.copy.sync_state import utc_now
from f.tvdb.ids import tmdb_id
from f.tvdb.store import EPOCH


def run(db, dry_run=True):
    report = {
        "dry_run": dry_run,
        "invalid_mappings": 0,
        "repaired": 0,
        "titles_requeued": 0,
        "categories_requeued": 0,
        "sample": [],
    }
    query = {
        "kind": {"$in": ["person", "movie", "show"]},
        "tmdb_id": {"$exists": True, "$ne": None},
    }
    for doc in db.tvdb_entities.find(query, {"tmdb_id": 1, "kind": 1, "tvdb_id": 1}):
        if tmdb_id(doc["tmdb_id"]) is not None:
            continue
        report["invalid_mappings"] += 1
        if len(report["sample"]) < 10:
            report["sample"].append(
                {"entity": doc["_id"], "rejected_tmdb_id": str(doc["tmdb_id"])}
            )
        if dry_run:
            continue
        now = utc_now()
        # Preserve the old normalized value even if a later upstream refresh removes its bad remote ID.
        db.tvdb_repairs.update_one(
            {"_id": f"{doc['_id']}:{doc['tmdb_id']}"},
            {
                "$setOnInsert": {
                    "entity": doc["_id"],
                    "rejected_tmdb_id": doc["tmdb_id"],
                    "at": now,
                }
            },
            upsert=True,
        )
        result = db.tvdb_entities.update_one(
            {"_id": doc["_id"], "tmdb_id": doc["tmdb_id"]},
            {
                "$set": {
                    "tmdb_id": None,
                    "mapping_error": "invalid_tmdb_id",
                    "rejected_tmdb_id": doc["tmdb_id"],
                    "updated_at": now,
                }
            },
        )
        if not result.modified_count:
            continue
        replay = {
            "$set": {
                "updated_at": now,
                "publish_pending": True,
                "publish_retry_at": EPOCH,
            }
        }
        if doc["kind"] == "person":
            affected = db.tvdb_titles.update_many(
                {"characters.peopleId": doc["tvdb_id"]}, replay
            )
        else:
            field = "movie" if doc["kind"] == "movie" else "series"
            affected = db.tvdb_categories.update_many(
                {f"nominees.{field}.id": doc["tvdb_id"]}, replay
            )
        report[
            "titles_requeued" if doc["kind"] == "person" else "categories_requeued"
        ] += affected.matched_count
        report["repaired"] += 1
    return report


def main(dry_run: bool = True):
    from f.db.mongodb import close_mongodb, init_mongodb
    from f.tvdb.store import exclusive, record_run
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        with exclusive(db, "repair", 30):
            return record_run(db, "repair", run(db, dry_run))
    finally:
        close_mongodb()
