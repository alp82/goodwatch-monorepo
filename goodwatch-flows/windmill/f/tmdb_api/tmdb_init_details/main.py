from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.data_source.models import MediaType
from f.db.mongodb import init_mongodb, close_mongodb

BATCH_SIZE = 50000


def initialize_documents():
    print("Initializing documents for details")
    db = get_db()
    tmdb_daily_dump_collection = db["tmdb_daily_dump_data"]
    tmdb_movie_collection = db["tmdb_movie_details"]
    tmdb_tv_collection = db["tmdb_tv_details"]

    movie_operations = []
    tv_operations = []
    for tmdb_dump in tmdb_daily_dump_collection.find():
        date_now = datetime.utcnow()
        update_fields = {
            "original_title": tmdb_dump.get("original_title"),
            "popularity": tmdb_dump.get("popularity"),
            "adult": tmdb_dump.get("adult"),
            "video": tmdb_dump.get("video"),
        }

        operation = UpdateOne(
            {
                "tmdb_id": tmdb_dump.get("tmdb_id"),
            },
            {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
            upsert=True,
        )
        if tmdb_dump.get("type") == MediaType.MOVIE.value:
            movie_operations.append(operation)
        elif tmdb_dump.get("type") == MediaType.TV.value:
            tv_operations.append(operation)
        else:
            raise Exception(
                f"unknown dump type: {tmdb_dump.get('type')} - allowed: {', '.join([MediaType.MOVIE.value, MediaType.TV.value])}"
            )

    print(
        f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series"
    )

    movie_upserts = {}
    tv_upserts = {}
    if movie_operations:
        movie_upserts = store_copies(
            movie_operations,
            collection=tmdb_movie_collection,
            label_plural="movies",
        )
    if tv_operations:
        tv_upserts = store_copies(
            tv_operations,
            collection=tmdb_tv_collection,
            label_plural="tv series",
        )

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_ids"),
    }


def store_copies(
    operations: list[UpdateOne],
    collection: Collection,
    label_plural: str,
) -> dict:
    count_new_documents = 0
    upserted_ids = []

    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        print(f"copying {start} to {end} {label_plural}")
        batch = operations[start:end]
        bulk_result = collection.bulk_write(batch)
        count_new_documents += bulk_result.upserted_count

        for op in batch:
            criteria = op._filter
            found_docs = collection.find(criteria)
            for doc in found_docs:
                upserted_ids.append(doc['_id'])

    if count_new_documents:
        print(
            f"Added {count_new_documents} new documents for fetching {label_plural} details"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def tmdb_init_details():
    print("Prepare fetching details from TMDB API")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return tmdb_init_details()


if __name__ == "__main__":
    main()
