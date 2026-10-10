"""The episode fetch job: which shows are due, what a fetch stores, and what TMDB's change feed makes due."""
import sys
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import mongomock
import requests

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

with patch("wmill.get_variable", return_value="unused"):
    from f.tmdb_api.tmdb_fetch_episodes_from_api import changes, fetch
    from f.tmdb_api.tmdb_fetch_episodes_from_api import next as next_shows

NOW = datetime(2026, 10, 6, 9, 30)


def http_error(status, tmdb_status_code=None):
    response = MagicMock(status_code=status)
    response.json.return_value = {"status_code": tmdb_status_code, "status_message": "message"}
    return requests.HTTPError(f"{status} for url", response=response)


class Tmdb:
    """A fake TMDB: shows by id, each a map of season number to (season id, episodes)."""

    def __init__(self, shows, errors=None):
        self.shows = shows
        self.errors = errors or {}
        self.requests = []

    def get(self, tmdb_id, season_numbers):
        self.requests.append((tmdb_id, list(season_numbers)))
        if tmdb_id in self.errors:
            raise self.errors[tmdb_id]
        seasons = self.shows[tmdb_id]
        payload = {"id": tmdb_id, "seasons": [
            {"id": season_id, "season_number": number} for number, (season_id, _) in seasons.items()]}
        for number in season_numbers:
            if number in seasons:
                payload[f"season/{number}"] = {"name": f"Season {number}", "air_date": "2008-01-20",
                                                "season_number": number, "episodes": seasons[number][1]}
        return payload


def tmdb_episode(episode_id, number, air_date="2008-01-20"):
    return {"id": episode_id, "episode_number": number, "name": f"Episode {number}", "air_date": air_date,
            "crew": [{"id": 1}], "guest_stars": []}


def details(tmdb_id, season_numbers=(1,), **fields):
    return {"tmdb_id": tmdb_id, "title": f"Show {tmdb_id}",
            "seasons": [{"id": 100 + number, "season_number": number} for number in season_numbers]} | fields


def database(*shows):
    db = mongomock.MongoClient().db
    if shows:
        db.tmdb_tv_details.insert_many([dict(show) for show in shows])
    return db


def state(db, tmdb_id):
    return db.tmdb_tv_details.find_one({"tmdb_id": tmdb_id})


def run_fetch(db, tmdb, tmdb_ids):
    try:
        return fetch.fetch_episodes(db, tmdb_ids, get=tmdb.get, now=lambda: NOW)
    except RuntimeError as error:
        return error


class DueShowTests(unittest.TestCase):
    def reserve(self, db, count=10):
        return next_shows.reserve_due_shows(db.tmdb_tv_details, count, NOW)

    def test_a_show_never_fetched_is_due(self):
        db = database(details(1))

        self.assertEqual(self.reserve(db), [1])

    def test_a_show_is_due_once_its_due_time_has_come(self):
        db = database(details(1, episodes_due_at=NOW - timedelta(minutes=1)),
                      details(2, episodes_due_at=NOW + timedelta(minutes=1)))

        self.assertEqual(self.reserve(db), [1])

    def test_shows_never_fetched_come_first_then_the_longest_due(self):
        db = database(details(1, episodes_due_at=NOW - timedelta(days=1)),
                      details(2, episodes_due_at=NOW - timedelta(days=3)),
                      details(3))

        self.assertEqual(self.reserve(db, count=2), [3, 2])

    def test_a_reserved_show_is_not_handed_out_again_until_its_lease_ends(self):
        db = database(details(1), details(2))

        self.assertEqual(sorted(self.reserve(db)), [1, 2])
        self.assertEqual(self.reserve(db), [])
        self.assertEqual(state(db, 1)["episodes_selected_at"], NOW)
        # A run that dies leaves the show due again after the lease.
        later = NOW + next_shows.LEASE + timedelta(seconds=1)
        self.assertEqual(sorted(next_shows.reserve_due_shows(db.tmdb_tv_details, 10, later)), [1, 2])

    def test_nothing_due_reserves_nothing(self):
        self.assertEqual(self.reserve(database()), [])


