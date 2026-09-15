from datetime import datetime

from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.country_state import select_country_ids, upstream_deadline

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
            result[f"{media_type}_ids"] = select_country_ids(collection, now, BATCH_SIZE)
        return result
    finally:
        close_mongodb()
