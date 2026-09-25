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
            [db.tmdb_movie_details, db.imdb_movie_rating], selector, use_compound_hint=True))

        self.assertEqual(batches, [[1, 3], [2]])


if __name__ == "__main__":
    unittest.main()
