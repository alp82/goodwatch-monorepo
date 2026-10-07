"""The copy of fetched episodes into the Crate episode table."""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

with patch("wmill.get_variable", return_value="unused"):
    from f.sync.copy import tmdb_episodes
    from f.tmdb_api.tmdb_fetch_episodes_from_api import fetch
    from f.tmdb_api.tmdb_fetch_episodes_from_api import next as next_shows

NOW = datetime(2026, 10, 6, 9, 30)
FETCHED_AT = NOW - timedelta(minutes=5)


def millis(moment: datetime) -> int:
    return int(moment.replace(tzinfo=timezone.utc).timestamp() * 1000)


class EpisodeTable:
    """A fake Crate connector holding the episode table and what the copy writes on the show rows."""

    def __init__(self, rows=()):
        self.rows = {(row["show_id"], row["tmdb_id"]): dict(row) for row in rows}
        self.checked_shows = {}
        # show.aired_episode_count; a show the copy never wrote has no entry, which is NULL in Crate.
        self.aired_counts = {}
        self.selected_show_ids = []
        self.upserted = 0
        self.cur = MagicMock(rowcount=0)

    def select(self, sql, params=None):
        assert sql.startswith("SELECT ") and sql.endswith(" FROM episode WHERE show_id = ANY(?)"), sql
        (show_ids,) = params
        self.selected_show_ids.append(sorted(show_ids))
        return [dict(row) for row in self.rows.values() if row["show_id"] in show_ids]

    def upsert_many(self, table, records, conflict_columns, **kwargs):
        assert table == "episode" and conflict_columns == ["show_id", "tmdb_id"], (table, conflict_columns)
        # The copy owns its columns, so a NULL must clear the stored value.
        assert kwargs.get("replace_nulls") is True, kwargs
        for record in records:
            values = record.model_dump()
            key = (values["show_id"], values["tmdb_id"])
            self.rows[key] = self.rows.get(key, {}) | values
        self.upserted += len(records)
        return {"records_received": len(records), "rows_upserted": len(records)}

    def run_many(self, sql, params):
        if sql == "UPDATE episode SET removed_at = ?, updated_at = ? WHERE show_id = ? AND tmdb_id = ANY(?)":
            for removed_at, _, show_id, episode_ids in params:
                for episode_id in episode_ids:
                    self.rows[(show_id, episode_id)]["removed_at"] = removed_at
        elif sql == "UPDATE show SET episodes_updated_at = ?, aired_episode_count = ? WHERE tmdb_id = ?":
            self.checked_shows.update({show_id: checked_at for checked_at, _, show_id in params})
            self.aired_counts.update({show_id: count for _, count, show_id in params})
        else:
            raise AssertionError(sql)

    def run(self, sql, params=None):
        assert sql == "DELETE FROM episode WHERE removed_at < ?", sql
        (cutoff,) = params
        purged = [key for key, row in self.rows.items() if row.get("removed_at") is not None and row["removed_at"] < cutoff]
        for key in purged:
            del self.rows[key]
        self.cur.rowcount = len(purged)

    def episodes_of(self, show_id, live_only=True):
        return sorted(
            (row["season_number"], row["episode_number"], row["tmdb_id"])
            for row in self.rows.values()
            if row["show_id"] == show_id and not (live_only and row.get("removed_at") is not None)
        )


def tmdb_episode(episode_id, number, **fields):
    return {"id": episode_id, "episode_number": number, "name": f"Episode {number}", "air_date": "2008-01-20",
            "runtime": 47, "still_path": None, "episode_type": "standard", "vote_average": 8.0, "vote_count": 10} | fields


def fetched_show(db, tmdb_id, seasons, complete=True, fetched_at=FETCHED_AT):
    """Store a show as the fetch job leaves it: its state and one document per season."""
    db.tmdb_tv_details.update_one(
        {"tmdb_id": tmdb_id},
        {"$set": {"episodes_updated_at": fetched_at, "episodes_complete": complete}},
        upsert=True,
    )
    db.tmdb_tv_season_details.delete_many({"tmdb_id": tmdb_id})
    for number, episodes in seasons.items():
        db.tmdb_tv_season_details.insert_one({
            "tmdb_id": tmdb_id, "season_number": number, "season_id": tmdb_id * 100 + number,
            "updated_at": fetched_at, "episodes": episodes})


def copy(crate, db, now=NOW, **kwargs):
    return tmdb_episodes.copy_episodes(crate, db, now=now, **kwargs)


class EpisodeCopyTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.crate = EpisodeTable()

    def test_a_fetched_shows_episodes_become_rows(self):
        fetched_show(self.db, 7, {0: [tmdb_episode(50, 1)], 1: [tmdb_episode(51, 1), tmdb_episode(52, 2)]})

        result = copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(7), [(0, 1, 50), (1, 1, 51), (1, 2, 52)])
        row = self.crate.rows[(7, 51)]
        self.assertEqual((row["season_tmdb_id"], row["name"], row["air_date"]), (701, "Episode 1", 1200787200000))
        self.assertEqual((result["shows_copied"], result["episodes_upserted"]), (1, 3))

    def test_the_show_is_marked_with_the_time_its_episodes_were_fetched(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        copy(self.crate, self.db)

        self.assertEqual(self.crate.checked_shows, {7: millis(FETCHED_AT)})

    def test_a_show_without_episodes_gets_no_rows_and_is_still_marked(self):
        fetched_show(self.db, 7, {}, complete=False)

        copy(self.crate, self.db)

        self.assertEqual(self.crate.rows, {})
        self.assertEqual(self.crate.checked_shows, {7: millis(FETCHED_AT)})

    def test_unchanged_episodes_are_not_written_again(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})
        copy(self.crate, self.db)

        result = copy(self.crate, self.db)

        self.assertEqual(result["episodes_upserted"], 0)
        self.assertEqual(self.crate.upserted, 1)

    def test_a_renumbered_episode_keeps_its_row(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})
        copy(self.crate, self.db)
        fetched_show(self.db, 7, {2: [tmdb_episode(51, 4)]})

        copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(7), [(2, 4, 51)])

    def test_an_episode_tmdb_no_longer_lists_is_marked_removed_not_deleted(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1), tmdb_episode(52, 2)]})
        copy(self.crate, self.db)
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        result = copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(7), [(1, 1, 51)])
        self.assertEqual(self.crate.rows[(7, 52)]["removed_at"], millis(NOW))
        self.assertEqual(self.crate.rows[(7, 52)]["name"], "Episode 2")
        self.assertEqual(result["episodes_removed"], 1)

    def test_nothing_is_removed_after_an_incomplete_fetch(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)], 2: [tmdb_episode(61, 1)]})
        copy(self.crate, self.db)
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1), tmdb_episode(53, 3)]}, complete=False)

        result = copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(7), [(1, 1, 51), (1, 3, 53), (2, 1, 61)])
        self.assertEqual(result["episodes_removed"], 0)

    def test_other_shows_are_never_touched(self):
        self.crate = EpisodeTable([{"show_id": 8, "tmdb_id": 99, "season_number": 1, "episode_number": 1}])
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(8), [(1, 1, 99)])

    def test_a_removed_episode_that_comes_back_is_live_again_and_keeps_its_external_ids(self):
        self.crate = EpisodeTable([{"show_id": 7, "tmdb_id": 51, "season_number": 1, "episode_number": 1,
                                    "removed_at": 1790000000000, "imdb_id": "tt0959621"}])
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        copy(self.crate, self.db)

        self.assertIsNone(self.crate.rows[(7, 51)]["removed_at"])
        self.assertEqual(self.crate.rows[(7, 51)]["imdb_id"], "tt0959621")

    def test_the_next_run_copies_only_what_was_fetched_since(self):
        fetched_show(self.db, 1, {1: [tmdb_episode(11, 1)]}, fetched_at=NOW - timedelta(hours=5))
        fetched_show(self.db, 2, {1: [tmdb_episode(21, 1)]}, fetched_at=NOW - timedelta(hours=2))
        self.assertEqual(copy(self.crate, self.db)["shows_copied"], 2)
        fetched_show(self.db, 3, {1: [tmdb_episode(31, 1)]}, fetched_at=NOW - timedelta(hours=1))
        self.crate.selected_show_ids.clear()

        result = copy(self.crate, self.db)

        # Show 2 is read again: the run overlaps the last one, so a late write is not missed.
        self.assertEqual(self.crate.selected_show_ids, [[2, 3]])
        self.assertEqual(result["shows_copied"], 2)
        self.assertEqual(self.crate.episodes_of(3), [(1, 1, 31)])

    def test_a_backlog_is_copied_batch_by_batch(self):
        for show_id in range(1, 8):
            fetched_show(self.db, show_id, {1: [tmdb_episode(show_id * 10, 1)]},
                         fetched_at=NOW - timedelta(minutes=show_id))
        with patch.object(tmdb_episodes, "SHOWS_PER_BATCH", 3):
            result = copy(self.crate, self.db)

        self.assertEqual(result["shows_copied"], 7)
        self.assertTrue(result["caught_up"])
        self.assertEqual(sorted(self.crate.checked_shows), [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(len(self.crate.selected_show_ids), 3)

    def test_shows_fetched_in_the_same_instant_are_all_copied(self):
        for show_id in range(1, 6):
            fetched_show(self.db, show_id, {1: [tmdb_episode(show_id * 10, 1)]})
        with patch.object(tmdb_episodes, "SHOWS_PER_BATCH", 2):
            result = copy(self.crate, self.db)

        self.assertEqual(result["shows_copied"], 5)
        self.assertEqual(sorted(self.crate.checked_shows), [1, 2, 3, 4, 5])

    def test_a_run_out_of_time_stops_and_the_next_run_continues(self):
        for show_id in range(1, 6):
            fetched_show(self.db, show_id, {1: [tmdb_episode(show_id * 10, 1)]},
                         fetched_at=NOW - timedelta(hours=10 - show_id))
        with patch.object(tmdb_episodes, "SHOWS_PER_BATCH", 2):
            first = copy(self.crate, self.db, max_seconds=0)
            second = copy(self.crate, self.db)

        self.assertEqual((first["shows_copied"], first["caught_up"]), (2, False))
        self.assertTrue(second["caught_up"])
        self.assertEqual(sorted(self.crate.checked_shows), [1, 2, 3, 4, 5])

    def test_named_shows_are_copied_whenever_they_were_fetched(self):
        fetched_show(self.db, 1, {1: [tmdb_episode(11, 1)]}, fetched_at=NOW - timedelta(days=20))
        fetched_show(self.db, 2, {1: [tmdb_episode(21, 1)]}, fetched_at=NOW - timedelta(hours=1))
        copy(self.crate, self.db)
        self.crate.rows.clear()

        result = copy(self.crate, self.db, tmdb_ids=[1])

        self.assertEqual(result["shows_copied"], 1)
        self.assertEqual(self.crate.episodes_of(1), [(1, 1, 11)])
        self.assertEqual(self.crate.episodes_of(2), [])

    def test_a_show_whose_episodes_were_never_fetched_is_not_copied(self):
        self.db.tmdb_tv_details.insert_one({"tmdb_id": 9, "title": "Not fetched"})

        self.assertEqual(copy(self.crate, self.db, tmdb_ids=[9])["shows_copied"], 0)
        self.assertEqual(self.crate.checked_shows, {})
        # Its aired_episode_count stays NULL: unknown, not zero.
        self.assertEqual(self.crate.aired_counts, {})

    def test_removed_episodes_are_deleted_after_180_days(self):
        self.crate = EpisodeTable([
            {"show_id": 7, "tmdb_id": 1, "season_number": 1, "episode_number": 1,
             "removed_at": millis(NOW - timedelta(days=181))},
            {"show_id": 7, "tmdb_id": 2, "season_number": 1, "episode_number": 2,
             "removed_at": millis(NOW - timedelta(days=179))},
            {"show_id": 7, "tmdb_id": 3, "season_number": 1, "episode_number": 3, "removed_at": None},
        ])

        result = copy(self.crate, self.db)

        self.assertEqual(self.crate.episodes_of(7, live_only=False), [(1, 2, 2), (1, 3, 3)])
        self.assertEqual(result["episodes_purged"], 1)

    def test_big_shows_are_read_from_crate_in_bounded_groups(self):
        for show_id in range(1, 5):
            fetched_show(self.db, show_id, {1: [tmdb_episode(show_id * 10 + n, n) for n in range(1, 4)]})
        with patch.object(tmdb_episodes, "ROWS_PER_GROUP", 5):
            copy(self.crate, self.db)

        # Three episodes per show: a group closes once it holds at least five rows.
        self.assertEqual(self.crate.selected_show_ids, [[1, 2], [3, 4]])
        self.assertEqual(len(self.crate.rows), 12)


class AiredEpisodeCountTests(unittest.TestCase):
    """show.aired_episode_count, written with every copy of a show. NOW is 2026-10-06."""

    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.crate = EpisodeTable()

    def test_a_copied_show_gets_the_number_of_its_aired_regular_episodes(self):
        fetched_show(self.db, 7, {
            0: [tmdb_episode(50, 1, air_date="2026-09-01")],
            1: [tmdb_episode(51, 1, air_date="2026-09-29"), tmdb_episode(52, 2, air_date="2026-10-06"),
                tmdb_episode(53, 3, air_date="2026-10-07"), tmdb_episode(54, 4, air_date=None)],
        })

        copy(self.crate, self.db)

        # Not the special, not tomorrow's episode, not the one without a date.
        self.assertEqual(self.crate.aired_counts, {7: 2})

    def test_today_is_the_utc_date_of_the_run(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1, air_date="2026-10-06"),
                                      tmdb_episode(52, 2, air_date="2026-10-07")]},
                     fetched_at=datetime(2026, 10, 6, 23, 50))

        copy(self.crate, self.db, now=datetime(2026, 10, 6, 23, 59))
        self.assertEqual(self.crate.aired_counts, {7: 1})

        copy(self.crate, self.db, now=datetime(2026, 10, 7, 0, 1))
        self.assertEqual(self.crate.aired_counts, {7: 2})

    def test_a_crawled_show_with_no_aired_regular_episode_counts_zero(self):
        fetched_show(self.db, 7, {0: [tmdb_episode(50, 1)], 1: [tmdb_episode(51, 1, air_date="2026-11-01")]})
        fetched_show(self.db, 8, {}, complete=False)

        copy(self.crate, self.db)

        self.assertEqual(self.crate.aired_counts, {7: 0, 8: 0})

    def test_an_episode_tmdb_removed_no_longer_counts(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1), tmdb_episode(52, 2)]})
        copy(self.crate, self.db)
        self.assertEqual(self.crate.aired_counts, {7: 2})
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        copy(self.crate, self.db)
        self.assertEqual(self.crate.aired_counts, {7: 1})

        # The removed row is still stored and still does not count on the next copy.
        copy(self.crate, self.db)
        self.assertEqual(self.crate.aired_counts, {7: 1})

    def test_after_an_incomplete_fetch_the_episodes_kept_in_crate_still_count(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)], 2: [tmdb_episode(61, 1)]})
        copy(self.crate, self.db)
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1), tmdb_episode(53, 3)]}, complete=False)

        copy(self.crate, self.db)

        self.assertEqual(self.crate.aired_counts, {7: 3})

    def test_a_removed_episode_that_comes_back_counts_again(self):
        self.crate = EpisodeTable([{"show_id": 7, "tmdb_id": 51, "season_number": 1, "episode_number": 1,
                                    "air_date": 1200787200000, "removed_at": 1790000000000}])
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]})

        copy(self.crate, self.db)

        self.assertEqual(self.crate.aired_counts, {7: 1})

    def test_a_named_show_gets_its_count_too(self):
        fetched_show(self.db, 7, {1: [tmdb_episode(51, 1)]}, fetched_at=NOW - timedelta(days=20))

        copy(self.crate, self.db, tmdb_ids=[7])

        self.assertEqual(self.crate.aired_counts, {7: 1})


