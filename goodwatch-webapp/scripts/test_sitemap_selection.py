import unittest
from datetime import date
from sitemap_selection import select_titles, state_comment


def rows():
    return [(i, f'Title {i}', '', None, None, 10000 - i, i) for i in range(1, 1001)]


def xml(selected, state):
    return ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + state_comment(state) +
            ''.join(f'<url><loc>https://goodwatch.app/movie/{r[0]}-title</loc></url>' for r in selected) + '</urlset>').encode()


class SelectionTest(unittest.TestCase):
    def test_initial_core_votes_and_attention_popularity(self):
        selected, state = select_titles(rows(), 'movie', today=date(2026, 10, 18))
        self.assertEqual(state['core'], list(range(1, 631)))
        self.assertEqual(state['attention'], list(range(1000, 930, -1)))
        self.assertEqual(len(set(r[0] for r in selected)), 700)

    def test_weekly_ranking_changes_do_not_rotate_core_or_attention(self):
        selected, state = select_titles(rows(), 'movie', today=date(2026, 10, 18))
        changed = [r[:5] + (i, 1001-i) for i, r in enumerate(rows())]
        after, new = select_titles(changed, 'movie', xml(selected, state), date(2026, 10, 25))
        self.assertEqual(new, state)
        self.assertEqual([r[0] for r in after], [r[0] for r in selected])

    def test_monthly_attention_rotation_capped_at_five_percent(self):
        selected, state = select_titles(rows(), 'movie', today=date(2026, 10, 18))
        changed = [r[:6] + (1001-r[0],) for r in rows()]
        after, new = select_titles(changed, 'movie', xml(selected, state), date(2026, 11, 1))
        self.assertEqual(new['core'], state['core'])
        self.assertEqual(len(set(new['attention']) - set(state['attention'])), 35)
        _, again = select_titles(changed, 'movie', xml(after, new), date(2026, 11, 8))
        self.assertEqual(again, new)

    def test_ineligible_members_replaced_without_waiting_for_month(self):
        selected, state = select_titles(rows(), 'movie', today=date(2026, 10, 18))
        pool = [r for r in rows() if r[0] not in (1, 1000)]
        after, new = select_titles(pool, 'movie', xml(selected, state), date(2026, 10, 25))
        self.assertNotIn(1, new['core'])
        self.assertNotIn(1000, new['attention'])
        self.assertEqual(len(after), 700)
        self.assertEqual(new['core'][:629], state['core'][1:])

    def test_insufficient_pool_or_corrupt_state_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'Not enough'):
            select_titles(rows()[:699], 'movie')
        selected, state = select_titles(rows(), 'movie', today=date(2026, 10, 18))
        with self.assertRaisesRegex(ValueError, 'does not match'):
            select_titles(rows(), 'movie', xml(selected[:-1], state))
