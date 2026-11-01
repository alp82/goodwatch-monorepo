"""Offline mapping acceptance: no network or production database writes."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.letterboxd import mappings

NOW = datetime(2026, 11, 1)


def row(tmdb="27205", slug="inception", imdb="tt1375666", item="Q25188"):
    return {"item": "http://www.wikidata.org/entity/" + item,
            "tmdb": tmdb, "letterboxd": slug, "imdb": imdb}


class ExportTests(unittest.TestCase):
    def test_valid_csv_and_duplicate_rows(self):
        text = "item,tmdb,imdb,letterboxd\nhttp://www.wikidata.org/entity/Q25188,27205,tt1375666,inception\n"
        parsed = mappings.parse(text)
        self.assertEqual(parsed, [row()])
        found, stats = mappings.collect(parsed * 2)
        self.assertEqual(found[27205]["url"], "https://letterboxd.com/film/inception/")
        self.assertEqual(stats["unambiguous"], 1)

    def test_truncated_csv_or_stack_trace_rejected(self):
        prefix = "item,tmdb,imdb,letterboxd\n"
        for text in ("oops\n", prefix + "http://www.wikidata.org/entity/Q1,1,tt1,slug",
                     prefix + "java.lang.RuntimeException\n", prefix + '"unterminated\n'):
            with self.subTest(text=text), self.assertRaises(mappings.ExportError):
                mappings.parse(text)

    def test_429_is_not_retried_and_preserves_retry_after(self):
        client = Mock()
        client.post.return_value = SimpleNamespace(status_code=429, headers={"Retry-After": "60"})
        with self.assertRaisesRegex(mappings.ExportError, "Retry-After: 60"):
            mappings.fetch_rows(client)
        client.post.assert_called_once()

    def test_minimum_rows_guards_short_exports(self):
        client = Mock()
        client.post.return_value = SimpleNamespace(status_code=200, text="item,tmdb,imdb,letterboxd\n", headers={})
        with self.assertRaisesRegex(mappings.ExportError, "expected at least"):
            mappings.fetch_rows(client)

    def test_shared_urls_and_ambiguous_tmdb_or_imdb_are_excluded(self):
        cases = ([row(), row(tmdb="603")], [row(), row(slug="other")], [row(), row(imdb="tt00001")],
                 [row(), row(tmdb="603", imdb="bad")])
        for rows in cases:
            with self.subTest(rows=rows):
                self.assertEqual(mappings.collect(rows)[0], {})

    def test_slug_input_never_turns_into_arbitrary_url_or_nested_path(self):
        for slug in ("https://example.org/", "../other", "slug/other", "slug?x=1", "film:123", "slug%2fother", "Slug"):
            with self.subTest(slug=slug):
                self.assertEqual(mappings.collect([row(slug=slug)])[0], {})
        self.assertIn(27205, mappings.collect([row(slug="a_movie-2026")])[0])


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.db.tmdb_movie_details.insert_one({"tmdb_id": 27205, "imdb_id": "tt1375666"})
        self.db[mappings.COLLECTION].insert_one({"tmdb_id": 27205, "imdb_id": "tt1375666"})
        self.candidates = mappings.collect([row()])[0]

    def test_plan_only_attaches_hint_and_does_not_mutate_database(self):
        changes, stats = mappings.plan(self.db, self.candidates, NOW)
        self.assertEqual(stats["planned"], 1)
        self.assertNotIn("wikidata_url", self.db[mappings.COLLECTION].find_one())
        self.assertEqual(changes[0]["set"]["wikidata_url"], "https://letterboxd.com/film/inception/")
        self.assertNotIn("letterboxd_url", changes[0]["set"])
        self.assertNotIn("verified_imdb_id", changes[0]["set"])

    def test_crawled_urls_and_existing_different_hints_are_preserved(self):
        for fields, expected in (({"letterboxd_url": "https://letterboxd.com/film/existing/"}, "already_crawled"),
                                 ({"wikidata_url": "https://letterboxd.com/film/existing/"}, "existing_hint_conflict")):
            self.db[mappings.COLLECTION].update_one({}, {"$set": fields})
            changes, stats = mappings.plan(self.db, self.candidates)
            self.assertEqual(changes, [])
            self.assertEqual(stats[expected], 1)
            self.db[mappings.COLLECTION].update_one({}, {"$unset": {key: "" for key in fields}})

    def test_imdb_disagreement_missing_catalog_or_deleted_movie_are_rejected(self):
        self.db.tmdb_movie_details.update_one({}, {"$set": {"imdb_id": "tt99999"}})
        self.assertEqual(mappings.plan(self.db, self.candidates)[1]["imdb_mismatch"], 1)
        self.db.tmdb_movie_details.update_one({}, {"$set": {"tmdb_deleted": True}})
        self.assertEqual(mappings.plan(self.db, self.candidates)[1]["missing_movie"], 1)
        self.db.tmdb_movie_details.delete_many({})
        self.assertEqual(mappings.plan(self.db, self.candidates)[1]["missing_movie"], 1)

    def test_apply_filter_cannot_overwrite_a_concurrently_crawled_url(self):
        changes, _ = mappings.plan(self.db, self.candidates)
        self.db[mappings.COLLECTION].update_one({}, {"$set": {"letterboxd_url": "https://letterboxd.com/film/new/"}})
        # Exercise the same atomic predicate independently of mongomock's outdated bulk API.
        result = self.db[mappings.COLLECTION].update_one(changes[0]["filter"], {"$set": changes[0]["set"]})
        self.assertEqual(result.modified_count, 0)
        self.assertNotIn("wikidata_url", self.db[mappings.COLLECTION].find_one())

    def test_unchanged_url_is_not_rewritten(self):
        self.db[mappings.COLLECTION].update_one({}, {"$set": {"wikidata_url": self.candidates[27205]["url"]}})
        self.assertEqual(mappings.plan(self.db, self.candidates)[1]["unchanged"], 1)


if __name__ == "__main__":
    unittest.main()
