"""The rules of the episode catalog: request batching, rows, diffing, refresh times, aired and still airing."""
import sys
import unittest
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api import episode_catalog as catalog


def tmdb_episode(episode_id, number, air_date="2008-01-20", season=1, **fields):
    return {
        "id": episode_id, "show_id": 1396, "season_number": season, "episode_number": number,
        "name": f"Episode {number}", "overview": "Long text", "air_date": air_date, "runtime": 47,
        "still_path": f"/{episode_id}.jpg", "episode_type": "standard", "production_code": "",
        "vote_average": 8.5, "vote_count": 100,
        "crew": [{"id": 1, "job": "Director"}], "guest_stars": [{"id": 2}],
    } | fields


def row(episode_id, number, season=1, **fields):
    """A catalog row as the copy builds it and as Crate returns it."""
    return {
        "show_id": 1396, "tmdb_id": episode_id, "season_tmdb_id": 3572, "season_number": season,
        "episode_number": number, "name": f"Episode {number}", "air_date": 1200787200000, "runtime": 47,
        "still_path": f"/{episode_id}.jpg", "episode_type": "standard",
        "tmdb_user_score_original": 8.5, "tmdb_user_score_rating_count": 100,
    } | fields


def episode(number, air_date, season=1, episode_type="standard", removed_at=None):
    return {"season_number": season, "episode_number": number, "air_date": air_date,
            "episode_type": episode_type, "removed_at": removed_at}


class SeasonBatchTests(unittest.TestCase):
    def test_a_request_carries_at_most_twenty_seasons(self):
        batches = catalog.season_batches(range(0, 45))

        self.assertEqual([len(batch) for batch in batches], [20, 20, 5])
        self.assertEqual(batches[0], list(range(0, 20)))
        self.assertEqual(batches[2], [40, 41, 42, 43, 44])

    def test_exactly_twenty_seasons_fit_one_request(self):
        self.assertEqual(catalog.season_batches(range(1, 21)), [list(range(1, 21))])

    def test_season_numbers_are_sorted_and_asked_once(self):
        # Numbers are not always 1 to n, and specials are season 0.
        self.assertEqual(catalog.season_batches([2019, 1, 0, 1, None, 7]), [[0, 1, 7, 2019]])

    def test_a_show_without_seasons_needs_no_batch(self):
        self.assertEqual(catalog.season_batches([]), [])


