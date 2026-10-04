"""Run with: python3 -m unittest test_sitemap_query (in this directory)."""
import unittest

from sitemap_query import DETAILS_MAX_AGE_DAYS, FILTER_CONDITION, TITLE_LIMIT, detail_query


class DetailQueryTest(unittest.TestCase):
    def test_lists_only_titles_whose_details_were_read_recently(self):
        self.assertIn(
            f"tmdb_details_updated_at > now() - INTERVAL '{DETAILS_MAX_AGE_DAYS} days'",
            FILTER_CONDITION,
        )
        for table in ("movie", "show"):
            self.assertIn(FILTER_CONDITION, detail_query(table))

    def test_keeps_the_quality_conditions(self):
        for condition in (
            "goodwatch_overall_score_voting_count > 5000",
            "goodwatch_overall_score_normalized_percent > 30",
            "release_year IS NOT NULL",
            "poster_path IS NOT NULL",
        ):
            self.assertIn(condition, FILTER_CONDITION)

    def test_reads_each_table_with_its_limit_in_a_stable_order(self):
        movie = detail_query("movie")
        show = detail_query("show")
        self.assertIn("FROM movie WHERE", movie)
        self.assertTrue(movie.endswith(f"ORDER BY popularity DESC, tmdb_id ASC LIMIT {TITLE_LIMIT['movie']}"))
        self.assertIn("FROM show WHERE", show)
        self.assertTrue(show.endswith(f"LIMIT {TITLE_LIMIT['show']}"))

    def test_rejects_other_tables(self):
        with self.assertRaises(ValueError):
            detail_query("person")


if __name__ == "__main__":
    unittest.main()
