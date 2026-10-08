"""The ratings copy reads the changes since its last successful run (#391)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import all_ratings, sync_state

NOW = datetime(2026, 10, 6, 12, 0, 0)
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)
LONG_AGO = NOW - 90 * DAY
OVERLAP_START = (NOW - timedelta(minutes=30)).isoformat()


def state(db, job, media_type):
    return db.sync_state.find_one({"_id": f"{job}:{media_type}"})


def last_success(db, job, media_type):
    document = state(db, job, media_type)
    return document and document["last_success_started_at"]


class Crate:
    """Records what is written to each table. `rows` are the title rows Crate has: a title's
    analysis time by (table, tmdb id), which the analysis catch-up reads."""

    def __init__(self, failing, rows):
        self.failing = failing
        self.rows = rows
        self.records = {}
        self.disconnected = False

    def upsert_many(self, *, table, records, **kwargs):
        if table in self.failing:
            raise RuntimeError(f"{table} write failed")
        self.records.setdefault(table, []).extend(records)
        for record in records:
            if table in ("movie", "show") and getattr(record, "dna_updated_at", None) is not None:
                self.rows[(table, record.tmdb_id)] = record.dna_updated_at * 1000
        return {"records_received": len(records), "rows_upserted": len(records)}

    def select(self, sql, params=None):
        table = "movie" if "FROM movie" in sql else "show"
        if "catch-up select" in self.failing:
            raise RuntimeError("catch-up select failed")
        return [{"tmdb_id": tmdb_id, "dna_updated_at": self.rows[(table, tmdb_id)]}
                for tmdb_id in params[0] if (table, tmdb_id) in self.rows]

    def disconnect(self):
        self.disconnected = True


class CopyTests(unittest.TestCase):
    """main() of one copy against an in-memory Mongo and a recording Crate."""

    module = None
    job = None

    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = NOW
        self.failing = set()
        self.rows = {}

    def details(self, media_type, tmdb_id, updated_at=LONG_AGO, **fields):
        suffix = "movie" if media_type == "movie" else "tv"
        self.db[f"tmdb_{suffix}_details"].replace_one(
            {"tmdb_id": tmdb_id}, {"tmdb_id": tmdb_id, "updated_at": updated_at, **fields}, upsert=True)

    def flag(self, media_type, tmdb_id, deleted=True):
        suffix = "movie" if media_type == "movie" else "tv"
        self.db[f"tmdb_{suffix}_details"].update_one({"tmdb_id": tmdb_id}, {"$set": {"tmdb_deleted": deleted}})

    def run_main(self, **arguments):
        """Returns (movie ids written, show ids written, results, error)."""
        self.crate = Crate(self.failing, self.rows)
        with patch.object(self.module, "init_mongodb"), patch.object(self.module, "close_mongodb"), \
                patch.object(self.module, "CrateConnector", return_value=self.crate), \
                patch.object(self.module, "get_db", return_value=self.db), \
                patch.object(sync_state, "utc_now", return_value=self.now):
            try:
                results, error = self.module.main(**arguments), None
            except (RuntimeError, KeyError) as failed:
                results, error = None, failed
        self.assertTrue(self.crate.disconnected)
        return self.written("movie"), self.written("show"), results, error

    def written(self, table):
        return sorted(record.tmdb_id for record in self.crate.records.get(table, []))

    def last_success(self, media_type):
        return last_success(self.db, self.job, media_type)


class RatingsCopyTests(CopyTests):
    """f/sync/copy/all_ratings"""

    module = all_ratings
    job = "all_ratings"

    def rating(self, media_type, tmdb_id, source="imdb", updated_at=LONG_AGO, **fields):
        suffix = "movie" if media_type == "movie" else "tv"
        self.db[f"{source}_{suffix}_rating"].replace_one(
            {"tmdb_id": tmdb_id}, {"tmdb_id": tmdb_id, "updated_at": updated_at, **fields}, upsert=True)

    def test_the_first_run_copies_the_48_hour_window_and_records_its_start(self):
        self.rating("movie", 1, updated_at=NOW - HOUR)
        self.rating("movie", 2, updated_at=NOW - timedelta(hours=49))
        self.rating("show", 3, updated_at=NOW - 47 * HOUR)

        movies, shows, results, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [3]))
        self.assertEqual(self.last_success("movie"), NOW)
        self.assertEqual(self.last_success("show"), NOW)
        self.assertTrue(results["movies"]["selection"]["fallback"])
        self.assertEqual(results["movies"]["selection"]["since"], (NOW - timedelta(hours=48)).isoformat())
        # The keys the result had before are still there.
        self.assertEqual(results["movies"]["movies"], {"records_received": 1, "rows_upserted": 1})
        self.assertEqual(state(self.db, "all_ratings", "movie")["last_run"]["counts"],
                         {"selected": 1, "skipped_flagged": 0, "records_received": 1, "rows_upserted": 1})

    def test_the_next_run_copies_what_any_of_the_four_sources_changed_since(self):
        self.rating("movie", 1, updated_at=NOW - 2 * HOUR)
        self.rating("movie", 2, updated_at=NOW - timedelta(minutes=20))
        self.run_main()

        self.now = NOW + 6 * HOUR
        self.details("movie", 3, NOW + HOUR)
        self.rating("movie", 4, "imdb", NOW + HOUR)
        self.rating("movie", 5, "metacritic", NOW + HOUR)
        self.rating("movie", 6, "rotten_tomatoes", NOW + HOUR)
        movies, _, results, _ = self.run_main()

        # 1 is not written again. 2 changed in the 30 minutes before the first run started.
        self.assertEqual(movies, [2, 3, 4, 5, 6])
        self.assertEqual(results["movies"]["selection"]["since"], OVERLAP_START)
        self.assertFalse(results["movies"]["selection"]["fallback"])
        self.assertEqual(results["movies"]["selected"], 5)
        self.assertEqual(self.last_success("movie"), NOW + 6 * HOUR)

    def test_a_title_selected_by_one_source_is_written_with_the_scores_of_the_others(self):
        self.run_main()
        self.details("movie", 1, vote_average=8.0, vote_count=100)
        self.rating("movie", 1, "metacritic", user_score_normalized_percent=70.0)
        self.rating("movie", 1, "imdb", NOW + HOUR, user_score_normalized_percent=90.0)

        self.now = NOW + 6 * HOUR
        self.run_main()

        (record,) = self.crate.records["movie"]
        self.assertEqual(record.goodwatch_user_score_normalized_percent, (80.0 + 90.0 + 70.0) / 3)

    def test_a_failed_run_keeps_the_time_and_the_next_run_covers_the_gap(self):
        self.run_main()
        self.rating("movie", 1, updated_at=NOW + HOUR)
        self.rating("show", 2, updated_at=NOW + HOUR)

        self.now = NOW + 6 * HOUR
        self.failing = {"movie"}
        movies, shows, _, error = self.run_main()

        # The movies fail the run before the shows start, so neither time moves.
        self.assertIn("movie write failed", str(error))
        self.assertEqual((movies, shows), ([], []))
        self.assertEqual(self.last_success("movie"), NOW)
        self.assertEqual(self.last_success("show"), NOW)

        self.now = NOW + 12 * HOUR
        self.failing = set()
        movies, shows, results, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [2]))
        self.assertEqual(results["movies"]["selection"]["since"], OVERLAP_START)
        self.assertEqual(self.last_success("movie"), NOW + 12 * HOUR)

    def test_movies_that_succeeded_advance_even_when_the_shows_fail(self):
        self.run_main()
        self.rating("movie", 1, updated_at=NOW + HOUR)
        self.rating("show", 2, updated_at=NOW + HOUR)

        self.now = NOW + 6 * HOUR
        self.failing = {"show"}
        movies, _, _, error = self.run_main()

        self.assertIn("show write failed", str(error))
        self.assertEqual(movies, [1])
        self.assertEqual(self.last_success("movie"), NOW + 6 * HOUR)
        self.assertEqual(self.last_success("show"), NOW)

    def test_a_run_reaches_back_7_days_at_most_and_says_so(self):
        self.run_main()
        self.rating("movie", 1, updated_at=NOW + 2 * DAY)
        self.rating("movie", 2, updated_at=NOW + 4 * DAY)

        self.now = NOW + 10 * DAY
        movies, _, results, _ = self.run_main()

        self.assertEqual(movies, [2])
        self.assertTrue(results["movies"]["selection"]["lookback_capped"])
        self.assertIn("Run a full copy", results["movies"]["selection"]["warning"])

    def test_a_title_flagged_as_deleted_is_left_out_and_copied_when_it_is_restored(self):
        self.run_main()
        self.details("movie", 1)
        self.flag("movie", 1)
        self.rating("movie", 1, updated_at=NOW + HOUR, user_score_original=8.7)

        self.now = NOW + 6 * HOUR
        movies, _, results, _ = self.run_main()
        self.assertEqual(movies, [])
        self.assertEqual((results["movies"]["selected"], results["movies"]["skipped_flagged"]), (1, 1))
        self.assertEqual(self.last_success("movie"), NOW + 6 * HOUR)

        # While it stays flagged, no later run selects it.
        self.now = NOW + 12 * HOUR
        self.assertEqual(self.run_main()[0], [])

        # The fetch that restores a title moves its details' updated_at, which selects it.
        self.details("movie", 1, NOW + 13 * HOUR, tmdb_deleted=False)
        self.now = NOW + 18 * HOUR
        movies, _, _, _ = self.run_main()
        self.assertEqual(movies, [1])
        self.assertEqual(self.crate.records["movie"][0].imdb_user_score_original, 8.7)

    def test_a_run_restricted_to_ids_keeps_the_fixed_window_and_leaves_the_state_alone(self):
        self.run_main()
        # The fixed window ends at the real clock.
        self.rating("movie", 1, updated_at=datetime.utcnow() - HOUR)
        self.rating("movie", 2, updated_at=datetime.utcnow() - HOUR)
        self.rating("show", 3, updated_at=datetime.utcnow() - 3 * DAY)
        movie_id = str(self.db.imdb_movie_rating.find_one({"tmdb_id": 1})["_id"])
        show_id = str(self.db.imdb_tv_rating.find_one({"tmdb_id": 3})["_id"])
        before = list(self.db.sync_state.find())

        self.now = NOW + 6 * HOUR
        movies, shows, results, _ = self.run_main(movie_ids=[movie_id], show_ids=[show_id])

        self.assertEqual((movies, shows), ([1], []))
        self.assertEqual(list(self.db.sync_state.find()), before)
        self.assertNotIn("selection", results["movies"])

    def test_only_the_restricted_media_type_is_left_out_of_the_state(self):
        self.run_main()
        self.rating("movie", 1, updated_at=datetime.utcnow() - HOUR)
        movie_id = str(self.db.imdb_movie_rating.find_one({"tmdb_id": 1})["_id"])

        self.now = NOW + 6 * HOUR
        self.run_main(movie_ids=[movie_id])

        self.assertEqual(self.last_success("movie"), NOW)
        self.assertEqual(self.last_success("show"), NOW + 6 * HOUR)

    def test_skipped_movies_keep_their_time(self):
        self.run_main()

        self.now = NOW + 6 * HOUR
        _, _, results, _ = self.run_main(skip_movies=True)

        self.assertIsNone(results["movies"])
        self.assertEqual(self.last_success("movie"), NOW)
        self.assertEqual(self.last_success("show"), NOW + 6 * HOUR)

    def test_a_full_copy_takes_every_title_and_neither_reads_nor_moves_the_time(self):
        self.run_main()
        self.rating("movie", 1, updated_at=NOW - 30 * DAY)
        self.rating("show", 2)
        before = list(self.db.sync_state.find())

        self.now = NOW + 6 * HOUR
        movies, shows, results, error = self.run_main(full=True)

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [2]))
        self.assertEqual(list(self.db.sync_state.find()), before)
        self.assertNotIn("selection", results["movies"])

    def test_the_priority_publish_call_copies_its_ids_and_leaves_the_state_alone(self):
        self.rating("movie", 1, updated_at=None)
        crate = Crate(set(), {})

        with patch.object(all_ratings, "get_db", return_value=self.db):
            result = all_ratings.copy_media(
                connector=crate, query_selector={"tmdb_id": {"$in": [1]}}, media_type="movie", recent_only=False)

        self.assertEqual([record.tmdb_id for record in crate.records["movie"]], [1])
        self.assertEqual(result["movies"], {"records_received": 1, "rows_upserted": 1})
        self.assertEqual(list(self.db.sync_state.find()), [])


del CopyTests

if __name__ == "__main__":
    unittest.main()
