import asyncio
import re
from datetime import datetime
from typing import Union

from mongoengine import EmbeddedDocumentField, EmbeddedDocumentListField
import requests
import wmill

from f.data_source.common import get_documents_for_ids
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.deleted_propagation import propagate_tmdb_deleted
from f.tmdb_api.provider_evidence import capture_provider_check, snapshot_id
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


BATCH_SIZE = 30
BUFFER_SELECTED_AT_MINUTES = 10
TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


TMDB_STATUS_RESOURCE_NOT_FOUND = 34
REQUEST_TIMEOUT_SECONDS = 30
# The job fails when more than this share of the batch failed, so outages stay visible.
MAX_FAILED_BATCH_RATIO = 0.5
# A rejected api key fails every title, so a single 401 marks the batch as broken.
SYSTEMIC_HTTP_STATUS_CODES = (401,)
ERROR_MESSAGE_MAX_LENGTH = 200


def redact_secrets(message: str) -> str:
    # requests puts the full url, including the api key, into its error messages.
    message = re.sub(r"api_key=[^&\s'\")]+", "api_key=REDACTED", str(message))
    if TMDB_API_KEY:
        message = message.replace(str(TMDB_API_KEY), "REDACTED")
    return message


def describe_error(error: BaseException) -> dict:
    # Never str() an HTTPError: report the status and TMDB's own error body instead.
    description = {"error": type(error).__name__}
    response = getattr(error, "response", None)
    if isinstance(error, requests.HTTPError) and response is not None:
        description["http_status"] = response.status_code
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            description["tmdb_status_code"] = body.get("status_code")
            message = redact_secrets(body.get("status_message") or "")
            description["message"] = message[:ERROR_MESSAGE_MAX_LENGTH]
    else:
        description["message"] = redact_secrets(error)[:ERROR_MESSAGE_MAX_LENGTH]
    return description


class FailedEntry:
    def __init__(self, next_entry, error: BaseException):
        self.next_entry = next_entry
        self.description = {
            "media_type": "movie" if isinstance(next_entry, TmdbMovieDetails) else "tv",
            "tmdb_id": next_entry.tmdb_id,
        } | describe_error(error)


async def isolate_failure(next_entry, coroutine):
    # One broken title must not lose the rest of the batch.
    try:
        return await coroutine
    except Exception as error:
        failed_entry = FailedEntry(next_entry, error)
        print(f"failed entry: {failed_entry.description}")
        try:
            # Release the title: with is_selected=False it leaves the popularity-ordered
            # retry pool and waits behind older selected_at entries instead of looping.
            next_entry.update(set__is_selected=False)
        except Exception as release_error:
            print(f"could not release {next_entry.tmdb_id}: {redact_secrets(release_error)}")
        return failed_entry


def is_tmdb_deleted_response(response) -> bool:
    # Only a 404 carrying TMDB's own "resource not found" code means the title is gone.
    if response is None or response.status_code != 404:
        return False
    try:
        body = response.json()
    except ValueError:
        return False
    return isinstance(body, dict) and body.get("status_code") == TMDB_STATUS_RESOURCE_NOT_FOUND


async def fetch_api_data(
    next_entry: Union[TmdbMovieDetails, TmdbTvDetails],
) -> tuple[dict, Union[TmdbMovieDetails, TmdbTvDetails]]:
    try:
        if isinstance(next_entry, TmdbMovieDetails):
            return fetch_movie_data(next_entry)
        elif isinstance(next_entry, TmdbTvDetails):
            return fetch_tv_data(next_entry)
        raise TypeError("Unexpected TMDB media model")
    except requests.HTTPError as e:
        if is_tmdb_deleted_response(e.response):
            # Title was removed from TMDB; flag it and release it so it doesn't fail the batch.
            # updated_at is bumped so the downstream sync picks the deletion up.
            now = datetime.utcnow()
            next_entry.update(
                set__watch_providers_attempted_at=now,
                set__watch_providers_error="tmdb_not_found",
                set__tmdb_deleted=True,
                set__tmdb_deleted_at=now,
                set__updated_at=now,
                set__is_selected=False,
            )
            print(f"skipping {next_entry.original_title} (id: {next_entry.tmdb_id}): deleted on TMDB")
            return None
        next_entry.update(set__watch_providers_attempted_at=datetime.utcnow(), set__watch_providers_error="provider_request_failed")
        raise
    except Exception:
        next_entry.update(set__watch_providers_attempted_at=datetime.utcnow(), set__watch_providers_error="provider_request_failed")
        raise


def fetch_movie_data(next_entry: TmdbMovieDetails) -> tuple[dict, TmdbMovieDetails]:
    url = (
        f"https://api.themoviedb.org/3/movie/{next_entry.tmdb_id}"
        f"?api_key={TMDB_API_KEY}"
        f"&append_to_response=alternative_titles,credits,images,keywords,recommendations,release_dates,similar,translations,videos,watch/providers"
    )
    response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json(), next_entry


def fetch_tv_data(next_entry: TmdbTvDetails) -> tuple[dict, TmdbTvDetails]:
    url = (
        f"https://api.themoviedb.org/3/tv/{next_entry.tmdb_id}"
        f"?api_key={TMDB_API_KEY}"
        f"&append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers"
    )
    response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json(), next_entry


