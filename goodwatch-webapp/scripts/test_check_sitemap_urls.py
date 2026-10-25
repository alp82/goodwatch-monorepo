"""Run with: python3 -m unittest test_check_sitemap_urls (in this directory). Network tests use only a local HTTP server."""
import os
import tempfile
import unittest

import io
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError

from sitemap_new import fetch_index

from check_sitemap_urls import (GOOGLE_HTML_LIMIT_BYTES, Response, RobotsRules, check_urls, fetch, fetch_robots, find_canonicals,
                                find_robots_meta, header_says_noindex, judge, read_page, read_sitemap_urls, summary,
                                warn)

XMLNS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
MOVIE = "https://goodwatch.app/movie/603-the-matrix"
SHOW = "https://goodwatch.app/show/1396-breaking-bad"


def page(canonical: str, robots: str = "index, follow") -> str:
    return (f'<html><head><title>T</title><link rel="canonical" href="{canonical}"/>'
            f'<meta name="robots" content="{robots}"/></head><body></body></html>')

# The live site's rules when this was written, with the sign-in rules it had before.
SITE_ROBOTS = """User-agent: *
Disallow: /api/
Disallow: /browser-check
Disallow: /person/*?
Disallow: /sign-in
Disallow: /discover?
Disallow: /discover/*?

Allow: /

Sitemap: https://goodwatch.app/sitemaps/sitemap.xml
"""


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

    def test_fails_a_url_robots_txt_disallows_without_requesting_it(self):
        events = []

        def fetch(url):
            events.append(url)
            return 200, page(url), None

        blocked = "https://goodwatch.app/sign-in"
        failures = check_urls([MOVIE, blocked, SHOW], fetch, lambda: events.append("pause"),
                            robots=RobotsRules(SITE_ROBOTS))
        self.assertEqual(events, [MOVIE, "pause", SHOW])
        self.assertEqual(failures,
                         [(blocked, "robots.txt disallows it for Googlebot (Disallow: /sign-in), not requested")])

    def test_warns_about_a_large_page_and_still_passes_it(self):
        def fetch(url):
            return Response(200, page(url), None, (), GOOGLE_HTML_LIMIT_BYTES + 1 if url == SHOW else 1000)

        lines, warnings = [], []
        failures = check_urls([MOVIE, SHOW], fetch, lambda: None, lines.append, warnings=warnings)
        self.assertEqual(failures, [])
        self.assertEqual([url for url, _ in warnings], [SHOW])
        self.assertIn("2,000,001 bytes", warnings[0][1])
        self.assertTrue(any(line.startswith(f"WARN {SHOW}") for line in lines))

    def test_a_page_that_fails_gets_no_size_warning(self):
        def fetch(url):
            return Response(200, page(url, "noindex"), None, (), GOOGLE_HTML_LIMIT_BYTES * 3)

        warnings = []
        failures = check_urls([MOVIE], fetch, lambda: None, warnings=warnings)
        self.assertEqual(len(failures), 1)
        self.assertEqual(warnings, [])


class NoindexTest(unittest.TestCase):
    def test_fails_a_page_whose_robots_meta_says_noindex(self):
        for robots in ("noindex", "noindex, follow", "noindex,nofollow", "NOINDEX", "none", "follow, noindex"):
            reason = judge(MOVIE, 200, page(MOVIE, robots))
            self.assertIsNotNone(reason, robots)
            self.assertIn("robots meta tag", reason)

    def test_a_googlebot_meta_tag_counts_and_another_crawlers_does_not(self):
        html = page(MOVIE).replace("</head>", '<meta name="googlebot" content="noindex"></head>')
        self.assertIn("noindex", judge(MOVIE, 200, html))
        html = page(MOVIE).replace("</head>", '<meta name="bingbot" content="noindex"></head>')
        self.assertIsNone(judge(MOVIE, 200, html))

    def test_fails_a_page_with_both_index_and_noindex(self):
        html = page(MOVIE).replace("</head>", '<meta name="robots" content="noindex, nofollow"></head>')
        self.assertIn("noindex, nofollow", judge(MOVIE, 200, html))

    def test_passes_an_indexable_page(self):
        for robots in ("index, follow", "all", "max-image-preview:large", "nofollow"):
            self.assertIsNone(judge(MOVIE, 200, page(MOVIE, robots)), robots)

    def test_reads_the_robots_meta_tag(self):
        self.assertEqual(find_robots_meta(page(MOVIE, "noindex, follow")), ["noindex, follow"])
        self.assertEqual(find_robots_meta('<META NAME="Robots" CONTENT="none">'), ["none"])
        self.assertEqual(find_robots_meta('<meta property="robots" content="noindex">'), [])

    def test_fails_a_page_whose_x_robots_tag_says_noindex(self):
        reason = judge(MOVIE, 200, page(MOVIE), None, ("noindex",))
        self.assertIn("X-Robots-Tag", reason)
        self.assertIn("X-Robots-Tag", judge(MOVIE, 200, page(MOVIE), None, ("max-snippet:50", "googlebot: none")))

    def test_an_x_robots_tag_for_another_crawler_does_not_count(self):
        self.assertFalse(header_says_noindex("otherbot: noindex, nofollow"))
        self.assertTrue(header_says_noindex("googlebot: noindex"))
        self.assertTrue(header_says_noindex("noindex, nofollow"))
        self.assertFalse(header_says_noindex("unavailable_after: 25 Jun 2010 15:00:00 PST"))
        self.assertFalse(header_says_noindex("max-image-preview: large"))
        self.assertIsNone(judge(MOVIE, 200, page(MOVIE), None, ("otherbot: noindex",)))


