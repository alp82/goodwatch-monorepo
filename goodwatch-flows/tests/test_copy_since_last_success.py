"""The fingerprint and details copies read the changes since their last successful run (#194)."""
import sys
import unittest
from contextlib import nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import sync_state, vector_data

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
        self.fail = set()

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
                if media_type in self.fail:
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
                patch.object(vector_data, "_published_streaming", side_effect=lambda media_type, ids: {i: [] for i in ids}), \
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
                         {"selected": 1, "upserts": 1, "skipped_unknown_streaming": 0})

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
        self.fail = {"movie"}
        movies, shows, _, error = self.run_main()

        # The movies fail the run before the shows start, so neither time moves.
        self.assertIn("movie write failed", str(error))
        self.assertEqual((movies, shows), ([], []))
        self.assertEqual(last_success(self.db, "vector_data", "movie"), NOW)
        self.assertEqual(last_success(self.db, "vector_data", "show"), NOW)

        self.now = NOW + 8 * HOUR
        self.fail = set()
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
        self.fail = {"show"}
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


if __name__ == "__main__":
    unittest.main()
