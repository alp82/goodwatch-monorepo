"""Rotten Tomatoes and Metacritic crawls from known URLs, with season critic scores (#152).

No network and no real database: the site is a fake client serving hand-built pages,
MongoDB is mongomock and CrateDB is a recording connector.
"""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
sys.path.insert(0, str(Path(__file__).parent))
from f.critic_sites import crawl, polite_http, publish
import test_critic_sites_parse as pages

NOW = datetime(2026, 9, 25, 12, 0, 0)
RT = "https://www.rottentomatoes.com"
MC = "https://www.metacritic.com"


class FakeClient:
    """Serves {requested url: (status, final url, html)}; anything else is a 404."""

    def __init__(self, site, routes=None, block_on=None):
        self.site = site
        self.routes = routes or {}
        self.block_on = block_on or set()
        self.requested = []

    def get(self, url):
        self.requested.append(url)
        if url in self.block_on:
            raise polite_http.SiteBlocked(self.site, NOW + timedelta(hours=24), "HTTP 403")
        status, final, html = self.routes.get(url, (404, url, "not found"))
        return polite_http.Page(status=status, url=final, text=html, requested_url=url)


def rt_show(slug, name, year, critic=None, count=0, seasons=(), canonical=None):
    canonical = canonical or f"{RT}/tv/{slug}"
    path = canonical[len(RT):]
    tiles = [(f"{path}/s{number:02d}", f"Season {number}", f"{score}%" if score is not None else "")
             for number, score in seasons]
    return pages.rt_page(canonical, {"@type": "TVSeries", "name": name, "dateCreated": f"{year}-01-20"},
                         pages.rt_scorecard(critic=critic, critic_count=count, audience=90, banded="1,000+ Ratings"),
                         tiles=tiles)


def rt_season(url, critic, count, audience=70, liked=70, not_liked=30):
    return pages.rt_page(url, {"@type": "TVSeason", "name": "Season"},
                         pages.rt_scorecard(critic=critic, critic_count=count, audience=audience, liked=liked,
                                            not_liked=not_liked))


def rt_movie(slug, name, year):
    return pages.rt_page(f"{RT}/m/{slug}", {"@type": "Movie", "name": name, "dateCreated": f"{year}-05-01"},
                         pages.rt_scorecard(critic=80, critic_count=40, audience=75, banded="500+ Ratings"))


def mc_show(slug, title, year, imdb_id, seasons=()):
    product = {"type": "show", "title": title, "slug": slug, "premiereYear": year,
               "criticScoreSummary": pages.summary(f"/tv/{slug}/critic-reviews/", 83, 181), "imdbId": imdb_id}
    return pages.mc_page(f"{MC}/tv/{slug}/", product,
                         [{"item": pages.summary(f"/tv/{slug}/user-reviews/", 7.7, 947, 10)}],
                         [pages.mc_season(slug, number, score, count) for number, score, count in seasons])


class CrawlTestCase(unittest.TestCase):
    site = "rotten_tomatoes"

    def setUp(self):
        self.db = mongomock.MongoClient().db
        crawl.ensure_indexes(self.db)
        self.conf = crawl.SITES[self.site]

    def add_show(self, tmdb_id, title, year, popularity=50.0, url=None, wikidata_url=None, source=None,
                 airing=False, imdb_id=None, next_crawl_at=crawl.EPOCH, original=None, last=None,
                 alternative_titles=(), translations=(), **rating):
        last_air = datetime(2026, 9, 1) if airing else datetime(last or year + 3, 1, 1)
        details = {"tmdb_id": tmdb_id, "title": title, "original_title": original or title, "popularity": popularity,
                   "first_air_date": datetime(year, 1, 20), "in_production": airing,
                   "last_air_date": last_air, "external_ids": {"imdb_id": imdb_id},
                   "alternative_titles": [{"iso_3166_1": "US", "title": alt} for alt in alternative_titles],
                   "translations": [{"iso_639_1": "xx", "data": {"title": name}} for name in translations]}
        self.db.tmdb_tv_details.insert_one(details)
        doc = {"tmdb_id": tmdb_id, "original_title": title, "popularity": popularity, "release_year": year,
               "title_variations": [title.lower().replace(" ", "_")], **rating}
        if url:
            doc[self.conf.url_field] = url
        if source:
            doc["url_source"] = source
        if wikidata_url:
            doc["wikidata_url"] = wikidata_url
        if next_crawl_at is not None:
            doc["next_crawl_at"] = next_crawl_at
        self.db[self.conf.collection("tv")].insert_one(doc)

    def add_movie(self, tmdb_id, title, year, popularity=10.0, url=None, wikidata_url=None, **rating):
        self.db.tmdb_movie_details.insert_one({"tmdb_id": tmdb_id, "title": title, "original_title": title,
                                               "popularity": popularity, "release_date": datetime(year, 5, 1)})
        doc = {"tmdb_id": tmdb_id, "original_title": title, "popularity": popularity, "release_year": year,
               "title_variations": [title.lower().replace(" ", "_")], "next_crawl_at": crawl.EPOCH, **rating}
        if url:
            doc[self.conf.url_field] = url
        if wikidata_url:
            doc["wikidata_url"] = wikidata_url
        self.db[self.conf.collection("movie")].insert_one(doc)

    def rating(self, tmdb_id, kind="tv"):
        return self.db[self.conf.collection(kind)].find_one({"tmdb_id": tmdb_id})

    def seasons(self, tmdb_id):
        return {doc["season_number"]: doc for doc in self.db[self.conf.season_collection].find({"tmdb_id": tmdb_id})}

    def crawl(self, client, kind="tv", now=NOW):
        docs = crawl.next_titles(self.db, self.site, kind, now, limit=50)
        return crawl.crawl_titles(self.db, client, self.site, kind, docs, now)