class RobotsRulesTest(unittest.TestCase):
    def blocked(self, text: str, path: str):
        return RobotsRules(text).blocking_rule("https://goodwatch.app" + path)

    def test_reads_the_site_rules_as_google_does(self):
        self.assertIsNone(self.blocked(SITE_ROBOTS, "/movie/603-the-matrix"))
        self.assertIsNone(self.blocked(SITE_ROBOTS, "/person/287-brad-pitt"))
        self.assertEqual(self.blocked(SITE_ROBOTS, "/person/287-brad-pitt?country=US"), "/person/*?")
        self.assertEqual(self.blocked(SITE_ROBOTS, "/discover?type=movie"), "/discover?")
        self.assertIsNone(self.blocked(SITE_ROBOTS, "/discover"))
        self.assertEqual(self.blocked(SITE_ROBOTS, "/api/discover"), "/api/")
        self.assertEqual(self.blocked(SITE_ROBOTS, "/sign-in"), "/sign-in")
        self.assertIsNone(self.blocked(SITE_ROBOTS, "/"))

    def test_the_longest_rule_wins_and_allow_wins_a_tie(self):
        text = "User-agent: *\nDisallow: /movies\nAllow: /movies/moods\nDisallow: /shows/\nAllow: /shows/\n"
        self.assertEqual(self.blocked(text, "/movies/genres"), "/movies")
        self.assertIsNone(self.blocked(text, "/movies/moods/scary"))
        self.assertIsNone(self.blocked(text, "/shows/moods"))

    def test_a_dollar_ends_the_path(self):
        text = "User-agent: *\nDisallow: /*.xml$\n"
        self.assertEqual(self.blocked(text, "/sitemaps/sitemap.xml"), "/*.xml$")
        self.assertIsNone(self.blocked(text, "/sitemaps/sitemap.xml?x=1"))

    def test_a_group_for_googlebot_replaces_the_star_group(self):
        text = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /private\n"
        self.assertIsNone(self.blocked(text, "/movies"))
        self.assertEqual(self.blocked(text, "/private/1"), "/private")

    def test_another_crawlers_group_does_not_apply(self):
        text = "User-agent: Bingbot\nDisallow: /\n\nUser-agent: *\nDisallow: /api/\n"
        self.assertIsNone(self.blocked(text, "/movies"))

    def test_several_agents_share_a_group_and_comments_are_ignored(self):
        text = "User-agent: Bingbot\nUser-agent: Googlebot # the same rules\nDisallow: /x # not this\n"
        self.assertEqual(self.blocked(text, "/x/1"), "/x")

    def test_an_empty_disallow_or_file_allows_everything(self):
        self.assertIsNone(self.blocked("User-agent: *\nDisallow:\n", "/movies"))
        self.assertIsNone(self.blocked("", "/movies"))


class ReadPageTest(unittest.TestCase):
    def test_counts_every_byte_and_keeps_the_head(self):
        body = b"<html><head><link rel=canonical href=x></head><body>" + b"x" * 300_000 + b"</body></html>"
        html, size = read_page(io.BytesIO(body))
        self.assertEqual(size, len(body))
        self.assertIn("</head>", html)
        self.assertLess(len(html), 70_000)


