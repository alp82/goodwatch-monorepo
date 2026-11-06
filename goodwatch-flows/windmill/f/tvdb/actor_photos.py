# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Publish verified primary actor photos without changing TMDB's fallback profile_path."""

from datetime import datetime, timedelta

from f.sync.copy.sync_state import utc_now
from f.tvdb.ids import INT32_MAX, checked_id, tmdb_id
from f.tvdb.photos import photo_url
from f.tvdb.publish import ScopeError, data_error, quarantine
from f.tvdb.store import exclusive, record_run


def run(db, connector, limit=1000):
    now = utc_now()
    result = {
        "published": 0,
        "missing_people": 0,
        "failed_scopes": 0,
        "failures": [],
        "system_errors": [],
    }
    query = {
        "kind": "person",
        "status": "ok",
        "image_url": {"$exists": True},
        "tmdb_id": {"$gt": 0, "$lte": INT32_MAX},
        "publish_pending": True,
        "$or": [
            {"publish_retry_at": {"$exists": False}},
            {"publish_retry_at": {"$lte": now}},
        ],
    }
    docs = list(db.tvdb_entities.find(query).sort("updated_at", 1).limit(limit))
    if not docs:
        return result
    people = {
        r["tmdb_id"]
        for r in connector.select(
            "SELECT tmdb_id FROM person WHERE tmdb_id = ANY(?)",
            ([tmdb_id(d.get("tmdb_id")) for d in docs],),
        )
    }
    sql = (
        "UPDATE person SET tvdb_id = ?, tvdb_profile_url = ?, tvdb_profile_updated_at = ? "
        "WHERE tmdb_id = ? AND (tvdb_profile_updated_at IS NULL OR tvdb_profile_updated_at <= ?) "
        "AND (? = true OR tvdb_id IS NULL OR tvdb_id = ?)"
    )
    pending = []
    for doc in docs:
        if tmdb_id(doc.get("tmdb_id")) not in people:
            db.tvdb_entities.update_one(
                {"_id": doc["_id"], "updated_at": doc["updated_at"]},
                {
                    "$set": {
                        "photo_waiting_for_person": True,
                        "publish_retry_at": now + timedelta(hours=1),
                    }
                },
            )
            result["missing_people"] += 1
            continue
        try:
            image = photo_url(doc.get("image_url"))
            observed = doc.get("image_observed_at")
            if not isinstance(observed, datetime) or not checked_id(doc.get("tvdb_id")):
                raise ScopeError("Invalid actor photo identity or observation time")
            pending.append(
                (
                    doc,
                    [
                        doc["tvdb_id"],
                        image,
                        observed,
                        doc["tmdb_id"],
                        observed,
                        bool(image),
                        doc["tvdb_id"],
                    ],
                )
            )
        except ScopeError as error:
            quarantine(db.tvdb_entities, doc, error, now, result)

    def write(batch):
        if not batch:
            return
        try:
            connector.run_many(sql, [params for _, params in batch], missing_ok=True)
        except Exception as error:
            if not data_error(error):
                raise
            if len(batch) == 1:
                quarantine(db.tvdb_entities, batch[0][0], error, now, result)
            else:
                middle = len(batch) // 2
                write(batch[:middle])
                write(batch[middle:])
            return
        for doc, _ in batch:
            db.tvdb_entities.update_one(
                {"_id": doc["_id"], "updated_at": doc["updated_at"]},
                {
                    "$set": {
                        "publish_pending": False,
                        "published_at": doc["updated_at"],
                    },
                    "$unset": {
                        "publish_retry_at": "",
                        "publish_error": "",
                        "publish_failures": "",
                        "photo_waiting_for_person": "",
                    },
                },
            )
        result["published"] += len(batch)

    for offset in range(0, len(pending), 500):
        write(pending[offset : offset + 500])
    if result["published"]:
        db.tvdb_state.update_one(
            {"_id": "publication-progress:tvdb_entities"},
            {"$set": {"at": now}},
            upsert=True,
        )
    return result


def main(limit: int = 1000):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    if not 1 <= limit <= 10000:
        raise ValueError("Invalid actor photo batch size")
    init_mongodb()
    connector = None
    try:
        db = get_db()
        with exclusive(db, "actor-photos", 30):
            connector = CrateConnector()
            report = record_run(db, "actor-photos", run(db, connector, limit))
            if report["failed_scopes"]:
                raise RuntimeError(
                    "TVDB actor photo publication has quarantined scopes"
                )
            return report
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
