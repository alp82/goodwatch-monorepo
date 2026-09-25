"""The IMDb dataset diff: which stored values a daily run writes, skips, marks missing or clears,
and how it aggregates episode ratings into season scores. Runs on in-memory DuckDB, no services."""
import sys
import unittest
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.imdb_datasets import diff

RUN_DATE = "2026-09-25"


def database(ratings=(), episodes=(), names=(), stored_titles=(), details=(), stored_episodes=(), stored_seasons=()):
    """An in-memory DuckDB with the diff's input tables filled from tuples in column order."""
    db = duckdb.connect()
    diff.create_input_tables(db)
    rows = {
        "ds_ratings": ratings,
        "ds_episodes": episodes,
        "ds_names": names,
        "stored_titles": stored_titles,
        "details_delta": details,
        "stored_episodes": stored_episodes,
        "stored_seasons": stored_seasons,
    }
    for table, values in rows.items():
        for row in values:
            db.execute(f"INSERT INTO {table} VALUES ({', '.join('?' * len(row))})", list(row))
    diff.build_title_map(db)
    return db


def stored(tmdb_id, imdb_id, rating, votes, source="imdb_dataset", missing_since=None, kind="movie"):
    return (kind, tmdb_id, imdb_id, rating, votes, source, missing_since)


def title_changes(db):
    diff.diff_titles(db, RUN_DATE)
    return {
        row[0]: {"change": row[1], "material": row[2], "rating": row[3], "votes": row[4], "imdb_id": row[5]}
        for row in db.execute("SELECT tmdb_id, change, material, rating, votes, imdb_id FROM title_changes").fetchall()
    }


