import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Callable

from mongoengine import get_db
import requests

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.episode_catalog import (
    DETAILS_COLLECTION,
    SEASON_COLLECTION,
    STALE_AFTER_DAYS,
    collect_show_seasons,
    needs_request,
    next_refresh_at,
)
from f.tmdb_api.models import TmdbTvSeasonDetails
from f.tmdb_api.tmdb_fetch_details_from_api.fetch import (
    MAX_FAILED_BATCH_RATIO,
    SYSTEMIC_HTTP_STATUS_CODES,
    TMDB_API_KEY,
    describe_error,
    is_tmdb_deleted_response,
    redact_secrets,
)

# A season with thousands of episodes is several MB of JSON.
REQUEST_TIMEOUT_SECONDS = 60
# TMDB allows about 40 requests per second; 8 parallel requests measured 33 per second.
PARALLEL_SHOWS = 8
RATE_LIMIT_ATTEMPTS = 4
RATE_LIMIT_MAX_WAIT_SECONDS = 10
# A show whose fetch failed, fully or for some seasons, is tried again this soon.
RETRY_FAILED_AFTER = timedelta(days=1)
# A show that is gone waits for the details flow, which owns the tmdb_deleted flag.
RECHECK_GONE_AFTER = timedelta(days=STALE_AFTER_DAYS)

FETCHED, PARTIAL, WITHOUT_SEASONS, GONE, FAILED = "fetched", "partial", "without_seasons", "gone", "failed"


