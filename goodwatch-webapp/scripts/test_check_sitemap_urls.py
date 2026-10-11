"""Run with: python3 -m unittest test_check_sitemap_urls (in this directory). Nothing here uses the network."""
import os
import tempfile
import unittest

from check_sitemap_urls import check_urls, find_canonicals, judge, read_sitemap_urls, summary

XMLNS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
MOVIE = "https://goodwatch.app/movie/603-the-matrix"
SHOW = "https://goodwatch.app/show/1396-breaking-bad"


def page(canonical: str) -> str:
    return f'<html><head><title>T</title><link rel="canonical" href="{canonical}"/></head><body></body></html>'


def urlset(*locs: str) -> str:
    entries = "".join(f"<url><loc>{loc}</loc><lastmod>2026-09-25</lastmod></url>" for loc in locs)
    return f'<?xml version="1.0" encoding="UTF-8"?><urlset {XMLNS}>{entries}</urlset>'


def index(*names: str) -> str:
    entries = "".join(f"<sitemap><loc>https://goodwatch.app/sitemaps/{name}</loc></sitemap>" for name in names)
    return f'<?xml version="1.0" encoding="UTF-8"?><sitemapindex {XMLNS}>{entries}</sitemapindex>'


class ReadSitemapUrlsTest(unittest.TestCase):
    def read(self, files: dict):
        with tempfile.TemporaryDirectory() as directory:
            for name, content in files.items():
                with open(os.path.join(directory, name), "w", encoding="utf-8") as file:
                    file.write(content)
            return read_sitemap_urls(directory)

    def test_lists_the_urls_of_every_url_set_once(self):
        urls, problems = self.read({
            "sitemap.xml": index("sitemap_a.xml", "sitemap_b.xml"),
            "sitemap_index_legacy.xml": index("sitemap_a.xml"),
            "sitemap_a.xml": urlset(MOVIE, SHOW),
            "sitemap_b.xml": urlset(SHOW, "https://goodwatch.app/"),
        })
        self.assertEqual(urls, [MOVIE, SHOW, "https://goodwatch.app/"])
        self.assertEqual(problems, [])

    def test_unescapes_the_listed_url(self):
        urls, _ = self.read({"sitemap_a.xml": urlset("https://goodwatch.app/movies?a=1&amp;b=2")})
        self.assertEqual(urls, ["https://goodwatch.app/movies?a=1&b=2"])

    def test_reports_an_index_that_names_a_missing_file(self):
        _, problems = self.read({"sitemap.xml": index("sitemap_a.xml", "sitemap_gone.xml"),
                                 "sitemap_a.xml": urlset(MOVIE)})
        self.assertEqual(len(problems), 1)
        self.assertIn("sitemap_gone.xml", problems[0])

    def test_reports_broken_and_empty_files(self):
        urls, problems = self.read({"sitemap_a.xml": "<urlset", "sitemap_b.xml": urlset(),
                                    "sitemap_c.xml": "<html></html>"})
        self.assertEqual(urls, [])
        self.assertEqual(len(problems), 3)

    def test_reports_a_directory_without_sitemaps(self):
        urls, problems = self.read({})
        self.assertEqual(urls, [])
        self.assertEqual(len(problems), 1)


class FindCanonicalsTest(unittest.TestCase):
    def test_reads_the_canonical_link(self):
        self.assertEqual(find_canonicals(page(MOVIE)), [MOVIE])

    def test_reads_other_attribute_orders_quotes_and_case(self):
        self.assertEqual(find_canonicals(f"<LINK href='{MOVIE}' data-x=\"1\" REL=\"Canonical\">"), [MOVIE])

    def test_unescapes_the_href(self):
        self.assertEqual(find_canonicals(page("https://goodwatch.app/movies?a=1&amp;b=2")),
                         ["https://goodwatch.app/movies?a=1&b=2"])

    def test_ignores_other_links_and_text_that_mentions_canonical(self):
        html = ('<link rel="alternate" href="https://goodwatch.app/de"/>'
                '<link rel="stylesheet" href="/canonical.css"/>'
                '<script>var s = "<link rel=canonical>"</script>')
        self.assertEqual(find_canonicals(html), [])

    def test_reads_html_cut_off_after_the_head(self):
        self.assertEqual(find_canonicals(page(MOVIE).split("<body>")[0] + "<body><div class="), [MOVIE])


