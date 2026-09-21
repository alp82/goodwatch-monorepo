"""Status classification of the local TV Tropes recovery runner."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import recover_tvtropes
from f.tvtropes_web.models import Trope, TvTropesCrawlResult

URL = "https://tvtropes.org/pmwiki/pmwiki.php/Series/BandOfBrothers2001"


class ResultStatusTests(unittest.TestCase):
    def status(self, requests=(), **fields):
        return recover_tvtropes.result_status(
            TvTropesCrawlResult(**fields), list(requests)
        )

    def test_identified_page_without_tropes_is_its_own_status(self):
        self.assertEqual(
            self.status(url=URL, tropes=[], rate_limit_reached=False),
            "identified_no_tropes",
        )

    def test_existing_statuses_are_unchanged(self):
        trope = Trope(name="Big Bad", url=URL, html="")
        self.assertEqual(
            self.status(url=URL, tropes=[trope], rate_limit_reached=False), "recovered"
        )
        self.assertEqual(
            self.status(url=None, tropes=[], rate_limit_reached=False), "unresolved"
        )
        self.assertEqual(
            self.status(url=None, tropes=[], rate_limit_reached=True), "rate_limited"
        )
        self.assertEqual(
            self.status(
                [{"status": 403}], url=None, tropes=[], rate_limit_reached=True
            ),
            "source_access_blocked",
        )

    def test_identified_no_tropes_is_terminal_for_a_run(self):
        self.assertIn("identified_no_tropes", recover_tvtropes.COMPLETED_STATUSES)


if __name__ == "__main__":
    unittest.main()
