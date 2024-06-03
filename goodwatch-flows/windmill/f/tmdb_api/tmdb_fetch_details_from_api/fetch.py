import asyncio
from datetime import datetime
from typing import Union

from mongoengine import EmbeddedDocumentField, EmbeddedDocumentListField
import requests
import wmill

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


BATCH_SIZE = 30
BUFFER_SELECTED_AT_MINUTES = 10
TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


async def fetch_api_data(
    next_entry: Union[TmdbMovieDetails, TmdbTvDetails],
) -> tuple[dict, Union[TmdbMovieDetails, TmdbTvDetails]]:
    if isinstance(next_entry, TmdbMovieDetails):
        return fetch_movie_data(next_entry)
    elif isinstance(next_entry, TmdbTvDetails):
        return fetch_tv_data(next_entry)
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")


def fetch_movie_data(next_entry: TmdbMovieDetails) -> tuple[dict, TmdbMovieDetails]:
    url = (
        f"https://api.themoviedb.org/3/movie/{next_entry.tmdb_id}"
        f"?api_key={TMDB_API_KEY}"
        f"&append_to_response=alternative_titles,credits,images,keywords,recommendations,release_dates,similar,translations,videos,watch/providers"
    )
    return requests.get(url).json(), next_entry


def fetch_tv_data(next_entry: TmdbTvDetails) -> tuple[dict, TmdbTvDetails]:
    url = (
        f"https://api.themoviedb.org/3/tv/{next_entry.tmdb_id}"
        f"?api_key={TMDB_API_KEY}"
        f"&append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers"
    )
    return requests.get(url).json(), next_entry


async def convert_and_save_details(
    next_entry: Union[TmdbMovieDetails, TmdbTvDetails], details: dict
):
    if isinstance(next_entry, TmdbMovieDetails):
        converted_details = convert_movie_details(details)
    elif isinstance(next_entry, TmdbTvDetails):
        converted_details = convert_tv_details(details)
    else:
        raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

    fields = (
        TmdbMovieDetails._fields
        if isinstance(next_entry, TmdbMovieDetails)
        else TmdbTvDetails._fields
    )
    for key in fields:
        if key in converted_details:
            value = converted_details[key]
            if value == "":
                value = None
            field_type = type(fields[key])

            if issubclass(field_type, EmbeddedDocumentListField) and value:
                EmbeddedDoc = fields[key].field.document_type
                value = [EmbeddedDoc(**clean_empty_strings(item)) for item in value]

            elif issubclass(field_type, EmbeddedDocumentField) and value:
                EmbeddedDoc = fields[key].document_type
                value = EmbeddedDoc(**clean_empty_strings(value))

            setattr(next_entry, key, value)

    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    try:
        next_entry.save()
        print(
            f"details saved for {next_entry.title} (id: {next_entry.tmdb_id}) (popularity: {next_entry.popularity})"
        )
    except Exception as e:
        print(f"error for {next_entry.title} (id: {next_entry.tmdb_id})")
        print(e)
        raise e

    return converted_details


def convert_movie_details(details: dict) -> dict:
    details = convert_common_fields(details)
    if details.get("alternative_titles", None):
        details["alternative_titles"] = details["alternative_titles"].get("titles")
    if details.get("keywords", None):
        details["keywords"] = details["keywords"]["keywords"]
    if details.get("release_dates", None):
        for i, release_dates_result in enumerate(details["release_dates"]["results"]):
            for j, release_date_result in enumerate(
                release_dates_result["release_dates"]
            ):
                print(release_date_result)
                release_date = release_date_result.get("release_date")
                if release_date:
                    details["release_dates"]["results"][i]["release_dates"][j][
                        "release_date"
                    ] = datetime.fromisoformat(
                        release_date.replace("Z", "+00:00")
                    ).date()
    return details


def convert_tv_details(details: dict) -> dict:
    details = convert_common_fields(details)
    if details.get("alternative_titles", None):
        details["alternative_titles"] = details["alternative_titles"].get("results")
    if details.get("content_ratings", None):
        details["content_ratings"] = details["content_ratings"]["results"]
    if details.get("keywords", None):
        details["keywords"] = details["keywords"]["results"]
    if details.get("last_episode_to_air", None):
        details["last_episode_to_air"]["title"] = details["last_episode_to_air"].pop(
            "name"
        )
    if details.get("next_episode_to_air", None):
        details["next_episode_to_air"]["title"] = details["next_episode_to_air"].pop(
            "name"
        )
    if details.get("original_name", None):
        details["original_title"] = details.pop("original_name")
    if details.get("name", None):
        details["title"] = details.pop("name")
    if details.get("recommendations", None):
        for index, recommendation in enumerate(details["recommendations"]["results"]):
            details["recommendations"]["results"][index][
                "original_title"
            ] = recommendation.pop("original_name")
            details["recommendations"]["results"][index]["title"] = recommendation.pop(
                "name"
            )
    if details.get("similar", None):
        for index, similar in enumerate(details["similar"]["results"]):
            details["similar"]["results"][index]["original_title"] = similar.pop(
                "original_name"
            )
            details["similar"]["results"][index]["title"] = similar.pop("name")
    if details.get("translations", None):
        for index, translation in enumerate(details["translations"]):
            details["translations"][index]["data"]["title"] = translation["data"].pop(
                "name"
            )
    return details


def convert_common_fields(details: dict) -> dict:
    details = {k: v for k, v in details.items() if k != "id"}
    if details.get("translations", None):
        details["translations"] = details["translations"]["translations"]
    if details.get("videos", None):
        details["videos"] = details["videos"]["results"]
    if details.get("watch/providers", None):
        details["watch_providers"] = details.pop("watch/providers")
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


async def tmdb_fetch_details_from_api(
    next_entries: list[Union[TmdbMovieDetails, TmdbTvDetails]],
):
    print("Fetch detailed data from TMDB API")

    if not next_entries:
        print("warning: no entries to fetch in tmdb details")
        return

    for next_entry in next_entries:
        print(
            f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity}) - {next_entry.status}"
        )

    list_of_details = await asyncio.gather(
        *[fetch_api_data(next_entry) for next_entry in next_entries]
    )
    converted_details = await asyncio.gather(
        *[
            convert_and_save_details(next_entry, details)
            for details, next_entry in list_of_details
        ]
    )

    return {
        "count_new_entries": len(list_of_details),
        "entries": [
            {
                "tmdb_id": details.get("tmdb_id"),
                "title": details.get("title"),
                "popularity": details.get("popularity"),
                "genres": ", ".join(
                    [genre.get("name") for genre in details.get("genres", [])]
                ),
            }
            for details in converted_details
        ],
    }


def main(next_ids: dict):
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=TmdbMovieDetails,
        tv_model=TmdbTvDetails,
    )
    result = asyncio.run(tmdb_fetch_details_from_api(next_entries))
    close_mongodb()
    return result
