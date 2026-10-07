"""The migration of user_watch_history into user_watch_log and user_watch_state, and its verification."""
import copy
import unittest
from unittest.mock import patch

from tests.watch_tables import WatchTables, at, episode, old_row, score, show

with patch("wmill.get_variable", return_value="unused"):
    from f.sync.tracking import migrate_watch_history

MARKED = at(2025, 3, 14, 21, 5)
SEVERANCE = [
    episode(95396, 21, 1, 1, at(2025, 3, 1)),
    episode(95396, 22, 1, 2, at(2025, 3, 8)),
    episode(95396, 23, 1, 3, at(2025, 3, 21)),
]


def tables(**extra):
    """Ann has a watched movie, a show marked Seen, a rated movie with no watch and a rated show with no watch."""
    return WatchTables(**({
        "user_watch_history": [old_row(tmdb_id=603), old_row(tmdb_id=95396, media_type="show")],
        "user_score": [score(tmdb_id=680), score(tmdb_id=603), score(tmdb_id=1396, media_type="show")],
        "user_wishlist": [{"user_id": "ann", "tmdb_id": 603, "media_type": "movie"},
                          {"user_id": "ann", "tmdb_id": 13, "media_type": "movie"}],
        "show": [show(95396)],
        "episode": SEVERANCE,
    } | extra))


def migrate(crate, **kwargs):
    return migrate_watch_history.migrate(crate, **({"dry_run": False} | kwargs))


def log_ids(crate, **equal):
    return sorted(row["watch_id"] for row in crate.rows("user_watch_log", **equal))


class MigrationTests(unittest.TestCase):
    def test_every_old_row_and_every_scored_movie_without_a_watch_is_written(self):
        crate = tables()

        migrate(crate)

        self.assertEqual(log_ids(crate), ["g-mig-seen-95396-21", "g-mig-seen-95396-22", "mig-movie-603", "score-680"])
        self.assertEqual(
            sorted((row["tmdb_id"], row["media_type"], row["state"], row["seen_press_group"])
                   for row in crate.rows("user_watch_state")),
            [(603, "movie", "seen", None), (680, "movie", "seen", None), (95396, "show", "seen", "mig-seen-95396")])

    def test_the_episode_watches_are_recorded_at_the_time_of_the_old_mark(self):
        crate = tables()

        migrate(crate)

        self.assertEqual({(row["created_at"], row["watched_at"], row["origin"])
                          for row in crate.rows("user_watch_log", media_type="show")}, {(MARKED, None, "seen")})

    def test_the_old_tables_are_left_as_they_were(self):
        crate = tables()
        before = copy.deepcopy({name: crate.tables[name] for name in ("user_watch_history", "user_score", "user_wishlist")})

        migrate(crate)

        self.assertEqual({name: crate.tables[name] for name in before}, before)

    def test_a_second_run_writes_nothing(self):
        crate = tables()
        migrate(crate)
        log, states = copy.deepcopy(crate.rows("user_watch_log")), copy.deepcopy(crate.rows("user_watch_state"))

        result = migrate(crate)

        self.assertEqual((crate.rows("user_watch_log"), crate.rows("user_watch_state")), (log, states))
        self.assertEqual(result["written"], {"movie watches": 0, "score-owned watches": 0, "state rows": 0,
                                             "episode watches": 0, "score-owned watches removed": 0})

    def test_a_show_whose_episodes_are_not_copied_yet_is_seen_with_its_press_and_no_watches(self):
        crate = tables(show=[show(95396, copied=None)])

        result = migrate(crate)

        self.assertEqual(log_ids(crate, media_type="show"), [])
        self.assertEqual([(row["state"], row["seen_press_group"], row["seen_press_from"])
                          for row in crate.rows("user_watch_state", media_type="show")],
                         [("seen", "mig-seen-95396", "not_started")])
        self.assertEqual(result["planned"]["show presses on shows whose episodes are not copied yet"], 1)

    def test_a_later_run_fills_the_show_once_its_episodes_are_copied(self):
        crate = tables(show=[show(95396, copied=None)])
        migrate(crate)
        crate.tables["show"] = [show(95396)]

        result = migrate(crate)

        self.assertEqual(log_ids(crate, media_type="show"), ["g-mig-seen-95396-21", "g-mig-seen-95396-22"])
        self.assertEqual(result["written"]["episode watches"], 2)

    def test_a_state_the_new_build_wrote_is_not_overwritten_and_its_show_gets_no_watches(self):
        on_hold = {"user_id": "ann", "tmdb_id": 95396, "media_type": "show", "state": "on_hold",
                   "state_changed_at": at(2026, 10, 9), "pass": 1, "seen_press_group": None, "seen_press_from": None,
                   "rate_prompt_dismissed_at": None, "seen_question": None, "created_at": at(2026, 10, 9),
                   "updated_at": at(2026, 10, 9)}
        crate = tables(user_watch_state=[on_hold])

        migrate(crate)

        self.assertEqual(crate.rows("user_watch_state", media_type="show"), [on_hold])
        self.assertEqual(log_ids(crate, media_type="show"), [])

    def test_a_movie_watched_in_the_old_build_after_its_score_watch_was_migrated_keeps_only_the_watch(self):
        crate = tables()
        migrate(crate)
        crate.tables["user_watch_history"].append(old_row(tmdb_id=680, watched=at(2026, 10, 8, 13)))

        result = migrate(crate)

        self.assertEqual(log_ids(crate, tmdb_id=680), ["mig-movie-680"])
        self.assertEqual(len(crate.rows("user_watch_state", tmdb_id=680)), 1)
        self.assertEqual(result["written"]["score-owned watches removed"], 1)

    def test_a_run_with_since_takes_only_what_changed_since(self):
        crate = tables()
        crate.tables["user_watch_history"].append(old_row(tmdb_id=11, watched=at(2026, 10, 8, 13)))

        migrate(crate, since=at(2026, 10, 8, 12))

        self.assertEqual(log_ids(crate), ["mig-movie-11"])

    def test_one_member_can_be_migrated_alone(self):
        crate = tables()
        crate.tables["user_watch_history"].append(old_row(user="ben", tmdb_id=11))

        migrate(crate, user_id="ben")

        self.assertEqual(log_ids(crate), ["mig-movie-11"])
        self.assertEqual({row["user_id"] for row in crate.rows("user_watch_state")}, {"ben"})


