from datetime import datetime
import pymongo
from typing import Union
import wmill

from f.data_source.models import MediaType
from f.db.mongodb import init_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import TmdbDailyDumpData

BATCH_SIZE = 50000


def initialize_documents():
    print("Initializing documents for details")

    tmdb_dump_records = TmdbDailyDumpData.objects

    movie_operations = []
    tv_operations = []
    for tmdb_dump in tmdb_dump_records:
        date_now = datetime.utcnow()
        update_fields = {
            "original_title": tmdb_dump.original_title,
            "popularity": tmdb_dump.popularity,
            "adult": tmdb_dump.adult,
            "video": tmdb_dump.video,
            "updated_at": date_now,
        }

        operation = pymongo.UpdateOne(
            {
                "tmdb_id": tmdb_dump.tmdb_id,
            },
            {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
            upsert=True,
        )
        if tmdb_dump.type == MediaType.MOVIE:
            movie_operations.append(operation)
        elif tmdb_dump.type == MediaType.TV:
            tv_operations.append(operation)
        else:
            raise Exception(f"unknown dump type: {tmdb_dump.type}")

    print(
        f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series"
    )
    count_new_movies = 0
    count_new_tv = 0
    if movie_operations:
        count_new_movies = store_copies(
            movie_operations, document_class=TmdbMovieDetails, label_plural="movies"
        )
    if tv_operations:
        count_new_tv = store_copies(
            tv_operations, document_class=TmdbTvDetails, label_plural="tv series"
        )

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def store_copies(
    operations: list[pymongo.UpdateOne],
    document_class: Union[TmdbMovieDetails, TmdbTvDetails],
    label_plural: str,
):
    count_new_documents = 0
    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        print(f"copying {start} to {end} {label_plural}")
        batch = operations[start:end]
        bulk_result = document_class._get_collection().bulk_write(batch)
        count_new_documents += bulk_result.upserted_count

    if count_new_documents:
        print(f"Added {count_new_documents} new details for {label_plural}")

    return count_new_documents


def tmdb_init_details():
    print("Prepare fetching details from TMDB API")
    init_mongodb()
    return initialize_documents()


def main():
    return tmdb_init_details()
