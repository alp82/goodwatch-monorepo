from datetime import datetime

from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection

from f.db.mongodb import init_mongodb, close_mongodb

BATCH_SIZE = 100000


def initialize_documents():
    print("Initializing documents for TMDB streaming data")
    mongo_db = get_db()

    watch_providers_pipeline = [
        {"$match": {"watch_providers.results": {"$exists": True, "$ne": {}}}},
        {"$project": {
            "watch_providers": "$watch_providers.results",
            "tmdb_id": 1,
            "original_title": 1,
            "popularity": 1,
        }},
        {"$addFields": {"watch_providers_array": {"$objectToArray": "$watch_providers"}}},
        {"$unwind": "$watch_providers_array"},
        {"$project": {
            "tmdb_watch_url": "$watch_providers_array.v.link",
            "tmdb_id": 1,
            "original_title": 1,
            "popularity": 1,
        }},
    ]

    movie_count = get_aggregation_count(mongo_db.tmdb_movie_details, watch_providers_pipeline)
    tv_count = get_aggregation_count(mongo_db.tmdb_tv_details, watch_providers_pipeline)

    print(f"Total provider urls on TMDB: {movie_count} (movies) and {tv_count} (tv)")

    count_new_movies = 0
    count_new_tv = 0

    for offset in range(0, movie_count, BATCH_SIZE):
        print(f"copying {offset} to {offset + BATCH_SIZE} streaming data for movies")
        movie_cursor = mongo_db.tmdb_movie_details.aggregate(
            watch_providers_pipeline + [{"$skip": offset}, {"$limit": BATCH_SIZE}]
        )
        movie_operations = [
            build_operation({
                "tmdb_id": doc.get("tmdb_id"),
                "original_title": doc.get("original_title"),
                "popularity": doc.get("popularity"),
                "tmdb_watch_url": doc.get("tmdb_watch_url"),
            })
            for doc in movie_cursor
        ]
        count_new_movies += store_copies(movie_operations, mongo_db.tmdb_movie_providers)

    for offset in range(0, tv_count, BATCH_SIZE):
        print(f"copying {offset} to {offset + BATCH_SIZE} streaming data for tv shows")
        tv_cursor = mongo_db.tmdb_tv_details.aggregate(
            watch_providers_pipeline + [{"$skip": offset}, {"$limit": BATCH_SIZE}]
        )
        tv_operations = [
            build_operation({
                "tmdb_id": doc.get("tmdb_id"),
                "original_title": doc.get("original_title"),
                "popularity": doc.get("popularity"),
                "tmdb_watch_url": doc.get("tmdb_watch_url"),
            })
            for doc in tv_cursor
        ]
        count_new_tv += store_copies(tv_operations, mongo_db.tmdb_tv_providers)

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def get_aggregation_count(table, pipeline):
    count_pipeline = pipeline + [{"$count": "total"}]
    result = list(table.aggregate(count_pipeline))
    return result[0]['total'] if result else 0


def build_operation(tmdb_data: dict):
    date_now = datetime.utcnow()

    update_fields = {
        "original_title": tmdb_data.get("original_title"),
        "popularity": tmdb_data.get("popularity"),
    }

    operation = UpdateOne(
        {
            "tmdb_id": tmdb_data.get("tmdb_id"),
            "tmdb_watch_url": tmdb_data.get("tmdb_watch_url"),
        },
        {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
        upsert=True,
    )
    return operation


def store_copies(
    operations: list[UpdateOne],
    collection: Collection,
) -> int:
    count_new_documents = 0
    if operations:
        bulk_result = collection.bulk_write(operations)
        count_new_documents += bulk_result.upserted_count

    return count_new_documents


def imdb_init_details():
    print("Prepare fetching streaming data from TMDB")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return imdb_init_details()


if __name__ == "__main__":
    main()
