from datetime import datetime, timedelta
from typing import Union

import requests
from mongoengine import EmbeddedDocumentField, EmbeddedDocumentListField, Q
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner

from src.data_source.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from src.utils.db import init_db

BATCH_SIZE = 50
BUFFER_SELECTED_AT_MINUTES = 10
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


@task
def retrieve_next_entries(count: int):
    logger = get_run_logger()
    init_db()

    # Get the top n entries without "selected_at" sorted by popularity
    buffer_time_for_selected_entries = datetime.utcnow() - timedelta(minutes=BUFFER_SELECTED_AT_MINUTES)
    movies_no_fetch = list(TmdbMovieDetails.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))
    tvs_no_fetch = list(TmdbTvDetails.objects(
        Q(selected_at=None) |
        Q(__raw__={
            "$and": [
                {"$expr": {"$gt": ["$selected_at", "$updated_at"]}},
                {"selected_at": {"$lt": buffer_time_for_selected_entries}}
            ]
        })
    ).order_by("-popularity").limit(count))

    # Get the top n entries with the oldest "selected_at"
    movies_old_fetch = list(TmdbMovieDetails.objects(selected_at__ne=None).order_by("selected_at").limit(count))
    tvs_old_fetch = list(TmdbTvDetails.objects(selected_at__ne=None).order_by("selected_at").limit(count))

    # Compare and return
    no_fetch_entries = sorted(movies_no_fetch + tvs_no_fetch, key=lambda x: x.popularity, reverse=True)[:count]
    old_fetch_entries = sorted(movies_old_fetch + tvs_old_fetch, key=lambda x: x.selected_at)[:count]

    next_entries = (no_fetch_entries + old_fetch_entries)[:count]

    # Update "selected_at" field to reserve these for this worker
    movie_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, TmdbMovieDetails)]
    tv_ids_to_update = [entry.id for entry in next_entries if isinstance(entry, TmdbTvDetails)]

    if movie_ids_to_update:
        TmdbMovieDetails.objects(id__in=movie_ids_to_update).update(selected_at=datetime.utcnow())
    if tv_ids_to_update:
        TmdbTvDetails.objects(id__in=tv_ids_to_update).update(selected_at=datetime.utcnow())

    return next_entries


@task
def fetch_api_data(next_entry: Union[TmdbMovieDetails, TmdbTvDetails]):
    init_db()

    if isinstance(next_entry, TmdbMovieDetails):
        return fetch_movie_data(next_entry)
    elif isinstance(next_entry, TmdbTvDetails):
        return fetch_tv_data(next_entry)
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def fetch_movie_data(next_entry: TmdbMovieDetails):
    url = (f"https://api.themoviedb.org/3/movie/{next_entry.tmdb_id}"
           f"?api_key={TMDB_API_KEY}"
           f"&append_to_response=alternative_titles,credits,images,keywords,recommendations,release_dates,similar,translations,videos,watch/providers")
    return requests.get(url).json()


def fetch_tv_data(next_entry: TmdbTvDetails):
    url = (f"https://api.themoviedb.org/3/tv/{next_entry.tmdb_id}"
           f"?api_key={TMDB_API_KEY}"
           f"&append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers")
    return requests.get(url).json()


@task
def convert_and_save_details(next_entry: Union[TmdbMovieDetails, TmdbTvDetails], details: dict):
    logger = get_run_logger()

    if isinstance(next_entry, TmdbMovieDetails):
        converted_details = convert_movie_details(details)
    elif isinstance(next_entry, TmdbTvDetails):
        converted_details = convert_tv_details(details)
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

    fields = TmdbMovieDetails._fields if isinstance(next_entry, TmdbMovieDetails) else TmdbTvDetails._fields
    for key in fields:
        if key in converted_details:
            value = converted_details[key]
            if value == "":
                value = None
            field_type = type(fields[key])

            if issubclass(field_type, EmbeddedDocumentListField) and value:
                EmbeddedDoc = fields[key].field.document_type  # Get the EmbeddedDocument type
                value = [EmbeddedDoc(**item) for item in value]

            elif issubclass(field_type, EmbeddedDocumentField) and value:
                EmbeddedDoc = fields[key].document_type  # Get the EmbeddedDocument type
                value = EmbeddedDoc(**value)

            logger.debug(f"{key} => {value}")
            setattr(next_entry, key, value)

    next_entry.updated_at = datetime.utcnow()
    next_entry.save()
    logger.info(f"details saved for tmdb_id: {next_entry.tmdb_id} (popularity: {next_entry.popularity})")


def convert_movie_details(details: dict) -> dict:
    details = convert_common_fields(details)
    if details.get("alternative_titles", None):
        details["alternative_titles"] = details["alternative_titles"]["titles"]
    if details.get("keywords", None):
        details["keywords"] = details["keywords"]["keywords"]
    return details


def convert_tv_details(details: dict) -> dict:
    details = convert_common_fields(details)
    if details.get("alternative_titles", None):
        details["alternative_titles"] = details["alternative_titles"]["results"]
    if details.get("content_ratings", None):
        details["content_ratings"] = details["content_ratings"]["results"]
    if details.get("keywords", None):
        details["keywords"] = details["keywords"]["results"]
    if details.get("last_episode_to_air", None):
        details["last_episode_to_air"]["title"] = details["last_episode_to_air"].pop("name")
    if details.get("original_name", None):
        details["original_title"] = details.pop("original_name")
    if details.get("name", None):
        details["title"] = details.pop("name")
    if details.get("recommendations", None):
        for index, recommendation in enumerate(details["recommendations"]["results"]):
            details["recommendations"]["results"][index]["original_title"] = recommendation.pop("original_name")
            details["recommendations"]["results"][index]["title"] = recommendation.pop("name")
    if details.get("similar", None):
        for index, similar in enumerate(details["similar"]["results"]):
            details["similar"]["results"][index]["original_title"] = similar.pop("original_name")
            details["similar"]["results"][index]["title"] = similar.pop("name")
    if details.get("translations", None):
        for index, translation in enumerate(details["translations"]):
            details["translations"][index]["data"]["title"] = translation["data"].pop("name")
    return details


def convert_common_fields(details: dict) -> dict:
    details = {k: v for k, v in details.items() if k != "id"}
    if details.get("translations", None):
        details["translations"] = details["translations"]["translations"]
    if details.get("videos", None):
        details["videos"] = details["videos"]["results"]
    return details


@flow(task_runner=DaskTaskRunner())
def tmdb_fetch_details_from_api():
    logger = get_run_logger()
    logger.info("Fetch detailed data from TMDB API")
    init_db()

    next_entries = retrieve_next_entries.submit(count=BATCH_SIZE).result()
    if not next_entries:
        logger.warning(f"no entries in tmdb_details")
        return

    # add here some kind of loop that executes the following sequence of tasks in parallel for each entry

    for next_entry in next_entries:
        logger.info(f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity}) - {next_entry.status}")
        init_db()

    list_of_details = fetch_api_data.map(next_entries)
    convert_and_save_details.map(next_entries, list_of_details)


if __name__ == "__main__":
    # while True:
    #     tmdb_fetch_details_from_api()

    deployment = tmdb_fetch_details_from_api.to_deployment(
        name="local",
        interval=60,
    )
    serve(deployment)
