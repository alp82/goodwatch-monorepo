import unittest
from unittest.mock import Mock
from sitemap_people import select_people, person_url


class PeopleTest(unittest.TestCase):
    def cursor(self):
        cursor = Mock()
        credits = [(i, j) for i in range(1, 36) for j in (1, 2, 3)]
        cursor.fetchall.side_effect = [credits, credits, [], [],
                                      [(i, f'Person {i}', 100-i) for i in range(1, 36)]]
        return cursor

    def test_substantive_people_deduplicated_and_ranked(self):
        cursor = self.cursor()
        chosen = select_people(cursor, {'movie': [1, 2, 3], 'show': []})
        self.assertEqual([p['id'] for p in chosen], list(range(1, 31)))
        self.assertEqual(chosen[0]['cohort_credits'], 3)
        self.assertIn('order_default < 5', cursor.execute.call_args_list[0].args[0])
        self.assertIn("job = 'Director'", cursor.execute.call_args_list[1].args[0])
        self.assertEqual(cursor.execute.call_args_list[-1].args[1], [list(range(1, 36))])

    def test_previous_members_retained_despite_rank_drop(self):
        previous = b'''<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://goodwatch.app/person/35-person-35</loc></url></urlset>'''
        chosen = select_people(self.cursor(), {'movie': [1, 2, 3], 'show': []}, previous)
        self.assertEqual(chosen[0]['id'], 35)
        self.assertEqual(len(chosen), 30)

    def test_not_enough_substantive_people_fails(self):
        cursor = Mock()
        cursor.fetchall.return_value = []
        with self.assertRaisesRegex(ValueError, 'No substantive'):
            select_people(cursor, {'movie': [], 'show': []})

    def test_canonical_name_edge_cases(self):
        self.assertEqual(person_url(1, ' --Tom Hardy-- '), 'https://goodwatch.app/person/1-tom-hardy')
        self.assertEqual(person_url(2, '李'), 'https://goodwatch.app/person/2')