class InformationalResponseTest(unittest.TestCase):
    def setUp(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.server.paths.append(self.path)
                for status in self.server.informational:
                    self.send_response_only(status)
                    # These belong to the interim response, never to the final one.
                    self.send_header("X-Robots-Tag", "noindex")
                    self.send_header("Location", "/interim")
                    self.end_headers()
                self.send_response(200 if self.path == "/target" else self.server.final_status)
                for name, value in self.server.final_headers:
                    self.send_header(name, value)
                if self.server.chunked:
                    self.send_header("Transfer-Encoding", "chunked")
                else:
                    self.send_header("Content-Length", str(len(self.server.body)))
                self.end_headers()
                if self.server.chunked:
                    self.wfile.write(f"{len(self.server.body):x}\r\n".encode()
                                     + self.server.body + b"\r\n0\r\n\r\n")
                else:
                    self.wfile.write(self.server.body)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.informational = [103]
        self.server.final_status = 200
        self.server.final_headers = []
        self.server.chunked = False
        self.server.body = page(MOVIE).encode()
        self.server.paths = []
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_page_uses_final_200_body_headers_and_size(self):
        self.server.final_headers = [("X-Robots-Tag", "index"), ("X-Robots-Tag", "googlebot: follow")]
        response = fetch(self.base + "/page")
        self.assertEqual(response, Response(200, page(MOVIE), None,
                                           ("index", "googlebot: follow"), len(self.server.body)))
        self.assertIsNone(judge(MOVIE, *response))
        self.assertEqual(self.server.paths, ["/page"])

    def test_page_reports_final_404_and_its_headers(self):
        self.server.final_status = 404
        self.server.final_headers = [("X-Robots-Tag", "none")]
        self.assertEqual(fetch(self.base + "/missing"), Response(404, "", None, ("none",)))

    def test_page_still_reports_redirect_without_following_it(self):
        self.server.final_status = 302
        self.server.final_headers = [("Location", "/target")]
        self.assertEqual(fetch(self.base + "/redirect"), Response(302, "", "/target"))
        self.assertEqual(self.server.paths, ["/redirect"])

    def test_skips_multiple_informational_responses_and_decodes_chunked_body(self):
        self.server.informational = [100, 102, 103, 103, 199]
        self.server.chunked = True
        response = fetch(self.base + "/page")
        self.assertEqual(response.status, 200)
        self.assertEqual(response.html, page(MOVIE))
        self.assertEqual(response.size, len(self.server.body))

    def test_protocol_switch_is_not_skipped(self):
        self.server.informational = []
        self.server.final_status = 101
        self.server.body = b""
        self.assertEqual(fetch(self.base + "/upgrade").status, 101)

    def test_robots_uses_final_200_rules(self):
        self.server.body = b"User-agent: *\nDisallow: /private\n"
        robots, problem = fetch_robots(self.base)
        self.assertIsNone(problem)
        self.assertEqual(robots.blocking_rule(self.base + "/private"), "/private")
        self.assertEqual(self.server.paths, ["/robots.txt"])

    def test_robots_final_404_means_no_rules(self):
        self.server.final_status = 404
        robots, problem = fetch_robots(self.base)
        self.assertIsNone(problem)
        self.assertIsNone(robots.blocking_rule(self.base + "/private"))

    def test_robots_final_503_still_fails_closed(self):
        self.server.final_status = 503
        robots, problem = fetch_robots(self.base)
        self.assertIsNone(robots)
        self.assertIn("status 503", problem)

    def test_pages_index_reads_final_body(self):
        self.server.body = b'{"pages": [], "failed": []}'
        self.assertEqual(fetch_index(self.base + "/api/new-on-services/pages"), self.server.body)

    def test_robots_still_follows_redirects(self):
        self.server.final_status = 302
        self.server.final_headers = [("Location", "/target")]
        self.server.body = b"User-agent: *\nDisallow: /private\n"
        robots, problem = fetch_robots(self.base)
        self.assertIsNone(problem)
        self.assertEqual(robots.blocking_rule(self.base + "/private"), "/private")
        self.assertEqual(self.server.paths, ["/robots.txt", "/target"])

    def test_pages_index_still_follows_redirects(self):
        self.server.final_status = 302
        self.server.final_headers = [("Location", "/target")]
        self.server.body = b'{"pages": [], "failed": []}'
        self.assertEqual(fetch_index(self.base + "/index"), self.server.body)
        self.assertEqual(self.server.paths, ["/index", "/target"])

    def test_pages_index_final_404_still_raises(self):
        self.server.final_status = 404
        with self.assertRaises(HTTPError) as caught:
            fetch_index(self.base + "/api/new-on-services/pages")
        self.assertEqual(caught.exception.code, 404)
        caught.exception.close()


class WarnTest(unittest.TestCase):
    def test_warns_only_above_the_limit(self):
        self.assertIsNone(warn(Response(200, "", None, (), GOOGLE_HTML_LIMIT_BYTES)))
        self.assertIsNotNone(warn(Response(200, "", None, (), GOOGLE_HTML_LIMIT_BYTES + 1)))
        self.assertIsNone(warn(Response(200, "", None, (), None)))
        self.assertIsNone(warn(Response(404, "", None, (), GOOGLE_HTML_LIMIT_BYTES * 2)))


class SummaryTest(unittest.TestCase):
    def test_counts_and_names_every_failure(self):
        text = summary(3, [(SHOW, "status 404")], [])
        self.assertIn("URLs checked: 3", text)
        self.assertIn("Passed: 2", text)
        self.assertIn("Failed: 1", text)
        self.assertIn(f"FAIL {SHOW}: status 404", text)
        self.assertTrue(text.endswith("Result: FAILED"))

    def test_lists_warnings_without_failing(self):
        text = summary(2, [], [], [(SHOW, "HTML is 3,000,000 bytes")])
        self.assertIn("Warnings: 1", text)
        self.assertIn(f"WARN {SHOW}: HTML is 3,000,000 bytes", text)
        self.assertTrue(text.endswith("Result: passed"))

    def test_passes_only_with_urls_and_without_failures_or_problems(self):
        self.assertTrue(summary(3, [], []).endswith("Result: passed"))
        self.assertTrue(summary(0, [], []).endswith("Result: FAILED"))
        self.assertTrue(summary(3, [], ["sitemap.xml: lists a missing file"]).endswith("Result: FAILED"))


if __name__ == "__main__":
    unittest.main()
