"""Sitemap matching and duplicate URL repair for the Rotten Tomatoes and Metacritic crawlers (#152)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
sys.path.insert(0, str(Path(__file__).parent))
from f.critic_sites import crawl, directory, repair_urls
from test_critic_sites_crawl import FakeClient

NOW = datetime(2026, 9, 25, 12, 0, 0)
RT = "https://www.rottentomatoes.com"
MC = "https://www.metacritic.com"


def sitemap(urls):
    return "<urlset>" + "".join(f"<url><loc>{url}</loc></url>" for url in urls) + "</urlset>"


class DirectoryTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.tv = self.db.rotten_tomatoes_tv_rating

    def add(self, tmdb_id, variations, year, popularity=50.0, **fields):
        self.tv.insert_one({"tmdb_id": tmdb_id, "title_variations": variations, "release_year": year,
                            "popularity": popularity, **fields})

    def test_directory_urls_come_from_the_series_sitemaps(self):
        index = (f"<sitemapindex><sitemap><loc>{RT}/sitemaps/tv-series_0.xml</loc></sitemap>"
                 f"<sitemap><loc>{RT}/sitemaps/tv-episodes_0.xml</loc></sitemap></sitemapindex>")
        client = FakeClient("rotten_tomatoes", {
            f"{RT}/sitemaps/sitemap.xml": (200, f"{RT}/sitemaps/sitemap.xml", index),
            f"{RT}/sitemaps/tv-series_0.xml": (200, f"{RT}/sitemaps/tv-series_0.xml",
                                               sitemap([f"{RT}/tv/the-bear", f"{RT}/tv/the-bear/s01"])),
        })
        self.assertEqual(directory.directory_urls(client, "rotten_tomatoes"), {f"{RT}/tv/the-bear"})
        self.assertEqual(client.requested, [f"{RT}/sitemaps/sitemap.xml", f"{RT}/sitemaps/tv-series_0.xml"])

    def test_titles_without_a_url_get_a_unique_sitemap_match(self):
        self.add(1, ["the_bear"], 2022)                      # hyphen slug on RT
        self.add(2, ["dark"], 2017)                          # the year-suffixed slug wins
        self.add(3, ["home"], 2020)                          # not in the directory
        self.add(4, ["gilmore_girls"], 2000, rotten_tomatoes_url=f"{RT}/tv/gilmore_girls")  # has a URL
        self.add(5, ["twin"], 2019, wikidata_url=f"{RT}/tv/twin")  # Wikidata has one
        self.add(6, ["lost"], 2004)
        self.add(7, ["lost"], 2004)                          # two titles want the same URL
        self.add(8, ["taken"], 2020, rotten_tomatoes_url=None)
        self.tv.insert_one({"tmdb_id": 9, "rotten_tomatoes_url": f"{RT}/tv/taken"})
        urls = {f"{RT}/tv/the-bear", f"{RT}/tv/dark", f"{RT}/tv/dark_2017", f"{RT}/tv/gilmore_girls",
                f"{RT}/tv/twin", f"{RT}/tv/lost", f"{RT}/tv/taken"}
        report = directory.match_directory(self.db, "rotten_tomatoes", urls, NOW, top=100)

        by_id = {doc["tmdb_id"]: doc for doc in self.tv.find()}
        self.assertEqual((by_id[1]["rotten_tomatoes_url"], by_id[1]["url_source"]), (f"{RT}/tv/the-bear", "sitemap"))
        self.assertEqual(by_id[1]["next_crawl_at"], crawl.EPOCH)
        self.assertEqual(by_id[2]["rotten_tomatoes_url"], f"{RT}/tv/dark_2017")
        for tmdb_id in (3, 6, 7, 8):
            self.assertNotIn("url_source", by_id[tmdb_id])
        self.assertEqual(by_id[4]["rotten_tomatoes_url"], f"{RT}/tv/gilmore_girls")
        self.assertNotIn("rotten_tomatoes_url", by_id[5])
        self.assertEqual(report["matched"], 2)
        self.assertEqual(report["claimed_by_other_title"], 3)

    def test_only_the_most_popular_titles_are_matched(self):
        self.add(1, ["the_bear"], 2022, popularity=1.0)
        self.add(2, ["dark"], 2017, popularity=9.0)
        directory.match_directory(self.db, "rotten_tomatoes", {f"{RT}/tv/the_bear", f"{RT}/tv/dark"}, NOW, top=1)
        self.assertIsNone(self.tv.find_one({"tmdb_id": 1}).get("rotten_tomatoes_url"))
        self.assertEqual(self.tv.find_one({"tmdb_id": 2})["rotten_tomatoes_url"], f"{RT}/tv/dark")

    def test_metacritic_uses_dashed_slugs(self):
        self.db.metacritic_tv_rating.insert_one({"tmdb_id": 1, "title_variations": ["the-bear"], "release_year": 2022,
                                                 "popularity": 5.0})
        directory.match_directory(self.db, "metacritic", {f"{MC}/tv/the-bear"}, NOW, top=10)
        self.assertEqual(self.db.metacritic_tv_rating.find_one()["metacritic_url"], f"{MC}/tv/the-bear")


class RepairTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.movies = self.db.rotten_tomatoes_movie_rating

    def add(self, tmdb_id, url, year, **fields):
        self.movies.insert_one({"tmdb_id": tmdb_id, "rotten_tomatoes_url": url, "release_year": year,
                                "popularity": 10.0 - tmdb_id, "tomato_score_original": 50.0, **fields})

    def test_a_group_keeps_the_url_on_the_wikidata_holder_or_the_year_in_the_slug(self):
        self.add(1, f"{RT}/m/home", 2009)
        self.add(2, f"{RT}/m/home", 2015, wikidata_url=f"{RT}/m/home")
        self.add(3, f"{RT}/m/home", 2020)
        self.add(4, f"{RT}/m/dune_2021", 2021)
        self.add(5, f"{RT}/m/dune_2021", 1984)
        self.add(6, f"{RT}/m/echo", 2000)
        self.add(7, f"{RT}/m/echo", 2008)  # no evidence: left for the crawl to settle
        self.add(8, f"{RT}/m/solo", 2018)  # not a duplicate
        report = repair_urls.repair(self.db, "rotten_tomatoes", NOW, dry_run=False)

        kept = {doc["tmdb_id"] for doc in self.movies.find({"rotten_tomatoes_url": {"$exists": True}})}
        self.assertEqual(kept, {2, 4, 6, 7, 8})
        cleared = self.movies.find_one({"tmdb_id": 1})
        self.assertEqual((cleared["rejected_url"], cleared["rejected_reason"]), (f"{RT}/m/home", "duplicate"))
        self.assertEqual(cleared["rejected_until"], NOW + timedelta(days=90))
        self.assertNotIn("tomato_score_original", cleared)
        self.assertEqual(cleared["updated_at"], NOW)
        self.assertEqual(self.db[crawl.backup_collection_name(NOW)].count_documents({}), 3)
        self.assertEqual(report["movie"]["groups"], 3)
        self.assertEqual(report["movie"]["cleared"], 3)
        self.assertEqual(report["movie"]["left_for_crawl"], 2)

    def test_dry_run_writes_nothing(self):
        self.add(1, f"{RT}/m/home", 2009)
        self.add(2, f"{RT}/m/home", 2015, wikidata_url=f"{RT}/m/home")
        report = repair_urls.repair(self.db, "rotten_tomatoes", NOW, dry_run=True)
        self.assertEqual(report["movie"]["cleared"], 1)
        self.assertEqual(self.movies.count_documents({"rotten_tomatoes_url": {"$exists": True}}), 2)


if __name__ == "__main__":
    unittest.main()
