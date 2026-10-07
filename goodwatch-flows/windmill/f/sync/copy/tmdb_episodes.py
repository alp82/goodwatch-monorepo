"""Copy the episodes fetched from TMDB into the Crate `episode` table (docs/episode-catalog.md)."""
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import init_mongodb, close_mongodb
from f.sync.models.crate_models import Episode
from f.sync.models.crate_schemas import SCHEMAS
from f.tmdb_api.episode_catalog import (
    DETAILS_COLLECTION,
    EPISODE_COLUMNS,
    SEASON_COLLECTION,
    STATE_COLLECTION,
    aired_episode_count,
    diff_episodes,
    episode_rows,
)

COPY_STATE_ID = "episodes_copy"
# The index that covers the read of the shows fetched since the checkpoint.
FETCHED_INDEX = [("episodes_updated_at", 1), ("tmdb_id", 1), ("episodes_complete", 1)]
SHOWS_PER_BATCH = 200
# Shows are compared with Crate in groups of about this many episodes, so one long-running
# daily show does not load with 199 others.
ROWS_PER_GROUP = 20_000
# Each run starts this long before its checkpoint, so a show written while the last run
# was reading is not missed. Reading a show twice writes nothing.
CHECKPOINT_OVERLAP = timedelta(minutes=15)
# A run stops taking new batches after this long; the next run continues at the checkpoint.
MAX_RUN_SECONDS = 240
# TMDB's terms forbid keeping its data longer than 6 months.
PURGE_REMOVED_AFTER = timedelta(days=180)
EPOCH = datetime(1970, 1, 1)

STORED_COLUMNS = ("show_id", "tmdb_id", *EPISODE_COLUMNS, "removed_at")
SELECT_STORED = f"SELECT {', '.join(STORED_COLUMNS)} FROM episode WHERE show_id = ANY(?)"
MARK_REMOVED = "UPDATE episode SET removed_at = ?, updated_at = ? WHERE show_id = ? AND tmdb_id = ANY(?)"
MARK_SHOW = "UPDATE show SET episodes_updated_at = ?, aired_episode_count = ? WHERE tmdb_id = ?"
PURGE_REMOVED = "DELETE FROM episode WHERE removed_at < ?"


def millis(moment: datetime) -> int:
    """A naive UTC datetime, as Mongo returns it, in the milliseconds Crate stores."""
    return int(moment.replace(tzinfo=timezone.utc).timestamp() * 1000)


def fetched_shows(db, since: datetime, limit: int) -> list[dict]:
    """Shows whose episodes were fetched at or after `since`, oldest fetch first. Answered by the index alone."""
    return list(
        db[DETAILS_COLLECTION]
        .find(
            {"episodes_updated_at": {"$gte": since}},
            {"_id": 0, "tmdb_id": 1, "episodes_updated_at": 1, "episodes_complete": 1},
        )
        .hint(FETCHED_INDEX)
        .sort(FETCHED_INDEX[:2])
        .limit(limit)
    )


def named_shows(db, tmdb_ids: list[int]) -> list[dict]:
    return list(
        db[DETAILS_COLLECTION].find(
            {"tmdb_id": {"$in": [int(tmdb_id) for tmdb_id in tmdb_ids]}, "episodes_updated_at": {"$ne": None}},
            {"_id": 0, "tmdb_id": 1, "episodes_updated_at": 1, "episodes_complete": 1},
        )
    )


def row_groups(rows_by_show: dict[int, list[dict]]) -> list[list[int]]:
    """The shows in groups that each hold about ROWS_PER_GROUP episodes."""
    groups, group, size = [], [], 0
    for show_id, rows in rows_by_show.items():
        group.append(show_id)
        size += len(rows)
        if size >= ROWS_PER_GROUP:
            groups.append(group)
            group, size = [], 0
    if group:
        groups.append(group)
    return groups


