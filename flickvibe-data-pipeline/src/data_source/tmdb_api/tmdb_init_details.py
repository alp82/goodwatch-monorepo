from datetime import datetime
from typing import Union

import pymongo
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner

from src.data_source.models import MediaType
from src.data_source.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from src.tmdb_daily.models import TmdbDailyDumpData, DumpType
from src.utils.db import init_db

BATCH_SIZE = 50000


def store_copies(operations: list[pymongo.UpdateOne], document_class: Union[TmdbMovieDetails, TmdbTvDetails],
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
        logger.info(f"Added {count_new_documents} new details for {label_plural}")


@task
def initialize_documents():
    logger = get_run_logger()
    logger.info(f"Initializing documents for details")

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
                'tmdb_id': tmdb_dump.tmdb_id,
            },
            {
                '$setOnInsert': {'created_at': date_now},
                '$set': update_fields
            },
            upsert=True
        )
        if tmdb_dump.type == MediaType.MOVIE:
            movie_operations.append(operation)
        elif tmdb_dump.type == MediaType.TV:
            tv_operations.append(operation)
        else:
            raise Exception(f"unknown dump type: {tmdb_dump.type}")

    if movie_operations:
        store_copies(movie_operations, document_class=TmdbMovieDetails, label_plural="movies")
    if tv_operations:
        store_copies(tv_operations, document_class=TmdbTvDetails, label_plural="tv series")


@flow(task_runner=DaskTaskRunner())
def tmdb_init_details():
    logger = get_run_logger()
    logger.info("Prepare fetching details from TMDB API")
    init_db()
    initialize_documents()


if __name__ == "__main__":
    tmdb_init_details()

    deployment = tmdb_init_details.to_deployment(
        name="local",
        interval=60 * 120,  # TODO specific times
    )
    serve(deployment)
