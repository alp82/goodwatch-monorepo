"""The fill job: a show marked Seen before it had an episode list gets its press's watches later (C5)."""
import unittest
from unittest.mock import patch

from tests.watch_tables import WatchTables, at, episode, press, show, watch

with patch("wmill.get_variable", return_value="unused"):
    from f.sync.tracking import fill_seen_groups

PRESSED = at(2025, 3, 14, 21, 5)
GAME_OF_THRONES = [
    episode(1399, 11, 1, 1, at(2025, 3, 1)),
    episode(1399, 12, 1, 2, at(2025, 3, 8)),
    episode(1399, 13, 1, 3, at(2025, 3, 15)),
    episode(1399, 10, 0, 1, at(2025, 2, 1)),
]


def fill(crate, **kwargs):
    return fill_seen_groups.fill_seen_groups(crate, **({"dry_run": False} | kwargs))


class FillSeenGroupsTests(unittest.TestCase):
    def test_a_press_without_watches_gets_the_episodes_that_had_aired_by_its_day(self):
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=GAME_OF_THRONES)

        result = fill(crate)

        rows = crate.rows("user_watch_log")
        self.assertEqual([(row["watch_id"], row["season_number"], row["episode_number"]) for row in rows],
                         [("g-0193f6a3-11aa-11", 1, 1), ("g-0193f6a3-11aa-12", 1, 2)])
        self.assertEqual({(row["origin"], row["group_id"], row["watched_at"], row["created_at"], row["pass"])
                          for row in rows}, {("seen", "0193f6a3-11aa", None, PRESSED, 1)})
        self.assertEqual((result["groups to fill"], result["episode watches"], result["inserted"]), (1, 2, 2))

    def test_the_state_row_is_not_changed(self):
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=GAME_OF_THRONES)

        fill(crate)

        self.assertEqual(crate.rows("user_watch_state"), [press()])

    def test_a_second_run_writes_nothing(self):
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=GAME_OF_THRONES)
        fill(crate)

        result = fill(crate)

        self.assertEqual(len(crate.rows("user_watch_log")), 2)
        self.assertEqual((result["groups already filled"], result["episode watches"], result["inserted"]), (1, 0, 0))

    def test_a_dry_run_reports_and_writes_nothing(self):
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=GAME_OF_THRONES)

        result = fill(crate, dry_run=True)

        self.assertEqual(crate.rows("user_watch_log"), [])
        self.assertEqual((result["dry_run"], result["episode watches"], result["inserted"]), (True, 2, 0))
        self.assertEqual([row["watch_id"] for row in result["sample"]], ["g-0193f6a3-11aa-11", "g-0193f6a3-11aa-12"])

    def test_a_show_whose_episodes_are_not_copied_yet_waits(self):
        crate = WatchTables(
            user_watch_state=[press(), press(show_id=7, group="g7")],
            show=[show(1399, copied=None)],
            episode=GAME_OF_THRONES[:1],
        )

        result = fill(crate)

        self.assertEqual(crate.rows("user_watch_log"), [])
        self.assertEqual((result["presses on shows whose episodes are not copied yet"],
                          result["presses on shows that are not in the catalog"]), (1, 1))

    def test_a_press_made_on_a_seen_show_is_not_filled(self):
        crate = WatchTables(user_watch_state=[press(seen_press_from="seen")], show=[show(1399)], episode=GAME_OF_THRONES)

        result = fill(crate)

        self.assertEqual(crate.rows("user_watch_log"), [])
        self.assertEqual(result["presses"], 0)

    def test_a_group_that_has_a_watch_already_is_left_alone(self):
        kept = watch(episode_id=12, number=2, origin="seen", group_id="0193f6a3-11aa", watch_id="g-0193f6a3-11aa-12")
        crate = WatchTables(user_watch_state=[press()], user_watch_log=[kept], show=[show(1399)],
                            episode=GAME_OF_THRONES)

        fill(crate)

        self.assertEqual(crate.rows("user_watch_log"), [kept])

    def test_an_episode_the_member_watched_in_the_pass_gets_no_second_watch(self):
        own = watch(episode_id=11, number=1)
        other_pass = watch(episode_id=12, number=2, watch_id="w-pass-2", **{"pass": 2})
        someone_else = watch(user="ben", episode_id=12, number=2)
        crate = WatchTables(user_watch_state=[press()], user_watch_log=[own, other_pass, someone_else],
                            show=[show(1399)], episode=GAME_OF_THRONES)

        fill(crate)

        self.assertEqual([row["watch_id"] for row in crate.rows("user_watch_log", origin="seen")],
                         ["g-0193f6a3-11aa-12"])

    def test_a_press_with_nothing_aired_by_its_day_is_counted_and_gets_nothing(self):
        crate = WatchTables(user_watch_state=[press(changed=at(2025, 2, 20))], show=[show(1399)],
                            episode=GAME_OF_THRONES)

        result = fill(crate)

        self.assertEqual(crate.rows("user_watch_log"), [])
        self.assertEqual(result["presses with nothing left to add"], 1)

    def test_one_member_can_be_filled_alone(self):
        crate = WatchTables(user_watch_state=[press(), press(user="ben")], show=[show(1399)], episode=GAME_OF_THRONES)

        fill(crate, user_id="ben")

        self.assertEqual({row["user_id"] for row in crate.rows("user_watch_log")}, {"ben"})

    def test_a_long_show_is_written_in_batches_of_500(self):
        episodes = [episode(1399, 1000 + n, 1, n, at(2020, 1, 1)) for n in range(1, 1202)]
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=episodes)

        result = fill(crate)

        self.assertEqual(crate.bulk_sizes, [500, 500, 201])
        self.assertEqual(result["inserted"], 1201)


class MainArgumentTests(unittest.TestCase):
    """Windmill passes None for every argument the caller leaves out."""

    def run_main(self, *args, **kwargs):
        crate = WatchTables(user_watch_state=[press()], show=[show(1399)], episode=GAME_OF_THRONES)
        crate.disconnect = lambda: None
        with patch.object(fill_seen_groups, "CrateConnector", return_value=crate):
            result = fill_seen_groups.main(*args, **kwargs)
        return crate, result

    def test_a_missing_dry_run_is_a_dry_run(self):
        for arguments in ({}, {"dry_run": None, "user_id": None}):
            crate, result = self.run_main(**arguments)
            self.assertEqual((result["dry_run"], crate.rows("user_watch_log")), (True, []))

    def test_only_an_explicit_false_writes(self):
        crate, result = self.run_main(dry_run=False)

        self.assertEqual((result["dry_run"], len(crate.rows("user_watch_log"))), (False, 2))


if __name__ == "__main__":
    unittest.main()
