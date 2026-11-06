# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Collect primary actor photos independently from character-portrait coverage."""

from datetime import timedelta
from urllib.parse import urlsplit

from f.sync.copy.sync_state import utc_now
from f.tvdb.ids import checked_id
from f.tvdb.store import EPOCH, enqueue_many, exclusive, record_run
from pymongo import UpdateOne


def photo_url(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
        return (
            parsed._replace(netloc="artworks.thetvdb.com", fragment="").geturl()
            if parsed.scheme == "https"
            and parsed.hostname == "artworks.thetvdb.com"
            and not parsed.username
            and not parsed.password
            and parsed.port in (None, 443)
            and parsed.path.startswith("/banners/")
            and not any(c.isspace() for c in value)
            else None
        )
    except ValueError:
        return None


def seed_actors(db, actors, observed_at, priority=0):
    actors = {
        checked_id(c["peopleId"]): c for c in actors if checked_id(c.get("peopleId"))
    }
    # Every actor can have a primary photo, including actors without a character portrait.
    enqueue_many(
        db.tvdb_entities,
        [
            (f"person:{pid}", {"kind": "person", "tvdb_id": pid}, priority)
            for pid in actors
        ],
    )
    operations = []
    for pid, actor in actors.items():
        image = photo_url(actor.get("personImgURL"))
        if image:
            # Reuse already crawled primary-photo URLs. Never replace a canonical person API observation.
            operations.append(
                UpdateOne(
                    {"_id": f"person:{pid}", "image_url": {"$exists": False}},
                    {
                        "$set": {
                            "image_url": image,
                            "image_source": "cast",
                            "image_observed_at": observed_at,
                            "updated_at": utc_now(),
                            "publish_pending": True,
                            "publish_retry_at": EPOCH,
                        }
                    },
                )
            )
    for offset in range(0, len(operations), 1000):
        db.tvdb_entities.bulk_write(operations[offset : offset + 1000], ordered=False)
    return len(actors)


def run(db, max_seconds=240, clock=utc_now):
    start = clock()
    state = db.tvdb_state.find_one({"_id": "photo-seed"}) or {}
    if not state.get("after") and state.get("due_at", start) > start:
        return {"titles": 0, "actors": 0}
    until = state.get("until", start)
    query = {"characters.peopleId": {"$gt": 0}}
    if state.get("through"):
        query["updated_at"] = {
            "$gte": state["through"] - timedelta(minutes=30),
            "$lte": until,
        }
    if state.get("after"):
        query["_id"] = {"$gt": state["after"]}
    titles, actors, after = 0, 0, state.get("after")
    rows = (
        db.tvdb_titles.find(
            query,
            {
                "characters.peopleId": 1,
                "characters.personImgURL": 1,
                "fetched_at": 1,
                "priority": 1,
            },
        )
        .hint("characters.peopleId_1")
        .sort("_id", 1)
        .batch_size(100)
    )
    for doc in rows:
        if clock() - start >= timedelta(seconds=max_seconds):
            db.tvdb_state.update_one(
                {"_id": "photo-seed"},
                {"$set": {"after": after, "until": until}},
                upsert=True,
            )
            return {"titles": titles, "actors": actors, "incomplete": True}
        actors += seed_actors(
            db,
            doc.get("characters") or [],
            doc.get("fetched_at") or until,
            doc.get("priority", 0),
        )
        titles += 1
        after = doc["_id"]
    db.tvdb_state.update_one(
        {"_id": "photo-seed"},
        {
            "$set": {"through": until, "due_at": start + timedelta(hours=1)},
            "$unset": {"after": "", "until": ""},
        },
        upsert=True,
    )
    return {"titles": titles, "actors": actors}


def main():
    from f.db.mongodb import close_mongodb, init_mongodb
    from f.tvdb.store import indexes
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "photo-seed", 10):
            return record_run(db, "photo-seed", run(db))
    finally:
        close_mongodb()
