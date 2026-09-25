"""Weekly Wikidata backfill of IMDb, Rotten Tomatoes and Metacritic ids (#150).

No network and no real database: the Wikidata export is a fake HTTP client,
MongoDB is mongomock and CrateDB is a recording cursor.
"""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import mongomock
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.external_ids import imdb_ids, wikidata, wikidata_backfill as backfill

# pymongo 4.18's UpdateOne passes `sort`, which mongomock 4.3 does not accept yet.
_add_update = mongomock.collection.BulkOperationBuilder.add_update
mongomock.collection.BulkOperationBuilder.add_update = (
    lambda self, *args, sort=None, **kwargs: _add_update(self, *args, **kwargs))

NOW = datetime(2026, 9, 25, 12, 0)
ENTITY = "http://www.wikidata.org/entity/"
RT = "https://www.rottentomatoes.com/"
MC = "https://www.metacritic.com/"


def csv_export(rows, columns=("item", "tmdb", "imdb", "rt", "mc")):
    lines = [",".join(columns)]
    for row in rows:
        lines.append(",".join(row.get(column, "") for column in columns))
    return "\n".join(lines) + "\n"


def row(qid, tmdb, imdb="", rt="", mc=""):
    return {"item": ENTITY + qid, "tmdb": str(tmdb), "imdb": imdb, "rt": rt, "mc": mc}


class FakeResponse:
    def __init__(self, status_code, text="", headers=None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}


class FakeHttp:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, data=None, headers=None, timeout=None):
        self.calls.append({"url": url, "data": data, "headers": headers, "timeout": timeout})
        return self.responses.pop(0)


class ImdbIdTests(unittest.TestCase):
    def test_only_title_ids_are_valid(self):
        self.assertEqual(imdb_ids.valid_imdb_id(" tt0903747 "), "tt0903747")
        for raw in (None, "", "None", "nm0000001", "tt", 42, "tt12x"):
            with self.subTest(raw=raw):
                self.assertIsNone(imdb_ids.valid_imdb_id(raw))

    def test_tmdb_id_wins_over_the_override(self):
        show = {"external_ids": {"imdb_id": "tt0903747"}, "imdb_id_override": "tt9999999"}
        self.assertEqual(imdb_ids.effective_imdb_id(show, is_movie=False), ("tt0903747", "tmdb"))

    def test_override_fills_a_missing_or_invalid_tmdb_id(self):
        show = {"external_ids": {"imdb_id": None}, "imdb_id_override": "tt1234567"}
        movie = {"imdb_id": "None", "imdb_id_override": "tt7654321"}
        self.assertEqual(imdb_ids.effective_imdb_id(show, is_movie=False), ("tt1234567", "wikidata"))
        self.assertEqual(imdb_ids.effective_imdb_id(movie, is_movie=True), ("tt7654321", "wikidata"))
        self.assertEqual(imdb_ids.effective_imdb_id({}, is_movie=True), (None, None))


