"""TV Tropes crawl over plain HTTP: identity rules, trope lists, subpages and known URLs.

Real pages come from the #120 recovery evidence (tests/fixtures/tvtropes); the
expected trope lists are the ones the earlier Playwright crawler extracted from
the same HTML, so the HTML port must reproduce them byte for byte.
"""

import gzip
import hashlib
import json
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.critic_sites.polite_http import Page, SiteBlocked
from f.tvtropes_web import crawl, pages

BASE = "https://tvtropes.org/pmwiki/pmwiki.php/"
FIXTURES = Path(__file__).parent / "fixtures" / "tvtropes"
EXPECTED = json.loads((FIXTURES / "expected.json").read_text())
TROPE = '<li><a href="/pmwiki/pmwiki.php/Main/BigBad">Big Bad</a>: A villain.</li>'


def article(intro, body=""):
    return f'<html><body><div id="main-article"><p>{intro}</p>{body}</div></body></html>'


def work(intro):
    return article(intro, "<h2>Tropes</h2><ul>" + TROPE + "</ul>")


def sha(tropes):
    payload = json.dumps([{"name": t["name"], "url": t["url"], "html": t["html"]} for t in tropes],
                         sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


class Site:
    """A fake `get`: pages by path (status, html[, final path]); everything else is a 404."""

    def __init__(self, pages=None):
        self.pages = dict(pages or {})
        self.requests = []

    def get(self, url):
        key = url.removeprefix(BASE)
        self.requests.append(key)
        status, html, *final = self.pages.get(key, (404, article("No work found")))
        if status == "blocked":
            raise SiteBlocked("tvtropes", datetime(2026, 9, 27), "HTTP 403")
        return Page(status=status, url=BASE + (final[0] if final else key), text=html, requested_url=url)


def fixture(name):
    return gzip.decompress((FIXTURES / name).read_bytes()).decode("utf-8")


def real_site():
    site = Site()
    for title in EXPECTED["titles"]:
        for url, page in title["pages"].items():
            site.pages[url.removeprefix(BASE)] = (200, fixture(page["file"]))
    return site


def run(site, title, year, urls, variations=None, media="movie", is_negative=lambda url: False):
    candidates = [(f"s{i}", url if "://" in url else BASE + url) for i, url in enumerate(urls)]
    return crawl.crawl_title(site.get, media, title, year, variations or [], candidates, is_negative)


class RealPageTests(unittest.TestCase):
    def test_recovered_titles_match_the_browser_crawl_exactly(self):
        for title in EXPECTED["titles"]:
            if title["tmdb_id"] == 1425:  # House of Cards: the UK page was a reviewed wrong match
                continue
            with self.subTest(title=title["title"]):
                site = real_site()
                outcome = run(site, title["title"], title["release_year"], [title["recorded_url"]],
                              title["title_variations"], title["media_type"])
                self.assertEqual(outcome.status, "recovered")
                self.assertEqual(outcome.url, title["recorded_url"])
                self.assertEqual(len(outcome.tropes), title["trope_count"])
                self.assertEqual(sha(outcome.tropes), title["tropes_sha256"])
                # One request per page: the work page and each of its subpages.
                self.assertEqual(len(site.requests), len(title["pages"]))

    def test_citizen_kane_reads_its_three_subpages(self):
        site = real_site()
        outcome = run(site, "Citizen Kane", 1941, ["Film/CitizenKane"])
        self.assertEqual(site.requests, ["Film/CitizenKane", "CitizenKane/TropesAToD", "CitizenKane/TropesEToM",
                                         "CitizenKane/TropesNToZ"])
        self.assertEqual(len(outcome.tropes), 231)

    def test_escaped_attributes_match_the_browser(self):
        # Band of Brothers links to a URL with "<!--C3-->" in it; browsers escape < and > in attributes.
        outcome = run(real_site(), "Band of Brothers", 2001, ["Series/BandOfBrothers2001"], media="show")
        composite = next(t for t in outcome.tropes if t["name"] == "Composite Character")
        self.assertIn("Ren&lt;!--C3--&gt;A9e_Lemaire", composite["html"])

    def test_house_of_cards_pages_are_not_the_2013_show(self):
        site = real_site()
        # The stored URL redirects to the Main/ disambiguation page.
        site.pages["Series/HouseOfCards"] = (200, fixture("Main__HouseOfCards.html.gz"), "Main/HouseOfCards")
        outcome = run(site, "House of Cards", 2013,
                      ["Series/HouseOfCards", "Series/HouseOfCardsUK", "Series/HouseOfCardsUS"], media="show")
        self.assertEqual(outcome.status, "rejected")
        self.assertEqual([c["outcome"] for c in outcome.candidates], ["rejected"] * 3)
        self.assertIn("redirect to " + BASE + "Main/HouseOfCards", outcome.candidates[0]["reason"])

    def test_source_year_is_skipped_on_the_real_page(self):
        page = pages.WorkPage(BASE + "Film/TwelveYearsASlave", fixture("Film__TwelveYearsASlave.html.gz"))
        self.assertTrue(pages.identifies_work(page, "12 Years a Slave", 2013, "movie", ["TwelveYearsASlave"]))
        self.assertFalse(pages.identifies_work(page, "12 Years a Slave", 2014, "movie", ["TwelveYearsASlave"]))
        self.assertFalse(pages.identifies_work(page, "12 Years a Slave", 2013, "tv", ["TwelveYearsASlave"]))


class KnownUrlTests(unittest.TestCase):
    def test_candidates_are_known_urls_in_order_without_duplicates(self):
        self.assertEqual(
            crawl.candidate_urls("movie", stored="http://www.tvtropes.org/pmwiki/pmwiki.php/Film/Oppenheimer",
                                 wikidata="Film/Oppenheimer2023", tvtropes2imdb="Oppenheimer"),
            [("stored", BASE + "Film/Oppenheimer"), ("wikidata", BASE + "Film/Oppenheimer2023")])
        # The mapping only covers films; shows get stored and Wikidata URLs only.
        self.assertEqual(crawl.candidate_urls("tv", tvtropes2imdb="Dark"), [])
        self.assertEqual(crawl.candidate_urls("tv", wikidata="Series/Dark"), [("wikidata", BASE + "Series/Dark")])
        self.assertEqual(crawl.candidate_urls("movie", stored="https://example.com/Film/X"), [])

    def test_no_known_url_and_no_release_year_send_no_request(self):
        site = Site()
        self.assertEqual(run(site, "Example", 2000, []).status, "no_known_url")
        self.assertEqual(run(site, "Stranger Things", None, ["Film/StrangerThings"]).status, "no_release_year")
        self.assertEqual(site.requests, [])

    def test_non_work_namespaces_are_rejected_without_a_request(self):
        site = Site()
        outcome = run(site, "The Mummy", 1999, ["Franchise/TheMummy", "Main/TheMummy", "Series/TheMummy"])
        self.assertEqual(outcome.status, "rejected")
        self.assertEqual({c["reason"] for c in outcome.candidates}, {"namespace"})
        self.assertEqual(site.requests, [])

    def test_a_missing_page_falls_through_to_the_next_known_url(self):
        site = Site({"Film/IronMan1": (200, work("Iron Man is a 2008 superhero film."))})
        outcome = run(site, "Iron Man", 2008, ["Film/IronMan", "Film/IronMan1"])
        self.assertEqual(outcome.status, "recovered")
        self.assertEqual(outcome.source, "s1")
        self.assertEqual([c["outcome"] for c in outcome.candidates], ["not_found", "identified"])

    def test_all_missing_is_not_found(self):
        outcome = run(Site(), "Example", 2000, ["Film/Example", "Film/Example2000"])
        self.assertEqual(outcome.status, "not_found")

    def test_negative_cache_skips_the_url(self):
        site = Site({"Film/Example2000": (200, work("Example is a 2000 film."))})
        outcome = run(site, "Example", 2000, ["Film/Example2000"], is_negative=lambda url: True)
        self.assertEqual(outcome.status, "no_known_url")
        self.assertEqual(site.requests, [])

    def test_a_block_propagates_and_stops_the_title(self):
        site = Site({"Film/A": ("blocked", ""), "Film/B": (200, work("Example is a 2000 film."))})
        with self.assertRaises(SiteBlocked):
            run(site, "Example", 2000, ["Film/A", "Film/B"])
        self.assertEqual(site.requests, ["Film/A"])

    def test_a_server_error_is_a_crawl_error(self):
        with self.assertRaisesRegex(crawl.CrawlError, "HTTP 500"):
            run(Site({"Film/Example": (500, "")}), "Example", 2000, ["Film/Example"])


class SubpageTests(unittest.TestCase):
    def test_headingless_subpages_and_absolute_urls(self):
        site = Site({
            "Film/CitizenKane1941": (200, article(
                "Citizen Kane is a 1941 film.",
                f'<ul><li><a href="{BASE}CitizenKane/TropesAToF">Tropes A to F</a></li></ul>')),
            "CitizenKane/TropesAToF": (200, article(
                "", "<hr><ul>" + TROPE + f'<li><a href="{BASE}Film/Other">Other work</a></li></ul>')),
        })
        outcome = run(site, "Citizen Kane", 1941, ["Film/CitizenKane1941"])
        self.assertEqual([t["name"] for t in outcome.tropes], ["Big Bad"])
        self.assertEqual(outcome.tropes[0]["url"], BASE + "Main/BigBad")

    def test_blocked_subpage_discards_the_partial_result(self):
        site = Site({
            "Film/CitizenKane1941": (200, work("Citizen Kane is a 1941 film.")[:-20]
                                     + f'<a href="{BASE}CitizenKane/TropesAToF">Tropes A to F</a></div></body></html>'),
            "CitizenKane/TropesAToF": ("blocked", ""),
        })
        with self.assertRaises(SiteBlocked):
            run(site, "Citizen Kane", 1941, ["Film/CitizenKane1941"])

    def test_missing_subpage_is_failure_not_partial_success(self):
        site = Site({"Film/CitizenKane1941": (200, article(
            "Citizen Kane is a 1941 film.", f'<a href="{BASE}CitizenKane/TropesAToF">Tropes A to F</a>'))})
        with self.assertRaisesRegex(crawl.CrawlError, "subpage failed"):
            run(site, "Citizen Kane", 1941, ["Film/CitizenKane1941"])

    def test_other_works_subpages_are_not_inherited(self):
        site = Site({
            "Film/CitizenKane1941": (200, article(
                "Citizen Kane is a 1941 film.",
                "<h2>Tropes</h2><ul>" + TROPE + f'</ul><a href="{BASE}OtherWork/TropesAToF">Tropes A to F</a>')),
        })
        outcome = run(site, "Citizen Kane", 1941, ["Film/CitizenKane1941"])
        self.assertEqual(len(outcome.tropes), 1)
        self.assertNotIn("OtherWork/TropesAToF", site.requests)

    def test_headingless_work_page_falls_back_to_top_level_list(self):
        site = Site({"Series/BandOfBrothers2001": (200, article(
            "Band of Brothers is a 2001 American war miniseries.",
            "<ul>" + TROPE + f'<li><a href="{BASE}Film/Other">Other</a></li></ul>'))})
        outcome = run(site, "Band of Brothers", 2001, ["Series/BandOfBrothers2001"], media="show")
        self.assertEqual([t["name"] for t in outcome.tropes], ["Big Bad"])

    def test_fallback_is_unused_when_primary_selectors_find_tropes(self):
        site = Site({"Film/Example2000": (200, article(
            "Example is a 2000 film.",
            '<ul><li><a href="/pmwiki/pmwiki.php/Main/Navigation">Nav</a></li></ul>'
            "<h2>Tropes</h2><ul>" + TROPE + "</ul>"))})
        self.assertEqual([t["name"] for t in run(site, "Example", 2000, ["Film/Example2000"]).tropes], ["Big Bad"])

    def test_linkless_items_are_skipped_and_the_name_prefix_removed(self):
        site = Site({"Film/Example2000": (200, article(
            "Example is a 2000 film.",
            "<h2>Tropes</h2><ul><li>No link here</li>" + TROPE
            + '<li><a href="/pmwiki/pmwiki.php/Main/TheHero"> The Hero </a>: Saves.</li></ul>'))})
        tropes = run(site, "Example", 2000, ["Film/Example2000"]).tropes
        self.assertEqual([t["name"] for t in tropes], ["Big Bad", "The Hero"])
        self.assertIn(": Saves.", tropes[1]["html"])

    def test_leading_empty_paragraphs_do_not_hide_the_introduction(self):
        site = Site({"Film/Example2000": (200, '<div id="main-article"><p></p><p> </p><p>\n</p>'
                                               "<p>Example is a 2000 film.</p><h2>Tropes</h2><ul>" + TROPE + "</ul></div>")})
        self.assertEqual(run(site, "Example", 2000, ["Film/Example2000"]).status, "recovered")

    def test_identified_page_without_tropes_reports_its_url(self):
        site = Site({"Film/Example2000": (200, article("Example is a 2000 film."))})
        outcome = run(site, "Example", 2000, ["Film/Example2000"])
        self.assertEqual((outcome.status, outcome.url), ("identified_no_tropes", BASE + "Film/Example2000"))


class IdentityTests(unittest.TestCase):
    """The #129 identity rules, unchanged from the browser crawler."""

    def identifies(self, name, intro, title, year, variations=None, media="movie", html=None):
        from f.tvtropes_web.title_variations import title_variations
        page = pages.WorkPage(BASE + name, html or work(intro))
        return pages.identifies_work(page, title, year, media, title_variations([title, *(variations or [])]))

    def test_http_200_alone_is_never_identity(self):
        self.assertFalse(self.identifies("Film/Example2000", "A page about something else.", "Example", 2000))
        self.assertFalse(self.identifies("Film/Example", "Example is a great film.", "Example", 2000))

    def test_wrong_release_year_is_not_identity(self):
        self.assertFalse(self.identifies("Film/TheThing", "The Thing is a 1982 film. A 2011 prequel followed.",
                                         "The Thing", 2011))

    def test_year_suffixed_page_name_is_year_evidence(self):
        self.assertTrue(self.identifies("Film/TheBatman2022", "The Batman is a detective superhero film.",
                                        "The Batman", 2022))
        self.assertTrue(self.identifies("Film/Venom2018", "Venom is a Superhero Horror movie from the makers of Iron Man (2008).",
                                        "Venom", 2018))
        self.assertTrue(self.identifies("Film/It2017", "It (a.k.a. It: Chapter One) is a 2017 supernatural horror film.",
                                        "It", 2017))
        self.assertTrue(self.identifies("Film/TwentyOneJumpStreet2012",
                                        "The 2012 loose film adaptation of the late 1980s series stars two cops.",
                                        "21 Jump Street", 2012))

    def test_same_name_with_a_different_year_suffix_is_rejected(self):
        self.assertFalse(self.identifies("Film/Dune1984", "Dune is a Science Fiction film.", "Dune", 2021))
        self.assertFalse(self.identifies(
            "WesternAnimation/TheIllusionist2010",
            "Not to be confused with the 2006 film of the same name, The Illusionist is a 2010 animated film.",
            "The Illusionist", 2006))

    def test_year_suffixed_name_in_a_disallowed_namespace_is_rejected(self):
        for name in ("Franchise/Dune2021", "Series/Dune2021", "Main/Dune2021"):
            self.assertFalse(self.identifies(name, "Dune is a Science Fiction film.", "Dune", 2021), name)
        self.assertTrue(self.identifies("Film/Dune2021", "Dune is a Science Fiction film.", "Dune", 2021))

    def test_year_suffixed_name_still_needs_a_consistent_kind_word(self):
        self.assertFalse(self.identifies("Film/Frozen2013", "Frozen is Disney's 53rd entry in its animated canon line-up.",
                                         "Frozen", 2013))
        self.assertFalse(self.identifies("Film/TheWitcher2019", "The Witcher is a Netflix-produced Dark Fantasy series.",
                                         "The Witcher", 2019))
        self.assertTrue(self.identifies("Series/TheWitcher2019", "The Witcher is a Netflix-produced Dark Fantasy series.",
                                        "The Witcher", 2019, media="tv"))

    def test_non_year_suffix_is_not_year_evidence(self):
        self.assertFalse(self.identifies("Film/SpiderMan1", "Spider-Man is a superhero film.", "Spider-Man", 2002))

    def test_kind_word_before_the_year_in_the_same_sentence(self):
        self.assertTrue(self.identifies("Film/SpiderMan1", "Spider-Man is the first movie in a trilogy, released in 2002. It stars a teenager.",
                                        "Spider-Man", 2002, ["SpiderMan1"]))

    def test_animation_series_is_not_a_film(self):
        self.assertFalse(self.identifies("WesternAnimation/Example", "Example is a 2000 television series. A 2000 film adapted it.",
                                         "Example", 2000))
        self.assertFalse(self.identifies("WesternAnimation/Example", "Example, not the film, is a 2000 animated series.",
                                         "Example", 2000))

    def test_title_is_not_read_as_a_year(self):
        intro = "2001: A Space Odyssey is a 1968 Science Fiction film."
        self.assertTrue(self.identifies("Film/TwoThousandOneASpaceOdyssey", intro, "2001: A Space Odyssey", 1968))
        self.assertFalse(self.identifies("Film/TwoThousandOneASpaceOdyssey", intro, "2001: A Space Odyssey", 1969))

    def test_festival_year_after_a_source_year_is_not_the_release(self):
        self.assertFalse(self.identifies("Film/ThreeHundred", "300 is a film based on the 1998 comic miniseries. It premiered in"
                                         " late 2006 before a wider release in early 2007.", "300", 2007))

    def test_incidental_two_films_remark_does_not_make_a_shared_page(self):
        self.assertTrue(self.identifies(
            "Film/LeonTheProfessional",
            "L&eacute;on: The Professional is a 1994 action thriller film by Luc Besson."
            " It grew out of an earlier character, though the two films are otherwise unrelated.",
            "Léon: The Professional", 1994))

    def test_pages_defined_as_a_set_of_films_are_rejected(self):
        self.assertFalse(self.identifies("Film/KillBill", "Kill Bill is a 2003 two-part film.", "Kill Bill: Vol. 1", 2003))
        self.assertFalse(self.identifies(
            "Film/TheGodfather", "The Godfather is a trilogy of American crime films directed by Francis Ford Coppola,"
            " based on the 1969 novel by Mario Puzo. The first movie came out in 1972.", "The Godfather", 1972))
        for definition in ("Example is a tetralogy of science fiction films.", "Example is a science fiction duology.",
                           "Example is a series of films about a heist crew.", "Example is a media franchise.",
                           "Example is a saga of four films.", "Example consists of 3 movies.",
                           "Example is a two-part fantasy epic."):
            self.assertFalse(self.identifies("Film/Example", definition + " The first film was released in 2003.",
                                             "Example", 2003), definition)

    def test_single_film_that_is_part_of_a_set_is_accepted(self):
        for intro in ("Example is a 2003 film, the third in the Sample trilogy.",
                      "Example is a 1985 science fiction comedy film. It's the first film in a trilogy.",
                      "Example is the first movie in Sam Raimi's Example Trilogy, released in 2002.",
                      "Example is a 2008 superhero film that launched a franchise.",
                      "Example is a 2001 film, the first of three films adapting the novel."):
            year = int(pages.re.search(pages.YEAR, intro).group())
            self.assertTrue(self.identifies("Film/Example", intro, "Example", year), intro)

    def test_two_volume_page_is_rejected_explicitly(self):
        intro = ("Kill Bill is a revenge saga by Quentin Tarantino. Miramax split it into two parts (Vol. 1,"
                 " released in 2003 as a film, and Vol. 2, released in 2004).")
        self.assertFalse(self.identifies("Film/KillBill", intro, "Kill Bill: Vol. 1", 2003))
        self.assertFalse(self.identifies("Film/KillBill2003", intro, "Kill Bill: Vol. 1", 2003))

    def test_country_suffixed_pages_need_their_own_dated_sentence(self):
        self.assertTrue(self.identifies("Series/TheOfficeUS", "The Office is a 2005 American sitcom.",
                                        "The Office", 2005, media="tv"))
        self.assertFalse(self.identifies("Series/HouseOfCardsUK", "House of Cards was remade in 2013 as an American series by Netflix.",
                                         "House of Cards", 2013, media="tv"))


class KnownUrlRuleTests(unittest.TestCase):
    """A curated URL (Wikidata, the mapping, a stored URL) needs the title and a year near the
    release, like the critic crawls; the medium comes from the namespace. Only the local
    runner uses it, since every recovered row is reviewed before import."""

    def known(self, name, html, title, year, media="movie", original_title=None):
        from f.tvtropes_web.title_variations import title_variations
        page = pages.WorkPage(BASE + name, html)
        variations = title_variations([title, original_title or ""])
        return (pages.identifies_work(page, title, year, media, variations),
                pages.matches_known_url(page, title, year, media, variations))

    def test_real_pages_the_strict_rule_misses(self):
        # "a 2012 Live-Action Adaptation": no medium word, but Film/ and the year suffix say it.
        self.assertEqual(self.known("Film/TheAvengers2012", fixture("Film__TheAvengers2012.html.gz"), "The Avengers", 2012),
                         (False, True))
        self.assertEqual(self.known("Series/TheOfficeUS", fixture("Series__TheOfficeUS.2026-09-26.html.gz"),
                                    "The Office", 2005, "tv"), (False, True))

    def test_real_pages_the_known_url_rule_still_rejects(self):
        # No year in the introduction.
        self.assertEqual(self.known("Series/LawAndOrderSpecialVictimsUnit",
                                    fixture("Series__LawAndOrderSpecialVictimsUnit.html.gz"),
                                    "Law & Order: Special Victims Unit", 1999, "tv"), (False, False))
        # The wiki names the page for 2017; TMDB dates the show 2019.
        self.assertEqual(self.known("Series/TheChosen2017", fixture("Series__TheChosen2017.html.gz"), "The Chosen", 2019, "tv"),
                         (False, False))

    def test_tv_tropes_genre_words_stand_in_for_the_medium(self):
        for name, intro, title, year in (
                ("Series/LawAndOrder", "Law & Order is a long-running Dramatic Hour Long crime/courtroom drama created by"
                                       " Dick Wolf, which initially ran on NBC from 1990 to 2010.", "Law & Order", 1990),
                ("Series/TwentyFour", "The following takes place between 2001 and 2017. Events occur in real time. 24 is"
                                      " an American action drama.", "24", 2001),
                ("Series/EverybodyLovesRaymond", "Everybody Loves Raymond is a CBS Dom Com that ran from 1996 to 2005.",
                 "Everybody Loves Raymond", 1996),
                ("Series/SalatutElamat", "Salatut elämät is a Finnish Soap Opera that premiered on 25 January 1999.",
                 "Secret Lives", 1999)):
            with self.subTest(name):
                self.assertEqual(self.known(name, work(intro), title, year, "tv",
                                            original_title="Salatut elämät" if "Salatut" in name else None), (False, True))

    def test_the_title_and_a_near_year_are_still_required(self):
        intro = "Example is a CBS Dom Com that ran from 1996 to 2005."
        self.assertFalse(self.known("Series/Example", work(intro), "Other Show", 1996, "tv")[1])
        self.assertFalse(self.known("Series/Example", work(intro), "Example", 2004, "tv")[1])
        self.assertTrue(self.known("Series/Example", work(intro), "Example", 1997, "tv")[1])
        self.assertFalse(self.known("Series/Example", work("Example is a CBS Dom Com."), "Example", 1996, "tv")[1])

    def test_namespace_other_year_suffix_and_film_sets_still_reject(self):
        self.assertFalse(self.known("Film/Example", work("Example is a 1996 sitcom."), "Example", 1996, "tv")[1])
        self.assertFalse(self.known("Film/Example1984", work("Example is a 1985 thing."), "Example", 1985)[1])
        self.assertFalse(self.known("Film/Example", work("Example is a trilogy of 1999 action films."), "Example", 1999)[1])

    def test_animation_namespaces_need_the_medium_in_the_introduction(self):
        self.assertTrue(self.known("WesternAnimation/Example", work("Example is a 2000 animated series."), "Example", 2000, "tv")[1])
        self.assertFalse(self.known("WesternAnimation/Example", work("Example is a 2000 animated film."), "Example", 2000, "tv")[1])
        self.assertFalse(self.known("WesternAnimation/Example", work("Example premiered in 2000."), "Example", 2000, "tv")[1])

    def test_crawl_uses_the_rule_only_when_asked_and_says_which_rule_passed(self):
        site = Site({"Series/LawAndOrder": (200, work("Law & Order is a crime drama which ran on NBC from 1990 to 2010."))})
        strict = run(site, "Law & Order", 1990, ["Series/LawAndOrder"], media="tv")
        self.assertEqual(strict.status, "rejected")
        known = crawl.crawl_title(site.get, "tv", "Law & Order", 1990, [], [("wikidata", BASE + "Series/LawAndOrder")],
                                  known_url_rule=True)
        self.assertEqual((known.status, known.candidates[-1]["rule"]), ("recovered", "known_url"))

    def test_redirect_query_strings_are_dropped_from_the_page_url(self):
        site = Site({"Anime/Pokemon": (200, work("Pokemon is a 1997 anime series."), "Anime/Pokemon?from=Anime.Pokemon")})
        outcome = run(site, "Pokemon", 1997, ["Anime/Pokemon"], media="tv")
        self.assertEqual(outcome.url, BASE + "Anime/Pokemon")


class WorkPageTests(unittest.TestCase):
    def test_paragraphs_are_split_by_blocks_like_a_browser(self):
        # <p><div>quote</div></p> is an empty paragraph, the div and another empty paragraph.
        page = pages.WorkPage(BASE + "Film/X", '<div id="main-article"><p><div>"I will survive" 1841</div></p>'
                                               "<p>X is a 2013 film.</p></div>")
        self.assertEqual(page.introduction, "X is a 2013 film.")

    def test_normalize_url(self):
        self.assertEqual(pages.normalize_url("http://www.tvtropes.org/pmwiki/pmwiki.php/Film/X?from=Y"), BASE + "Film/X")
        self.assertIsNone(pages.normalize_url(BASE + "Film"))
        self.assertIsNone(pages.normalize_url("https://tvtropes.org/pmwiki/index.php"))


if __name__ == "__main__":
    unittest.main()
