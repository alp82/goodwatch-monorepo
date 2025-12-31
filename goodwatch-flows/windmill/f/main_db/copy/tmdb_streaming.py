from collections import defaultdict
from datetime import datetime, timedelta
import gc
from typing import Optional

from mongoengine import get_db

from f.db.arango import ArangoConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.main_db.config.graph import COLLECTIONS, EDGES
from f.main_db.models.arango import (
    BaseArangoModel,
    Edge,
    Movie,
    Show,
    StreamingAvailability,
)

BATCH_SIZE = 1000
SUB_BATCH_SIZE = 5000


# TODO: remove or flag obsolete documents and edges


# ===== Helper Functions =====

def to_timestamp(dt_input) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%dT%H:%M:%S.%fZ')
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


def fetch_documents_in_batch(tmdb_ids, collection):
    projection = {
        "watch_providers": 1,
    }
    return {
        doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}, projection)
    }


def process_and_insert_entities(entities_to_process: list[BaseArangoModel], connector: ArangoConnector, collection, entity_type: str):
    """Process and insert entities and return upsert results."""
    total_result = {"created": 0, "updated": 0, "ignored": 0}
    
    if entities_to_process:
        print(f"    Upserting {len(entities_to_process)} {entity_type}")
        for i in range(0, len(entities_to_process), SUB_BATCH_SIZE):
            sub_batch = entities_to_process[i:i + SUB_BATCH_SIZE]
            if sub_batch:
                result = connector.upsert_many(collection, sub_batch)
                total_result["created"] += result["created"]
                total_result["updated"] += result["updated"]
                total_result["ignored"] += result["ignored"]
    
    return total_result


