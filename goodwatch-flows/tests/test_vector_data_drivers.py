"""The scheduled Qdrant copy picks up titles whose IMDb rating changed without a details update."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import vector_data


class DriverBatchesTest(unittest.TestCase):
    def test_recent_imdb_changes_add_titles_once(self):
        db = mongomock.MongoClient().goodwatch
        now = datetime.utcnow()
        old = now - timedelta(days=30)
        db.tmdb_movie_details.insert_many([
            {"tmdb_id": 1, "updated_at": now}, {"tmdb_id": 2, "updated_at": old}, {"tmdb_id": 3, "updated_at": now}])
        db.imdb_movie_rating.insert_many([
            {"tmdb_id": 1, "updated_at": now}, {"tmdb_id": 2, "updated_at": now}, {"tmdb_id": 4, "updated_at": old}])
        selector = {"updated_at": {"$gte": now - timedelta(hours=vector_data.HOURS_TO_FETCH)}}

        batches = list(vector_data._driver_batches(
            [(db.tmdb_movie_details, None), (db.imdb_movie_rating, None)], selector, use_compound_hint=True))

        self.assertEqual(batches, [[1, 3], [2]])

    def test_the_imdb_driver_keeps_only_titles_with_a_fingerprint(self):
        db = mongomock.MongoClient().goodwatch
        now = datetime.utcnow()
        db.imdb_movie_rating.insert_many([{"tmdb_id": tmdb_id, "updated_at": now} for tmdb_id in (5, 6, 7)])
        db.dna_movie.insert_many([{"tmdb_id": 5, "vector_fingerprint": [0.1]}, {"tmdb_id": 6}])
        selector = {"updated_at": {"$gte": now - timedelta(hours=vector_data.HOURS_TO_FETCH)}}

        batches = list(vector_data._driver_batches(
            [(db.imdb_movie_rating, vector_data._with_fingerprint(db.dna_movie))], selector, use_compound_hint=True))

        self.assertEqual(batches, [[5]])


if __name__ == "__main__":
    unittest.main()