class ExportTests(unittest.TestCase):
    def test_export_sends_an_honest_user_agent_and_parses_rows(self):
        http = FakeHttp([FakeResponse(200, csv_export([row("Q1", 1396, "tt0903747", "tv/breaking_bad")]))])
        rows = wikidata.run_export("tv", http=http, min_rows=0)
        self.assertEqual(rows, [{"item": "Q1", "tmdb": "1396", "imdb": "tt0903747", "rt": "tv/breaking_bad", "mc": ""}])
        (call,) = http.calls
        self.assertEqual(call["url"], "https://query.wikidata.org/sparql")
        self.assertIn("goodwatch.app", call["headers"]["User-Agent"])
        self.assertIn("@", call["headers"]["User-Agent"])
        self.assertEqual(call["headers"]["Accept"], "text/csv")
        self.assertIn("P4983", call["data"]["query"])

    def test_movie_export_reads_the_tmdb_movie_property(self):
        self.assertIn("P4947", wikidata.QUERIES["movie"])
        for prop in ("P345", "P1258", "P1712"):
            self.assertIn(prop, wikidata.QUERIES["movie"])
            self.assertIn(prop, wikidata.QUERIES["tv"])

    def test_429_stops_without_retrying(self):
        http = FakeHttp([FakeResponse(429, "Too Many Requests", {"Retry-After": "120"})])
        with self.assertRaises(wikidata.WikidataRateLimited) as raised:
            wikidata.run_export("tv", http=http)
        self.assertEqual(raised.exception.retry_after, "120")
        self.assertEqual(len(http.calls), 1)

    def test_a_429_on_the_first_export_skips_the_second(self):
        http = FakeHttp([
            FakeResponse(429, "", {"Retry-After": "60"}),
            FakeResponse(200, csv_export([row("Q1", 1)])),
        ])
        with self.assertRaises(wikidata.WikidataRateLimited):
            wikidata.fetch_exports(http=http, sleep=lambda _: None, min_rows=0)
        self.assertEqual(len(http.calls), 1)

    def test_exports_are_spaced_out(self):
        http = FakeHttp([FakeResponse(200, csv_export([row("Q1", 1)])),
                         FakeResponse(200, csv_export([row("Q2", 2)]))])
        pauses = []
        exports = wikidata.fetch_exports(http=http, sleep=pauses.append, min_rows=0)
        self.assertEqual(set(exports), {"tv", "movie"})
        self.assertEqual(len(pauses), 1)
        self.assertGreaterEqual(pauses[0], wikidata.PAUSE_BETWEEN_EXPORTS_SECONDS)

    def test_a_timed_out_export_is_rejected(self):
        """WDQS streams a Java stack trace after the rows when the 60 s deadline hits."""
        text = csv_export([row("Q1", 1, "tt0000001")]) + "SPARQL-QUERY: queryStr=SELECT\njava.util.concurrent.TimeoutException\n\tat java.util.concurrent.FutureTask.get(FutureTask.java:205)\n"
        http = FakeHttp([FakeResponse(200, text)])
        with self.assertRaises(wikidata.WikidataExportError):
            wikidata.run_export("tv", http=http)

    def test_a_short_export_is_rejected(self):
        http = FakeHttp([FakeResponse(200, csv_export([row("Q1", 1)]))])
        with self.assertRaisesRegex(wikidata.WikidataExportError, "rows"):
            wikidata.run_export("tv", http=http, min_rows=10)

    def test_server_errors_raise(self):
        http = FakeHttp([FakeResponse(502, "Bad Gateway")])
        with self.assertRaises(wikidata.WikidataExportError):
            wikidata.run_export("tv", http=http)


class CollectTests(unittest.TestCase):
    def test_values_are_grouped_per_tmdb_id_and_filtered_by_level(self):
        rows = [
            row("Q1", 1396, "tt0903747", "tv/breaking_bad", "tv/breaking-bad"),
            row("Q1", 1396, "tt0903747", "tv/breaking_bad/s01", "tv/breaking-bad/season-1"),
            row("Q2", 2, "nm0000001", "m/a_movie", "movie/a-movie"),
            row("Q3", "abc", "tt1"),
        ]
        stats = {}
        ids = wikidata.collect_ids(rows, "tv", stats)
        self.assertEqual(set(ids), {1396, 2})
        self.assertEqual(ids[1396].imdb, {"tt0903747"})
        self.assertEqual(ids[1396].rotten_tomatoes, {RT + "tv/breaking_bad"})
        self.assertEqual(ids[1396].metacritic, {MC + "tv/breaking-bad"})
        self.assertEqual(ids[2].imdb, set())
        self.assertEqual(ids[2].rotten_tomatoes, set())
        self.assertEqual(ids[2].metacritic, set())
        self.assertEqual(stats["invalid_tmdb_id"], 1)

    def test_movie_level_values(self):
        ids = wikidata.collect_ids([row("Q1", 278, "tt0111161", "m/shawshank_redemption", "movie/the-shawshank-redemption"),
                                    row("Q1", 278, "", "tv/wrong", "tv/wrong")], "movie", {})
        self.assertEqual(ids[278].rotten_tomatoes, {RT + "m/shawshank_redemption"})
        self.assertEqual(ids[278].metacritic, {MC + "movie/the-shawshank-redemption"})


def ids(imdb=(), rt=(), mc=(), items=("Q1",)):
    return wikidata.WikidataIds(imdb=set(imdb), rotten_tomatoes=set(rt), metacritic=set(mc), items=set(items))