class CollectShowSeasonsTests(unittest.TestCase):
    def collect(self, stored, listed, absent=(), failing=()):
        """Runs the collection against a fake TMDB that lists `listed` season numbers."""
        requests = []

        def get(tmdb_id, season_numbers):
            requests.append(list(season_numbers))
            if any(number in failing for number in season_numbers):
                raise TimeoutError("timed out")
            payload = {"id": tmdb_id, "seasons": [{"id": 9000 + n, "season_number": n} for n in listed]}
            for number in season_numbers:
                if number in listed and number not in absent:
                    payload[f"season/{number}"] = {
                        "_id": "abc", "name": f"Season {number}", "air_date": "2008-01-20",
                        "season_number": number, "episodes": [tmdb_episode(number * 100 + 1, 1, season=number)],
                    }
            return payload

        return catalog.collect_show_seasons(1396, stored, get), requests

    def test_one_request_fetches_a_small_show(self):
        result, requests = self.collect(stored=[0, 1, 2], listed=[0, 1, 2])

        self.assertEqual(requests, [[0, 1, 2]])
        self.assertTrue(result.complete)
        self.assertEqual([season["season_number"] for season in result.seasons], [0, 1, 2])
        self.assertEqual(result.seasons[1]["season_id"], 9001)
        self.assertEqual(result.seasons[1]["tmdb_id"], 1396)

    def test_seasons_the_stored_details_do_not_know_are_fetched_too(self):
        # The stored details are up to 30 days old; the first response lists the seasons of today.
        result, requests = self.collect(stored=[1], listed=[1, 2, 3])

        self.assertEqual(requests, [[1], [2, 3]])
        self.assertTrue(result.complete)
        self.assertEqual(result.listed_season_numbers, [1, 2, 3])

    def test_seasons_tmdb_dropped_are_not_asked_again(self):
        result, requests = self.collect(stored=list(range(1, 31)), listed=list(range(1, 6)))

        self.assertEqual(requests, [list(range(1, 21))])
        self.assertTrue(result.complete)
        self.assertEqual(result.listed_season_numbers, [1, 2, 3, 4, 5])

    def test_a_long_show_takes_one_request_per_twenty_seasons(self):
        result, requests = self.collect(stored=list(range(0, 45)), listed=list(range(0, 45)))

        self.assertEqual([len(request) for request in requests], [20, 20, 5])
        self.assertTrue(result.complete)
        self.assertEqual(len(result.seasons), 45)

    def test_crew_and_guest_stars_are_dropped(self):
        result, _ = self.collect(stored=[1], listed=[1])

        stored_episode = result.seasons[0]["episodes"][0]
        self.assertNotIn("crew", stored_episode)
        self.assertNotIn("guest_stars", stored_episode)
        self.assertEqual(stored_episode["id"], 101)
        self.assertEqual(stored_episode["name"], "Episode 1")

    def test_a_listed_season_missing_from_the_response_leaves_the_show_incomplete(self):
        result, _ = self.collect(stored=[1, 2], listed=[1, 2], absent=[2])

        self.assertFalse(result.complete)
        self.assertEqual([season["season_number"] for season in result.seasons], [1])
        self.assertEqual(result.missing_season_numbers, [2])

    def test_a_failed_later_request_keeps_the_seasons_already_fetched(self):
        result, _ = self.collect(stored=list(range(1, 31)), listed=list(range(1, 31)), failing=[25])

        self.assertFalse(result.complete)
        self.assertEqual(len(result.seasons), 20)
        self.assertIsInstance(result.error, TimeoutError)

    def test_a_failed_first_request_raises(self):
        with self.assertRaises(TimeoutError):
            self.collect(stored=[1], listed=[1], failing=[1])

    def test_a_show_that_lists_no_season_is_not_complete_and_has_no_seasons(self):
        # Without a listed season nothing may be removed, as in delete_stale_seasons.
        result, requests = self.collect(stored=[], listed=[])

        self.assertEqual(requests, [[]])
        self.assertEqual(result.seasons, [])
        self.assertFalse(result.complete)
        self.assertIsNone(result.error)


class NeedsRequestTests(unittest.TestCase):
    def test_a_show_with_stored_seasons_is_requested(self):
        self.assertTrue(catalog.needs_request([1], changed_at=None, updated_at=None))

    def test_a_show_without_stored_seasons_gets_no_request(self):
        self.assertFalse(catalog.needs_request([], changed_at=None, updated_at=None))
        self.assertFalse(catalog.needs_request([], changed_at=datetime(2026, 10, 1), updated_at=datetime(2026, 10, 2)))

    def test_a_show_without_stored_seasons_is_requested_when_tmdb_says_it_changed(self):
        # The stored details may be older than the season TMDB just added.
        self.assertTrue(catalog.needs_request([], changed_at=datetime(2026, 10, 3), updated_at=datetime(2026, 10, 2)))
        self.assertTrue(catalog.needs_request([], changed_at=datetime(2026, 10, 3), updated_at=None))


