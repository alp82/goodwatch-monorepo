from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType


BATCH_SIZE = 10000


def initialize_documents():
    print("Initializing documents for IMDB ratings")
    db = get_db()
    tmdb_movie_collection = db["tmdb_movie_details"]
    tmdb_tv_collection = db["tmdb_tv_details"]
    imdb_movie_collection = db["imdb_movie_rating"]
    imdb_tv_collection = db["imdb_tv_rating"]

    total_movies = tmdb_movie_collection.count_documents({"imdb_id": {"$ne": None}})
    total_tv = tmdb_tv_collection.count_documents(
        {"external_ids.imdb_id": {"$ne": None}}
    )

    print(f"Total movie objects with IMDB ID: {total_movies}")
    print(f"Total tv objects with IMDB ID: {total_tv}")

    movie_operations = []
    tv_operations = []

    # Process movies in batches
    for start in range(0, total_movies, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_movies)
        print(f"Processing movies {start} to {end}")

        tmdb_movie_cursor = (
            tmdb_movie_collection.find({"imdb_id": {"$ne": None}})
            .skip(start)
            .limit(BATCH_SIZE)
        )

        for tmdb_movie in tmdb_movie_cursor:
            operation = build_operation(tmdb_entry=tmdb_movie, type=DumpType.MOVIES)
            movie_operations.append(operation)

    # Process TV shows in batches
    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv shows {start} to {end}")

        tmdb_tv_cursor = (
            tmdb_tv_collection.find({"external_ids.imdb_id": {"$ne": None}})
            .skip(start)
            .limit(BATCH_SIZE)
        )

        for tmdb_tv in tmdb_tv_cursor:
            operation = build_operation(tmdb_entry=tmdb_tv, type=DumpType.TV_SERIES)
            tv_operations.append(operation)

    print(
        f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series"
    )

    movie_upserts = {}
    tv_upserts = {}
    if movie_operations:
        movie_upserts = store_copies(
            movie_operations,
            collection=imdb_movie_collection,
            label_plural="movies",
        )
    if tv_operations:
        tv_upserts = store_copies(
            tv_operations,
            collection=imdb_tv_collection,
            label_plural="tv series",
        )

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_ids"),
    }


def build_operation(tmdb_entry: dict, type: DumpType):
    date_now = datetime.utcnow()
    imdb_id = (
        tmdb_entry.get("imdb_id")
        if type == DumpType.MOVIES
        else tmdb_entry.get("external_ids", {}).get("imdb_id")
    )

    update_fields = {
        "imdb_id": imdb_id,
        "original_title": tmdb_entry.get("original_title"),
        "popularity": tmdb_entry.get("popularity"),
    }

    operation = UpdateOne(
        {
            "tmdb_id": tmdb_entry.get("tmdb_id"),
        },
        {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
        upsert=True,
    )
    return operation


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
            f"Added {count_new_documents} new documents for fetching IMDB {label_plural} ratings"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def imdb_init_details():
    print("Prepare fetching ratings from IMDB")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return imdb_init_details()


if __name__ == "__main__":
    main()
