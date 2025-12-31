from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType


BATCH_SIZE = 10000


def initialize_documents():
    print("Initializing documents for DNA generation")
    db = get_db()
    details_movie_collection = db["tmdb_movie_details"]
    details_tv_collection = db["tmdb_tv_details"]
    dna_movie_collection = db["dna_movie"]
    dna_tv_collection = db["dna_tv"]

    filter_query_movies = {
        "original_title": {"$ne": None},
        "release_date": {"$ne": None},
        "overview": {"$ne": None}
    }
    filter_query_tv = {
        "original_title": {"$ne": None},
        "first_air_date": {"$ne": None},
        "overview": {"$ne": None}
    }

    total_movies = details_movie_collection.count_documents(filter_query_movies)
    total_tv = details_tv_collection.count_documents(filter_query_tv)

    print(f"Total movie objects with titles, year and overview: {total_movies}")
    print(f"Total tv objects with titles, year and overview: {total_tv}")

    movie_upserts = {
        "count_new_movies": 0,
        "upserted_movie_ids": [],
    }
    tv_upserts = {
        "count_new_tv": 0,
        "upserted_tv_ids": [],
    }

    # Process movies in batches
    for start in range(0, total_movies, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_movies)
        print(f"Processing movies {start} to {end}")

        details_movie_cursor = (
            details_movie_collection.find(filter_query_movies).skip(start).limit(BATCH_SIZE)
        )

        movie_operations = []
        for details_movie in details_movie_cursor:
            operation = build_operation(
                details_entry=details_movie, type=DumpType.MOVIES
            )
            movie_operations.append(operation)

        if movie_operations:
            upserts = store_copies(
                movie_operations,
                collection=dna_movie_collection,
                label_plural="movies",
            )
            movie_upserts["count_new_movies"] += upserts.get("count_new_documents")
            movie_upserts["upserted_movie_ids"] += upserts.get("upserted_ids")

    # Process TV shows in batches
    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv shows {start} to {end}")

        details_tv_cursor = (
            details_tv_collection.find(filter_query_tv).skip(start).limit(BATCH_SIZE)
        )

        tv_operations = []
        for details_tv in details_tv_cursor:
            operation = build_operation(
                details_entry=details_tv, type=DumpType.TV_SERIES
            )
            tv_operations.append(operation)

        if tv_operations:
            upserts = store_copies(
                tv_operations,
                collection=dna_tv_collection,
                label_plural="tv",
            )
            tv_upserts["count_new_tv"] += upserts.get("count_new_documents")
            tv_upserts["upserted_tv_ids"] += upserts.get("upserted_ids")

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_movie_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_tv_ids"),
    }


def build_operation(details_entry: dict, type: DumpType):
    date_now = datetime.utcnow()

    release_date = details_entry.get("release_date") if "release_date" in details_entry else details_entry.get("first_air_date")
    update_fields = {
        "original_title": details_entry.get("original_title"),
        "release_year": release_date.year if release_date else None,
        "popularity": details_entry.get("popularity"),
        "overview": details_entry.get("overview"),
    }

    operation = UpdateOne(
        {
            "tmdb_id": details_entry.get("tmdb_id"),
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

    bulk_result = collection.bulk_write(operations)
    count_new_documents += bulk_result.upserted_count

    for op in operations:
        criteria = op._filter
        found_docs = collection.find(criteria)
        for doc in found_docs:
            upserted_ids.append(doc["_id"])

    if count_new_documents:
        print(
            f"Added {count_new_documents} new documents for generating {label_plural} DNA"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def dna_init():
    print("Prepare generating DNA")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return dna_init()


if __name__ == "__main__":
    main()