def copy_media(
    connector: ArangoConnector, 
    query_selector: dict = {},
    media_type: str = "movie" 
):
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_collection = mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers
    media_collection_name = COLLECTIONS['movies'] if is_movie else COLLECTIONS['shows']
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=24 * 7)}}
    total_entry_count = mongo_collection.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} entries: {total_entry_count}")

    collections = {}
    for name, collection_name_val in COLLECTIONS.items():
        collections[name] = connector.db.collection(collection_name_val)
    
    edge_collections = {}
    for edge_name, edge_config in EDGES.items():
        edge_collections[edge_name] = connector.db.collection(edge_config['name'])

    streaming_services = collections["streaming_services"].all()
    streaming_service_id_by_name = {
        streaming_service["name"]: streaming_service["tmdb_id"]
        for streaming_service in streaming_services
    }

    start = 0
    entity_counts = defaultdict(lambda: {"created": 0, "updated": 0, "ignored": 0})
    edge_counts = defaultdict(lambda: {"created": 0, "updated": 0, "ignored": 0})
    
    while True:
        media_documents = []
        entity_batches = defaultdict(list)
        edge_batches = defaultdict(list)

        pipeline = [{
            "$match": query_selector | updated_at_filter
        }, {
            "$group": {
                "_id": "$tmdb_id",
                "results": {
                    "$push": "$$ROOT"
                }
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
        tmdb_providers_batch = list(mongo_collection.aggregate(pipeline))
        if not tmdb_providers_batch:
            break

        tmdb_ids = [doc["_id"] for doc in tmdb_providers_batch]
        tmdb_details_by_id = fetch_documents_in_batch(
            tmdb_ids, 
            mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers,
        )

        for tmdb_providers in tmdb_providers_batch:
            tmdb_id = tmdb_providers["_id"]
            media_key = str(tmdb_id)

            if not tmdb_providers['results']:
                continue

            earliest_created_at = min(tmdb_providers['results'], key=lambda provider: provider['created_at'])
            earliest_updated_at = min(tmdb_providers['results'], key=lambda provider: provider['updated_at'])

            # Streaming availability
            streaming_availabilities_to_add = {}
            tmdb_details = tmdb_details_by_id[tmdb_id]
            watch_provider_results = tmdb_details.get("watch_providers", {}).get("results", {})
            if watch_provider_results:
                for country_code, streaming_data in watch_provider_results.items():
                    link = streaming_data.pop("link")
                    if link:
                        for streaming_type, streaming_list in streaming_data.items():
                            for streaming in streaming_list:
                                streaming_service_id = streaming.get("provider_id")
                                streaming_service_key = str(streaming_service_id)
                                streaming_key = f"{media_key}_{country_code}_{streaming_type}_{streaming_service_key}"
                                streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                    _key=streaming_key, 
                                    country_code=country_code,
                                    streaming_type=streaming_type,
                                    streaming_service_id=streaming_service_id,
                                    display_priority=streaming.get("display_priority"),
                                    tmdb_link=link,
                                )
        
            tmdb_streaming_providers = tmdb_providers["results"]
            for tmdb_streaming_provider in tmdb_streaming_providers:
                country_code = tmdb_streaming_provider.get("country_code")
                for streaming_link in tmdb_streaming_provider.get("streaming_links", []):
                    streaming_service_id = streaming_service_id_by_name.get(streaming_link["provider_name"])
                    if streaming_service_id:
                        streaming_type = streaming_link["stream_type"]
                        streaming_key = f"{media_key}_{country_code}_{streaming_type}_{streaming_service_id}"
                        if streaming_key not in streaming_availabilities_to_add.keys():
                            streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                _key=streaming_key, 
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
                entity_batches['streaming_availabilities'].append(streaming_availability)
                edge_batches['streaming_availability_for'].append({
                    '_from': f"{media_collection_name}/{media_key}",
                    '_to': f"{COLLECTIONS['streaming_availabilities']}/{streaming_key}"
                })
                if streaming_availability.country_code not in streaming_availability_countries:
                    streaming_availability_countries.append(streaming_availability.country_code)
                    edge_batches['streaming_availability_in_country'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['countries']}/{streaming_availability.country_code}"
                    })
                if streaming_availability.streaming_service_id not in streaming_availability_services:
                    streaming_availability_services.append(streaming_availability.streaming_service_id)
                    edge_batches['streaming_service_is_available_for'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['streaming_services']}/{streaming_availability.streaming_service_id}"
                    })
                combo = f"{streaming_availability.country_code}_{streaming_availability.streaming_service_id}"
                if combo not in streaming_availability_combos:
                    streaming_availability_combos.append(combo)
            
            # Create Media document
            media = MediaClass(
                _key=media_key, 
                tmdb_id=tmdb_id,

                # Streaming
                streaming_country_codes=streaming_availability_countries,
                streaming_service_ids=streaming_availability_services,
                streaming_availabilities=streaming_availability_combos,
            
                # Metadata timestamps
                tmdb_providers_created_at=to_timestamp(earliest_created_at),
                tmdb_providers_updated_at=to_timestamp(earliest_updated_at),
            )

            # add movie/show to batch and continue with next entry
            media_documents.append(media)
            
        # Insert batch of media
        print(f"\nExecuting batch from {start} to {start + len(media_documents)} {media_type}s")
        
        media_for_upsert = []
        for media_item in media_documents: 
            media_dict = media_item.model_dump(
                by_alias=True, 
                exclude_none=True,
            )
            cleaned_media_instance = MediaClass(**media_dict)
            media_for_upsert.append(cleaned_media_instance)
        
        upsert_result = connector.upsert_many(
            collections[media_collection_name],
            media_for_upsert
        )
        
        # Track media counts
        media_type_key = 'movies' if is_movie else 'shows'
        entity_counts[media_type_key]["created"] += upsert_result["created"]
        entity_counts[media_type_key]["updated"] += upsert_result["updated"]
        entity_counts[media_type_key]["ignored"] += upsert_result["ignored"]
        
        # Insert all documents for batch and track counts
        print(f"\n  Upserting entities for {media_type}s:")
        for name, batch in entity_batches.items():
            result = process_and_insert_entities(
                batch, 
                connector,
                collections[name], 
                name.replace('_', ' '), 
            )
            # Accumulate node counts
            entity_counts[name]["created"] += result["created"]
            entity_counts[name]["updated"] += result["updated"]
            entity_counts[name]["ignored"] += result["ignored"]

        # Insert edges for batch and track counts
        print(f"\n  Upserting edges for {media_type}s:")
        for edge_type, edges_list in edge_batches.items():
            batch = [Edge(**edge_dict) for edge_dict in edges_list]
            result = process_and_insert_entities(
                batch,
                connector,
                edge_collections[edge_type],
                edge_type.replace('_', ' ')
            )
            # Accumulate edge counts
            edge_counts[edge_type]["created"] += result["created"]
            edge_counts[edge_type]["updated"] += result["updated"]
            edge_counts[edge_type]["ignored"] += result["ignored"]
        
        del tmdb_providers_batch
        del media_documents
        del entity_batches
        del edge_batches
        del media_for_upsert
        gc.collect()

        start += BATCH_SIZE

    return {
        "entity_counts": dict(entity_counts),
        "edge_counts": dict(edge_counts),
    }


