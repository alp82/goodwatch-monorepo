"""What today's watch history becomes in the watch log (docs/implementation/tracking/data-model.md, section 6)."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.tracking import rules


def at(*parts) -> int:
    """A UTC time in the milliseconds Crate returns."""
    return int(datetime(*parts, tzinfo=timezone.utc).timestamp() * 1000)


MARKED = at(2025, 3, 14, 21, 5)
RATED = at(2024, 11, 2, 8, 15)


def old_row(user="ann", tmdb_id=603, media_type="movie", watched=MARKED, **fields):
    return {"user_id": user, "tmdb_id": tmdb_id, "media_type": media_type, "first_watched_at": watched,
            "last_watched_at": watched, "created_at": watched, "updated_at": watched} | fields


def score(user="ann", tmdb_id=680, media_type="movie", updated=RATED, **fields):
    return {"user_id": user, "tmdb_id": tmdb_id, "media_type": media_type, "created_at": updated,
            "updated_at": updated} | fields


def episode(episode_id, season, number, aired, **fields):
    return {"tmdb_id": episode_id, "season_number": season, "episode_number": number, "air_date": aired} | fields


def press(user="ann", show=1399, changed=MARKED, group="mig-seen-1399", **fields):
    return {"user_id": user, "tmdb_id": show, "media_type": "show", "state": "seen", "state_changed_at": changed,
            "pass": 1, "seen_press_group": group, "seen_press_from": "not_started"} | fields


class MovieRowTests(unittest.TestCase):
    def test_a_movie_row_becomes_one_dated_watch_and_a_seen_state(self):
        plan = rules.plan_titles([old_row(created_at=at(2025, 3, 14, 21, 6))], [], [])

        self.assertEqual(plan.movie_watches, [{
            "user_id": "ann", "watch_id": "mig-movie-603", "media_type": "movie", "tmdb_id": 603,
            "episode_tmdb_id": None, "season_number": None, "episode_number": None,
            "watched_at": MARKED, "watched_at_precision": "moment", "origin": "single",
            "group_id": None, "import_id": None, "pass": 1,
            "created_at": at(2025, 3, 14, 21, 6), "updated_at": at(2025, 3, 14, 21, 6),
        }])
        self.assertEqual(plan.state_rows, [{
            "user_id": "ann", "tmdb_id": 603, "media_type": "movie", "state": "seen",
            "state_changed_at": MARKED, "pass": 1, "seen_press_group": None, "seen_press_from": None,
            "rate_prompt_dismissed_at": None, "seen_question": None,
            "created_at": MARKED, "updated_at": MARKED,
        }])
        self.assertEqual((plan.score_watches, plan.presses), ([], []))

    def test_a_row_copied_without_a_creation_time_is_created_when_it_was_watched(self):
        plan = rules.plan_titles([old_row(created_at=None)], [], [])

        self.assertEqual(plan.movie_watches[0]["created_at"], MARKED)

    def test_a_row_without_any_time_is_left_out_and_counted(self):
        row = old_row(first_watched_at=None, last_watched_at=None, created_at=None, updated_at=None)

        plan = rules.plan_titles([row], [], [])

        self.assertEqual((plan.movie_watches, plan.state_rows), ([], []))
        self.assertEqual(plan.skipped, {"old rows without a time": 1})

    def test_two_members_with_the_same_movie_each_get_their_own_watch(self):
        plan = rules.plan_titles([old_row(user="ann"), old_row(user="ben")], [], [])

        self.assertEqual([(row["user_id"], row["watch_id"]) for row in plan.movie_watches],
                         [("ann", "mig-movie-603"), ("ben", "mig-movie-603")])


class ShowRowTests(unittest.TestCase):
    def test_a_show_row_becomes_a_seen_state_with_a_press_that_can_be_taken_back(self):
        plan = rules.plan_titles([old_row(tmdb_id=1399, media_type="show")], [], [])

        self.assertEqual(plan.presses, [{
            "user_id": "ann", "tmdb_id": 1399, "media_type": "show", "state": "seen",
            "state_changed_at": MARKED, "pass": 1, "seen_press_group": "mig-seen-1399",
            "seen_press_from": "not_started", "rate_prompt_dismissed_at": None, "seen_question": None,
            "created_at": MARKED, "updated_at": MARKED,
        }])
        self.assertEqual(plan.state_rows, plan.presses)
        self.assertEqual(plan.movie_watches, [])


class GroupRowTests(unittest.TestCase):
    def test_every_regular_episode_aired_by_the_day_of_the_press_gets_an_undated_watch(self):
        episodes = [episode(11, 1, 1, at(2025, 3, 1)), episode(12, 1, 2, at(2025, 3, 8))]

        rows = rules.group_rows(press(), episodes)

        self.assertEqual(rows[0], {
            "user_id": "ann", "watch_id": "g-mig-seen-1399-11", "media_type": "show", "tmdb_id": 1399,
            "episode_tmdb_id": 11, "season_number": 1, "episode_number": 1,
            "watched_at": None, "watched_at_precision": "unknown", "origin": "seen",
            "group_id": "mig-seen-1399", "import_id": None, "pass": 1,
            "created_at": MARKED, "updated_at": MARKED,
        })
        self.assertEqual([row["watch_id"] for row in rows], ["g-mig-seen-1399-11", "g-mig-seen-1399-12"])

    def test_an_episode_that_aired_on_the_utc_day_of_the_press_counts_and_the_next_day_does_not(self):
        late = at(2025, 3, 14, 23, 59)
        episodes = [episode(11, 1, 1, at(2025, 3, 14)), episode(12, 1, 2, at(2025, 3, 15))]

        rows = rules.group_rows(press(changed=late), episodes)

        self.assertEqual([row["episode_tmdb_id"] for row in rows], [11])

    def test_specials_removed_and_undated_episodes_get_no_watch(self):
        episodes = [
            episode(1, 0, 1, at(2020, 1, 1)),
            episode(2, 1, 1, at(2020, 1, 1), removed_at=at(2024, 1, 1)),
            episode(3, 1, 2, None),
            episode(4, 1, 3, at(2020, 1, 15)),
        ]

        rows = rules.group_rows(press(), episodes)

        self.assertEqual([row["episode_tmdb_id"] for row in rows], [4])

    def test_an_episode_already_watched_in_the_presss_pass_gets_no_second_watch(self):
        episodes = [episode(11, 1, 1, at(2025, 3, 1)), episode(12, 1, 2, at(2025, 3, 8))]

        rows = rules.group_rows(press(), episodes, watched={(1, 1)})

        self.assertEqual([row["episode_tmdb_id"] for row in rows], [12])

    def test_the_rows_take_the_presss_own_group_and_pass(self):
        rows = rules.group_rows(press(group="0193f6a3-11aa", **{"pass": 2}), [episode(11, 1, 1, at(2025, 3, 1))])

        self.assertEqual((rows[0]["watch_id"], rows[0]["group_id"], rows[0]["pass"]),
                         ("g-0193f6a3-11aa-11", "0193f6a3-11aa", 2))


class PressesToFillTests(unittest.TestCase):
    def test_a_seen_show_with_a_standing_press_is_a_candidate(self):
        self.assertEqual(rules.standing_presses([press()]), [press()])

    def test_a_press_made_on_a_seen_show_is_skipped(self):
        self.assertEqual(rules.standing_presses([press(seen_press_from="seen")]), [])

    def test_movies_other_states_and_rows_without_a_press_are_skipped(self):
        rows = [
            press(media_type="movie", seen_press_group=None, seen_press_from=None),
            press(state="watching", seen_press_group=None, seen_press_from=None),
            press(seen_press_group=None, seen_press_from=None),
            press(seen_press_from=None),
        ]

        self.assertEqual(rules.standing_presses(rows), [])


class ScoreOwnedRowTests(unittest.TestCase):
    def test_a_scored_movie_with_no_watch_gets_the_scores_undated_watch(self):
        plan = rules.plan_titles([], [score()], [])

        self.assertEqual(plan.score_watches, [{
            "user_id": "ann", "watch_id": "score-680", "media_type": "movie", "tmdb_id": 680,
            "episode_tmdb_id": None, "season_number": None, "episode_number": None,
            "watched_at": None, "watched_at_precision": "unknown", "origin": "score",
            "group_id": None, "import_id": None, "pass": 1, "created_at": RATED, "updated_at": RATED,
        }])
        self.assertEqual([(row["tmdb_id"], row["state"], row["state_changed_at"], row["seen_press_group"])
                          for row in plan.state_rows], [(680, "seen", RATED, None)])

    def test_a_scored_show_with_no_watch_gets_nothing(self):
        plan = rules.plan_titles([], [score(media_type="show")], [])

        self.assertEqual((plan.score_watches, plan.state_rows), ([], []))

    def test_a_scored_movie_that_has_a_watch_row_gets_only_the_watch(self):
        plan = rules.plan_titles([old_row(tmdb_id=680)], [score()], [])

        self.assertEqual(plan.score_watches, [])
        self.assertEqual([row["watch_id"] for row in plan.movie_watches], ["mig-movie-680"])
        self.assertEqual(len(plan.state_rows), 1)

    def test_a_scored_movie_with_a_watch_logged_since_gets_no_score_watch(self):
        logged = [{"user_id": "ann", "tmdb_id": 680, "watch_id": "0193f6a2-7c1e", "origin": "single"}]

        plan = rules.plan_titles([], [score()], logged)

        self.assertEqual((plan.score_watches, plan.state_rows), ([], []))

    def test_the_score_watch_of_an_earlier_run_is_planned_again_so_its_state_row_is_too(self):
        logged = [{"user_id": "ann", "tmdb_id": 680, "watch_id": "score-680", "origin": "score"}]

        plan = rules.plan_titles([], [score()], logged)

        self.assertEqual([row["watch_id"] for row in plan.score_watches], ["score-680"])
        self.assertEqual(len(plan.state_rows), 1)

    def test_a_score_without_an_update_time_uses_its_creation_time(self):
        plan = rules.plan_titles([], [score(updated_at=None, created_at=at(2024, 1, 1))], [])

        self.assertEqual(plan.score_watches[0]["created_at"], at(2024, 1, 1))

    def test_a_movie_marked_watched_after_its_score_watch_was_migrated_loses_the_score_watch(self):
        logged = [{"user_id": "ann", "tmdb_id": 680, "watch_id": "score-680", "origin": "score"}]

        plan = rules.plan_titles([old_row(tmdb_id=680)], [score()], logged)

        self.assertEqual(plan.replaced_score_watches, [("ann", "score-680")])
        self.assertEqual(plan.score_watches, [])


class SinceTests(unittest.TestCase):
    """A second run after the switch takes only what the old build wrote since the first."""

    def test_only_rows_changed_at_or_after_the_given_time_are_planned(self):
        first_run = at(2026, 10, 8, 12)
        history = [old_row(tmdb_id=1), old_row(tmdb_id=2, watched=at(2026, 10, 8, 13))]
        scores = [score(tmdb_id=3), score(tmdb_id=4, updated=at(2026, 10, 8, 14))]

        plan = rules.plan_titles(history, scores, [], since=first_run)

        self.assertEqual([row["tmdb_id"] for row in plan.movie_watches], [2])
        self.assertEqual([row["tmdb_id"] for row in plan.score_watches], [4])

    def test_an_older_watch_row_still_keeps_a_new_score_from_adding_a_score_watch(self):
        first_run = at(2026, 10, 8, 12)

        plan = rules.plan_titles([old_row(tmdb_id=680)], [score(updated=at(2026, 10, 8, 14))], [], since=first_run)

        self.assertEqual((plan.movie_watches, plan.score_watches, plan.state_rows), ([], [], []))


class WantToSeeOverlapTests(unittest.TestCase):
    def test_want_to_see_rows_on_titles_that_become_seen_are_counted_per_kind(self):
        plan = rules.plan_titles(
            [old_row(tmdb_id=603), old_row(tmdb_id=1399, media_type="show")], [score(tmdb_id=680)], [])
        wishlist = [
            {"user_id": "ann", "tmdb_id": 603, "media_type": "movie"},
            {"user_id": "ann", "tmdb_id": 680, "media_type": "movie"},
            {"user_id": "ann", "tmdb_id": 1399, "media_type": "show"},
            {"user_id": "ann", "tmdb_id": 603, "media_type": "show"},
            {"user_id": "ben", "tmdb_id": 603, "media_type": "movie"},
        ]

        self.assertEqual(rules.want_to_see_overlap(plan, wishlist),
                         {"movie watches": 1, "score-owned movies": 1, "show presses": 1, "total": 3})


class WellFormedRowTests(unittest.TestCase):
    """Invariants 2, 3 and 6 of the data model, as the verification applies them."""

    def test_the_rows_the_migration_plans_are_well_formed(self):
        plan = rules.plan_titles([old_row(), old_row(tmdb_id=1399, media_type="show")], [score()], [])
        watches = plan.movie_watches + plan.score_watches + rules.group_rows(
            plan.presses[0], [episode(11, 1, 1, at(2025, 3, 1))])

        self.assertEqual([rules.malformed_log_row(row) for row in watches], [None, None, None])
        self.assertEqual([rules.malformed_state_row(row) for row in plan.state_rows], [None, None, None])

    def test_a_malformed_log_row_is_named(self):
        good = rules.group_rows(press(), [episode(11, 1, 1, at(2025, 3, 1))])[0]

        self.assertEqual(
            [rules.malformed_log_row(good | change) for change in (
                {"watched_at": MARKED}, {"group_id": None}, {"import_id": "imp_1"},
                {"media_type": "movie"}, {"season_number": None})],
            ["the precision and the date disagree",
             "a group origin without a group id, or a group id without one",
             "an import without its id, or an import id without one",
             "a movie watch with an episode or a pass",
             "a show watch without an episode"])
        self.assertEqual(rules.malformed_log_row(good | {"origin": "score", "group_id": None}),
                         "a score's watch with a date or on a show")

    def test_a_malformed_state_row_is_named(self):
        self.assertEqual(
            [rules.malformed_state_row(press(**change)) for change in (
                {"seen_press_from": None}, {"state": "watching"}, {"media_type": "movie", "pass": 2})],
            ["half a Seen press", "a Seen press on a show that is not Seen", "a movie that is not Seen in pass 1"])


if __name__ == "__main__":
    unittest.main()