async def convert_and_save_details(
    next_entry: Union[TmdbMovieDetails, TmdbTvDetails], details: dict
):
    now = datetime.utcnow()
    try:
        proof = capture_provider_check(details, next_entry.tmdb_id, now)
    except ValueError:
        next_entry.update(set__watch_providers_attempted_at=now, set__watch_providers_error="identity_mismatch")
        raise
    next_entry.watch_providers_attempted_at = now
    next_entry.watch_providers_error = "" if proof else "missing_or_invalid_provider_response"
    if proof:
        next_entry.watch_providers_check = proof
    else:
        # Keep prior payload and proof together; omission must never refresh them.
        details.pop("watch/providers", None)
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

    if proof:
        # Bind to Mongo's normalized representation, including cleaned strings.
        next_entry.watch_providers_check = proof | {"payload_hash": snapshot_id(next_entry.watch_providers.to_mongo().to_dict())}
    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    # A title that comes back on TMDB is restored.
    was_deleted = next_entry.tmdb_deleted is True
    next_entry.tmdb_deleted = False
    next_entry.tmdb_deleted_at = None
    try:
        next_entry.save()
        print(
            f"details saved for {next_entry.title} (id: {next_entry.tmdb_id}) (popularity: {next_entry.popularity})"
        )
    except Exception as e:
        print(f"error for {next_entry.title} (id: {next_entry.tmdb_id})")
        print(redact_secrets(e))
        raise e

    if was_deleted:
        media_type = "movie" if isinstance(next_entry, TmdbMovieDetails) else "tv"
        propagate_tmdb_deleted(media_type, [next_entry.tmdb_id], False)

    return converted_details


def convert_movie_details(details: dict) -> dict:
    details = convert_common_fields(details)
    if details.get("alternative_titles", None):
        details["alternative_titles"] = details["alternative_titles"].get("titles")
    if details.get("keywords", None):
        details["keywords"] = details["keywords"]["keywords"]
    if details.get("release_dates", {}).get("results", None):
        for i, release_dates_result in enumerate(details["release_dates"]["results"]):
            for j, release_date_result in enumerate(
                release_dates_result["release_dates"]
            ):
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
    if details.get("id", None):
        details["tmdb_id"] = details.pop("id")
    if details.get("translations") and "translations" in details["translations"]:
        details["translations"] = details["translations"]["translations"]
    if details.get("images") and "results" in details["images"]:
        details["images"] = details["images"]["results"]
    if details.get("videos") and "results" in details["videos"]:
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
        *[
            isolate_failure(next_entry, fetch_api_data(next_entry))
            for next_entry in next_entries
        ]
    )
    failed_entries = [result for result in list_of_details if isinstance(result, FailedEntry)]
    # A None result means the title was flagged as deleted on TMDB.
    deleted_tmdb_ids = {"movie_ids": [], "tv_ids": []}
    for next_entry, result in zip(next_entries, list_of_details):
        if result is None:
            key = "movie_ids" if isinstance(next_entry, TmdbMovieDetails) else "tv_ids"
            deleted_tmdb_ids[key].append(next_entry.tmdb_id)
    propagate_tmdb_deleted("movie", deleted_tmdb_ids["movie_ids"], True)
    propagate_tmdb_deleted("tv", deleted_tmdb_ids["tv_ids"], True)
    list_of_details = [
        result
        for result in list_of_details
        if result is not None and not isinstance(result, FailedEntry)
    ]
    converted_details = await asyncio.gather(
        *[
            isolate_failure(next_entry, convert_and_save_details(next_entry, details))
            for details, next_entry in list_of_details
        ]
    )
    failed_entries += [result for result in converted_details if isinstance(result, FailedEntry)]
    converted_details = [
        result for result in converted_details if not isinstance(result, FailedEntry)
    ]

    count_deleted = sum(len(ids) for ids in deleted_tmdb_ids.values())
    count_failed = len(failed_entries)
    count_not_deleted = len(next_entries) - count_deleted
    systemic_statuses = sorted(
        {
            failed_entry.description["http_status"]
            for failed_entry in failed_entries
            if failed_entry.description.get("http_status") in SYSTEMIC_HTTP_STATUS_CODES
        }
    )
    if count_failed and (
        systemic_statuses
        or count_failed == count_not_deleted
        or count_failed > len(next_entries) * MAX_FAILED_BATCH_RATIO
    ):
        # Raised only now, after the good titles are saved and deleted ones propagated.
        errors = sorted({str(failed_entry.description) for failed_entry in failed_entries})[:3]
        raise RuntimeError(
            redact_secrets(
                f"tmdb details batch failed: {count_failed} failed, {len(converted_details)} saved, "
                f"{count_deleted} deleted of {len(next_entries)} titles"
                f" (systemic http status: {systemic_statuses}); sample errors: {errors}"
            )
        )

    return {
        "count_new_entries": len(converted_details),
        "count_failed_entries": count_failed,
        "failed_entries": [failed_entry.description for failed_entry in failed_entries],
        "count_deleted_entries": sum(len(ids) for ids in deleted_tmdb_ids.values()),
        "deleted_tmdb_ids": deleted_tmdb_ids,
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
