# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb==1.5.5", "psutil"]
# ///
"""
PROTOTYPE - throwaway. Not a Windmill script. Do not deploy, do not import.

Question: does a daily, diff-only ingest of the IMDb non-commercial datasets
(title.ratings + title.episode) into the existing `imdb_*_rating` collections
work end to end, what do the episode grids look like, how well does IMDb's
season/episode numbering line up with TMDB's, and does it fit the Windmill
default worker (4 GiB, 2 CPUs)?

Run:   uv run goodwatch-flows/windmill/f/imdb_datasets/PROTOTYPE_imdb_dataset_collector.py

Target: a local scratch DuckDB file `PROTOTYPE_wipe_me_work/PROTOTYPE_wipe_me_target.duckdb`
that stands in for production Mongo. Nothing is written to production.

Inputs (all in PROTOTYPE_wipe_me_work/inputs/, not committed):
  mongo/      read-only exports of production Mongo taken 2026-09-25
  snapshots/  two older title.ratings files and one older title.episode file,
              taken from the Wayback Machine, plus title.basics for episode titles
The last runs use the live https://datasets.imdbws.com files with a real HEAD/ETag check.

The run sequence (each prints the full state afterwards):
  1  first load        ratings published 2026-09-23 + episodes published 2026-08-09,
                       over a target seeded with today's production imdb_*_rating values
  2  same files again  ETag unchanged -> skip
  3  same files, forced (ETag check bypassed) -> must write nothing
  4  next day          ratings published 2026-09-24 (real 1-day churn), same episode file
  5  live             real HEAD + download of today's files (1 more day of ratings,
                       7 weeks of episode structure changes: new, removed, moved episodes)
  6  live again        real HEAD, ETag unchanged -> skip
Then reports for questions 2-4 and injects real data into the HTML demo.
"""

import gzip
import hashlib
import json
import os
import shutil
import threading
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import psutil

HERE = Path(__file__).resolve().parent
WORK = HERE / "PROTOTYPE_wipe_me_work"
INPUTS = WORK / "inputs"
DOWNLOADS = WORK / "downloads"
TARGET = WORK / "PROTOTYPE_wipe_me_target.duckdb"
HTML = HERE / "PROTOTYPE_imdb_ingest_demo.html"
REPORT_JSON = WORK / "PROTOTYPE_wipe_me_report.json"

LIVE_BASE = "https://datasets.imdbws.com/"
UA = "GoodWatchBot/0.1 (+https://goodwatch.app)"

# Worker-like limits for DuckDB (Windmill default worker: 4 GiB, 2 CPUs).
DUCK_MEMORY_LIMIT = "512MB"
DUCK_THREADS = 2

# Diff rule under test: write a title when the rating changed or the vote count moved >= 1 %
# relative to the STORED value (so slow growth accumulates and is eventually written).
VOTE_REL_THRESHOLD = 0.01

TODAY = "2026-09-25"

# the five shows rendered as grids in the HTML demo
DEMO_SHOWS = {
    "tt0903747": "Breaking Bad",
    "tt0096697": "The Simpsons",
    "tt14452776": "The Bear",
    "tt0436992": "Doctor Who (specials)",
    "tt6468322": "Money Heist (numbering mismatch)",
}

SAMPLE_SHOWS = {
    "tt0903747": "Breaking Bad",
    "tt0096697": "The Simpsons",
    "tt14452776": "The Bear",
}

# ---------------------------------------------------------------------------
# resource sampling


class Sampler:
    def __init__(self):
        self.proc = psutil.Process()
        self.peak = 0
        self._stop = False
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while not self._stop:
            self.peak = max(self.peak, self.proc.memory_info().rss)
            time.sleep(0.05)

    def reset(self):
        self.peak = self.proc.memory_info().rss


SAMPLER = Sampler()


def mb(n):
    return f"{n / 1e6:,.0f} MB"


# ---------------------------------------------------------------------------
# dataset sources


class SnapshotSource:
    """Local files standing in for datasets.imdbws.com. ETag = md5 of the file."""

    def __init__(self, label, files):
        self.label = label
        self.files = files  # logical name -> Path

    def head(self, name):
        p = self.files[name]
        h = hashlib.md5(p.read_bytes()).hexdigest()
        return {"etag": f'"{h}"', "last_modified": p.name.split("published-")[1][:10], "size": p.stat().st_size}

    def download(self, name, dest):
        shutil.copyfile(self.files[name], dest)