class RottenTomatoesShowTests(CrawlTestCase):
    def test_legacy_url_redirect_stores_the_canonical_url_show_and_season_scores(self):
        self.add_show(1396, "Breaking Bad", 2008, url=f"{RT}/tv/breaking-bad", tomato_score_original=50)
        client = FakeClient(self.site, {
            f"{RT}/tv/breaking-bad": (200, f"{RT}/tv/breaking_bad",
                                      rt_show("breaking_bad", "Breaking Bad", 2008, 96, 250,
                                              seasons=[(1, 86), (2, 97), (3, None)])),
            f"{RT}/tv/breaking_bad/s01": (200, f"{RT}/tv/breaking_bad/s01", rt_season(f"{RT}/tv/breaking_bad/s01", 86, 28)),
            f"{RT}/tv/breaking_bad/s02": (200, f"{RT}/tv/breaking_bad/s02", rt_season(f"{RT}/tv/breaking_bad/s02", 97, 40)),
        })
        report = self.crawl(client)

        doc = self.rating(1396)
        self.assertEqual(doc["rotten_tomatoes_url"], f"{RT}/tv/breaking_bad")
        self.assertEqual(doc["url_source"], "crawl")
        self.assertEqual(doc["url_verified_at"], NOW)
        self.assertEqual((doc["tomato_score_original"], doc["tomato_score_vote_count"]), (96, 250))
        self.assertEqual(doc["tomato_score_normalized_percent"], 96)
        self.assertEqual(doc["crawl_status"], "ok")
        self.assertEqual(doc["updated_at"], NOW)
        # An ended show comes back after 90 days.
        self.assertEqual(doc["next_crawl_at"], NOW + timedelta(days=90))

        seasons = self.seasons(1396)
        self.assertEqual(sorted(seasons), [1, 2, 3])
        self.assertEqual((seasons[1]["tomato_score_original"], seasons[1]["tomato_score_vote_count"]), (86, 28))
        self.assertEqual((seasons[2]["audience_score_original"], seasons[2]["audience_score_vote_count"]), (70, 100))
        self.assertIsNone(seasons[3].get("tomato_score_original"))
        self.assertEqual(seasons[1]["url"], f"{RT}/tv/breaking_bad/s01")
        # Season pages only for seasons with a Tomatometer: s03 has none.
        self.assertNotIn(f"{RT}/tv/breaking_bad/s03", client.requested)
        self.assertEqual(report["ok"], 1)
        self.assertEqual(report["requests"], 3)

    def test_wikidata_url_goes_first_and_keeps_its_source(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear_2022", wikidata_url=f"{RT}/tv/the_bear")
        client = FakeClient(self.site, {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, 99, 100)),
        })
        self.crawl(client)
        doc = self.rating(1)
        self.assertEqual(client.requested, [f"{RT}/tv/the_bear"])
        self.assertEqual((doc["rotten_tomatoes_url"], doc["url_source"]), (f"{RT}/tv/the_bear", "wikidata"))

    def test_stored_url_is_the_fallback_when_the_wikidata_url_is_gone(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear", wikidata_url=f"{RT}/tv/the_bear_2022")
        client = FakeClient(self.site, {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, 99, 100)),
        })
        self.crawl(client)
        self.assertEqual(client.requested, [f"{RT}/tv/the_bear_2022", f"{RT}/tv/the_bear"])
        self.assertEqual(self.rating(1)["crawl_status"], "ok")

    def test_a_missing_page_is_negatively_cached_and_the_old_values_backed_up(self):
        self.add_show(1, "Knowing Bros", 2015, url=f"{RT}/tv/knowing_bros", source="wikidata",
                      wikidata_url=f"{RT}/tv/knowing_bros", tomato_score_original=80, tomato_score_vote_count=5)
        self.db[self.conf.season_collection].insert_one({"tmdb_id": 1, "season_number": 1})
        self.crawl(FakeClient(self.site))
        doc = self.rating(1)
        self.assertNotIn("rotten_tomatoes_url", doc)
        self.assertNotIn("tomato_score_original", doc)
        self.assertEqual(doc["not_found_url"], f"{RT}/tv/knowing_bros")
        self.assertEqual(doc["not_found_until"], NOW + timedelta(days=90))
        self.assertEqual(doc["next_crawl_at"], NOW + timedelta(days=90))
        self.assertEqual(doc["crawl_status"], "not_found")
        self.assertEqual(self.seasons(1), {})
        backup = self.db[crawl.backup_collection_name(NOW)].find_one({"tmdb_id": 1})
        self.assertEqual(backup["previous"]["rotten_tomatoes_url"], f"{RT}/tv/knowing_bros")
        self.assertEqual(backup["previous"]["tomato_score_original"], 80)

        # The weekly Wikidata backfill refills the same URL; it is skipped until the date.
        self.db[self.conf.collection("tv")].update_one(
            {"tmdb_id": 1}, {"$set": {"rotten_tomatoes_url": f"{RT}/tv/knowing_bros", "url_source": "wikidata",
                                      "next_crawl_at": crawl.EPOCH}})
        client = FakeClient(self.site)
        self.crawl(client, now=NOW + timedelta(days=7))
        self.assertEqual(client.requested, [])
        self.assertEqual(self.rating(1)["next_crawl_at"], NOW + timedelta(days=90))

    def test_a_page_for_another_title_is_rejected(self):
        # A guessed URL for a 2019 show that points at a 1995 show of the same name.
        self.add_show(1, "The Family", 2019, url=f"{RT}/tv/the_family", tomato_score_original=40)
        self.crawl(FakeClient(self.site, {
            f"{RT}/tv/the_family": (200, f"{RT}/tv/the_family", rt_show("the_family", "The Family", 1995, 40, 5)),
        }))
        doc = self.rating(1)
        self.assertEqual(doc["crawl_status"], "rejected")
        self.assertEqual(doc["rejected_url"], f"{RT}/tv/the_family")
        self.assertEqual(doc["rejected_reason"], "year_mismatch")
        self.assertNotIn("rotten_tomatoes_url", doc)
        self.assertNotIn("tomato_score_original", doc)

    def test_a_redirect_away_from_title_pages_counts_as_not_found(self):
        self.add_show(1, "Gone", 2020, url=f"{RT}/tv/gone")
        self.crawl(FakeClient(self.site, {f"{RT}/tv/gone": (200, f"{RT}/", "<html>home</html>")}))
        self.assertEqual(self.rating(1)["crawl_status"], "not_found")

    def test_airing_shows_come_back_weekly(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear", airing=True)
        self.crawl(FakeClient(self.site, {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, 99, 100)),
        }))
        self.assertEqual(self.rating(1)["next_crawl_at"], NOW + timedelta(days=7))

    def test_fresh_season_pages_are_not_fetched_again_except_the_latest_season(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear", airing=True)
        routes = {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, 99, 100,
                                                                   seasons=[(1, 100), (2, 99)])),
            f"{RT}/tv/the_bear/s01": (200, f"{RT}/tv/the_bear/s01", rt_season(f"{RT}/tv/the_bear/s01", 100, 30)),
            f"{RT}/tv/the_bear/s02": (200, f"{RT}/tv/the_bear/s02", rt_season(f"{RT}/tv/the_bear/s02", 99, 50)),
        }
        self.crawl(FakeClient(self.site, routes))
        client = FakeClient(self.site, routes)
        self.crawl(client, now=NOW + timedelta(days=7))
        self.assertEqual(client.requested, [f"{RT}/tv/the_bear", f"{RT}/tv/the_bear/s02"])
        # The review count from the earlier season page is kept.
        self.assertEqual(self.seasons(1)[1]["tomato_score_vote_count"], 30)

    def test_seasons_the_site_no_longer_lists_are_removed(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear")
        self.db[self.conf.season_collection].insert_one({"tmdb_id": 1, "season_number": 9})
        self.crawl(FakeClient(self.site, {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, seasons=[(1, None)])),
        }))
        self.assertEqual(sorted(self.seasons(1)), [1])