class DryRunTests(unittest.TestCase):
    def test_a_dry_run_writes_nothing(self):
        crate = tables()

        result = migrate(crate, dry_run=True)

        self.assertEqual((crate.rows("user_watch_log"), crate.rows("user_watch_state")), ([], []))
        self.assertFalse([sql for sql in crate.statements if not sql.startswith("SELECT ")])
        self.assertEqual((result["dry_run"], result["written"]), (True, None))

    def test_it_reports_the_counts_per_kind(self):
        crate = tables()
        crate.tables["user_watch_history"] += [old_row(user="ben", tmdb_id=11), old_row(tmdb_id=7, media_type="show")]

        planned = migrate(crate, dry_run=True)["planned"]

        self.assertEqual(
            {name: planned[name] for name in (
                "movie watches", "show presses", "episode watches", "score-owned watches", "state rows",
                "state rows: movie", "state rows: show", "show presses on shows that are not in the catalog",
                "show presses on shows whose episodes are not copied yet", "members")},
            {"movie watches": 2, "show presses": 2, "episode watches": 2, "score-owned watches": 1, "state rows": 5,
             "state rows: movie": 3, "state rows: show": 2, "show presses on shows that are not in the catalog": 1,
             "show presses on shows whose episodes are not copied yet": 0, "members": 2})

    def test_it_reports_the_members_with_the_most_log_rows(self):
        crate = tables()
        crate.tables["user_watch_history"].append(old_row(user="ben", tmdb_id=11))

        result = migrate(crate, dry_run=True)

        self.assertEqual(result["largest members"], [{"user_id": "ann", "log rows": 4}, {"user_id": "ben", "log rows": 1}])

    def test_it_counts_the_want_to_see_rows_on_titles_that_become_seen(self):
        result = migrate(tables(), dry_run=True)

        self.assertEqual(result["want to see rows on titles that become seen"],
                         {"movie watches": 1, "score-owned movies": 0, "show presses": 0, "total": 1})

    def test_it_shows_up_to_five_planned_rows_of_each_kind(self):
        crate = tables()
        crate.tables["user_watch_history"] += [old_row(tmdb_id=n) for n in range(1000, 1010)]

        samples = migrate(crate, dry_run=True)["samples"]

        self.assertEqual({kind: len(rows) for kind, rows in samples.items()},
                         {"movie watches": 5, "score-owned watches": 1, "show presses": 1, "episode watches": 2})
        self.assertEqual(samples["show presses"][0]["seen_press_group"], "mig-seen-95396")

    def test_a_real_run_reports_what_it_planned_and_what_it_wrote(self):
        result = migrate(tables())

        self.assertEqual(result["written"], {"movie watches": 1, "score-owned watches": 1, "state rows": 3,
                                             "episode watches": 2, "score-owned watches removed": 0})
        self.assertEqual((result["planned"]["movie watches"], result["planned"]["episode watches"]), (1, 2))


