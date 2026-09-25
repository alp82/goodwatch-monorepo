"""IMDb ids and links published to the Crate movie and show rows."""
import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import mongomock
from mongoengine import connect, disconnect
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy import all_ratings, tmdb_details

SPEC = importlib.util.spec_from_file_location(
    "crate_connector", Path(__file__).parents[1] / "windmill/f/db/cratedb.py")
cratedb = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cratedb)

SHAWSHANK_URL = "https://www.imdb.com/title/tt0111161"


class ImdbIdPublicationTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        self.mongo = connect("imdb_ids_test", mongo_client_class=mongomock.MongoClient,
                             uuidRepresentation="standard").get_database("imdb_ids_test")
        self.addCleanup(disconnect)
        self.connector = Mock()
        self.connector.select.return_value = []
        self.calls = []

        def record(**kwargs):
            self.calls.append(kwargs)
            return {"records_received": len(kwargs["records"]), "rows_upserted": len(kwargs["records"])}

        self.connector.upsert_many.side_effect = record

    def published(self, table):
        return {row.tmdb_id: row for call in self.calls if call["table"] == table for row in call["records"]}

    def test_movie_rows_carry_the_imdb_id_and_link(self):
        self.mongo.tmdb_movie_details.insert_many([
            {"tmdb_id": 278, "title": "The Shawshank Redemption", "imdb_id": "tt0111161"},
            {"tmdb_id": 1, "title": "No id"},
            {"tmdb_id": 2, "title": "Null id", "imdb_id": None},
            {"tmdb_id": 3, "title": "Empty id", "imdb_id": ""},
            {"tmdb_id": 4, "title": "Person id", "imdb_id": "nm2789448"},
            {"tmdb_id": 5, "title": "String None", "imdb_id": "None"},
        ])
        tmdb_details.copy_media(self.connector, {}, "movie", recent_only=False)
        movies = self.published("movie")
        self.assertEqual((movies[278].imdb_id, movies[278].imdb_url), ("tt0111161", SHAWSHANK_URL))
        for tmdb_id in (1, 2, 3, 4, 5):
            with self.subTest(tmdb_id=tmdb_id):
                self.assertIsNone(movies[tmdb_id].imdb_id)
                self.assertIsNone(movies[tmdb_id].imdb_url)

    def test_show_rows_take_the_imdb_id_from_external_ids(self):
        self.mongo.tmdb_tv_details.insert_many([
            {"tmdb_id": 1396, "title": "Breaking Bad", "external_ids": {"imdb_id": "tt0903747"}},
            {"tmdb_id": 275102, "title": "Scandals", "external_ids": {}},
            {"tmdb_id": 7, "title": "No external ids"},
        ])
        tmdb_details.copy_media(self.connector, {}, "show", recent_only=False)
        shows = self.published("show")
        self.assertEqual(shows[1396].imdb_url, "https://www.imdb.com/title/tt0903747")
        self.assertEqual(shows[1396].imdb_id, "tt0903747")
        for tmdb_id in (275102, 7):
            self.assertIsNone(shows[tmdb_id].imdb_url)
            self.assertIsNone(shows[tmdb_id].imdb_id)

    def test_wikidata_override_fills_a_missing_tmdb_id(self):
        """#150 fills `imdb_id_override`; the details copy must publish it, not clear it."""
        self.mongo.tmdb_tv_details.insert_many([
            {"tmdb_id": 1, "title": "Override only", "external_ids": {}, "imdb_id_override": "tt0000001"},
            {"tmdb_id": 2, "title": "TMDB wins", "external_ids": {"imdb_id": "tt0000002"},
             "imdb_id_override": "tt0000009"},
        ])
        self.mongo.tmdb_movie_details.insert_one(
            {"tmdb_id": 3, "title": "Movie override", "imdb_id": None, "imdb_id_override": "tt0000003"})
        tmdb_details.copy_media(self.connector, {}, "show", recent_only=False)
        tmdb_details.copy_media(self.connector, {}, "movie", recent_only=False)
        shows, movies = self.published("show"), self.published("movie")
        self.assertEqual((shows[1].imdb_id, shows[1].imdb_url), ("tt0000001", "https://www.imdb.com/title/tt0000001"))
        self.assertEqual(shows[2].imdb_id, "tt0000002")
        self.assertEqual(movies[3].imdb_id, "tt0000003")

    def test_ratings_copy_links_the_override(self):
        self.mongo.tmdb_tv_details.insert_one({"tmdb_id": 1, "external_ids": {}, "imdb_id_override": "tt0000001"})
        all_ratings.copy_media(self.connector, {}, "show", recent_only=False)
        self.assertEqual(self.published("show")[1].imdb_url, "https://www.imdb.com/title/tt0000001")

    def test_details_copy_clears_stale_imdb_columns(self):
        """TMDB details own the IMDb id, so a title without one must clear the old link."""
        self.mongo.tmdb_movie_details.insert_one({"tmdb_id": 1, "title": "No id"})
        tmdb_details.copy_media(self.connector, {}, "movie", recent_only=False)
        (call,) = [call for call in self.calls if call["table"] == "movie"]
        self.assertEqual(set(call["replace_null_columns"]), {"imdb_id", "imdb_url"})

    def test_ratings_copy_never_builds_a_link_without_a_valid_id(self):
        self.mongo.tmdb_movie_details.insert_many([
            {"tmdb_id": 278, "imdb_id": "tt0111161"},
            {"tmdb_id": 4, "imdb_id": "nm2789448"},
            {"tmdb_id": 5, "imdb_id": "None"},
        ])
        all_ratings.copy_media(self.connector, {}, "movie", recent_only=False)
        movies = self.published("movie")
        self.assertEqual(movies[278].imdb_url, SHAWSHANK_URL)
        self.assertIsNone(movies[4].imdb_url)
        self.assertIsNone(movies[5].imdb_url)


class Row(BaseModel):
    id: int
    imdb_url: str | None = None
    title: str | None = None


class ReplaceNullColumnsTest(unittest.TestCase):
    def test_only_named_columns_are_cleared_by_null(self):
        db = cratedb.CrateConnector.__new__(cratedb.CrateConnector)
        db.cur = SimpleNamespace(executemany=Mock(return_value=[{"rowcount": 1}]))
        db.upsert_many("example", [Row(id=1)], ["id"], replace_null_columns={"imdb_url"})
        sql = db.cur.executemany.call_args.args[0]
        self.assertIn('"imdb_url" = excluded."imdb_url"', sql)
        self.assertIn('"title" = COALESCE(excluded."title", "title")', sql)


if __name__ == "__main__":
    unittest.main()
