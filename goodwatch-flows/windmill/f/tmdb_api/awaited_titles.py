"""The titles members wait for, and when each is due for an offer recheck.

docs/awaited-title-rechecks.md. One document per title in a small Mongo collection,
written every hour from the member tables (tmdb_fetch_details_from_api/awaited) and
read by the details queue (tmdb_fetch_details_from_api/next). The queue never reads
Crate: it works from the last list that was stored.
"""
from datetime import datetime, timedelta
from typing import Iterable

COLLECTION = "tmdb_awaited_titles"
# How often a listed title's offers are rechecked.
CYCLE = timedelta(days=1)
# How long a title stays after the last list that named it.
LIST_GRACE = timedelta(days=3)
TITLES_PER_WRITE = 1000

Title = tuple[str, int]  # ("movie" | "show", tmdb_id), as the member tables name it


def store_list(db, titles: Iterable[Title], now: datetime) -> dict:
    """Store the titles members wait for now. A new title is due at once.

    A title that is no longer listed stays for LIST_GRACE, so one short read of the
    member tables costs no title its place. An empty list removes nothing.
    """
    titles = sorted(set(titles))
    if not titles:
        return {"listed": 0, "added": 0, "removed": 0}
    collection = db[COLLECTION]
    added = 0
    for start in range(0, len(titles), TITLES_PER_WRITE):
        batch = {f"{media_type}:{tmdb_id}": (media_type, tmdb_id) for media_type, tmdb_id in titles[start:start + TITLES_PER_WRITE]}
        collection.update_many({"_id": {"$in": list(batch)}}, {"$set": {"listed_at": now}})
        known = {title["_id"] for title in collection.find({"_id": {"$in": list(batch)}}, {"_id": 1})}
        new = [
            {"_id": key, "media_type": media_type, "tmdb_id": tmdb_id,
             "first_listed_at": now, "listed_at": now, "due_at": now}
            for key, (media_type, tmdb_id) in batch.items() if key not in known
        ]
        if new:
            collection.insert_many(new, ordered=False)
        added += len(new)
    removed = collection.delete_many({"listed_at": {"$lt": now - LIST_GRACE}}).deleted_count
    return {"listed": len(titles), "added": added, "removed": removed}


def reserve_due(db, count: int, now: datetime) -> list[Title]:
    """Take the titles whose recheck is due, longest due first, and make each due again a cycle later.

    The next time counts from the time the title was due, not from this run, so a
    title keeps its time of day; only a recheck more than a cycle late counts from now.
    A title on a list that was not stored for LIST_GRACE is left alone.
    """
    collection = db[COLLECTION]
    due = list(
        collection.find({"due_at": {"$lte": now}, "listed_at": {"$gte": now - LIST_GRACE}})
        .sort("due_at", 1)
        .limit(count)
    )
    for title in due:
        next_due = title["due_at"] + CYCLE
        collection.update_one(
            {"_id": title["_id"]},
            {"$set": {"due_at": next_due if next_due > now else now + CYCLE, "selected_at": now}},
        )
    return [(title["media_type"], title["tmdb_id"]) for title in due]


def main():
    pass