class JudgeTest(unittest.TestCase):
    def test_passes_200_with_the_listed_url_as_canonical(self):
        self.assertIsNone(judge(MOVIE, 200, page(MOVIE)))

    def test_fails_a_redirect_and_names_its_target(self):
        self.assertEqual(judge(MOVIE, 301, "", "/movie/604-other"), "status 301, redirects to /movie/604-other")

    def test_fails_other_statuses(self):
        self.assertEqual(judge(MOVIE, 404, page(MOVIE)), "status 404")
        self.assertEqual(judge(MOVIE, 500, ""), "status 500")

    def test_fails_a_different_canonical(self):
        for other in (MOVIE + "/", MOVIE.replace("https://", "http://"), "https://goodwatch.app/movie/603",
                      MOVIE + "?country=US", "/movie/603-the-matrix"):
            self.assertEqual(judge(MOVIE, 200, page(other)), f"canonical is {other}")

    def test_fails_a_page_without_canonical(self):
        self.assertEqual(judge(MOVIE, 200, "<html><head></head></html>"), "no canonical link")

    def test_fails_two_different_canonicals(self):
        self.assertIn("several canonical links", judge(MOVIE, 200, page(MOVIE) + page(SHOW)))
        self.assertIsNone(judge(MOVIE, 200, page(MOVIE) + page(MOVIE)))


class CheckUrlsTest(unittest.TestCase):
    def test_requests_each_url_once_and_pauses_between_requests(self):
        events = []

        def fetch(url):
            events.append(url)
            return 200, page(url), None

        failures = check_urls([MOVIE, SHOW, "https://goodwatch.app/"], fetch, lambda: events.append("pause"))
        self.assertEqual(failures, [])
        self.assertEqual(events, [MOVIE, "pause", SHOW, "pause", "https://goodwatch.app/"])

    def test_collects_failures_and_goes_on(self):
        def fetch(url):
            if url == MOVIE:
                raise TimeoutError("timed out")
            return (404, "", None) if url == SHOW else (200, page(url), None)

        failures = check_urls([MOVIE, SHOW, "https://goodwatch.app/"], fetch, lambda: None)
        self.assertEqual(failures, [(MOVIE, "no answer (TimeoutError: timed out)"), (SHOW, "status 404")])

    def test_never_requests_another_site(self):
        requested = []
        failures = check_urls(["https://example.com/movie/1", "http://goodwatch.app/"],
                              lambda url: requested.append(url), lambda: None)
        self.assertEqual(requested, [])
        self.assertEqual(len(failures), 2)


class SummaryTest(unittest.TestCase):
    def test_counts_and_names_every_failure(self):
        text = summary(3, [(SHOW, "status 404")], [])
        self.assertIn("URLs checked: 3", text)
        self.assertIn("Passed: 2", text)
        self.assertIn("Failed: 1", text)
        self.assertIn(f"FAIL {SHOW}: status 404", text)
        self.assertTrue(text.endswith("Result: FAILED"))

    def test_passes_only_with_urls_and_without_failures_or_problems(self):
        self.assertTrue(summary(3, [], []).endswith("Result: passed"))
        self.assertTrue(summary(0, [], []).endswith("Result: FAILED"))
        self.assertTrue(summary(3, [], ["sitemap.xml: lists a missing file"]).endswith("Result: FAILED"))


if __name__ == "__main__":
    unittest.main()