def print_summary(results):
    """Print a comprehensive summary of all entities and edges created/updated."""
    print("\n" + "="*80)
    print("MIGRATION SUMMARY")
    print("="*80)
    
    if results.get("movies"):
        print("\n🎬 MOVIES MIGRATION:")
        movie_results = results["movies"]
        
        # Entity summary
        print("\n📊 ENTITIES:")
        entity_counts = movie_results.get("entity_counts", {})
        total_entities = {"created": 0, "updated": 0, "ignored": 0}
        
        for entity_type, counts in sorted(entity_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {entity_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_entities["created"] += counts["created"]
                total_entities["updated"] += counts["updated"]
                total_entities["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL ENTITIES':<35} | "
              f"Created: {total_entities['created']:>9,} | "
              f"Updated: {total_entities['updated']:>9,} | "
              f"Ignored: {total_entities['ignored']:>9,}")
        
        # Edge summary
        print("\n🔗 EDGES:")
        edge_counts = movie_results.get("edge_counts", {})
        total_edges = {"created": 0, "updated": 0, "ignored": 0}
        
        for edge_type, counts in sorted(edge_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {edge_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_edges["created"] += counts["created"]
                total_edges["updated"] += counts["updated"]
                total_edges["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL EDGES':<35} | "
              f"Created: {total_edges['created']:>9,} | "
              f"Updated: {total_edges['updated']:>9,} | "
              f"Ignored: {total_edges['ignored']:>9,}")
    
    if results.get("shows"):
        print("\n\n📺 TV SHOWS MIGRATION:")
        show_results = results["shows"]
        
        # Entity summary
        print("\n📊 ENTITIES:")
        entity_counts = show_results.get("entity_counts", {})
        total_entities = {"created": 0, "updated": 0, "ignored": 0}
        
        for entity_type, counts in sorted(entity_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {entity_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_entities["created"] += counts["created"]
                total_entities["updated"] += counts["updated"]
                total_entities["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL ENTITIES':<35} | "
              f"Created: {total_entities['created']:>9,} | "
              f"Updated: {total_entities['updated']:>9,} | "
              f"Ignored: {total_entities['ignored']:>9,}")
        
        # Edge summary
        print("\n🔗 EDGES:")
        edge_counts = show_results.get("edge_counts", {})
        total_edges = {"created": 0, "updated": 0, "ignored": 0}
        
        for edge_type, counts in sorted(edge_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {edge_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_edges["created"] += counts["created"]
                total_edges["updated"] += counts["updated"]
                total_edges["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL EDGES':<35} | "
              f"Created: {total_edges['created']:>9,} | "
              f"Updated: {total_edges['updated']:>9,} | "
              f"Ignored: {total_edges['ignored']:>9,}")
    
    # Overall totals
    print("\n\n📈 OVERALL TOTALS:")
    overall_entities = {"created": 0, "updated": 0, "ignored": 0}
    overall_edges = {"created": 0, "updated": 0, "ignored": 0}
    
    for result_type in ["movies", "shows"]:
        if results.get(result_type):
            result = results[result_type]
            for counts in result.get("entity_counts", {}).values():
                overall_entities["created"] += counts["created"]
                overall_entities["updated"] += counts["updated"]
                overall_entities["ignored"] += counts["ignored"]
            
            for counts in result.get("edge_counts", {}).values():
                overall_edges["created"] += counts["created"]
                overall_edges["updated"] += counts["updated"]
                overall_edges["ignored"] += counts["ignored"]
    
    print(f"  All Entities                  | "
          f"Created: {overall_entities['created']:>9,} | "
          f"Updated: {overall_entities['updated']:>9,} | "
          f"Ignored: {overall_entities['ignored']:>9,}")
    print(f"  All Edges                     | "
          f"Created: {overall_edges['created']:>9,} | "
          f"Updated: {overall_edges['updated']:>9,} | "
          f"Ignored: {overall_edges['ignored']:>9,}")
    
    grand_total = {
        "created": overall_entities["created"] + overall_edges["created"],
        "updated": overall_entities["updated"] + overall_edges["updated"],
        "ignored": overall_entities["ignored"] + overall_edges["ignored"]
    }
    
    print(f"  {'─'*29} | {'─'*18} | {'─'*18} | {'─'*18}")
    print(f"  {'GRAND TOTAL':<29} | "
          f"Created: {grand_total['created']:>9,} | "
          f"Updated: {grand_total['updated']:>9,} | "
          f"Ignored: {grand_total['ignored']:>9,}")
    

def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    init_mongodb()

    connector = ArangoConnector()

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

    connector.close()
    close_mongodb()
    
    # Print comprehensive summary
    print_summary(results)
    
    return results


if __name__ == "__main__":
    main()