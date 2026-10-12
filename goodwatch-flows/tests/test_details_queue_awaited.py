"""The details queue rechecks the titles members wait for, next to its never-fetched and stale titles."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock
from mongoengine import connect, disconnect, get_db

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.awaited_titles import store_list
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_api.tmdb_fetch_details_from_api import next as details_next

NOW = datetime.utcnow()
YESTERDAY = NOW - timedelta(days=1)


class AwaitedTitlesInTheDetailsQueueTests(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect("details_queue_awaited_test", mongo_client_class=mongomock.MongoClient,
                uuidRepresentation="standard")
        self.addCleanup(disconnect)
        self.db = get_db()

    def batch(self, now=NOW):
        """The (media type, TMDB id) of every title the next run fetches."""
        ids = details_next.next_ids(self.db, now)
        return sorted(
            [("movie", movie.tmdb_id) for movie in TmdbMovieDetails.objects(id__in=ids["movie_ids"])]
            + [("show", show.tmdb_id) for show in TmdbTvDetails.objects(id__in=ids["tv_ids"])]
        )

    def test_an_awaited_title_is_fetched_again_a_day_after_its_last_fetch(self):
        TmdbMovieDetails(tmdb_id=603, popularity=50, selected_at=YESTERDAY).save()
        TmdbMovieDetails(tmdb_id=604, popularity=50, selected_at=YESTERDAY).save()
        TmdbTvDetails(tmdb_id=95396, popularity=50, selected_at=YESTERDAY).save()
        store_list(self.db, [("movie", 603), ("show", 95396)], NOW)

        self.assertEqual(self.batch(), [("movie", 603), ("show", 95396)])
        self.assertEqual(self.batch(NOW + timedelta(minutes=1)), [])

    def test_awaited_titles_take_ten_slots_of_a_full_batch_and_the_rest_follow_in_the_next(self):
        for tmdb_id in range(1, 16):
            TmdbMovieDetails(tmdb_id=tmdb_id, popularity=1, selected_at=YESTERDAY).save()
        for tmdb_id in range(1000, 1060):
            TmdbMovieDetails(tmdb_id=tmdb_id, popularity=9).save()  # never fetched
        store_list(self.db, [("movie", tmdb_id) for tmdb_id in range(1, 16)], NOW)

        first, second = self.batch(), self.batch(NOW + timedelta(seconds=15))

        self.assertEqual(len(first), 50)
        self.assertEqual(sum(tmdb_id < 1000 for _, tmdb_id in first), 10)
        self.assertEqual(sum(tmdb_id < 1000 for _, tmdb_id in second), 5)
        self.assertEqual(len({tmdb_id for _, tmdb_id in first + second if tmdb_id < 1000}), 15)

    def test_an_awaited_title_that_is_also_stale_is_fetched_once(self):
        TmdbMovieDetails(tmdb_id=603, popularity=50, selected_at=NOW - timedelta(days=40)).save()
        store_list(self.db, [("movie", 603)], NOW)

        ids = details_next.next_ids(self.db, NOW)

        self.assertEqual(len(ids["movie_ids"]), 1)

    def test_a_title_deleted_on_tmdb_or_unknown_to_the_catalog_is_left_out(self):
        TmdbMovieDetails(tmdb_id=603, popularity=50, selected_at=YESTERDAY, tmdb_deleted=True).save()
        TmdbTvDetails(tmdb_id=95396, popularity=50, selected_at=YESTERDAY).save()
        store_list(self.db, [("movie", 603), ("movie", 999999), ("show", 95396)], NOW)

        self.assertEqual(self.batch(), [("show", 95396)])

    def test_a_movie_and_a_show_with_the_same_id_are_told_apart(self):
        TmdbMovieDetails(tmdb_id=1399, popularity=50, selected_at=YESTERDAY).save()
        TmdbTvDetails(tmdb_id=1399, popularity=50, selected_at=YESTERDAY).save()
        store_list(self.db, [("show", 1399)], NOW)

        self.assertEqual(self.batch(), [("show", 1399)])

    def test_a_list_that_cannot_be_read_leaves_the_regular_batch_untouched(self):
        TmdbMovieDetails(tmdb_id=1000, popularity=9).save()  # never fetched

        with patch.object(details_next, "reserve_due", side_effect=RuntimeError("list unavailable")), \
                patch("builtins.print") as printed:
            batch = self.batch()

        self.assertEqual(batch, [("movie", 1000)])
        self.assertIn("list unavailable", " ".join(str(call) for call in printed.call_args_list))


if __name__ == "__main__":
    unittest.main()
