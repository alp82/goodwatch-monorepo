"""Diff the IMDb datasets against the stored values, in DuckDB.

`f/imdb_datasets/ingest` loads the day's files and the stored Mongo values into the input
tables below, runs the diffs, and writes only what they report. Nothing here does I/O.

Titles (`imdb_movie_rating`, `imdb_tv_rating`, keyed by TMDB id):
- A stored value is rewritten when the rating changed or the vote count moved at least
  1 % (and at least one vote) from the stored value. Comparing with the stored value, not
  yesterday's file, lets slow vote growth add up until it is written.
- A value from the old imdb.com scraper is rewritten once with `source: "imdb_dataset"`.
  It counts as material (and moves `updated_at`, which the Crate sync reads) only when the
  values differ by the rule above.
- A title missing from the file keeps its value and is marked `dataset_missing_since`. The
  value is cleared once it has been missing for `MISSING_GRACE_DAYS`.

Episodes (`imdb_tv_episode_rating`) are keyed by the episode tconst, so an episode that moves
to another season or show is an update. Seasons (`imdb_tv_season_rating`) are keyed by
(show tconst, season number) in IMDb's numbering. A season score is the vote-weighted mean
of its rated episodes. Specials have no season number and belong to no season score.
"""

DAILY_FILES = ("title.ratings.tsv.gz", "title.episode.tsv.gz")

# Votes must move at least this share of the stored count (and at least one vote).
VOTE_SHARE = 0.01
MISSING_GRACE_DAYS = 30

TITLE_WRITES = ("new", "remapped", "back", "replace_scraped", "rating_changed", "votes_changed")
EPISODE_WRITES = ("new", "moved", "moved_show", "rating_changed", "votes_changed", "renamed")

INPUT_TABLES = {
    # title.ratings: every rated title and episode.
    "ds_ratings": "tconst VARCHAR, rating DOUBLE, votes BIGINT",
    # title.episode, rated episodes of mapped shows. A special has a NULL season.
    "ds_episodes": "tconst VARCHAR, show_tconst VARCHAR, season INTEGER, episode INTEGER",
    # title.basics episode titles, filled on the weekly refresh and empty otherwise.
    "ds_names": "tconst VARCHAR, name VARCHAR",
    # imdb_{movie,tv}_rating, without titles deleted on TMDB. kind is 'movie' or 'tv'.
    "stored_titles": "kind VARCHAR, tmdb_id INTEGER, imdb_id VARCHAR, rating DOUBLE, votes BIGINT, "
                     "source VARCHAR, missing_since VARCHAR",
    # tmdb_{movie,tv}_details documents updated since the last run, with their IMDb id.
    "details_delta": "kind VARCHAR, tmdb_id INTEGER, imdb_id VARCHAR, deleted BOOLEAN",
    "stored_episodes": "tconst VARCHAR, show_tconst VARCHAR, season INTEGER, episode INTEGER, "
                       "rating DOUBLE, votes BIGINT, name VARCHAR",
    "stored_seasons": "show_tconst VARCHAR, season INTEGER, rating DOUBLE, votes BIGINT, "
                      "rated_episodes INTEGER, max_episode INTEGER",
}


def _in(values) -> str:
    return "(" + ", ".join(f"'{value}'" for value in values) + ")"


def _moved(new, old) -> str:
    """SQL: the vote count moved enough from the stored count to be written."""
    return f"abs({new} - {old}) >= greatest(1, {VOTE_SHARE} * {old})"


def create_input_tables(db) -> None:
    for table, columns in INPUT_TABLES.items():
        db.execute(f"CREATE OR REPLACE TABLE {table} ({columns})")


def should_skip(stored_etags: dict, current_etags: dict, relinked: int, pending_shows: int) -> bool:
    """Skip the run when both files are unchanged, TMDB moved no title to another IMDb id, and
    no Crate sync is left over from an earlier run.

    A title's first IMDb id does not force a run: TMDB adds thousands a day while its details
    are fetched, and they wait for the next files like any new rating. A skipped run keeps
    the details window open, so they are read again then."""
    same_files = all(
        current_etags.get(name) and stored_etags.get(name) == current_etags.get(name) for name in DAILY_FILES
    )
    return same_files and relinked == 0 and pending_shows == 0


