from bson import ObjectId
from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.country_state import backfill


def main(media_type: str, after_id: str = "", batch_size: int = 1000, dry_run: bool = True) -> dict:
    if media_type not in ("movie", "tv"):
        raise ValueError("media_type must be movie or tv")
    cursor = ObjectId(after_id) if after_id else None
    init_mongodb()
    try:
        return backfill(get_db()[f"tmdb_{media_type}_providers"], media_type,
                        after_id=cursor, batch_size=batch_size, dry_run=dry_run)
    finally:
        close_mongodb()
