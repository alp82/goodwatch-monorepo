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
    StreamingAvailability,
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
        "watch_providers": 1,
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
    mongo_providers = mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers
    media_table_name = 'movie' if is_movie else 'show'
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}}
    total_entry_count = mongo_providers.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} streaming entries: {total_entry_count}")

    streaming_services = connector.select("SELECT tmdb_id, name FROM streaming_service")
    streaming_service_id_by_name = {
        streaming_service["name"]: streaming_service["tmdb_id"]
        for streaming_service in streaming_services
    }

    start = 0
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    
    while True:
        media_documents = []
        entity_batches = defaultdict(list)

        pipeline = [{
            "$match": query_selector | updated_at_filter
        }, {
            "$group": {
                "_id": "$tmdb_id",
            }
        }, {
            "$sort": {
                "_id": 1
            }
        }, {
            "$skip": start
        }, {
            "$limit": BATCH_SIZE
        }]

        # Execute the aggregation pipeline
        tmdb_provider_ids_batch = list(mongo_providers.aggregate(pipeline))
        if not tmdb_provider_ids_batch:
            break

        # Insert batch of media
        print(f"\nBatch from {start} to {start + len(tmdb_provider_ids_batch)} {media_type} streaming entries")

        tmdb_ids = [doc["_id"] for doc in tmdb_provider_ids_batch]
        tmdb_details_by_id = fetch_documents_in_batch(
            tmdb_ids, 
            mongo_details,
        )
        tmdb_all_providers = fetch_all_documents_in_batch(
            tmdb_ids, 
            mongo_providers,
        )

        for tmdb_id, tmdb_details in tmdb_details_by_id.items():
            media_id = str(tmdb_id)
            tmdb_provider_results = tmdb_all_providers[tmdb_id]

            if not tmdb_details and not tmdb_provider_results:
                continue
            
            latest_created_at = max(tmdb_provider_results, key=lambda provider: provider['created_at'])['created_at']
            latest_updated_at = max(tmdb_provider_results, key=lambda provider: provider['updated_at'])['updated_at']

            # Process streaming availability
            streaming_availabilities_to_add = {}
            watch_provider_results = tmdb_details.get("watch_providers", {}).get("results", {})
            if watch_provider_results:
                for country_code, streaming_data in watch_provider_results.items():
                    link = streaming_data.pop("link")
                    if link:
                        for streaming_type, streaming_list in streaming_data.items():
                            for streaming in streaming_list:
                                streaming_service_id = streaming.get("provider_id")
                                streaming_service_key = str(streaming_service_id)
                                streaming_key = f"{media_id}_{country_code}_{streaming_type}_{streaming_service_key}"
                                streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                    media_tmdb_id=media_id,
                                    media_type=media_type,
                                    country_code=country_code,
                                    streaming_type=streaming_type,
                                    streaming_service_id=streaming_service_id,
                                    display_priority=streaming.get("display_priority"),
                                    tmdb_link=link,
                                )
        
            for tmdb_streaming_provider in tmdb_provider_results:
                country_code = tmdb_streaming_provider.get("country_code")
                for streaming_link in tmdb_streaming_provider.get("streaming_links", []):
                    streaming_service_id = streaming_service_id_by_name.get(streaming_link["provider_name"])
                    if streaming_service_id:
                        streaming_type = streaming_link["stream_type"]
                        streaming_key = f"{media_id}_{country_code}_{streaming_type}_{streaming_service_id}"
                        if streaming_key not in streaming_availabilities_to_add.keys():
                            streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                media_tmdb_id=media_id,
                                media_type=media_type,
                                country_code=country_code,
                                streaming_type=streaming_type,
                                streaming_service_id=streaming_service_id,
                                stream_url=streaming_link.get("stream_url"),
                                price_dollar=streaming_link.get("price_dollar"),
                                quality=streaming_link.get("quality"),
                            )
                        else:
                            streaming_availabilities_to_add[streaming_key].stream_url = streaming_link.get("stream_url")
                            streaming_availabilities_to_add[streaming_key].price_dollar = streaming_link.get("price_dollar")
                            streaming_availabilities_to_add[streaming_key].quality = streaming_link.get("quality")

            streaming_availability_countries = []
            streaming_availability_services = []
            streaming_availability_combos = []
            for streaming_key, streaming_availability in streaming_availabilities_to_add.items():
                entity_batches['streaming_availability'].append(streaming_availability)
                if streaming_availability.country_code not in streaming_availability_countries:
                    streaming_availability_countries.append(streaming_availability.country_code)
                if streaming_availability.streaming_service_id not in streaming_availability_services:
                    streaming_availability_services.append(streaming_availability.streaming_service_id)
                combo = f"{streaming_availability.country_code}_{streaming_availability.streaming_service_id}"
                if combo not in streaming_availability_combos:
                    streaming_availability_combos.append(combo)

            # Create Media document
            media = MediaClass(
                tmdb_id=tmdb_id,

                # Streaming
                streaming_country_codes=streaming_availability_countries,
                streaming_service_ids=streaming_availability_services,
                streaming_availabilities=streaming_availability_combos,
            
                # Metadata timestamps
                tmdb_providers_created_at=to_timestamp(latest_created_at),
                tmdb_providers_updated_at=to_timestamp(latest_updated_at),
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