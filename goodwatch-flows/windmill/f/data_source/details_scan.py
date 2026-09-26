"""Bounded full reads of the TMDB details collections.

tmdb_movie_details is larger than the Mongo hosts' RAM. A filtered count or a
skip/limit page over it walks every document in one operation, which outlasts
the driver's socket timeout. Reads here only walk the `_id` index from the
previous batch, so each one touches at most `batch_size` documents.
"""
from typing import Iterator

from pymongo import UpdateOne
from pymongo.collection import Collection

SCAN_BATCH_SIZE = 2000


def scan_by_id(collection: Collection, projection: dict, batch_size: int | None = None) -> Iterator[list[dict]]:
    """Yield every document in `_id` order as lists of at most `batch_size`.

    Callers filter in Python: a predicate on an unindexed field would let a
    single read scan the whole collection looking for matches.
    """
    batch_size = batch_size or SCAN_BATCH_SIZE
    fields = {**projection, "_id": 1}
    last_id = None
    while True:
        query = {} if last_id is None else {"_id": {"$gt": last_id}}
        batch = list(collection.find(query, fields).sort("_id", 1).limit(batch_size).hint([("_id", 1)]))
        if batch:
            yield batch
        if len(batch) < batch_size:
            return
        last_id = batch[-1]["_id"]


def is_listed(details: dict) -> bool:
    """False for titles TMDB removed; a missing flag means not deleted."""
    return details.get("tmdb_deleted") is not True


def upsert_batch(collection: Collection, operations: list[UpdateOne]) -> int:
    """Write one batch of upserts and return how many documents were new."""
    if not operations:
        return 0
    return collection.bulk_write(operations, ordered=False).upserted_count


def main():
    pass
