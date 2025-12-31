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
    mongo_dna = mongo_db.dna_movie if is_movie else mongo_db.dna_tv
    media_table_name = 'movie' if is_movie else 'show'
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}}
    total_entry_count = mongo_dna.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} DNA entries: {total_entry_count}")

    start = 0
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    
    while True:
        media_documents = []
        entity_batches = defaultdict(list)

        dna_data_batch = list(
            #mongo_dna.find({"tmdb_id": {"$lt": 1000}} | updated_at_filter, projection)
            mongo_dna.find(query_selector | updated_at_filter)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not dna_data_batch:
            break

        # Insert batch of media
        print(f"\nBatch from {start} to {start + len(dna_data_batch)} {media_type} DNA entries")

        tmdb_ids = [doc["tmdb_id"] for doc in dna_data_batch]
        tmdb_details_by_id = fetch_documents_in_batch(
            tmdb_ids, 
            mongo_details,
        )

        for dna_data in dna_data_batch:
            tmdb_id = dna_data["tmdb_id"]
            tmdb_details = tmdb_details_by_id[tmdb_id]

            if not tmdb_details:
                continue
     
            has_dna = "dna" in dna_data and "vector_fingerprint" in dna_data
            essence_tags = dna_data["dna"].get("essence_tags", []) if has_dna else None
            essence_text = dna_data["dna"]["essence_text"] if has_dna else None
            fingerprint = dna_data["dna"]["fingerprint"] if has_dna else None
            is_anime = dna_data["dna"]["is_anime"] if has_dna else None
            production_info = dna_data["dna"]["production_info"] if has_dna else None
            content_advisories = dna_data["dna"].get("content_advisories", []) if has_dna else None
            social_suitability = dna_data["dna"]["social_suitability"] if has_dna else None
            viewing_context = dna_data["dna"]["viewing_context"] if has_dna else None

            # Create Media document
            media = MediaClass(
                tmdb_id=tmdb_id,

                # DNA
                is_anime=is_anime,
                production_method=production_info["method"] if production_info else None,
                animation_style=production_info["animation_style"] if production_info else None,

                essence_text=essence_text,
                essence_tags=essence_tags,
                fingerprint_scores=fingerprint["scores"] if fingerprint else None,
                fingerprint_highlight_keys=fingerprint["highlight_keys"] if fingerprint else None,
                content_advisories=content_advisories,

                suitability_solo_watch=social_suitability["solo_watch"] if social_suitability else None,
                suitability_date_night=social_suitability["date_night"] if social_suitability else None,
                suitability_group_party=social_suitability["group_party"] if social_suitability else None,
                suitability_family=social_suitability["family"] if social_suitability else None,
                suitability_partner=social_suitability["partner"] if social_suitability else None,
                suitability_friends=social_suitability["friends"] if social_suitability else None,
                suitability_kids=social_suitability["kids"] if social_suitability else None,
                suitability_teens=social_suitability["teens"] if social_suitability else None,
                suitability_adults=social_suitability["adults"] if social_suitability else None,
                suitability_intergenerational=social_suitability["intergenerational"] if social_suitability else None,
                suitability_public_viewing_safe=social_suitability["public_viewing_safe"] if social_suitability else None,

                context_is_thought_provoking=viewing_context["is_thought_provoking"] if viewing_context else None,
                context_is_pure_escapism=viewing_context["is_pure_escapism"] if viewing_context else None,
                context_is_background_friendly=viewing_context["is_background_friendly"] if viewing_context else None,
                context_is_comfort_watch=viewing_context["is_comfort_watch"] if viewing_context else None,
                context_is_binge_friendly=viewing_context["is_binge_friendly"] if viewing_context else None,
                context_is_drop_in_friendly=viewing_context["is_drop_in_friendly"] if viewing_context else None,
            
                # Metadata timestamps
                dna_created_at=to_timestamp(dna_data["created_at"]),
                dna_updated_at=to_timestamp(dna_data["updated_at"]),
            )

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
            query_selector=movie_query_selector,
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
        query_selector=show_query_selector,
        media_type="show"
    )

    connector.disconnect()
    close_mongodb()
    
    return results


if __name__ == "__main__":
    main()