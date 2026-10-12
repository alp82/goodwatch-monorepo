"""The list of titles members wait for, and when each is due for an offer recheck."""
import sqlite3
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.awaited_titles import reserve_due, store_list
from f.tmdb_api.tmdb_fetch_details_from_api import awaited

NOW = datetime(2026, 10, 12, 6, 0)
MATRIX = ("movie", 603)
SEVERANCE = ("show", 95396)


class AwaitedTitlesTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db

    def test_a_listed_title_is_due_at_once_and_then_once_a_day(self):
        store_list(self.db, [MATRIX], NOW)

        self.assertEqual(reserve_due(self.db, 10, NOW), [MATRIX])
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(hours=23)), [])
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(hours=24)), [MATRIX])

    def test_listing_a_title_again_does_not_make_it_due_again(self):
        store_list(self.db, [MATRIX], NOW)
        reserve_due(self.db, 10, NOW)

        store_list(self.db, [MATRIX], NOW + timedelta(hours=1))

        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(hours=2)), [])

    def test_a_title_nobody_waits_for_any_more_leaves_the_list_after_three_days(self):
        store_list(self.db, [MATRIX, SEVERANCE], NOW)
        reserve_due(self.db, 10, NOW)

        store_list(self.db, [SEVERANCE], NOW + timedelta(days=1))
        store_list(self.db, [SEVERANCE], NOW + timedelta(days=2))
        still_listed = reserve_due(self.db, 10, NOW + timedelta(days=2))
        result = store_list(self.db, [SEVERANCE], NOW + timedelta(days=3, minutes=1))

        self.assertEqual(sorted(still_listed), [MATRIX, SEVERANCE])
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=4)), [SEVERANCE])
        self.assertEqual(result, {"listed": 1, "added": 0, "removed": 1})

    def test_an_empty_list_removes_nothing(self):
        # No member waiting for anything is far less likely than a read that went wrong.
        store_list(self.db, [MATRIX], NOW)

        result = store_list(self.db, [], NOW + timedelta(days=2))

        self.assertEqual(result, {"listed": 0, "added": 0, "removed": 0})
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=2)), [MATRIX])

    def test_a_batch_takes_the_titles_due_longest(self):
        store_list(self.db, [MATRIX], NOW)
        store_list(self.db, [MATRIX, SEVERANCE], NOW + timedelta(hours=1))

        self.assertEqual(reserve_due(self.db, 1, NOW + timedelta(hours=2)), [MATRIX])
        self.assertEqual(reserve_due(self.db, 1, NOW + timedelta(hours=2)), [SEVERANCE])

    def test_a_late_recheck_does_not_move_the_title_to_a_later_time_of_day(self):
        # Rechecks start an hour before a publication run; a drift would carry them past it.
        store_list(self.db, [MATRIX], NOW)
        reserve_due(self.db, 10, NOW + timedelta(minutes=20))

        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(hours=23, minutes=59)), [])
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(hours=24)), [MATRIX])

    def test_a_recheck_more_than_a_day_late_is_not_repeated_at_once(self):
        store_list(self.db, [MATRIX], NOW)
        store_list(self.db, [MATRIX], NOW + timedelta(days=2))
        late = NOW + timedelta(days=2, hours=3)
        reserve_due(self.db, 10, late)

        self.assertEqual(reserve_due(self.db, 10, late + timedelta(hours=23)), [])
        self.assertEqual(reserve_due(self.db, 10, late + timedelta(hours=24)), [MATRIX])

    def test_a_list_not_stored_for_three_days_is_no_longer_rechecked(self):
        # Disabling the daily job turns the short cycle off; a broken job stops costing requests.
        store_list(self.db, [MATRIX], NOW)

        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=3)), [MATRIX])
        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=4, minutes=1)), [])


