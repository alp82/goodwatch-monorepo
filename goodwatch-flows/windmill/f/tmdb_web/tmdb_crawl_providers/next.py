# requirements:
# crate==2.2.1
# pydantic==2.13.5
# mongoengine==0.29.3
# pymongo==4.18.1
# wmill==1.815.0
from datetime import datetime

from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.country_state import select_country_ids, upstream_deadline

BATCH_SIZE = 5


def main(availability_selection: bool = False) -> dict:
    init_mongodb()
    try:
        db = get_db()
        now = datetime.utcnow()
        result = {"movie_ids": [], "tv_ids": []}
        if upstream_deadline(db, now) is not None:
            return result
        for media_type in ("movie", "tv"):
            collection = db[f"tmdb_{media_type}_providers"]
            if availability_selection:
                from f.db.cratedb import CrateConnector
                from f.tmdb_web.availability_selector import recent_open_ids, select
                crate = CrateConnector()
                try:
                    opened = recent_open_ids(crate, media_type, now)
                finally:
                    crate.disconnect()
                selected = select(collection, now, 10, opened)
                result[f"{media_type}_ids"] = [row["id"] for row in selected]
                result.setdefault("tiers", {}).update({row["id"]: row["tier"] for row in selected})
            else:
                result[f"{media_type}_ids"] = select_country_ids(collection, now, BATCH_SIZE)
        return result
    finally:
        close_mongodb()