class FetchTests(unittest.TestCase):
    def test_a_fetched_show_stores_one_document_per_season_and_is_marked_checked(self):
        db = database(details(1, season_numbers=(0, 1)))
        tmdb = Tmdb({1: {0: (100, [tmdb_episode(5, 1)]), 1: (101, [tmdb_episode(6, 1), tmdb_episode(7, 2)])}})

        result = run_fetch(db, tmdb, [1])

        seasons = list(db.tmdb_tv_season_details.find({"tmdb_id": 1}).sort("season_number"))
        self.assertEqual([(s["season_number"], s["season_id"], len(s["episodes"])) for s in seasons],
                         [(0, 100, 1), (1, 101, 2)])
        self.assertNotIn("crew", seasons[1]["episodes"][0])
        self.assertEqual(seasons[1]["updated_at"], NOW)
        self.assertEqual(state(db, 1)["episodes_updated_at"], NOW)
        self.assertIs(state(db, 1)["episodes_complete"], True)
        self.assertEqual(result["count_fetched"], 1)

    def test_a_show_without_recent_episodes_is_due_again_in_thirty_days(self):
        db = database(details(1))
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}}), [1])

        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=30))

    def test_a_show_with_an_episode_due_this_week_is_due_again_tomorrow(self):
        db = database(details(1))
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1, air_date="2026-10-09")])}}), [1])

        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=1))

    def test_a_season_tmdb_no_longer_lists_loses_its_document(self):
        db = database(details(1, season_numbers=(1, 2)))
        db.tmdb_tv_season_details.insert_many([
            {"tmdb_id": 1, "season_number": 2, "episodes": []}, {"tmdb_id": 2, "season_number": 2, "episodes": []}])

        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}}), [1])

        self.assertEqual(sorted((s["tmdb_id"], s["season_number"]) for s in db.tmdb_tv_season_details.find()),
                         [(1, 1), (2, 2)])

    def test_a_second_fetch_updates_the_season_document_in_place(self):
        db = database(details(1))
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}}), [1])
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1), tmdb_episode(7, 2)])}}), [1])

        (season,) = db.tmdb_tv_season_details.find({"tmdb_id": 1})
        self.assertEqual([episode["id"] for episode in season["episodes"]], [6, 7])

    def test_a_show_without_seasons_gets_no_request_and_is_still_marked_checked(self):
        db = database(details(1, season_numbers=()))
        tmdb = Tmdb({})

        result = run_fetch(db, tmdb, [1])

        self.assertEqual(tmdb.requests, [])
        self.assertEqual(db.tmdb_tv_season_details.count_documents({}), 0)
        self.assertEqual(state(db, 1)["episodes_updated_at"], NOW)
        self.assertIs(state(db, 1)["episodes_complete"], False)
        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=30))
        self.assertEqual(result["count_without_seasons"], 1)

    def test_a_show_without_stored_seasons_is_asked_when_the_change_feed_named_it(self):
        db = database(details(1, season_numbers=(), episodes_changed_at=NOW - timedelta(hours=1),
                              episodes_updated_at=NOW - timedelta(days=3)))
        tmdb = Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}})

        run_fetch(db, tmdb, [1])

        self.assertEqual(tmdb.requests, [(1, []), (1, [1])])
        self.assertEqual(db.tmdb_tv_season_details.count_documents({"tmdb_id": 1}), 1)

    def test_a_show_that_lists_no_season_any_more_keeps_its_documents(self):
        # Nothing is removed on a payload without seasons, as in delete_stale_seasons.
        db = database(details(1))
        db.tmdb_tv_season_details.insert_one({"tmdb_id": 1, "season_number": 1, "episodes": []})

        run_fetch(db, Tmdb({1: {}}), [1])

        self.assertEqual(db.tmdb_tv_season_details.count_documents({"tmdb_id": 1}), 1)
        self.assertIs(state(db, 1)["episodes_complete"], False)
        self.assertEqual(state(db, 1)["episodes_updated_at"], NOW)

    def test_a_failed_show_stores_nothing_and_is_tried_again_the_next_day(self):
        db = database(details(1, episodes_updated_at=NOW - timedelta(days=30)), details(2), details(3))
        tmdb = Tmdb({2: {1: (101, [tmdb_episode(6, 1)])}, 3: {1: (101, [tmdb_episode(7, 1)])}},
                    errors={1: http_error(500, 11)})

        result = run_fetch(db, tmdb, [1, 2, 3])

        self.assertEqual(db.tmdb_tv_season_details.count_documents({"tmdb_id": 1}), 0)
        self.assertEqual(state(db, 1)["episodes_failed_at"], NOW)
        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=1))
        self.assertEqual(state(db, 1)["episodes_updated_at"], NOW - timedelta(days=30))
        self.assertEqual((result["count_fetched"], result["count_failed"]), (2, 1))
        self.assertEqual(result["failed"], [{"tmdb_id": 1, "error": "HTTPError", "http_status": 500,
                                             "tmdb_status_code": 11, "message": "message"}])

    def test_a_success_clears_the_last_failure(self):
        db = database(details(1, episodes_failed_at=NOW - timedelta(days=1), episodes_error="HTTPError"))
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}}), [1])

        self.assertIsNone(state(db, 1)["episodes_failed_at"])
        self.assertIsNone(state(db, 1)["episodes_error"])

    def test_a_partly_fetched_show_keeps_its_other_seasons_and_is_not_complete(self):
        seasons = {number: (100 + number, [tmdb_episode(number, 1)]) for number in range(1, 31)}
        db = database(details(1, season_numbers=range(1, 31)), details(2), details(3))
        db.tmdb_tv_season_details.insert_one({"tmdb_id": 1, "season_number": 99, "episodes": []})
        tmdb = Tmdb({1: seasons, 2: {1: (101, [tmdb_episode(901, 1)])}, 3: {1: (101, [tmdb_episode(902, 1)])}})
        real_get = tmdb.get

        def get(tmdb_id, season_numbers):
            if 21 in season_numbers:
                raise requests.ConnectionError("reset")
            return real_get(tmdb_id, season_numbers)

        result = fetch.fetch_episodes(db, [1, 2, 3], get=get, now=lambda: NOW)

        self.assertEqual(db.tmdb_tv_season_details.count_documents({"tmdb_id": 1}), 21)
        self.assertIs(state(db, 1)["episodes_complete"], False)
        self.assertEqual(state(db, 1)["episodes_updated_at"], NOW)
        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=1))
        self.assertEqual(result["count_partial"], 1)

    def test_a_show_deleted_on_tmdb_is_left_to_the_details_flow(self):
        db = database(details(1), details(2, tmdb_deleted=True))
        tmdb = Tmdb({}, errors={1: http_error(404, 34)})

        result = run_fetch(db, tmdb, [1, 2])

        self.assertEqual(tmdb.requests, [(1, [1])])
        self.assertEqual(result["count_gone"], 2)
        self.assertEqual(result["count_failed"], 0)
        self.assertEqual(state(db, 1)["episodes_due_at"], NOW + timedelta(days=30))
        self.assertNotIn("episodes_updated_at", state(db, 1))
        self.assertNotIn("tmdb_deleted", state(db, 1))

    def test_the_job_fails_when_most_of_the_batch_failed_after_saving_the_rest(self):
        db = database(details(1), details(2), details(3))
        tmdb = Tmdb({3: {1: (101, [tmdb_episode(6, 1)])}}, errors={1: http_error(500), 2: http_error(500)})

        result = run_fetch(db, tmdb, [1, 2, 3])

        self.assertIsInstance(result, RuntimeError)
        self.assertEqual(db.tmdb_tv_season_details.count_documents({"tmdb_id": 3}), 1)

    def test_a_rejected_api_key_fails_the_job(self):
        db = database(*[details(tmdb_id) for tmdb_id in range(1, 6)])
        shows = {tmdb_id: {1: (101, [tmdb_episode(tmdb_id, 1)])} for tmdb_id in range(2, 6)}

        result = run_fetch(db, Tmdb(shows, errors={1: http_error(401, 7)}), [1, 2, 3, 4, 5])

        self.assertIsInstance(result, RuntimeError)

    def test_no_shows_is_not_an_error(self):
        self.assertEqual(run_fetch(database(), Tmdb({}), [])["count_shows"], 0)