class TitleDiffTests(unittest.TestCase):
    def test_unchanged_values_are_not_written(self):
        db = database(ratings=[("tt1", 8.1, 1000)], stored_titles=[stored(1, "tt1", 8.1, 1000)])
        self.assertEqual(title_changes(db)[1]["change"], "unchanged")
        self.assertEqual(diff.title_writes(db), [])

    def test_a_changed_rating_is_written(self):
        db = database(ratings=[("tt1", 8.2, 1000)], stored_titles=[stored(1, "tt1", 8.1, 1000)])
        change = title_changes(db)[1]
        self.assertEqual((change["change"], change["material"]), ("rating_changed", True))

    def test_votes_are_written_once_they_move_one_percent_from_the_stored_value(self):
        db = database(
            ratings=[("tt1", 8.1, 1009), ("tt2", 8.1, 1010), ("tt3", 8.1, 99)],
            stored_titles=[stored(1, "tt1", 8.1, 1000), stored(2, "tt2", 8.1, 1000), stored(3, "tt3", 8.1, 100)],
        )
        changes = title_changes(db)
        self.assertEqual(changes[1]["change"], "below_threshold")
        self.assertEqual(changes[2]["change"], "votes_changed")
        # Small titles still move on a single vote.
        self.assertEqual(changes[3]["change"], "votes_changed")
        self.assertEqual(sorted(write[0] for write in diff.title_writes(db)), [2, 3])

    def test_scraped_values_are_replaced_and_inflated_votes_count_as_material(self):
        db = database(
            ratings=[("tt0903747", 9.5, 2680743), ("tt2", 7.0, 5000)],
            stored_titles=[
                stored(1396, "tt0903747", 9.5, 25000000, source=None, kind="tv"),
                stored(2, "tt2", 7.0, 5010, source=None),
            ],
        )
        changes = title_changes(db)
        self.assertEqual((changes[1396]["change"], changes[1396]["material"]), ("replace_scraped", True))
        self.assertEqual(changes[1396]["votes"], 2680743)
        # Same values as the scrape: rewritten with the source, but not a material change.
        self.assertEqual((changes[2]["change"], changes[2]["material"]), ("replace_scraped", False))

    def test_a_title_without_a_stored_score_is_new(self):
        db = database(
            ratings=[("tt5", 6.5, 40)],
            stored_titles=[stored(5, "tt5", None, None, source=None)],
            details=[("movie", 6, "tt5", False)],
        )
        changes = title_changes(db)
        self.assertEqual((changes[5]["change"], changes[5]["material"]), ("new", True))
        # TMDB links a second title to the same IMDb id; it has no stored document yet.
        self.assertEqual((changes[6]["change"], changes[6]["material"]), ("new", True))

    def test_a_title_missing_from_the_file_keeps_its_value_and_is_marked(self):
        db = database(ratings=[], stored_titles=[stored(1, "tt1", 7.7, 300)])
        self.assertEqual(title_changes(db)[1]["change"], "gone")
        self.assertEqual(diff.missing_marks(db), [("movie", 1)])
        self.assertEqual(diff.title_writes(db), [])

    def test_a_marked_title_is_cleared_only_after_the_grace_period(self):
        db = database(ratings=[], stored_titles=[
            stored(1, "tt1", 7.7, 300, missing_since="2026-09-01"),
            stored(2, "tt2", 7.7, 300, missing_since="2026-08-26"),
            stored(3, "tt3", 7.7, 300, missing_since="2026-08-01"),
        ])
        changes = title_changes(db)
        self.assertEqual(changes[1]["change"], "missing")
        self.assertEqual(changes[2]["change"], "expired")
        self.assertEqual(changes[3]["change"], "expired")
        self.assertEqual(diff.expired_titles(db), [("movie", 2), ("movie", 3)])
        self.assertEqual(diff.missing_marks(db), [])

    def test_a_title_back_in_the_file_is_written_and_unmarked(self):
        db = database(ratings=[("tt1", 7.7, 300)], stored_titles=[stored(1, "tt1", 7.7, 300, missing_since="2026-09-20")])
        change = title_changes(db)[1]
        self.assertEqual((change["change"], change["material"]), ("back", False))
        self.assertEqual([write[0] for write in diff.title_writes(db)], [1])

    def test_a_cleared_title_is_left_alone(self):
        db = database(ratings=[], stored_titles=[stored(1, "tt1", None, None, missing_since="2026-08-01")])
        self.assertEqual(title_changes(db)[1]["change"], "none")

    def test_a_tmdb_relink_rewrites_the_title_with_the_new_ids_rating(self):
        db = database(
            ratings=[("tt1", 7.0, 100), ("tt9", 8.8, 900)],
            stored_titles=[stored(1, "tt1", 7.0, 100)],
            details=[("movie", 1, "tt9", False)],
        )
        change = title_changes(db)[1]
        self.assertEqual((change["change"], change["material"], change["imdb_id"], change["rating"]), ("remapped", True, "tt9", 8.8))

    def test_titles_deleted_on_tmdb_leave_the_map(self):
        db = database(
            ratings=[("tt1", 7.0, 100)],
            stored_titles=[stored(1, "tt1", 6.0, 100)],
            details=[("movie", 1, "tt1", True)],
        )
        self.assertEqual(db.execute("SELECT count(*) FROM title_map").fetchone()[0], 0)

    def test_invalid_ids_do_not_replace_a_stored_link(self):
        db = database(
            ratings=[("tt1", 7.0, 100)],
            stored_titles=[stored(1, "tt1", 7.0, 100)],
            details=[("movie", 1, "", False), ("movie", 2, "None", False)],
        )
        self.assertEqual(db.execute("SELECT tmdb_id, imdb_id FROM title_map").fetchall(), [(1, "tt1")])
        self.assertEqual(diff.link_changes(db), {"new": 0, "relinked": 0})

    def test_link_changes_tell_first_links_from_relinks(self):
        db = database(
            stored_titles=[stored(1, "tt1", 7.0, 100), stored(2, "tt2", 7.0, 100), stored(3, None, None, None)],
            details=[("movie", 1, "tt1", False), ("movie", 2, "tt3", False), ("tv", 7, "tt7", False),
                     ("movie", 3, "tt4", False)],
        )
        # Title 2 moved to another IMDb id; titles 3 and 7 got their first one.
        self.assertEqual(diff.link_changes(db), {"new": 2, "relinked": 1})

    def test_links_without_a_rating_write_are_stored_on_their_own(self):
        db = database(
            ratings=[("tt2", 7.0, 50)],
            stored_titles=[stored(1, "tt1", 7.0, 100)],
            details=[("movie", 1, "tt9", False), ("movie", 2, "tt2", False), ("tv", 3, "tt3", False)],
        )
        diff.diff_titles(db, RUN_DATE)
        # Title 2 is stored by its rating write; titles 1 and 3 have no rating in the file.
        self.assertEqual(diff.mapping_writes(db), [("movie", 1, "tt9"), ("tv", 3, "tt3")])

    def test_a_forced_rerun_after_the_writes_writes_nothing(self):
        db = database(
            ratings=[("tt1", 8.2, 1000), ("tt2", 7.0, 50)],
            stored_titles=[stored(1, "tt1", 8.1, 1000, source=None)],
            details=[("movie", 2, "tt2", False)],
        )
        diff.diff_titles(db, RUN_DATE)
        writes = diff.title_writes(db)
        rerun = database(
            ratings=[("tt1", 8.2, 1000), ("tt2", 7.0, 50)],
            stored_titles=[stored(tmdb_id, imdb_id, rating, votes, kind=kind) for tmdb_id, kind, imdb_id, rating, votes, _ in writes],
        )
        diff.diff_titles(rerun, RUN_DATE)
        self.assertEqual(diff.title_writes(rerun), [])


