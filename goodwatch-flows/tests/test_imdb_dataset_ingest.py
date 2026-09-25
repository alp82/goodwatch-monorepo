"""Run the IMDb dataset ingest end to end against local dataset files, an in-memory MongoDB and
a fake Crate: first load, same-day skip, a quiet next day, and a title that leaves the file."""
import gzip
import shutil
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.imdb_datasets import ingest

# pymongo 4.11+ passes `sort` to bulk updates, which mongomock 4.3 does not accept yet.
_add_update = mongomock.collection.BulkOperationBuilder.add_update
mongomock.collection.BulkOperationBuilder.add_update = (
    lambda self, *args, sort=None, **kwargs: _add_update(self, *args, **kwargs))

HEADERS = {
    "title.ratings.tsv.gz": "tconst\taverageRating\tnumVotes",
    "title.episode.tsv.gz": "tconst\tparentTconst\tseasonNumber\tepisodeNumber",
    "title.basics.tsv.gz": "tconst\ttitleType\tprimaryTitle\toriginalTitle\tisAdult\tstartYear\tendYear\truntimeMinutes\tgenres",
}


class FakeCrate:
    def __init__(self):
        self.rows = {"imdb_episode": {}, "imdb_season": {}}
        self.statements = []
        self.cur = MagicMock()
        self.cur.execute.side_effect = lambda sql, params=None: self.statements.append((sql, params))

    def upsert_many(self, *, table, records, conflict_columns, **kwargs):
        for record in records:
            row = record.model_dump()
            self.rows[table][tuple(row[column] for column in conflict_columns)] = row
        return {"records_received": len(records), "rows_upserted": len(records)}

    def disconnect(self):
        pass