class PlanImdbTests(unittest.TestCase):
    def plan(self, wd, details, owners=None):
        self.stats = {}
        return backfill.plan_imdb("tv", wd, details, owners or {}, self.stats, NOW)

    def show(self, tmdb_id, imdb=None, **extra):
        return {"_id": f"oid{tmdb_id}", "tmdb_id": tmdb_id, "external_ids": {"imdb_id": imdb}, **extra}

    def test_fills_a_show_without_an_id(self):
        (change,) = self.plan({1: ids(["tt0000001"])}, {1: self.show(1)})
        self.assertEqual(change.collection, "tmdb_tv_details")
        self.assertEqual(change.set_fields["imdb_id_override"], "tt0000001")
        self.assertEqual(change.set_fields["imdb_id_override_source"], "wikidata")
        self.assertEqual(change.set_fields["imdb_id_override_at"], NOW)
        self.assertEqual(change.previous, {"imdb_id_override": None, "imdb_id_override_source": None,
                                           "imdb_id_override_at": None})
        self.assertEqual(self.stats["filled"], 1)

    def test_never_touches_a_tmdb_id(self):
        changes = self.plan({1: ids(["tt0000001"]), 2: ids(["tt0000002"])},
                            {1: self.show(1, "tt0000001"), 2: self.show(2, "tt0000009")})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["agree_with_tmdb"], 1)
        self.assertEqual(self.stats["disagree_with_tmdb"], 1)
        self.assertEqual(self.stats["samples"]["disagree_with_tmdb"][0],
                         {"tmdb_id": 2, "tmdb": "tt0000009", "wikidata": "tt0000002", "items": ["Q1"]})

    def test_skips_ambiguous_deleted_and_unknown_titles(self):
        changes = self.plan({1: ids(["tt0000001", "tt0000002"]), 2: ids(["tt0000003"]), 3: ids(["tt0000004"])},
                            {1: self.show(1), 2: self.show(2, tmdb_deleted=True)})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["ambiguous"], 1)
        self.assertEqual(self.stats["tmdb_deleted"], 1)
        self.assertEqual(self.stats["not_in_catalog"], 1)

    def test_skips_an_id_another_title_owns_on_tmdb(self):
        changes = self.plan({1: ids(["tt0000001"])}, {1: self.show(1)}, owners={"tt0000001": {7}})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["claimed_by_other_title"], 1)

    def test_skips_an_id_wikidata_gives_to_two_titles(self):
        changes = self.plan({1: ids(["tt0000001"]), 2: ids(["tt0000001"], items=["Q2"])},
                            {1: self.show(1), 2: self.show(2)})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["claimed_by_other_title"], 2)

    def test_keeps_an_unchanged_override_and_follows_a_changed_one(self):
        changes = self.plan(
            {1: ids(["tt0000001"]), 2: ids(["tt0000003"])},
            {1: self.show(1, imdb_id_override="tt0000001"),
             2: self.show(2, imdb_id_override="tt0000002", imdb_id_override_source="wikidata",
                          imdb_id_override_at=datetime(2026, 9, 1))})
        (change,) = changes
        self.assertEqual(change.tmdb_id, 2)
        self.assertEqual(change.previous["imdb_id_override"], "tt0000002")
        self.assertEqual(self.stats["unchanged"], 1)
        self.assertEqual(self.stats["changed"], 1)

    def test_final_overrides_list_every_title_resolved_through_wikidata(self):
        self.plan({1: ids(["tt0000001"]), 2: ids(["tt0000002"]), 3: ids(["tt0000003"])},
                  {1: self.show(1), 2: self.show(2, imdb_id_override="tt0000002"), 3: self.show(3, "tt0000003")})
        self.assertEqual(self.stats["overrides"], {1: "tt0000001", 2: "tt0000002"})