class VerifyTests(unittest.TestCase):
    def verified(self, crate):
        return migrate_watch_history.verify_migration(crate)

    def test_a_migrated_database_passes(self):
        crate = tables()
        migrate(crate)

        report = self.verified(crate)

        self.assertEqual((report["ok"], report["problems"]), (True, {}))
        self.assertEqual(
            {name: report["counts"][name] for name in (
                "old rows: movie", "old rows: show", "state rows: movie", "state rows: show",
                "log rows: movie, single", "log rows: movie, score", "log rows: show, seen",
                "episode watches expected from the episode lists", "migrated shows: group complete",
                "titles that count as Seen: before", "titles that count as Seen: after")},
            {"old rows: movie": 1, "old rows: show": 1, "state rows: movie": 2, "state rows: show": 1,
             "log rows: movie, single": 1, "log rows: movie, score": 1, "log rows: show, seen": 2,
             "episode watches expected from the episode lists": 2, "migrated shows: group complete": 1,
             "titles that count as Seen: before": 4, "titles that count as Seen: after": 4})

    def test_nothing_migrated_fails_with_every_old_row_listed(self):
        report = self.verified(tables())

        self.assertFalse(report["ok"])
        self.assertEqual(report["problems"]["old rows without a Seen state row"]["count"], 2)
        self.assertEqual(report["problems"]["Seen titles lost"]["examples"],
                         [("ann", 95396, "show")])
        self.assertEqual(report["problems"]["scored movies without a watch"]["count"], 2)

    def test_a_show_waiting_for_its_episodes_is_counted_and_is_no_problem(self):
        crate = tables(show=[show(95396, copied=None)])
        migrate(crate)

        report = self.verified(crate)

        self.assertTrue(report["ok"])
        self.assertEqual(report["counts"]["migrated shows: no episode list yet"], 1)

    def test_a_show_whose_episodes_were_copied_after_the_run_is_counted_as_still_to_fill(self):
        crate = tables(show=[show(95396, copied=None)])
        migrate(crate)
        crate.tables["show"] = [show(95396)]

        report = self.verified(crate)

        self.assertTrue(report["ok"])
        self.assertEqual(report["counts"]["migrated shows: still to fill"], 1)

    def test_a_group_with_fewer_watches_than_the_episode_list_gives_is_a_problem(self):
        crate = tables()
        migrate(crate)
        crate.tables["episode"].append(episode(95396, 20, 1, 0, at(2025, 2, 1)))

        report = self.verified(crate)

        self.assertEqual(report["problems"]["shows with an incomplete group"],
                         {"count": 1, "examples": [("ann", 95396, "show", "2 of 3")]})

    def test_a_lost_log_row_and_a_lost_state_row_are_found(self):
        crate = tables()
        migrate(crate)
        crate.tables["user_watch_log"] = [row for row in crate.rows("user_watch_log") if row["watch_id"] != "score-680"]
        crate.tables["user_watch_state"] = [row for row in crate.rows("user_watch_state") if row["tmdb_id"] != 603]

        problems = self.verified(crate)["problems"]

        self.assertEqual(sorted(problems), [
            "movie state rows without a watch", "movies with a watch and no state row",
            "old rows without a Seen state row", "scored movies without a watch"])

    def test_verification_writes_nothing(self):
        crate = tables()

        self.verified(crate)

        self.assertFalse([sql for sql in crate.statements if not sql.startswith(("SELECT ", "REFRESH TABLE "))])


class MainArgumentTests(unittest.TestCase):
    """Windmill passes None for every argument the caller leaves out."""

    def run_main(self, crate=None, **kwargs):
        crate = crate or tables()
        crate.disconnect = lambda: None
        with patch.object(migrate_watch_history, "CrateConnector", return_value=crate):
            return crate, migrate_watch_history.main(**kwargs)

    def test_a_missing_dry_run_is_a_dry_run(self):
        for arguments in ({}, {"dry_run": None, "verify": None, "user_id": None, "since": None}):
            crate, result = self.run_main(**arguments)
            self.assertEqual((result["dry_run"], crate.rows("user_watch_log")), (True, []))

    def test_only_an_explicit_false_writes(self):
        crate, result = self.run_main(dry_run=False)

        self.assertEqual((result["dry_run"], len(crate.rows("user_watch_log"))), (False, 4))

    def test_since_is_read_as_a_utc_time(self):
        crate = tables()
        crate.tables["user_watch_history"].append(old_row(tmdb_id=11, watched=at(2026, 10, 8, 13)))

        self.run_main(crate, dry_run=False, since="2026-10-08T12:00:00Z")

        self.assertEqual(log_ids(crate), ["mig-movie-11"])

    def test_verify_checks_and_fails_the_job_when_something_is_wrong(self):
        with self.assertRaises(RuntimeError):
            self.run_main(verify=True)

        crate = tables()
        migrate(crate)
        _, report = self.run_main(crate, verify=True)
        self.assertTrue(report["ok"])


if __name__ == "__main__":
    unittest.main()
