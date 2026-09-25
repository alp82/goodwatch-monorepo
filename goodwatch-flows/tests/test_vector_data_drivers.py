"""The scheduled Qdrant copy picks up titles whose IMDb rating or DNA changed without a details update."""
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

    def test_recent_dna_changes_add_fingerprinted_titles_once(self):
        db = mongomock.MongoClient().goodwatch
        now = datetime.utcnow()
        old = now - timedelta(days=30)
        db.tmdb_movie_details.insert_many([
            {"tmdb_id": tmdb_id, "updated_at": now if tmdb_id == 1 else old} for tmdb_id in (1, 2, 3, 4)])
        db.dna_movie.insert_many([
            {"tmdb_id": 1, "updated_at": now, "vector_fingerprint": [0.1]},
            # New DNA or fingerprint since the title's last TMDB refresh.
            {"tmdb_id": 2, "updated_at": now, "vector_fingerprint": [0.2]},
            # DNA without a fingerprint has nothing to publish.
            {"tmdb_id": 3, "updated_at": now},
            {"tmdb_id": 4, "updated_at": old, "vector_fingerprint": [0.4]}])
        selector = {"updated_at": {"$gte": now - timedelta(hours=vector_data.HOURS_TO_FETCH)}}

        drivers = vector_data._drivers(db.tmdb_movie_details, db.imdb_movie_rating, db.dna_movie, recent_only=True)
        batches = list(vector_data._driver_batches(drivers, selector, use_compound_hint=True))

        self.assertEqual(batches, [[1], [2]])

    def test_a_full_copy_walks_only_the_details(self):
        db = mongomock.MongoClient().goodwatch

        drivers = vector_data._drivers(db.tmdb_movie_details, db.imdb_movie_rating, db.dna_movie, recent_only=False)

        self.assertEqual([collection for collection, _ in drivers], [db.tmdb_movie_details])


if __name__ == "__main__":
    unittest.main()
