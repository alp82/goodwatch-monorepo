import unittest

from streaming_study_analysis import TOP_CUT, analyse, brand, display_name, findings


def offer(name, provider_id=0):
    return {"provider_name": name, "provider_id": provider_id}


def title(tmdb_id, score=80, first_country="US"):
    return {"tmdb_id": tmdb_id, "title": f"Title {tmdb_id}", "year": 2000, "score": score, "votes": 100000,
            "first_country": first_country}


class BrandTest(unittest.TestCase):
    def test_tiers_and_channels_count_as_their_brand_like_the_title_page(self):
        cases = {
            "Netflix Standard with Ads": "Netflix",
            "Amazon Prime Video": "Prime",
            "Amazon Prime Video with Ads": "Prime",
            "HBO Max Amazon Channel": "HBO Max",
            "MGM Plus Roku Premium Channel": "MGM+",
            "Paramount Plus Premium": "Paramount+",
            "Disney Plus": "Disney+",
            "Apple TV Plus": "Apple TV",
            "Peacock Premium": "Peacock",
        }
        for name, expected in cases.items():
            self.assertEqual(brand(name), expected, name)

    def test_spains_film_tier_is_movistar_plus_and_latin_americas_movistar_tv_stays_apart(self):
        self.assertEqual(brand("Movistar Plus+ Ficción Total "), "Movistar Plus+")
        self.assertEqual(brand("MovistarTV"), "MovistarTV")
        self.assertEqual(display_name("MovistarTV"), "Movistar TV")
        self.assertEqual(display_name("Prime"), "Prime Video")


class AnalyseTest(unittest.TestCase):
    def setUp(self):
        self.titles = [title(1, 90), title(2, 80, "JP"), title(3, 70), title(4, 60)]
        self.providers = {
            1: {"US": {"flatrate": [offer("Netflix", 8), offer("Netflix Standard with Ads", 1796)]},
                "JP": {"flatrate": [offer("Netflix", 8)]}},
            2: {"US": {"flatrate": [offer("Bloodstream")], "free": [offer("Kanopy")], "rent": [offer("Apple TV")]},
                "JP": {"flatrate": [offer("U-NEXT")]}},
            3: {"US": {"ads": [offer("Tubi TV")]}},
            4: None,  # deleted on TMDB
        }
        self.result = analyse("movie", self.titles, self.providers)
        self.countries = {c["code"]: c for c in self.result["countries"]}

    def test_a_title_tmdb_deleted_is_left_out(self):
        self.assertEqual(self.result["titles"], 3)
        self.assertEqual(self.result["deleted"], 1)

    def test_tiers_of_one_service_count_once(self):
        self.assertEqual(self.countries["US"]["netflix"], 1)
        self.assertEqual(self.countries["US"]["biggest_service"], "Netflix")
        self.assertEqual(self.countries["US"]["biggest_service_titles"], 1)

    def test_small_global_services_dont_count_as_a_subscription(self):
        self.assertEqual(self.countries["US"]["subscription"], 1)
        rows = {r["tmdb_id"]: r for r in self.result["title_rows"]}
        self.assertEqual(rows[2]["sub_countries"], ["JP"])

    def test_library_cards_and_ads_are_counted_apart(self):
        self.assertEqual(self.countries["US"]["library"], 1)
        self.assertEqual(self.countries["US"]["free_with_ads"], 1)
        self.assertEqual(self.countries["US"]["rent_or_buy"], 1)
        self.assertEqual(self.countries["US"]["any_way"], 3)

    def test_netflix_reach_counts_countries_with_netflix(self):
        self.assertEqual(self.result["netflix"], {"countries": 2, "titles_somewhere": 1, "titles_everywhere": 1,
                                                  "titles_in_one": 0})

    def test_the_best_rated_cut_takes_the_highest_scores(self):
        many = [title(i, score=i) for i in range(1, TOP_CUT["movie"] + 11)]
        providers = {t["tmdb_id"]: {"DE": {"flatrate": [offer("Netflix")]}} for t in many}
        result = analyse("movie", many, providers)
        self.assertEqual(result["top_cut"], TOP_CUT["movie"])
        self.assertEqual(result["countries"][0]["top_subscription"], TOP_CUT["movie"])
        self.assertEqual(result["title_rows"][0]["tmdb_id"], TOP_CUT["movie"] + 10)

    def test_findings_count_ghibli_and_japanese_films(self):
        shows = analyse("show", [], {})
        found = findings(self.result, shows, {"US": (100, 50), "JP": (90, 60)}, {2})
        self.assertEqual(found["ghibli"], 1)
        self.assertEqual(found["ghibli_in_japan"], 1)
        self.assertEqual(found["japanese"], 1)
        self.assertEqual(found["japanese_in_us"], 0)
        self.assertEqual(found["netflix_catalogue_us_rank_movies"], 1)
        self.assertEqual(found["netflix_catalogue_us_rank_shows"], 2)


if __name__ == "__main__":
    unittest.main()
