"""The details copy pages its window by id and isolates its steps per media type (#185)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_details
from f.sync.copy.deleted_titles import NOT_DELETED_FILTER


class RecordingCursor:
    """A mongomock cursor that records the calls that shape the server's query plan."""

    def __init__(self, cursor, record):
        self.cursor = cursor
        self.record = record

    def __getattr__(self, name):
        method = getattr(self.cursor, name)

        def call(*args, **kwargs):
            self.record.setdefault(name, []).append(args)
            result = method(*args, **kwargs)
            return self if result is self.cursor else result
        return call

    def __iter__(self):
        return iter(self.cursor)


class RecordingCollection:
    def __init__(self, collection):
        self.collection = collection
        self.finds = []

    def find(self, *args, **kwargs):
        record = {"filter": args[0] if args else {}, "projection": args[1] if len(args) > 1 else None}
        self.finds.append(record)
        return RecordingCursor(self.collection.find(*args, **kwargs), record)

    def __getattr__(self, name):
        return getattr(self.collection, name)


class Crate:
    """Records the published title rows; every other statement is a no-op."""

    def __init__(self, on_upsert=None):
        self.titles = []
        self.on_upsert = on_upsert
        self.cur = MagicMock(rowcount=0)

    def upsert_many(self, *, table, records, **kwargs):
        if table in ("movie", "show"):
            self.titles.extend(record.tmdb_id for record in records)
            if self.on_upsert:
                self.on_upsert(table, records)
        return {"records_received": len(records), "rows_upserted": len(records)}

    def select(self, sql, params=None):
        return []

    def run(self, sql, params=None):
        pass


def movie_db(movies):
    db = mongomock.MongoClient().db
    db.tmdb_movie_details.insert_many([dict(movie) for movie in movies])
    return db


class WindowPagingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        recent = self.now - timedelta(hours=1)
        old = self.now - timedelta(hours=tmdb_details.HOURS_TO_FETCH + 1)
        self.db = movie_db(
            [{"tmdb_id": tmdb_id, "title": f"Movie {tmdb_id}", "updated_at": recent} for tmdb_id in (5, 1, 3, 7, 9)]
            + [{"tmdb_id": tmdb_id, "title": f"Old {tmdb_id}", "updated_at": old} for tmdb_id in (2, 4)]
            + [{"tmdb_id": 6, "title": "Gone", "updated_at": recent, "tmdb_deleted": True}]
        )
        self.details = RecordingCollection(self.db.tmdb_movie_details)
        self.db_proxy = SimpleNamespace(tmdb_movie_details=self.details,
                                        tmdb_daily_dump_data=self.db.tmdb_daily_dump_data)

    def copy(self, crate, **kwargs):
        with patch.object(tmdb_details, "get_db", return_value=self.db_proxy), \
                patch.object(tmdb_details, "BATCH_SIZE", 2):
            return tmdb_details.copy_media(crate, {}, "movie", **kwargs)

    def test_copies_every_live_title_of_the_window_once(self):
        crate = Crate()
        result = self.copy(crate)
        self.assertEqual(sorted(crate.titles), [1, 3, 5, 7, 9])
        self.assertEqual(result["movies"]["rows_upserted"], 5)

    def test_reads_the_window_as_ids_through_the_updated_at_index(self):
        self.copy(Crate())
        window = [find for find in self.details.finds if "updated_at" in find["filter"]]
        self.assertEqual(len(window), 1)
        self.assertEqual(window[0]["projection"], {"tmdb_id": 1, "_id": 0})
        self.assertEqual(set(window[0]["filter"]), {"updated_at"})
        self.assertEqual(window[0]["hint"], [([("updated_at", 1), ("tmdb_id", 1)],)])

    def test_fetches_documents_by_id_in_bounded_batches_without_skip(self):
        self.copy(Crate())
        fetches = [find for find in self.details.finds if "tmdb_id" in find["filter"]]
        # The covered id query can't see the flag, so the flagged 6 is only left out by the fetch.
        self.assertEqual([find["filter"]["tmdb_id"]["$in"] for find in fetches], [[1, 3], [5, 6], [7, 9]])
        for find in fetches:
            self.assertEqual(find["filter"]["tmdb_deleted"], NOT_DELETED_FILTER["tmdb_deleted"])
            self.assertEqual(find["hint"], [([("tmdb_id", 1)],)])
        for find in self.details.finds:
            self.assertNotIn("skip", find)

    def test_a_title_flagged_during_the_run_does_not_push_another_out(self):
        # Offset paging over a shrinking result skips the title after a flagged one.
        def flag_first_copied(table, records):
            if records and records[0].tmdb_id == 1:
                self.db.tmdb_movie_details.update_one({"tmdb_id": 1}, {"$set": {"tmdb_deleted": True}})

        crate = Crate(on_upsert=flag_first_copied)
        self.copy(crate)
        self.assertEqual(sorted(crate.titles), [1, 3, 5, 7, 9])

    def test_a_title_flagged_before_its_batch_is_not_copied(self):
        def flag_later_title(table, records):
            self.db.tmdb_movie_details.update_one({"tmdb_id": 9}, {"$set": {"tmdb_deleted": True}})

        crate = Crate(on_upsert=flag_later_title)
        self.copy(crate)
        self.assertEqual(sorted(crate.titles), [1, 3, 5, 7])

    def test_a_selector_run_skips_the_index_hint(self):
        with patch.object(tmdb_details, "get_db", return_value=self.db_proxy):
            tmdb_details.copy_media(Crate(), {"tmdb_id": {"$in": [3, 4]}}, "movie", recent_only=False)
        window = next(find for find in self.details.finds
                      if find["projection"] == {"tmdb_id": 1, "_id": 0} and "tmdb_deleted" not in find["filter"])
        self.assertEqual(window["filter"], {"tmdb_id": {"$in": [3, 4]}})
        self.assertNotIn("hint", window)