def copy_shows(connector, db, shows: list[dict], now: datetime) -> dict:
    """Bring the episode rows of these shows in line with their season documents.

    Each show also gets aired_episode_count, counted from the rows it has once this copy
    is written, with the UTC date of `now` as today. It is written even when no episode
    changed, because an episode listed last week airs today.
    """
    stats = {"episodes_upserted": 0, "episodes_removed": 0}
    complete = {show["tmdb_id"]: show.get("episodes_complete") is True for show in shows}
    documents_by_show = {show_id: [] for show_id in complete}
    for document in db[SEASON_COLLECTION].find({"tmdb_id": {"$in": list(complete)}}):
        documents_by_show[document["tmdb_id"]].append(document)
    rows_by_show = {show_id: episode_rows(show_id, documents) for show_id, documents in documents_by_show.items()}

    now_millis = millis(now)
    today = now.date()
    aired_counts = {}
    for group in row_groups(rows_by_show):
        stored_by_show = {show_id: [] for show_id in group}
        for row in connector.select(SELECT_STORED, (group,)):
            stored_by_show[row["show_id"]].append(row)
        upserts, removals = [], []
        for show_id in group:
            diff = diff_episodes(rows_by_show[show_id], stored_by_show[show_id], may_remove=complete[show_id])
            upserts += [Episode(**row) for row in diff.upserts]
            if diff.removed_ids:
                removals.append((now_millis, now_millis, show_id, diff.removed_ids))
                stats["episodes_removed"] += len(diff.removed_ids)
            # Stored episodes the fetch did not list stay as they are, unless they were just removed.
            replaced = {row["tmdb_id"] for row in rows_by_show[show_id]} | set(diff.removed_ids)
            kept = [row for row in stored_by_show[show_id] if row["tmdb_id"] not in replaced]
            aired_counts[show_id] = aired_episode_count(rows_by_show[show_id] + kept, today)
        if upserts:
            # replace_nulls: the copy owns every column it writes, so a runtime TMDB dropped and
            # the removed_at of an episode that came back are cleared.
            connector.upsert_many(
                table="episode",
                records=upserts,
                conflict_columns=SCHEMAS["episode"]["primary_key"],
                silent=True,
                replace_nulls=True,
            )
            stats["episodes_upserted"] += len(upserts)
        if removals:
            connector.run_many(MARK_REMOVED, removals)

    # Last, so a show is only marked once its rows are written.
    connector.run_many(
        MARK_SHOW,
        [(millis(show["episodes_updated_at"]), aired_counts[show["tmdb_id"]], show["tmdb_id"]) for show in shows],
    )
    return stats


def copy_episodes(
    connector,
    db,
    tmdb_ids: Optional[list[int]] = None,
    now: Optional[datetime] = None,
    max_seconds: float = MAX_RUN_SECONDS,
) -> dict:
    """Copy the shows fetched since the last run, or the named shows.

    Without ids the run continues at its checkpoint, the fetch time of the last show it
    copied, and works through the shows fetched since in batches until none is left or
    the time is up. A run for named shows leaves the checkpoint alone.
    """
    now = now or datetime.utcnow()
    result = {"shows_copied": 0, "episodes_upserted": 0, "episodes_removed": 0, "episodes_purged": 0}

    def copy_batch(shows: list[dict]):
        stats = copy_shows(connector, db, shows, now)
        result["shows_copied"] += len(shows)
        result["episodes_upserted"] += stats["episodes_upserted"]
        result["episodes_removed"] += stats["episodes_removed"]
        print(f"Copied {len(shows)} shows: {stats}", flush=True)

    if tmdb_ids:
        shows = named_shows(db, tmdb_ids)
        for start in range(0, len(shows), SHOWS_PER_BATCH):
            copy_batch(shows[start:start + SHOWS_PER_BATCH])
    else:
        started = time.monotonic()
        state = db[STATE_COLLECTION].find_one({"_id": COPY_STATE_ID}) or {}
        checkpoint = state.get("copied_until")
        cursor = checkpoint - CHECKPOINT_OVERLAP if checkpoint else EPOCH
        # Shows already copied in this run that share the cursor's fetch time.
        copied_at_cursor = set()
        result["caught_up"] = False
        while True:
            page = fetched_shows(db, cursor, SHOWS_PER_BATCH + len(copied_at_cursor))
            shows = [
                show for show in page
                if not (show["episodes_updated_at"] == cursor and show["tmdb_id"] in copied_at_cursor)
            ]
            if not shows:
                result["caught_up"] = True
                break
            copy_batch(shows)
            last = shows[-1]["episodes_updated_at"]
            if last != cursor:
                copied_at_cursor = set()
            copied_at_cursor |= {show["tmdb_id"] for show in shows if show["episodes_updated_at"] == last}
            cursor = last
            if checkpoint is None or cursor > checkpoint:
                checkpoint = cursor
                db[STATE_COLLECTION].update_one(
                    {"_id": COPY_STATE_ID}, {"$set": {"copied_until": checkpoint, "updated_at": now}}, upsert=True
                )
            if time.monotonic() - started >= max_seconds:
                print("Out of time; the next run continues at the checkpoint.", flush=True)
                break
        result["copied_until"] = checkpoint.isoformat() if checkpoint else None

    connector.run(PURGE_REMOVED, (millis(now - PURGE_REMOVED_AFTER),))
    result["episodes_purged"] = max(connector.cur.rowcount or 0, 0)
    return result


def main(tmdb_ids: list[int] = [], max_seconds: int = MAX_RUN_SECONDS):
    # Windmill passes None for an argument the caller left out, so the defaults above don't apply.
    tmdb_ids = tmdb_ids or []
    max_seconds = max_seconds or MAX_RUN_SECONDS
    init_mongodb()
    connector = CrateConnector()
    try:
        return copy_episodes(connector, get_db(), tmdb_ids=tmdb_ids, max_seconds=max_seconds)
    finally:
        connector.disconnect()
        close_mongodb()


if __name__ == "__main__":
    main()
