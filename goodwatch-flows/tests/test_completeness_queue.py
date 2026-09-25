"""How the completeness queue splits a batch between never-fetched and stale titles."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import mongomock
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.data_source.common import mix_batch, retrieve_next_entry_ids_full
from f.dna.generate import next as dna_next
from f.dna.models import DnaMovie, DnaTv


def titles(prefix, n):
    return [SimpleNamespace(id=f"{prefix}{i}") for i in range(n)]


def ids(entries):
    return [entry.id for entry in entries]


class MixBatchTests(unittest.TestCase):
    def test_both_groups_full_split_the_batch_in_half(self):
        batch = mix_batch(titles("new", 50), titles("stale", 50), 50)

        self.assertEqual(ids(batch), ids(titles("new", 25)) + ids(titles("stale", 25)))

    def test_odd_batch_gives_the_extra_slot_to_never_fetched_titles(self):
        batch = mix_batch(titles("new", 3), titles("stale", 3), 3)

        self.assertEqual(ids(batch), ["new0", "new1", "stale0"])

    def test_few_never_fetched_titles_leave_their_slots_to_stale_titles(self):
        batch = mix_batch(titles("new", 4), titles("stale", 50), 50)

        self.assertEqual(ids(batch), ids(titles("new", 4)) + ids(titles("stale", 46)))

    def test_few_stale_titles_leave_their_slots_to_never_fetched_titles(self):
        batch = mix_batch(titles("new", 50), titles("stale", 4), 50)

        self.assertEqual(ids(batch), ids(titles("new", 46)) + ids(titles("stale", 4)))

    def test_empty_groups(self):
        self.assertEqual(mix_batch([], [], 50), [])
        self.assertEqual(ids(mix_batch([], titles("stale", 3), 50)), ["stale0", "stale1", "stale2"])
        self.assertEqual(ids(mix_batch(titles("new", 3), [], 50)), ["new0", "new1", "new2"])

    def test_a_stuck_title_that_is_also_stale_is_queued_once(self):
        stuck = SimpleNamespace(id="stuck")
        batch = mix_batch([stuck] + titles("new", 3), [stuck] + titles("stale", 3), 8)

        self.assertEqual(ids(batch), ["stuck", "new0", "new1", "new2", "stale0", "stale1", "stale2"])

    def test_same_id_in_different_collections_is_not_a_duplicate(self):
        class Movie(SimpleNamespace):
            pass

        class Tv(SimpleNamespace):
            pass

        batch = mix_batch([Movie(id=1)], [Tv(id=1)], 2)

        self.assertEqual([type(entry) for entry in batch], [Movie, Tv])


class StaleAfterDaysTests(unittest.TestCase):
    """Each source passes its own refresh interval; DNA waits 180 days."""

    def setUp(self):
        disconnect()
        connect("queue_test", mongo_client_class=mongomock.MongoClient,
                uuidRepresentation="standard")
        self.addCleanup(disconnect)

    def seed(self):
        now = datetime.utcnow()
        DnaMovie(tmdb_id=1, popularity=9, selected_at=now - timedelta(days=60)).save()
        DnaMovie(tmdb_id=2, popularity=5, selected_at=now - timedelta(days=200)).save()
        DnaMovie(tmdb_id=3, popularity=1, selected_at=now - timedelta(days=1)).save()

    def selected_tmdb_ids(self, **kwargs):
        result = retrieve_next_entry_ids_full(
            count=10, buffer_minutes=60, movie_model=DnaMovie, tv_model=DnaTv, **kwargs
        )
        return sorted(int(tmdb_id) for tmdb_id in result["tmdb_ids"]["movie_ids"])

    def test_default_refreshes_titles_selected_more_than_30_days_ago(self):
        self.seed()

        self.assertEqual(self.selected_tmdb_ids(), [1, 2])

    def test_stale_after_days_is_a_parameter(self):
        self.seed()

        self.assertEqual(self.selected_tmdb_ids(stale_after_days=180), [2])

    def test_dna_selection_passes_its_180_day_refresh_interval(self):
        with patch.object(dna_next, "SpendPause") as pause, \
                patch.object(dna_next, "init_mongodb"), patch.object(dna_next, "close_mongodb"), \
                patch.object(dna_next, "retrieve_next_entry_ids_full") as retrieve:
            pause.return_value.is_active.return_value = False
            dna_next.main()

        self.assertEqual(retrieve.call_args.kwargs["stale_after_days"], 180)


if __name__ == "__main__":
    unittest.main()
