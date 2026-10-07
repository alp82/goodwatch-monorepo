from datetime import datetime, timedelta

from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.episode_catalog import DETAILS_COLLECTION

BATCH_SIZE = 500
# A reserved show is due again after this long, so a run that dies loses nothing.
LEASE = timedelta(hours=1)
DUE_INDEX = [("episodes_due_at", 1)]


def reserve_due_shows(collection, count: int, now: datetime) -> list[int]:
    """Reserve the next shows whose episodes are due and return their TMDB ids.

    Shows never fetched come first, then the ones due longest. Both reads walk the
    episodes_due_at index and stop after `count` entries. What makes a show due is
    decided when it is fetched (episode_catalog.next_refresh_at) and by TMDB's change
    feed (changes.py); here a show is due when its time has come.
    """
    projection = {"tmdb_id": 1}
    never_fetched = list(collection.find({"episodes_due_at": None}, projection).hint(DUE_INDEX).limit(count))
    due = []
    if len(never_fetched) < count:
        due = list(
            collection.find({"episodes_due_at": {"$lte": now}}, projection)
            .hint(DUE_INDEX)
            .sort("episodes_due_at", 1)
            .limit(count - len(never_fetched))
        )
    shows = never_fetched + due
    if shows:
        collection.update_many(
            {"_id": {"$in": [show["_id"] for show in shows]}},
            {"$set": {"episodes_selected_at": now, "episodes_due_at": now + LEASE}},
        )
    return [show["tmdb_id"] for show in shows if show.get("tmdb_id") is not None]


def main(count: int = BATCH_SIZE):
    # Windmill passes None for an argument the caller left out, so the default above doesn't apply.
    count = count or BATCH_SIZE
    init_mongodb()
    try:
        tmdb_ids = reserve_due_shows(get_db()[DETAILS_COLLECTION], count, datetime.utcnow())
    finally:
        close_mongodb()
    return {"tmdb_ids": tmdb_ids}


if __name__ == "__main__":
    main()