class QueueTests(CrawlTestCase):
    def test_only_due_titles_in_popularity_order_and_each_once(self):
        self.add_show(1, "A", 2020, popularity=5, url=f"{RT}/tv/a")
        self.add_show(2, "B", 2020, popularity=50, url=f"{RT}/tv/b")
        self.add_show(3, "C", 2020, popularity=99, url=f"{RT}/tv/c", next_crawl_at=NOW + timedelta(days=1))
        self.add_show(4, "D", 2020, popularity=80, url=f"{RT}/tv/d", tmdb_deleted=True)
        first = crawl.next_titles(self.db, self.site, "tv", NOW, limit=1)
        second = crawl.next_titles(self.db, self.site, "tv", NOW, limit=5)
        self.assertEqual([doc["tmdb_id"] for doc in first], [2])
        self.assertEqual([doc["tmdb_id"] for doc in second], [1])
        self.assertEqual(crawl.next_titles(self.db, self.site, "tv", NOW, limit=5), [])

    def test_titles_with_a_known_url_are_scheduled_once(self):
        self.add_show(1, "A", 2020, url=f"{RT}/tv/a", next_crawl_at=None)
        self.add_show(2, "B", 2020, wikidata_url=f"{RT}/tv/b", next_crawl_at=None)
        self.add_show(3, "C", 2020, next_crawl_at=None)
        self.add_show(4, "D", 2020, url=f"{RT}/tv/d", next_crawl_at=NOW)
        counts = crawl.schedule_known_urls(self.db, self.site)
        self.assertEqual(counts["tv"], 2)
        scheduled = {doc["tmdb_id"]: doc.get("next_crawl_at") for doc in self.db[self.conf.collection("tv")].find()}
        self.assertEqual(scheduled, {1: crawl.EPOCH, 2: crawl.EPOCH, 3: None, 4: NOW})