def build_title_map(db) -> None:
    """title_map(kind, tmdb_id, imdb_id): the stored links, updated with the TMDB details
    changed since the last run. A details document without a valid id keeps the stored link;
    a title deleted on TMDB leaves the map."""
    db.execute(r"""
        CREATE OR REPLACE TABLE title_map AS
        WITH delta AS (
            SELECT kind, tmdb_id, any_value(imdb_id) imdb_id, bool_or(deleted) deleted
            FROM details_delta
            WHERE deleted OR regexp_full_match(imdb_id, 'tt[0-9]+')
            GROUP BY kind, tmdb_id
        ),
        kept AS (
            SELECT kind, tmdb_id, any_value(imdb_id) imdb_id
            FROM stored_titles
            WHERE regexp_full_match(imdb_id, 'tt[0-9]+')
            GROUP BY kind, tmdb_id
        )
        SELECT kind, tmdb_id, imdb_id FROM delta WHERE NOT deleted
        UNION ALL
        SELECT k.kind, k.tmdb_id, k.imdb_id FROM kept k
        WHERE NOT EXISTS (SELECT 1 FROM delta d WHERE d.kind = k.kind AND d.tmdb_id = k.tmdb_id)
    """)


def link_changes(db) -> dict:
    """Titles TMDB linked to their first IMDb id since the last run (new) or moved to another
    IMDb id (relinked)."""
    new, relinked = db.execute(r"""
        WITH s AS (
            SELECT kind, tmdb_id, coalesce(bool_or(regexp_full_match(imdb_id, 'tt[0-9]+')), false) linked,
                   list(imdb_id) imdb_ids
            FROM stored_titles GROUP BY kind, tmdb_id
        )
        SELECT count(*) FILTER (s.tmdb_id IS NULL OR NOT s.linked),
               count(*) FILTER (s.linked AND NOT list_contains(s.imdb_ids, m.imdb_id))
        FROM title_map m LEFT JOIN s ON s.kind = m.kind AND s.tmdb_id = m.tmdb_id
    """).fetchone()
    return {"new": new, "relinked": relinked}


def diff_titles(db, run_date: str) -> dict:
    """title_changes: one row per mapped or stored title, with its change and whether the
    values moved enough to count as material."""
    db.execute(f"""
        CREATE OR REPLACE TABLE title_changes AS
        WITH n AS (
            SELECT m.kind, m.tmdb_id, m.imdb_id, r.rating, r.votes
            FROM title_map m JOIN ds_ratings r ON r.tconst = m.imdb_id
        ),
        s AS (
            SELECT * FROM stored_titles
            QUALIFY row_number() OVER (PARTITION BY kind, tmdb_id ORDER BY rating IS NULL, votes DESC) = 1
        ),
        j AS (
            SELECT coalesce(n.kind, s.kind) kind, coalesce(n.tmdb_id, s.tmdb_id) tmdb_id,
                   coalesce(n.imdb_id, s.imdb_id) imdb_id, n.rating, n.votes,
                   s.tmdb_id IS NOT NULL has_stored, s.imdb_id old_imdb_id,
                   s.rating old_rating, s.votes old_votes, s.source, s.missing_since,
                   n.tmdb_id IS NOT NULL in_file
            FROM n FULL OUTER JOIN s ON s.kind = n.kind AND s.tmdb_id = n.tmdb_id
        )
        SELECT *,
            CASE
                WHEN NOT in_file AND old_rating IS NULL THEN 'none'
                WHEN NOT in_file AND missing_since IS NULL THEN 'gone'
                WHEN NOT in_file AND CAST(missing_since AS DATE)
                     <= CAST(? AS DATE) - INTERVAL {MISSING_GRACE_DAYS} DAY THEN 'expired'
                WHEN NOT in_file THEN 'missing'
                WHEN NOT has_stored OR old_rating IS NULL THEN 'new'
                WHEN old_imdb_id IS DISTINCT FROM imdb_id THEN 'remapped'
                WHEN missing_since IS NOT NULL THEN 'back'
                WHEN source IS DISTINCT FROM 'imdb_dataset' THEN 'replace_scraped'
                WHEN rating <> old_rating THEN 'rating_changed'
                WHEN {_moved('votes', 'old_votes')} THEN 'votes_changed'
                WHEN votes <> old_votes THEN 'below_threshold'
                ELSE 'unchanged'
            END AS change,
            in_file AND (
                old_rating IS NULL OR old_votes IS NULL OR old_imdb_id IS DISTINCT FROM imdb_id
                OR rating <> old_rating OR {_moved('votes', 'old_votes')}
            ) AS material
        FROM j
    """, [run_date])
    return count_changes(db, "title_changes")


