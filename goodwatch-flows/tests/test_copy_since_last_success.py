"""The fingerprint and details copies read the changes since their last successful run (#194)."""
import sys
import unittest
from contextlib import nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import sync_state, tmdb_details, vector_data
from test_details_copy_paging import Crate

NOW = datetime(2026, 10, 6, 12, 0, 0)
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)


def state(db, job, media_type):
    return db.sync_state.find_one({"_id": f"{job}:{media_type}"})


def last_success(db, job, media_type):
    document = state(db, job, media_type)
    return document and document["last_success_started_at"]


class VectorCopyTests(unittest.TestCase):
    """f/sync/copy/vector_data main() against an in-memory Mongo; Qdrant and Crate are recorded."""

    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = NOW
        self.failing = set()
        # Titles Crate has no published streaming for.
        self.unpublished = set()

    def carried(self, media_type):
        return state(self.db, "vector_data", media_type).get("carried_ids")

    def title(self, media_type, tmdb_id, *, details=None, imdb=None, dna=None, tropes=None):
        """Store a title with a fingerprint; each named source gets that updated_at."""
        long_ago = NOW - 90 * DAY
        suffix = "movie" if media_type == "movie" else "tv"
        for collection, updated_at, fields in (
            (f"tmdb_{suffix}_details", details, {"title": f"Title {tmdb_id}"}),
            (f"imdb_{suffix}_rating", imdb, {"user_score_normalized_percent": 70}),
            (f"dna_{suffix}", dna, {"vector_fingerprint": [0.1, 0.2]}),
            (f"tv_tropes_{suffix}_tags", tropes, {"tropes": [{"name": "Red Herring"}]}),
        ):
            self.db[collection].replace_one(
                {"tmdb_id": tmdb_id}, {"tmdb_id": tmdb_id, "updated_at": updated_at or long_ago, **fields},
                upsert=True)

    def run_main(self, **arguments):
        """Returns (movie ids written, show ids written, result, error)."""
        written = {"movie": [], "show": []}

        def write(client, collection, operations, check_owned):
            for point in operations[0].upsert.points:
                media_type = point.payload["media_type"]
                if media_type in self.failing:
                    raise RuntimeError(f"{media_type} write failed")
                written[media_type].append(point.payload["tmdb_id"])
            return {"attempts": 1, "retries": 0, "errors": {}}

        collections = {"movie": self.db.tmdb_movie_details, "show": self.db.tmdb_tv_details}
        with patch.object(vector_data, "init_mongodb"), patch.object(vector_data, "close_mongodb"), \
                patch.object(vector_data, "QdrantConnector"), \
                patch.object(vector_data, "get_db", return_value=self.db), \
                patch.object(vector_data, "TmdbMovieDetails", MagicMock(_get_collection=lambda: collections["movie"])), \
                patch.object(vector_data, "TmdbTvDetails", MagicMock(_get_collection=lambda: collections["show"])), \
                patch.object(vector_data, "_collection_vector_names", return_value={"fingerprint_v1"}), \
                patch.object(vector_data, "publication_lease", side_effect=lambda *args: nullcontext(lambda: None)), \
                patch.object(vector_data, "_published_streaming", side_effect=lambda media_type, ids: {
                    i: [] for i in ids if i not in self.unpublished}), \
                patch.object(vector_data, "write_with_retry", side_effect=write), \
                patch.object(vector_data, "delete_titles_from_qdrant", return_value={}), \
                patch.object(vector_data, "_start_title_snapshot", return_value="job-1"), \
                patch.object(sync_state, "utc_now", return_value=self.now):
            try:
                result, error = vector_data.main(**arguments), None
            except RuntimeError as failed:
                result, error = None, failed
        return sorted(written["movie"]), sorted(written["show"]), result, error

    def test_the_first_run_copies_the_48_hour_window_and_records_its_start(self):
        self.title("movie", 1, details=NOW - HOUR)
        self.title("movie", 2, details=NOW - timedelta(hours=49))
        self.title("show", 3, details=NOW - 47 * HOUR)

        movies, shows, result, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [3]))
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW)
        self.assertEqual(last_success(self.db, "vector_data", "show"), NOW)
        self.assertTrue(result["movies"]["selection"]["fallback"])
        self.assertEqual(result["movies"]["selected"], 1)
        self.assertEqual(state(self.db, "vector_data", "movie")["last_run"]["counts"],
                         {"selected": 1, "upserts": 1, "skipped_unknown_streaming": 0,
                          "carried": 0, "carried_written": 0})

    def test_the_next_run_copies_what_any_of_the_four_sources_changed_since(self):
        self.title("movie", 1, details=NOW - 2 * HOUR)
        self.title("movie", 2, details=NOW - timedelta(minutes=20))
        self.run_main()

        self.now = NOW + 4 * HOUR
        self.title("movie", 3, details=NOW + HOUR)
        self.title("movie", 4, imdb=NOW + HOUR)
        self.title("movie", 5, dna=NOW + HOUR)
        self.title("movie", 6, tropes=NOW + HOUR)
        movies, _, result, _ = self.run_main()

        # 1 is not written again. 2 changed in the 30 minutes before the first run started.
        self.assertEqual(movies, [2, 3, 4, 5, 6])
        self.assertEqual(result["movies"]["selection"]["since"], (NOW - timedelta(minutes=30)).isoformat())
        self.assertFalse(result["movies"]["selection"]["fallback"])
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW + 4 * HOUR)

    def test_a_failed_run_keeps_the_time_and_the_next_run_covers_the_gap(self):
        self.run_main()
        self.title("movie", 1, imdb=NOW + HOUR)
        self.title("show", 2, dna=NOW + HOUR)

        self.now = NOW + 4 * HOUR
        self.failing = {"movie"}
        movies, shows, _, error = self.run_main()

        # The movies fail the run before the shows start, so neither time moves.
        self.assertIn("movie write failed", str(error))
        self.assertEqual((movies, shows), ([], []))
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW)
        self.assertEqual(last_success(self.db, "vector_data", "show"), NOW)

        self.now = NOW + 8 * HOUR
        self.failing = set()
        movies, shows, result, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [2]))
        self.assertEqual(result["movies"]["selection"]["since"], (NOW - timedelta(minutes=30)).isoformat())
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW + 8 * HOUR)

    def test_movies_that_succeeded_advance_even_when_the_shows_fail(self):
        self.run_main()
        self.title("movie", 1, details=NOW + HOUR)
        self.title("show", 2, details=NOW + HOUR)

        self.now = NOW + 4 * HOUR
        self.failing = {"show"}
        movies, _, _, error = self.run_main()

        self.assertIn("show write failed", str(error))
        self.assertEqual(movies, [1])
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW + 4 * HOUR)
        self.assertEqual(last_success(self.db, "vector_data", "show"), NOW)

    def test_a_run_reaches_back_7_days_at_most_and_says_so(self):
        self.run_main()
        self.title("movie", 1, details=NOW + 2 * DAY)
        self.title("movie", 2, details=NOW + 4 * DAY)

        self.now = NOW + 10 * DAY
        movies, _, result, _ = self.run_main()

        self.assertEqual(movies, [2])
        self.assertTrue(result["movies"]["selection"]["lookback_capped"])
        self.assertIn("Run a full copy", result["movies"]["selection"]["warning"])

    def test_a_run_restricted_to_ids_keeps_the_fixed_window_and_leaves_the_state_alone(self):
        self.run_main()
        before = list(self.db.sync_state.find())
        # The fixed window ends at the real clock.
        recent = datetime.utcnow() - 10 * HOUR
        self.title("movie", 1, details=recent)
        self.title("movie", 2, details=recent)
        self.title("show", 3, details=recent)
        self.title("show", 4, details=datetime.utcnow() - 3 * DAY)

        self.now = NOW + 4 * HOUR
        movies, shows, result, _ = self.run_main(movie_ids=["1"], show_ids=["3", "4"])

        self.assertEqual((movies, shows), ([1], [3]))
        self.assertEqual(list(self.db.sync_state.find()), before)
        self.assertNotIn("selection", result["movies"])
        self.assertNotIn("title_snapshot", result)

    def test_only_the_restricted_media_type_is_left_out_of_the_state(self):
        self.run_main()

        self.now = NOW + 4 * HOUR
        self.run_main(movie_ids=["1"])

        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW)
        self.assertEqual(last_success(self.db, "vector_data", "show"), NOW + 4 * HOUR)

    def test_a_title_without_published_streaming_is_copied_again_until_it_is_written(self):
        self.title("movie", 1, dna=NOW - HOUR)
        self.title("movie", 2, dna=NOW - HOUR)
        self.unpublished = {1}
        movies, _, result, _ = self.run_main()

        self.assertEqual(movies, [2])
        self.assertEqual(result["movies"]["skipped_unknown_streaming"], 1)
        self.assertNotIn("unknown_streaming_ids", result["movies"])
        self.assertEqual(self.carried("movie"), [1])

        # No driver of 1 moves again, and the next run's selection starts after its change.
        self.now = NOW + 4 * HOUR
        movies, _, result, _ = self.run_main()
        self.assertEqual(movies, [])
        self.assertEqual(self.carried("movie"), [1])
        self.assertEqual(result["movies"]["selection"]["carried_ids"], 1)
        self.assertEqual((result["movies"]["carried"], result["movies"]["carried_written"]), (1, 0))

        self.now = NOW + 8 * HOUR
        self.unpublished = set()
        movies, _, result, _ = self.run_main()
        self.assertEqual(movies, [1])
        self.assertEqual(self.carried("movie"), [])
        self.assertEqual((result["movies"]["carried"], result["movies"]["carried_written"]), (1, 1))
        self.assertEqual(state(self.db, "vector_data", "movie")["last_run"]["counts"], {
            "selected": 1, "upserts": 1, "skipped_unknown_streaming": 0, "carried": 1, "carried_written": 1})

        self.now = NOW + 12 * HOUR
        self.assertEqual(self.run_main()[0], [])

    def test_a_failed_run_keeps_the_carried_titles_and_the_next_run_adds_its_own(self):
        self.title("movie", 1, dna=NOW - HOUR)
        self.unpublished = {1, 2}
        self.run_main()
        self.title("movie", 2, dna=NOW + HOUR)
        self.title("movie", 3, dna=NOW + HOUR)

        self.now = NOW + 4 * HOUR
        self.failing = {"movie"}
        _, _, _, error = self.run_main()

        self.assertIn("movie write failed", str(error))
        self.assertEqual(self.carried("movie"), [1])

        # The gap is read again, so 2 is found without published streaming a second time.
        self.now = NOW + 8 * HOUR
        self.failing = set()
        movies, _, _, _ = self.run_main()
        self.assertEqual(movies, [3])
        self.assertEqual(self.carried("movie"), [1, 2])

    def test_a_carried_title_that_can_no_longer_be_copied_is_dropped(self):
        for tmdb_id in (1, 2, 3):
            self.title("movie", tmdb_id, dna=NOW - HOUR)
        self.unpublished = {1, 2, 3}
        self.run_main()
        self.assertEqual(self.carried("movie"), [1, 2, 3])

        # 1 lost its fingerprint, 2 was deleted on TMDB, 3 still waits for its streaming.
        self.db.dna_movie.update_one({"tmdb_id": 1}, {"$unset": {"vector_fingerprint": ""}})
        self.db.tmdb_movie_details.update_one({"tmdb_id": 2}, {"$set": {"tmdb_deleted": True}})
        self.now = NOW + 4 * HOUR
        movies, _, _, _ = self.run_main()

        self.assertEqual(movies, [])
        self.assertEqual(self.carried("movie"), [3])

    def test_a_run_restricted_to_ids_neither_copies_nor_changes_the_carried_titles(self):
        self.title("movie", 1, dna=NOW - HOUR)
        self.unpublished = {1}
        self.run_main()
        before = list(self.db.sync_state.find())
        self.title("movie", 2, details=datetime.utcnow() - HOUR)

        self.now = NOW + 4 * HOUR
        self.unpublished = set()
        movies, shows, result, _ = self.run_main(movie_ids=["2"], show_ids=["9"])

        self.assertEqual(movies, [2])
        self.assertEqual(result["movies"]["carried"], 0)
        self.assertEqual(list(self.db.sync_state.find()), before)

    def test_a_full_copy_neither_reads_nor_moves_the_time(self):
        self.run_main()
        self.title("movie", 1, details=NOW - 30 * DAY)
        before = list(self.db.sync_state.find())
        written = []

        with patch.object(vector_data, "get_db", return_value=self.db), \
                patch.object(vector_data, "TmdbMovieDetails", MagicMock(_get_collection=lambda: self.db.tmdb_movie_details)), \
                patch.object(vector_data, "_collection_vector_names", return_value={"fingerprint_v1"}), \
                patch.object(vector_data, "publication_lease", side_effect=lambda *args: nullcontext(lambda: None)), \
                patch.object(vector_data, "_published_streaming", side_effect=lambda media_type, ids: {i: [] for i in ids}), \
                patch.object(vector_data, "write_with_retry", side_effect=lambda client, collection, operations, check: (
                    written.extend(point.payload["tmdb_id"] for point in operations[0].upsert.points)
                    or {"attempts": 1, "retries": 0, "errors": {}})), \
                patch.object(vector_data, "delete_titles_from_qdrant", return_value={}):
            vector_data.copy_to_qdrant(MagicMock(), "movie", {}, recent_only=False)

        self.assertEqual(written, [1])
        self.assertEqual(list(self.db.sync_state.find()), before)