class DuplicateUrlTests(CrawlTestCase):
    def test_a_url_on_several_titles_stays_only_on_the_matching_one(self):
        url = f"{RT}/m/good_night"
        self.add_movie(10, "Good Night", 1999, popularity=30, url=url, tomato_score_original=70)
        self.add_movie(11, "Good Night", 2020, popularity=5, url=url, tomato_score_original=70)
        self.add_movie(12, "Good Night", 2015, popularity=3, url=url, tomato_score_original=70)
        client = FakeClient(self.site, {url: (200, url, rt_movie("good_night", "Good Night", 2020))})
        report = self.crawl(client, kind="movie")

        self.assertEqual(client.requested, [url])  # one request for the whole group
        winner = self.rating(11, "movie")
        self.assertEqual((winner["rotten_tomatoes_url"], winner["crawl_status"]), (url, "ok"))
        self.assertEqual(winner["tomato_score_original"], 80)
        for loser in (10, 12):
            doc = self.rating(loser, "movie")
            self.assertNotIn("rotten_tomatoes_url", doc)
            self.assertNotIn("tomato_score_original", doc)
            self.assertEqual((doc["rejected_url"], doc["rejected_reason"]), (url, "duplicate"))
        self.assertEqual(report["duplicates_cleared"], 2)
        self.assertEqual(self.db[crawl.backup_collection_name(NOW)].count_documents({}), 2)

    def test_the_wikidata_holder_wins_a_tie(self):
        url = f"{RT}/tv/monster"
        self.add_show(1, "Monster", 2022, popularity=80, url=url)
        self.add_show(2, "Monster", 2022, popularity=5, url=url, wikidata_url=url, source="wikidata")
        self.crawl(FakeClient(self.site, {url: (200, url, rt_show("monster", "Monster", 2022, 70, 20))}))
        self.assertEqual(self.rating(2)["crawl_status"], "ok")
        self.assertEqual(self.rating(1)["rejected_reason"], "duplicate")