class MemberTables:
    """The three member tables the list is read from, in SQLite, behind the Crate connector's select."""

    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(
            "CREATE TABLE user_setting (user_id TEXT, key TEXT, value TEXT);"
            "CREATE TABLE user_wishlist (user_id TEXT, tmdb_id INTEGER, media_type TEXT);"
            "CREATE TABLE user_watch_state (user_id TEXT, tmdb_id INTEGER, media_type TEXT, state TEXT);"
        )

    def member(self, user_id, country="DE", services="8,337"):
        for key, value in (("country_default", country), ("streaming_providers_default", services)):
            if value is not None:
                self.db.execute("INSERT INTO user_setting VALUES (?, ?, ?)", (user_id, key, value))
        return self

    def wants(self, user_id, media_type, tmdb_id):
        self.db.execute("INSERT INTO user_wishlist VALUES (?, ?, ?)", (user_id, tmdb_id, media_type))
        return self

    def show_state(self, user_id, tmdb_id, state):
        self.db.execute("INSERT INTO user_watch_state VALUES (?, ?, 'show', ?)", (user_id, tmdb_id, state))
        return self

    def select(self, sql, params=None):
        return [dict(row) for row in self.db.execute(sql, params or ())]


class ReadAwaitedTitlesTests(unittest.TestCase):
    def test_a_want_to_see_title_of_a_member_with_a_country_and_a_saved_service_is_awaited(self):
        crate = MemberTables().member("ann").wants("ann", "movie", 603).wants("ann", "show", 95396)

        self.assertEqual(sorted(awaited.read_awaited_titles(crate)), [MATRIX, SEVERANCE])

    def test_a_member_without_a_country_or_without_a_saved_service_adds_nothing(self):
        crate = MemberTables()
        crate.member("no country", country=None).wants("no country", "movie", 1)
        crate.member("no services", services=None).wants("no services", "movie", 2)
        crate.member("services cleared", services="").wants("services cleared", "movie", 3)
        crate.member("country cleared", country="").wants("country cleared", "movie", 4)
        crate.wants("no settings", "movie", 5)
        crate.member("ann").wants("ann", "movie", 603)

        self.assertEqual(awaited.read_awaited_titles(crate), [MATRIX])

    def test_watching_and_on_hold_shows_are_awaited_and_other_show_statuses_are_not(self):
        crate = MemberTables().member("ann")
        for tmdb_id, state in ((1, "watching"), (2, "on_hold"), (3, "seen"), (4, "dropped"), (5, "not_started")):
            crate.show_state("ann", tmdb_id, state)

        self.assertEqual(sorted(awaited.read_awaited_titles(crate)), [("show", 1), ("show", 2)])

    def test_a_title_several_members_wait_for_is_listed_once(self):
        crate = MemberTables().member("ann").member("ben", country="US", services="9")
        crate.wants("ann", "show", 95396).wants("ben", "show", 95396).show_state("ben", 95396, "watching")

        self.assertEqual(awaited.read_awaited_titles(crate), [SEVERANCE])


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db

    def test_the_titles_read_from_the_member_tables_become_due(self):
        crate = MemberTables().member("ann").wants("ann", "movie", 603)

        result = awaited.refresh(crate, self.db, NOW)

        self.assertEqual(result, {"listed": 1, "added": 1, "removed": 0})
        self.assertEqual(reserve_due(self.db, 10, NOW), [MATRIX])

    def test_a_failed_read_leaves_the_stored_list_as_it_was(self):
        store_list(self.db, [MATRIX], NOW)

        class SlowCrate:
            def select(self, sql, params=None):
                raise TimeoutError("read timed out")

        with self.assertRaises(TimeoutError):
            awaited.refresh(SlowCrate(), self.db, NOW + timedelta(days=2))

        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=2)), [MATRIX])

    def test_a_list_above_the_request_budget_is_refused_and_the_stored_list_kept(self):
        store_list(self.db, [MATRIX], NOW)
        crate = MemberTables().member("ann")
        for tmdb_id in range(1, 5):
            crate.wants("ann", "movie", tmdb_id)

        with patch.object(awaited, "MAX_TITLES", 3), self.assertRaisesRegex(RuntimeError, "more than 3 titles"):
            awaited.refresh(crate, self.db, NOW + timedelta(days=2))

        self.assertEqual(reserve_due(self.db, 10, NOW + timedelta(days=2)), [MATRIX])


if __name__ == "__main__":
    unittest.main()
