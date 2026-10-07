"""Publish the streaming aggregate and the Qdrant point of listed titles that stream nowhere (#386).

The streaming copy (f/sync/copy/tmdb_streaming) used to leave the Crate aggregate NULL for a
title whose TMDB provider check found no country, and the fingerprint copy
(f/sync/copy/vector_data) leaves out a title without a published aggregate. The scheduled
copies repair such a title only when TMDB details are fetched for it again, up to 30 days
later. This script does it now for the listed TMDB ids, through the copies' own functions and
under their publication leases: first the streaming copy, then the fingerprint copy.

Of the listed titles it publishes only those that are not deleted on TMDB, have a Crate row,
have a NULL aggregate there and pass the streaming copy's own test (a proven provider check
without a country, younger than 30 days, and no country scrape). The fingerprint copy then runs
for these and for listed titles whose aggregate is already published, so a second run finishes
what a failed one left. It writes a point only for a title with a fingerprint.

It needs the workspace's Mongo, Crate and Qdrant variables, so run it as a Windmill preview job
(path under `f/`, see the windmill-api-access notes) after tmdb_streaming is deployed.
`dry_run` only reads and counts. `carried` adds the titles the scheduled fingerprint copy
selected and left out for their streaming, which it keeps in `sync_state`. `limit` keeps a run
to the first ids of each media type.
"""
import sys
import time
from collections import Counter
from pathlib import Path

# Local runs import the Windmill modules from the repo; a Windmill job already has them.
_WINDMILL_DIR = Path(__file__).resolve().parents[1] / "windmill"
if _WINDMILL_DIR.is_dir():
    sys.path.insert(0, str(_WINDMILL_DIR))

from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import close_mongodb, init_mongodb
from f.db.qdrant import QdrantConnector
from f.sync.copy.deleted_titles import flagged_among
from f.sync.copy import sync_state
from f.sync.copy.qdrant_retry import REQUEST_TIMEOUT_SECONDS
from f.sync.copy.tmdb_streaming import (
    checked_without_offers, copy_media, fetch_all_documents_in_batch, fetch_documents_in_batch,
)
from f.sync.copy.vector_data import SYNC_JOB, copy_to_qdrant

# The streaming copy publishes a listed title on its own, with several Crate requests each.
BATCH_SIZE = 100
PAUSE_SECONDS = 2
PUBLISH = "to publish"
PUBLISHED = "aggregate already published"


def classify(connector, mongo_db, media_type: str, tmdb_ids: list[int]) -> dict[int, str]:
    """What the script does with each listed title, from the current Mongo and Crate state."""
    is_movie = media_type == "movie"
    details_collection = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    details = fetch_documents_in_batch(tmdb_ids, details_collection)
    providers = fetch_all_documents_in_batch(
        tmdb_ids, mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers)
    flagged = flagged_among(details_collection, tmdb_ids)
    aggregates = {row["tmdb_id"]: row["streaming_availabilities"] for row in connector.select(
        f"SELECT tmdb_id, streaming_availabilities FROM {media_type} WHERE tmdb_id = ANY(?)", (tmdb_ids,))}
    states = {}
    for tmdb_id in tmdb_ids:
        if tmdb_id not in details:
            states[tmdb_id] = "no details in Mongo"
        elif tmdb_id in flagged:
            states[tmdb_id] = "deleted on TMDB"
        elif tmdb_id not in aggregates:
            states[tmdb_id] = "no Crate row"
        elif aggregates[tmdb_id] is not None:
            states[tmdb_id] = PUBLISHED
        elif not checked_without_offers(details[tmdb_id], providers.get(tmdb_id, [])):
            states[tmdb_id] = "unknown availability"
        else:
            states[tmdb_id] = PUBLISH
    return states


def carried_ids(mongo_db, media_type: str) -> list[int]:
    state = mongo_db[sync_state.STATE].find_one({"_id": sync_state.state_id(SYNC_JOB, media_type)}) or {}
    return state.get("carried_ids") or []


def main(movie_ids: list[int] = [], show_ids: list[int] = [], dry_run: bool = True, carried: bool = False,
         limit: int = 0):
    init_mongodb()
    connector = CrateConnector()
    qdrant = None if dry_run else QdrantConnector(timeout=REQUEST_TIMEOUT_SECONDS)
    mongo_db = get_db()
    result = {"dry_run": dry_run}
    try:
        for media_type, listed in (("movie", movie_ids), ("show", show_ids)):
            listed = list(listed or []) + (carried_ids(mongo_db, media_type) if carried else [])
            tmdb_ids = sorted({int(tmdb_id) for tmdb_id in listed})
            tmdb_ids = tmdb_ids[:limit] if limit else tmdb_ids
            totals = Counter()
            for start in range(0, len(tmdb_ids), BATCH_SIZE):
                states = classify(connector, mongo_db, media_type, tmdb_ids[start:start + BATCH_SIZE])
                totals.update(states.values())
                publish = [tmdb_id for tmdb_id, state in states.items() if state == PUBLISH]
                points = publish + [tmdb_id for tmdb_id, state in states.items() if state == PUBLISHED]
                if not dry_run:
                    if publish:
                        copied = copy_media(connector, {"tmdb_id": {"$in": publish}}, media_type, recent_only=False)
                        totals["aggregates written"] += copied.get(f"{media_type}s", {}).get("rows_upserted", 0)
                    if points:
                        copied = copy_to_qdrant(qdrant, media_type, {"tmdb_id": {"$in": points}}, recent_only=False)
                        totals["points written"] += copied["upserts"]
                        totals["points left out, no published streaming"] += copied["skipped_unknown_streaming"]
                print(f"{media_type} through tmdb_id {tmdb_ids[min(start + BATCH_SIZE, len(tmdb_ids)) - 1]}: "
                      f"{dict(totals)}", flush=True)
                time.sleep(PAUSE_SECONDS)
            result[media_type] = {"listed": len(tmdb_ids)} | dict(totals)
        return result
    finally:
        connector.disconnect()
        if qdrant is not None:
            qdrant.close()
        close_mongodb()


if __name__ == "__main__":
    print(main())
