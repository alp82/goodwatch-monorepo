import unittest
from sitemap_query import detail_query, DETAILS_MAX_AGE_DAYS


class DetailQueryTest(unittest.TestCase):
    def test_shared_eligibility(self):
        for kind in ('movie', 'show'):
            sql = detail_query(kind)
            for condition in ('goodwatch_overall_score_voting_count > 5000',
                              'goodwatch_overall_score_normalized_percent >= 60',
                              'release_year IS NOT NULL', 'poster_path IS NOT NULL',
                              "trim(synopsis) <> ''", '(adult = false OR adult IS NULL)',
                              f"INTERVAL '{DETAILS_MAX_AGE_DAYS} days'"):
                self.assertIn(condition, sql)
            self.assertTrue(sql.endswith('ORDER BY goodwatch_overall_score_voting_count DESC, tmdb_id ASC'))
            self.assertNotIn('LIMIT ', sql)  # Retained titles can fall below a rank cutoff.

    def test_release_and_format_checks(self):
        self.assertIn("release_date <= now() AND status = 'Released'", detail_query('movie'))
        sql = detail_query('show')
        self.assertIn('first_air_date <= now()', sql)
        for genre in ('Talk', 'News', 'Soap', 'Reality', 'Kids'):
            self.assertIn(f"'{genre}' = ANY(genres)", sql)
        self.assertIn('number_of_episodes, 0) >= 300', sql)

    def test_rejects_other_tables(self):
        with self.assertRaises(ValueError):
            detail_query('person')
