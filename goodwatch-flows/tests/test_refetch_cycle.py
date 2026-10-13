"""Every title's fixed place in the 30-day refetch cycle of the details queue."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock
from mongoengine import connect, disconnect, get_db

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_api.refetch_cycle import ids_due, titles_due

START = datetime(2026, 10, 14, 6, 0, 10)
START_SECOND = int((START - datetime(1970, 1, 1)).total_seconds())
A_DAY = 86_400
CYCLE_SECONDS = 30 * A_DAY
# Higher than any TMDB id today (1.8 million), and higher than the seconds of a cycle.
HIGHEST_ID = 3_000_000


def due_at(offset: int) -> int:
    """A TMDB id that is due `offset` seconds after START."""
    return ids_due(START_SECOND + offset, HIGHEST_ID)[0]


class PlaceInTheCycleTests(unittest.TestCase):
    def test_every_id_is_due_in_exactly_one_second_of_a_cycle(self):
        times_due = bytearray(HIGHEST_ID + 1)
        for second in range(START_SECOND, START_SECOND + CYCLE_SECONDS):
            for tmdb_id in ids_due(second, HIGHEST_ID):
                times_due[tmdb_id] += 1

        self.assertEqual(set(times_due), {1})

    def test_an_id_is_due_again_30_days_later_to_the_second(self):
        self.assertEqual(ids_due(START_SECOND, HIGHEST_ID), ids_due(START_SECOND + CYCLE_SECONDS, HIGHEST_ID))
        self.assertNotEqual(ids_due(START_SECOND, HIGHEST_ID), ids_due(START_SECOND + CYCLE_SECONDS - 1, HIGHEST_ID))

    def test_no_id_above_the_highest_one_is_asked_for(self):
        for second in range(START_SECOND, START_SECOND + 1000):
            self.assertTrue(all(0 <= tmdb_id <= 338_106 for tmdb_id in ids_due(second, 338_106)))

    def test_every_day_holds_a_thirtieth_of_each_part_of_the_id_range(self):
        # Low ids are old and well-known titles, high ids recent and obscure ones. A day must not
        # hold more of one kind than another, or the offers found would rise and fall over the cycle.
        id_ranges = [(1, 100_000), (100_001, 338_106), (338_107, 1_000_000), (1_000_001, 1_794_277)]
        for day in (0, 13, 29):
            first = START_SECOND + day * A_DAY
            due = [tmdb_id for second in range(first, first + A_DAY) for tmdb_id in ids_due(second, 1_794_277)]
            for lowest, highest in id_ranges:
                share = sum(lowest <= tmdb_id <= highest for tmdb_id in due) / (highest - lowest + 1)
                self.assertAlmostEqual(share, 1 / 30, delta=0.0001, msg=f"day {day}, ids {lowest} to {highest}")

    def test_every_minute_holds_its_share_of_the_low_ids(self):
        # 100,000 ids in 43,200 minutes: 2.3 a minute. No minute gets a run of them.
        for minute in range(0, 600):
            first = START_SECOND + minute * 60
            low = sum(tmdb_id <= 100_000 for second in range(first, first + 60) for tmdb_id in ids_due(second, 1_794_277))
            self.assertIn(low, (1, 2, 3, 4), f"minute {minute}")


class TitlesDueTests(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect("refetch_cycle_test", mongo_client_class=mongomock.MongoClient, uuidRepresentation="standard")
        self.addCleanup(disconnect)
        self.db = get_db()

    def movie(self, tmdb_id, fetched_days_ago=20, **fields):
        TmdbMovieDetails(tmdb_id=tmdb_id, popularity=1, selected_at=START - timedelta(days=fetched_days_ago), **fields).save()
        return tmdb_id

    def due(self, offset, room=50):
        """The titles the run `offset` seconds after START takes, as (media type, TMDB id)."""
        entries = titles_due(self.db, [TmdbMovieDetails, TmdbTvDetails], room, START + timedelta(seconds=offset))
        return [("movie" if isinstance(entry, TmdbMovieDetails) else "show", entry.tmdb_id) for entry in entries]

    def test_the_first_run_starts_the_cycle_and_takes_nothing(self):
        self.movie(due_at(0))

        self.assertEqual(self.due(0), [])

    def test_a_run_takes_the_titles_whose_second_came_since_the_last_run(self):
        self.due(0)
        first, second, later = self.movie(due_at(1)), self.movie(due_at(15)), self.movie(due_at(16))

        self.assertEqual(self.due(15), [("movie", first), ("movie", second)])
        self.assertEqual(self.due(30), [("movie", later)])
        self.assertEqual(self.due(45), [])

    def test_a_title_is_due_whatever_its_age_and_a_title_not_due_is_left_however_old(self):
        self.due(0)
        fetched_13_days_ago = self.movie(due_at(5), fetched_days_ago=13)
        self.movie(due_at(5000), fetched_days_ago=45)

        self.assertEqual(self.due(15), [("movie", fetched_13_days_ago)])

    def test_a_late_run_takes_everything_that_came_due_in_between(self):
        # The seconds are counted from the last run, not from the schedule: a skipped run loses no title.
        self.due(0)
        titles = [self.movie(due_at(offset)) for offset in (3, 20, 58)]

        self.assertEqual(self.due(60), [("movie", tmdb_id) for tmdb_id in titles])

    def test_more_titles_than_a_batch_has_room_for_wait_for_the_next_runs_in_order(self):
        self.due(0)
        titles = [self.movie(due_at(offset)) for offset in range(1, 8)]

        taken = [self.due(3600, room=3), self.due(3615, room=3), self.due(3630, room=3)]

        self.assertEqual(taken[0], [("movie", tmdb_id) for tmdb_id in titles[:3]])
        self.assertEqual(taken[1], [("movie", tmdb_id) for tmdb_id in titles[3:6]])
        self.assertEqual(taken[2], [("movie", titles[6])])

    def test_a_movie_and_a_show_due_in_the_same_second_are_taken_together(self):
        self.due(0)
        tmdb_id = self.movie(due_at(5))
        other = self.movie(due_at(6))
        TmdbTvDetails(tmdb_id=tmdb_id, popularity=1, selected_at=START - timedelta(days=20)).save()

        self.assertEqual(self.due(15, room=1), [("movie", tmdb_id), ("show", tmdb_id)])
        self.assertEqual(self.due(30, room=1), [("movie", other)])

    def test_a_batch_without_room_takes_nothing_and_loses_nothing(self):
        self.due(0)
        tmdb_id = self.movie(due_at(5))

        self.assertEqual(self.due(15, room=0), [])
        self.assertEqual(self.due(30), [("movie", tmdb_id)])

    def test_a_title_deleted_on_tmdb_is_left_out(self):
        self.due(0)
        self.movie(due_at(5), tmdb_deleted=True)

        self.assertEqual(self.due(15), [])

    def test_a_title_fetched_within_the_last_day_is_not_fetched_again(self):
        # An awaited title is fetched every day, and a new title may be fetched hours before its second.
        self.due(0)
        self.movie(due_at(5), fetched_days_ago=0.5)
        TmdbMovieDetails(tmdb_id=due_at(6), popularity=1).save()  # never fetched: the queue's first group

        self.assertEqual(self.due(15), [])

    def test_a_queue_that_stood_still_for_longer_than_a_cycle_goes_back_one_cycle_and_no_further(self):
        # Every title was due once in the last 30 days; what was missed before that is the same titles again.
        self.due(0)
        missed_twice = self.movie(due_at(250))
        self.movie(due_at(150))
        still = 2 * CYCLE_SECONDS + 200

        self.assertEqual(self.due(still), [("movie", missed_twice)])

    def test_ids_above_the_seconds_of_a_cycle_are_due_too(self):
        self.due(0)
        tmdb_id = self.movie(due_at(5) + CYCLE_SECONDS)

        self.assertEqual(self.due(15), [("movie", tmdb_id)])


if __name__ == "__main__":
    unittest.main()
