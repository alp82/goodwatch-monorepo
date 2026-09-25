"""Daily ingest of the IMDb non-commercial datasets (https://datasets.imdbws.com).

GoodWatch is non-commercial and uses the datasets under their license, which requires the
attribution "Information courtesy of IMDb (https://www.imdb.com). Used with permission."

One run:

1. Reads the stored title ratings and the TMDB details changed since the last run, and sends
   a HEAD request for `title.ratings` and `title.episode`. It skips when both ETags are the
   ones it stored, TMDB moved no title to another IMDb id, and no Crate sync is left over.
2. Downloads both files (about 65 MB) and, once a week, `title.basics` for episode titles.
3. Diffs them against the stored Mongo values in DuckDB (`f/imdb_datasets/diff`) and writes
   only the changes:
   - title ratings to `imdb_movie_rating` and `imdb_tv_rating` (keyed by TMDB id), which
     `f/sync/copy/all_ratings` and `f/sync/copy/vector_data` copy to Crate and Qdrant when a
     change moves `updated_at`;
   - episode ratings to `imdb_tv_episode_rating` (keyed by the episode tconst);
   - season scores to `imdb_tv_season_rating` (keyed by show tconst and season number).
4. Rewrites the Crate `imdb_episode` and `imdb_season` rows of the shows that changed, fanned
   out to every TMDB show linked to the IMDb id.

The run stores its state in `imdb_dataset_state` and a summary per run in
`imdb_dataset_runs`. It fails, so monitoring alerts, when the ratings file is older than 48 h,
shrank by more than 5 %, or would change more than half of the stored titles (both checked
before any write), and when two runs in a row change no title.
"""

import json
import os
import resource
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import duckdb
from mongoengine import get_db
from pymongo import ASCENDING, DeleteOne, UpdateOne

from f.db.cratedb import CrateConnector
from f.db.mongodb import close_mongodb, init_mongodb
from f.imdb_datasets import diff
from f.sync.models.crate_models import ImdbEpisode, ImdbSeason
from f.sync.models.crate_schemas import SCHEMAS

BASE_URL = "https://datasets.imdbws.com/"
USER_AGENT = "GoodWatchBot/1.0 (+https://goodwatch.app)"
RATINGS_FILE, EPISODE_FILE = diff.DAILY_FILES
NAMES_FILE = "title.basics.tsv.gz"
NAMES_REFRESH_DAYS = 7

SOURCE = "imdb_dataset"
STATE_ID = "daily"
TITLE_COLLECTIONS = {"movie": "imdb_movie_rating", "tv": "imdb_tv_rating"}
DETAILS = {
    "movie": ("tmdb_movie_details", "imdb_id"),
    "tv": ("tmdb_tv_details", "external_ids.imdb_id"),
}
EPISODES = "imdb_tv_episode_rating"
SEASONS = "imdb_tv_season_rating"
STATE = "imdb_dataset_state"
RUNS = "imdb_dataset_runs"

DUCKDB_MEMORY = "1GB"
DUCKDB_THREADS = 2
MONGO_BATCH = 5000
# Re-read TMDB details this long before the last run, so a slow write is not missed.
DETAILS_OVERLAP = timedelta(hours=1)
CRATE_SHOWS_PER_BATCH = 200

STALE_AFTER = timedelta(hours=48)
MAX_SHRINK = 0.05
MAX_CHANGED_SHARE = 0.5


class DatasetAlert(RuntimeError):
    """A monitoring condition: the run fails so the monitoring check reports it."""


# ===== Files =====


