from mongoengine import get_db

from f.db.arango import ArangoConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import (
    Movie,
)

BATCH_SIZE = 50000


def copy_media(
    connector: ArangoConnector, 
    query_selector: dict = {},
):
    mongo_db = get_db()

    mongo_collection = mongo_db.tmdb_daily_dump_data
    media_collection_name = COLLECTIONS['movies']
    MediaClass = Movie

    start = 0
    entity_counts = {"created": 0, "updated": 0, "ignored": 0}
    edge_counts = {"created": 0, "updated": 0, "ignored": 0}
    
    while True:
        media_documents = []
        
        tmdb_details_batch = list(
            #mongo_collection.find({"tmdb_id": {"$lt": 1000}})
            mongo_collection.find(query_selector)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not tmdb_details_batch:
            break

        for tmdb_details in tmdb_details_batch:
            tmdb_id = tmdb_details["tmdb_id"]
            media_key = str(tmdb_id)

            original_title = tmdb_details.get("original_title")
            if not original_title:
                continue
            
            # Create Media document
            media = MediaClass(
                _key=media_key, 
                tmdb_id=tmdb_id,
                original_title=original_title,
                popularity=tmdb_details.get("popularity"),
                adult=tmdb_details.get("adult"),
            )

            # add movie/show to batch and continue with next entry
            media_documents.append(media)
            

        # Insert batch of media
        print(f"\nExecuting batch from {start} to {start + len(media_documents)} entries")
        
        media_for_upsert = []
        for media_item in media_documents: 
            media_dict = media_item.model_dump(
                by_alias=True, 
                exclude_none=True,
            )
            cleaned_media_instance = MediaClass(**media_dict)
            media_for_upsert.append(cleaned_media_instance)
        
        upsert_result = connector.upsert_many(
            connector.db.collection(COLLECTIONS[media_collection_name]),
            media_for_upsert
        )
        
        # Track media counts
        entity_counts["created"] += upsert_result["created"]
        entity_counts["updated"] += upsert_result["updated"]
        entity_counts["ignored"] += upsert_result["ignored"]
        
        start += BATCH_SIZE

    return {
        "entity_counts": dict(entity_counts),
        "edge_counts": dict(edge_counts),
    }


def print_summary(results):
    """Print a comprehensive summary of all entities and edges created/updated."""
    print("\n" + "="*25)
    print("MIGRATION SUMMARY")
    print("="*25)
    
    movie_results = results
    entity_counts = movie_results.get("entity_counts", {})
    entity_type = "entries"
    
    print("\n📊 TMDB DAILY:")
    print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
    if any(entity_counts.values()):  # Only show if there are any counts
        print(f"  {entity_type.replace('_', ' ').title():<35} | "
                f"Created: {entity_counts['created']:>9,} | "
                f"Updated: {entity_counts['updated']:>9,} | "
                f"Ignored: {entity_counts['ignored']:>9,}")
    print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
    

def main(movie_ids: list[str] = []):
    init_mongodb()

    connector = ArangoConnector()

    if movie_ids is None or len(movie_ids) == 0:
        print("Processing all daily media entries...")
        movie_query_selector = {}
    else:
        movie_query_selector = build_query_selector_for_object_ids(ids=movie_ids)
    
    results = copy_media(
        connector=connector, 
        query_selector=movie_query_selector,
    )

    connector.close()
    close_mongodb()
    
    print_summary(results)
    return results


if __name__ == "__main__":
    main()
