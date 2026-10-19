"""Run with: python3 -m unittest test_sitemap_blog (in this directory). No database, no network."""
import json
import os
import sys
import tempfile
import types
import unittest
import xml.etree.ElementTree as ET
from datetime import date
from unittest.mock import patch

from sitemap_blog import blog_urls, read_blog_posts
from sitemap_lastmod import SitemapHistory


def import_generator():
    """create_sitemaps imports the database driver and dotenv at the top. The static set needs neither, so stand
    in for them while importing when they are not installed (make sitemaps-test runs with plain python3). The
    stand-ins leave sys.modules afterwards, so test_sitemap_crate still sees a missing driver."""
    stubs = {}
    for name, attributes in (("crate", {"client": None}), ("dotenv", {"load_dotenv": lambda: None})):
        try:
            __import__(name)
        except ImportError:
            stubs[name] = types.SimpleNamespace(**attributes)
    with patch.dict(sys.modules, stubs):
        import create_sitemaps
    return create_sitemaps


create_sitemaps = import_generator()

TODAY = date(2026, 10, 19)
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def post(slug, published="2026-10-01", updated="2026-10-01", **extra):
    return {"slug": slug, "published": published, "updated": updated, **extra}


class ReadBlogPostsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.directory.name, "posts.json")

    def tearDown(self):
        self.directory.cleanup()

    def read(self, posts):
        with open(self.path, "w", encoding="utf-8") as posts_file:
            posts_file.write(posts if isinstance(posts, str) else json.dumps(posts))
        return read_blog_posts(self.path, TODAY)

    def test_missing_file_and_empty_list_have_no_posts(self):
        self.assertEqual(read_blog_posts(self.path, TODAY), [])
        self.assertEqual(self.read([]), [])
        self.assertEqual(blog_urls("https://goodwatch.app", []), [])

    def test_posts_sorted_by_slug_with_dates_and_extra_keys_ignored(self):
        posts = self.read([post("zeta-2026", "2026-09-01", "2026-10-02", title="Z"), post("alpha")])
        self.assertEqual(posts, [
            {"slug": "alpha", "published": date(2026, 10, 1), "updated": date(2026, 10, 1)},
            {"slug": "zeta-2026", "published": date(2026, 9, 1), "updated": date(2026, 10, 2)},
        ])

    def test_index_gets_newest_update_and_each_post_its_own(self):
        posts = self.read([post("b", updated="2026-10-05"), post("a", updated="2026-10-19")])
        self.assertEqual(blog_urls("https://goodwatch.app", posts), [
            ("https://goodwatch.app/blog", date(2026, 10, 19)),
            ("https://goodwatch.app/blog/a", date(2026, 10, 19)),
            ("https://goodwatch.app/blog/b", date(2026, 10, 5)),
        ])

    def test_bad_input_fails_with_a_clear_error(self):
        cases = [
            ("not valid JSON", "[{"),
            ("JSON array", {"slug": "a"}),
            ("must be an object", ["a"]),
            ("slug must match", [post("Upper")]),
            ("slug must match", [post("trailing-")]),
            ("slug must match", [post("double--dash")]),
            ("slug must match", [post("with/slash")]),
            ("slug must match", [{"published": "2026-10-01", "updated": "2026-10-01"}]),
            ("listed twice", [post("a"), post("a", updated="2026-10-02")]),
            ("published must be a YYYY-MM-DD", [post("a", published="2026-10-1")]),
            ("updated must be a YYYY-MM-DD", [post("a", updated=None)]),
            ("updated must be a YYYY-MM-DD", [post("a", updated="20261001")]),
            ("not a real date", [post("a", updated="2026-02-30")]),
            ("before published", [post("a", published="2026-10-02", updated="2026-10-01")]),
            ("after today", [post("a", published="2026-10-19", updated="2026-10-20")]),
        ]
        for message, posts in cases:
            with self.subTest(posts=posts), self.assertRaisesRegex(ValueError, message):
                self.read(posts)


class StaticSitemapTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = self.directory.name
        self.output = os.path.join(root, "out")
        os.mkdir(self.output)
        self.posts = os.path.join(root, "posts.json")
        self.saved = (create_sitemaps.SITEMAP_DIR, create_sitemaps.BLOG_POSTS, create_sitemaps.PREVIOUS_SITEMAPS)
        create_sitemaps.SITEMAP_DIR = self.output
        create_sitemaps.BLOG_POSTS = self.posts
        create_sitemaps.PREVIOUS_SITEMAPS = SitemapHistory(os.path.join(root, "previous"), today=TODAY)

    def tearDown(self):
        create_sitemaps.SITEMAP_DIR, create_sitemaps.BLOG_POSTS, create_sitemaps.PREVIOUS_SITEMAPS = self.saved
        self.directory.cleanup()

    def entries(self):
        tree = ET.parse(os.path.join(self.output, "sitemap_static.xml"))
        return [(url.findtext("s:loc", namespaces=NS), url.findtext("s:lastmod", namespaces=NS))
                for url in tree.getroot().findall("s:url", NS)]

    def test_blog_urls_follow_the_undated_landing_pages(self):
        with open(self.posts, "w", encoding="utf-8") as posts_file:
            json.dump([post("streaming-by-country-2026", "2026-10-19", "2026-10-19"),
                       post("a-first-look", "2026-10-01", "2026-10-03")], posts_file)
        result = create_sitemaps.create_landing_sitemaps()
        landing = [(f"https://goodwatch.app{route}", None) for route in create_sitemaps.STATIC_ROUTES]
        self.assertEqual(self.entries(), landing + [
            ("https://goodwatch.app/blog", "2026-10-19"),
            ("https://goodwatch.app/blog/a-first-look", "2026-10-03"),
            ("https://goodwatch.app/blog/streaming-by-country-2026", "2026-10-19"),
        ])
        self.assertEqual(result["static_url_count"], len(landing) + 3)
        self.assertEqual(result["blog_post_count"], 2)

    def test_without_posts_the_static_set_is_unchanged(self):
        create_sitemaps.create_landing_sitemaps()
        self.assertEqual(self.entries(),
                         [(f"https://goodwatch.app{route}", None) for route in create_sitemaps.STATIC_ROUTES])

    def test_invalid_posts_write_no_static_set(self):
        with open(self.posts, "w", encoding="utf-8") as posts_file:
            json.dump([post("Bad Slug")], posts_file)
        with self.assertRaisesRegex(ValueError, "slug must match"):
            create_sitemaps.create_landing_sitemaps()
        self.assertFalse(os.path.exists(os.path.join(self.output, "sitemap_static.xml")))

    def test_generator_reads_the_repository_posts_file(self):
        repository_posts = os.path.join(create_sitemaps.SCRIPT_DIR, "../app/content/blog/posts.json")
        self.assertEqual(os.path.realpath(self.saved[1]), os.path.realpath(repository_posts))


if __name__ == "__main__":
    unittest.main()
