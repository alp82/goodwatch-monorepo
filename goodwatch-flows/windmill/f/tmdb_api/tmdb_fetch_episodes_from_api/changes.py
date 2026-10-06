from datetime import date, datetime
from typing import Callable

from mongoengine import get_db
import requests

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.episode_catalog import DETAILS_COLLECTION, STATE_COLLECTION, changes_window
from f.tmdb_api.tmdb_fetch_details_from_api.fetch import TMDB_API_KEY

REQUEST_TIMEOUT_SECONDS = 30
CHANGES_STATE_ID = "tv_changes"
# TMDB rejects page 501.
MAX_PAGES = 500
IDS_PER_UPDATE = 1000


def get_changes_page(start: date, end: date, page: int) -> dict:
    response = requests.get(
        "https://api.themoviedb.org/3/tv/changes",
        params={
            "api_key": TMDB_API_KEY,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "page": page,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def changed_show_ids(start: date, end: date, get_page: Callable) -> list[int]:
    """Every show id TMDB's change feed lists for the window, across all its pages."""
    ids = set()
    page = 1
    while True:
        body = get_page(start, end, page)
        ids.update(entry["id"] for entry in body.get("results") or [] if entry.get("id") is not None)
        if page >= min(body.get("total_pages") or 1, MAX_PAGES):
            return sorted(ids)
        page += 1


def read_changes(db, get_page: Callable = get_changes_page, now: datetime | None = None) -> dict:
    """Make the shows TMDB changed since the last run due for an episode fetch.

    Season and episode edits put a show on TMDB's list, so the list is taken as it is.
    The time of this run is stored only after every page was read and applied.
    """
    now = now or datetime.utcnow()
    state = db[STATE_COLLECTION].find_one({"_id": CHANGES_STATE_ID}) or {}
    start, end = changes_window(now, state.get("last_success_at"))
    tmdb_ids = changed_show_ids(start, end, get_page)

    details = db[DETAILS_COLLECTION]
    in_catalog = made_due = 0
    for i in range(0, len(tmdb_ids), IDS_PER_UPDATE):
        batch = {"tmdb_id": {"$in": tmdb_ids[i:i + IDS_PER_UPDATE]}}
        in_catalog += details.update_many(batch, {"$set": {"episodes_changed_at": now}}).matched_count
        # A show that is already due, or was never fetched, keeps its place in the queue.
        made_due += details.update_many(
            batch | {"episodes_due_at": {"$gt": now}}, {"$set": {"episodes_due_at": now}}
        ).modified_count

    db[STATE_COLLECTION].update_one(
        {"_id": CHANGES_STATE_ID},
        {"$set": {"last_success_at": now, "start_date": start.isoformat(), "end_date": end.isoformat(),
                  "shows_changed": len(tmdb_ids), "shows_in_catalog": in_catalog}},
        upsert=True,
    )
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "shows_changed": len(tmdb_ids),
        "shows_in_catalog": in_catalog,
        "shows_made_due": made_due,
    }


def main():
    init_mongodb()
    try:
        return read_changes(get_db())
    finally:
        close_mongodb()
