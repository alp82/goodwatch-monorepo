from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType


BATCH_SIZE = 5000


def initialize_documents():
    print("Initializing documents for Genome generation")
    db = get_db()
    tvtropes_movie_collection = db["tv_tropes_movie_tags"]
    tvtropes_tv_collection = db["tv_tropes_tv_tags"]
    genome_movie_collection = db["genome_movie"]
    genome_tv_collection = db["genome_tv"]

    filter_query = {
        "original_title": {"$ne": None},
        "tropes": {"$ne": None},
    }

    total_movies = tvtropes_movie_collection.count_documents(filter_query)
    total_tv = tvtropes_tv_collection.count_documents(filter_query)

    print(f"Total movie objects with titles and tropes: {total_movies}")
    print(f"Total tv objects with titles and tropes: {total_tv}")

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

        tvtropes_movie_cursor = (
            tvtropes_movie_collection.find(filter_query).skip(start).limit(BATCH_SIZE)
        )

        movie_operations = []
        for tvtropes_movie in tvtropes_movie_cursor:
            operation = build_operation(
                tvtropes_entry=tvtropes_movie, type=DumpType.MOVIES
            )
            movie_operations.append(operation)

        upserts = store_copies(
            movie_operations,
            collection=genome_movie_collection,
            label_plural="movies",
        )
        movie_upserts["count_new_movies"] += upserts.get("count_new_documents")
        movie_upserts["upserted_movie_ids"] += upserts.get("upserted_ids")

    # Process TV shows in batches
    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv shows {start} to {end}")

        tvtropes_tv_cursor = (
            tvtropes_tv_collection.find(filter_query).skip(start).limit(BATCH_SIZE)
        )

        tv_operations = []
        for tvtropes_tv in tvtropes_tv_cursor:
            operation = build_operation(
                tvtropes_entry=tvtropes_tv, type=DumpType.TV_SERIES
            )
            tv_operations.append(operation)

        upserts = store_copies(
            tv_operations,
            collection=genome_tv_collection,
            label_plural="tv",
        )
        tv_upserts["count_new_tv"] += upserts.get("count_new_documents")
        tv_upserts["upserted_tv_ids"] += upserts.get("upserted_ids")

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_ids"),
    }


def build_operation(tvtropes_entry: dict, type: DumpType):
    date_now = datetime.utcnow()

    update_fields = {
        "original_title": tvtropes_entry.get("original_title"),
        "release_year": tvtropes_entry.get("release_year"),
        "popularity": tvtropes_entry.get("popularity"),
        "trope_names": [trope["name"] for trope in tvtropes_entry.get("tropes", [])],
    }

    operation = UpdateOne(
        {
            "tmdb_id": tvtropes_entry.get("tmdb_id"),
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
            f"Added {count_new_documents} new documents for generating {label_plural} genome"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def genome_init():
    print("Prepare generating genomes from Hugchat")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return genome_init()


if __name__ == "__main__":
    main()
