from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection

from f.data_source.details_scan import is_listed, scan_by_id, upsert_batch
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_daily.models import DumpType


# Titles need all of these to be analysed.
REQUIRED_FIELDS = {
    DumpType.MOVIES: ("original_title", "release_date", "overview"),
    DumpType.TV_SERIES: ("original_title", "first_air_date", "overview"),
}


def initialize_documents():
    print("Initializing documents for DNA generation")
    db = get_db()
    new_movies, copied_movies = copy_details(
        db["tmdb_movie_details"], db["dna_movie"], DumpType.MOVIES, "movies")
    new_tv, copied_tv = copy_details(
        db["tmdb_tv_details"], db["dna_tv"], DumpType.TV_SERIES, "tv")
    return {
        "count_new_movies": new_movies,
        "count_new_tv": new_tv,
        "count_copied_movies": copied_movies,
        "count_copied_tv": copied_tv,
    }


def copy_details(details: Collection, target: Collection, type: DumpType, label_plural: str) -> tuple[int, int]:
    required = REQUIRED_FIELDS[type]
    projection = {field: 1 for field in ("tmdb_id", "popularity", "tmdb_deleted", *required)}
    count_new = 0
    count_copied = 0
    for batch in scan_by_id(details, projection):
        operations = [
            build_operation(details_entry=entry, type=type)
            for entry in batch
            if is_listed(entry) and all(entry.get(field) is not None for field in required)
        ]
        count_new += upsert_batch(target, operations)
        count_copied += len(operations)
        print(f"Copied {count_copied} {label_plural} ({count_new} new)")
    return count_new, count_copied


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
