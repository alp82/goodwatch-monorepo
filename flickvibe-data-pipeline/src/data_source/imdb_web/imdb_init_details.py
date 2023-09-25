from datetime import datetime
from typing import Union

import pymongo
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner

from src.data_source.imdb_web.models import ImdbMovieRating, ImdbTvRating
from src.data_source.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from src.tmdb_daily.models import DumpType
from src.utils.db import init_db

BATCH_SIZE = 50000


def build_operation(tmdb_entry, type: DumpType):
    date_now = datetime.utcnow()
    imdb_id = tmdb_entry.imdb_id if type == DumpType.MOVIES else tmdb_entry.external_ids.imdb_id

    update_fields = {
        "imdb_id": imdb_id,
        "original_title": tmdb_entry.original_title,
        "popularity": tmdb_entry.popularity,
        "updated_at": date_now,
    }
    operation = pymongo.UpdateOne(
        {
            'tmdb_id': tmdb_entry.tmdb_id,
        },
        {
            '$setOnInsert': {'created_at': date_now},
            '$set': update_fields
        },
        upsert=True
    )
    return operation


def store_copies(operations: list[pymongo.UpdateOne], document_class: Union[ImdbMovieRating, ImdbTvRating],
                 label_plural: str):
    logger = get_run_logger()

    count_new_documents = 0
    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        logger.info(f"copying {start} to {end} movies")
        batch = operations[start:end]
        bulk_result = document_class._get_collection().bulk_write(batch)
        logger.debug(bulk_result)
        count_new_documents += bulk_result.upserted_count

    if count_new_documents:
        logger.info(f"Added {count_new_documents} new ratings for {label_plural}")


@task
def initialize_documents():
    logger = get_run_logger()
    logger.info(f"Initializing documents for IMDB ratings")
    init_db()

    tmdb_movie_records = TmdbMovieDetails.objects(imdb_id__ne=None)
    tmdb_tv_records = TmdbTvDetails.objects(external_ids__imdb_id__ne=None)

    movie_operations = []
    tv_operations = []
    for tmdb_movie in tmdb_movie_records:
        operation = build_operation(tmdb_entry=tmdb_movie, type=DumpType.MOVIES)
        movie_operations.append(operation)
    for tmdb_tv in tmdb_tv_records:
        operation = build_operation(tmdb_entry=tmdb_tv, type=DumpType.TV_SERIES)
        tv_operations.append(operation)

    logger.info(f"Storing copies of {len(movie_operations)} movies and {len(tv_operations)} tv series")
    if movie_operations:
        store_copies(movie_operations, document_class=ImdbMovieRating, label_plural="movies")
    if tv_operations:
        store_copies(tv_operations, document_class=ImdbTvRating, label_plural="tv series")


@flow(task_runner=DaskTaskRunner())
def imdb_init_details():
    logger = get_run_logger()
    logger.info("Prepare fetching ratings from IMDB")
    initialize_documents()


if __name__ == "__main__":
    imdb_init_details()

    deployment = imdb_init_details.to_deployment(
        name="local",
        interval=60 * 5,
    )
    serve(deployment)
