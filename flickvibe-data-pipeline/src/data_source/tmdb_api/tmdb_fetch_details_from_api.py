from datetime import datetime, timedelta
from typing import Union

import requests
from mongoengine import EmbeddedDocumentField, EmbeddedDocumentListField, Q
from prefect import flow, get_run_logger, serve, task
from prefect_dask.task_runners import DaskTaskRunner

from src.data_source.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from src.data_source.common import prepare_next_entries
from src.utils.db import init_db

BATCH_SIZE = 50
BUFFER_SELECTED_AT_MINUTES = 10
# TODO dotenv
TMDB_API_KEY = "df95f1bae98baaf28e1c06d7a2762e27"


@task
def retrieve_next_entries(count: int) -> Union[TmdbMovieDetails, TmdbTvDetails]:
    init_db()
    next_entries = prepare_next_entries(
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
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
                value = [EmbeddedDoc(**clean_empty_strings(item)) for item in value]

            elif issubclass(field_type, EmbeddedDocumentField) and value:
                EmbeddedDoc = fields[key].document_type  # Get the EmbeddedDocument type
                value = EmbeddedDoc(**clean_empty_strings(value))

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
    if details.get("next_episode_to_air", None):
        details["next_episode_to_air"]["title"] = details["next_episode_to_air"].pop("name")
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


def clean_empty_strings(data):
    for key, value in data.items():
        if isinstance(value, dict):
            clean_empty_strings(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    clean_empty_strings(item)
        elif value == "":
            data[key] = None
    return data


@flow(task_runner=DaskTaskRunner())
def tmdb_fetch_details_from_api():
    logger = get_run_logger()
    logger.info("Fetch detailed data from TMDB API")
    init_db()

    next_entries = retrieve_next_entries.submit(count=BATCH_SIZE).result()
    if not next_entries:
        logger.warning(f"no entries to fetch in tmdb details")
        return

    # add here some kind of loop that executes the following sequence of tasks in parallel for each entry

    for next_entry in next_entries:
        logger.info(f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity}) - {next_entry.status}")
        init_db()

    list_of_details = fetch_api_data.map(next_entries)
    convert_and_save_details.map(next_entries, list_of_details)


if __name__ == "__main__":
    tmdb_fetch_details_from_api()

    deployment = tmdb_fetch_details_from_api.to_deployment(
        name="local",
        interval=60,
    )
    serve(deployment)