class EpisodeRowTests(unittest.TestCase):
    def season(self, number=1, season_id=3572, updated_at=datetime(2026, 10, 6), episodes=()):
        return {"tmdb_id": 1396, "season_number": number, "season_id": season_id,
                "updated_at": updated_at, "episodes": list(episodes)}

    def test_an_episode_becomes_one_row(self):
        rows = catalog.episode_rows(1396, [self.season(episodes=[tmdb_episode(62085, 1)])])

        self.assertEqual(rows, [row(62085, 1)])

    def test_air_date_is_midnight_utc_of_tmdbs_date(self):
        # 2026-10-06T00:00:00Z
        self.assertEqual(catalog.air_date_millis("2026-10-06"), 1791244800000)
        self.assertIsNone(catalog.air_date_millis(None))
        self.assertIsNone(catalog.air_date_millis(""))
        self.assertIsNone(catalog.air_date_millis("soon"))

    def test_missing_values_are_null(self):
        rows = catalog.episode_rows(1396, [self.season(episodes=[
            tmdb_episode(7, 3, air_date=None, runtime=None, still_path=None, name="", vote_average=0.0, vote_count=0),
        ])])

        self.assertEqual(rows, [row(7, 3, air_date=None, runtime=None, still_path=None, name=None,
                                    tmdb_user_score_original=None, tmdb_user_score_rating_count=None)])

    def test_specials_are_season_zero(self):
        rows = catalog.episode_rows(1396, [self.season(number=0, season_id=3577, episodes=[
            tmdb_episode(5, 1, season=0)])])

        self.assertEqual((rows[0]["season_number"], rows[0]["season_tmdb_id"]), (0, 3577))

    def test_an_episode_without_an_id_is_skipped(self):
        self.assertEqual(catalog.episode_rows(1396, [self.season(episodes=[tmdb_episode(None, 1)])]), [])

    def test_an_episode_in_two_season_documents_counts_for_the_newer_one(self):
        # A partial fetch leaves older documents of the seasons it did not reach.
        rows = catalog.episode_rows(1396, [
            self.season(number=2, season_id=20, updated_at=datetime(2026, 10, 6),
                        episodes=[tmdb_episode(7, 4, season=2)]),
            self.season(number=1, season_id=10, updated_at=datetime(2026, 9, 6),
                        episodes=[tmdb_episode(7, 9, season=1)]),
        ])

        self.assertEqual([(r["tmdb_id"], r["season_number"], r["episode_number"]) for r in rows], [(7, 2, 4)])


class DiffTests(unittest.TestCase):
    def test_a_new_episode_is_upserted(self):
        diff = catalog.diff_episodes([row(1, 1), row(2, 2)], [row(1, 1)], may_remove=True)

        self.assertEqual(diff.upserts, [row(2, 2)])
        self.assertEqual(diff.removed_ids, [])

    def test_an_unchanged_episode_is_not_written(self):
        diff = catalog.diff_episodes([row(1, 1)], [row(1, 1, removed_at=None)], may_remove=True)

        self.assertEqual((diff.upserts, diff.removed_ids), ([], []))

    def test_a_renumbered_episode_is_an_update_of_the_same_row(self):
        diff = catalog.diff_episodes([row(1, 5, season=2)], [row(1, 1, season=1)], may_remove=True)

        self.assertEqual(diff.upserts, [row(1, 5, season=2)])
        self.assertEqual(diff.removed_ids, [])

    def test_any_changed_column_is_an_update(self):
        for column, value in (("name", "New"), ("air_date", 1), ("runtime", None), ("still_path", "/x.jpg"),
                              ("episode_type", "finale"), ("season_tmdb_id", 9),
                              ("tmdb_user_score_original", 8.6), ("tmdb_user_score_rating_count", 101)):
            with self.subTest(column=column):
                diff = catalog.diff_episodes([row(1, 1)], [row(1, 1, **{column: value})], may_remove=True)
                self.assertEqual(diff.upserts, [row(1, 1)])

    def test_an_episode_tmdb_no_longer_lists_is_removed(self):
        diff = catalog.diff_episodes([row(1, 1)], [row(1, 1), row(3, 3), row(2, 2)], may_remove=True)

        self.assertEqual(diff.upserts, [])
        self.assertEqual(diff.removed_ids, [2, 3])

    def test_nothing_is_removed_when_the_fetch_was_not_complete(self):
        diff = catalog.diff_episodes([row(1, 1)], [row(1, 1), row(2, 2)], may_remove=False)

        self.assertEqual(diff.removed_ids, [])

    def test_an_episode_already_removed_is_not_removed_again(self):
        diff = catalog.diff_episodes([], [row(2, 2, removed_at=1790000000000)], may_remove=True)

        self.assertEqual(diff.removed_ids, [])

    def test_a_removed_episode_tmdb_lists_again_is_restored(self):
        diff = catalog.diff_episodes([row(2, 2)], [row(2, 2, removed_at=1790000000000)], may_remove=True)

        self.assertEqual(diff.upserts, [row(2, 2)])

    def test_a_re_added_episode_is_a_new_row_and_the_old_one_is_removed(self):
        # TMDB deletes and re-adds an episode under a new id.
        diff = catalog.diff_episodes([row(972873, 1)], [row(62092, 1)], may_remove=True)

        self.assertEqual(diff.upserts, [row(972873, 1)])
        self.assertEqual(diff.removed_ids, [62092])


