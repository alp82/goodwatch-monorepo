from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.data_source.details_scan import is_listed, scan_by_id, upsert_batch
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType
from f.utils.string import to_underscored


BATCH_SIZE = 10000


def initialize_documents():
    print("Initializing documents for Rotten Tomatoes ratings")
    db = get_db()
    new_movies, copied_movies = copy_details(
        db["tmdb_movie_details"], db["rotten_tomatoes_movie_rating"], DumpType.MOVIES, "movies")
    new_tv, copied_tv = copy_details(
        db["tmdb_tv_details"], db["rotten_tomatoes_tv_rating"], DumpType.TV_SERIES, "tv series")
    return {
        "count_new_movies": new_movies,
        "count_new_tv": new_tv,
        "count_copied_movies": copied_movies,
        "count_copied_tv": copied_tv,
    }


def copy_details(details: Collection, target: Collection, type: DumpType, label_plural: str) -> tuple[int, int]:
    date_field = "release_date" if type == DumpType.MOVIES else "first_air_date"
    projection = {field: 1 for field in (
        "tmdb_id", "title", "original_title", "popularity", "alternative_titles", "tmdb_deleted", date_field,
    )}
    count_new = 0
    count_copied = 0
    for batch in scan_by_id(details, projection):
        operations = [
            build_operation(tmdb_entry=entry, type=type)
            for entry in batch
            if is_listed(entry) and entry.get("title") is not None
        ]
        count_new += upsert_batch(target, operations)
        count_copied += len(operations)
        print(f"Copied {count_copied} {label_plural} ({count_new} new)")
    return count_new, count_copied


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
        titles.append(to_underscored(title))

    for alternative_title in tmdb_entry.get("alternative_titles", []):
        if (
            (title := alternative_title.get("title"))
            and alternative_title.get("iso_3166_1") in ["US"]
            and alternative_title.get("type")
            in ["English title", "Short Title", "modern title"]
        ):
            underscored_title = to_underscored(title)
            if underscored_title not in titles:
                titles.append(underscored_title)

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
            f"Added {count_new_documents} new documents for fetching Rotten Tomatoes {label_plural} ratings"
        )

    return {
        "count_new_documents": count_new_documents,
        "upserted_ids": upserted_ids,
    }


def rotten_tomatoes_init_details():
    print("Prepare fetching ratings from Rotten Tomatoes")
    init_mongodb()
    docs = initialize_documents()
    close_mongodb()
    return docs


def main():
    return rotten_tomatoes_init_details()


if __name__ == "__main__":
    main()