def episode(tconst, show, season, number):
    return (tconst, show, season, number)


def stored_episode(tconst, show, season, number, rating, votes, name=None):
    return (tconst, show, season, number, rating, votes, name)


class EpisodeDiffTests(unittest.TestCase):
    def changes(self, db):
        diff.diff_episodes(db)
        return {row[0]: row[1] for row in db.execute("SELECT tconst, change FROM episode_changes").fetchall()}

    def test_episode_changes_are_keyed_by_the_episode_id(self):
        db = database(
            ratings=[("tt10", 9.0, 500), ("tt11", 8.0, 400), ("tt12", 7.0, 300), ("tt13", 7.5, 200), ("tt14", 6.0, 100), ("tt15", 6.0, 100)],
            episodes=[
                episode("tt10", "tt1", 1, 1),  # unchanged
                episode("tt11", "tt1", 1, 3),  # moved inside the show
                episode("tt12", "tt2", 1, 1),  # moved to another show
                episode("tt13", "tt1", 2, 1),  # new
                episode("tt14", "tt1", 2, 2),  # rating changed
                episode("tt15", "tt1", None, None),  # a special, unchanged
            ],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv"), stored(2, "tt2", 8.0, 1000, kind="tv")],
            stored_episodes=[
                stored_episode("tt10", "tt1", 1, 1, 9.0, 500),
                stored_episode("tt11", "tt1", 1, 2, 8.0, 400),
                stored_episode("tt12", "tt1", 1, 4, 7.0, 300),
                stored_episode("tt14", "tt1", 2, 2, 6.5, 100),
                stored_episode("tt15", "tt1", None, None, 6.0, 100),
                stored_episode("tt16", "tt1", 1, 5, 7.0, 100),  # removed from the file
            ],
        )
        self.assertEqual(self.changes(db), {
            "tt10": "unchanged", "tt11": "moved", "tt12": "moved_show", "tt13": "new",
            "tt14": "rating_changed", "tt15": "unchanged", "tt16": "removed",
        })
        self.assertEqual(sorted(write[0] for write in diff.episode_writes(db)), ["tt11", "tt12", "tt13", "tt14"])
        self.assertEqual(diff.episode_deletes(db), ["tt16"])
        self.assertEqual(sorted(row[0] for row in db.execute("SELECT show_tconst FROM touched_shows").fetchall()), ["tt1", "tt2"])

    def test_episodes_of_unmapped_shows_are_removed(self):
        db = database(
            ratings=[("tt10", 9.0, 500)],
            episodes=[episode("tt10", "tt1", 1, 1)],
            stored_episodes=[stored_episode("tt10", "tt1", 1, 1, 9.0, 500)],
        )
        # tt1 is in no TMDB show's map: the loader filters the file to mapped shows.
        db.execute("DELETE FROM ds_episodes WHERE show_tconst NOT IN (SELECT imdb_id FROM title_map)")
        self.assertEqual(self.changes(db), {"tt10": "removed"})

    def test_episode_names_come_from_the_weekly_titles_and_are_kept_between(self):
        base = dict(
            ratings=[("tt10", 9.0, 500), ("tt11", 8.0, 400)],
            episodes=[episode("tt10", "tt1", 1, 1), episode("tt11", "tt1", 1, 2)],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")],
            stored_episodes=[stored_episode("tt10", "tt1", 1, 1, 9.0, 500, "Pilot"), stored_episode("tt11", "tt1", 1, 2, 8.0, 400, "Old")],
        )
        daily = database(**base)
        self.assertEqual(self.changes(daily), {"tt10": "unchanged", "tt11": "unchanged"})
        weekly = database(**base, names=[("tt10", "Pilot"), ("tt11", "Cat's in the Bag...")])
        self.assertEqual(self.changes(weekly), {"tt10": "unchanged", "tt11": "renamed"})
        self.assertEqual([(w[0], w[6]) for w in diff.episode_writes(weekly)], [("tt11", "Cat's in the Bag...")])

    def test_a_forced_rerun_after_the_writes_writes_nothing(self):
        inputs = dict(
            ratings=[("tt10", 9.0, 500), ("tt11", 8.0, 400)],
            episodes=[episode("tt10", "tt1", 1, 1), episode("tt11", "tt1", None, None)],
            names=[("tt10", "Pilot")],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")],
        )
        db = database(**inputs)
        diff.diff_episodes(db)
        diff.diff_seasons(db)
        rerun = database(
            **inputs,
            stored_episodes=diff.episode_writes(db),
            stored_seasons=diff.season_writes(db),
        )
        diff.diff_episodes(rerun)
        diff.diff_seasons(rerun)
        self.assertEqual((diff.episode_writes(rerun), diff.episode_deletes(rerun)), ([], []))
        self.assertEqual((diff.season_writes(rerun), diff.season_deletes(rerun)), ([], []))