class NextRefreshTests(unittest.TestCase):
    NOW = datetime(2026, 10, 6, 9, 30)

    def refresh(self, *air_dates):
        return catalog.next_refresh_at(self.NOW, air_dates)

    def test_a_show_that_airs_nothing_waits_thirty_days(self):
        self.assertEqual(self.refresh("2013-09-29", None), datetime(2026, 11, 5, 9, 30))
        self.assertEqual(self.refresh(), datetime(2026, 11, 5, 9, 30))

    def test_a_show_with_an_episode_due_this_week_is_refreshed_daily(self):
        self.assertEqual(self.refresh("2026-10-13"), datetime(2026, 10, 7, 9, 30))
        self.assertEqual(self.refresh("2026-10-06"), datetime(2026, 10, 7, 9, 30))

    def test_a_show_that_aired_in_the_last_two_weeks_is_refreshed_daily(self):
        self.assertEqual(self.refresh("2026-09-22"), datetime(2026, 10, 7, 9, 30))

    def test_fifteen_days_after_the_last_episode_the_show_is_back_on_the_long_cycle(self):
        self.assertEqual(self.refresh("2026-09-21"), datetime(2026, 11, 5, 9, 30))

    def test_a_show_with_an_episode_further_ahead_is_due_a_week_before_it(self):
        # Next episode on October 24: refresh on October 17, then daily.
        self.assertEqual(self.refresh("2013-09-29", "2026-10-24", "2026-10-31"), datetime(2026, 10, 17))

    def test_an_episode_years_ahead_does_not_delay_the_thirty_day_cycle(self):
        self.assertEqual(self.refresh("2031-01-01"), datetime(2026, 11, 5, 9, 30))


class ChangesWindowTests(unittest.TestCase):
    NOW = datetime(2026, 10, 6, 4, 0)

    def test_the_window_overlaps_the_last_run_by_a_day(self):
        self.assertEqual(catalog.changes_window(self.NOW, datetime(2026, 10, 5, 4, 0)),
                         (date(2026, 10, 4), date(2026, 10, 6)))

    def test_the_first_run_reads_the_last_day(self):
        self.assertEqual(catalog.changes_window(self.NOW, None), (date(2026, 10, 5), date(2026, 10, 6)))

    def test_after_an_outage_the_window_catches_up(self):
        self.assertEqual(catalog.changes_window(self.NOW, datetime(2026, 9, 28, 4, 0)),
                         (date(2026, 9, 27), date(2026, 10, 6)))

    def test_the_window_never_spans_more_than_fourteen_days(self):
        # TMDB answers a longer range with HTTP 422.
        self.assertEqual(catalog.changes_window(self.NOW, datetime(2026, 8, 1)),
                         (date(2026, 9, 22), date(2026, 10, 6)))