class ModelTests(unittest.TestCase):
    def test_the_details_flow_still_loads_a_show_that_carries_episode_state(self):
        # mongoengine refuses a stored field the model does not declare.
        from f.tmdb_api.models import TmdbTvDetails

        db = database(details(1))
        run_fetch(db, Tmdb({1: {1: (101, [tmdb_episode(6, 1)])}}), [1])
        changes.read_changes(db, lambda start, end, page: {"total_pages": 1, "results": [{"id": 1}]}, NOW)
        next_shows.reserve_due_shows(db.tmdb_tv_details, 10, NOW + timedelta(days=40))

        document = TmdbTvDetails._from_son(state(db, 1))

        self.assertEqual(document.episodes_updated_at, NOW)
        self.assertEqual(document.tmdb_id, 1)


class ChangeFeedTests(unittest.TestCase):
    def feed(self, pages):
        calls = []

        def get_page(start, end, page):
            calls.append((start, end, page))
            return {"page": page, "total_pages": len(pages), "results": [{"id": tmdb_id} for tmdb_id in pages[page - 1]]}

        return get_page, calls

    def test_a_changed_show_in_the_catalog_becomes_due_now(self):
        db = database(details(1, episodes_due_at=NOW + timedelta(days=20)),
                      details(2, episodes_due_at=NOW + timedelta(days=20)))
        get_page, _ = self.feed([[1, 999]])

        result = changes.read_changes(db, get_page, NOW)

        self.assertEqual(state(db, 1)["episodes_due_at"], NOW)
        self.assertEqual(state(db, 1)["episodes_changed_at"], NOW)
        self.assertEqual(state(db, 2)["episodes_due_at"], NOW + timedelta(days=20))
        self.assertEqual(db.tmdb_tv_details.count_documents({}), 2)
        self.assertEqual((result["shows_changed"], result["shows_in_catalog"]), (2, 1))

    def test_every_page_is_read(self):
        db = database(*[details(tmdb_id, episodes_due_at=NOW + timedelta(days=20)) for tmdb_id in (1, 2, 3)])
        get_page, calls = self.feed([[1], [2], [3]])

        changes.read_changes(db, get_page, NOW)

        self.assertEqual([page for _, _, page in calls], [1, 2, 3])
        self.assertEqual([state(db, tmdb_id)["episodes_due_at"] for tmdb_id in (1, 2, 3)], [NOW, NOW, NOW])

    def test_the_next_run_starts_a_day_before_this_one(self):
        db = database()
        get_page, calls = self.feed([[]])

        changes.read_changes(db, get_page, NOW)
        changes.read_changes(db, get_page, NOW + timedelta(days=1))

        self.assertEqual([(start, end) for start, end, _ in calls],
                         [(date(2026, 10, 5), date(2026, 10, 6)), (date(2026, 10, 5), date(2026, 10, 7))])

    def test_a_failed_page_leaves_the_last_successful_run_as_it_was(self):
        db = database()
        get_page, _ = self.feed([[]])
        changes.read_changes(db, get_page, NOW)

        def broken(start, end, page):
            raise requests.ConnectionError("reset")

        with self.assertRaises(requests.ConnectionError):
            changes.read_changes(db, broken, NOW + timedelta(days=3))
        get_page, calls = self.feed([[]])
        changes.read_changes(db, get_page, NOW + timedelta(days=4))
        self.assertEqual(calls[0][0], date(2026, 10, 5))

    def test_a_show_already_due_keeps_its_place_in_the_queue(self):
        db = database(details(1, episodes_due_at=NOW - timedelta(days=2)), details(2))
        get_page, _ = self.feed([[1, 2]])

        changes.read_changes(db, get_page, NOW)

        self.assertEqual(state(db, 1)["episodes_due_at"], NOW - timedelta(days=2))
        self.assertNotIn("episodes_due_at", state(db, 2))
        self.assertEqual(state(db, 2)["episodes_changed_at"], NOW)


if __name__ == "__main__":
    unittest.main()
