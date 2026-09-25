"""Rotten Tomatoes and Metacritic page parsers (#152).

The pages are small hand-built copies of the markup the live sites served on
2026-09-25: RT's `media-scorecard-json`, JSON-LD and `<tile-season>` elements, and
Metacritic's `__NUXT_DATA__` payload (devalue's flattened array format).
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.critic_sites import matching
from f.metacritic_web import site as mc
from f.rotten_web import site as rt


# ===== Rotten Tomatoes =====


def rt_scorecard(critic=None, critic_count=0, audience=None, liked=None, not_liked=None, banded="0 Ratings"):
    critics = {"likedCount": 0, "notLikedCount": 0, "ratingCount": critic_count, "reviewCount": critic_count,
               "title": "Tomatometer"}
    if critic is not None:
        critics["score"] = str(critic)
    audience_all = {"bandedRatingCount": banded, "scoreType": "ALL", "title": "Popcornmeter"}
    if audience is not None:
        audience_all["score"] = str(audience)
    if liked is not None:
        audience_all.update({"likedCount": liked, "notLikedCount": not_liked})
    return {"criticsScore": critics, "audienceScore": dict(audience_all),
            "overlay": {"audienceAll": audience_all}}


def rt_page(canonical, ld, scorecard, tiles=(), extra=""):
    tile_html = "".join(
        f'<tile-season slot="tile" href="{href}" skeleton="panel">'
        f'<rt-text size="1" context="label" slot="title">{title}</rt-text>'
        f'<rt-text slot="critics-score" size="0.75" context="label">{score}</rt-text>'
        f'<rt-text size="0.875" slot="air-date">Jul 2012</rt-text></tile-season>'
        for href, title, score in tiles)
    return (f'<html><head><link rel="canonical" href="{canonical}" />'
            f'<script type="application/ld+json">{json.dumps(ld)}</script></head><body>'
            f'<script id="media-scorecard-json" data-json="reviewsData" type="application/json">'
            f'{json.dumps(scorecard)}</script>{tile_html}{extra}</body></html>')


BREAKING_BAD = rt_page(
    "https://www.rottentomatoes.com/tv/breaking_bad",
    {"@context": "http://schema.org", "@type": "TVSeries", "name": "Breaking Bad", "dateCreated": "2008-01-20",
     "containsSeason": [{"@type": "TVSeason", "name": "Season 2", "url": "https://www.rottentomatoes.com/tv/breaking_bad/s02"},
                        {"@type": "TVSeason", "name": "Season 1", "url": "https://www.rottentomatoes.com/tv/breaking_bad/s01"}]},
    rt_scorecard(critic=96, critic_count=250, audience=97, banded="25,000+ Ratings"),
    tiles=[("/tv/breaking_bad/s02", "Season 2", "97%"), ("/tv/breaking_bad/s01", "Season 1", "86%")],
)


class RottenTomatoesParserTests(unittest.TestCase):
    def test_show_page_gives_show_scores_and_every_season_critic_score(self):
        page = rt.parse_title_page(BREAKING_BAD)
        self.assertEqual(page.canonical_url, "https://www.rottentomatoes.com/tv/breaking_bad")
        self.assertEqual(page.kind, "tv")
        self.assertEqual(page.title, "Breaking Bad")
        self.assertEqual(page.year, 2008)
        self.assertEqual((page.critic_score, page.critic_count), (96, 250))
        # "25,000+ Ratings" is all RT shows for a large audience.
        self.assertEqual((page.audience_score, page.audience_count), (97, 25000))
        self.assertEqual([(s.number, s.critic_score) for s in page.seasons], [(1, 86), (2, 97)])
        self.assertEqual(page.seasons[1].url, "https://www.rottentomatoes.com/tv/breaking_bad/s02")

    def test_unscored_seasons_and_part_seasons(self):
        html = rt_page(
            "https://www.rottentomatoes.com/tv/the_simpsons",
            {"@type": "TVSeries", "name": "The Simpsons", "dateCreated": "1989-12-17"},
            rt_scorecard(audience=76, banded="5,000+ Ratings"),
            tiles=[("/tv/the_simpsons/s37.2", "Simpsley", ""), ("/tv/the_simpsons/s37", "Season 37", ""),
                   ("/tv/the_simpsons/s02", "Season 2", "100%")],
        )
        page = rt.parse_title_page(html)
        self.assertIsNone(page.critic_score)
        self.assertIsNone(page.critic_count)
        # s37.2 is a special inside season 37, not a season.
        self.assertEqual([(s.number, s.critic_score) for s in page.seasons], [(2, 100), (37, None)])

    def test_seasons_fall_back_to_json_ld_without_tiles(self):
        html = BREAKING_BAD.split("<tile-season")[0] + "</body></html>"
        page = rt.parse_title_page(html)
        self.assertEqual([(s.number, s.critic_score) for s in page.seasons], [(1, None), (2, None)])

    def test_movie_page_year_from_title_or_release_year(self):
        html = rt_page("https://www.rottentomatoes.com/m/oppenheimer_2023",
                       {"@type": "Movie", "name": "Oppenheimer (2023)", "dateCreated": "2023-07-21"},
                       rt_scorecard(critic=93, critic_count=510, audience=88, liked=42300, not_liked=5513,
                                    banded="25,000+ Ratings"))
        page = rt.parse_title_page(html)
        self.assertEqual((page.kind, page.title, page.year), ("movie", "Oppenheimer", 2023))
        self.assertEqual(page.audience_count, 47813)
        other = rt_page("https://www.rottentomatoes.com/m/oppenheimer", {"@type": "Movie", "name": "Oppenheimer"},
                        rt_scorecard(), extra='<script>{"releaseYear":"2023","title":"Oppenheimer"}</script>')
        page = rt.parse_title_page(other)
        self.assertEqual(page.year, 2023)
        self.assertIsNone(page.critic_score)
        self.assertIsNone(page.audience_score)
        self.assertIsNone(page.audience_count)

    def test_season_page_gives_review_and_audience_counts(self):
        html = rt_page("https://www.rottentomatoes.com/tv/the_bear/s04",
                       {"@type": "TVSeason", "name": "Season 4"},
                       rt_scorecard(critic=84, critic_count=88, audience=69, liked=900, not_liked=390,
                                    banded="1,000+ Ratings"))
        scores = rt.parse_season_page(html)
        self.assertEqual((scores.critic_score, scores.critic_count), (84, 88))
        self.assertEqual((scores.audience_score, scores.audience_count), (69, 1290))

    def test_page_without_title_data_is_unparseable(self):
        self.assertIsNone(rt.parse_title_page("<html><title>Rotten Tomatoes</title></html>"))
        self.assertIsNone(rt.parse_season_page("<html></html>"))

    def test_title_urls(self):
        self.assertTrue(rt.is_title_url("https://www.rottentomatoes.com/tv/the-mentalist", "tv"))
        self.assertTrue(rt.is_title_url("https://www.rottentomatoes.com/m/oppenheimer_2023", "movie"))
        self.assertFalse(rt.is_title_url("https://www.rottentomatoes.com/m/oppenheimer_2023", "tv"))
        self.assertFalse(rt.is_title_url("https://www.rottentomatoes.com/", "tv"))
        self.assertFalse(rt.is_title_url("https://www.rottentomatoes.com/tv/x/s01", "tv"))
        self.assertEqual(rt.fetch_url("https://www.rottentomatoes.com/tv/x"), "https://www.rottentomatoes.com/tv/x")

    def test_sitemap_slugs(self):
        xml = ('<urlset><url><loc>https://www.rottentomatoes.com/tv/the-bear</loc></url>'
               '<url><loc>https://www.rottentomatoes.com/tv/the_simpsons</loc></url>'
               '<url><loc>https://www.rottentomatoes.com/tv/the-bear/s01</loc></url></urlset>')
        self.assertEqual(rt.sitemap_title_urls(xml), {"https://www.rottentomatoes.com/tv/the-bear",
                                                     "https://www.rottentomatoes.com/tv/the_simpsons"})


# ===== Metacritic =====


def devalue(root):
    """Flatten `root` the way Nuxt's devalue does: every value gets an index, and
    containers hold the indexes of their members. Objects are wrapped in Reactive."""
    out = []

    def add(value):
        index = len(out)
        out.append(None)
        if isinstance(value, dict):
            inner = {key: add(member) for key, member in value.items()}
            out[index] = ["Reactive", len(out)]
            out.append(inner)
        elif isinstance(value, list):
            out[index] = [add(member) for member in value]
        elif value is None:
            out[index] = None
        else:
            out[index] = value
        return index

    add(root)
    return out


def summary(url, score, count, maximum=100):
    return {"url": url, "max": maximum, "score": score, "reviewCount": count, "positiveCount": 1}


def mc_season(slug, number, score, count):
    season_slug = "specials" if number == 0 else f"season-{number}"
    return {"title": "The Bear", "seasonNumber": number, "releaseYear": 2021 + number,
            "criticScoreSummary": summary(f"/tv/{slug}/critic-reviews/?season={season_slug}", score, count),
            "url": f"/tv/{slug}/{season_slug}/", "seasonSlug": season_slug}


def mc_page(canonical, product, components, extra_seasons=()):
    data = devalue({"data": {"product": product, "components": components,
                             "seasons": list(extra_seasons)}, "state": {}})
    data = [["ShallowReactive", 1]] + [
        # shift every index by one: the payload starts with the ShallowReactive root
        shift(value) for value in data]
    return (f'<html><head><link rel="canonical" href="{canonical}"></head><body>'
            f'<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__">'
            f'{json.dumps(data)}</script></body></html>')


def shift(value):
    if isinstance(value, dict):
        return {key: member + 1 for key, member in value.items()}
    if isinstance(value, list):
        if value and isinstance(value[0], str):
            return [value[0], value[1] + 1]
        return [member + 1 for member in value]
    return value


BEAR_PRODUCT = {"id": 1, "type": "show", "title": "The Bear", "slug": "the-bear", "premiereYear": 2022,
                "criticScoreSummary": summary("/tv/the-bear/critic-reviews/", 83, 181),
                "seasonCount": 6, "imdbId": "tt14452776"}
BEAR_SEASONS = [mc_season("the-bear", 0, None, None), mc_season("the-bear", 1, 88, 24),
                mc_season("the-bear", 2, 92, 43), mc_season("the-bear", 4, None, 1)]
BEAR = mc_page("https://www.metacritic.com/tv/the-bear/", BEAR_PRODUCT,
               [{"item": summary("/tv/the-bear/user-reviews/", 7.7, 947, 10)},
                {"item": summary("/tv/the-office-uk/critic-reviews/", 97, 47)}],
               BEAR_SEASONS)


class MetacriticParserTests(unittest.TestCase):
    def test_show_page_gives_show_scores_imdb_id_and_every_season_metascore(self):
        page = mc.parse_title_page(BEAR)
        self.assertEqual(page.canonical_url, "https://www.metacritic.com/tv/the-bear")
        self.assertEqual((page.kind, page.title, page.year, page.imdb_id), ("tv", "The Bear", 2022, "tt14452776"))
        self.assertEqual((page.critic_score, page.critic_count), (83, 181))
        self.assertEqual((page.audience_score, page.audience_count), (7.7, 947))
        # Specials (season 0) are not a season; a season with too few reviews has no Metascore.
        self.assertEqual([(s.number, s.critic_score, s.critic_count) for s in page.seasons],
                         [(1, 88, 24), (2, 92, 43), (4, None, 1)])
        self.assertEqual(page.seasons[0].url, "https://www.metacritic.com/tv/the-bear/season-1")

    def test_season_page_gives_user_score(self):
        html = mc_page("https://www.metacritic.com/tv/the-bear/season-2/", BEAR_PRODUCT,
                       [{"item": summary("/tv/the-bear/user-reviews/?season=season-2", 6.3, 148, 10)}],
                       BEAR_SEASONS + [mc_season("the-bear", 2, 92, 43)])
        scores = mc.parse_season_page(html, 2)
        self.assertEqual((scores.critic_score, scores.critic_count), (92, 43))
        self.assertEqual((scores.audience_score, scores.audience_count), (6.3, 148))

    def test_movie_page(self):
        product = {"type": "movie", "title": "Oppenheimer", "slug": "oppenheimer", "premiereYear": 2023,
                   "criticScoreSummary": summary("/movie/oppenheimer/critic-reviews/", 90, 69),
                   "imdbId": "tt15398776"}
        html = mc_page("https://www.metacritic.com/movie/oppenheimer/", product,
                       [{"item": summary("/movie/oppenheimer/user-reviews/", 8.4, 2274, 10)}])
        page = mc.parse_title_page(html)
        self.assertEqual((page.kind, page.imdb_id, page.critic_score, page.audience_score, page.audience_count),
                         ("movie", "tt15398776", 90, 8.4, 2274))
        self.assertEqual(page.seasons, [])

    def test_page_without_nuxt_payload_is_unparseable(self):
        self.assertIsNone(mc.parse_title_page("<html><title>Just a moment...</title></html>"))

    def test_urls(self):
        self.assertEqual(mc.fetch_url("https://www.metacritic.com/tv/the-bear"), "https://www.metacritic.com/tv/the-bear/")
        self.assertTrue(mc.is_title_url("https://www.metacritic.com/tv/the-bear/", "tv"))
        self.assertFalse(mc.is_title_url("https://www.metacritic.com/tv/the-bear/season-1/", "tv"))
        self.assertTrue(mc.is_title_url("https://www.metacritic.com/movie/oppenheimer", "movie"))
        xml = ('<urlset><url><loc>https://www.metacritic.com/tv/the-bear/</loc></url>'
               '<url><loc>https://www.metacritic.com/tv/the-bear/season-1/</loc></url></urlset>')
        self.assertEqual(mc.sitemap_title_urls(xml), {"https://www.metacritic.com/tv/the-bear"})


# ===== Matching =====


class MatchingTests(unittest.TestCase):
    def test_canonical_url(self):
        self.assertEqual(matching.canonical_url("http://WWW.metacritic.com/tv/the-bear/?x=1"),
                         "https://www.metacritic.com/tv/the-bear")

    def test_titles(self):
        self.assertTrue(matching.title_matches("Law & Order", ["law_and_order"]))
        self.assertTrue(matching.title_matches("The Mentalist", ["Mentalist, The", "the_mentalist"]))
        self.assertTrue(matching.title_matches("Pokémon", ["pokemon"]))
        self.assertFalse(matching.title_matches("Home Alone", ["home"]))
        self.assertFalse(matching.title_matches("Good Night", ["Goodnight Mommy"]))
        self.assertFalse(matching.title_matches(None, ["x"]))

    def test_years(self):
        self.assertTrue(matching.year_matches(2023, 2022))
        self.assertFalse(matching.year_matches(2023, 2020))
        self.assertIsNone(matching.year_matches(None, 2020))


if __name__ == "__main__":
    unittest.main()