class AiredTests(unittest.TestCase):
    TODAY = date(2026, 10, 6)

    def test_an_episode_dated_today_or_earlier_has_aired(self):
        self.assertTrue(catalog.has_aired(episode(1, "2026-10-06"), self.TODAY))
        self.assertTrue(catalog.has_aired(episode(1, "2008-01-20"), self.TODAY))

    def test_an_episode_dated_tomorrow_has_not_aired(self):
        self.assertFalse(catalog.has_aired(episode(1, "2026-10-07"), self.TODAY))

    def test_an_episode_without_a_date_has_not_aired(self):
        self.assertFalse(catalog.has_aired(episode(1, None), self.TODAY))

    def test_a_removed_episode_has_not_aired(self):
        self.assertFalse(catalog.has_aired(episode(1, "2008-01-20", removed_at=1790000000000), self.TODAY))

    def test_a_crate_timestamp_counts_like_tmdbs_date(self):
        # Crate returns air_date as milliseconds: 2026-10-06 and 2026-10-07, midnight UTC.
        self.assertTrue(catalog.has_aired(episode(1, 1791244800000), self.TODAY))
        self.assertFalse(catalog.has_aired(episode(1, 1791331200000), self.TODAY))


class StillAiringTests(unittest.TestCase):
    TODAY = date(2026, 10, 6)

    def airing(self, episodes, status="Returning Series"):
        return catalog.airing_season_number(episodes, status, self.TODAY)

    def test_a_season_with_an_episode_still_to_air_is_airing(self):
        # A streaming season, listed in full with its finale.
        episodes = [episode(1, "2026-09-25"), episode(2, "2026-10-02"), episode(3, "2026-10-09", episode_type="finale")]

        self.assertEqual(self.airing(episodes), 1)

    def test_a_season_whose_finale_has_aired_is_over(self):
        episodes = [episode(1, "2026-09-29"), episode(2, "2026-10-06", episode_type="finale")]

        self.assertIsNone(self.airing(episodes))

    def test_a_weekly_season_stays_open_in_the_gap_before_the_next_episodes_are_listed(self):
        episodes = [episode(1, "2026-09-22"), episode(2, "2026-09-29")]

        self.assertEqual(self.airing(episodes), 1)

    def test_a_season_without_a_finale_closes_forty_five_days_after_its_last_episode(self):
        self.assertEqual(self.airing([episode(1, "2026-08-22")]), 1)   # 45 days ago
        self.assertIsNone(self.airing([episode(1, "2026-08-21")]))     # 46 days ago

    def test_a_mid_season_break_keeps_the_season_open_like_any_other_gap(self):
        self.assertEqual(self.airing([episode(8, "2026-09-20", episode_type="mid_season")]), 1)

    def test_only_the_latest_season_can_be_airing(self):
        episodes = [
            episode(1, "2026-09-29", season=3),                       # no finale mark, aired a week ago
            episode(1, "2026-10-01", season=4), episode(2, "2026-10-08", season=4),
        ]

        self.assertEqual(self.airing(episodes), 4)

    def test_an_ended_or_canceled_show_has_no_airing_season(self):
        episodes = [episode(1, "2026-10-01"), episode(2, "2026-10-08")]

        self.assertIsNone(self.airing(episodes, status="Ended"))
        self.assertIsNone(self.airing(episodes, status="Canceled"))

    def test_specials_never_make_a_season_airing(self):
        episodes = [episode(1, "2020-01-01", episode_type="finale"), episode(5, "2026-10-08", season=0)]

        self.assertIsNone(self.airing(episodes))

    def test_a_season_with_only_undated_episodes_is_not_the_latest_season(self):
        # A placeholder season without dates does not hide the season that is on air.
        episodes = [episode(1, "2026-10-01", season=2), episode(2, "2026-10-08", season=2), episode(1, None, season=3)]

        self.assertEqual(self.airing(episodes), 2)

    def test_an_undated_episode_does_not_keep_a_finished_season_open(self):
        episodes = [episode(1, "2019-05-01"), episode(2, None)]

        self.assertIsNone(self.airing(episodes))

    def test_removed_episodes_are_ignored(self):
        episodes = [episode(1, "2019-05-01"), episode(2, "2026-10-08", removed_at=1790000000000)]

        self.assertIsNone(self.airing(episodes))

    def test_a_show_without_episodes_has_no_airing_season(self):
        self.assertIsNone(self.airing([]))


if __name__ == "__main__":
    unittest.main()
