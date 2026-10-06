"""A scheduled copy reads the changes since its last successful run, tracked in Mongo (#194)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import sync_state

NOW = datetime(2026, 10, 6, 12, 0, 0)
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)


def state(db, job, media_type):
    return db.sync_state.find_one({"_id": f"{job}:{media_type}"})


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db

    def test_a_missing_document_falls_back_to_the_48_hour_window(self):
        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(selection.since, NOW - timedelta(hours=48))
        self.assertTrue(selection.fallback)
        self.assertFalse(selection.lookback_capped)
        self.assertIsNone(selection.warning)
        # Reading the selection writes nothing.
        self.assertIsNone(state(self.db, "vector_data", "movie"))

    def test_a_run_reads_from_the_overlap_before_the_last_successful_start(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR), {})

        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(selection.since, NOW - 4 * HOUR - timedelta(minutes=30))
        self.assertEqual(selection.last_success_started_at, NOW - 4 * HOUR)
        self.assertFalse(selection.fallback)
        self.assertFalse(selection.lookback_capped)

    def test_a_commit_records_the_run_start_not_its_end(self):
        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)
        sync_state.commit(self.db, selection, {"upserts": 3}, now=NOW + 3 * HOUR)

        self.assertEqual(state(self.db, "vector_data", "movie"), {
            "_id": "vector_data:movie",
            "last_success_started_at": NOW,
            "last_run": {
                "started_at": NOW, "finished_at": NOW + 3 * HOUR, "since": NOW - timedelta(hours=48),
                "fallback": True, "lookback_capped": False, "counts": {"upserts": 3},
            },
        })

    def test_a_run_without_a_commit_leaves_the_next_run_to_cover_the_gap(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 8 * HOUR), {})
        before = state(self.db, "vector_data", "movie")
        # The run 4 hours ago failed: it began, and never committed.
        sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR)

        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(state(self.db, "vector_data", "movie"), before)
        self.assertEqual(selection.since, NOW - 8 * HOUR - timedelta(minutes=30))

    def test_the_lookback_is_capped_at_7_days_with_a_warning(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 10 * DAY), {})

        with patch("builtins.print") as log:
            selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(selection.since, NOW - 7 * DAY)
        self.assertTrue(selection.lookback_capped)
        self.assertFalse(selection.fallback)
        self.assertIn("full copy", selection.warning)
        self.assertEqual(selection.report()["warning"], selection.warning)
        self.assertIn(selection.warning, log.call_args.args[0])

    def test_a_last_success_just_inside_the_cap_is_not_capped(self):
        last = NOW - 7 * DAY + timedelta(minutes=31)
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=last), {})

        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(selection.since, last - timedelta(minutes=30))
        self.assertFalse(selection.lookback_capped)
        self.assertNotIn("warning", selection.report())

    def test_the_time_never_moves_backward(self):
        earlier = sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR)
        later = sync_state.begin(self.db, "vector_data", "movie", now=NOW)
        sync_state.commit(self.db, later, {"upserts": 2})
        # The earlier run overlapped the later one and finished last.
        sync_state.commit(self.db, earlier, {"upserts": 1})

        document = state(self.db, "vector_data", "movie")
        self.assertEqual(document["last_success_started_at"], NOW)
        self.assertEqual(document["last_run"]["counts"], {"upserts": 2})

    def test_carried_ids_reach_the_next_run(self):
        first = sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR)
        self.assertEqual(first.carried_ids, ())
        sync_state.commit(self.db, first, {}, carried_ids=[7, 3])

        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        self.assertEqual(selection.carried_ids, (3, 7))
        self.assertEqual(selection.report()["carried_ids"], 2)

    def test_a_run_without_a_commit_keeps_the_carried_ids(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 8 * HOUR), {},
                          carried_ids=[3])
        sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR)

        self.assertEqual(sync_state.begin(self.db, "vector_data", "movie", now=NOW).carried_ids, (3,))

    def test_a_commit_replaces_the_carried_ids_and_one_without_them_keeps_them(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 8 * HOUR), {},
                          carried_ids=[3, 5])
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR), {})
        self.assertEqual(state(self.db, "vector_data", "movie")["carried_ids"], [3, 5])

        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW), {}, carried_ids=[])
        self.assertEqual(state(self.db, "vector_data", "movie")["carried_ids"], [])

    def test_an_overtaken_run_does_not_replace_the_carried_ids(self):
        earlier = sync_state.begin(self.db, "vector_data", "movie", now=NOW - 4 * HOUR)
        later = sync_state.begin(self.db, "vector_data", "movie", now=NOW)
        sync_state.commit(self.db, later, {}, carried_ids=[1, 2])
        sync_state.commit(self.db, earlier, {}, carried_ids=[1])

        self.assertEqual(state(self.db, "vector_data", "movie")["carried_ids"], [1, 2])

    def test_many_carried_ids_are_logged_as_a_warning(self):
        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW)

        with patch("builtins.print") as log:
            sync_state.commit(self.db, selection, {}, carried_ids=range(sync_state.CARRIED_IDS_WARNING + 1))

        self.assertIn("WARNING: vector_data:movie carries 5001 ids", log.call_args.args[0])

    def test_each_job_and_media_type_has_its_own_time(self):
        sync_state.commit(self.db, sync_state.begin(self.db, "vector_data", "movie", now=NOW - HOUR), {})

        self.assertTrue(sync_state.begin(self.db, "vector_data", "show", now=NOW).fallback)
        self.assertTrue(sync_state.begin(self.db, "tmdb_details", "movie", now=NOW).fallback)

    def test_the_start_time_is_stored_as_mongo_keeps_it(self):
        selection = sync_state.begin(self.db, "vector_data", "movie", now=NOW.replace(microsecond=123456))

        self.assertEqual(selection.started_at, NOW.replace(microsecond=123000))

    def test_the_report_is_plain_json(self):
        report = sync_state.begin(self.db, "vector_data", "movie", now=NOW).report()

        self.assertEqual(report, {
            "started_at": "2026-10-06T12:00:00", "since": "2026-10-04T12:00:00",
            "last_success_started_at": None, "fallback": True, "lookback_capped": False,
            "carried_ids": 0,
        })


if __name__ == "__main__":
    unittest.main()
