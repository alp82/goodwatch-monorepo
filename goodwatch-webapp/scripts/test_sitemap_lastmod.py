"""Evidence for page dates and artifact dates, without a database."""
import tempfile
import unittest
from datetime import date
from pathlib import Path

from sitemap_lastmod import SitemapHistory, title_lastmod


class LastmodTest(unittest.TestCase):
    def test_refresh_or_dna_timestamp_cannot_prove_visible_change(self):
        self.assertIsNone(title_lastmod(None))
        self.assertIsNone(title_lastmod(1792303054840))

    def test_changed_new_and_unchanged_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'sitemap_movie.xml').write_bytes(b'<urlset/>')
            (root / 'sitemap.xml').write_text('''<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <sitemap><loc>https://goodwatch.app/sitemaps/sitemap_movie.xml</loc>
              <lastmod>2026-10-10</lastmod></sitemap></sitemapindex>''')
            history = SitemapHistory(root, today=date(2026, 10, 18))
            # Snapshot survives deletion/replacement of output files.
            (root / 'sitemap_movie.xml').unlink()
            self.assertEqual(history.lastmod('sitemap_movie.xml', b'<urlset/>'), date(2026, 10, 10))
            self.assertEqual(history.lastmod('sitemap_movie.xml', b'changed'), date(2026, 10, 18))
            self.assertEqual(history.lastmod('sitemap_new.xml', b'new'), date(2026, 10, 18))

    def test_unchanged_file_without_historic_date_stays_undated(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'sitemap_static.xml').write_bytes(b'<urlset/>')
            self.assertIsNone(SitemapHistory(directory).lastmod('sitemap_static.xml', b'<urlset/>'))

    def test_conflicting_historic_dates_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            for i, day in enumerate(('2026-10-10', '2026-10-11')):
                (Path(directory) / f'sitemap_{i}.xml').write_text(f'''<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <sitemap><loc>https://goodwatch.app/sitemaps/sitemap_movie.xml</loc><lastmod>{day}</lastmod></sitemap>
                </sitemapindex>''')
            with self.assertRaisesRegex(ValueError, 'Conflicting'):
                SitemapHistory(directory)


if __name__ == '__main__':
    unittest.main()