class LiveSource:
    label = "live datasets.imdbws.com"

    def head(self, name):
        req = urllib.request.Request(LIVE_BASE + name, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            return {
                "etag": r.headers.get("ETag"),
                "last_modified": r.headers.get("Last-Modified"),
                "run_date": r.headers.get("x-amz-meta-run-date"),
                "size": int(r.headers.get("Content-Length") or 0),
            }

    def download(self, name, dest):
        req = urllib.request.Request(LIVE_BASE + name, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f, 1 << 20)


FILES = ["title.ratings.tsv.gz", "title.episode.tsv.gz"]

# ---------------------------------------------------------------------------
# target ("production Mongo" stand-in)


def seed_target():
    """Create the target and seed it with today's production values (read-only exports)."""
    if TARGET.exists():
        TARGET.unlink()
    db = duckdb.connect(str(TARGET))
    m = INPUTS / "mongo"
    for kind in ["tv", "movie"]:
        db.execute(f"""
            CREATE TABLE imdb_{kind}_rating AS
            SELECT tmdb_id::INTEGER AS tmdb_id, imdb_id,
                   user_score_original::DOUBLE AS user_score_original,
                   (user_score_original * 10)::DOUBLE AS user_score_normalized_percent,
                   user_score_vote_count::BIGINT AS user_score_vote_count,
                   'imdb_web' AS source, NULL::VARCHAR AS dataset_run,
                   NULL::VARCHAR AS dataset_missing_since,
                   (updated_at->>'$."$date"')::VARCHAR AS updated_at
            FROM read_json_auto('{m}/imdb_{kind}_rating.jsonl')
        """)
    db.execute("""
        CREATE TABLE imdb_tv_episode_rating (
            episode_imdb_id VARCHAR PRIMARY KEY, show_imdb_id VARCHAR, season_number INTEGER,
            episode_number INTEGER, user_score_original DOUBLE, user_score_vote_count BIGINT,
            dataset_run VARCHAR)
    """)
    db.execute("""
        CREATE TABLE imdb_tv_season_rating (
            show_imdb_id VARCHAR, season_number INTEGER, user_score_vote_weighted DOUBLE,
            user_score_vote_count BIGINT, rated_episodes INTEGER, max_episode_number INTEGER,
            dataset_run VARCHAR, PRIMARY KEY (show_imdb_id, season_number))
    """)
    db.execute("""
        CREATE TABLE imdb_dataset_state (file VARCHAR PRIMARY KEY, etag VARCHAR,
            last_modified VARCHAR, run_date VARCHAR, checked_at VARCHAR)
    """)
    db.execute("""
        CREATE TABLE imdb_dataset_runs (run INTEGER, label VARCHAR, outcome VARCHAR, stats JSON)
    """)
    db.close()


def target_state(db, tracked):
    """The full relevant state, printed after every run."""
    out = {}
    out["dataset_state"] = db.sql("SELECT file, etag, last_modified, run_date FROM t.imdb_dataset_state ORDER BY file").fetchall()
    for kind in ["tv", "movie"]:
        out[f"imdb_{kind}_rating"] = db.sql(f"""
            SELECT count(*) n_rows,
                   count(*) FILTER (source = 'imdb_dataset') from_dataset,
                   count(*) FILTER (source = 'imdb_web') still_scraped,
                   count(*) FILTER (dataset_missing_since IS NOT NULL) missing_from_dataset,
                   count(*) FILTER (user_score_vote_count >= 10000000) votes_over_10M
            FROM t.imdb_{kind}_rating""").fetchone()
    out["imdb_tv_episode_rating"] = db.sql("""
        SELECT count(*), count(DISTINCT show_imdb_id),
               count(*) FILTER (season_number = 0), count(*) FILTER (season_number IS NULL)
        FROM t.imdb_tv_episode_rating""").fetchone()
    out["imdb_tv_season_rating"] = db.sql("SELECT count(*), count(DISTINCT show_imdb_id) FROM t.imdb_tv_season_rating").fetchone()
    out["tracked"] = {}
    for tt, name in tracked.items():
        show = db.sql(f"SELECT tmdb_id, user_score_original, user_score_vote_count, source, dataset_run FROM t.imdb_tv_rating WHERE imdb_id = '{tt}'").fetchall()
        seasons = db.sql(f"""SELECT season_number, round(user_score_vote_weighted, 2), user_score_vote_count, rated_episodes
                             FROM t.imdb_tv_season_rating WHERE show_imdb_id = '{tt}' ORDER BY season_number""").fetchall()
        out["tracked"][name] = {"show": show, "seasons": seasons}
    return out


def print_state(title, st):
    print(f"\n  ---- state after: {title} ----")
    for f in st["dataset_state"]:
        print(f"  dataset_state  {f[0]:24} etag={f[1]}  last_modified={f[2]}  run_date={f[3]}")
    if not st["dataset_state"]:
        print("  dataset_state  (empty - never ran)")
    for kind in ["tv", "movie"]:
        r = st[f"imdb_{kind}_rating"]
        print(f"  imdb_{kind}_rating{' ' if kind == 'tv' else ''}   rows={r[0]:,}  from_dataset={r[1]:,}  still_scraped={r[2]:,}  missing_from_dataset={r[3]:,}  votes>=10M={r[4]:,}")
    e = st["imdb_tv_episode_rating"]
    print(f"  imdb_tv_episode_rating rows={e[0]:,} shows={e[1]:,} season0={e[2]:,} season_null={e[3]:,}")
    s = st["imdb_tv_season_rating"]
    print(f"  imdb_tv_season_rating  rows={s[0]:,} shows={s[1]:,}")
    for name, v in st["tracked"].items():
        show = v["show"][0] if v["show"] else None
        print(f"  {name:14} show={show}")
        if v["seasons"]:
            print("                 seasons " + "  ".join(f"S{s[0]}={s[1]} ({s[2]:,}v/{s[3]}ep)" for s in v["seasons"][:8]) + (" ..." if len(v["seasons"]) > 8 else ""))


# ---------------------------------------------------------------------------
# the daily job


def worker_conn():
    db = duckdb.connect()  # in-memory worker, like a fresh Windmill job
    db.execute(f"SET memory_limit='{DUCK_MEMORY_LIMIT}'; SET threads={DUCK_THREADS}; SET preserve_insertion_order=false")
    db.execute(f"ATTACH '{TARGET}' AS t")
    return db


def load_maps(db):
    """imdb_id -> tmdb_id maps from the stored TMDB external ids (read-only export)."""
    m = INPUTS / "mongo"
    db.execute(f"""
        CREATE TEMP TABLE show_map AS
        SELECT tmdb_id::INTEGER tmdb_id, external_ids.imdb_id AS imdb_id
        FROM read_json_auto('{m}/tmdb_tv_details_ids.jsonl')
        WHERE regexp_full_match(external_ids.imdb_id, 'tt[0-9]+')""")
    db.execute(f"""
        CREATE TEMP TABLE movie_map AS
        SELECT column0::INTEGER tmdb_id, column1 AS imdb_id
        FROM read_csv('{m}/tmdb_movie_details_ids.tsv', delim='\t', header=false, columns={{'column0':'BIGINT','column1':'VARCHAR'}})
        WHERE regexp_full_match(column1, 'tt[0-9]+')""")


def tsv(path, cols):
    c = ", ".join(f"'{k}': '{v}'" for k, v in cols.items())
    return f"read_csv('{path}', delim='\t', quote='', escape='', nullstr='\\N', header=true, columns={{{c}}})"


def daily_run(run_no, label, source, force=False, run_id=None):
    print(f"\n==================== run {run_no}: {label} ====================")
    SAMPLER.reset()
    t_all = time.time()
    timings = {}
    db = worker_conn()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    # 1. ETag / Last-Modified check
    t = time.time()
    heads = {f: source.head(f) for f in FILES}
    stored = dict(db.sql("SELECT file, etag FROM t.imdb_dataset_state").fetchall())
    unchanged = all(stored.get(f) == heads[f]["etag"] for f in FILES)
    timings["head_check_s"] = round(time.time() - t, 2)
    for f in FILES:
        print(f"  HEAD {f:22} etag={heads[f]['etag']} stored={stored.get(f)} -> {'same' if stored.get(f) == heads[f]['etag'] else 'CHANGED'}")
    if unchanged and not force:
        print("  => all ETags unchanged: SKIP (no download, no writes)")
        db.execute("INSERT INTO t.imdb_dataset_runs VALUES (?, ?, 'skipped', ?)", [run_no, label, json.dumps({"timings": timings})])
        st = target_state(db, SAMPLE_SHOWS)
        db.close()
        print_state(f"run {run_no}", st)
        return {"run": run_no, "label": label, "outcome": "skipped", "timings": timings}
    if unchanged and force:
        print("  => ETags unchanged but FORCED: running the full diff anyway")

    run_id = run_id or (heads["title.ratings.tsv.gz"].get("run_date") or heads["title.ratings.tsv.gz"]["last_modified"])

    # 2. download
    t = time.time()
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    paths = {}
    for f in FILES:
        paths[f] = DOWNLOADS / f
        source.download(f, paths[f])
    timings["download_s"] = round(time.time() - t, 2)
    disk = sum(p.stat().st_size for p in paths.values())

    # 3. parse + join in DuckDB
    t = time.time()
    load_maps(db)
    db.execute(f"CREATE TEMP TABLE ds_ratings AS SELECT * FROM {tsv(paths['title.ratings.tsv.gz'], {'tconst': 'VARCHAR', 'averageRating': 'DOUBLE', 'numVotes': 'BIGINT'})}")
    db.execute(f"""
        CREATE TEMP TABLE ds_episode AS
        SELECT e.* FROM {tsv(paths['title.episode.tsv.gz'], {'tconst': 'VARCHAR', 'parentTconst': 'VARCHAR', 'seasonNumber': 'INTEGER', 'episodeNumber': 'INTEGER'})} e
        WHERE e.parentTconst IN (SELECT imdb_id FROM show_map)""")
    timings["parse_join_s"] = round(time.time() - t, 2)
    counts = {"ratings_rows": db.sql("SELECT count(*) FROM ds_ratings").fetchone()[0],
              "episode_rows_of_mapped_shows": db.sql("SELECT count(*) FROM ds_episode").fetchone()[0]}

    # 4. title diff (tv + movie) against the STORED values
    t = time.time()
    title_stats = {}
    examples = {}
    for kind, mp in [("tv", "show_map"), ("movie", "movie_map")]:
        db.execute(f"""
            CREATE OR REPLACE TEMP TABLE diff_{kind} AS
            WITH n AS (SELECT m.tmdb_id, m.imdb_id, r.averageRating rating, r.numVotes votes
                       FROM {mp} m JOIN ds_ratings r ON r.tconst = m.imdb_id)
            SELECT coalesce(n.tmdb_id, s.tmdb_id) tmdb_id, n.imdb_id new_imdb_id, s.imdb_id old_imdb_id,
                   n.rating, n.votes, s.user_score_original old_rating, s.user_score_vote_count old_votes,
                   s.source old_source, s.dataset_missing_since,
                   CASE
                     WHEN n.tmdb_id IS NULL AND s.user_score_original IS NOT NULL AND s.dataset_missing_since IS NULL THEN 'gone'
                     WHEN n.tmdb_id IS NULL THEN 'still_gone_or_unscored'
                     WHEN s.tmdb_id IS NULL OR s.user_score_original IS NULL THEN 'new'
                     WHEN s.imdb_id IS DISTINCT FROM n.imdb_id THEN 'remapped'
                     WHEN s.dataset_missing_since IS NOT NULL THEN 'back'
                     WHEN s.source <> 'imdb_dataset' THEN 'replace_scraped'
                     WHEN n.rating <> s.user_score_original THEN 'rating_changed'
                     WHEN abs(n.votes - s.user_score_vote_count) >= greatest(1, {VOTE_REL_THRESHOLD} * s.user_score_vote_count) THEN 'votes_changed'
                     WHEN n.votes <> s.user_score_vote_count THEN 'votes_drift_below_threshold'
                     ELSE 'unchanged'
                   END AS change
            FROM n FULL OUTER JOIN t.imdb_{kind}_rating s ON s.tmdb_id = n.tmdb_id""")
        title_stats[kind] = dict(db.sql(f"SELECT change, count(*) FROM diff_{kind} GROUP BY 1 ORDER BY 2 DESC").fetchall())
        examples[kind] = {}
        for ch in ["new", "gone", "back", "remapped", "rating_changed", "votes_changed"]:
            examples[kind][ch] = db.sql(f"""SELECT tmdb_id, coalesce(new_imdb_id, old_imdb_id), old_rating, rating, old_votes, votes
                                            FROM diff_{kind} WHERE change = '{ch}' ORDER BY coalesce(votes, old_votes) DESC NULLS LAST LIMIT 3""").fetchall()
        # extra: how many writes would other vote rules cause?
        title_stats[kind]["_rule_any_change"] = db.sql(f"SELECT count(*) FROM diff_{kind} WHERE change NOT IN ('unchanged','still_gone_or_unscored')").fetchone()[0]
        title_stats[kind]["_inflated_10x_fixed"] = db.sql(f"SELECT count(*) FROM diff_{kind} WHERE old_source='imdb_web' AND votes > 0 AND old_votes >= 7 * votes").fetchone()[0]
    timings["title_diff_s"] = round(time.time() - t, 2)

    # 5. apply title writes (the real job: Mongo bulk UpdateOne by tmdb_id, upsert)
    t = time.time()
    writes = {}
    for kind in ["tv", "movie"]:
        w = f"change IN ('new','remapped','back','replace_scraped','rating_changed','votes_changed')"
        writes[kind] = db.sql(f"SELECT count(*) FROM diff_{kind} WHERE {w}").fetchone()[0]
        # upsert by tmdb_id, emulated as delete + insert
        db.execute(f"DELETE FROM t.imdb_{kind}_rating WHERE tmdb_id IN (SELECT tmdb_id FROM diff_{kind} WHERE {w})")
        db.execute(f"""
            INSERT INTO t.imdb_{kind}_rating
            SELECT tmdb_id, new_imdb_id, rating, rating * 10, votes, 'imdb_dataset', '{run_id}', NULL, '{now}'
            FROM diff_{kind} WHERE {w}""")
        gone = db.sql(f"SELECT count(*) FROM diff_{kind} WHERE change = 'gone'").fetchone()[0]
        writes[kind + "_marked_gone"] = gone
        db.execute(f"""UPDATE t.imdb_{kind}_rating SET dataset_missing_since = '{run_id}'
                       WHERE tmdb_id IN (SELECT tmdb_id FROM diff_{kind} WHERE change = 'gone')""")
    timings["title_write_s"] = round(time.time() - t, 2)

    # 6. episode diff, keyed by the EPISODE tconst (so a move is an update, not delete + orphan)
    t = time.time()
    db.execute(f"""
        CREATE TEMP TABLE diff_ep AS
        WITH n AS (SELECT e.tconst, e.parentTconst show_id, e.seasonNumber season, e.episodeNumber ep,
                          r.averageRating rating, r.numVotes votes
                   FROM ds_episode e JOIN ds_ratings r USING (tconst))
        SELECT coalesce(n.tconst, s.episode_imdb_id) tconst, coalesce(n.show_id, s.show_imdb_id) show_id,
               n.season, n.ep, n.rating, n.votes, s.season_number old_season, s.episode_number old_ep,
               s.user_score_original old_rating, s.user_score_vote_count old_votes,
               CASE
                 WHEN n.tconst IS NULL THEN 'removed'
                 WHEN s.episode_imdb_id IS NULL THEN 'new'
                 WHEN s.show_imdb_id <> n.show_id THEN 'moved_show'
                 WHEN s.season_number IS DISTINCT FROM n.season OR s.episode_number IS DISTINCT FROM n.ep THEN 'moved'
                 WHEN n.rating <> s.user_score_original THEN 'rating_changed'
                 WHEN abs(n.votes - s.user_score_vote_count) >= greatest(1, {VOTE_REL_THRESHOLD} * s.user_score_vote_count) THEN 'votes_changed'
                 ELSE 'unchanged'
               END change
        FROM n FULL OUTER JOIN t.imdb_tv_episode_rating s ON s.episode_imdb_id = n.tconst""")
    ep_stats = dict(db.sql("SELECT change, count(*) FROM diff_ep GROUP BY 1 ORDER BY 2 DESC").fetchall())
    ep_examples = {}
    for ch in ["new", "removed", "moved", "moved_show", "rating_changed"]:
        ep_examples[ch] = db.sql(f"""SELECT show_id, tconst, old_season, old_ep, season, ep, old_rating, rating, coalesce(votes, old_votes) v
                                     FROM diff_ep WHERE change = '{ch}' ORDER BY v DESC NULLS LAST LIMIT 4""").fetchall()
    ep_w = "change IN ('new','moved','moved_show','rating_changed','votes_changed')"
    db.execute(f"DELETE FROM t.imdb_tv_episode_rating WHERE episode_imdb_id IN (SELECT tconst FROM diff_ep WHERE {ep_w} OR change = 'removed')")
    db.execute(f"INSERT INTO t.imdb_tv_episode_rating SELECT tconst, show_id, season, ep, rating, votes, '{run_id}' FROM diff_ep WHERE {ep_w}")
    ep_writes = db.sql(f"SELECT count(*) FROM diff_ep WHERE {ep_w} OR change = 'removed'").fetchone()[0]
    timings["episode_diff_write_s"] = round(time.time() - t, 2)

    # 7. seasons: recompute only for shows with an episode change; vote-weighted, regular seasons only
    t = time.time()
    db.execute("CREATE TEMP TABLE touched AS SELECT DISTINCT show_id FROM diff_ep WHERE change <> 'unchanged'")
    db.execute("""
        CREATE TEMP TABLE new_seasons AS
        SELECT show_imdb_id, season_number,
               sum(user_score_original * user_score_vote_count) / sum(user_score_vote_count) rating_vw,
               sum(user_score_vote_count) votes, count(*) rated, max(episode_number) max_ep
        FROM t.imdb_tv_episode_rating
        WHERE show_imdb_id IN (SELECT show_id FROM touched) AND season_number > 0
        GROUP BY ALL""")
    season_stats = db.sql("""
        SELECT count(*) FILTER (o.show_imdb_id IS NULL) new_seasons,
               count(*) FILTER (n.show_imdb_id IS NULL) removed_seasons,
               count(*) FILTER (o.show_imdb_id IS NOT NULL AND n.show_imdb_id IS NOT NULL
                                AND (round(o.user_score_vote_weighted, 2) <> round(n.rating_vw, 2) OR o.rated_episodes <> n.rated)) changed_seasons
        FROM new_seasons n
        FULL OUTER JOIN (SELECT * FROM t.imdb_tv_season_rating WHERE show_imdb_id IN (SELECT show_id FROM touched)) o
          ON o.show_imdb_id = n.show_imdb_id AND o.season_number = n.season_number""").fetchone()
    db.execute("DELETE FROM t.imdb_tv_season_rating WHERE show_imdb_id IN (SELECT show_id FROM touched)")
    db.execute(f"INSERT INTO t.imdb_tv_season_rating SELECT show_imdb_id, season_number, rating_vw, votes, rated, max_ep, '{run_id}' FROM new_seasons")
    touched_shows = db.sql("SELECT count(*) FROM touched").fetchone()[0]
    timings["season_s"] = round(time.time() - t, 2)

    # 8. remember ETags
    for f in FILES:
        h = heads[f]
        db.execute("DELETE FROM t.imdb_dataset_state WHERE file = ?", [f])
        db.execute("INSERT INTO t.imdb_dataset_state VALUES (?, ?, ?, ?, ?)", [f, h["etag"], h["last_modified"], h.get("run_date"), now])

    timings["total_s"] = round(time.time() - t_all, 2)
    stats = {
        "run": run_no, "label": label, "outcome": "ingested", "source": source.label, "run_id": run_id,
        "timings": timings, "peak_rss_mb": round(SAMPLER.peak / 1e6), "download_bytes": disk,
        "counts": counts, "titles": title_stats, "title_writes": writes, "title_examples": examples,
        "episodes": ep_stats, "episode_writes": ep_writes, "episode_examples": ep_examples,
        "seasons": {"shows_recomputed": touched_shows, "new": season_stats[0], "removed": season_stats[1], "changed": season_stats[2]},
    }
    db.execute("INSERT INTO t.imdb_dataset_runs VALUES (?, ?, 'ingested', ?)", [run_no, label, json.dumps(stats, default=str)])

    print(f"  dataset: {counts['ratings_rows']:,} rating rows, {counts['episode_rows_of_mapped_shows']:,} episode rows of mapped shows")
    for kind in ["tv", "movie"]:
        ts = {k: v for k, v in title_stats[kind].items() if not k.startswith("_")}
        print(f"  {kind:5} title diff: {ts}")
        print(f"        writes={writes[kind]:,} marked_gone={writes[kind + '_marked_gone']:,}  (if every vote change were written: {title_stats[kind]['_rule_any_change']:,}; 10x-inflated counts corrected: {title_stats[kind]['_inflated_10x_fixed']:,})")
        for ch, rows in examples[kind].items():
            if rows:
                print(f"        e.g. {ch:15} " + " | ".join(f"tmdb {r[0]} {r[1]} {r[2]}->{r[3]} votes {r[4]}->{r[5]}" for r in rows[:2]))
    print(f"  episode diff: {ep_stats}  writes/deletes={ep_writes:,}")
    for ch, rows in ep_examples.items():
        if rows:
            print(f"        e.g. {ch:15} " + " | ".join(f"{r[0]}/{r[1]} S{r[2]}E{r[3]}->S{r[4]}E{r[5]} {r[6]}->{r[7]}" for r in rows[:2]))
    print(f"  seasons: recomputed for {touched_shows:,} shows; new={season_stats[0]:,} removed={season_stats[1]:,} changed={season_stats[2]:,}")
    print(f"  timings: {timings}  peak RSS {stats['peak_rss_mb']} MB  download {mb(disk)}")
    st = target_state(db, SAMPLE_SHOWS)
    db.close()
    print_state(f"run {run_no}", st)
    return stats


# ---------------------------------------------------------------------------
# reports for questions 2 and 3


def reports(runs):
    db = duckdb.connect()
    db.execute(f"SET memory_limit='{DUCK_MEMORY_LIMIT}'; SET threads={DUCK_THREADS}")
    db.execute(f"ATTACH '{TARGET}' AS t (READ_ONLY)")
    ep_file = DOWNLOADS / "title.episode.tsv.gz"
    db.execute(f"CREATE TEMP TABLE ds_episode AS SELECT * FROM {tsv(ep_file, {'tconst': 'VARCHAR', 'parentTconst': 'VARCHAR', 'seasonNumber': 'INTEGER', 'episodeNumber': 'INTEGER'})}")
    load_maps(db)
    rep = {}

    print("\n==================== Q2: what the episode data looks like ====================")
    g = db.sql("""
        SELECT count(*) rated_eps, count(DISTINCT show_imdb_id) shows,
               count(*) FILTER (season_number = 0) s0, count(*) FILTER (season_number IS NULL) s_null,
               count(*) FILTER (season_number IS NOT NULL AND episode_number IS NULL) ep_null,
               count(*) FILTER (season_number > 1000) year_seasons
        FROM t.imdb_tv_episode_rating""").fetchone()
    dup = db.sql("""SELECT count(*), sum(n - 1) FROM (SELECT show_imdb_id, season_number, episode_number, count(*) n
                    FROM t.imdb_tv_episode_rating WHERE season_number IS NOT NULL AND episode_number IS NOT NULL
                    GROUP BY ALL HAVING count(*) > 1)""").fetchone()
    gaps = db.sql("""SELECT count(*), sum(max_episode_number - rated_episodes)
                     FROM t.imdb_tv_season_rating WHERE max_episode_number > rated_episodes""").fetchone()
    all_eps = db.sql("""SELECT count(*), count(*) FILTER (seasonNumber IS NULL), count(*) FILTER (seasonNumber = 0)
                        FROM ds_episode WHERE parentTconst IN (SELECT imdb_id FROM show_map)""").fetchone()
    # holes: positions 1..max(episode) in a season with no IMDb episode at all, vs present but unrated (<5 votes)
    holes = db.sql("""WITH s AS (SELECT parentTconst, seasonNumber, count(DISTINCT episodeNumber) n, max(episodeNumber) mx
                                 FROM ds_episode WHERE parentTconst IN (SELECT DISTINCT show_imdb_id FROM t.imdb_tv_episode_rating)
                                   AND seasonNumber > 0 AND episodeNumber IS NOT NULL GROUP BY ALL)
                      SELECT sum(mx - n), count(*) FILTER (mx > n), sum(n), count(*) FILTER (mx > 400) FROM s""").fetchone()
    unrated_in_grid = db.sql("""SELECT count(*) FROM ds_episode d
                                WHERE d.parentTconst IN (SELECT DISTINCT show_imdb_id FROM t.imdb_tv_episode_rating)
                                  AND d.seasonNumber > 0 AND d.episodeNumber IS NOT NULL
                                  AND d.tconst NOT IN (SELECT episode_imdb_id FROM t.imdb_tv_episode_rating)""").fetchone()[0]
    longest = db.sql("""SELECT s.show_imdb_id, count(*) seasons, sum(rated_episodes) eps, max(season_number) max_season
                        FROM t.imdb_tv_season_rating s GROUP BY 1 ORDER BY eps DESC LIMIT 10""").fetchall()
    fanout = db.sql("""SELECT count(*) FILTER (n > 1), max(n) FROM (SELECT imdb_id, count(*) n FROM show_map
                       WHERE imdb_id IN (SELECT DISTINCT show_imdb_id FROM t.imdb_tv_episode_rating) GROUP BY 1)""").fetchone()
    sz_dist = db.sql("""SELECT quantile_cont(n, [0.5, 0.9, 0.99]), max(n) FROM
                        (SELECT show_imdb_id, count(*) n FROM t.imdb_tv_episode_rating GROUP BY 1)""").fetchone()
    rep["q2"] = {
        "rated_episodes": g[0], "shows_with_grid": g[1], "rated_season0": g[2], "rated_season_null": g[3],
        "rated_episode_null": g[4], "rated_year_numbered_seasons": g[5],
        "duplicate_positions": dup[0], "duplicate_extra_rows": dup[1],
        "seasons_where_max_ep_exceeds_rated": gaps[0], "grid_cells_without_rating": gaps[1],
        "of_which_episode_exists_but_unrated": unrated_in_grid, "numbering_holes_no_episode_at_all": holes[0],
        "seasons_with_numbering_holes": holes[1], "numbered_episodes_in_grid_shows": holes[2], "seasons_with_max_ep_over_400": holes[3],
        "all_episodes_of_mapped_shows": all_eps[0], "all_null_season": all_eps[1], "all_season0": all_eps[2],
        "longest": longest, "tconsts_shared_by_several_tmdb_shows": fanout[0], "max_tmdb_shows_per_tconst": fanout[1],
        "rated_eps_per_show_p50_p90_p99_max": [sz_dist[0], sz_dist[1]],
    }
    for k, v in rep["q2"].items():
        print(f"  {k}: {v}")

    print("\n==================== Q3: IMDb vs TMDB season/episode numbering ====================")
    m = INPUTS / "mongo"
    db.execute(f"""
        CREATE TEMP TABLE tmdb AS
        SELECT tmdb_id::INTEGER tmdb_id, title, vote_count::INTEGER vote_count, external_ids.imdb_id imdb_id,
               number_of_seasons, number_of_episodes, seasons
        FROM read_json_auto('{m}/tmdb_tv_details_seasons_top3000.jsonl', maximum_object_size=10000000)""")
    # Season level. Only AIRED seasons on both sides: TMDB seasons with air_date <= today, IMDb seasons
    # with at least one rated episode (IMDb lists announced future seasons with unrated placeholder episodes).
    db.execute(f"""
        CREATE TEMP TABLE tm_seasons AS
        SELECT tmdb_id, imdb_id, title, vote_count, s.season_number sn, s.episode_count cnt
        FROM (SELECT *, unnest(seasons) s FROM tmdb)
        WHERE s.season_number > 0 AND s.air_date IS NOT NULL AND s.air_date <= '{TODAY}'""")
    db.execute("""
        CREATE TEMP TABLE im_seasons AS
        SELECT d.parentTconst imdb_id, d.seasonNumber sn, count(*) cnt, max(d.episodeNumber) max_ep
        FROM ds_episode d LEFT JOIN t.imdb_tv_episode_rating r ON r.episode_imdb_id = d.tconst
        WHERE d.parentTconst IN (SELECT imdb_id FROM tmdb) AND d.seasonNumber > 0
        GROUP BY ALL HAVING count(r.episode_imdb_id) > 0""")
    db.execute("""
        CREATE TEMP TABLE im_unnum AS
        SELECT parentTconst imdb_id, count(*) FILTER (seasonNumber IS NULL) s_null
        FROM ds_episode WHERE parentTconst IN (SELECT imdb_id FROM tmdb) GROUP BY ALL""")
    # rated-cell coverage: TMDB positions (season, 1..episode_count) that get an IMDb rating by position
    db.execute("""
        CREATE TEMP TABLE pos AS SELECT tmdb_id, imdb_id, sn, unnest(range(1, cnt + 1)) ep FROM tm_seasons WHERE cnt > 0""")
    db.execute("""
        CREATE TEMP TABLE align AS
        WITH per AS (
          SELECT t.tmdb_id, t.imdb_id, t.title, t.vote_count,
                 (SELECT list(sn ORDER BY sn) FROM tm_seasons x WHERE x.tmdb_id = t.tmdb_id) tm_s,
                 (SELECT list(sn ORDER BY sn) FROM im_seasons y WHERE y.imdb_id = t.imdb_id) im_s,
                 (SELECT sum(cnt) FROM tm_seasons x WHERE x.tmdb_id = t.tmdb_id) tm_eps,
                 (SELECT sum(cnt) FROM im_seasons y WHERE y.imdb_id = t.imdb_id) im_eps,
                 (SELECT count(*) FROM tm_seasons x JOIN im_seasons y ON y.imdb_id = x.imdb_id AND y.sn = x.sn
                   WHERE x.tmdb_id = t.tmdb_id AND x.cnt <> y.cnt) seasons_count_diff,
                 (SELECT max(abs(x.cnt - y.cnt)) FROM tm_seasons x JOIN im_seasons y ON y.imdb_id = x.imdb_id AND y.sn = x.sn
                   WHERE x.tmdb_id = t.tmdb_id) max_count_diff,
                 (SELECT s_null FROM im_unnum u WHERE u.imdb_id = t.imdb_id) im_null,
                 (SELECT count(*) FROM pos p WHERE p.tmdb_id = t.tmdb_id) tm_cells,
                 (SELECT count(*) FROM pos p JOIN t.imdb_tv_episode_rating e
                    ON e.show_imdb_id = p.imdb_id AND e.season_number = p.sn AND e.episode_number = p.ep
                  WHERE p.tmdb_id = t.tmdb_id) rated_cells,
                 (SELECT count(*) FROM t.imdb_tv_episode_rating e WHERE e.show_imdb_id = t.imdb_id AND e.season_number > 0) im_rated
          FROM tmdb t)
        SELECT *, CASE
            WHEN im_s IS NULL THEN 'no_rated_imdb_episodes'
            WHEN tm_s IS NULL THEN 'no_aired_tmdb_seasons'
            WHEN tm_s = im_s AND seasons_count_diff = 0 THEN 'exact'
            WHEN tm_s = im_s AND max_count_diff <= 2 THEN 'same_seasons_counts_off_by_1_2'
            WHEN tm_s = im_s THEN 'same_seasons_counts_off_by_3plus'
            WHEN list_max(im_s) > 1900 THEN 'imdb_year_numbered_seasons'
            WHEN tm_eps = im_eps THEN 'same_total_different_season_split'
            WHEN len(tm_s) < len(im_s) THEN 'imdb_has_more_seasons'
            WHEN len(tm_s) > len(im_s) THEN 'tmdb_has_more_seasons'
            ELSE 'different_season_numbers'
          END cls
        FROM per""")
    rep["q3"] = {}
    for label, where in [("all 3,001 most popular shows", "true"), ("TMDB vote_count >= 500", "vote_count >= 500")]:
        rows = db.sql(f"""SELECT cls, count(*), round(100 * sum(rated_cells) / nullif(sum(tm_cells), 0), 1) cell_cov,
                                 round(100 * sum(rated_cells) / nullif(sum(im_rated), 0), 1) imdb_used
                          FROM align WHERE {where} GROUP BY 1 ORDER BY 2 DESC""").fetchall()
        tot = db.sql(f"""SELECT count(*), round(100 * sum(rated_cells) / nullif(sum(tm_cells), 0), 1),
                                round(100 * sum(rated_cells) / nullif(sum(im_rated), 0), 1) FROM align WHERE {where}""").fetchone()
        print(f"  {label}: {tot[0]} shows; aired TMDB cells that get an IMDb rating by (season, episode): {tot[1]}%; IMDb rated regular-season episodes that land on a TMDB cell: {tot[2]}%")
        for r in rows:
            print(f"     {r[0]:36} {r[1]:5}  cell coverage {r[2]}%  imdb used {r[3]}%")
        rep["q3"][label] = {"total": tot, "classes": rows}
    ex = db.sql("""SELECT cls, title, tmdb_id, imdb_id, vote_count, tm_s, im_s, tm_eps, im_eps, max_count_diff, im_null
                   FROM align WHERE cls NOT IN ('exact') AND vote_count >= 500
                   QUALIFY row_number() OVER (PARTITION BY cls ORDER BY vote_count DESC) <= 4 ORDER BY cls, vote_count DESC""").fetchall()
    print("  season-level examples (vote_count >= 500):")
    short = lambda l: l if l is None or len(l) < 12 else f"{l[:3]}..{l[-2:]} ({len(l)})"
    for r in ex:
        print(f"     {r[0]:32} {r[1][:28]:28} tmdb {r[2]:>7} {r[3]:11} tmdb {short(r[5])} eps {r[7]} | imdb {short(r[6])} eps {r[8]} maxdiff {r[9]} null-season {r[10]}")
    rep["q3"]["examples"] = [[str(x) for x in r] for r in ex]

    # Episode level: TMDB episode lists saved once for the ~200 most-voted shows. Compare the episode TITLE
    # at the same (season, episode) on both sides. Same position + same title = the rating lands on the right cell.
    db.execute(f"""
        CREATE TEMP TABLE tm_eps AS
        SELECT tmdb_id::INTEGER tmdb_id, imdb_id, title, e.s::INTEGER s, e.e::INTEGER ep, e.name, e.air, e.va, e.vc
        FROM (SELECT *, unnest(episodes) e FROM read_json_auto('{INPUTS}/tmdb_seasons/*.json', maximum_object_size=50000000))""")
    basics = INPUTS / "snapshots" / "title.basics.tsv.gz"
    db.execute(f"""
        CREATE TEMP TABLE im_titles AS
        SELECT b.tconst, b.primaryTitle FROM {tsv(basics, {'tconst': 'VARCHAR', 'titleType': 'VARCHAR', 'primaryTitle': 'VARCHAR', 'originalTitle': 'VARCHAR', 'isAdult': 'VARCHAR', 'startYear': 'VARCHAR', 'endYear': 'VARCHAR', 'runtimeMinutes': 'VARCHAR', 'genres': 'VARCHAR'})} b
        WHERE b.tconst IN (SELECT tconst FROM ds_episode WHERE parentTconst IN (SELECT DISTINCT imdb_id FROM tm_eps)
                           UNION ALL SELECT unnest({list(DEMO_SHOWS)}))""")
    db.execute(r"""CREATE TEMP MACRO norm(x) AS regexp_replace(lower(coalesce(x, '')), '[^a-z0-9]', '', 'g')""")
    db.execute(r"""CREATE TEMP MACRO generic(x) AS x IS NULL OR regexp_matches(lower(x), '^(episode|folge|capítulo|episodio|épisode|chapter)?\s*#?[0-9. ]*$')""")
    db.execute("""
        CREATE TEMP TABLE im_eps AS
        SELECT d.parentTconst imdb_id, d.tconst, d.seasonNumber s, d.episodeNumber ep, i.primaryTitle AS name,
               r.user_score_original rating, r.user_score_vote_count votes
        FROM ds_episode d LEFT JOIN im_titles i ON i.tconst = d.tconst
        LEFT JOIN t.imdb_tv_episode_rating r ON r.episode_imdb_id = d.tconst
        WHERE d.parentTconst IN (SELECT DISTINCT imdb_id FROM tm_eps)""")
    db.execute(f"""
        CREATE TEMP TABLE ep_align AS
        SELECT t.tmdb_id, t.title, t.s, t.ep, t.name tm_name, i.tconst, i.name im_name, i.rating, i.votes,
               CASE
                 WHEN i.tconst IS NULL THEN 'no_imdb_episode_at_position'
                 WHEN generic(t.name) OR generic(i.name) THEN 'generic_title_cannot_judge'
                 WHEN norm(t.name) = norm(i.name) OR jaro_winkler_similarity(norm(t.name), norm(i.name)) >= 0.9
                      OR (length(norm(t.name)) >= 6 AND length(norm(i.name)) >= 6
                          AND (contains(norm(i.name), norm(t.name)) OR contains(norm(t.name), norm(i.name)))) THEN 'same_title'
                 WHEN EXISTS (SELECT 1 FROM im_eps j WHERE j.imdb_id = t.imdb_id AND length(norm(t.name)) >= 4
                              AND norm(j.name) = norm(t.name)) THEN 'title_found_at_other_position'
                 ELSE 'different_title'
               END m
        FROM tm_eps t LEFT JOIN im_eps i ON i.imdb_id = t.imdb_id AND i.s = t.s AND i.ep = t.ep
        WHERE t.s > 0 AND t.air IS NOT NULL AND t.air <= '{TODAY}'""")
    ep_tot = db.sql("SELECT m, count(*), count(*) FILTER (rating IS NOT NULL) FROM ep_align GROUP BY 1 ORDER BY 2 DESC").fetchall()
    n_shows = db.sql("SELECT count(DISTINCT tmdb_id) FROM ep_align").fetchone()[0]
    print(f"  episode level, {n_shows} most-voted shows, aired TMDB episodes (S>0) by what IMDb has at the same position:")
    for r in ep_tot:
        print(f"     {r[0]:32} {r[1]:7,}  (rated on IMDb: {r[2]:,})")
    per_show = db.sql("""
        SELECT title, tmdb_id, count(*) cells,
               count(*) FILTER (m = 'same_title') same, count(*) FILTER (m = 'title_found_at_other_position') shifted,
               count(*) FILTER (m = 'different_title') diff, count(*) FILTER (m = 'no_imdb_episode_at_position') missing
        FROM ep_align GROUP BY ALL""").fetchall()
    bad = sorted([r for r in per_show if (r[4] + r[5]) >= 3], key=lambda r: -(r[4] + r[5]) / r[2])
    clean = sum(1 for r in per_show if (r[4] + r[5]) == 0)
    print(f"  shows with zero wrong-position titles: {clean} of {len(per_show)}; shows with >= 3: {len(bad)}; worst (shifted + different / cells):")
    for r in bad[:15]:
        print(f"     {r[0][:34]:34} tmdb {r[1]:>7} cells {r[2]:5} same {r[3]:5} shifted {r[4]:4} different {r[5]:4} no-imdb {r[6]:4}")
    shifted_ex = db.sql("""SELECT title, s, ep, tm_name, im_name FROM ep_align WHERE m = 'title_found_at_other_position'
                           QUALIFY row_number() OVER (PARTITION BY tmdb_id ORDER BY s, ep) = 1 LIMIT 8""").fetchall()
    for r in shifted_ex:
        print(f"     e.g. {r[0][:24]:24} S{r[1]}E{r[2]}: TMDB '{r[3]}' vs IMDb '{r[4]}'")
    rep["q3"]["episode_level"] = {"shows": n_shows, "classes": ep_tot, "clean_shows": clean, "shows_with_3plus": len(bad),
                                  "worst": bad[:15], "shift_examples": shifted_ex}

    demo = DEMO_SHOWS
    titles = dict(db.sql("SELECT tconst, primaryTitle FROM im_titles").fetchall())
    grids = []
    for tt, label in demo.items():
        show = db.sql(f"SELECT tmdb_id, user_score_original, user_score_vote_count FROM t.imdb_tv_rating WHERE imdb_id = '{tt}' ORDER BY tmdb_id LIMIT 1").fetchone()
        eps = db.sql(f"""SELECT d.tconst, d.seasonNumber, d.episodeNumber, e.user_score_original, e.user_score_vote_count
                         FROM ds_episode d LEFT JOIN t.imdb_tv_episode_rating e ON e.episode_imdb_id = d.tconst
                         WHERE d.parentTconst = '{tt}' ORDER BY d.seasonNumber NULLS LAST, d.episodeNumber NULLS LAST""").fetchall()
        seasons = db.sql(f"""SELECT season_number, user_score_vote_weighted, user_score_vote_count, rated_episodes, max_episode_number
                             FROM t.imdb_tv_season_rating WHERE show_imdb_id = '{tt}' ORDER BY 1""").fetchall()
        tm = db.sql(f"SELECT tmdb_id, title, vote_count, seasons FROM tmdb WHERE imdb_id = '{tt}' ORDER BY vote_count DESC LIMIT 1").fetchone()
        al = db.sql(f"SELECT cls, tm_cells, rated_cells, im_rated FROM align WHERE imdb_id = '{tt}' ORDER BY vote_count DESC LIMIT 1").fetchone()
        tme = db.sql(f"""SELECT t.s, t.ep, t.name, t.air, t.va, t.vc, a.m FROM tm_eps t
                         LEFT JOIN ep_align a ON a.tmdb_id = t.tmdb_id AND a.s = t.s AND a.ep = t.ep
                         WHERE t.imdb_id = '{tt}' ORDER BY 1, 2""").fetchall()
        grids.append({
            "imdb_id": tt, "name": label, "tmdb_id": tm[0] if tm else None,
            "show_rating": show[1] if show else None, "show_votes": show[2] if show else None,
            "episodes": [{"t": e[0], "s": e[1], "e": e[2], "r": e[3], "v": e[4], "n": titles.get(e[0])} for e in eps],
            "seasons": [{"s": s[0], "r": round(s[1], 2), "v": s[2], "rated": s[3], "max_ep": s[4]} for s in seasons],
            "tmdb_seasons": [{"s": x["season_number"], "n": x["episode_count"], "name": x["name"], "air": x["air_date"], "va": x["vote_average"]} for x in (tm[3] or [])] if tm else [],
            "tmdb_episodes": [{"s": x[0], "e": x[1], "n": x[2], "air": x[3], "va": x[4], "vc": x[5], "m": x[6]} for x in tme],
            "align": {"cls": al[0], "tmdb_cells": al[1], "rated_cells": al[2], "imdb_rated": al[3]} if al else None,
        })
        print(f"  grid {label}: {len(eps)} IMDb episodes, {len(seasons)} rated seasons, {len(tme)} TMDB episodes, season-level class {al}")
    rep["grids"] = grids
    return rep


# ---------------------------------------------------------------------------


def main():
    WORK.mkdir(exist_ok=True)
    snap = INPUTS / "snapshots"
    t0 = time.time()
    print("PROTOTYPE imdb dataset collector - target:", TARGET)
    if "--reports-only" not in __import__("sys").argv:
        seed_target()
    db = worker_conn()
    print_state("seeding the target with today's production imdb_*_rating values", target_state(db, SAMPLE_SHOWS))
    db.close()

    day1 = SnapshotSource("Wayback copy, ratings published 2026-09-23", {
        "title.ratings.tsv.gz": snap / "title.ratings.published-2026-09-23.tsv.gz",
        "title.episode.tsv.gz": snap / "title.episode.published-2026-08-09.tsv.gz"})
    day2 = SnapshotSource("Wayback copy, ratings published 2026-09-24", {
        "title.ratings.tsv.gz": snap / "title.ratings.published-2026-09-24.tsv.gz",
        "title.episode.tsv.gz": snap / "title.episode.published-2026-08-09.tsv.gz"})
    live = LiveSource()

    import sys
    if "--reports-only" in sys.argv:
        rep = reports([])
        print(json.dumps({k: v for k, v in rep.items() if k != "grids"}, default=str)[:3000])
        return
    runs = [
        daily_run(1, "first load (ratings 2026-09-23, episodes 2026-08-09)", day1),
        daily_run(2, "same files again -> ETag skip", day1),
        daily_run(3, "same files, ETag check bypassed -> must write nothing", day1, force=True),
        daily_run(4, "next day (ratings 2026-09-24, same episode file)", day2),
        daily_run(5, "live: today's files from datasets.imdbws.com", live),
        daily_run(6, "live again -> real ETag skip", live),
    ]
    rep = reports(runs)
    rep["runs"] = runs
    rep["target_bytes"] = TARGET.stat().st_size
    rep["download_bytes"] = sum(p.stat().st_size for p in DOWNLOADS.glob("*.gz"))
    rep["process_peak_rss_mb"] = round(SAMPLER.peak / 1e6)
    rep["wall_s"] = round(time.time() - t0, 1)

    print("\n==================== Q4: runtime, memory, disk ====================")
    for r in runs:
        print(f"  run {r['run']} {r['outcome']:9} {r.get('timings')} peak_rss={r.get('peak_rss_mb', '-')} MB")
    print(f"  downloads on disk {mb(rep['download_bytes'])}, target DuckDB {mb(rep['target_bytes'])}, whole script {rep['wall_s']} s")

    REPORT_JSON.write_text(json.dumps(rep, default=str, indent=1))
    # inject the real data into the HTML demo
    html = HTML.read_text()
    a, b = "/*REAL_DATA_START*/", "/*REAL_DATA_END*/"
    slim = {"grids": rep["grids"], "q2": rep["q2"], "q3": {k: v for k, v in rep["q3"].items() if k != "examples"},
            "q3_examples": rep["q3"]["examples"],
            "runs": [{k: r.get(k) for k in ["run", "label", "outcome", "timings", "peak_rss_mb", "titles", "title_writes", "episodes", "episode_writes", "seasons"]} for r in runs]}
    html = html[: html.index(a) + len(a)] + "\nconst REAL = " + json.dumps(slim, default=str) + ";\n" + html[html.index(b):]
    HTML.write_text(html)
    print(f"\n  wrote {REPORT_JSON.name} and injected real data into {HTML.name}")


if __name__ == "__main__":
    main()