class MetacriticTests(CrawlTestCase):
    site = "metacritic"

    def test_show_page_gives_every_season_metascore_verified_by_imdb_id(self):
        self.add_show(136315, "The Bear", 2022, url=f"{MC}/tv/the-bear", imdb_id="tt14452776", airing=True)
        client = FakeClient(self.site, {
            f"{MC}/tv/the-bear/": (200, f"{MC}/tv/the-bear/",
                                   mc_show("the-bear", "The Bear", 2022, "tt14452776",
                                           seasons=[(0, None, None), (1, 88, 24), (2, 92, 43)])),
        })
        self.crawl(client)
        doc = self.rating(136315)
        self.assertEqual(doc["metacritic_url"], f"{MC}/tv/the-bear")
        self.assertEqual((doc["meta_score_original"], doc["meta_score_vote_count"]), (83, 181))
        self.assertEqual((doc["user_score_original"], doc["user_score_normalized_percent"]), (7.7, 77.0))
        self.assertTrue(doc["imdb_id_verified"])
        seasons = self.seasons(136315)
        self.assertEqual({n: (s["meta_score_original"], s["meta_score_vote_count"]) for n, s in seasons.items()},
                         {1: (88, 24), 2: (92, 43)})
        # Season pages only for the user score, fetched with the season URL the page lists.
        self.assertEqual(client.requested, [f"{MC}/tv/the-bear/", f"{MC}/tv/the-bear/season-1/",
                                            f"{MC}/tv/the-bear/season-2/"])

    def test_an_imdb_id_of_another_catalog_title_rejects_even_a_wikidata_url(self):
        self.add_show(1, "The Office", 2005, url=f"{MC}/tv/the-office", source="wikidata",
                      wikidata_url=f"{MC}/tv/the-office", imdb_id="tt0386676")
        self.add_show(2, "The Office", 2001, imdb_id="tt0290978", next_crawl_at=None)  # the UK show, no URL
        self.crawl(FakeClient(self.site, {
            f"{MC}/tv/the-office/": (200, f"{MC}/tv/the-office/", mc_show("the-office", "The Office", 2001, "tt0290978")),
        }))
        doc = self.rating(1)
        self.assertEqual((doc["crawl_status"], doc["rejected_reason"]), ("rejected", "imdb_mismatch"))
        self.assertNotIn("metacritic_url", doc)
        # What the page said is kept, so the rejection can be re-evaluated without a request.
        self.assertEqual(doc["rejected_page"], {"title": "The Office", "year": 2001, "imdb_id": "tt0290978"})

    def test_an_imdb_mismatch_rejects_when_wikidata_points_elsewhere(self):
        self.add_show(1, "Heartland", 2007, url=f"{MC}/tv/heartland", wikidata_url=f"{MC}/tv/heartland-ca",
                      imdb_id="tt1094229", airing=True)
        self.crawl(FakeClient(self.site, {
            f"{MC}/tv/heartland-ca/": (404, f"{MC}/tv/heartland-ca/", ""),
            f"{MC}/tv/heartland/": (200, f"{MC}/tv/heartland/", mc_show("heartland", "Heartland", 2007, "tt0839847")),
        }))
        self.assertEqual(self.rating(1)["rejected_reason"], "imdb_mismatch")

    def test_the_catalog_check_keeps_cbc_heartland_off_the_tnt_page(self):
        # Audit: Wikidata wrongly gives CBC's Heartland the page of TNT's 2007 Heartland (tmdb 2756).
        self.add_show(14929, "Heartland", 2007, url=f"{MC}/tv/heartland", wikidata_url=f"{MC}/tv/heartland",
                      imdb_id="tt1094229", airing=True)
        self.add_show(2756, "Heartland", 2007, imdb_id="tt0839847", next_crawl_at=None)
        self.crawl(FakeClient(self.site, {
            f"{MC}/tv/heartland/": (200, f"{MC}/tv/heartland/", mc_show("heartland", "Heartland", 2007, "tt0839847")),
        }))
        self.assertEqual(self.rating(14929)["rejected_reason"], "imdb_mismatch")

    def test_an_imdb_mismatch_falls_back_to_title_and_year(self):
        # Audit: Metacritic gives The Six Million Dollar Man the IMDb id of its 1973 pilot film,
        # After Midnight another id; Wikidata, the title and the year agree.
        self.add_show(1663, "The Six Million Dollar Man", 1974, url=f"{MC}/tv/the-six-million-dollar-man",
                      wikidata_url=f"{MC}/tv/the-six-million-dollar-man", imdb_id="tt0071054", last=1978)
        self.add_show(242965, "After Midnight", 2024, url=f"{MC}/tv/after-midnight",
                      wikidata_url=f"{MC}/tv/after-midnight", imdb_id="tt30787693", last=2025)
        self.crawl(FakeClient(self.site, {
            f"{MC}/tv/the-six-million-dollar-man/": (200, f"{MC}/tv/the-six-million-dollar-man/", mc_show(
                "the-six-million-dollar-man", "The Six Million Dollar Man", 1973, "tt0070698")),
            f"{MC}/tv/after-midnight/": (200, f"{MC}/tv/after-midnight/",
                                         mc_show("after-midnight", "After Midnight", 2024, "tt26672652")),
        }))
        for tmdb_id in (1663, 242965):
            doc = self.rating(tmdb_id)
            self.assertEqual(doc["crawl_status"], "ok")
            self.assertFalse(doc["imdb_id_verified"])
            self.assertEqual(doc["meta_score_original"], 83)

    def test_an_imdb_mismatch_with_another_title_or_year_is_still_rejected(self):
        self.add_show(1, "Charlie's Angels", 1976, url=f"{MC}/tv/charlies-angels", imdb_id="tt0073972", last=1981)
        self.add_show(2, "Mayday", 2003, url=f"{MC}/tv/mayday", imdb_id="tt0386950", airing=True)
        self.crawl(FakeClient(self.site, {
            f"{MC}/tv/charlies-angels/": (200, f"{MC}/tv/charlies-angels/",
                                          mc_show("charlies-angels", "Charlie's Angels", 2011, "tt1760943")),
            f"{MC}/tv/mayday/": (200, f"{MC}/tv/mayday/", mc_show("mayday", "Mayday!", 1990, "tt0465537")),
        }))
        self.assertEqual(self.rating(1)["rejected_reason"], "year_mismatch")
        self.assertEqual(self.rating(2)["rejected_reason"], "year_mismatch")

    def test_the_title_holding_the_page_imdb_id_wins_a_shared_url(self):
        url = f"{MC}/tv/charlies-angels"
        self.add_show(3382, "Charlie's Angels", 1976, popularity=90, url=url, imdb_id="tt0073972", last=1981)
        self.add_show(35282, "Charlie's Angels", 2011, popularity=10, url=url, imdb_id="tt1760943", last=2011)
        self.crawl(FakeClient(self.site, {
            f"{url}/": (200, f"{url}/", mc_show("charlies-angels", "Charlie's Angels", 2011, "tt1760943")),
        }))
        self.assertEqual(self.rating(35282)["crawl_status"], "ok")
        self.assertEqual(self.rating(3382)["rejected_reason"], "duplicate")


