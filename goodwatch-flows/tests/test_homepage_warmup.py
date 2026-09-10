"""Validate the scheduled worker's authenticated application boundary."""

import io
import json
import sys
import traceback
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.utils import visit_goodwatch_and_populate_cache as worker


class HomepageWarmupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.secret = "private-test-credential-never-log-this"
        self.result = {
            "status": "refreshed",
            "country": "DE",
            "language": "en",
            "item_count": 4,
            "identities": [
                "movie/27205", "show/2316", "movie/129", "show/1396",
            ],
            "write_verified": True,
            "ttl_seconds": 86400,
            "computed_at": "2026-09-11T00:00:00.000Z",
        }

    def test_verified_success_uses_fixed_authenticated_post(self) -> None:
        opener = Mock()
        opener.open.return_value = io.StringIO(json.dumps(self.result))
        with (
            patch.object(worker.wmill, "get_variable", return_value=self.secret),
            patch.object(worker, "build_opener", return_value=opener),
        ):
            self.assertEqual(worker.main(), self.result)
        request = opener.open.call_args.args[0]
        self.assertEqual(
            request.full_url,
            "https://goodwatch.app/api/internal/homepage-warmup",
        )
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Authorization"), f"Bearer {self.secret}")
        self.assertIsNone(request.data)
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 330)

    def test_http_success_requires_complete_verified_fixed_scope(self) -> None:
        variants = [
            {**self.result, "item_count": 3},
            {**self.result, "identities": ["movie/27205"]},
            {**self.result, "write_verified": False},
            {**self.result, "country": "US"},
            {**self.result, "language": "de"},
            {**self.result, "status": "failed"},
            {**self.result, "ttl_seconds": 60},
            {},
            [],
        ]
        for result in variants:
            with self.subTest(result=result):
                opener = Mock()
                opener.open.return_value = io.StringIO(json.dumps(result))
                with (
                    patch.object(worker.wmill, "get_variable", return_value=self.secret),
                    patch.object(worker, "build_opener", return_value=opener),
                    self.assertRaisesRegex(RuntimeError, "did not confirm"),
                ):
                    worker.main()

    def test_missing_secret_never_opens_network_request(self) -> None:
        for secret in (None, "", "short"):
            with self.subTest(secret=secret):
                with (
                    patch.object(worker.wmill, "get_variable", return_value=secret),
                    patch.object(worker, "build_opener") as build_opener,
                    self.assertRaisesRegex(RuntimeError, "not configured"),
                ):
                    worker.main()
                build_opener.assert_not_called()

    def test_http_failure_redacts_response_and_credentials(self) -> None:
        response_body = "private upstream response content"
        error = HTTPError(
            worker.WARMUP_URL, 503, self.secret, {},
            io.BytesIO(response_body.encode()),
        )
        opener = Mock()
        opener.open.side_effect = error
        with (
            patch.object(worker.wmill, "get_variable", return_value=self.secret),
            patch.object(worker, "build_opener", return_value=opener),
        ):
            try:
                worker.main()
            except RuntimeError as failure:
                rendered = "".join(traceback.format_exception(failure))
                self.assertIn("HTTP 503", rendered)
                self.assertNotIn(self.secret, rendered)
                self.assertNotIn(response_body, rendered)
            else:
                self.fail("HTTP failure must fail the scheduled job")


if __name__ == "__main__":
    unittest.main()