class PlanUrlTests(unittest.TestCase):
    def plan(self, wd, docs, owners=None):
        self.stats = {}
        return backfill.plan_urls("rotten_tomatoes", "tv", wd, docs, owners or {}, self.stats, NOW)

    def doc(self, tmdb_id, url=None, **extra):
        return {"_id": f"oid{tmdb_id}", "tmdb_id": tmdb_id, "rotten_tomatoes_url": url, **extra}

    def test_fills_an_empty_url_and_marks_its_source(self):
        (change,) = self.plan({1: ids(rt=[RT + "tv/the-bear"])}, {1: self.doc(1)})
        self.assertEqual(change.collection, "rotten_tomatoes_tv_rating")
        self.assertEqual(change.set_fields, {
            "rotten_tomatoes_url": RT + "tv/the-bear",
            "url_source": "wikidata",
            "url_verified_at": NOW,
            "wikidata_url": RT + "tv/the-bear",
        })
        self.assertEqual(change.previous, {"rotten_tomatoes_url": None, "url_source": None,
                                           "url_verified_at": None, "wikidata_url": None})
        self.assertEqual(self.stats["filled"], 1)

    def test_never_overwrites_a_crawled_url(self):
        changes = self.plan(
            {1: ids(rt=[RT + "tv/the-mentalist"]), 2: ids(rt=[RT + "tv/ncis"]), 3: ids(rt=[RT + "tv/lost"])},
            {1: self.doc(1, RT + "tv/the_mentalist"),
             2: self.doc(2, RT + "tv/ncis/"),
             3: self.doc(3, RT + "tv/lost_2004", url_source="crawl")})
        by_id = {change.tmdb_id: change for change in changes}
        # Only the Wikidata mirror is recorded; the crawled URL stays.
        self.assertEqual(by_id[1].set_fields, {"wikidata_url": RT + "tv/the-mentalist"})
        self.assertEqual(by_id[3].set_fields, {"wikidata_url": RT + "tv/lost"})
        self.assertEqual(self.stats["agree_with_stored"], 1)
        self.assertEqual(self.stats["disagree_with_stored"], 2)
        self.assertEqual(self.stats["samples"]["disagree_with_stored"][0]["stored"], RT + "tv/the_mentalist")

    def test_follows_wikidata_for_a_url_it_filled(self):
        (change,) = self.plan({1: ids(rt=[RT + "tv/new-slug"])},
                              {1: self.doc(1, RT + "tv/old-slug", url_source="wikidata",
                                           wikidata_url=RT + "tv/old-slug")})
        self.assertEqual(change.set_fields["rotten_tomatoes_url"], RT + "tv/new-slug")
        self.assertEqual(change.previous["rotten_tomatoes_url"], RT + "tv/old-slug")
        self.assertEqual(self.stats["changed"], 1)

    def test_an_unchanged_fill_is_not_rewritten(self):
        changes = self.plan({1: ids(rt=[RT + "tv/x"])},
                            {1: self.doc(1, RT + "tv/x", url_source="wikidata", wikidata_url=RT + "tv/x")})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["unchanged"], 1)

    def test_skips_ambiguous_and_claimed_urls_and_missing_documents(self):
        changes = self.plan(
            {1: ids(rt=[RT + "tv/a", RT + "tv/b"]), 2: ids(rt=[RT + "tv/taken"]), 3: ids(rt=[RT + "tv/c"]),
             4: ids(rt=[RT + "tv/twice"]), 5: ids(rt=[RT + "tv/twice"])},
            {1: self.doc(1), 2: self.doc(2), 4: self.doc(4), 5: self.doc(5)},
            owners={RT + "tv/taken": {9}})
        self.assertEqual(changes, [])
        self.assertEqual(self.stats["ambiguous"], 1)
        self.assertEqual(self.stats["claimed_by_other_title"], 3)
        self.assertEqual(self.stats["no_rating_document"], 1)

    def test_url_owner_matching_ignores_case_and_trailing_slash(self):
        changes = self.plan({1: ids(rt=[RT + "tv/taken"])}, {1: self.doc(1)}, owners=backfill.url_owners(
            [{"tmdb_id": 9, "rotten_tomatoes_url": RT + "tv/Taken/"}], "rotten_tomatoes_url"))
        self.assertEqual(changes, [])


class BackfillIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().get_database("wikidata_test")
        self.db.tmdb_tv_details.insert_many([
            {"tmdb_id": 1, "title": "Filled", "original_title": "Filled", "popularity": 50.0, "external_ids": {}},
            {"tmdb_id": 2, "title": "Has id", "popularity": 40.0, "external_ids": {"imdb_id": "tt0000002"}},
            {"tmdb_id": 3, "title": "Conflict", "popularity": 30.0, "external_ids": {"imdb_id": "tt0000003"}},
        ])
        self.db.tmdb_movie_details.insert_many([
            {"tmdb_id": 10, "title": "Movie", "original_title": "Movie", "popularity": 5.0, "imdb_id": None},
        ])
        self.db.imdb_tv_rating.insert_one({"tmdb_id": 1, "imdb_id": None, "user_score_original": None})
        self.db.rotten_tomatoes_tv_rating.insert_many([
            {"tmdb_id": 1, "rotten_tomatoes_url": None},
            {"tmdb_id": 2, "rotten_tomatoes_url": RT + "tv/has_id"},
        ])
        self.db.metacritic_tv_rating.insert_many([{"tmdb_id": 1}, {"tmdb_id": 2}, {"tmdb_id": 3}])
        self.db.rotten_tomatoes_movie_rating.insert_one({"tmdb_id": 10})
        self.db.metacritic_movie_rating.insert_one({"tmdb_id": 10})
        self.exports = {
            "tv": [row("Q1", 1, "tt0000001", "tv/filled", "tv/filled"),
                   row("Q2", 2, "tt0000002", "tv/has-id", "tv/has-id"),
                   row("Q3", 3, "tt0000099")],
            "movie": [row("Q10", 10, "tt0000010", "m/movie", "movie/movie")],
        }
        self.crate = SimpleNamespace(cur=SimpleNamespace(executemany=Mock(
            side_effect=lambda sql, rows: [{"rowcount": 1} for _ in rows])))

    def run_backfill(self, **kwargs):
        return backfill.backfill(self.db, self.crate, self.exports, NOW, **kwargs)

    def test_first_run_fills_backs_up_and_publishes(self):
        report = self.run_backfill()

        show = self.db.tmdb_tv_details.find_one({"tmdb_id": 1})
        self.assertEqual((show["imdb_id_override"], show["imdb_id_override_source"]), ("tt0000001", "wikidata"))
        self.assertNotIn("imdb_id_override", self.db.tmdb_tv_details.find_one({"tmdb_id": 3}))
        self.assertEqual(self.db.tmdb_movie_details.find_one({"tmdb_id": 10})["imdb_id_override"], "tt0000010")

        # The IMDb ingest (#149) maps tconsts through imdb_*_rating.
        rating = self.db.imdb_tv_rating.find_one({"tmdb_id": 1})
        self.assertEqual((rating["imdb_id"], rating["imdb_id_source"]), ("tt0000001", "wikidata"))
        movie_rating = self.db.imdb_movie_rating.find_one({"tmdb_id": 10})
        self.assertEqual((movie_rating["imdb_id"], movie_rating["imdb_id_source"]), ("tt0000010", "wikidata"))
        self.assertEqual(movie_rating["original_title"], "Movie")
        self.assertEqual(movie_rating["created_at"], NOW)

        rt = self.db.rotten_tomatoes_tv_rating.find_one({"tmdb_id": 1})
        self.assertEqual((rt["rotten_tomatoes_url"], rt["url_source"]), (RT + "tv/filled", "wikidata"))
        kept = self.db.rotten_tomatoes_tv_rating.find_one({"tmdb_id": 2})
        self.assertEqual(kept["rotten_tomatoes_url"], RT + "tv/has_id")
        self.assertEqual(kept["wikidata_url"], RT + "tv/has-id")
        self.assertNotIn("url_source", kept)
        mc = self.db.metacritic_tv_rating.find_one({"tmdb_id": 2})
        self.assertEqual((mc["metacritic_url"], mc["url_source"]), (MC + "tv/has-id", "wikidata"))
        self.assertEqual(self.db.metacritic_movie_rating.find_one({"tmdb_id": 10})["metacritic_url"],
                         MC + "movie/movie")

        backup = self.db["_backup_20260925_wikidata_ids"]
        saved = backup.find_one({"collection": "rotten_tomatoes_tv_rating", "tmdb_id": 1})
        self.assertEqual(saved["previous"]["rotten_tomatoes_url"], None)
        self.assertEqual(saved["set"]["rotten_tomatoes_url"], RT + "tv/filled")
        saved = backup.find_one({"collection": "imdb_tv_rating", "tmdb_id": 1})
        self.assertEqual(saved["previous"], {"imdb_id": None, "imdb_id_source": None})
        self.assertIsNotNone(backup.find_one({"collection": "imdb_movie_rating", "tmdb_id": 10, "inserted": True}))

        statements = {call.args[0]: call.args[1] for call in self.crate.cur.executemany.call_args_list}
        self.assertEqual(statements, {
            "UPDATE show SET imdb_id = ?, imdb_url = ? WHERE tmdb_id = ?":
                [["tt0000001", "https://www.imdb.com/title/tt0000001", 1]],
            "UPDATE movie SET imdb_id = ?, imdb_url = ? WHERE tmdb_id = ?":
                [["tt0000010", "https://www.imdb.com/title/tt0000010", 10]],
        })

        self.assertEqual(report["tv"]["imdb"]["filled"], 1)
        self.assertEqual(report["tv"]["imdb"]["disagree_with_tmdb"], 1)
        self.assertEqual(report["tv"]["rotten_tomatoes"]["disagree_with_stored"], 1)
        self.assertEqual(report["tv"]["crate_rows_updated"], 1)

    def test_second_run_changes_nothing(self):
        self.run_backfill()
        backup = self.db["_backup_20260925_wikidata_ids"]
        backups = backup.count_documents({})
        report = self.run_backfill()
        self.assertEqual(backup.count_documents({}), backups)
        self.assertEqual(report["writes"], 0)
        self.assertEqual(report["tv"]["imdb"]["unchanged"], 1)

    def test_dry_run_writes_nothing(self):
        report = self.run_backfill(dry_run=True)
        self.assertNotIn("imdb_id_override", self.db.tmdb_tv_details.find_one({"tmdb_id": 1}))
        self.assertNotIn("_backup_20260925_wikidata_ids", self.db.list_collection_names())
        self.crate.cur.executemany.assert_not_called()
        self.assertEqual(report["tv"]["imdb"]["filled"], 1)
        self.assertGreater(report["planned_writes"], 0)

    def test_a_rating_document_owned_by_tmdb_is_corrected_to_the_effective_id(self):
        """TMDB dropped its id; the IMDb rating document still holds the old one."""
        self.db.imdb_tv_rating.update_one({"tmdb_id": 1}, {"$set": {"imdb_id": "tt5555555"}})
        self.run_backfill()
        self.assertEqual(self.db.imdb_tv_rating.find_one({"tmdb_id": 1})["imdb_id"], "tt0000001")
        saved = self.db["_backup_20260925_wikidata_ids"].find_one({"collection": "imdb_tv_rating", "tmdb_id": 1})
        self.assertEqual(saved["previous"]["imdb_id"], "tt5555555")