def count_changes(db, table: str, by_kind: bool = False) -> dict:
    group = "kind || ':' || change" if by_kind else "change"
    return dict(db.execute(f"SELECT {group}, count(*) FROM {table} GROUP BY ALL ORDER BY 1").fetchall())


def title_writes(db) -> list[tuple]:
    """(tmdb_id, kind, imdb_id, rating, votes, material) for every title to rewrite."""
    return db.execute(f"""
        SELECT tmdb_id, kind, imdb_id, rating, votes, material FROM title_changes
        WHERE change IN {_in(TITLE_WRITES)} ORDER BY kind, tmdb_id
    """).fetchall()


def mapping_writes(db) -> list[tuple]:
    """(kind, tmdb_id, imdb_id) of new or changed TMDB links that no rating write stores,
    so the next run still knows them."""
    return db.execute(f"""
        SELECT m.kind, m.tmdb_id, m.imdb_id FROM title_map m
        WHERE NOT EXISTS (SELECT 1 FROM stored_titles s
                          WHERE s.kind = m.kind AND s.tmdb_id = m.tmdb_id AND s.imdb_id = m.imdb_id)
          AND NOT EXISTS (SELECT 1 FROM title_changes c
                          WHERE c.kind = m.kind AND c.tmdb_id = m.tmdb_id AND c.change IN {_in(TITLE_WRITES)})
        ORDER BY 1, 2
    """).fetchall()


def missing_marks(db) -> list[tuple]:
    """(kind, tmdb_id) of titles that just went missing from the file."""
    return db.execute("SELECT kind, tmdb_id FROM title_changes WHERE change = 'gone' ORDER BY 1, 2").fetchall()


def expired_titles(db) -> list[tuple]:
    """(kind, tmdb_id) of titles missing for longer than the grace period."""
    return db.execute("SELECT kind, tmdb_id FROM title_changes WHERE change = 'expired' ORDER BY 1, 2").fetchall()


