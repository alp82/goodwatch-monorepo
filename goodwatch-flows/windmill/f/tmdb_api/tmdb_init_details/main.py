from f.data_source.title_identity import canonical_title_id
from datetime import datetime
from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection
import wmill

from f.data_source.models import MediaType
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.deleted_propagation import propagate_tmdb_deleted

BATCH_SIZE = 50000


def initialize_documents():
    print("Initializing documents for details")
    db = get_db()
    tmdb_daily_dump_collection = db["tmdb_daily_dump_data"]
    tmdb_movie_collection = db["tmdb_movie_details"]
    tmdb_tv_collection = db["tmdb_tv_details"]

    # Dump rows are never purged, so only a row seen after the deletion restores a title.
    deleted_at_by_type = {
        MediaType.MOVIE.value: flagged_deleted_at(tmdb_movie_collection),
        MediaType.TV.value: flagged_deleted_at(tmdb_tv_collection),
    }

    movie_operations = []
    tv_operations = []
    restored_ids = {MediaType.MOVIE.value: [], MediaType.TV.value: []}
    for tmdb_dump in tmdb_daily_dump_collection.find():
        if canonical_title_id(tmdb_dump.get("type"), tmdb_dump["tmdb_id"]) != tmdb_dump["tmdb_id"]:
            continue
        date_now = datetime.utcnow()
        update_fields = {
            "original_title": tmdb_dump.get("original_title"),
            "popularity": tmdb_dump.get("popularity"),
            "adult": tmdb_dump.get("adult"),
            "video": tmdb_dump.get("video"),
        }
        deleted_at = deleted_at_by_type.get(tmdb_dump.get("type"), {}).get(
            int(tmdb_dump["tmdb_id"])
        )
        if deleted_at and tmdb_dump.get("updated_at") and tmdb_dump["updated_at"] > deleted_at:
            # Listed in a newer dump again: unflag, the fetch queue picks it up by its old selected_at.
            update_fields["tmdb_deleted"] = False
            update_fields["tmdb_deleted_at"] = None
            restored_ids[tmdb_dump.get("type")].append(int(tmdb_dump["tmdb_id"]))

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

    # After the details are unflagged, so a failure here never leaves sources ahead of them.
    for media_type, tmdb_ids in restored_ids.items():
        propagate_tmdb_deleted(media_type, tmdb_ids, False)

    return {
        "count_new_movies": movie_upserts.get("count_new_documents"),
        "count_new_tv": tv_upserts.get("count_new_documents"),
        "upserted_movie_ids": movie_upserts.get("upserted_ids"),
        "upserted_tv_ids": tv_upserts.get("upserted_ids"),
    }


def flagged_deleted_at(collection: Collection) -> dict:
    return {
        int(doc["tmdb_id"]): doc.get("tmdb_deleted_at")
        for doc in collection.find(
            {"tmdb_deleted": True}, {"tmdb_id": 1, "tmdb_deleted_at": 1}
        )
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