class SeasonAggregationTests(unittest.TestCase):
    def seasons(self, db):
        diff.diff_episodes(db)
        diff.diff_seasons(db)
        return {
            (row[0], row[1]): row[2:]
            for row in db.execute(
                "SELECT show_tconst, season, rating, votes, rated_episodes, max_episode FROM all_seasons"
            ).fetchall()
        }

    def test_season_scores_are_vote_weighted_and_leave_out_specials(self):
        db = database(
            ratings=[("tt10", 9.0, 300), ("tt11", 8.0, 100), ("tt12", 7.0, 50), ("tt13", 1.0, 100000)],
            episodes=[
                episode("tt10", "tt1", 1, 1),
                episode("tt11", "tt1", 1, 3),
                episode("tt12", "tt1", 2, 1),
                episode("tt13", "tt1", None, None),  # a special: its own grid row, not in any season score
            ],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")],
        )
        self.assertEqual(self.seasons(db), {
            ("tt1", 1): (8.75, 400, 2, 3),
            ("tt1", 2): (7.0, 50, 1, 1),
        })

    def test_season_scores_round_exact_halves_up_every_time(self):
        # (6.0 x 1 + 8.1 x 3) / 4 = 7.575 exactly, but 7.57499... as a float. Float sums also
        # land on either side of a half depending on the summation order, which flipped
        # stored seasons from run to run.
        episodes = [episode("tt10", "tt1", 1, 1), episode("tt11", "tt1", 1, 2)]
        ratings = [("tt10", 6.0, 1), ("tt11", 8.1, 3)]
        db = database(ratings=ratings, episodes=episodes, stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")])
        self.assertEqual(self.seasons(db)[("tt1", 1)], (7.58, 4, 2, 2))

    def test_breaking_bad_style_numbers(self):
        # Two episodes with IMDb's real Ozymandias and Felina figures round to the expected mean.
        db = database(
            ratings=[("tt2301451", 10.0, 250000), ("tt2301455", 9.9, 170000)],
            episodes=[episode("tt2301451", "tt0903747", 5, 14), episode("tt2301455", "tt0903747", 5, 16)],
            stored_titles=[stored(1396, "tt0903747", 9.5, 2680743, kind="tv")],
        )
        self.assertEqual(self.seasons(db)[("tt0903747", 5)], (9.96, 420000, 2, 16))

    def test_seasons_follow_the_episode_writes_and_disappear_with_their_episodes(self):
        db = database(
            ratings=[("tt10", 9.0, 300)],
            episodes=[episode("tt10", "tt1", 1, 1)],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")],
            stored_episodes=[stored_episode("tt10", "tt1", 1, 1, 9.0, 300), stored_episode("tt11", "tt1", 2, 1, 7.0, 10)],
            stored_seasons=[("tt1", 1, 9.0, 300, 1, 1), ("tt1", 2, 7.0, 10, 1, 1)],
        )
        self.seasons(db)
        self.assertEqual(diff.season_writes(db), [])
        self.assertEqual(diff.season_deletes(db), [("tt1", 2)])

    def test_votes_below_the_threshold_do_not_move_the_season(self):
        db = database(
            ratings=[("tt10", 9.0, 1005)],
            episodes=[episode("tt10", "tt1", 1, 1)],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv")],
            stored_episodes=[stored_episode("tt10", "tt1", 1, 1, 9.0, 1000)],
            stored_seasons=[("tt1", 1, 9.0, 1000, 1, 1)],
        )
        self.assertEqual(self.seasons(db)[("tt1", 1)], (9.0, 1000, 1, 1))
        self.assertEqual(diff.season_writes(db), [])


class CrateRowTests(unittest.TestCase):
    def test_episodes_and_seasons_fan_out_to_every_tmdb_show_of_the_imdb_id(self):
        db = database(
            ratings=[("tt10", 9.0, 300), ("tt11", 8.0, 100)],
            episodes=[episode("tt10", "tt1", 1, 1), episode("tt11", "tt1", None, None)],
            names=[("tt10", "Pilot")],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv"), stored(2, "tt1", 8.0, 1000, kind="tv")],
        )
        diff.diff_episodes(db)
        diff.diff_seasons(db)
        episodes = diff.crate_episode_rows(db, [1, 2])
        self.assertEqual(sorted((row["show_id"], row["imdb_episode_id"], row["season_number"]) for row in episodes),
                         [(1, "tt10", 1), (1, "tt11", None), (2, "tt10", 1), (2, "tt11", None)])
        self.assertEqual(next(row for row in episodes if row["imdb_episode_id"] == "tt10")["name"], "Pilot")
        seasons = diff.crate_season_rows(db, [2])
        self.assertEqual(seasons, [{
            "show_id": 2, "season_number": 1, "imdb_show_id": "tt1", "imdb_user_score_original": 9.0,
            "imdb_user_score_rating_count": 300, "imdb_rated_episode_count": 1, "max_episode_number": 1,
        }])

    def test_crate_shows_to_sync_cover_changed_episodes_and_relinked_shows(self):
        db = database(
            ratings=[("tt10", 9.0, 300), ("tt20", 8.0, 100)],
            episodes=[episode("tt10", "tt1", 1, 1), episode("tt20", "tt2", 1, 1)],
            stored_titles=[stored(1, "tt1", 8.0, 1000, kind="tv"), stored(3, "tt2", 8.0, 1000, kind="tv"), stored(4, "tt3", 8.0, 1000, kind="tv")],
            details=[("tv", 4, "tt2", False)],
            stored_episodes=[stored_episode("tt20", "tt2", 1, 1, 8.0, 100)],
            stored_seasons=[("tt2", 1, 8.0, 100, 1, 1)],
        )
        diff.diff_episodes(db)
        diff.diff_seasons(db)
        # Show 1 has a new episode, show 4 was relinked to tt2, show 3 is unchanged.
        self.assertEqual(diff.crate_shows_to_sync(db), [1, 4])


class SkipTests(unittest.TestCase):
    def test_a_run_skips_only_when_nothing_changed(self):
        etags = {"title.ratings.tsv.gz": '"a"', "title.episode.tsv.gz": '"b"'}
        self.assertTrue(diff.should_skip(etags, dict(etags), relinked=0, pending_shows=0))
        self.assertFalse(diff.should_skip(etags, etags | {"title.ratings.tsv.gz": '"c"'}, relinked=0, pending_shows=0))
        self.assertFalse(diff.should_skip(etags, etags | {"title.episode.tsv.gz": '"c"'}, relinked=0, pending_shows=0))
        self.assertFalse(diff.should_skip(etags, dict(etags), relinked=1, pending_shows=0))
        self.assertFalse(diff.should_skip(etags, dict(etags), relinked=0, pending_shows=3))
        self.assertFalse(diff.should_skip({}, dict(etags), relinked=0, pending_shows=0))
        self.assertFalse(diff.should_skip(etags, {"title.ratings.tsv.gz": None, "title.episode.tsv.gz": None}, 0, 0))


if __name__ == "__main__":
    unittest.main()
