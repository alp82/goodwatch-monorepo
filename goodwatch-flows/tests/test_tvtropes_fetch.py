"""Crawler regressions use real Chromium selectors against local HTTP fixtures."""

import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from playwright.async_api import async_playwright
from f.tvtropes_web.title_variations import title_variations
from f.tvtropes_web.models import (
    TvTropesMovieTags,
    TvTropesTvTags,
    TvTropesCrawlResult,
    TropeData,
)
from f.tvtropes_web.tv_tropes_crawl_tags import fetch

BASE = "https://tvtropes.org/pmwiki/pmwiki.php/"
TROPE = '<li><a href="/pmwiki/pmwiki.php/Main/BigBad">Big Bad</a>: A villain.</li>'


def article(intro, body=""):
    return f'<div id="main-article"><p>{intro}</p>{body}</div>'


def work(intro):
    return article(intro, "<h2>Tropes</h2><ul>" + TROPE + "</ul>")


class SlugTests(unittest.TestCase):
    def test_actual_broken_title_shapes(self):
        cases = {
            "12 Angry Men": "TwelveAngryMen",
            "300": "ThreeHundred",
            "2001: A Space Odyssey": "TwoThousandOneASpaceOdyssey",
            "(500) Days of Summer": "FiveHundredDaysOfSummer",
            "Fast & Furious 6": "FastAndFurious6",
            "Amélie": "Amelie",
            "Léon: The Professional": "LeonTheProfessional",
            "Kill Bill: Vol. 1": "KillBill",
            "Dr. Strangelove or: How I Learned to Stop Worrying": "DrStrangelove",
            "Marvel's Agents of S.H.I.E.L.D.": "AgentsOfSHIELD",
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertIn(expected, title_variations([title]))
        self.assertEqual(title_variations(["", "東京"]), [])

    def test_movie_disambiguation_uses_movie_collection(self):
        with patch.object(fetch.TvTropesMovieTags, "objects") as movies, patch.object(
            fetch.TvTropesTvTags, "objects"
        ) as shows:
            movies.return_value.count.return_value = 2
            self.assertTrue(fetch.is_ambiguous_title("The Thing", "Film"))
            shows.assert_not_called()

    def test_rate_limit_preserves_previous_source_and_tropes(self):
        old = datetime(2026, 1, 1)
        entry = TvTropesMovieTags(
            tmdb_id=1,
            original_title="Example",
            updated_at=old,
            tvtropes_url=BASE + "Film/Example",
            tropes=[TropeData(name="Old")],
        )
        with patch.object(TvTropesMovieTags, "save"):
            fetch.store_result(
                entry, TvTropesCrawlResult(url=None, tropes=[], rate_limit_reached=True)
            )
        self.assertEqual(entry.updated_at, old)
        self.assertEqual(entry.tropes[0].name, "Old")
        self.assertEqual(entry.tvtropes_url, BASE + "Film/Example")


class CrawlTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch()
        self.context = await self.browser.new_context()
        self.pages = {}
        self.requests = []

        async def route(request):
            key = request.request.url.removeprefix(BASE)
            self.requests.append(key)
            status, body, *headers = self.pages.get(
                key, (404, article("No work found"))
            )
            await request.fulfill(
                status=status,
                content_type="text/html",
                body=body,
                headers=headers[0] if headers else None,
            )

        await self.context.route("**/*", route)

    async def asyncTearDown(self):
        await self.browser.close()
        await self.playwright.stop()

    async def crawl(self, title, year, variations=None, media="Film"):
        cls = TvTropesMovieTags if media == "Film" else TvTropesTvTags
        entry = cls(
            original_title=title, release_year=year, title_variations=variations or []
        )
        result = await fetch.crawl_rotten_tomatoes_page(entry, media, self.context)
        self.assertEqual(self.context.pages, [])
        return result

    async def test_200_disambiguation_does_not_hide_correct_link(self):
        self.pages["Film/SpiderMan"] = (
            200,
            article(
                "Choose a work",
                '<ul><li>2002 film <a href="/pmwiki/pmwiki.php/Film/SpiderMan1">Spider-Man</a></li></ul>',
            ),
        )
        self.pages["Film/SpiderMan1"] = (
            200,
            work("Spider-Man is a 2002 superhero film."),
        )
        result = await self.crawl("Spider-Man", 2002)
        self.assertEqual(result.url, BASE + "Film/SpiderMan1")
        self.assertEqual(len(result.tropes), 1)

    async def test_namespace_follow_returns_before_next_bad_variation(self):
        self.pages["Film/Frozen"] = (
            404,
            article(
                "",
                '<a href="/pmwiki/pmwiki.php/WesternAnimation/Frozen">WesternAnimation/Frozen</a>',
            ),
        )
        self.pages["WesternAnimation/Frozen"] = (
            200,
            work("Frozen is a 2013 animated film."),
        )
        result = await self.crawl("Frozen", 2013, ["Unrelated"])
        self.assertEqual(result.url, BASE + "WesternAnimation/Frozen")
        self.assertNotIn("Film/Unrelated", self.requests)

    async def test_wrong_release_and_near_year_are_not_identity(self):
        self.pages["Film/TheThing"] = (
            200,
            work("The Thing is a 1982 film. A 2011 prequel followed."),
        )
        self.pages["Film/TheThing2010"] = (200, work("The Thing is a 2010 film."))
        self.pages["Film/TheThing2011"] = (
            200,
            article(
                "Choose",
                '<a href="/pmwiki/pmwiki.php/Film/TheThing2010">TheThing2010</a>',
            ),
        )
        result = await self.crawl("The Thing", 2011)
        self.assertFalse(result.tropes)

    async def test_franchise_and_other_media_are_rejected(self):
        self.pages["Film/Dune"] = (
            200,
            article(
                "Dune is a 2021 film.",
                '<a href="/pmwiki/pmwiki.php/Franchise/Dune">Dune</a><a href="/pmwiki/pmwiki.php/Series/Dune">Dune</a>',
            ),
        )
        result = await self.crawl("Dune", 2021)
        self.assertFalse(result.tropes)
        self.assertFalse(
            any(x.startswith(("Franchise/", "Series/")) for x in self.requests)
        )

    async def test_headingless_subpages_and_absolute_urls(self):
        self.pages["Film/CitizenKane1941"] = (
            200,
            article(
                "Citizen Kane is a 1941 film.",
                '<ul><li><a href="'
                + BASE
                + 'CitizenKane/TropesAToF">Tropes A to F</a></li></ul>',
            ),
        )
        self.pages["CitizenKane/TropesAToF"] = (
            200,
            article(
                "",
                "<hr><ul>"
                + TROPE
                + '<li><a href="'
                + BASE
                + 'Film/Other">Other work</a></li></ul>',
            ),
        )
        result = await self.crawl("Citizen Kane", 1941)
        self.assertEqual([t.name for t in result.tropes], ["Big Bad"])
        self.assertEqual(result.tropes[0].url, BASE + "Main/BigBad")

    async def test_rate_limited_subpage_discards_partial_result(self):
        self.pages["Film/CitizenKane1941"] = (
            200,
            work("Citizen Kane is a 1941 film.")[:-6]
            + '<a href="'
            + BASE
            + 'CitizenKane/TropesAToF">Tropes A to F</a></div>',
        )
        self.pages["CitizenKane/TropesAToF"] = (429, "Slow down")
        result = await self.crawl("Citizen Kane", 1941)
        self.assertTrue(result.rate_limit_reached)
        self.assertFalse(result.tropes)

    async def test_cloudflare_challenge_header_is_a_block(self):
        self.pages["Film/Example2000"] = (
            200,
            work("Example is a 2000 film."),
            {"cf-mitigated": "challenge"},
        )
        result = await self.crawl("Example", 2000)
        self.assertTrue(result.rate_limit_reached)
        self.assertFalse(result.tropes)

    async def test_leading_empty_paragraphs_do_not_hide_the_introduction(self):
        self.pages["Film/Example2000"] = (
            200,
            '<div id="main-article"><p></p><p> </p><p>\n</p><p></p>'
            "<p>Example is a 2000 film.</p><h2>Tropes</h2><ul>" + TROPE + "</ul></div>",
        )
        result = await self.crawl("Example", 2000)
        self.assertEqual(result.url, BASE + "Film/Example2000")
        self.assertEqual(len(result.tropes), 1)

    async def test_list_items_survive_dom_mutation_and_skip_linkless_items(self):
        self.pages["Film/Example2000"] = (
            200,
            article(
                "Example is a 2000 film.",
                "<h2>Tropes</h2><ul><li>No link here</li>"
                + TROPE
                + '<li><a href="/pmwiki/pmwiki.php/Main/TheHero"> The Hero </a>: Saves.</li></ul>'
                "<script>setInterval(() => { const ul = document.querySelector('ul');"
                " ul.innerHTML = ul.innerHTML; }, 1)</script>",
            ),
        )
        result = await self.crawl("Example", 2000)
        self.assertEqual([t.name for t in result.tropes], ["Big Bad", "The Hero"])
        self.assertIn(": Saves.", result.tropes[1].html)

    async def test_missing_subpage_is_failure_not_partial_success(self):
        self.pages["Film/CitizenKane1941"] = (
            200,
            article(
                "Citizen Kane is a 1941 film.",
                '<a href="' + BASE + 'CitizenKane/TropesAToF">Tropes A to F</a>',
            ),
        )
        with self.assertRaisesRegex(RuntimeError, "subpage failed"):
            await self.crawl("Citizen Kane", 1941)
        self.assertEqual(self.context.pages, [])

    async def test_animation_series_is_not_a_film_even_when_it_mentions_adaptation(
        self,
    ):
        self.pages["Film/Example"] = (
            404,
            article(
                "",
                '<a href="'
                + BASE
                + 'WesternAnimation/Example">WesternAnimation/Example</a>',
            ),
        )
        self.pages["WesternAnimation/Example"] = (
            200,
            work("Example is a 2000 television series. A 2000 film adapted it."),
        )
        result = await self.crawl("Example", 2000)
        self.assertFalse(result.tropes)

    async def test_shared_film_series_page_is_not_individual_work_evidence(self):
        self.pages["Film/KillBill"] = (200, work("Kill Bill is a 2003 two-part film."))
        result = await self.crawl("Kill Bill: Vol. 1", 2003)
        self.assertFalse(result.tropes)

    async def test_other_works_subpages_are_not_inherited(self):
        self.pages["Film/CitizenKane1941"] = (
            200,
            work("Citizen Kane is a 1941 film.")[:-6]
            + '<a href="'
            + BASE
            + 'OtherWork/TropesAToF">Tropes A to F</a></div>',
        )
        self.pages["OtherWork/TropesAToF"] = (
            200,
            article("", "<ul>" + TROPE + "</ul>"),
        )
        result = await self.crawl("Citizen Kane", 1941)
        self.assertEqual(len(result.tropes), 1)
        self.assertNotIn("OtherWork/TropesAToF", self.requests)

    async def test_missing_release_year_does_not_spend_requests(self):
        result = await self.crawl("Stranger Things", None)
        self.assertFalse(result.tropes)
        self.assertEqual(self.requests, [])

    async def test_empty_candidates_return_a_miss(self):
        result = await self.crawl("", 2000)
        self.assertIsNone(result.url)
        self.assertEqual(self.requests, [])

    async def test_crawl_exception_preserves_data_and_releases_queue_claim(self):
        old = datetime(2026, 1, 1)
        entry = TvTropesMovieTags(
            original_title="Example", tmdb_id=1, updated_at=old,
            is_selected=True, tvtropes_url=BASE + "Film/Example",
            tropes=[TropeData(name="Old")],
        )
        with patch.object(fetch, "crawl_data", new=AsyncMock(
            side_effect=RuntimeError("required subpage failed")
        )), patch.object(TvTropesMovieTags, "save") as save:
            with self.assertRaisesRegex(RuntimeError, "required subpage failed"):
                await fetch.tvtropes_crawl_tags(entry)
        save.assert_called_once()
        self.assertFalse(entry.is_selected)
        self.assertEqual(entry.updated_at, old)
        self.assertEqual(entry.tropes[0].name, "Old")
        self.assertEqual(entry.tvtropes_url, BASE + "Film/Example")
        self.assertIsNotNone(entry.failed_at)


if __name__ == "__main__":
    unittest.main()