def diff_episodes(db) -> dict:
    """episode_changes against the stored episodes, effective_episodes (the stored state after
    the writes) and touched_shows (show tconsts whose episodes changed)."""
    db.execute(f"""
        CREATE OR REPLACE TABLE episode_changes AS
        WITH n AS (
            SELECT e.tconst, e.show_tconst, e.season, e.episode, r.rating, r.votes, nm.name AS new_name
            FROM ds_episodes e
            JOIN ds_ratings r ON r.tconst = e.tconst
            LEFT JOIN (SELECT tconst, any_value(name) AS name FROM ds_names GROUP BY tconst) nm ON nm.tconst = e.tconst
            QUALIFY row_number() OVER (PARTITION BY e.tconst ORDER BY e.show_tconst) = 1
        )
        SELECT coalesce(n.tconst, s.tconst) tconst,
               coalesce(n.show_tconst, s.show_tconst) show_tconst, s.show_tconst old_show_tconst,
               CASE WHEN n.tconst IS NULL THEN s.season ELSE n.season END season,
               CASE WHEN n.tconst IS NULL THEN s.episode ELSE n.episode END episode,
               n.rating, n.votes, coalesce(n.new_name, s.name) AS name,
               s.rating old_rating, s.votes old_votes,
               CASE
                   WHEN n.tconst IS NULL THEN 'removed'
                   WHEN s.tconst IS NULL THEN 'new'
                   WHEN s.show_tconst IS DISTINCT FROM n.show_tconst THEN 'moved_show'
                   WHEN s.season IS DISTINCT FROM n.season OR s.episode IS DISTINCT FROM n.episode THEN 'moved'
                   WHEN n.rating IS DISTINCT FROM s.rating THEN 'rating_changed'
                   WHEN s.votes IS NULL OR {_moved('n.votes', 's.votes')} THEN 'votes_changed'
                   WHEN n.new_name IS NOT NULL AND n.new_name IS DISTINCT FROM s.name THEN 'renamed'
                   WHEN n.votes <> s.votes THEN 'below_threshold'
                   ELSE 'unchanged'
               END AS change
        FROM n FULL OUTER JOIN stored_episodes s ON s.tconst = n.tconst
    """)
    db.execute(f"""
        CREATE OR REPLACE TABLE effective_episodes AS
        SELECT tconst, show_tconst, season, episode,
               CASE WHEN change IN {_in(EPISODE_WRITES)} THEN rating ELSE old_rating END rating,
               CASE WHEN change IN {_in(EPISODE_WRITES)} THEN votes ELSE old_votes END votes,
               name
        FROM episode_changes WHERE change <> 'removed'
    """)
    db.execute("""
        CREATE OR REPLACE TABLE touched_shows AS
        SELECT DISTINCT show_tconst FROM (
            SELECT show_tconst FROM episode_changes WHERE change NOT IN ('unchanged', 'below_threshold')
            UNION ALL
            SELECT old_show_tconst FROM episode_changes
            WHERE change NOT IN ('unchanged', 'below_threshold') AND old_show_tconst IS NOT NULL
        )
    """)
    return count_changes(db, "episode_changes")


def episode_writes(db) -> list[tuple]:
    """(tconst, show_tconst, season, episode, rating, votes, name) for every episode to write."""
    return db.execute(f"""
        SELECT tconst, show_tconst, season, episode, rating, votes, name FROM episode_changes
        WHERE change IN {_in(EPISODE_WRITES)} ORDER BY tconst
    """).fetchall()


def episode_deletes(db) -> list[str]:
    return [row[0] for row in db.execute(
        "SELECT tconst FROM episode_changes WHERE change = 'removed' ORDER BY tconst").fetchall()]


def diff_seasons(db) -> dict:
    """all_seasons: every season score from the effective episodes. season_changes: the diff
    against the stored seasons. Seasons without a rated episode (announced ones) have no row."""
    # IMDb ratings have one decimal, so the mean is computed exactly in integers (tenths times
    # votes) and rounded half up to two decimals. A float sum depends on the summation order and
    # rounds an exact half either way, which would rewrite the season on every run.
    db.execute("""
        CREATE OR REPLACE TABLE all_seasons AS
        WITH w AS (
            SELECT show_tconst, season,
                   sum(CAST(round(rating * 10) AS BIGINT) * votes)::HUGEINT tenths_votes,
                   sum(votes)::HUGEINT votes, count(*)::INTEGER rated_episodes, max(episode) max_episode
            FROM effective_episodes
            WHERE season IS NOT NULL AND season > 0 AND votes > 0
            GROUP BY show_tconst, season
        )
        SELECT show_tconst, season,
               CAST((20 * tenths_votes + votes) // (2 * votes) AS DOUBLE) / 100 rating,
               votes::BIGINT votes, rated_episodes, max_episode
        FROM w
    """)
    db.execute("""
        CREATE OR REPLACE TABLE season_changes AS
        SELECT coalesce(n.show_tconst, s.show_tconst) show_tconst, coalesce(n.season, s.season) season,
               n.rating, n.votes, n.rated_episodes, n.max_episode,
               CASE
                   WHEN n.show_tconst IS NULL THEN 'removed'
                   WHEN s.show_tconst IS NULL THEN 'new'
                   WHEN n.rating IS DISTINCT FROM s.rating OR n.votes IS DISTINCT FROM s.votes
                        OR n.rated_episodes IS DISTINCT FROM s.rated_episodes
                        OR n.max_episode IS DISTINCT FROM s.max_episode THEN 'changed'
                   ELSE 'unchanged'
               END AS change
        FROM all_seasons n
        FULL OUTER JOIN stored_seasons s ON s.show_tconst = n.show_tconst AND s.season = n.season
    """)
    return count_changes(db, "season_changes")