class DetailsCrate(Crate):
    def disconnect(self):
        pass


class DetailsCopyTests(unittest.TestCase):
    """f/sync/copy/tmdb_details main() against an in-memory Mongo and a recording Crate."""

    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = NOW
        self.failing = set()

    def movie(self, tmdb_id, updated_at):
        self.db.tmdb_movie_details.replace_one(
            {"tmdb_id": tmdb_id}, {"tmdb_id": tmdb_id, "title": f"Movie {tmdb_id}", "updated_at": updated_at},
            upsert=True)

    def show(self, tmdb_id, updated_at):
        self.db.tmdb_tv_details.replace_one(
            {"tmdb_id": tmdb_id}, {"tmdb_id": tmdb_id, "title": f"Show {tmdb_id}", "updated_at": updated_at},
            upsert=True)

    def run_main(self, **arguments):
        """Returns (movie ids copied, show ids copied, results, error)."""
        copied = {"movie": [], "show": []}

        def on_upsert(table, records):
            if ("copy", table) in self.failing:
                raise RuntimeError(f"{table} copy failed")
            copied[table].extend(record.tmdb_id for record in records)

        def delete(connector, media_type, *args, **kwargs):
            if ("delete", media_type) in self.failing:
                raise RuntimeError(f"{media_type} delete failed")
            return {"titles_flagged": 0}

        with patch.object(tmdb_details, "init_mongodb"), patch.object(tmdb_details, "close_mongodb"), \
                patch.object(tmdb_details, "CrateConnector", return_value=DetailsCrate(on_upsert=on_upsert)), \
                patch.object(tmdb_details, "get_db", return_value=self.db), \
                patch.object(tmdb_details, "delete_flagged_titles_from_crate", side_effect=delete), \
                patch.object(tmdb_details, "delete_stale_child_rows", return_value={}), \
                patch.object(sync_state, "utc_now", return_value=self.now):
            try:
                results, error = tmdb_details.main(**arguments), None
            except tmdb_details.CopyFailed as failed:
                results, error = failed.results, failed
        return sorted(copied["movie"]), sorted(copied["show"]), results, error

    def test_the_first_run_copies_the_48_hour_window_and_records_its_start(self):
        self.movie(1, NOW - HOUR)
        self.movie(2, NOW - timedelta(hours=49))
        self.show(3, NOW - 47 * HOUR)

        movies, shows, results, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], [3]))
        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW)
        self.assertEqual(last_success(self.db, "tmdb_details", "show"), NOW)
        self.assertTrue(results["movies"]["selection"]["fallback"])
        self.assertEqual(results["movies"]["selection"]["since"], (NOW - timedelta(hours=48)).isoformat())
        self.assertEqual(state(self.db, "tmdb_details", "movie")["last_run"]["counts"],
                         {"records_received": 1, "rows_upserted": 1})

    def test_the_next_run_copies_only_what_changed_since_with_the_overlap(self):
        self.movie(1, NOW - 2 * HOUR)
        self.movie(2, NOW - timedelta(minutes=20))
        self.run_main()

        self.now = NOW + 12 * HOUR
        self.movie(3, NOW + HOUR)
        movies, _, results, _ = self.run_main()

        # 2 changed within the 30 minutes before the first run started and is read again.
        self.assertEqual(movies, [2, 3])
        self.assertFalse(results["movies"]["selection"]["fallback"])
        self.assertEqual(results["movies"]["selection"]["since"], (NOW - timedelta(minutes=30)).isoformat())
        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW + 12 * HOUR)

    def test_a_failed_movie_copy_keeps_the_movie_time_and_the_next_run_covers_the_gap(self):
        self.run_main()
        self.movie(1, NOW + HOUR)
        self.show(2, NOW + HOUR)

        self.now = NOW + 12 * HOUR
        self.failing = {("copy", "movie")}
        movies, shows, results, error = self.run_main()

        self.assertIn("movie copy", str(error))
        self.assertEqual((movies, shows), ([], [2]))
        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW)
        # The shows succeeded in every step, so their time advances on its own.
        self.assertEqual(last_success(self.db, "tmdb_details", "show"), NOW + 12 * HOUR)
        self.assertEqual(results["movies"]["selection"]["since"], (NOW - timedelta(minutes=30)).isoformat())

        self.now = NOW + 24 * HOUR
        self.failing = set()
        movies, shows, _, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual((movies, shows), ([1], []))
        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW + 24 * HOUR)

    def test_a_failed_deletion_keeps_the_time_of_that_media_type(self):
        self.run_main()

        self.now = NOW + 12 * HOUR
        self.failing = {("delete", "show")}
        _, _, _, error = self.run_main()

        self.assertIn("show deletion", str(error))
        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW + 12 * HOUR)
        self.assertEqual(last_success(self.db, "tmdb_details", "show"), NOW)

    def test_a_run_reaches_back_7_days_at_most_and_says_so(self):
        self.run_main()
        self.movie(1, NOW + 2 * DAY)
        self.movie(2, NOW + 4 * DAY)

        self.now = NOW + 10 * DAY
        movies, _, results, error = self.run_main()

        self.assertIsNone(error)
        self.assertEqual(movies, [2])
        selection = results["movies"]["selection"]
        self.assertTrue(selection["lookback_capped"])
        self.assertEqual(selection["since"], (NOW + 3 * DAY).isoformat())
        self.assertIn("Run a full copy", selection["warning"])

    def test_a_run_restricted_to_ids_leaves_the_state_alone(self):
        self.run_main()
        # A restricted run keeps the fixed window, which ends at the real clock.
        self.movie(1, datetime.utcnow() - HOUR)
        self.show(2, datetime.utcnow() - HOUR)
        movie_id = str(self.db.tmdb_movie_details.find_one({"tmdb_id": 1})["_id"])
        show_id = str(self.db.tmdb_tv_details.find_one({"tmdb_id": 2})["_id"])
        before = list(self.db.sync_state.find())

        self.now = NOW + 12 * HOUR
        movies, shows, results, _ = self.run_main(movie_ids=[movie_id], show_ids=[show_id])

        self.assertEqual((movies, shows), ([1], [2]))
        self.assertEqual(list(self.db.sync_state.find()), before)
        self.assertNotIn("selection", results["movies"])

    def test_only_the_restricted_media_type_is_left_out_of_the_state(self):
        self.run_main()
        self.movie(1, datetime.utcnow() - HOUR)
        movie_id = str(self.db.tmdb_movie_details.find_one({"tmdb_id": 1})["_id"])

        self.now = NOW + 12 * HOUR
        self.run_main(movie_ids=[movie_id])

        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW)
        self.assertEqual(last_success(self.db, "tmdb_details", "show"), NOW + 12 * HOUR)

    def test_skipped_movies_keep_their_time(self):
        self.run_main()

        self.now = NOW + 12 * HOUR
        self.run_main(skip_movies=True)

        self.assertEqual(last_success(self.db, "tmdb_details", "movie"), NOW)
        self.assertEqual(last_success(self.db, "tmdb_details", "show"), NOW + 12 * HOUR)

    def test_a_full_copy_neither_reads_nor_moves_the_time(self):
        self.run_main()
        self.movie(1, NOW - 30 * DAY)
        before = list(self.db.sync_state.find())
        crate = DetailsCrate()

        with patch.object(tmdb_details, "get_db", return_value=self.db), \
                patch.object(tmdb_details, "delete_flagged_titles_from_crate", return_value={}), \
                patch.object(tmdb_details, "delete_stale_child_rows", return_value={}):
            tmdb_details.copy_media(crate, {}, "movie", recent_only=False)

        self.assertEqual(crate.titles, [1])
        self.assertEqual(list(self.db.sync_state.find()), before)


if __name__ == "__main__":
    unittest.main()