def get_show(tmdb_id: int, season_numbers: list[int]) -> dict:
    """GET /tv/{id} with the given seasons appended. Waits and retries when TMDB answers 429."""
    params = {"api_key": TMDB_API_KEY}
    if season_numbers:
        params["append_to_response"] = ",".join(f"season/{number}" for number in season_numbers)
    for attempt in range(1, RATE_LIMIT_ATTEMPTS + 1):
        response = requests.get(
            f"https://api.themoviedb.org/3/tv/{tmdb_id}", params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
        if response.status_code != 429 or attempt == RATE_LIMIT_ATTEMPTS:
            break
        try:
            wait = float(response.headers.get("Retry-After", 1))
        except ValueError:
            wait = 1
        time.sleep(min(max(wait, 1), RATE_LIMIT_MAX_WAIT_SECONDS))
    response.raise_for_status()
    return response.json()


def save_seasons(db, tmdb_id: int, result, now: datetime):
    seasons = db[SEASON_COLLECTION]
    # A show has two seasons on average, so one write per season is cheap.
    for season in result.seasons:
        seasons.update_one(
            {"tmdb_id": tmdb_id, "season_number": season["season_number"]},
            {"$set": season | {"updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
    if result.complete:
        # Only a complete fetch proves that a season is gone.
        seasons.delete_many({"tmdb_id": tmdb_id, "season_number": {"$nin": result.listed_season_numbers}})


def checked(now: datetime) -> dict:
    return {"episodes_updated_at": now, "episodes_failed_at": None, "episodes_error": None}


def fetch_show(db, show: dict, get: Callable, clock: Callable[[], datetime]) -> dict:
    """Fetch one show's seasons, store them, and write the show's crawl state. Never raises.

    The clock is read after the requests, so episodes_updated_at is the time of the
    write and the Crate copy, which reads by that time, does not miss the show.
    """
    tmdb_id = show["tmdb_id"]
    outcome = {"tmdb_id": tmdb_id}
    stored_season_numbers = [season.get("season_number") for season in show.get("seasons") or []]
    now = clock()
    try:
        if show.get("tmdb_deleted") is True:
            outcome["status"] = GONE
            state = {"episodes_due_at": now + RECHECK_GONE_AFTER}
        elif not needs_request(stored_season_numbers, show.get("episodes_changed_at"), show.get("episodes_updated_at")):
            outcome["status"] = WITHOUT_SEASONS
            state = checked(now) | {"episodes_complete": False, "episodes_due_at": next_refresh_at(now, [])}
        else:
            result = collect_show_seasons(tmdb_id, stored_season_numbers, get)
            now = clock()
            save_seasons(db, tmdb_id, result, now)
            air_dates = [episode.get("air_date") for season in result.seasons for episode in season["episodes"]]
            outcome["seasons"] = len(result.seasons)
            if result.complete or not result.listed_season_numbers:
                outcome["status"] = FETCHED if result.complete else WITHOUT_SEASONS
                state = checked(now) | {
                    "episodes_complete": result.complete,
                    "episodes_due_at": next_refresh_at(now, air_dates),
                }
            else:
                outcome["status"] = PARTIAL
                if result.error is not None:
                    outcome |= describe_error(result.error)
                else:
                    outcome["error"] = "MissingSeasons"
                    outcome["message"] = f"TMDB lists seasons it did not return: {result.missing_season_numbers[:20]}"
                state = {
                    "episodes_updated_at": now,
                    "episodes_complete": False,
                    "episodes_due_at": now + RETRY_FAILED_AFTER,
                    "episodes_failed_at": now,
                    "episodes_error": outcome["error"],
                }
    except Exception as error:
        now = clock()
        if isinstance(error, requests.HTTPError) and is_tmdb_deleted_response(error.response):
            outcome["status"] = GONE
            state = {"episodes_due_at": now + RECHECK_GONE_AFTER}
        else:
            outcome |= {"status": FAILED} | describe_error(error)
            state = {
                "episodes_due_at": now + RETRY_FAILED_AFTER,
                "episodes_failed_at": now,
                "episodes_error": outcome["error"],
            }
    try:
        db[DETAILS_COLLECTION].update_many({"tmdb_id": tmdb_id}, {"$set": state})
    except Exception as error:
        # The lease from the queue makes the show due again within the hour.
        print(f"could not write the episode state of {tmdb_id}: {redact_secrets(error)}")
        outcome |= {"status": FAILED} | describe_error(error)
    return outcome


def fetch_episodes(db, tmdb_ids: list[int], get: Callable = get_show, now: Callable = datetime.utcnow) -> dict:
    """Fetch the episodes of these shows and report what happened to each."""
    shows = list(
        db[DETAILS_COLLECTION].find(
            {"tmdb_id": {"$in": [int(tmdb_id) for tmdb_id in tmdb_ids]}},
            {"tmdb_id": 1, "seasons.season_number": 1, "tmdb_deleted": 1,
             "episodes_changed_at": 1, "episodes_updated_at": 1},
        )
    )
    with ThreadPoolExecutor(max_workers=PARALLEL_SHOWS) as executor:
        outcomes = list(executor.map(lambda show: fetch_show(db, show, get, now), shows))

    counts = {status: 0 for status in (FETCHED, PARTIAL, WITHOUT_SEASONS, GONE, FAILED)}
    for outcome in outcomes:
        counts[outcome["status"]] += 1
    # A partial fetch counts as a failure only when a request failed, not when TMDB left a season out.
    failed = [
        {key: value for key, value in outcome.items() if key not in ("status", "seasons")}
        for outcome in outcomes
        if outcome["status"] == FAILED or (outcome["status"] == PARTIAL and outcome["error"] != "MissingSeasons")
    ]
    result = {
        "count_shows": len(shows),
        "count_fetched": counts[FETCHED],
        "count_partial": counts[PARTIAL],
        "count_without_seasons": counts[WITHOUT_SEASONS],
        "count_gone": counts[GONE],
        "count_failed": counts[FAILED],
        "count_seasons": sum(outcome.get("seasons", 0) for outcome in outcomes),
        "failed": failed,
        "incomplete": [
            {key: value for key, value in outcome.items() if key != "status"}
            for outcome in outcomes
            if outcome["status"] == PARTIAL
        ],
    }
    systemic_statuses = sorted(
        {entry["http_status"] for entry in failed if entry.get("http_status") in SYSTEMIC_HTTP_STATUS_CODES}
    )
    count_requested = len(shows) - counts[GONE] - counts[WITHOUT_SEASONS]
    if failed and (
        systemic_statuses
        or len(failed) == count_requested
        or len(failed) > len(shows) * MAX_FAILED_BATCH_RATIO
    ):
        # Raised only now, after every show that could be fetched is stored.
        raise RuntimeError(
            redact_secrets(
                f"tmdb episodes batch failed: {len(failed)} failed, {counts[FETCHED]} fetched of {len(shows)} shows"
                f" (systemic http status: {systemic_statuses}); sample errors: {failed[:3]}"
            )
        )
    return result


def main(next_ids: dict):
    init_mongodb()
    try:
        TmdbTvSeasonDetails.ensure_indexes()
        return fetch_episodes(get_db(), next_ids.get("tmdb_ids", []))
    finally:
        close_mongodb()
