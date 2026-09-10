from datetime import datetime

from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.country_state import FRESHNESS, eligibility, upstream_deadline

BATCH_SIZE = 5


def main() -> dict:
    init_mongodb()
    try:
        db = get_db()
        now = datetime.utcnow()
        result = {"movie_ids": [], "tv_ids": []}
        if upstream_deadline(db, now) is not None:
            return result
        for media_type in ("movie", "tv"):
            collection = db[f"tmdb_{media_type}_providers"]
            ids = result[f"{media_type}_ids"]
            # Query indexed due dates first, then indexed legacy freshness. Avoid
            # an unbounded popularity sort over eight million provider documents.
            for selector, order in (
                ({"next_fetch_at": {"$lte": now}}, "next_fetch_at"),
                ({"next_fetch_at": None, "updated_at": None}, "updated_at"),
                (
                    {
                        "next_fetch_at": None,
                        "updated_at": {"$lte": now - FRESHNESS},
                    },
                    "updated_at",
                ),
            ):
                remaining = BATCH_SIZE - len(ids)
                if remaining <= 0:
                    break
                cursor = (
                    collection.find(
                        {"$and": [selector, eligibility(now)]}, {"_id": 1}
                    )
                    .sort(order, 1)
                    .limit(remaining)
                )
                ids.extend(str(document["_id"]) for document in cursor)
        return result
    finally:
        close_mongodb()
