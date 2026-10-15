"""Sitemap publication boundary: checked output, narrow scope, atomic update."""
import io
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
              patch.object(worker, "generate_and_check", return_value=(1096, files)) as check,
              patch.object(worker, "publish", return_value="commit") as publish,
              patch.object(worker.wmill, "get_variable") as secret):
            if failed:
                check.side_effect = RuntimeError("check failed")
                with self.assertRaisesRegex(RuntimeError, "check failed"):
                    worker.main(dry_run)
                publish.assert_not_called()
            else:
                result = worker.main(dry_run)
                self.assertEqual(result["url_count"], 1096)
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
        import shutil
        repo = Path(__file__).resolve().parents[2]
        for status in (200, 404):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for name in worker.SOURCE_FILES:
                    target = root / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(repo / name, target)
                connection = Mock()
                connection.cursor.return_value.fetchall.return_value = [(1, "Example", "Example", None, None)]
                original_load = worker.load_module

                def load(name, path):
                    module = original_load(name, path)
                    if name == "sitemap_checker":
                        module.fetch = lambda url: (status, f'<link rel="canonical" href="{url}">', None)
                        module.MIN_DELAY_SECONDS = 0
                    return module

                with (patch.object(worker.client, "connect", return_value=connection),
                      patch.object(worker.wmill, "get_variable", return_value="test"),
                      patch.object(worker, "load_module", side_effect=load),
                      patch("builtins.print")):
                    if status == 200:
                        count, files = worker.generate_and_check(root)
                        self.assertEqual(count, 98)  # Two titles, 87 categories, nine static pages.
                        self.assertEqual(len(files), 7)
                    else:
                        with self.assertRaisesRegex(RuntimeError, "Sitemap check failed"):
                            worker.generate_and_check(root)
                connection.close.assert_called_once()
                connection.cursor.return_value.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