class ImdbInitTests(unittest.TestCase):
    """The IMDb rating initializer keeps `imdb_*_rating.imdb_id` on the effective id."""

    def setUp(self):
        from f.imdb_web.imdb_init_ratings import main as imdb_init
        from f.tmdb_daily.models import DumpType
        self.imdb_init, self.DumpType = imdb_init, DumpType

    def fields(self, entry, kind):
        return self.imdb_init.build_operation(tmdb_entry=entry, type=kind)._doc["$set"]

    def test_tmdb_id_is_used_first(self):
        fields = self.fields({"tmdb_id": 1, "external_ids": {"imdb_id": "tt0000001"},
                              "imdb_id_override": "tt0000009"}, self.DumpType.TV_SERIES)
        self.assertEqual((fields["imdb_id"], fields["imdb_id_source"]), ("tt0000001", "tmdb"))

    def test_override_is_used_without_a_tmdb_id(self):
        fields = self.fields({"tmdb_id": 1, "imdb_id": None, "imdb_id_override": "tt0000009"},
                             self.DumpType.MOVIES)
        self.assertEqual((fields["imdb_id"], fields["imdb_id_source"]), ("tt0000009", "wikidata"))

    def test_the_initializer_selects_titles_with_either_id(self):
        db = mongomock.MongoClient().get_database("imdb_init")
        db.tmdb_tv_details.insert_many([
            {"tmdb_id": 1, "external_ids": {"imdb_id": "tt0000001"}},
            {"tmdb_id": 2, "external_ids": {}, "imdb_id_override": "tt0000002"},
            {"tmdb_id": 3, "external_ids": {}},
        ])
        with unittest.mock.patch.object(self.imdb_init, "get_db", return_value=db):
            self.imdb_init.initialize_documents()
        self.assertEqual({doc["tmdb_id"]: doc["imdb_id"] for doc in db.imdb_tv_rating.find()},
                         {1: "tt0000001", 2: "tt0000002"})