def season_writes(db) -> list[tuple]:
    """(show_tconst, season, rating, votes, rated_episodes, max_episode) for every season to write."""
    return db.execute("""
        SELECT show_tconst, season, rating, votes, rated_episodes, max_episode FROM season_changes
        WHERE change IN ('new', 'changed') ORDER BY show_tconst, season
    """).fetchall()


def season_deletes(db) -> list[tuple]:
    return db.execute(
        "SELECT show_tconst, season FROM season_changes WHERE change = 'removed' ORDER BY 1, 2").fetchall()


def crate_shows_to_sync(db) -> list[int]:
    """TMDB show ids whose Crate episode and season rows must be rewritten: shows whose
    episodes or seasons changed, and shows TMDB linked to a new IMDb id."""
    return [row[0] for row in db.execute("""
        SELECT DISTINCT tmdb_id FROM (
            SELECT m.tmdb_id FROM title_map m
            WHERE m.kind = 'tv' AND m.imdb_id IN (
                SELECT show_tconst FROM touched_shows
                UNION SELECT show_tconst FROM season_changes WHERE change <> 'unchanged'
            )
            UNION ALL
            SELECT m.tmdb_id FROM title_map m
            WHERE m.kind = 'tv' AND NOT EXISTS (
                SELECT 1 FROM stored_titles s
                WHERE s.kind = 'tv' AND s.tmdb_id = m.tmdb_id AND s.imdb_id = m.imdb_id
            )
        ) ORDER BY 1
    """).fetchall()]


def _rows(db, sql: str, params: list) -> list[dict]:
    cursor = db.execute(sql, params)
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def crate_episode_rows(db, show_ids: list[int]) -> list[dict]:
    """Rows of the Crate imdb_episode table for these TMDB show ids, in IMDb numbering."""
    return _rows(db, """
        SELECT m.tmdb_id show_id, e.tconst imdb_episode_id, e.show_tconst imdb_show_id,
               e.season season_number, e.episode episode_number, e.name,
               e.rating imdb_user_score_original, e.votes imdb_user_score_rating_count
        FROM title_map m JOIN effective_episodes e ON e.show_tconst = m.imdb_id
        WHERE m.kind = 'tv' AND list_contains(?, m.tmdb_id)
        ORDER BY 1, 4 NULLS LAST, 5 NULLS LAST, 2
    """, [show_ids])


def crate_season_rows(db, show_ids: list[int]) -> list[dict]:
    """Rows of the Crate imdb_season table for these TMDB show ids."""
    return _rows(db, """
        SELECT m.tmdb_id show_id, s.season season_number, s.show_tconst imdb_show_id,
               s.rating imdb_user_score_original, s.votes imdb_user_score_rating_count,
               s.rated_episodes imdb_rated_episode_count, s.max_episode max_episode_number
        FROM title_map m JOIN all_seasons s ON s.show_tconst = m.imdb_id
        WHERE m.kind = 'tv' AND list_contains(?, m.tmdb_id)
        ORDER BY 1, 2
    """, [show_ids])


def main():
    pass