def head(name: str) -> dict:
    request = urllib.request.Request(BASE_URL + name, method="HEAD", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return {
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
            "run_date": response.headers.get("x-amz-meta-run-date"),
            "size": int(response.headers.get("Content-Length") or 0),
        }


def download(name: str, directory: str) -> str:
    path = os.path.join(directory, name)
    request = urllib.request.Request(BASE_URL + name, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=300) as response, open(path, "wb") as file:
        while chunk := response.read(1 << 20):
            file.write(chunk)
    return path


def run_date_of(ratings_head: dict) -> str:
    if ratings_head.get("run_date"):
        return ratings_head["run_date"]
    return parsedate_to_datetime(ratings_head["last_modified"]).date().isoformat()


def tsv(path: str, columns: dict) -> str:
    spec = ", ".join(f"'{name}': '{kind}'" for name, kind in columns.items())
    return (f"read_csv('{path}', delim='\t', quote='', escape='', nullstr='\\N', header=true, "
            f"columns={{{spec}}})")


# ===== Mongo to DuckDB =====


def input_columns(table: str) -> dict:
    return dict(part.strip().split(" ", 1) for part in diff.INPUT_TABLES[table].split(","))


def load_rows(duck, table: str, rows, directory: str) -> int:
    """Write rows (dicts in the table's column order) to NDJSON and insert them."""
    path = os.path.join(directory, f"{table}.ndjson")
    count = 0
    with open(path, "w") as file:
        for row in rows:
            file.write(json.dumps(row, default=str) + "\n")
            count += 1
    if count:
        columns = input_columns(table)
        spec = ", ".join(f"'{name}': '{kind}'" for name, kind in columns.items())
        duck.execute(f"INSERT INTO {table} SELECT {', '.join(columns)} FROM read_json('{path}', "
                     f"format='newline_delimited', columns={{{spec}}})")
    os.remove(path)
    return count


def _int(value):
    return int(value) if value is not None else None


def _float(value):
    return float(value) if value is not None else None


def _str(value):
    return value if isinstance(value, str) else None


def stored_title_rows(db):
    for kind, collection in TITLE_COLLECTIONS.items():
        projection = {"_id": 0, "tmdb_id": 1, "imdb_id": 1, "user_score_original": 1,
                      "user_score_vote_count": 1, "source": 1, "dataset_missing_since": 1}
        for doc in db[collection].find({"tmdb_deleted": {"$ne": True}}, projection).batch_size(20000):
            if doc.get("tmdb_id") is None:
                continue
            yield {
                "kind": kind, "tmdb_id": _int(doc["tmdb_id"]), "imdb_id": _str(doc.get("imdb_id")),
                "rating": _float(doc.get("user_score_original")), "votes": _int(doc.get("user_score_vote_count")),
                "source": _str(doc.get("source")), "missing_since": _str(doc.get("dataset_missing_since")),
            }


def details_rows(db, since: datetime | None):
    selector = {"updated_at": {"$gte": since - DETAILS_OVERLAP}} if since else {}
    for kind, (collection, field) in DETAILS.items():
        projection = {"_id": 0, "tmdb_id": 1, field: 1, "tmdb_deleted": 1}
        for doc in db[collection].find(selector, projection).batch_size(20000):
            imdb_id = doc.get("imdb_id") if kind == "movie" else (doc.get("external_ids") or {}).get("imdb_id")
            if doc.get("tmdb_id") is None:
                continue
            yield {"kind": kind, "tmdb_id": _int(doc["tmdb_id"]), "imdb_id": _str(imdb_id),
                   "deleted": bool(doc.get("tmdb_deleted"))}


def stored_episode_rows(db):
    projection = {"_id": 0, "episode_imdb_id": 1, "show_imdb_id": 1, "season_number": 1, "episode_number": 1,
                  "user_score_original": 1, "user_score_vote_count": 1, "name": 1}
    for doc in db[EPISODES].find({}, projection).batch_size(20000):
        yield {
            "tconst": doc["episode_imdb_id"], "show_tconst": doc.get("show_imdb_id"),
            "season": _int(doc.get("season_number")), "episode": _int(doc.get("episode_number")),
            "rating": _float(doc.get("user_score_original")), "votes": _int(doc.get("user_score_vote_count")),
            "name": _str(doc.get("name")),
        }


def stored_season_rows(db):
    projection = {"_id": 0, "show_imdb_id": 1, "season_number": 1, "user_score_original": 1,
                  "user_score_vote_count": 1, "rated_episode_count": 1, "max_episode_number": 1}
    for doc in db[SEASONS].find({}, projection).batch_size(20000):
        yield {
            "show_tconst": doc["show_imdb_id"], "season": _int(doc["season_number"]),
            "rating": _float(doc.get("user_score_original")), "votes": _int(doc.get("user_score_vote_count")),
            "rated_episodes": _int(doc.get("rated_episode_count")), "max_episode": _int(doc.get("max_episode_number")),
        }


# ===== DuckDB to Mongo =====


def ensure_indexes(db) -> None:
    db[EPISODES].create_index([("episode_imdb_id", ASCENDING)], unique=True)
    db[EPISODES].create_index([("show_imdb_id", ASCENDING)])
    db[SEASONS].create_index([("show_imdb_id", ASCENDING), ("season_number", ASCENDING)], unique=True)
    for collection in TITLE_COLLECTIONS.values():
        # f/sync/copy/vector_data reads recently updated ratings in tmdb_id order.
        db[collection].create_index([("updated_at", ASCENDING), ("tmdb_id", ASCENDING)])


def bulk(collection, operations) -> int:
    written = 0
    batch = []
    for operation in operations:
        batch.append(operation)
        if len(batch) >= MONGO_BATCH:
            result = collection.bulk_write(batch, ordered=False)
            written += result.upserted_count + result.modified_count + result.deleted_count
            batch = []
    if batch:
        result = collection.bulk_write(batch, ordered=False)
        written += result.upserted_count + result.modified_count + result.deleted_count
    return written


def write_titles(db, duck, run_date: str, now: datetime) -> dict:
    written = {}
    by_kind = {"movie": [], "tv": []}
    for tmdb_id, kind, imdb_id, rating, votes, material in diff.title_writes(duck):
        fields = {
            "imdb_id": imdb_id,
            "user_score_original": rating,
            "user_score_normalized_percent": round(rating * 10, 1),
            "user_score_vote_count": int(votes),
            "source": SOURCE,
            "dataset_run_date": run_date,
            "dataset_missing_since": None,
            "failed_at": None,
            "error_message": None,
        }
        if material:
            # The Crate and Qdrant syncs copy ratings whose updated_at moved.
            fields["updated_at"] = now
        by_kind[kind].append(UpdateOne({"tmdb_id": tmdb_id}, {"$set": fields, "$setOnInsert": {"created_at": now}},
                                       upsert=True))
    for kind, operations in by_kind.items():
        written[f"{kind}_written"] = bulk(db[TITLE_COLLECTIONS[kind]], operations)

    links = {"movie": [], "tv": []}
    for kind, tmdb_id, imdb_id in diff.mapping_writes(duck):
        links[kind].append(UpdateOne({"tmdb_id": tmdb_id}, {"$set": {"imdb_id": imdb_id},
                                                            "$setOnInsert": {"created_at": now}}, upsert=True))
    for kind, operations in links.items():
        written[f"{kind}_links"] = bulk(db[TITLE_COLLECTIONS[kind]], operations)

    # A title missing from the file keeps its value until the grace period ends.
    cleared = {"user_score_original": None, "user_score_normalized_percent": None, "user_score_vote_count": None,
               "source": SOURCE, "dataset_run_date": run_date, "updated_at": now}
    for label, titles, fields in (
        ("marked_missing", diff.missing_marks(duck), {"dataset_missing_since": run_date}),
        ("cleared", diff.expired_titles(duck), cleared),
    ):
        for kind in TITLE_COLLECTIONS:
            written[f"{kind}_{label}"] = bulk(db[TITLE_COLLECTIONS[kind]], (
                UpdateOne({"tmdb_id": tmdb_id}, {"$set": fields}) for title_kind, tmdb_id in titles if title_kind == kind))
    return written


def write_episodes(db, duck, run_date: str, now: datetime) -> dict:
    operations = (
        UpdateOne(
            {"episode_imdb_id": tconst},
            {"$set": {"show_imdb_id": show, "season_number": season, "episode_number": number, "name": name,
                      "user_score_original": rating, "user_score_vote_count": int(votes), "source": SOURCE,
                      "dataset_run_date": run_date, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        for tconst, show, season, number, rating, votes, name in diff.episode_writes(duck)
    )
    written = bulk(db[EPISODES], operations)
    deleted = bulk(db[EPISODES], (DeleteOne({"episode_imdb_id": tconst}) for tconst in diff.episode_deletes(duck)))
    return {"episodes_written": written, "episodes_deleted": deleted}


def write_seasons(db, duck, run_date: str, now: datetime) -> dict:
    operations = (
        UpdateOne(
            {"show_imdb_id": show, "season_number": season},
            {"$set": {"user_score_original": rating, "user_score_vote_count": int(votes),
                      "rated_episode_count": rated, "max_episode_number": max_episode,
                      "dataset_run_date": run_date, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        for show, season, rating, votes, rated, max_episode in diff.season_writes(duck)
    )
    written = bulk(db[SEASONS], operations)
    deleted = bulk(db[SEASONS], (DeleteOne({"show_imdb_id": show, "season_number": season})
                                 for show, season in diff.season_deletes(duck)))
    return {"seasons_written": written, "seasons_deleted": deleted}


# ===== Crate =====


def sync_crate(duck, show_ids: list[int]) -> dict:
    """Rewrite the Crate imdb_episode and imdb_season rows of these TMDB shows and delete
    the rows that no longer exist."""
    counts = {"shows": len(show_ids), "episode_rows": 0, "season_rows": 0}
    if not show_ids:
        return counts
    connector = CrateConnector()
    try:
        for start in range(0, len(show_ids), CRATE_SHOWS_PER_BATCH):
            chunk = show_ids[start:start + CRATE_SHOWS_PER_BATCH]
            for table, model, rows, key in (
                ("imdb_episode", ImdbEpisode, diff.crate_episode_rows(duck, chunk), "imdb_episode_id"),
                ("imdb_season", ImdbSeason, diff.crate_season_rows(duck, chunk), "season_number"),
            ):
                if rows:
                    connector.upsert_many(
                        table=table, records=[model(**row) for row in rows],
                        conflict_columns=SCHEMAS[table]["primary_key"], silent=True, replace_nulls=True,
                    )
                    counts["episode_rows" if table == "imdb_episode" else "season_rows"] += len(rows)
                    kept = [f"{row['show_id']}:{row[key]}" for row in rows]
                    connector.cur.execute(
                        f"DELETE FROM {table} WHERE show_id = ANY(?) "
                        f"AND NOT (CAST(show_id AS TEXT) || ':' || CAST({key} AS TEXT) = ANY(?))",
                        (chunk, kept),
                    )
                else:
                    connector.cur.execute(f"DELETE FROM {table} WHERE show_id = ANY(?)", (chunk,))
            if start // CRATE_SHOWS_PER_BATCH % 25 == 0:
                print(f"  Crate: {start + len(chunk)} of {len(show_ids)} shows", flush=True)
        connector.cur.execute("REFRESH TABLE imdb_episode, imdb_season")
    finally:
        connector.disconnect()
    return counts


def clear_crate_scores(titles: list[tuple]) -> None:
    """The Crate rating sync keeps a stored value when the new one is NULL, so clear the
    IMDb columns of expired titles directly."""
    if not titles:
        return
    connector = CrateConnector()
    try:
        for kind, table in (("movie", "movie"), ("tv", "show")):
            ids = [tmdb_id for title_kind, tmdb_id in titles if title_kind == kind]
            if ids:
                connector.cur.execute(
                    f"UPDATE {table} SET imdb_user_score_original = NULL, imdb_user_score_normalized_percent = NULL, "
                    f"imdb_user_score_rating_count = NULL WHERE tmdb_id = ANY(?)", (ids,))
    finally:
        connector.disconnect()


# ===== Run =====


def _state(db) -> dict:
    return db[STATE].find_one({"_id": STATE_ID}) or {}


def _save_state(db, fields: dict) -> None:
    db[STATE].update_one({"_id": STATE_ID}, {"$set": fields}, upsert=True)


def _peak_rss_mb() -> int:
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)


def _examples(duck) -> dict:
    """Breaking Bad's values after the diff, for the run log."""
    show = duck.execute("""SELECT tmdb_id, change, rating, votes FROM title_changes
                           WHERE kind = 'tv' AND imdb_id = 'tt0903747'""").fetchall()
    seasons = duck.execute("""SELECT season, rating, votes, rated_episodes FROM all_seasons
                              WHERE show_tconst = 'tt0903747' ORDER BY season""").fetchall()
    return {"breaking_bad": {"show": show, "seasons": seasons}}


def main(
    force: bool = False,
    dry_run: bool = False,
    refresh_names: bool = False,
    full_crate_sync: bool = False,
):
    """
    force: run even when nothing changed, and past the shrink and change-share checks.
    dry_run: diff and report the counts, but write nothing.
    refresh_names: download title.basics for episode titles even if the weekly refresh isn't due.
    full_crate_sync: rewrite the Crate rows of every show with IMDb episodes.
    """
    started = time.time()
    timings = {}
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    init_mongodb()
    db = get_db()
    state = _state(db)
    stored_files = state.get("files") or {}

    heads = {name: head(name) for name in diff.DAILY_FILES}
    etags = {name: heads[name]["etag"] for name in diff.DAILY_FILES}
    run_date = run_date_of(heads[RATINGS_FILE])
    ratings_age = now - parsedate_to_datetime(heads[RATINGS_FILE]["last_modified"]).replace(tzinfo=None)
    alerts = []
    if ratings_age > STALE_AFTER:
        alerts.append(f"{RATINGS_FILE} was last modified {ratings_age} ago")

    with tempfile.TemporaryDirectory(prefix="imdb_datasets_") as directory:
        duck = duckdb.connect()
        duck.execute(f"SET memory_limit = '{DUCKDB_MEMORY}'; SET threads = {DUCKDB_THREADS}; "
                     f"SET preserve_insertion_order = false; SET temp_directory = '{directory}'")
        diff.create_input_tables(duck)

        t = time.time()
        stored_titles = load_rows(duck, "stored_titles", stored_title_rows(db), directory)
        map_checked_at = state.get("map_checked_at")
        details = load_rows(duck, "details_delta", details_rows(db, map_checked_at), directory)
        diff.build_title_map(duck)
        links = diff.link_changes(duck)
        timings["read_titles_s"] = round(time.time() - t, 1)
        pending = sorted(set(state.get("crate_pending_show_ids") or []))
        print(f"Stored titles {stored_titles}, details read {details}, TMDB links {links}, "
              f"pending Crate shows {len(pending)}", flush=True)

        if not force and not full_crate_sync and diff.should_skip(
                {name: (stored_files.get(name) or {}).get("etag") for name in diff.DAILY_FILES},
                etags, links["relinked"], len(pending)):
            print("Both files are unchanged and TMDB relinked no title: skipping", flush=True)
            if not dry_run:
                # map_checked_at stays, so the next run reads the new first links again.
                _save_state(db, {"last_checked_at": now})
                db[RUNS].insert_one({"started_at": now, "outcome": "skipped", "run_date": run_date, "etags": etags})
            close_mongodb()
            if alerts:
                raise DatasetAlert("; ".join(alerts))
            return {"outcome": "skipped", "run_date": run_date, "etags": etags,
                    "duration_s": round(time.time() - started, 1)}

        t = time.time()
        paths = {name: download(name, directory) for name in diff.DAILY_FILES}
        names_loaded_at = state.get("names_loaded_at")
        load_names = refresh_names or not names_loaded_at or now - names_loaded_at > timedelta(days=NAMES_REFRESH_DAYS)
        if load_names:
            paths[NAMES_FILE] = download(NAMES_FILE, directory)
        timings["download_s"] = round(time.time() - t, 1)

        t = time.time()
        duck.execute(f"""INSERT INTO ds_ratings SELECT tconst, averageRating, numVotes FROM {tsv(paths[RATINGS_FILE],
                         {'tconst': 'VARCHAR', 'averageRating': 'DOUBLE', 'numVotes': 'BIGINT'})}""")
        duck.execute(f"""
            INSERT INTO ds_episodes
            SELECT e.tconst, e.parentTconst, e.seasonNumber, e.episodeNumber
            FROM {tsv(paths[EPISODE_FILE], {'tconst': 'VARCHAR', 'parentTconst': 'VARCHAR',
                                            'seasonNumber': 'INTEGER', 'episodeNumber': 'INTEGER'})} e
            WHERE e.parentTconst IN (SELECT imdb_id FROM title_map WHERE kind = 'tv')
              AND e.tconst IN (SELECT tconst FROM ds_ratings)""")
        if load_names:
            duck.execute(f"""
                INSERT INTO ds_names
                SELECT b.tconst, b.primaryTitle
                FROM {tsv(paths[NAMES_FILE], {'tconst': 'VARCHAR', 'titleType': 'VARCHAR', 'primaryTitle': 'VARCHAR',
                                              'originalTitle': 'VARCHAR', 'isAdult': 'VARCHAR', 'startYear': 'VARCHAR',
                                              'endYear': 'VARCHAR', 'runtimeMinutes': 'VARCHAR', 'genres': 'VARCHAR'})} b
                WHERE b.tconst IN (SELECT tconst FROM ds_episodes)""")
            os.remove(paths[NAMES_FILE])
        counts = {
            "ratings_rows": duck.execute("SELECT count(*) FROM ds_ratings").fetchone()[0],
            "rated_episodes_of_mapped_shows": duck.execute("SELECT count(*) FROM ds_episodes").fetchone()[0],
            "episode_names": duck.execute("SELECT count(*) FROM ds_names").fetchone()[0],
            "stored_titles": stored_titles,
            "details_read": details,
            "new_links": links["new"],
            "relinked": links["relinked"],
        }
        counts["stored_episodes"] = load_rows(duck, "stored_episodes", stored_episode_rows(db), directory)
        counts["stored_seasons"] = load_rows(duck, "stored_seasons", stored_season_rows(db), directory)
        timings["parse_s"] = round(time.time() - t, 1)

        t = time.time()
        diff.diff_titles(duck, run_date)
        changes = {
            "titles": diff.count_changes(duck, "title_changes", by_kind=True),
            "episodes": diff.diff_episodes(duck),
            "seasons": diff.diff_seasons(duck),
        }
        material = duck.execute("SELECT count(*) FROM title_changes WHERE material").fetchone()[0]
        scored = duck.execute("SELECT count(*) FROM stored_titles WHERE rating IS NOT NULL").fetchone()[0]
        crate_shows = sorted(set(diff.crate_shows_to_sync(duck)) | set(pending))
        if full_crate_sync:
            crate_shows = [row[0] for row in duck.execute(
                "SELECT DISTINCT m.tmdb_id FROM title_map m JOIN effective_episodes e ON e.show_tconst = m.imdb_id "
                "WHERE m.kind = 'tv' ORDER BY 1").fetchall()]
        timings["diff_s"] = round(time.time() - t, 1)
        counts.update({"material_title_changes": material, "crate_shows": len(crate_shows)})
        print(f"Changes: {json.dumps(changes)}", flush=True)
        print(f"Counts: {json.dumps(counts)}", flush=True)

        previous_rows = state.get("ratings_rows")
        if previous_rows and counts["ratings_rows"] < (1 - MAX_SHRINK) * previous_rows and not force:
            raise DatasetAlert(f"{RATINGS_FILE} shrank from {previous_rows} to {counts['ratings_rows']} rows")
        if state.get("files") and scored and material > MAX_CHANGED_SHARE * scored and not force:
            raise DatasetAlert(f"{material} of {scored} stored titles would change")

        result = {"outcome": "dry_run" if dry_run else "ingested", "run_date": run_date, "etags": etags,
                  "names_refreshed": load_names, "counts": counts, "changes": changes, "examples": _examples(duck)}
        if dry_run:
            close_mongodb()
            result.update({"timings": timings, "peak_rss_mb": _peak_rss_mb(),
                           "duration_s": round(time.time() - started, 1)})
            return result

        t = time.time()
        ensure_indexes(db)
        written = write_titles(db, duck, run_date, now)
        written.update(write_episodes(db, duck, run_date, now))
        written.update(write_seasons(db, duck, run_date, now))
        timings["mongo_write_s"] = round(time.time() - t, 1)
        state_fields = {
            "files": heads, "run_date": run_date, "map_checked_at": now, "last_checked_at": now,
            "last_ingested_at": now, "ratings_rows": counts["ratings_rows"], "crate_pending_show_ids": crate_shows,
        }
        if load_names:
            state_fields["names_loaded_at"] = now
        _save_state(db, state_fields)
        print(f"Mongo writes: {json.dumps(written)}", flush=True)

        t = time.time()
        crate = sync_crate(duck, crate_shows)
        clear_crate_scores(diff.expired_titles(duck))
        _save_state(db, {"crate_pending_show_ids": []})
        timings["crate_s"] = round(time.time() - t, 1)
        duck.close()

    zero_runs = state.get("zero_change_runs", 0) + 1 if material == 0 else 0
    _save_state(db, {"zero_change_runs": zero_runs})
    if zero_runs >= 2:
        alerts.append(f"{zero_runs} runs in a row changed no title")
    timings["total_s"] = round(time.time() - started, 1)
    result.update({"written": written, "crate": crate, "timings": timings, "peak_rss_mb": _peak_rss_mb(),
                   "duration_s": timings["total_s"]})
    db[RUNS].insert_one({"started_at": now, **json.loads(json.dumps(result, default=str))})
    close_mongodb()
    if alerts:
        raise DatasetAlert("; ".join(alerts))
    return result