class CrawlerProvenanceTests(unittest.TestCase):
    """A URL the crawler found is marked as crawled, so Wikidata never replaces it."""

    def setUp(self):
        disconnect()
        connect("crawler_provenance", mongo_client_class=mongomock.MongoClient, uuidRepresentation="standard")
        self.addCleanup(disconnect)

    def test_rotten_tomatoes_store_marks_a_found_url_as_crawled(self):
        from f.rotten_web.models import RottenTomatoesCrawlResult, RottenTomatoesTvRating
        from f.rotten_web.rotten_tomatoes_crawl_ratings import fetch
        entry = RottenTomatoesTvRating(tmdb_id=1, rotten_tomatoes_url=RT + "tv/x", url_source="wikidata").save()
        empty = dict(tomato_score_original=None, tomato_score_normalized_percent=None, tomato_score_vote_count=None,
                     audience_score_original=None, audience_score_normalized_percent=None,
                     audience_score_vote_count=None, rate_limit_reached=False)
        fetch.store_result(entry, RottenTomatoesCrawlResult(url=None, **empty))
        self.assertEqual(RottenTomatoesTvRating.objects.get(tmdb_id=1).url_source, "wikidata")
        fetch.store_result(entry, RottenTomatoesCrawlResult(url=RT + "tv/y", **empty))
        stored = RottenTomatoesTvRating.objects.get(tmdb_id=1)
        self.assertEqual((stored.rotten_tomatoes_url, stored.url_source), (RT + "tv/y", "crawl"))
        self.assertIsNotNone(stored.url_verified_at)

    def test_metacritic_store_marks_a_found_url_as_crawled(self):
        from f.metacritic_web.models import MetacriticCrawlResult, MetacriticMovieRating
        from f.metacritic_web.metacritic_crawl_ratings import fetch
        entry = MetacriticMovieRating(tmdb_id=1).save()
        fetch.store_result(entry, MetacriticCrawlResult(
            url=MC + "movie/x", meta_score_original=80, meta_score_normalized_percent=80, meta_score_vote_count=10,
            user_score_original=None, user_score_normalized_percent=None, user_score_vote_count=None,
            rate_limit_reached=False))
        stored = MetacriticMovieRating.objects.get(tmdb_id=1)
        self.assertEqual((stored.metacritic_url, stored.url_source), (MC + "movie/x", "crawl"))
        self.assertIsNotNone(stored.url_verified_at)


class ModelTests(unittest.TestCase):
    """Crawlers load these documents through mongoengine, which rejects unknown fields."""

    def setUp(self):
        disconnect()
        connect("wikidata_models", mongo_client_class=mongomock.MongoClient, uuidRepresentation="standard")
        self.addCleanup(disconnect)

    def test_documents_with_backfill_fields_still_load(self):
        from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
        from f.imdb_web.models import ImdbTvRating
        from f.rotten_web.models import RottenTomatoesTvRating
        from f.metacritic_web.models import MetacriticMovieRating

        override = {"imdb_id_override": "tt1", "imdb_id_override_source": "wikidata", "imdb_id_override_at": NOW}
        url = {"url_source": "wikidata", "url_verified_at": NOW, "wikidata_url": RT + "tv/x"}
        # Through each class's own collection: mongoengine caches it across connections.
        TmdbTvDetails._get_collection().insert_one({"tmdb_id": 1, **override})
        TmdbMovieDetails._get_collection().insert_one({"tmdb_id": 1, **override})
        ImdbTvRating._get_collection().insert_one({"tmdb_id": 1, "imdb_id": "tt1", "imdb_id_source": "wikidata"})
        RottenTomatoesTvRating._get_collection().insert_one({"tmdb_id": 1, **url})
        MetacriticMovieRating._get_collection().insert_one({"tmdb_id": 1, **url})

        self.assertEqual(TmdbTvDetails.objects.get(tmdb_id=1).imdb_id_override, "tt1")
        self.assertEqual(TmdbMovieDetails.objects.get(tmdb_id=1).imdb_id_override_source, "wikidata")
        self.assertEqual(ImdbTvRating.objects.get(tmdb_id=1).imdb_id_source, "wikidata")
        self.assertEqual(RottenTomatoesTvRating.objects.get(tmdb_id=1).url_source, "wikidata")
        self.assertEqual(MetacriticMovieRating.objects.get(tmdb_id=1).wikidata_url, RT + "tv/x")


if __name__ == "__main__":
    unittest.main()
