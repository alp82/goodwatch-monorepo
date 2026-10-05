import time
from typing import Optional

from mongoengine import get_db
from pydantic import BaseModel

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
)
from f.sync.copy.deleted_titles import flagged_among

# Rows read from Mongo per page. Crate never sees a page as one request: see `batch_size`.
MONGO_PAGE_SIZE = 50000
DAILY_COLUMNS = ("original_title", "popularity", "adult")

sleep = time.sleep


class DailyTitle(BaseModel):
    """The columns the daily export owns. The upsert names only these, so every other column keeps its value."""

    tmdb_id: int
    original_title: str
    popularity: Optional[float] = None
    adult: Optional[bool] = None


def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def changed_titles(connector: CrateConnector, table: str, titles: list[DailyTitle]) -> list[DailyTitle]:
    """The titles whose row is missing or differs in a column the export owns."""
    rows = connector.select(
        f"SELECT tmdb_id, {', '.join(DAILY_COLUMNS)} FROM {table} WHERE tmdb_id = ANY(?)",
        ([title.tmdb_id for title in titles],),
    )
    stored = {row["tmdb_id"]: row for row in rows}

    def changed(title: DailyTitle) -> bool:
        row = stored.get(title.tmdb_id)
        # The upsert keeps the stored value where the export has none, so a missing value is not a change.
        return row is None or any(
            getattr(title, column) is not None and getattr(title, column) != row[column]
            for column in DAILY_COLUMNS
        )

    return [title for title in titles if changed(title)]


def publish_titles(
    connector: CrateConnector,
    table: str,
    titles: list[DailyTitle],
    counts: dict,
    *,
    batch_size: int,
    pause_seconds: float,
    skip_unchanged: bool,
):
    """Write the titles in small requests, and pause after each one, so that reads get their turn on Crate."""
    for batch in chunks(titles, batch_size):
        counts["records_received"] += len(batch)
        to_write = changed_titles(connector, table, batch) if skip_unchanged else batch
        counts["rows_unchanged"] += len(batch) - len(to_write)
        if not to_write:
            continue
        result = connector.upsert_many(
            table=table,
            records=to_write,
            conflict_columns=["tmdb_id"],
            silent=True,
        )
        counts["rows_upserted"] += result["rows_upserted"]
        if pause_seconds > 0:
            sleep(pause_seconds)


def copy_media(
    connector: CrateConnector,
    query_selector: dict = {},
    *,
    batch_size: int = 2000,
    pause_seconds: float = 0.5,
    skip_unchanged: bool = True,
):
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")

    mongo_db = get_db()
    mongo_collection = mongo_db.tmdb_daily_dump_data

    start = 0
    counts = {
        media_type: {"records_received": 0, "rows_upserted": 0, "rows_unchanged": 0}
        for media_type in ("movie", "show")
    }

    while True:
        titles = {"movie": [], "show": []}

        tmdb_details_batch = list(
            mongo_collection.find(query_selector)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(MONGO_PAGE_SIZE)
        )
        if not tmdb_details_batch:
            break

        print(f"\nBatch from {start} to {start + len(tmdb_details_batch)} TMDB daily entries", flush=True)

        # A stale dump row must not recreate a title that was deleted on TMDB.
        flagged_ids = {
            "movie": flagged_among(mongo_db.tmdb_movie_details, [
                doc["tmdb_id"] for doc in tmdb_details_batch if doc["type"] == "movie"]),
            "show": flagged_among(mongo_db.tmdb_tv_details, [
                doc["tmdb_id"] for doc in tmdb_details_batch if doc["type"] != "movie"]),
        }

        for tmdb_details in tmdb_details_batch:
            # The dump stores ids as strings, and the flagged ids are numbers.
            tmdb_id = int(tmdb_details["tmdb_id"])
            media_type = "movie" if tmdb_details["type"] == "movie" else "show"
            if tmdb_id in flagged_ids[media_type]:
                continue

            original_title = tmdb_details.get("original_title")
            if not original_title:
                continue

            titles[media_type].append(DailyTitle(
                tmdb_id=tmdb_id,
                original_title=original_title,
                popularity=tmdb_details.get("popularity"),
                adult=tmdb_details.get("adult"),
            ))

        for media_type in ("movie", "show"):
            publish_titles(
                connector,
                media_type,
                titles[media_type],
                counts[media_type],
                batch_size=batch_size,
                pause_seconds=pause_seconds,
                skip_unchanged=skip_unchanged,
            )
        print(f"    So far: {counts}", flush=True)

        start += MONGO_PAGE_SIZE

    return {
        "movie_counts": counts["movie"],
        "show_counts": counts["show"],
    }


def main(batch_size: int = 2000, pause_seconds: float = 0.5, skip_unchanged: bool = True):
    init_mongodb()

    connector = CrateConnector()

    print("Processing all daily media entries...")
    query_selector = {}

    results = copy_media(
        connector=connector,
        query_selector=query_selector,
        batch_size=batch_size,
        pause_seconds=pause_seconds,
        skip_unchanged=skip_unchanged,
    )

    connector.disconnect()
    close_mongodb()

    return results
