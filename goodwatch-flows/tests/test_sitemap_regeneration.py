"""Sitemap publication boundary: checked output, narrow scope, atomic update."""
import io
import json
from datetime import date
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.seo import regenerate_sitemaps as worker


class SitemapRegenerationTests(unittest.TestCase):
    def test_diff_updates_adds_deletes_only_generated_files(self):
        prefix = worker.OUTPUT
        files = {prefix + "sitemap.xml": b"same", prefix + "sitemap_new.xml": b"new"}
        existing = {prefix + "sitemap.xml": worker.blob_sha(b"same"),
                    prefix + "sitemap_old.xml": "old", prefix + "keep.txt": "keep",
                    "elsewhere/sitemap.xml": "keep", prefix + "nested/sitemap.xml": "keep"}
        changes = worker.changes_for(files, existing)
        self.assertEqual([c["path"] for c in changes],
                         [prefix + "sitemap_new.xml", prefix + "sitemap_old.xml"])
        self.assertEqual(changes[0]["content"], "new")
        self.assertIsNone(changes[1]["sha"])
        self.assertEqual(worker.changes_for(files, {p: worker.blob_sha(b) for p, b in files.items()}), [])

    def test_out_of_scope_and_empty_output_rejected(self):
        for files in ({}, {"README.md": b"no"}, {worker.OUTPUT + "../sitemap.xml": b"no"}):
            with self.subTest(files=files), self.assertRaises(ValueError):
                worker.changes_for(files, {})

    def run_main(self, dry_run, unchanged=False, failed=False):
        files = {worker.OUTPUT + "sitemap.xml": b"generated"}
        existing = {p: worker.blob_sha(b) for p, b in files.items()} if unchanged else {}
        with (patch.object(worker, "snapshot", return_value=("head", "tree", existing)),
              patch.object(worker, "load_sources"),
              patch.object(worker, "load_previous"),
              patch.object(worker, "generate_and_check", return_value=(1128, files)) as check,
              patch.object(worker, "publish", return_value="commit") as publish,
              patch.object(worker.wmill, "get_variable") as secret):
            if failed:
                check.side_effect = RuntimeError("check failed")
                with self.assertRaisesRegex(RuntimeError, "check failed"):
                    worker.main(dry_run)
                publish.assert_not_called()
            else:
                result = worker.main(dry_run)
                self.assertEqual(result["url_count"], 1128)
                if dry_run or unchanged:
                    publish.assert_not_called()
                    self.assertIsNone(result["commit"])
                else:
                    publish.assert_called_once()
                    self.assertEqual(result["commit"], "commit")
            secret.assert_not_called()

    def test_dry_run_never_publishes_or_reads_token(self):
        self.run_main(True)

    def test_unchanged_live_run_never_publishes_or_reads_token(self):
        self.run_main(False, unchanged=True)

    def test_failed_check_never_publishes(self):
        self.run_main(False, failed=True)

    def test_changed_passing_live_run_publishes(self):
        self.run_main(False)

    def test_single_commit_and_non_force_update(self):
        changes = [{"path": worker.OUTPUT + "sitemap.xml", "content": "xml"}]
        with (patch.object(worker.wmill, "get_variable", return_value="test-secret"),
              patch.object(worker, "request", side_effect=[
                  {"object": {"sha": "head"}}, {"sha": "new-tree"}, {"sha": "new-commit"}, {},
              ]) as api):
            self.assertEqual(worker.publish("head", "tree", changes), "new-commit")
        calls = api.call_args_list
        self.assertEqual(calls[1].args[2], {"base_tree": "tree", "tree": changes})
        self.assertEqual(calls[2].args[2]["parents"], ["head"])
        self.assertIn("(#351)", calls[2].args[2]["message"])
        self.assertEqual(calls[3].args[2], {"sha": "new-commit", "force": False})
        self.assertEqual(len(calls), 4)

    def test_concurrent_main_change_prevents_any_write(self):
        with (patch.object(worker.wmill, "get_variable", return_value="test-secret"),
              patch.object(worker, "request", return_value={"object": {"sha": "new-head"}}) as api,
              self.assertRaisesRegex(RuntimeError, "main changed")):
            worker.publish("head", "tree", [{}])
        api.assert_called_once()

    def test_http_error_does_not_expose_response_or_secret(self):
        error = HTTPError("https://api.github.com", 403, "private", {}, io.BytesIO(b"private"))
        with patch.object(worker, "urlopen", side_effect=error), self.assertRaisesRegex(RuntimeError, "HTTP 403") as caught:
            worker.request(worker.API, token="test-secret")
        self.assertTrue(caught.exception.__suppress_context__)
        self.assertNotIn("private", str(caught.exception))

    def test_snapshot_refuses_truncated_tree(self):
        with patch.object(worker, "request", side_effect=[
            {"object": {"sha": "head"}}, {"truncated": True},
        ]), self.assertRaisesRegex(RuntimeError, "truncated"):
            worker.snapshot()

    def test_sources_are_all_pinned_to_one_revision(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(worker, "request", return_value=b"source") as api:
            worker.load_sources(Path(directory), "pinned-sha")
            self.assertEqual(api.call_count, len(worker.SOURCE_FILES))
            for call, path in zip(api.call_args_list, worker.SOURCE_FILES):
                self.assertEqual(call.args[0], f"https://raw.githubusercontent.com/{worker.REPOSITORY}/pinned-sha/{path}")
                self.assertEqual((Path(directory) / path).read_bytes(), b"source")
                self.assertNotIn("token", call.kwargs)

    def test_previous_artifacts_pinned_and_scope_limited(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(worker, "request", return_value=b"xml") as api:
            root = Path(directory)
            existing = {worker.OUTPUT + "sitemap.xml": "sha",
                        worker.OUTPUT + "sitemap_movie_detail_0.xml": "sha",
                        worker.OUTPUT + "nested/sitemap.xml": "sha",
                        worker.OUTPUT + "keep.txt": "sha", "elsewhere/sitemap.xml": "sha"}
            worker.load_previous(root, "pinned-sha", existing)
            self.assertEqual(sorted(p.name for p in (root / "previous-sitemaps").iterdir()),
                             ["sitemap.xml", "sitemap_movie_detail_0.xml"])
            self.assertEqual(api.call_count, 2)
            for call in api.call_args_list:
                self.assertIn("/pinned-sha/" + worker.OUTPUT, call.args[0])
                self.assertNotIn("token", call.kwargs)

    def test_missing_token_never_calls_github(self):
        with (patch.object(worker.wmill, "get_variable", return_value=""),
              patch.object(worker, "request") as api,
              self.assertRaisesRegex(RuntimeError, "Missing secret")):
            worker.publish("head", "tree", [{}])
        api.assert_not_called()

    def test_ref_update_rejection_is_a_failed_job_without_retry(self):
        with (patch.object(worker.wmill, "get_variable", return_value="test-secret"),
              patch.object(worker, "request", side_effect=[
                  {"object": {"sha": "head"}}, {"sha": "new-tree"}, {"sha": "new-commit"},
                  RuntimeError("GitHub request failed: HTTP 422"),
              ]) as api,
              self.assertRaisesRegex(RuntimeError, "HTTP 422")):
            worker.publish("head", "tree", [{}])
        self.assertEqual(api.call_count, 4)

    def test_real_generator_and_checker_fail_closed(self):
        # Exercise the actual repository logic with a fake DB and HTTP responses.
        self.run_real_generator(lambda url: 200, 200)
        self.run_real_generator(lambda url: 404, 404)

    def test_a_failing_profile_is_left_out_not_fatal(self):
        # A member who hides their scores after the list was read answers noindex: the rest still publishes.
        files = self.run_real_generator(lambda url: 404 if "/u/" in url else 200, 200, profiles=0)
        self.assertNotIn(worker.OUTPUT + "sitemap_profiles.xml", files)
        self.assertNotIn(b"sitemap_profiles.xml", files[worker.OUTPUT + "sitemap.xml"])

    def test_a_failing_new_on_services_page_is_left_out_not_fatal(self):
        # A /new page whose titles aged out of its window answers noindex: the rest still publishes (#489 C).
        files = self.run_real_generator(lambda url: 404 if "/new/" in url else 200, 200, new_pages=0, new_rows=True)
        self.assertNotIn(worker.OUTPUT + "sitemap_new.xml", files)
        self.assertNotIn(b"sitemap_new.xml", files[worker.OUTPUT + "sitemap.xml"])

    def test_new_on_services_pages_with_titles_are_listed(self):
        files = self.run_real_generator(lambda url: 200, 200, new_pages=2, new_rows=True)
        new = files[worker.OUTPUT + "sitemap_new.xml"].decode()
        self.assertIn("<loc>https://goodwatch.app/new/us</loc>", new)
        self.assertIn("<loc>https://goodwatch.app/new/us/netflix</loc>", new)
        self.assertIn(b"sitemap_new.xml", files[worker.OUTPUT + "sitemap.xml"])

    def run_real_generator(self, status_of, status, profiles=1, new_pages=0, new_rows=False):
        import shutil
        repo = Path(__file__).resolve().parents[2]
        files = None
        for status in (status,):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for name in worker.SOURCE_FILES:
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(repo / name, target)
                # Fixed posts, so the count does not follow the repository's blog.
                (root / worker.BLOG_POSTS).write_text(json.dumps([
                    {"slug": "b-post", "published": "2026-10-01", "updated": "2026-10-12"},
                    {"slug": "a-post", "published": "2026-10-02", "updated": "2026-10-02"},
                ]))
                connection = Mock()
                def execute(sql, *args):
                    if 'FROM doc.user_profile' in sql:
                        # One member with a handle and enough public scores (sitemap_profiles.py).
                        connection.cursor.return_value.fetchall.return_value = [("u1", "amy", 30, 1792713600000, 1792895400000)]
                        return
                    if 'FROM doc.user_setting' in sql:
                        connection.cursor.return_value.fetchall.return_value = []
                        return
                    if 'FROM person_appeared_in' in sql or 'FROM person_worked_on' in sql:
                        connection.cursor.return_value.fetchall.return_value = [
                            (i, j) for i in range(1, 31) for j in (1, 2, 3)]
                        return
                    if 'FROM person WHERE' in sql:
                        connection.cursor.return_value.fetchall.return_value = [(i, f'Person {i}', 100-i) for i in range(1,31)]
                        return
                    count = 700 if 'FROM movie WHERE' in sql else 300
                    connection.cursor.return_value.fetchall.return_value = [
                        (i, "Example", "Example", None, None, 10000-i, i) for i in range(1, count+1)]
                connection.cursor.return_value.execute.side_effect = execute
                original_load = worker.load_module
                generation_day = [date(2026, 10, 18)]

                generators = []
                # The site's pages index (sitemap_new.py): Netflix in the United States has titles.
                new_index = json.dumps({"pages": [
                    {"path": "/new/us/netflix", "titles": 12, "latest": 1792713600000},
                    {"path": "/new/us", "titles": 12, "latest": 1792713600000},
                ] if new_rows else []}).encode()

                def load(name, path):
                    module = original_load(name, path)
                    if name == "sitemap_generator":
                        generators.append(module)
                        history_class = module.SitemapHistory
                        module.SitemapHistory = lambda directory: history_class(directory, today=generation_day[0])
                        sys.modules["sitemap_new"].fetch_index = lambda url=None: new_index
                    if name == "sitemap_checker":
                        module.fetch = lambda url: (status_of(url), f'<link rel="canonical" href="{url}">', None)
                        module.fetch_robots = lambda: (module.RobotsRules("User-agent: *\nDisallow: /api/\n"), None)
                        module.MIN_DELAY_SECONDS = 0
                    return module

                with (patch.object(worker.client, "connect", return_value=connection),
                      patch.object(worker.wmill, "get_variable", return_value="test"),
                      patch.object(worker, "load_module", side_effect=load),
                      patch("builtins.print")):
                    if status == 200:
                        count, files = worker.generate_and_check(root)
                        # Titles, people, categories, static pages (with the best-of lists), blog pages, profiles and
                        # the new-on-services pages. Categories and static pages come from the generator's own lists,
                        # so a new landing page doesn't make this count stale.
                        generator = generators[-1]
                        categories = sum(
                            1 + len(generator.extract_subcategories_from_typescript(kind, category))
                            for kind in ("movies", "shows") for category in generator.MAIN_CATEGORIES)
                        static_pages = len(generator.STATIC_ROUTES) + 3
                        self.assertEqual(count, 700 + 300 + 30 + categories + static_pages + profiles + new_pages)
                        static = files[worker.OUTPUT + "sitemap_static.xml"].decode()
                        self.assertIn("<loc>https://goodwatch.app/blog</loc>\n    <lastmod>2026-10-12</lastmod>", static)
                        self.assertIn("<loc>https://goodwatch.app/blog/a-post</loc>\n    <lastmod>2026-10-02</lastmod>", static)
                        self.assertIn("<loc>https://goodwatch.app/blog/b-post</loc>\n    <lastmod>2026-10-12</lastmod>", static)
                        self.assertEqual(static.count("<lastmod>"), 3)
                        self.assertLess(static.index("/use-with-ai<"), static.index("/blog<"))
                        self.assertLess(static.index("/blog/a-post<"), static.index("/blog/b-post<"))
                        self.assertEqual(len(files), 8 + profiles + (1 if new_pages else 0))
                        # Replay from the exact generated artifacts: history and cohort
                        # state must preserve every byte on an unchanged rerun.
                        previous = root / "previous-sitemaps"
                        previous.mkdir()
                        for path, content in files.items():
                            (previous / Path(path).name).write_bytes(content)
                        shutil.rmtree(root / worker.OUTPUT)
                        generation_day[0] = date(2026, 10, 25)
                        again_count, again = worker.generate_and_check(root)
                        self.assertEqual(again_count, count)
                        self.assertEqual(again, files)
                        for path, content in files.items():
                            if "detail_0" in path or "people" in path or "categories" in path:
                                self.assertNotIn(b"<lastmod>", content)
                    else:
                        with self.assertRaisesRegex(RuntimeError, "Sitemap check failed"):
                            worker.generate_and_check(root)
                self.assertEqual(connection.close.call_count, 2 if status == 200 else 1)
                self.assertEqual(connection.cursor.return_value.close.call_count, 2 if status == 200 else 1)
        return files


if __name__ == "__main__":
    unittest.main()
