from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from mongoengine import get_db
from pydantic import BaseModel

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.sync.copy import sync_state
from f.sync.copy.deleted_titles import flagged_among
from f.sync.models.crate_models import (
    Movie,
    Show,
    Trope,
)
from f.sync.models.crate_schemas import SCHEMAS

BATCH_SIZE = 5000
SUB_BATCH_SIZE = 50000
# Window of a recent copy restricted by a selector. A scheduled run reads from its last
# successful run instead (f/sync/copy/sync_state), and carries a title it left out as
# deleted on TMDB for as long as this window would have selected it again.
HOURS_TO_FETCH = 24*2
SYNC_JOB = "tvtropes"


# ===== Helper Functions =====

def to_timestamp(dt_input: str) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, datetime):
        return dt_input.timestamp()
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%dT%H:%M:%S.%fZ')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S.%f')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S UTC')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d')
            return dt.timestamp()
        except Exception:
            pass

        raise Exception(f"cannot convert datetime to timestamp: {dt_input}")
        

def fetch_documents_in_batch(tmdb_ids, collection):
    projection = {
        "tmdb_id": 1,
    }
    return {
        doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}, projection)
    }


def fetch_all_documents_in_batch(tmdb_ids, collection):
    results = defaultdict(list)
    for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}):
        if doc.get('created_at') and doc.get('updated_at'):
            results[doc["tmdb_id"]].append(doc)
    return dict(results)


def upsert_in_batches(connector: CrateConnector, table: str, records: list[BaseModel]):
    """Process and insert entities and return upsert results."""
    total_result = {"records_received": 0, "rows_upserted": 0}
    
    if records:
        print(f"    Upserting {len(records)} of type {table}")
        for i in range(0, len(records), SUB_BATCH_SIZE):
            batch = records[i:i + SUB_BATCH_SIZE]
            if batch:
                result = connector.upsert_many(
                    table=table,
                    records=batch,
                    conflict_columns=SCHEMAS[table]["primary_key"],
                    silent=True,
                )
                total_result["records_received"] += result["records_received"]
                total_result["rows_upserted"] += result["rows_upserted"]
    
    return total_result

def copy_media(
    connector: CrateConnector, 
    query_selector: dict = {},
    media_type: str = "movie",
    *, recent_only: bool = True,
):
    """Copy the tropes that match the selector to CrateDB.

    A recent copy takes the tropes changed in the last HOURS_TO_FETCH hours. With
    recent_only=False it takes every title. The scheduled run uses copy_changes.
    """
    entity_counts, _ = copy_changes(connector, query_selector, media_type, recent_only=recent_only)
    return entity_counts