class AiredEpisodeCountFreshnessTests(unittest.TestCase):
    """The count moves with the calendar, so it is only as fresh as the show's last fetch and copy.

    These run the real queue, fetch and copy against a TMDB that changes nothing. Another
    show is fetched in every run, as in production, so the copy's checkpoint moves on and
    the show under test is copied only when it was fetched again.
    """

    SHOW = 7
    OTHER_SHOW = 99

    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.db.tmdb_tv_details.insert_one(
            {"tmdb_id": self.SHOW, "title": "Weekly show", "seasons": [{"id": 701, "season_number": 1}]})
        # The other show is written by hand in every run and never handed out by the queue.
        self.db.tmdb_tv_details.insert_one({"tmdb_id": self.OTHER_SHOW, "episodes_due_at": datetime(2100, 1, 1)})
        self.crate = EpisodeTable()
        self.tmdb_requests = 0

    def tmdb(self, tmdb_id, season_numbers):
        """TMDB lists the same three episodes on every request: one aired, one on 2026-10-07, one a week later."""
        self.tmdb_requests += 1
        return {"id": tmdb_id, "seasons": [{"id": 701, "season_number": 1}], "season/1": {
            "name": "Season 1", "season_number": 1, "episodes": [
                tmdb_episode(51, 1, air_date="2026-09-30"),
                tmdb_episode(52, 2, air_date="2026-10-07"),
                tmdb_episode(53, 3, air_date="2026-10-14"),
            ]}}

    def run_flow_and_copy(self, now):
        """One scheduled run of the fetch flow and of the copy. Returns the shows the queue handed out."""
        due = next_shows.reserve_due_shows(self.db.tmdb_tv_details, 500, now)
        fetch.fetch_episodes(self.db, due, get=self.tmdb, now=lambda: now)
        fetched_show(self.db, self.OTHER_SHOW, {}, fetched_at=now)
        self.crate.selected_show_ids.clear()
        copy(self.crate, self.db, now=now + timedelta(minutes=1))
        return due

    def copied_shows(self):
        """The shows the last copy compared with Crate."""
        return {show_id for group in self.crate.selected_show_ids for show_id in group}

    def count(self):
        return self.crate.aired_counts[self.SHOW]

    def test_an_episode_airing_today_is_counted_on_the_day_it_airs(self):
        day_before = datetime(2026, 10, 6, 9, 30)
        self.assertEqual(self.run_flow_and_copy(day_before), [self.SHOW])
        self.assertEqual(self.count(), 1)

        # Until the show is fetched again the copy passes it by, on the air date too: the
        # count is a day old. (The run right after a fetch reads it once more, as an overlap.)
        self.run_flow_and_copy(datetime(2026, 10, 6, 10, 0))
        self.assertEqual(self.run_flow_and_copy(datetime(2026, 10, 7, 9, 25)), [])
        self.assertEqual(self.copied_shows(), {self.OTHER_SHOW})
        self.assertEqual(self.count(), 1)

        # A day after its last fetch the show is due again. TMDB changed nothing and no episode
        # row is written, and the count is still brought up to date.
        self.crate.upserted = 0
        self.assertEqual(self.run_flow_and_copy(datetime(2026, 10, 7, 9, 35)), [self.SHOW])
        self.assertEqual(self.crate.upserted, 0)
        self.assertEqual(self.count(), 2)

    def test_a_fetch_that_runs_late_counts_the_episode_just_after_the_day_it_airs(self):
        # The last fetch before the air date ran late in the evening.
        self.run_flow_and_copy(datetime(2026, 10, 6, 23, 40))
        self.run_flow_and_copy(datetime(2026, 10, 6, 23, 58))
        self.assertEqual(self.count(), 1)

        # The show is due at 23:40 on the air date, and the queue is 25 minutes behind.
        self.assertEqual(self.run_flow_and_copy(datetime(2026, 10, 7, 23, 39)), [])
        self.assertEqual(self.copied_shows(), {self.OTHER_SHOW})
        self.assertEqual(self.count(), 1)

        self.assertEqual(self.run_flow_and_copy(datetime(2026, 10, 8, 0, 5)), [self.SHOW])
        self.assertEqual(self.count(), 2)

    def test_a_show_keeps_being_counted_daily_from_a_week_before_an_episode_until_two_weeks_after(self):
        # Fetched 20 days before its only upcoming episode, the show waits until a week before it.
        self.tmdb = lambda tmdb_id, season_numbers: {
            "id": tmdb_id, "seasons": [{"id": 701, "season_number": 1}], "season/1": {
                "name": "Season 1", "season_number": 1, "episodes": [tmdb_episode(51, 1, air_date="2026-10-26")]}}
        now = datetime(2026, 10, 6, 9, 30)
        self.run_flow_and_copy(now)
        fetched_on = []
        while now < datetime(2026, 11, 20):
            now += timedelta(minutes=30)
            if self.run_flow_and_copy(now):
                fetched_on.append(now.date())
                expected = 1 if now.date() >= datetime(2026, 10, 26).date() else 0
                self.assertEqual(self.count(), expected, now)

        days = [(day - datetime(2026, 10, 26).date()).days for day in fetched_on]
        # Every day from 7 days before the episode to 14 days after it, then the 30-day cycle.
        self.assertEqual(days[:22], list(range(-7, 15)))
        self.assertEqual(self.count(), 1)


class EpisodeSchemaTests(unittest.TestCase):
    def test_the_table_is_keyed_by_show_and_episode_id_and_routed_by_show(self):
        from f.sync.init.cratedb import create_table_sql
        from f.sync.models.crate_schemas import SCHEMAS

        sql = create_table_sql("episode", SCHEMAS["episode"])

        self.assertIn("PRIMARY KEY (show_id, tmdb_id)", sql)
        self.assertTrue(sql.endswith("CLUSTERED BY (show_id) INTO 6 SHARDS"), sql)

    def test_every_column_the_copy_writes_or_reads_exists(self):
        from f.sync.models.crate_models import Episode
        from f.sync.models.crate_schemas import SCHEMAS

        columns = set(SCHEMAS["episode"]["columns"])
        self.assertLessEqual(set(Episode.model_fields), columns)
        self.assertLessEqual(set(tmdb_episodes.STORED_COLUMNS), columns)
        self.assertIn("episodes_updated_at", SCHEMAS["show"]["columns"])
        self.assertEqual(SCHEMAS["show"]["columns"]["aired_episode_count"], "INTEGER")


if __name__ == "__main__":
    unittest.main()
