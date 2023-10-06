from datetime import datetime
import pymongo
from typing import Union, Type
import wmill

from f.db.mongodb import init_mongodb
from f.imdb_web.models import ImdbMovieRating, ImdbTvRating
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import DumpType


BATCH_SIZE = 1000


def initialize_documents():
    print("Initializing documents for IMDB ratings")

    total_movies = TmdbMovieDetails.objects(imdb_id__ne=None).count()
    total_tv = TmdbTvDetails.objects(external_ids__imdb_id__ne=None).count()

    print(f"Total movie objects with IMDB ID: {total_movies}")
    print(f"Total tv objects with IMDB ID: {total_tv}")

    movie_operations = []
    tv_operations = []

    # Process movies in batches
    for start in range(0, total_movies, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_movies)
        print(f"Processing movies {start} to {end}")

        tmdb_movie_records = TmdbMovieDetails.objects(imdb_id__ne=None).skip(start).limit(BATCH_SIZE)

        for tmdb_movie in tmdb_movie_records:
            operation = build_operation(tmdb_entry=tmdb_movie, type=DumpType.MOVIES)
            movie_operations.append(operation)

    # Process TV shows in batches
    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv shows {start} to {end}")

        tmdb_tv_records = TmdbTvDetails.objects(external_ids__imdb_id__ne=None).skip(start).limit(BATCH_SIZE)

        for tmdb_tv in tmdb_tv_records:
            operation = build_operation(tmdb_entry=tmdb_tv, type=DumpType.TV_SERIES)
            tv_operations.append(operation)

    return

    print(
        f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series"
    )
    count_new_movies = 0
    count_new_tv = 0
    if movie_operations:
        count_new_movies = store_copies(
            movie_operations, document_class=ImdbMovieRating, label_plural="movies"
        )
    if tv_operations:
        count_new_tv = store_copies(
            tv_operations, document_class=ImdbTvRating, label_plural="tv series"
        )

    return {
        "count_new_movies": count_new_movies,
        "count_new_tv": count_new_tv,
    }


def build_operation(tmdb_entry, type: DumpType):
    date_now = datetime.utcnow()
    imdb_id = (
        tmdb_entry.imdb_id
        if type == DumpType.MOVIES
        else tmdb_entry.external_ids.imdb_id
    )

    update_fields = {
        "imdb_id": imdb_id,
        "original_title": tmdb_entry.original_title,
        "popularity": tmdb_entry.popularity,
        "updated_at": date_now,
    }
    operation = pymongo.UpdateOne(
        {
            "tmdb_id": tmdb_entry.tmdb_id,
        },
        {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
        upsert=True,
    )
    return operation


def store_copies(
    operations: list[pymongo.UpdateOne],
    document_class: Union[Type[ImdbMovieRating], Type[ImdbTvRating]],
    label_plural: str,
):
    count_new_documents = 0
    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        print(f"copying {start} to {end} movies")
        batch = operations[start:end]
        bulk_result = document_class._get_collection().bulk_write(batch)
        count_new_documents += bulk_result.upserted_count

    if count_new_documents:
        print(f"Added {count_new_documents} new ratings for {label_plural}")

    return store_copies


def imdb_init_details():
    print("Prepare fetching ratings from IMDB")
    init_mongodb()
    return initialize_documents()


def main():
    return imdb_init_details()


if __name__ == '__main__':
    main()
