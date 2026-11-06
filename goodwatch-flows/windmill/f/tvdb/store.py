# extra_requirements:
# pymongo
# mongoengine
# wmill

"""TVDB source snapshots and leased work queues. Source IDs never become TMDB IDs."""

from contextlib import contextmanager
from datetime import datetime, timedelta
from uuid import uuid4

from f.sync.copy.sync_state import utc_now
from pymongo import ReturnDocument, UpdateOne
from pymongo.errors import DuplicateKeyError


class Busy(RuntimeError):
    pass


EPOCH = datetime(1970, 1, 1)


def indexes(db):
    for name in ["tvdb_titles", "tvdb_entities", "tvdb_categories"]:
        db[name].create_index([("due_at", 1), ("priority", -1)])
        db[name].create_index("updated_at")
        db[name].create_index([("publish_pending", 1), ("updated_at", 1)])
        db[name].create_index([("publish_pending", 1), ("publish_retry_at", 1)])
        db[name].create_index("publish_failures")
    db.tvdb_titles.create_index([("media_type", 1), ("tvdb_id", 1)])
    db.tvdb_titles.create_index("characters.peopleId")
    db.tvdb_titles.create_index("characters.id")
    db.tvdb_categories.create_index("nominees.id")
    db.tvdb_entities.create_index([("kind", 1), ("tmdb_id", 1)])


def enqueue(collection, key, fields, priority=0):
    collection.update_one(
        {"_id": key},
        {
            "$set": fields,
            "$setOnInsert": {
                "due_at": EPOCH,
                "priority": priority,
                "created_at": utc_now(),
            },
        },
        upsert=True,
    )


def enqueue_many(collection, entries):
    """Deduplicate an API batch before one Mongo request; avoid a round trip per nominee/actor."""
    now = utc_now()
    unique = {key: (fields, priority) for key, fields, priority in entries}
    operations = [
        UpdateOne(
            {"_id": key},
            {
                "$set": fields,
                "$setOnInsert": {
                    "due_at": EPOCH,
                    "priority": priority,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        for key, (fields, priority) in unique.items()
    ]
    for offset in range(0, len(operations), 1000):
        collection.bulk_write(operations[offset : offset + 1000], ordered=False)


def claim(collection, now, lease_minutes=10):
    token = uuid4().hex
    doc = collection.find_one_and_update(
        {
            "due_at": {"$lte": now},
            "$or": [
                {"lease_until": {"$exists": False}},
                {"lease_until": {"$lte": now}},
            ],
        },
        {
            "$set": {
                "lease_token": token,
                "lease_until": now + timedelta(minutes=lease_minutes),
            }
        },
        sort=[("due_at", 1), ("priority", -1)],
        return_document=ReturnDocument.AFTER,
    )
    return doc


def finish(collection, doc, fields):
    if "updated_at" in fields:
        fields = fields | {"publish_pending": True, "publish_retry_at": EPOCH}
    result = collection.update_one(
        {"_id": doc["_id"], "lease_token": doc["lease_token"]},
        {"$set": fields, "$unset": {"lease_token": "", "lease_until": ""}},
    )
    if result.matched_count != 1:
        raise RuntimeError("TVDB lease expired before save")


@contextmanager
def exclusive(db, name, minutes):
    now, token = utc_now(), uuid4().hex
    try:
        result = db.tvdb_state.update_one(
            {
                "_id": "lease:" + name,
                "$or": [{"until": {"$lte": now}}, {"until": {"$exists": False}}],
            },
            {"$set": {"token": token, "until": now + timedelta(minutes=minutes)}},
            upsert=True,
        )
    except DuplicateKeyError:
        raise Busy(f"TVDB {name} already running") from None
    try:
        yield result
    finally:
        db.tvdb_state.update_one(
            {"_id": "lease:" + name, "token": token},
            {"$unset": {"until": "", "token": ""}},
        )


def runtime():
    import wmill
    from f.db.mongodb import init_mongodb
    from f.tvdb.api import Client
    from mongoengine import get_db

    init_mongodb()
    db = get_db()
    indexes(db)
    return db, Client(db, wmill.get_variable("u/Alp/TVDB_API_KEY"))


def main():
    """Shared source storage; no standalone mutation."""


def record_run(db, name, report):
    now = utc_now()
    db.tvdb_runs.create_index("at", expireAfterSeconds=30 * 86400)
    db.tvdb_runs.insert_one({"job": name, "at": now, **report})
    db.tvdb_state.update_one(
        {"_id": "run:" + name}, {"$set": {"at": now, "report": report}}, upsert=True
    )
    return report


def safe_publish(callback, report):
    """Publishing cannot discard a crawler's otherwise successful progress/metrics."""
    try:
        result = callback() or {}
        report["publication_errors"] = (
            report.get("publication_errors", 0)
            + result.get("failed_scopes", 0)
            + len(result.get("system_errors", []))
        )
    except Exception as error:  # noqa: BLE001 -- callback boundary retains successful crawl progress
        report["publication_errors"] = report.get("publication_errors", 0) + 1
        report["publication_error_type"] = type(error).__name__
        print(f"TVDB publication deferred: {type(error).__name__}", flush=True)
