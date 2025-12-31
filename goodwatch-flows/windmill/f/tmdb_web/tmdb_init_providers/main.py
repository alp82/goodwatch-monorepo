from datetime import datetime

from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection

from f.db.mongodb import init_mongodb, close_mongodb

BATCH_SIZE = 100000


watch_providers_pipeline = [
    {
        "$match": {
            "watch_providers.results": {
                "$exists": True,
                "$ne": {},
                "$not": {"$type": "array"},
            }
        }
    },
    {
        "$project": {
            "watch_providers": "$watch_providers.results",
            "tmdb_id": 1,
            "original_title": 1,
            "popularity": 1,
        }
    },
    {
        "$addFields": {
            "watch_providers_array": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$watch_providers"}, "object"]},
                    "then": {"$objectToArray": "$watch_providers"},
                    "else": "$watch_providers",
                }
            }
        }
    },
    {"$unwind": "$watch_providers_array"},
    {
        "$project": {
            "tmdb_watch_url": "$watch_providers_array.v.link",
            "tmdb_id": 1,
            "original_title": 1,
            "popularity": 1,
        }
    },
]


def initialize_documents():
    print("Initializing documents for TMDB streaming data")
    mongo_db = get_db()

    # ---- MOVIES ----
    movie_cursor = mongo_db.tmdb_movie_details.aggregate(
        watch_providers_pipeline,
        allowDiskUse=True,
        batchSize=5_000,
    )

    count_new_movies = 0
    movie_operations: list[UpdateOne] = []
    movie_seen = 0

    for doc in movie_cursor:
        movie_seen += 1
        movie_operations.append(
            build_operation(
                {
                    "tmdb_id": doc.get("tmdb_id"),
                    "original_title": doc.get("original_title"),
                    "popularity": doc.get("popularity"),
                    "tmdb_watch_url": doc.get("tmdb_watch_url"),
                }
            )
        )

        if len(movie_operations) >= BATCH_SIZE:
            print(f"Flushing {len(movie_operations)} movie operations (seen={movie_seen})")
            movie_upserts = store_copies(movie_operations, mongo_db.tmdb_movie_providers)
            count_new_movies += movie_upserts["count_new_documents"]
            movie_operations.clear()

    # flush remaining
    if movie_operations:
        print(f"Flushing final {len(movie_operations)} movie operations (seen={movie_seen})")
        movie_upserts = store_copies(movie_operations, mongo_db.tmdb_movie_providers)
        count_new_movies += movie_upserts["count_new_documents"]

    print(f"Total processed movie provider docs: {movie_seen}")

    # ---- TV ----
    tv_cursor = mongo_db.tmdb_tv_details.aggregate(
        watch_providers_pipeline,
        allowDiskUse=True,
        batchSize=5_000,
    )

    count_new_tv = 0
    tv_operations: list[UpdateOne] = []
    tv_seen = 0

    for doc in tv_cursor:
        tv_seen += 1
        tv_operations.append(
            build_operation(
                {
                    "tmdb_id": doc.get("tmdb_id"),
                    "original_title": doc.get("original_title"),
                    "popularity": doc.get("popularity"),
                    "tmdb_watch_url": doc.get("tmdb_watch_url"),
                }
            )
        )

        if len(tv_operations) >= BATCH_SIZE:
            print(f"Flushing {len(tv_operations)} tv operations (seen={tv_seen})")
            tv_upserts = store_copies(tv_operations, mongo_db.tmdb_tv_providers)
            count_new_tv += tv_upserts["count_new_documents"]
            tv_operations.clear()

    if tv_operations:
        print(f"Flushing final {len(tv_operations)} tv operations (seen={tv_seen})")
        tv_upserts = store_copies(tv_operations, mongo_db.tmdb_tv_providers)
        count_new_tv += tv_upserts["count_new_documents"]

    print(f"Total processed tv provider docs: {tv_seen}")

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def get_aggregation_count(table, pipeline):
    count_pipeline = pipeline + [{"$count": "total"}]
    result = list(table.aggregate(count_pipeline))
    return result[0]["total"] if result else 0


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
) -> dict:
    count_new_documents = 0

    if operations:
        bulk_result = collection.bulk_write(operations)
        count_new_documents += bulk_result.upserted_count

    return {
        "count_new_documents": count_new_documents,
    }


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
