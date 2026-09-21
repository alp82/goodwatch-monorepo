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

    def test_year_like_titles_also_get_the_year_reading(self):
        self.assertIn("NineteenSeventeen", title_variations(["1917"]))
        self.assertIn("OneThousandNineHundredSeventeen", title_variations(["1917"]))
        self.assertIn("NineteenFortyOneTheMovie", title_variations(["1941 The Movie"]))
        # Cardinal-only outside 1100-1999 and for x00/x0y (no "Oh" forms yet).
        self.assertEqual(title_variations(["300"]), ["300", "ThreeHundred"])
        self.assertEqual(len(title_variations(["2001"])), 2)
        self.assertEqual(len(title_variations(["1900"])), 2)
        self.assertEqual(len(title_variations(["1905"])), 2)

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


class PacingTests(unittest.IsolatedAsyncioTestCase):
    async def test_consecutive_navigations_are_spaced(self):
        import time

        starts = []

        class Page:
            async def goto(self, url):
                starts.append(time.monotonic())
                return url

        with patch.object(fetch, "REQUEST_DELAY_SECONDS", 0.05), patch.object(
            fetch, "_last_navigation", None
        ):
            for url in ("a", "b", "c"):
                self.assertEqual(await fetch.paced_goto(Page(), url), url)

        self.assertGreaterEqual(starts[1] - starts[0], 0.045)
        self.assertGreaterEqual(starts[2] - starts[1], 0.045)


class CrawlTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        delay = patch.object(fetch, "REQUEST_DELAY_SECONDS", 0)
        delay.start()
        self.addCleanup(delay.stop)
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

    # --- identity gaps (unresolved-analysis-2026-09-21) ---

    async def test_year_suffixed_page_name_is_year_evidence(self):
        self.pages["Film/TheBatman2022"] = (
            200,
            work("The Batman is a detective superhero film based on the comics."),
        )
        result = await self.crawl("The Batman", 2022)
        self.assertEqual(result.url, BASE + "Film/TheBatman2022")

    async def test_year_suffixed_name_beats_a_source_or_credit_year(self):
        self.pages["Film/Venom2018"] = (
            200,
            work("Venom is a Superhero Horror movie from the makers of Iron Man (2008)."),
        )
        self.assertTrue((await self.crawl("Venom", 2018)).tropes)

    async def test_year_suffixed_name_covers_short_and_unnamed_titles(self):
        self.pages["Film/It2017"] = (
            200,
            work("It (a.k.a. It: Chapter One) is a 2017 supernatural horror film."),
        )
        self.pages["Film/TwentyOneJumpStreet2012"] = (
            200,
            work("The 2012 loose film adaptation of the late 1980s series stars two cops."),
        )
        self.assertTrue((await self.crawl("It", 2017)).tropes)
        self.assertTrue((await self.crawl("21 Jump Street", 2012)).tropes)

    async def test_year_suffix_applies_to_the_final_url_after_redirects(self):
        # The requested name carried the year, the page that answered does not.
        # (No fulfilled 3xx here: Chromium follows those past the route handler.)
        self.pages["Film/ExampleSaga"] = (200, work("Example is an adventure film."))
        page = await self.context.new_page()
        await page.goto(BASE + "Film/ExampleSaga")
        entry = TvTropesMovieTags(original_title="Example", release_year=2000)
        self.assertFalse(
            await fetch.identifies_work(page, entry, "Film", ["Example", "ExampleSaga"])
        )
        await page.close()

    async def test_same_name_with_a_different_year_suffix_is_rejected(self):
        self.pages["Film/Dune2021"] = (
            200,
            article(
                "Choose",
                '<a href="/pmwiki/pmwiki.php/Film/Dune1984">Dune</a>'
                '<a href="/pmwiki/pmwiki.php/Film/Dune2020">Dune</a>',
            ),
        )
        self.pages["Film/Dune1984"] = (200, work("Dune is a Science Fiction film."))
        self.pages["Film/Dune2020"] = (200, work("Dune is a Science Fiction film."))
        result = await self.crawl("Dune", 2021)
        self.assertIn("Film/Dune1984", self.requests)
        self.assertIn("Film/Dune2020", self.requests)
        self.assertFalse(result.tropes)

    async def test_other_year_suffix_is_rejected_even_when_intro_names_our_year(self):
        # Modelled on WesternAnimation/TheIllusionist2010, which was accepted
        # for the 2006 film because its intro mentions that film first.
        self.pages["Film/TheIllusionist2006"] = (
            404,
            article("", '<a href="' + BASE + 'WesternAnimation/TheIllusionist2010">x</a>'),
        )
        self.pages["WesternAnimation/TheIllusionist2010"] = (
            200,
            work(
                "Not to be confused with the 2006 film of the same name,"
                " The Illusionist is a 2010 animated film."
            ),
        )
        result = await self.crawl("The Illusionist", 2006)
        self.assertIn("WesternAnimation/TheIllusionist2010", self.requests)
        self.assertIsNone(result.url)

    async def test_year_suffixed_name_in_a_disallowed_namespace_is_rejected(self):
        page = await self.context.new_page()
        entry = TvTropesMovieTags(original_title="Dune", release_year=2021)
        for name in ("Franchise/Dune2021", "Series/Dune2021", "Film/Dune2021"):
            self.pages[name] = (200, work("Dune is a Science Fiction film."))
            await page.goto(BASE + name)
            self.assertEqual(
                await fetch.identifies_work(page, entry, "Film", ["Dune"]),
                name.startswith("Film/"),
            )
        await page.close()

    async def test_year_suffixed_name_still_needs_a_consistent_kind_word(self):
        self.pages["Film/Frozen2013"] = (
            200,
            work("Frozen is Disney's 53rd entry in its animated canon line-up."),
        )
        self.pages["Film/TheWitcher2019"] = (
            200,
            work("The Witcher is a Netflix-produced Dark Fantasy series."),
        )
        self.assertFalse((await self.crawl("Frozen", 2013)).tropes)
        self.assertFalse((await self.crawl("The Witcher", 2019)).tropes)
        self.pages["Series/TheWitcher2019"] = self.pages["Film/TheWitcher2019"]
        self.assertTrue((await self.crawl("The Witcher", 2019, media="Series")).tropes)

    async def test_non_year_suffix_is_not_year_evidence(self):
        self.pages["Film/SpiderMan"] = (
            200,
            article("Choose", '<a href="/pmwiki/pmwiki.php/Film/SpiderMan1">2002 film</a>'),
        )
        self.pages["Film/SpiderMan1"] = (200, work("Spider-Man is a superhero film."))
        self.assertFalse((await self.crawl("Spider-Man", 2002)).tropes)

    async def test_kind_word_before_the_year_in_the_same_sentence(self):
        self.pages["Film/SpiderMan1"] = (
            200,
            work("Spider-Man is the first movie in a trilogy, released in 2002. It stars a teenager."),
        )
        self.assertTrue((await self.crawl("Spider-Man", 2002, ["SpiderMan1"])).tropes)

    async def test_kind_after_the_year_still_wins_over_kind_before_it(self):
        self.pages["Film/Example"] = (
            404,
            article("", '<a href="' + BASE + 'WesternAnimation/Example">x</a>'),
        )
        self.pages["WesternAnimation/Example"] = (
            200,
            work("Example, not the film, is a 2000 animated series."),
        )
        self.assertFalse((await self.crawl("Example", 2000)).tropes)

    async def test_title_is_not_read_as_a_year(self):
        self.pages["Film/TwoThousandOneASpaceOdyssey"] = (
            200,
            work("2001: A Space Odyssey is a 1968 Science Fiction film."),
        )
        self.assertTrue((await self.crawl("2001: A Space Odyssey", 1968)).tropes)
        self.assertFalse((await self.crawl("2001: A Space Odyssey", 1969)).tropes)

    async def test_source_work_year_is_skipped_but_release_year_stays_exact(self):
        self.pages["Film/TwelveYearsASlave"] = (
            200,
            work(
                "12 Years a Slave refers both to the 1853 memoir by Solomon Northup"
                " and its 2013 film adaptation."
            ),
        )
        self.assertTrue((await self.crawl("12 Years a Slave", 2013)).tropes)
        self.assertFalse((await self.crawl("12 Years a Slave", 2014)).tropes)
        # 300: the year after the source year is a festival premiere, not the release.
        self.pages["Film/ThreeHundred"] = (
            200,
            work(
                "300 is a film based on the 1998 comic miniseries. It premiered in"
                " late 2006 before a wider release in early 2007."
            ),
        )
        self.assertFalse((await self.crawl("300", 2007)).tropes)

    async def test_incidental_two_films_remark_does_not_make_a_shared_page(self):
        self.pages["Film/LeonTheProfessional"] = (
            200,
            work(
                "L&eacute;on: The Professional is a 1994 action thriller film by Luc Besson."
                " It grew out of an earlier character, though the two films are otherwise unrelated."
            ),
        )
        result = await self.crawl("Léon: The Professional", 1994)
        self.assertEqual(result.url, BASE + "Film/LeonTheProfessional")
        self.assertTrue(result.tropes)

    async def test_trilogy_page_never_identifies_an_individual_film(self):
        # Modelled on Film/TheGodfather: the page defines itself as the set.
        self.pages["Film/TheGodfather"] = (
            200,
            work(
                "The Godfather is a trilogy of American crime films directed by"
                " Francis Ford Coppola, based on the 1969 novel by Mario Puzo."
                " The first movie came out in 1972, followed by The Godfather Part II"
                " in 1974 and The Godfather Part III in 1990."
            ),
        )
        for title, year in (
            ("The Godfather", 1972),
            ("The Godfather Part II", 1974),
            ("The Godfather Part III", 1990),
        ):
            self.assertFalse(
                (await self.crawl(title, year, ["TheGodfather"])).tropes, (title, year)
            )

    async def test_pages_defined_as_a_set_of_films_are_rejected(self):
        for definition in (
            "Example is a tetralogy of science fiction films.",
            "Example is a science fiction duology.",
            "Example is a series of films about a heist crew.",
            "Example is a media franchise.",
            "Example is a saga of four films.",
            "Example consists of 3 movies.",
            "Example is a two-part fantasy epic.",
        ):
            self.pages["Film/Example"] = (
                200,
                work(definition + " The first film was released in 2003."),
            )
            self.assertFalse((await self.crawl("Example", 2003)).tropes, definition)

    async def test_single_film_that_is_part_of_a_set_is_accepted(self):
        for intro in (
            "Example is a 2003 film, the third in the Sample trilogy.",
            # Back to the Future phrasing.
            "Example is a 1985 science fiction comedy film. It's the first film in a trilogy.",
            # Film/SpiderMan1 phrasing: the possessive is not a defining verb.
            "Example is the first movie in Sam Raimi's Example Trilogy, released in 2002.",
            "Example is a 2008 superhero film that launched a franchise.",
            "Example is a 2001 film, the first of three films adapting the novel.",
        ):
            self.pages["Film/Example"] = (200, work(intro))
            year = int(fetch.re.search(fetch.YEAR, intro).group())
            self.assertTrue((await self.crawl("Example", year)).tropes, intro)

    async def test_two_volume_page_is_rejected_explicitly(self):
        # Modelled on Film/KillBill: a kind word is present, so the rejection
        # cannot depend on "Vol." cutting the dated sentence short.
        self.pages["Film/KillBill"] = (
            200,
            work(
                "Kill Bill is a revenge saga by Quentin Tarantino."
                " Miramax split it into two parts (Vol. 1, released in 2003 as a film,"
                " and Vol. 2, released in 2004)."
            ),
        )
        self.assertFalse((await self.crawl("Kill Bill: Vol. 1", 2003)).tropes)
        self.pages["Film/KillBill2003"] = self.pages["Film/KillBill"]
        self.assertFalse((await self.crawl("Kill Bill: Vol. 1", 2003)).tropes)

    async def test_disambiguation_follows_closed_country_suffixes_only(self):
        self.pages["Series/TheOffice"] = (
            200,
            article(
                "The Office is actually the name of both a British sitcom and its American remake:",
                '<ul><li><a href="/pmwiki/pmwiki.php/Series/TheOfficeUK">The Office (UK)</a></li>'
                '<li><a href="/pmwiki/pmwiki.php/Series/TheOfficeUS">The Office (US)</a></li>'
                '<li><a href="/pmwiki/pmwiki.php/Series/TheOfficeParty">The Office Party</a></li>'
                '<li><a href="/pmwiki/pmwiki.php/Series/TheOfficeIndia">The Office (India)</a></li></ul>',
            ),
        )
        self.pages["Series/TheOfficeUK"] = (200, work("The Office is a 2001 British sitcom."))
        self.pages["Series/TheOfficeUS"] = (200, work("The Office is a 2005 American sitcom."))
        self.pages["Series/TheOfficeParty"] = (200, work("The Office is a 2005 sitcom."))
        self.pages["Series/TheOfficeIndia"] = (200, work("The Office is a 2005 sitcom."))
        result = await self.crawl("The Office", 2005, media="Series")
        self.assertEqual(result.url, BASE + "Series/TheOfficeUS")
        self.assertNotIn("Series/TheOfficeParty", self.requests)
        self.assertNotIn("Series/TheOfficeIndia", self.requests)

    async def test_country_suffixed_target_must_still_identify_the_work(self):
        self.pages["Series/HouseOfCards"] = (
            200,
            article(
                "House of Cards may refer to:",
                '<ul><li><a href="/pmwiki/pmwiki.php/Series/HouseOfCardsUK">House of Cards (UK)</a></li>'
                '<li><a href="/pmwiki/pmwiki.php/Series/HouseOfCardsUS">House of Cards (US)</a></li></ul>',
            ),
        )
        self.pages["Series/HouseOfCardsUK"] = (200, work("House of Cards is a 1990 BBC series."))
        self.pages["Series/HouseOfCardsUS"] = (200, work("House of Cards is a political series."))
        result = await self.crawl("House of Cards", 2013, media="Series")
        self.assertIn("Series/HouseOfCardsUS", self.requests)
        self.assertIsNone(result.url)

    HOUSE_OF_CARDS = article(
        "House of Cards may refer to:",
        '<ul><li><a href="/pmwiki/pmwiki.php/Series/HouseOfCardsUK">House of Cards (UK)</a></li>'
        '<li><a href="/pmwiki/pmwiki.php/Series/HouseOfCardsUS">House of Cards (US)</a></li></ul>',
    )

    async def test_country_suffixed_page_is_not_dated_by_a_sentence_about_its_remake(self):
        # Modelled on Series/HouseOfCardsUK: the only year belongs to the remake.
        self.pages["Series/HouseOfCards"] = (200, self.HOUSE_OF_CARDS)
        self.pages["Series/HouseOfCardsUK"] = (
            200,
            work(
                "House of Cards is a British TV show (based on the novel of the same name) "
                "about a scheming chief whip. This BBC series became very popular. "
                "Three series were made: In 2013, Netflix released an American-set "
                "original series based on the novel."
            ),
        )
        result = await self.crawl("House of Cards", 2013, media="Series")
        self.assertIn("Series/HouseOfCardsUK", self.requests)
        self.assertIsNone(result.url)

    async def test_country_suffixed_page_naming_a_remake_in_its_dated_sentence_is_rejected(self):
        self.pages["Series/HouseOfCards"] = (200, self.HOUSE_OF_CARDS)
        self.pages["Series/HouseOfCardsUK"] = (
            200,
            work("House of Cards was remade in 2013 as an American series by Netflix."),
        )
        result = await self.crawl("House of Cards", 2013, media="Series")
        self.assertIsNone(result.url)

    async def test_country_suffixed_remake_without_year_and_kind_in_one_sentence_stays_rejected(self):
        # Modelled on Series/HouseOfCardsUS: the kind word describes the original,
        # and the premiere sentence names neither the work nor its medium.
        self.pages["Series/HouseOfCards"] = (200, self.HOUSE_OF_CARDS)
        self.pages["Series/HouseOfCardsUS"] = (
            200,
            work(
                "House of Cards is the U.S. remake of the UK series of the same name. "
                "Developed by Beau Willimon and premiered on February 2013, it marked "
                "the first step in Netflix's original programming."
            ),
        )
        result = await self.crawl("House of Cards", 2013, media="Series")
        self.assertIn("Series/HouseOfCardsUS", self.requests)
        self.assertIsNone(result.url)

    async def test_country_suffix_is_not_followed_from_a_dated_work_page(self):
        self.pages["Series/TheOffice2005"] = (
            200,
            article(
                "The Office is a 2001 sitcom.",
                '<a href="/pmwiki/pmwiki.php/Series/TheOfficeUS">The Office (US)</a>',
            ),
        )
        await self.crawl("The Office", 2005, media="Series")
        self.assertNotIn("Series/TheOfficeUS", self.requests)

    async def test_headingless_work_page_falls_back_to_top_level_list(self):
        self.pages["Series/BandOfBrothers2001"] = (
            200,
            article(
                "Band of Brothers is a 2001 American war miniseries.",
                "<ul>" + TROPE + '<li><a href="' + BASE + 'Film/Other">Other</a></li></ul>',
            ),
        )
        result = await self.crawl("Band of Brothers", 2001, media="Series")
        self.assertEqual([t.name for t in result.tropes], ["Big Bad"])

    async def test_fallback_is_unused_when_primary_selectors_find_tropes(self):
        self.pages["Film/Example2000"] = (
            200,
            article(
                "Example is a 2000 film.",
                '<ul><li><a href="/pmwiki/pmwiki.php/Main/Navigation">Nav</a></li></ul>'
                "<h2>Tropes</h2><ul>" + TROPE + "</ul>",
            ),
        )
        result = await self.crawl("Example", 2000)
        self.assertEqual([t.name for t in result.tropes], ["Big Bad"])

    async def test_identified_page_without_tropes_reports_its_url(self):
        self.pages["Film/Example2000"] = (200, article("Example is a 2000 film."))
        result = await self.crawl("Example", 2000)
        self.assertEqual(result.url, BASE + "Film/Example2000")
        self.assertFalse(result.tropes)

    async def test_http_200_alone_is_never_identity(self):
        self.pages["Film/Example2000"] = (200, work("A page about something else."))
        self.pages["Film/Example"] = (200, work("Example is a great film."))
        result = await self.crawl("Example", 2000)
        self.assertIsNone(result.url)

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
