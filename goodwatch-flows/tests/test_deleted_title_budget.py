"""Deletion of gone titles drains over runs (per-run budget, oldest flag first) and stops on a flag spike (#184)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
sys.path.insert(0, str(Path(__file__).parent))

from f.sync.copy import deleted_titles
from f.sync.copy.deleted_titles import (
    delete_titles_from_crate,
    delete_titles_from_qdrant,
    flag_spike,
    flagged_oldest_first,
    sweep_orphaned_titles,
)
from test_orphaned_title_rows import FakeCrate, mongo

CALM = {"tripped": False}
SPIKE = {"tripped": True}
NOW = datetime(2026, 9, 26, 21, 0)


def budget(value):
    return patch.object(deleted_titles, "MAX_DELETED_TITLES_PER_RUN", value)


def titles_left(crate, media_type):
    return sorted({row["tmdb_id"] for row in crate.tables[media_type]})


class CrateBudgetTests(unittest.TestCase):
    def test_a_run_deletes_at_most_the_budget_in_the_given_order(self):
        crate = FakeCrate()
        for tmdb_id in range(1, 6):
            crate.add_title("movie", tmdb_id)
        with budget(2):
            result = delete_titles_from_crate(crate, "movie", [5, 3, 1, 4, 2], spike=CALM)
            self.assertEqual(titles_left(crate, "movie"), [1, 2, 4])
            self.assertTrue(result["budget_reached"])
            self.assertEqual(result["titles_planned"], 2)
            self.assertEqual(result["titles_deleted"], 2)
            # The next run continues where this one stopped.
            delete_titles_from_crate(crate, "movie", [5, 3, 1, 4, 2], spike=CALM)
            self.assertEqual(titles_left(crate, "movie"), [2])
        self.assertEqual(crate.has_rows("movie", 5), ["user_score"])

    def test_titles_without_rows_do_not_use_up_the_budget(self):
        crate = FakeCrate()
        crate.add_title("show", 7, title_row=False)
        crate.add_title("show", 8)
        with budget(2):
            result = delete_titles_from_crate(crate, "show", [1, 2, 7, 3, 8], spike=CALM)
        self.assertEqual(crate.has_rows("show", 7), ["user_score"])
        self.assertEqual(crate.has_rows("show", 8), ["user_score"])
        # Both titles with rows fit the budget, so nothing is left for a later run.
        self.assertFalse(result["budget_reached"])
        self.assertEqual(result["titles_planned"], 2)
        self.assertEqual(result["titles_flagged"], 5)

    def test_a_backlog_under_the_budget_is_deleted_in_one_run(self):
        crate = FakeCrate()
        for tmdb_id in range(1, 4):
            crate.add_title("movie", tmdb_id)
        with budget(3):
            result = delete_titles_from_crate(crate, "movie", [3, 2, 1], spike=CALM)
        self.assertEqual(titles_left(crate, "movie"), [])
        self.assertFalse(result["budget_reached"])

    def test_a_flag_spike_refuses_every_delete(self):
        crate = FakeCrate()
        crate.add_title("movie", 1)
        result = delete_titles_from_crate(crate, "movie", [1], spike=SPIKE | {"listed_new_flags": 900})
        self.assertEqual(titles_left(crate, "movie"), [1])
        self.assertTrue(result["refused_spike"])
        self.assertEqual(result["spike"]["listed_new_flags"], 900)
        self.assertFalse([sql for sql, _ in crate.statements if sql.startswith("DELETE")])


class QdrantBudgetTests(unittest.TestCase):
    def client(self, existing):
        client = MagicMock()
        client.retrieve.side_effect = lambda ids, **kwargs: [SimpleNamespace(id=i) for i in ids if i in existing]
        return client

    def test_deletes_at_most_the_budget_of_existing_points_in_the_given_order(self):
        client = self.client({1, 2, 3, 4})
        with budget(2):
            result = delete_titles_from_qdrant(client, "media", "movie", [9, 4, 2, 3, 1], lambda m, t: t, spike=CALM)
        client.delete.assert_called_once_with(collection_name="media", points_selector=[4, 2], wait=True)
        self.assertTrue(result["budget_reached"])
        self.assertEqual(result["points_requested"], 2)

    def test_a_flag_spike_refuses_every_delete(self):
        client = self.client({1})
        result = delete_titles_from_qdrant(client, "media", "show", [1], lambda m, t: t, spike=SPIKE)
        client.delete.assert_not_called()
        client.retrieve.assert_not_called()
        self.assertTrue(result["refused_spike"])


class OrphanSweepBudgetTests(unittest.TestCase):
    def test_sweep_deletes_at_most_the_budget_lowest_ids_first(self):
        crate = FakeCrate()
        for tmdb_id in (4, 2, 3):
            crate.add_title("movie", tmdb_id)
        details, daily = mongo()
        with budget(2):
            result = sweep_orphaned_titles(crate, "movie", details, daily)
        self.assertEqual(titles_left(crate, "movie"), [4])
        self.assertTrue(result["budget_reached"])

    def test_sweep_refuses_an_unusually_large_orphan_set(self):
        crate = FakeCrate()
        for tmdb_id in range(1, 5):
            crate.add_title("movie", tmdb_id)
        details, daily = mongo()
        with patch.object(deleted_titles, "MAX_ORPHANED_TITLES", 3):
            result = sweep_orphaned_titles(crate, "movie", details, daily)
        self.assertTrue(result["refused_spike"])
        self.assertEqual(titles_left(crate, "movie"), [1, 2, 3, 4])


def flag_db():
    db = mongomock.MongoClient().db
    return db, db.tmdb_movie_details, db.tmdb_daily_dump_data


def flag(details, tmdb_id, flagged_at, **fields):
    details.insert_one({"tmdb_id": tmdb_id, "tmdb_deleted": True, "tmdb_deleted_at": flagged_at, **fields})


def listed(dump, tmdb_id, at, media_type="movie"):
    # The TMDB daily dump stores ids as strings.
    dump.insert_one({"tmdb_id": str(tmdb_id), "type": media_type, "updated_at": at})


class FlagSpikeTests(unittest.TestCase):
    def test_counts_new_flags_that_a_recent_export_still_listed(self):
        _, details, dump = flag_db()
        flag(details, 1, NOW - timedelta(hours=2))
        listed(dump, 1, NOW - timedelta(hours=14))  # listed shortly before the flag: suspicious
        flag(details, 2, NOW - timedelta(hours=3))
        listed(dump, 2, NOW - timedelta(days=90))  # dropped from the export long ago: a real deletion
        flag(details, 3, NOW - timedelta(hours=1))  # never exported
        flag(details, 4, NOW - timedelta(hours=30))
        listed(dump, 4, NOW - timedelta(hours=40))  # outside the 24 h window
        details.insert_one({"tmdb_id": 5, "tmdb_deleted_at": NOW - timedelta(hours=1)})  # restored
        listed(dump, 5, NOW - timedelta(hours=2))
        flag(details, 6, NOW - timedelta(hours=1))
        listed(dump, 6, NOW - timedelta(hours=2), media_type="tv")  # a show with the same id
        spike = flag_spike(details, dump, "movie", now=NOW)
        self.assertEqual(spike["new_flags"], 4)
        self.assertEqual(spike["listed_new_flags"], 1)
        self.assertFalse(spike["tripped"])

    def test_trips_above_the_threshold(self):
        _, details, dump = flag_db()
        for tmdb_id in range(1, 5):
            flag(details, tmdb_id, NOW - timedelta(hours=1))
            listed(dump, tmdb_id, NOW - timedelta(hours=10))
        with patch.object(deleted_titles, "MAX_LISTED_NEW_FLAGS", 4):
            self.assertFalse(flag_spike(details, dump, "movie", now=NOW)["tripped"])
        with patch.object(deleted_titles, "MAX_LISTED_NEW_FLAGS", 3):
            spike = flag_spike(details, dump, "movie", now=NOW)
        self.assertTrue(spike["tripped"])
        self.assertEqual(spike["listed_new_flags"], 4)

    def test_shows_are_looked_up_as_tv_in_the_export(self):
        db = mongomock.MongoClient().db
        flag(db.tmdb_tv_details, 7, NOW - timedelta(hours=1))
        listed(db.tmdb_daily_dump_data, 7, NOW - timedelta(hours=5), media_type="tv")
        spike = flag_spike(db.tmdb_tv_details, db.tmdb_daily_dump_data, "show", now=NOW)
        self.assertEqual(spike["listed_new_flags"], 1)


class OldestFlagFirstTests(unittest.TestCase):
    def test_orders_by_flag_time_then_id_and_keeps_the_selector(self):
        _, details, _ = flag_db()
        flag(details, 9, NOW - timedelta(hours=1))
        flag(details, 3, NOW - timedelta(days=2))
        flag(details, 8, NOW - timedelta(days=2))
        flag(details, 4, None)  # flagged before tmdb_deleted_at existed: oldest
        flag(details, 10, NOW, other=True)
        details.insert_one({"tmdb_id": 1, "tmdb_deleted": False})
        self.assertEqual(flagged_oldest_first(details), [4, 3, 8, 9, 10])
        self.assertEqual(flagged_oldest_first(details, {"tmdb_id": {"$in": [9, 10, 3]}}), [3, 9, 10])


if __name__ == "__main__":
    unittest.main()
