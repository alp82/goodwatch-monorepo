from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.db.mongodb import init_mongodb
from f.tmdb_daily.models import DumpType
from f.utils.string import to_dashed


BATCH_SIZE = 10000


def initialize_documents():
    print("Initializing documents for Metacritic ratings")
    db = get_db()
    tmdb_movie_collection = db["tmdb_movie_details"]
    tmdb_tv_collection = db["tmdb_tv_details"]
    metacritic_movie_collection = db["metacritic_movie_rating"]
    metacritic_tv_collection = db["metacritic_tv_rating"]

    total_movies = tmdb_movie_collection.count_documents(
        {"title": {"$ne": None}}
    )
    total_tv = tmdb_tv_collection.count_documents({"title": {"$ne": None}})

    print(f"Total movie objects with titles: {total_movies}")
    print(f"Total tv objects with titles: {total_tv}")

    movie_operations = []
    tv_operations = []

    # Process movies in batches
    for start in range(0, total_movies, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_movies)
        print(f"Processing movies {start} to {end}")

        tmdb_movie_cursor = (
            tmdb_movie_collection.find({"title": {"$ne": None}})
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
            tmdb_tv_collection.find({"title": {"$ne": None}})
            .skip(start)
            .limit(BATCH_SIZE)
        )

        for tmdb_tv in tmdb_tv_cursor:
            operation = build_operation(tmdb_entry=tmdb_tv, type=DumpType.TV_SERIES)
            tv_operations.append(operation)

    print(
        f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series"
    )

    count_new_movies = 0
    count_new_tv = 0
    if movie_operations:
        count_new_movies = store_copies(
            movie_operations,
            collection=metacritic_movie_collection,
            label_plural="movies",
        )
    if tv_operations:
        count_new_tv = store_copies(
            tv_operations, collection=metacritic_tv_collection, label_plural="tv series"
        )

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
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
        titles.append(to_dashed(title))

    for alternative_title in tmdb_entry.get("alternative_titles", []):
        if (
            (title := alternative_title.get("title"))
            and alternative_title.get("iso_3166_1") in ["US"]
            and alternative_title.get("type")
            in ["English title", "Short Title", "modern title"]
        ):
            dashed_title = to_dashed(title)
            if dashed_title not in titles:
                titles.append(dashed_title)

    return titles


def store_copies(
    operations: list[UpdateOne],
    collection: Collection,
    label_plural: str,
) -> int:
    count_new_documents = 0
    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        print(f"copying {start} to {end} {label_plural}")
        batch = operations[start:end]
        bulk_result = collection.bulk_write(batch)
        count_new_documents += bulk_result.upserted_count

    if count_new_documents:
        print(
            f"Added {count_new_documents} new documents for fetching Metacritic {label_plural} ratings"
        )

    return count_new_documents


def metacritic_init_details():
    print("Prepare fetching ratings from Metacritic")
    init_mongodb()
    return initialize_documents()


def main():
    return metacritic_init_details()


if __name__ == "__main__":
    main()
