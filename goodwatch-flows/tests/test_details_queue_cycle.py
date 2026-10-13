"""The details queue fetches never-fetched titles and, again, the titles whose second of the 30-day cycle came."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock
from mongoengine import connect, disconnect, get_db

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.awaited_titles import store_list
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_api.refetch_cycle import ids_due
from f.tmdb_api.tmdb_fetch_details_from_api import next as details_next

# The queue reserves titles with the clock's time, so these tests run at the clock's time too.
NOW = datetime.utcnow().replace(microsecond=0)
NOW_SECOND = int((NOW - datetime(1970, 1, 1)).total_seconds())
NEVER_FETCHED = 5_000_000  # ids from here on have their second far from NOW


def due_at(offset: int) -> int:
    """A TMDB id that is due `offset` seconds after NOW."""
    return ids_due(NOW_SECOND + offset, 3_000_000)[0]


class DetailsQueueCycleTests(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect("details_queue_cycle_test", mongo_client_class=mongomock.MongoClient,
                uuidRepresentation="standard")
        self.addCleanup(disconnect)
        self.db = get_db()
        details_next.next_ids(self.db, NOW)  # the first run starts the cycle

    def fetched(self, tmdb_id, days_ago=20):
        TmdbMovieDetails(tmdb_id=tmdb_id, popularity=1, selected_at=NOW - timedelta(days=days_ago)).save()
        return tmdb_id

    def never_fetched(self, count):
        for tmdb_id in range(NEVER_FETCHED, NEVER_FETCHED + count):
            TmdbMovieDetails(tmdb_id=tmdb_id, popularity=9).save()

    def batch(self, offset):
        """The TMDB ids of the movies the run `offset` seconds after NOW fetches."""
        ids = details_next.next_ids(self.db, NOW + timedelta(seconds=offset))
        self.assertEqual(len(ids["movie_ids"]), len(set(ids["movie_ids"])))
        return sorted(movie.tmdb_id for movie in TmdbMovieDetails.objects(id__in=ids["movie_ids"]))

    def test_a_title_is_fetched_again_when_its_second_of_the_cycle_comes(self):
        due_now, due_in_three_minutes = self.fetched(due_at(10)), self.fetched(due_at(180))

        self.assertEqual(self.batch(15), [due_now])
        self.assertEqual(self.batch(165), [])
        self.assertEqual(self.batch(180), [due_in_three_minutes])

    def test_a_title_not_fetched_for_more_than_30_days_waits_for_its_second(self):
        # Titles that were all fetched in one week must not come back as one week.
        self.fetched(due_at(3600), days_ago=45)

        self.assertEqual(self.batch(15), [])

    def test_a_title_due_13_days_after_its_last_fetch_is_fetched(self):
        tmdb_id = self.fetched(due_at(10), days_ago=13)

        self.assertEqual(self.batch(15), [tmdb_id])

    def test_never_fetched_titles_fill_the_room_the_due_titles_leave(self):
        due = [self.fetched(due_at(offset)) for offset in range(1, 10)]
        self.never_fetched(60)

        batch = self.batch(15)

        self.assertEqual(len(batch), 50)
        self.assertEqual([tmdb_id for tmdb_id in batch if tmdb_id < NEVER_FETCHED], sorted(due))

    def test_due_titles_get_half_the_batch_when_both_groups_could_fill_it(self):
        due = [self.fetched(due_at(offset)) for offset in range(1, 41)]
        self.never_fetched(60)

        first, second = self.batch(60), self.batch(75)

        self.assertEqual([tmdb_id for tmdb_id in first if tmdb_id < NEVER_FETCHED], sorted(due[:25]))
        self.assertEqual(len(first), 50)
        self.assertEqual([tmdb_id for tmdb_id in second if tmdb_id < NEVER_FETCHED], sorted(due[25:]))

    def test_due_titles_fill_the_batch_when_nothing_is_left_to_fetch_for_the_first_time(self):
        due = [self.fetched(due_at(offset)) for offset in range(1, 61)]

        self.assertEqual(self.batch(60), sorted(due[:50]))
        self.assertEqual(self.batch(75), sorted(due[50:]))

    def test_an_awaited_title_whose_second_comes_is_fetched_once(self):
        tmdb_id = self.fetched(due_at(10))
        store_list(self.db, [("movie", tmdb_id)], NOW)

        self.assertEqual(self.batch(15), [tmdb_id])

    def test_awaited_titles_leave_room_for_the_due_titles(self):
        awaited = [self.fetched(NEVER_FETCHED - 1 - n, days_ago=2) for n in range(15)]
        due = [self.fetched(due_at(offset)) for offset in range(1, 51)]
        store_list(self.db, [("movie", tmdb_id) for tmdb_id in awaited], NOW)

        batch = self.batch(60)

        self.assertEqual(len(batch), 50)
        self.assertEqual(len(set(batch) & set(awaited)), 10)
        self.assertEqual(sorted(set(batch) - set(awaited)), sorted(due[:40]))

    def test_a_reserved_title_is_not_due_again_before_its_next_second(self):
        tmdb_id = self.fetched(due_at(10))
        self.batch(15)

        self.assertEqual(self.batch(30), [])
        self.assertEqual(TmdbMovieDetails.objects.get(tmdb_id=tmdb_id).is_selected, True)

    def test_a_show_is_fetched_when_its_second_comes(self):
        tmdb_id = due_at(10)
        TmdbTvDetails(tmdb_id=tmdb_id, popularity=1, selected_at=NOW - timedelta(days=20)).save()

        ids = details_next.next_ids(self.db, NOW + timedelta(seconds=15))

        self.assertEqual([show.tmdb_id for show in TmdbTvDetails.objects(id__in=ids["tv_ids"])], [tmdb_id])


if __name__ == "__main__":
    unittest.main()
