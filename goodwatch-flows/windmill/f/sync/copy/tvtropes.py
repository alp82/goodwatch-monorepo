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
from f.sync.models.crate_models import (
    Movie,
    Show,
    Trope,
)
from f.sync.models.crate_schemas import SCHEMAS

BATCH_SIZE = 5000
SUB_BATCH_SIZE = 50000
HOURS_TO_FETCH = 24*2


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
    media_type: str = "movie" 
):
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_details = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    mongo_tropes = mongo_db.tv_tropes_movie_tags if is_movie else mongo_db.tv_tropes_tv_tags
    media_table_name = 'movie' if is_movie else 'show'
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}}
    total_entry_count = mongo_tropes.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} Tropes: {total_entry_count}")

    start = 0
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    
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

        tmdb_ids = [doc["tmdb_id"] for doc in tropes_batch]
        tmdb_details_by_id = fetch_documents_in_batch(
            tmdb_ids, 
            mongo_details,
        )

        for tropes_entry in tropes_batch:
            tmdb_id = tropes_entry["tmdb_id"]
            tmdb_details = tmdb_details_by_id[tmdb_id]

            if not tmdb_details:
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

    return entity_counts


def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    init_mongodb()
    connector = CrateConnector()

    results = {}

    if skip_movies:
        results["movies"] = None
    else:
        # Process movies
        if movie_ids is None or len(movie_ids) == 0:
            print("Processing all movies...")
            movie_query_selector = {}
        else:
            movie_query_selector = build_query_selector_for_object_ids(ids=movie_ids)
        
        results["movies"] = copy_media(
            connector=connector, 
            query_selector={ "tropes": { "$ne": None }} | movie_query_selector,
            media_type="movie"
        )
    
    # Process shows
    if show_ids is None or len(show_ids) == 0:
        print("\nProcessing all shows...")
        show_query_selector = {}
    else:
        show_query_selector = build_query_selector_for_object_ids(ids=show_ids)
    
    results["shows"] = copy_media(
        connector=connector, 
        query_selector={ "tropes": { "$ne": None }} | show_query_selector,
        media_type="show"
    )

    connector.disconnect()
    close_mongodb()
    
    return results


if __name__ == "__main__":
    main()