from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
)
from f.sync.models.crate_models import Movie, Show

BATCH_SIZE = 50000


def copy_media(
    connector: CrateConnector, 
    query_selector: dict = {},
):
    mongo_db = get_db()
    mongo_collection = mongo_db.tmdb_daily_dump_data

    start = 0
    movie_counts = {"records_received": 0, "rows_upserted": 0}
    show_counts = {"records_received": 0, "rows_upserted": 0}
    
    while True:
        movies = []
        shows = []
        
        tmdb_details_batch = list(
            #mongo_collection.find({"tmdb_id": {"$lt": 1000}})
            mongo_collection.find(query_selector)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not tmdb_details_batch:
            break

        # Insert batch of media
        print(f"\nBatch from {start} to {start + len(tmdb_details_batch)} TMDB daily entries")

        for tmdb_details in tmdb_details_batch:
            tmdb_id = tmdb_details["tmdb_id"]
            media_type = "movie" if tmdb_details["type"] == "movie" else "show"

            original_title = tmdb_details.get("original_title")
            if not original_title:
                continue
            
            if media_type == "movie":
                movie = Movie(
                    tmdb_id=tmdb_id,
                    original_title=original_title,
                    popularity=tmdb_details.get("popularity"),
                    adult=tmdb_details.get("adult"),
                )
                movies.append(movie)
            else:            
                show = Show(
                    tmdb_id=tmdb_id,
                    original_title=original_title,
                    popularity=tmdb_details.get("popularity"),
                    adult=tmdb_details.get("adult"),
                )
                shows.append(show)

        upsert_affected_rows = connector.upsert_many(
            table="movie",
            records=movies,
            conflict_columns=["tmdb_id"],
        )
        movie_counts["records_received"] += upsert_affected_rows["records_received"]
        movie_counts["rows_upserted"] += upsert_affected_rows["rows_upserted"]

        upsert_affected_rows = connector.upsert_many(
            table="show",
            records=shows,
            conflict_columns=["tmdb_id"],
        )
        show_counts["records_received"] += upsert_affected_rows["records_received"]
        show_counts["rows_upserted"] += upsert_affected_rows["rows_upserted"]

        start += BATCH_SIZE

    return {
        "movie_counts": movie_counts,
        "show_counts": show_counts,
    }


def main():
    init_mongodb()

    connector = CrateConnector()

    print("Processing all daily media entries...")
    query_selector = {}
    
    results = copy_media(
        connector=connector, 
        query_selector=query_selector,
    )

    connector.disconnect()
    close_mongodb()
    
    return results