class MainIsolationTests(unittest.TestCase):
    def run_main(self, fail=()):
        calls = []

        def delete(connector, media_type, *args, **kwargs):
            calls.append(("delete", media_type))
            if ("delete", media_type) in fail:
                raise RuntimeError(f"{media_type} delete failed")
            return {"titles_flagged": 0}

        def copy(*, connector, query_selector, media_type, delete_flagged):
            calls.append(("copy", media_type))
            self.assertFalse(delete_flagged)
            if ("copy", media_type) in fail:
                raise RuntimeError(f"{media_type} copy failed")
            return {"movies" if media_type == "movie" else "shows": {"rows_upserted": 1}}

        with patch.object(tmdb_details, "init_mongodb"), patch.object(tmdb_details, "close_mongodb"), \
                patch.object(tmdb_details, "CrateConnector"), patch.object(tmdb_details, "get_db"), \
                patch.object(tmdb_details, "delete_flagged_titles_from_crate", side_effect=delete), \
                patch.object(tmdb_details, "copy_media", side_effect=copy):
            try:
                return calls, tmdb_details.main(), None
            except Exception as error:
                return calls, None, error

    def test_deletes_both_media_types_before_copying(self):
        calls, results, error = self.run_main()
        self.assertIsNone(error)
        self.assertEqual(calls, [("delete", "movie"), ("delete", "show"), ("copy", "movie"), ("copy", "show")])
        self.assertEqual(results["movies"]["deleted_titles"], {"titles_flagged": 0})
        self.assertEqual(results["shows"]["deleted_titles"], {"titles_flagged": 0})

    def test_a_failed_movie_copy_still_copies_shows_and_fails_the_run(self):
        calls, _, error = self.run_main(fail={("copy", "movie")})
        self.assertIn(("copy", "show"), calls)
        self.assertIsInstance(error, tmdb_details.CopyFailed)
        self.assertIn("movie copy", str(error))
        self.assertEqual(error.results["shows"]["shows"], {"rows_upserted": 1})

    def test_a_failed_movie_deletion_still_deletes_and_copies_shows(self):
        calls, _, error = self.run_main(fail={("delete", "movie")})
        self.assertEqual(calls, [("delete", "movie"), ("delete", "show"), ("copy", "movie"), ("copy", "show")])
        self.assertIsInstance(error, tmdb_details.CopyFailed)
        self.assertIn("movie deletion", str(error))

    def test_skip_movies_leaves_movies_alone(self):
        calls = []
        with patch.object(tmdb_details, "init_mongodb"), patch.object(tmdb_details, "close_mongodb"), \
                patch.object(tmdb_details, "CrateConnector"), patch.object(tmdb_details, "get_db"), \
                patch.object(tmdb_details, "delete_flagged_titles_from_crate",
                             side_effect=lambda connector, media_type, *a, **k: calls.append(("delete", media_type)) or {}), \
                patch.object(tmdb_details, "copy_media",
                             side_effect=lambda **kwargs: calls.append(("copy", kwargs["media_type"])) or {}):
            results = tmdb_details.main(skip_movies=True)
        self.assertEqual(calls, [("delete", "show"), ("copy", "show")])
        self.assertIsNone(results["movies"])


if __name__ == "__main__":
    unittest.main()