class IngestTest(unittest.TestCase):
    def setUp(self):
        self.files = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.files)
        self.etags = {}
        self.db = mongomock.MongoClient().goodwatch
        self.crate = FakeCrate()
        now = datetime(2026, 9, 25)
        self.db.tmdb_tv_details.insert_many([
            {"tmdb_id": 1396, "external_ids": {"imdb_id": "tt0903747"}, "updated_at": now},
            {"tmdb_id": 2000, "external_ids": {}, "updated_at": now},
        ])
        self.db.tmdb_movie_details.insert_many([
            {"tmdb_id": 603, "imdb_id": "tt0133093", "updated_at": now},
            {"tmdb_id": 604, "imdb_id": "tt0234215", "updated_at": now},
        ])
        self.db.imdb_tv_rating.insert_one({
            "tmdb_id": 1396, "imdb_id": "tt0903747", "user_score_original": 9.5,
            "user_score_normalized_percent": 95.0, "user_score_vote_count": 25000000,
            "updated_at": datetime(2026, 8, 16), "failed_at": datetime(2026, 9, 12), "error_message": "IMDb HTTP 202",
        })
        self.db.imdb_movie_rating.insert_one({
            "tmdb_id": 603, "imdb_id": "tt0133093", "user_score_original": 8.7,
            "user_score_vote_count": 2200000, "updated_at": datetime(2026, 8, 16),
        })
        patches = [
            patch.object(ingest, "init_mongodb"),
            patch.object(ingest, "close_mongodb"),
            patch.object(ingest, "get_db", return_value=self.db),
            patch.object(ingest, "CrateConnector", return_value=self.crate),
            patch.object(ingest, "head", side_effect=self.head),
            patch.object(ingest, "download", side_effect=self.download),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def publish(self, name, rows, etag):
        with gzip.open(self.files / name, "wt") as file:
            file.write("\n".join([HEADERS[name]] + ["\t".join(row) for row in rows]) + "\n")
        self.etags[name] = etag

    def head(self, name):
        return {"etag": self.etags[name], "last_modified": "Fri, 25 Sep 2026 00:41:00 GMT",
                "run_date": "2026-09-25", "size": 1}

    def download(self, name, directory):
        path = Path(directory) / name
        shutil.copyfile(self.files / name, path)
        return str(path)

    def publish_day_one(self):
        self.publish("title.ratings.tsv.gz", [
            ("tt0903747", "9.5", "2680743"),
            ("tt0133093", "8.7", "2250000"),
            ("tt0234215", "7.2", "700000"),
            ("tt0959621", "9.0", "30000"),   # S1E1
            ("tt1054724", "8.6", "25000"),   # S1E2
            ("tt1232244", "8.8", "20000"),   # S2E1
            ("tt9999999", "7.0", "500"),     # a special
        ], '"r1"')
        self.publish("title.episode.tsv.gz", [
            ("tt0959621", "tt0903747", "1", "1"),
            ("tt1054724", "tt0903747", "1", "2"),
            ("tt1232244", "tt0903747", "2", "1"),
            ("tt9999999", "tt0903747", "\\N", "\\N"),
            ("tt1111111", "tt0903747", "6", "1"),  # announced, unrated
        ], '"e1"')
        self.publish("title.basics.tsv.gz", [
            ("tt0959621", "tvEpisode", "Pilot", "Pilot", "0", "2008", "\\N", "58", "Drama"),
            ("tt1054724", "tvEpisode", "Cat's in the Bag...", "Cat's in the Bag...", "0", "2008", "\\N", "48", "Drama"),
        ], '"b1"')

    def test_first_load_rewrites_scraped_values_and_fills_episodes_and_seasons(self):
        self.publish_day_one()
        result = ingest.main()

        self.assertEqual(result["outcome"], "ingested")
        show = self.db.imdb_tv_rating.find_one({"tmdb_id": 1396})
        self.assertEqual((show["user_score_original"], show["user_score_vote_count"]), (9.5, 2680743))
        self.assertEqual((show["source"], show["dataset_run_date"]), ("imdb_dataset", "2026-09-25"))
        self.assertIsNone(show["failed_at"])
        self.assertGreater(show["updated_at"], datetime(2026, 9, 1))
        # The Matrix only drifted 2.3 %: rewritten with the source and moved.
        matrix = self.db.imdb_movie_rating.find_one({"tmdb_id": 603})
        self.assertEqual((matrix["user_score_vote_count"], matrix["source"]), (2250000, "imdb_dataset"))
        # A title TMDB links but that had no rating document yet.
        new = self.db.imdb_movie_rating.find_one({"tmdb_id": 604})
        self.assertEqual((new["user_score_original"], new["user_score_normalized_percent"]), (7.2, 72.0))

        episodes = {doc["episode_imdb_id"]: doc for doc in self.db.imdb_tv_episode_rating.find()}
        self.assertEqual(sorted(episodes), ["tt0959621", "tt1054724", "tt1232244", "tt9999999"])
        self.assertEqual(episodes["tt1054724"]["name"], "Cat's in the Bag...")
        self.assertIsNone(episodes["tt9999999"]["season_number"])
        seasons = {doc["season_number"]: doc for doc in self.db.imdb_tv_season_rating.find()}
        self.assertEqual(sorted(seasons), [1, 2])
        self.assertEqual(seasons[1]["user_score_original"], round((9.0 * 30000 + 8.6 * 25000) / 55000, 2))
        self.assertEqual(seasons[1]["user_score_vote_count"], 55000)

        self.assertEqual(sorted(self.crate.rows["imdb_episode"]),
                         [(1396, "tt0959621"), (1396, "tt1054724"), (1396, "tt1232244"), (1396, "tt9999999")])
        self.assertEqual(sorted(self.crate.rows["imdb_season"]), [(1396, 1), (1396, 2)])
        state = self.db.imdb_dataset_state.find_one({"_id": "daily"})
        self.assertEqual(state["crate_pending_show_ids"], [])
        self.assertEqual(state["files"]["title.ratings.tsv.gz"]["etag"], '"r1"')

    def test_a_second_run_with_the_same_files_skips(self):
        self.publish_day_one()
        ingest.main()
        result = ingest.main()
        self.assertEqual(result["outcome"], "skipped")
        self.assertEqual([run["outcome"] for run in self.db.imdb_dataset_runs.find()], ["ingested", "skipped"])

    def test_a_first_link_waits_for_the_next_files_and_is_not_lost(self):
        self.publish_day_one()
        ingest.main()
        self.db.tmdb_tv_details.update_one({"tmdb_id": 2000}, {"$set": {
            "external_ids": {"imdb_id": "tt0903747"}, "updated_at": datetime(2099, 1, 1)}})
        self.assertEqual(ingest.main()["outcome"], "skipped")
        self.publish("title.ratings.tsv.gz", [
            ("tt0903747", "9.5", "2680743"), ("tt0133093", "8.7", "2250000"), ("tt0234215", "7.2", "700000"),
            ("tt0959621", "9.0", "30000"), ("tt1054724", "8.6", "25000"), ("tt1232244", "8.8", "20000"),
            ("tt9999999", "7.0", "500"),
        ], '"r2"')
        result = ingest.main()
        self.assertEqual(result["counts"]["new_links"], 1)
        # The newly linked show gets its own rating and its own copy of the grid.
        self.assertEqual(self.db.imdb_tv_rating.find_one({"tmdb_id": 2000})["user_score_vote_count"], 2680743)
        self.assertIn((2000, "tt0959621"), self.crate.rows["imdb_episode"])

    def test_a_relinked_title_runs_even_with_the_same_files(self):
        self.publish_day_one()
        ingest.main()
        self.db.tmdb_movie_details.update_one({"tmdb_id": 604}, {"$set": {
            "imdb_id": "tt0133093", "updated_at": datetime(2099, 1, 1)}})
        result = ingest.main()
        self.assertEqual(result["outcome"], "ingested")
        self.assertEqual(result["counts"]["relinked"], 1)
        self.assertEqual(self.db.imdb_movie_rating.find_one({"tmdb_id": 604})["user_score_vote_count"], 2250000)

    def test_the_next_day_writes_only_what_moved(self):
        self.publish_day_one()
        ingest.main()
        before = self.db.imdb_movie_rating.find_one({"tmdb_id": 603})["updated_at"]
        self.publish("title.ratings.tsv.gz", [
            ("tt0903747", "9.5", "2681000"),   # +257 votes: below the threshold
            ("tt0133093", "8.7", "2250100"),
            ("tt0234215", "7.3", "700100"),    # rating moved
            ("tt0959621", "9.0", "30000"),
            ("tt1054724", "8.6", "25000"),
            ("tt1232244", "8.8", "20000"),
            ("tt9999999", "7.0", "500"),
        ], '"r2"')
        result = ingest.main()
        self.assertEqual(result["written"]["movie_written"], 1)
        self.assertEqual(result["written"]["tv_written"], 0)
        self.assertEqual(result["written"]["episodes_written"], 0)
        self.assertEqual(self.db.imdb_movie_rating.find_one({"tmdb_id": 603})["updated_at"], before)
        self.assertEqual(self.db.imdb_movie_rating.find_one({"tmdb_id": 604})["user_score_original"], 7.3)

    def test_a_title_missing_from_the_file_is_marked_and_keeps_its_value(self):
        self.publish_day_one()
        ingest.main()
        self.publish("title.ratings.tsv.gz", [
            ("tt0903747", "9.5", "2680743"), ("tt0234215", "7.2", "700000"),
            ("tt0959621", "9.0", "30000"), ("tt1054724", "8.6", "25000"), ("tt1232244", "8.8", "20000"),
            ("tt0000001", "5.7", "2231"), ("tt0000002", "5.5", "300"),  # titles GoodWatch doesn't list
        ], '"r3"')
        result = ingest.main()
        matrix = self.db.imdb_movie_rating.find_one({"tmdb_id": 603})
        self.assertEqual((matrix["dataset_missing_since"], matrix["user_score_original"]), ("2026-09-25", 8.7))
        self.assertEqual(result["written"]["movie_marked_missing"], 1)
        # The special left the file: its episode goes, and the show's Crate rows are rewritten.
        self.assertIsNone(self.db.imdb_tv_episode_rating.find_one({"episode_imdb_id": "tt9999999"}))
        deletes = [params for sql, params in self.crate.statements if sql.startswith("DELETE FROM imdb_episode")]
        self.assertEqual(deletes[-1][0], [1396])
        self.assertNotIn("1396:tt9999999", deletes[-1][1])

    def test_a_shrunk_ratings_file_stops_before_writing(self):
        self.publish_day_one()
        ingest.main()
        self.publish("title.ratings.tsv.gz", [("tt0903747", "1.0", "10")], '"r4"')
        with self.assertRaises(ingest.DatasetAlert):
            ingest.main()
        self.assertEqual(self.db.imdb_tv_rating.find_one({"tmdb_id": 1396})["user_score_original"], 9.5)


if __name__ == "__main__":
    unittest.main()