class AuditSampleTests(CrawlTestCase):
    """Rotten Tomatoes verification against the audit's sampled rejections
    (docs/research/critic-url-verification-audit.md)."""

    def page(self, slug, name, year, canonical=None):
        canonical = canonical or f"{RT}/tv/{slug}"
        return (200, canonical, rt_show(slug, name, year, 90, 20, canonical=canonical))

    def test_false_rejections_are_now_accepted(self):
        self.add_show(291, "Coronation Street", 1960, url=f"{RT}/tv/coronation_street", airing=True)
        self.add_show(95334, "DNA Journey", 2019, url=f"{RT}/tv/dna_journey", airing=True)
        self.add_show(20477, "Wogan", 1982, url=f"{RT}/tv/wogan", last=1992)
        self.add_show(45782, "Sword Art Online", 2012, url=f"{RT}/tv/sword_art_online", last=2020,
                      original="ソードアート・オンライン")
        self.add_show(61374, "Tokyo Ghoul", 2014, url=f"{RT}/tv/tokyo_ghoul", last=2018, original="東京喰種トーキョーグール")
        self.add_show(1948, "Degrassi", 2001, url=f"{RT}/tv/degrassi", last=2015,
                      alternative_titles=["Degrassi: The Next Generation"])
        self.add_show(113988, "DAHMER - Monster: The Jeffrey Dahmer Story", 2022,
                      url=f"{RT}/tv/dahmer_monster_the_jeffrey_dahmer_story", last=2022,
                      alternative_titles=["DAHMER", "Monster: The Jeffrey Dahmer Story"])
        self.crawl(FakeClient(self.site, {
            f"{RT}/tv/coronation_street": self.page("coronation_street", "Coronation Street", 2000),
            f"{RT}/tv/dna_journey": self.page("dna_journey", "DNA Journey", 2021),
            f"{RT}/tv/wogan": self.page("wogan", "Wogan", 1984),
            f"{RT}/tv/sword_art_online": self.page("sword_art_online_alicization", "Sword Art Online: Alicization",
                                                   2012),
            f"{RT}/tv/tokyo_ghoul": self.page("tokyo_ghoul_a", "東京喰種トーキョーグール √A", 2014),
            f"{RT}/tv/degrassi": self.page("degrassi_the_next_generation", "Degrassi: The Next Generation", 2001),
            f"{RT}/tv/dahmer_monster_the_jeffrey_dahmer_story": self.page("monster", "Monster", 2022),
        }))
        for tmdb_id in (291, 95334, 20477, 45782, 61374, 1948, 113988):
            doc = self.rating(tmdb_id)
            self.assertEqual(doc["crawl_status"], "ok", doc["tmdb_id"])
            self.assertEqual(doc["tomato_score_original"], 90)

    def test_a_localized_page_title_matches_a_tmdb_translation(self):
        # Father Brown (2013) against the 1974 series of the same name, on "Padre Brown, detective".
        url = f"{RT}/tv/father_brown"
        self.add_show(61511, "Father Brown", 2013, popularity=60, url=url, airing=True,
                      translations=["Padre Brown", "Padre Brown, detective"])
        self.add_show(30283, "Father Brown", 1974, popularity=8, url=url, last=1974)
        self.crawl(FakeClient(self.site, {url: self.page("father_brown", "Padre Brown, detective", 2013)}))
        self.assertEqual(self.rating(61511)["crawl_status"], "ok")
        self.assertEqual(self.rating(30283)["rejected_reason"], "duplicate")

    def test_a_shared_url_goes_to_the_show_whose_run_holds_the_page_year(self):
        # Doraemon: RT dates the page to the 2014 US dub of the 2005 anime.
        url = f"{RT}/tv/doraemon"
        self.add_show(57911, "Doraemon", 1979, popularity=90, url=url, last=2005, original="ドラえもん")
        self.add_show(65733, "Doraemon", 2005, popularity=40, url=url, airing=True, original="ドラえもん")
        self.add_show(57912, "Doraemon", 1973, popularity=5, url=url, last=1973, original="ドラえもん")
        self.crawl(FakeClient(self.site, {url: self.page("doraemon", "Doraemon", 2014)}))
        self.assertEqual(self.rating(65733)["crawl_status"], "ok")
        for loser in (57911, 57912):
            self.assertEqual(self.rating(loser)["rejected_reason"], "duplicate")

    def test_a_premiere_year_match_beats_a_run_match(self):
        # Shameless UK (2004-2013) contains 2011, but the US show premiered in 2011.
        url = f"{RT}/tv/shameless"
        self.add_show(1, "Shameless", 2004, popularity=90, url=url, last=2013)
        self.add_show(2, "Shameless", 2011, popularity=40, url=url, last=2021)
        self.crawl(FakeClient(self.site, {url: self.page("shameless", "Shameless", 2011)}))
        self.assertEqual(self.rating(2)["crawl_status"], "ok")
        self.assertEqual(self.rating(1)["rejected_reason"], "duplicate")

    def test_true_rejections_stay_rejected(self):
        self.add_show(1, "The Scandal", 2026, url=f"{RT}/tv/scandals", airing=True)
        self.add_show(2, "Sherri", 2022, url=f"{RT}/tv/sherri", airing=True)
        self.add_show(3, "Hollywood Squares", 1998, url=f"{RT}/tv/hollywood_squares", last=2004)
        self.add_show(4, "Monster", 2004, url=f"{RT}/tv/monster", last=2005, original="MONSTER")
        self.add_show(5, "Number 96", 1972, url=f"{RT}/tv/number_96", last=1977)
        self.add_show(6, "Yu Yu Hakusho", 1992, url=f"{RT}/tv/yu_yu_hakusho", last=1995, original="幽☆遊☆白書")
        self.add_show(7, "Rurouni Kenshin", 1996, url=f"{RT}/tv/rurouni_kenshin", last=1998,
                      translations=["Samurai X"])
        self.add_show(8, "Tony Awards", 1956, url=f"{RT}/tv/tony_awards", airing=True)  # known, still rejected
        self.add_show(9, "Survivor", 2017, url=f"{RT}/tv/survivor", airing=True)
        self.crawl(FakeClient(self.site, {
            f"{RT}/tv/scandals": self.page("scandals", "Scandal", 2012),
            f"{RT}/tv/sherri": self.page("sherri", "Sherri", 2009),
            f"{RT}/tv/hollywood_squares": self.page("hollywood_squares", "Hollywood Squares", 2025),
            f"{RT}/tv/monster": self.page("monster", "Monster", 2017),
            f"{RT}/tv/number_96": self.page("number_96", "Number 96", 1980),
            f"{RT}/tv/yu_yu_hakusho": self.page("yu_yu_hakusho", "Yu Yu Hakusho", 2023),
            f"{RT}/tv/rurouni_kenshin": self.page("samurai_x", "Samurai X", 2003),
            f"{RT}/tv/tony_awards": self.page("tony_awards", "Tony Awards", 1947),
            f"{RT}/tv/survivor": self.page("survivor", "Survivor", 2000),
        }))
        for tmdb_id in range(1, 10):
            doc = self.rating(tmdb_id)
            self.assertEqual((doc["crawl_status"], doc["rejected_reason"]), ("rejected", "year_mismatch"), tmdb_id)

    def test_a_wikidata_holder_keeps_a_page_another_run_contains(self):
        # Big Brother UK (2000-) and Shameless UK against their US pages, held through Wikidata.
        url = f"{RT}/tv/big_brother"
        self.add_show(1, "Big Brother", 2000, popularity=90, url=url, airing=True)
        self.add_show(2, "Big Brother", 2000, popularity=40, url=url, wikidata_url=url, airing=True)
        self.crawl(FakeClient(self.site, {url: self.page("big_brother", "Big Brother", 2000)}))
        self.assertEqual(self.rating(2)["crawl_status"], "ok")
        self.assertEqual(self.rating(1)["rejected_reason"], "duplicate")

    def test_when_no_holder_matches_each_gets_its_own_reason(self):
        url = f"{RT}/tv/la_promesa"
        self.add_show(1, "La promesa", 2023, popularity=50, url=url, airing=True)
        self.add_show(2, "The Promise", 2019, popularity=10, url=url, last=2019)
        self.crawl(FakeClient(self.site, {url: self.page("la_promesa", "La promesa", 2013)}))
        self.assertEqual(self.rating(1)["rejected_reason"], "year_mismatch")
        self.assertEqual(self.rating(2)["rejected_reason"], "title_mismatch")
        self.assertEqual(self.rating(2)["rejected_page"], {"title": "La promesa", "year": 2013, "imdb_id": None})


