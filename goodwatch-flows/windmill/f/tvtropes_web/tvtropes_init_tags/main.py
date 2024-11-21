from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType
from f.utils.string import to_pascal_case


BATCH_SIZE = 10000


def initialize_documents():
    print("Initializing documents for TV Tropes semantic tags")
    db = get_db()
    tmdb_movie_collection = db["tmdb_movie_details"]
    tmdb_tv_collection = db["tmdb_tv_details"]
    tvtropes_movie_collection = db["tv_tropes_movie_tags"]
    tvtropes_tv_collection = db["tv_tropes_tv_tags"]

    total_movies = tmdb_movie_collection.count_documents(
        {"title": {"$ne": None}}
    )
    total_tv = tmdb_tv_collection.count_documents({"title": {"$ne": None}})

    print(f"Total movie objects with titles: {total_movies}")
    print(f"Total tv objects with titles: {total_tv}")

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

        tmdb_movie_cursor = (
            tmdb_movie_collection.find({"title": {"$ne": None}})
            .skip(start)
            .limit(BATCH_SIZE)
        )

        movie_operations = []
        for tmdb_movie in tmdb_movie_cursor:
            operation = build_operation(tmdb_entry=tmdb_movie, type=DumpType.MOVIES)
            movie_operations.append(operation)
        
        upserts = store_copies(
            movie_operations,
            collection=tvtropes_movie_collection,
            label_plural="movies",
        )
        movie_upserts["count_new_movies"] += upserts.get("count_new_documents")
        movie_upserts["upserted_movie_ids"] += upserts.get("upserted_ids")

    # Process TV shows in batches
    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv shows {start} to {end}")

        tmdb_tv_cursor = (
            tmdb_tv_collection.find({"title": {"$ne": None}})
            .skip(start)
            .limit(BATCH_SIZE)
        )

        tv_operations = []
        for tmdb_tv in tmdb_tv_cursor:
            operation = build_operation(tmdb_entry=tmdb_tv, type=DumpType.TV_SERIES)
            tv_operations.append(operation)

        upserts = store_copies(
            tv_operations,
            collection=tvtropes_tv_collection,
            label_plural="tv series",
        )
        tv_upserts["count_new_tv"] += upserts.get("count_new_documents")
        tv_upserts["upserted_tv_ids"] += upserts.get("upserted_ids")

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_movie_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_tv_ids"),
    }


def build_operation(tmdb_entry: dict, type: DumpType):
    date_now = datetime.utcnow()

    title_variations = get_title_variations(tmdb_entry=tmdb_entry, type=type)
    release_date = tmdb_entry.get("release_date") if type == DumpType.MOVIES else tmdb_entry.get("first_air_date")

    update_fields = {
        "original_title": tmdb_entry.get("original_title"),
        "popularity": tmdb_entry.get("popularity"),
        "title_variations": title_variations,
        "release_year": release_date.year if release_date else None,
        "overview": tmdb_entry.get("overview"),
    }

    operation = UpdateOne(
        {
            "tmdb_id": tmdb_entry.get("tmdb_id"),
        },
        {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
        upsert=True,
    )
    return operation


def get_title_variations(tmdb_entry: dict, type: DumpType):
    titles = []
    if title := tmdb_entry.get("title"):
        titles.append(to_pascal_case(title))

    for alternative_title in tmdb_entry.get("alternative_titles", []):
        if (
            (title := alternative_title.get("title"))
            and alternative_title.get("iso_3166_1") in ["US"]
            and alternative_title.get("type")
            in ["English title", "Short Title", "modern title"]
        ):
            pascal_cased_title = to_pascal_case(title)
            if pascal_cased_title not in titles:
                titles.append(pascal_cased_title)

    return titles


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
            f"Added {count_new_documents} new documents for fetching TV Tropes {label_plural} tags"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def tvtropes_init_details():
    print("Prepare fetching semantic tags from TV Tropes")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return tvtropes_init_details()


if __name__ == "__main__":
    main()
    # m: tmdb_id = 4679
