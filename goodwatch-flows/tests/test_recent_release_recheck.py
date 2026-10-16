"""The daily recheck selects recent titles without reserving the regular queue."""
import sqlite3
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.recent_releases import select_recheck

NOW = datetime(2026, 10, 16, 13, tzinfo=timezone.utc)


def milliseconds(day):
    return int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp() * 1000)


class Catalog:
    """Execute the selector's portable SELECT against a small real SQL catalog."""
    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("CREATE TABLE movie (tmdb_id INTEGER, release_date INTEGER)")
        self.connection.execute("CREATE TABLE show (tmdb_id INTEGER, first_air_date INTEGER)")

    def select(self, sql, params):
        return [dict(row) for row in self.connection.execute(sql, params)]


class RecentReleaseSelectionTests(unittest.TestCase):
    def setUp(self):
        self.crate = Catalog()
        self.addCleanup(self.crate.connection.close)
        self.db = mongomock.MongoClient().goodwatch

    def title(self, kind, tmdb_id, day, **fields):
        self.crate.connection.execute(
            f"INSERT INTO {kind} VALUES (?, ?)",
            (tmdb_id, milliseconds(day) if day else None),
        )
        collection = "tmdb_movie_details" if kind == "movie" else "tmdb_tv_details"
        return self.db[collection].insert_one({"tmdb_id": tmdb_id, **fields}).inserted_id

    def test_thirty_utc_release_days_including_today_for_movies_and_shows(self):
        for kind in ("movie", "show"):
            for tmdb_id, day in enumerate(("2026-09-16", "2026-09-17", "2026-10-01", "2026-10-16", "2026-10-17", None), 1):
                self.title(kind, tmdb_id, day)

        plan = select_recheck(self.crate, self.db, NOW)

        self.assertEqual([(t["media_type"], t["tmdb_id"]) for t in plan["titles"]],
                         [("movie", 2), ("movie", 3), ("movie", 4),
                          ("show", 2), ("show", 3), ("show", 4)])

    def test_only_successful_checks_after_the_daily_tmdb_batch_are_skipped(self):
        for tmdb_id, checked_at, error in (
            (1, "2026-10-16T11:59:59", ""),
            (2, "2026-10-16T12:00:00", ""),
            (3, "2026-10-15T13:00:00", ""),
            (4, "2026-10-16T12:30:00", "provider_request_failed"),
        ):
            self.title("movie", tmdb_id, "2026-10-01",
                       watch_providers_check={"checked_at": milliseconds(checked_at)},
                       watch_providers_error=error)
        # A previous selection is not a successful provider check.
        self.title("movie", 5, "2026-10-01", selected_at=NOW, is_selected=False)

        plan = select_recheck(self.crate, self.db, NOW)

        self.assertEqual([t["tmdb_id"] for t in plan["titles"]], [1, 3, 4, 5])
        self.assertEqual(plan["already_checked"], 1)

    def test_titles_reserved_by_the_regular_queue_are_left_alone(self):
        for kind in ("movie", "show"):
            self.title(kind, 1, "2026-10-01", is_selected=True)
            self.title(kind, 2, "2026-10-01", is_selected=False)
            self.title(kind, 3, "2026-10-01")
        before = {name: list(self.db[name].find()) for name in self.db.list_collection_names()}

        plan = select_recheck(self.crate, self.db, NOW)

        self.assertEqual([(t["media_type"], t["tmdb_id"]) for t in plan["titles"]],
                         [("movie", 2), ("movie", 3), ("show", 2), ("show", 3)])
        self.assertEqual(before, {name: list(self.db[name].find()) for name in self.db.list_collection_names()})

    def test_deleted_missing_and_duplicate_titles_do_not_enter_fetch_batches(self):
        movie_id = self.title("movie", 7, "2026-10-01", selected_at=datetime(2026, 9, 25))
        show_id = self.title("show", 7, "2026-10-01")
        self.title("movie", 8, "2026-10-01", tmdb_deleted=True)
        missing_id = self.title("show", 9, "2026-10-01")
        self.db.tmdb_tv_details.delete_one({"_id": missing_id})
        self.db.tmdb_movie_details.insert_one({"tmdb_id": 7})
        self.crate.connection.execute("INSERT INTO movie VALUES (7, ?)", (milliseconds("2026-10-01"),))
        self.db.tmdb_details_refetch_cycle.insert_one({"_id": "details", "worked_until": datetime(2026, 10, 16)})
        before = {name: list(self.db[name].find()) for name in self.db.list_collection_names()}

        plan = select_recheck(self.crate, self.db, NOW)

        self.assertEqual(plan["batches"], [{"movie_ids": [str(movie_id)], "tv_ids": [str(show_id)]}])
        self.assertEqual(plan["unavailable"], 2)
        self.assertEqual(before, {name: list(self.db[name].find()) for name in self.db.list_collection_names()})

    def test_batches_have_at_most_fifty_titles_and_keep_both_media_types(self):
        for tmdb_id in range(1, 52):
            self.title("movie", tmdb_id, "2026-10-01")
        self.title("show", 1, "2026-10-01")

        plan = select_recheck(self.crate, self.db, NOW)

        self.assertEqual([len(b["movie_ids"]) + len(b["tv_ids"]) for b in plan["batches"]], [50, 2])
        self.assertEqual(len(plan["batches"][1]["tv_ids"]), 1)
        self.assertEqual((plan["movies"], plan["shows"], plan["selected"]), (51, 1, 52))

    def test_an_empty_catalog_produces_no_fetch_batches(self):
        self.assertEqual(select_recheck(self.crate, self.db, NOW)["batches"], [])

    def test_budget_overflow_is_visible_instead_of_silently_truncating_selection(self):
        for kind in ("movie", "show"):
            for tmdb_id in (1, 2):
                self.title(kind, tmdb_id, "2026-10-01")
        with patch("f.tmdb_api.recent_releases.MAX_TITLES", 3):
            with self.assertRaisesRegex(RuntimeError, "daily budget"):
                select_recheck(self.crate, self.db, NOW)

    def test_the_release_window_follows_utc_across_local_midnight(self):
        self.title("movie", 1, "2026-09-17")
        self.title("movie", 2, "2026-10-17")
        local_time = datetime.fromisoformat("2026-10-17T00:30:00+02:00")
        plan = select_recheck(self.crate, self.db, local_time)
        self.assertEqual([t["tmdb_id"] for t in plan["titles"]], [1])