class BlockTests(CrawlTestCase):
    def test_a_block_stops_the_batch_and_releases_the_unfinished_titles(self):
        self.add_show(1, "A", 2020, popularity=90, url=f"{RT}/tv/a")
        self.add_show(2, "B", 2020, popularity=80, url=f"{RT}/tv/b")
        self.add_show(3, "C", 2020, popularity=70, url=f"{RT}/tv/c")
        client = FakeClient(self.site, {f"{RT}/tv/a": (200, f"{RT}/tv/a", rt_show("a", "A", 2020, 90, 10))},
                            block_on={f"{RT}/tv/b"})
        report = self.crawl(client)
        self.assertEqual(report["blocked"]["reason"], "HTTP 403")
        self.assertEqual(client.requested, [f"{RT}/tv/a", f"{RT}/tv/b"])
        self.assertEqual(self.rating(1)["crawl_status"], "ok")
        for tmdb_id in (2, 3):
            doc = self.rating(tmdb_id)
            self.assertNotIn("crawl_status", doc)
            self.assertEqual(doc["next_crawl_at"], NOW + timedelta(hours=24))
            self.assertEqual(doc["rotten_tomatoes_url"], f"{RT}/tv/{'b' if tmdb_id == 2 else 'c'}")

    def test_repeated_unexpected_pages_stop_the_crawl_as_a_possible_challenge(self):
        for tmdb_id in range(1, 6):
            self.add_show(tmdb_id, f"T{tmdb_id}", 2020, popularity=100 - tmdb_id, url=f"{RT}/tv/t{tmdb_id}")
        routes = {f"{RT}/tv/t{n}": (200, f"{RT}/tv/t{n}", "<html>odd</html>") for n in range(1, 6)}
        report = self.crawl(FakeClient(self.site, routes))
        self.assertEqual(report["blocked"]["reason"], "3 unexpected pages in a row")
        self.assertIsNotNone(polite_http.blocked_until(self.db, self.site, NOW))
        self.assertEqual(self.rating(1)["crawl_status"], "error")
        self.assertEqual(self.rating(4)["next_crawl_at"], polite_http.blocked_until(self.db, self.site, NOW))