def copy_changes(
    connector: CrateConnector,
    query_selector: dict = {},
    media_type: str = "movie",
    *, recent_only: bool = True,
    since: Optional[datetime] = None,
    carried_ids=(),
    retry_flagged_since: Optional[datetime] = None,
):
    """Copy the tropes that match the selector and return (counts, ids to carry).

    A recent copy takes the tropes changed since `since`, by default in the last
    HOURS_TO_FETCH hours, and the `carried_ids` of an earlier run.

    A title flagged as deleted on TMDB is left out. Nothing selects its tropes again when
    the flag is taken back, so it is returned to be carried while its tropes changed at or
    after `retry_flagged_since`. A title without a details document fails the copy.
    """
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_details = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    mongo_tropes = mongo_db.tv_tropes_movie_tags if is_movie else mongo_db.tv_tropes_tv_tags
    media_table_name = 'movie' if is_movie else 'show'
    MediaClass = Movie if is_movie else Show

    carried_set = set(carried_ids)
    carried = sorted(carried_set)
    updated_at_filter = {"updated_at": {"$gte": since or datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}}
    if not recent_only:
        updated_at_filter = {}
    elif carried:
        # The carried titles are read beside the changed ones; the selector applies to both.
        updated_at_filter = {"$or": [updated_at_filter, {"tmdb_id": {"$in": carried}}]}
    total_entry_count = mongo_tropes.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} Tropes: {total_entry_count}")

    start = 0
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    selected = 0
    skipped_flagged = 0
    carried_written = 0
    carry_ids = set()

    while True:
        media_documents = []
        entity_batches = defaultdict(list)

        tropes_batch = list(
            mongo_tropes.find(query_selector | updated_at_filter)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not tropes_batch:
            break

        # Insert batch of media
        print(f"\nBatch from {start} to {start + len(tropes_batch)} {media_type} Tropes")

        selected += len(tropes_batch)
        tmdb_ids = [doc["tmdb_id"] for doc in tropes_batch]
        # Do not re-insert derived rows for titles deleted on TMDB.
        flagged_ids = flagged_among(mongo_details, tmdb_ids)
        tmdb_details_by_id = fetch_documents_in_batch(
            tmdb_ids, 
            mongo_details,
        )

        for tropes_entry in tropes_batch:
            tmdb_id = tropes_entry["tmdb_id"]
            tmdb_details = tmdb_details_by_id[tmdb_id]

            if not tmdb_details or tmdb_id in flagged_ids:
                skipped_flagged += 1
                changed_at = tropes_entry.get("updated_at")
                if retry_flagged_since and isinstance(changed_at, datetime) and changed_at >= retry_flagged_since:
                    carry_ids.add(tmdb_id)
                continue
     
            tropes = tropes_entry.get("tropes", [])

            # Create Media document
            media = MediaClass(
                tmdb_id=tmdb_id,

                tropes=[trope.get("name") for trope in tropes if trope.get("name")],
            
                # Metadata timestamps
                tvtropes_tags_created_at=to_timestamp(tropes_entry["created_at"]),
                tvtropes_tags_updated_at=to_timestamp(tropes_entry["updated_at"]),
            )

            # Process tropes
            trope_names = set()
            for trope in tropes:
                trope_name = trope.get("name")
                if trope_name and trope_name not in trope_names:
                    trope_names.add(trope_name)
                    entity_batches['trope'].append(Trope(
                        media_tmdb_id=tmdb_id,
                        media_type=media_type,
                        name=trope_name,
                        url=trope.get("url"),
                        content=trope.get("html"),
                    ))

            media_documents.append(media)

        carried_written += sum(1 for media in media_documents if media.tmdb_id in carried_set)
        upsert_result = upsert_in_batches(
            connector=connector,
            table=media_table_name,
            records=media_documents,
        )
        
        media_type_key = 'movies' if is_movie else 'shows'
        entity_counts[media_type_key]["records_received"] += upsert_result["records_received"]
        entity_counts[media_type_key]["rows_upserted"] += upsert_result["rows_upserted"]
        
        # Insert all row for batch and track counts
        for table_name, batch in entity_batches.items():
            entity_upsert_result = upsert_in_batches(
                connector=connector,
                table=table_name,
                records=batch, 
            )
            entity_counts[table_name]["records_received"] += entity_upsert_result["records_received"]
            entity_counts[table_name]["rows_upserted"] += entity_upsert_result["rows_upserted"]

        start += BATCH_SIZE

    entity_counts["selected"] = selected
    entity_counts["skipped_flagged"] = skipped_flagged
    entity_counts["carried"] = len(carried)
    entity_counts["carried_written"] = carried_written
    return entity_counts, sorted(carry_ids)


def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    """Copy the tropes changed since the last successful run, per media type."""
    init_mongodb()
    connector = CrateConnector()

    results = {}
    try:
        for key, media_type, ids in (("movies", "movie", movie_ids), ("shows", "show", show_ids)):
            if media_type == "movie" and skip_movies:
                results[key] = None
                continue
            if ids:
                query_selector = build_query_selector_for_object_ids(ids=ids)
            else:
                print(f"\nProcessing all {key}...", flush=True)
                query_selector = {}

            # A media type restricted to ids doesn't cover every change, so it keeps the
            # fixed window and leaves the sync state alone.
            selection = None if ids else sync_state.begin(get_db(), SYNC_JOB, media_type)
            results[key], carry_ids = copy_changes(
                connector=connector,
                query_selector={ "tropes": { "$ne": None }} | query_selector,
                media_type=media_type,
                since=selection.since if selection else None,
                carried_ids=selection.carried_ids if selection else (),
                retry_flagged_since=(
                    selection.started_at - timedelta(hours=HOURS_TO_FETCH) if selection else None),
            )
            if selection:
                # Reached only when the whole media type succeeded: a failure raises above,
                # and the next run reads the same changes again. A carried title that was
                # written, lost its tropes or changed too long ago is not among carry_ids.
                sync_state.commit(get_db(), selection, {
                    **{count: results[key][count]
                       for count in ("selected", "skipped_flagged", "carried", "carried_written")},
                    **results[key].get(key, {"records_received": 0, "rows_upserted": 0}),
                }, carried_ids=carry_ids)
                results[key]["selection"] = selection.report()
    finally:
        connector.disconnect()
        close_mongodb()

    return results


if __name__ == "__main__":
    main()