class ExistingOfferWriterTests(unittest.TestCase):
    def test_a_recheck_preserves_first_seen_and_dates_only_the_new_offer(self):
        from f.db.cratedb import CrateConnector
        from f.sync.models.crate_models import StreamingAvailability

        connection = sqlite3.connect(":memory:")
        self.addCleanup(connection.close)
        key = ["media_tmdb_id", "media_type", "country_code", "streaming_type", "streaming_service_id"]
        fields = list(StreamingAvailability.model_fields) + ["created_at", "updated_at"]
        connection.execute("CREATE TABLE streaming_availability (" + ", ".join(fields)
                           + ", PRIMARY KEY (" + ", ".join(key) + "))")
        connection.execute(
            "INSERT INTO streaming_availability (media_tmdb_id, media_type, country_code, "
            "streaming_type, streaming_service_id, created_at) VALUES (258165, 'show', 'US', 'flatrate', 8, ?)",
            ("2026-10-01 18:00:00",),
        )

        class Cursor:
            """SQLite executes the real upsert SQL; adapt its bulk result to Crate's."""
            def __init__(self):
                self.cursor = connection.cursor()

            def executemany(self, sql, rows):
                return [{"rowcount": self.cursor.execute(sql, row).rowcount} for row in rows]

            def execute(self, sql, params):
                self.cursor.execute(sql, params)

            def fetchall(self):
                return self.cursor.fetchall()

            @property
            def description(self):
                return self.cursor.description

        writer = CrateConnector.__new__(CrateConnector)
        writer.cur = Cursor()
        before = datetime.utcnow().isoformat(sep=" ")
        writer.upsert_many("streaming_availability", [
            StreamingAvailability(media_tmdb_id=258165, media_type="show", country_code="US",
                                  streaming_type="flatrate", streaming_service_id=provider, display_priority=2)
            for provider in (8, 9)
        ], key, replace_nulls=True, silent=True)
        rows = writer.select("SELECT streaming_service_id, created_at, display_priority "
                             "FROM streaming_availability ORDER BY streaming_service_id")

        self.assertEqual(rows[0], {"streaming_service_id": 8, "created_at": "2026-10-01 18:00:00", "display_priority": 2})
        self.assertGreaterEqual(rows[1]["created_at"], before)
        self.assertLessEqual(rows[1]["created_at"], datetime.utcnow().isoformat(sep=" "))


if __name__ == "__main__":
    unittest.main()