class RecordingConnector:
    def __init__(self):
        self.upserts = []
        self.statements = []

    def upsert_many(self, table, records, conflict_columns, **kwargs):
        self.upserts.append((table, [record.model_dump() for record in records], conflict_columns, kwargs))
        return {"records_received": len(records), "rows_upserted": len(records)}

    def run(self, sql, params=None):
        self.statements.append((sql, params))


class PublishTests(CrawlTestCase):
    def test_season_rows_are_rewritten_per_show(self):
        seasons = self.db[self.conf.season_collection]
        seasons.insert_many([
            {"tmdb_id": 1396, "season_number": 1, "url": f"{RT}/tv/breaking_bad/s01", "tomato_score_original": 86,
             "tomato_score_vote_count": 28, "audience_score_original": 70, "audience_score_vote_count": 100},
            {"tmdb_id": 1396, "season_number": 2, "url": f"{RT}/tv/breaking_bad/s02", "tomato_score_original": None},
        ])
        connector = RecordingConnector()
        counts = publish.publish_seasons(self.db, connector, self.site, [1396, 7])
        table, rows, key, kwargs = connector.upserts[0]
        self.assertEqual(table, "rotten_tomatoes_season")
        self.assertEqual(key, ["show_id", "season_number"])
        self.assertTrue(kwargs["replace_nulls"])
        self.assertEqual(rows[0], {"show_id": 1396, "season_number": 1,
                                   "rotten_tomatoes_url": f"{RT}/tv/breaking_bad/s01",
                                   "rotten_tomatoes_tomato_score_original": 86.0,
                                   "rotten_tomatoes_tomato_score_review_count": 28,
                                   "rotten_tomatoes_audience_score_original": 70.0,
                                   "rotten_tomatoes_audience_score_rating_count": 100})
        delete_sql, params = connector.statements[0]
        self.assertIn("DELETE FROM rotten_tomatoes_season", delete_sql)
        self.assertEqual(params, ([1396, 7], ["1396:1", "1396:2"]))
        self.assertEqual(counts, {"shows": 2, "rows": 2})


class OnDemandTests(CrawlTestCase):
    """The per-title crawl for f/priority/crawl_all."""

    def test_a_title_without_a_known_url_sends_no_request(self):
        self.add_show(1, "Unknown", 2020, next_crawl_at=None)
        client = FakeClient(self.site)
        report = crawl.crawl_one_title(self.db, client, self.site, "tv", self.rating(1), NOW)
        self.assertEqual((report["skipped"], client.requested), (1, []))

    def test_a_title_crawled_today_is_not_crawled_again(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear", crawled_at=NOW - timedelta(hours=3))
        client = FakeClient(self.site)
        crawl.crawl_one_title(self.db, client, self.site, "tv", self.rating(1), NOW)
        self.assertEqual(client.requested, [])

    def test_a_known_url_is_crawled_and_its_seasons_published(self):
        self.add_show(1, "The Bear", 2022, url=f"{RT}/tv/the_bear", next_crawl_at=None)
        connector = RecordingConnector()
        client = FakeClient(self.site, {
            f"{RT}/tv/the_bear": (200, f"{RT}/tv/the_bear", rt_show("the_bear", "The Bear", 2022, 99, 100,
                                                                   seasons=[(1, None)])),
        })
        report = crawl.crawl_one_title(self.db, client, self.site, "tv", self.rating(1), NOW, connector)
        self.assertEqual(report["ok"], 1)
        self.assertEqual(connector.upserts[0][0], "rotten_tomatoes_season")


class ModelTests(unittest.TestCase):
    """Other jobs load the rating documents through mongoengine, which rejects unknown fields."""

    def test_documents_with_crawl_state_still_load(self):
        from mongoengine import connect, disconnect
        from f.metacritic_web.models import MetacriticTvRating
        from f.rotten_web.models import RottenTomatoesMovieRating

        disconnect()
        connect("critic_models", mongo_client_class=mongomock.MongoClient, uuidRepresentation="standard")
        self.addCleanup(disconnect)
        state = {"next_crawl_at": NOW, "crawled_at": NOW, "crawl_status": "rejected", "crawl_error": "HTTP 500",
                 "not_found_url": f"{RT}/m/x", "not_found_until": NOW, "rejected_url": f"{RT}/m/x",
                 "rejected_until": NOW, "rejected_reason": "duplicate",
                 "rejected_page": {"title": "X", "year": 2020, "imdb_id": None}}
        RottenTomatoesMovieRating._get_collection().insert_one({"tmdb_id": 1, **state})
        MetacriticTvRating._get_collection().insert_one({"tmdb_id": 1, **state, "imdb_id_verified": True})
        self.assertEqual(RottenTomatoesMovieRating.objects.get(tmdb_id=1).rejected_reason, "duplicate")
        self.assertTrue(MetacriticTvRating.objects.get(tmdb_id=1).imdb_id_verified)


if __name__ == "__main__":
    unittest.main()
