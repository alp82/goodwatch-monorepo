"""LLM-free matcher: explicit mentions, exact catalog names, second signals."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.deterministic import DeterministicMatcher, mentions, reference_only, subtitled  # noqa: E402


def row(kind, tmdb_id, title, year):
    return {'key': f'{kind}:{tmdb_id}', 'media_type': kind, 'tmdb_id': tmdb_id, 'title': title,
            'original_title': title, 'release_year': year, 'popularity': 1}


def post(text, context='', source='rss', **extra):
    return {'post_id': text[:20], 'source': source, 'source_id': text[:20], 'url': extra.pop('url', 'https://variety.com/2026/film/news/x/'),
            'author': 'a', 'published_at': '2026-10-14T00:00:00+00:00', 'text': text, 'context': context} | extra


class DeterministicTests(unittest.TestCase):
    def decide(self, p, catalog, people=None):
        return [l['key'] for l in DeterministicMatcher(None).decide(p, mentions(p), catalog, people or {}, set())]

    def test_quoted_unique_headline_title_links(self):
        p = post('‘Hazara Town,’ About the Hazara Community, Acquired by Filmotor')
        self.assertEqual(self.decide(p, {'hazara town': [row('movie', 1, 'Hazara Town', 2026)]}), ['movie:1'])

    def test_one_word_unique_title_needs_second_signal(self):
        catalog = {'whalefall': [row('movie', 1, 'Whalefall', 2026)]}
        p = post('‘Whalefall’ Review: Austin Abrams Battles a Whale')
        self.assertEqual(self.decide(p, catalog), [])
        self.assertEqual(self.decide(p, catalog, {'movie:1': {'Austin Abrams'}}), ['movie:1'])

    def test_one_word_shared_title_needs_second_signal(self):
        catalog = {'josephine': [row('movie', 1, 'Josephine', 2026), row('movie', 2, 'Josephine', 2001)]}
        p = post('‘Josephine’ Trailer: Channing Tatum and Gemma Chan Cannot Parent Away')
        self.assertEqual(self.decide(p, catalog), [])
        self.assertEqual(self.decide(p, catalog, {'movie:1': {'Channing Tatum'}}), ['movie:1'])

    def test_reference_titles_are_not_linked(self):
        self.assertTrue(reference_only('Succession', '‘Elsbeth’ Puts a ‘Succession’ Star in the Hot Seat'))
        self.assertTrue(reference_only('Breaking Bad', 'Aaron Paul Mourns ‘Breaking Bad’ Co-Star RJ Mitte'))
        self.assertTrue(reference_only('Ted Lasso', '‘Ted Lasso’s Cristo Fernández To Host'))
        self.assertFalse(reference_only('Elsbeth', '‘Elsbeth’ Puts a ‘Succession’ Star in the Hot Seat'))

    def test_german_references_stage_and_reboots_are_not_linked(self):
        self.assertTrue(reference_only('Top Gun: Maverick', 'Sci-Fi mit Tom Cruise – vom Regisseur von "Top Gun: Maverick"'))
        self.assertTrue(reference_only('Below', '"Below"-Star Josh Hartnett'))
        catalog = {'a few good men': [row('movie', 4, 'A Few Good Men', 1992)]}
        self.assertEqual(self.decide(post('Broadway Box Office: ‘A Few Good Men,’ ‘860’ Draw Crowds'), catalog), [])
        catalog = {'baywatch': [row('tv', 5, 'Baywatch', 1989)]}
        p = post('Die Serie wird neu aufgelegt: Erster Trailer zur "Baywatch"-Serie 1989', context='David Hasselhoff')
        self.assertEqual(self.decide(p, catalog, {'tv:5': {'David Hasselhoff'}}), [])

    def test_only_first_title_unless_headline_lists_works(self):
        catalog = {'elsbeth': [row('tv', 1, 'Elsbeth', 2024)], 'the mentor': [row('movie', 2, 'The Mentor', 2026)]}
        p = post('‘Elsbeth’ Welcomes Guest From ‘The Mentor’ in Season 4')
        self.assertEqual(self.decide(p, catalog), ['tv:1'])

    def test_subtitle_and_furniture_do_not_match_prefix(self):
        self.assertTrue(subtitled('Harry Potter', 'Harry Potter: Castle Chronicles Officially Announced'))
        self.assertFalse(subtitled('Whalefall', 'Whalefall Review: A Compelling Concept'))
        catalog = {'sneak peek': [row('movie', 9, 'Sneak Peek', 2022)]}
        self.assertEqual(self.decide(post('The Christmas Switch | Sneak Peek | Netflix', source='youtube'), catalog), [])

    def test_sentence_segment_is_not_a_title(self):
        catalog = {'you be the judge': [row('movie', 3, 'You be the Judge', None)]}
        self.assertEqual(self.decide(post('You be the judge. DIGGER is NOW PLAYING', source='youtube'), catalog), [])

    def test_person_name_is_not_a_title(self):
        catalog = {'zakir khan': [row('tv', 5, 'Zakir Khan', 2022)]}
        p = post('Zakir Khan ROASTS Desi Mothers | Papa Yaar | Netflix India', source='youtube')
        self.assertEqual(self.decide(p, catalog, {'tv:5': {'Zakir Khan'}}), [])

    def test_bluesky_matches_only_the_article_card(self):
        catalog = {'the bell jar': [row('movie', 7, 'The Bell Jar', 2027)]}
        p = post('I love “The Bell Jar” so much', source='bluesky', context='')
        self.assertEqual(self.decide(p, catalog), [])
        p = post('Read this', source='bluesky', context='Billie Eilish to star in “The Bell Jar”\nVariety reports')
        self.assertEqual(self.decide(p, catalog), ['movie:7'])

    def test_match_makes_no_model_calls_and_uses_official_video_ids(self):
        calls = []
        def select(sql, args):
            calls.append(sql)
            if 'media_video' in sql:
                return [{'media_type': 'movie', 'media_tmdb_id': 11, 'site_key': 'abc'}]
            return []
        out = DeterministicMatcher(select).match([post('Trailer', source='youtube', source_id='abc', post_id='p1')])
        self.assertEqual(out['p1'][0]['key'], 'movie:11')
        self.assertFalse(any('openrouter' in c.lower() for c in calls))


if __name__ == '__main__':
    unittest.main()
