"""How the completeness queue splits a batch between never-fetched and stale titles."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.data_source.common import mix_batch


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


if __name__ == "__main__":
    unittest.main()
