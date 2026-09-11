"""Discord delivery boundary: confirmation, throttling and secret redaction."""

import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.notifications import deliver_notification

WEBHOOK = "https://discord.com/api/webhooks/123456/private-test-token"
NOTICE = {
    "kind": "incident",
    "pipeline": "f/monitoring/notification_check",
    "causes": ["missing_execution"],
    "job_id": "01a08fbc-2f86-bf77-01a9-442d8f5b8ed9",
}


class NotificationTests(unittest.TestCase):
    def test_confirmed_message_uses_wait_no_mentions_and_safe_job_link(
        self,
    ) -> None:
        opener = Mock()
        opener.open.return_value = io.BytesIO(b'{"id":"998877"}')
        with patch(
            "f.monitoring.notifications.build_opener", return_value=opener
        ):
            result = deliver_notification(
                WEBHOOK, {**NOTICE, "args": {"password": "do-not-send"}}
            )
        self.assertTrue(result["delivered"])
        self.assertEqual(result["message_id"], "998877")
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, WEBHOOK + "?wait=true")
        self.assertEqual(
            request.get_header("User-agent"),
            "DiscordBot (https://github.com/alp82/goodwatch-monorepo, 1.0.0)",
        )
        payload = json.loads(request.data)
        self.assertEqual(payload["allowed_mentions"], {"parse": []})
        self.assertIn("[controlled monitor check]", payload["content"])
        self.assertIn(
            "https://windmill.goodwatch.app/run/01a08fbc-2f86-bf77-01a9-442d8f5b8ed9?workspace=goodwatch",
            payload["content"],
        )
        self.assertNotIn("do-not-send", payload["content"])

    def test_invalid_destination_and_payload_never_make_request(self) -> None:
        for url in [
            "http://discord.com/api/webhooks/123/token",
            "https://evil.test/api/webhooks/123/token",
            WEBHOOK + "?target=evil",
            "https://discord.com@evil.test/api/webhooks/123/token",
        ]:
            with (
                self.subTest(url=url),
                patch("f.monitoring.notifications.build_opener") as opener,
            ):
                result = deliver_notification(url, NOTICE)
                self.assertFalse(result["delivered"])
                self.assertTrue(result["permanent_failure"])
                opener.assert_not_called()
        with patch("f.monitoring.notifications.build_opener") as opener:
            result = deliver_notification(
                WEBHOOK, {**NOTICE, "causes": ["secret payload"]}
            )
            self.assertEqual(result["error_code"], "invalid_notification")
            opener.assert_not_called()

    def test_rate_limit_uses_longer_header_or_json_delay_without_retry(
        self,
    ) -> None:
        error = HTTPError(
            WEBHOOK,
            429,
            "secret",
            {"Retry-After": "40"},
            io.BytesIO(b'{"retry_after": 60.5}'),
        )
        opener = Mock()
        opener.open.side_effect = error
        with patch(
            "f.monitoring.notifications.build_opener", return_value=opener
        ):
            result = deliver_notification(WEBHOOK, NOTICE)
        self.assertEqual(result["retry_after_seconds"], 60.5)
        self.assertEqual(result["error_code"], "rate_limited")
        self.assertFalse(result["permanent_failure"])
        opener.open.assert_called_once()

    def test_deleted_webhook_is_permanent_and_transport_errors_are_redacted(
        self,
    ) -> None:
        for error, permanent, code in [
            (
                HTTPError(
                    WEBHOOK, 404, WEBHOOK, {}, io.BytesIO(b"private body")
                ),
                True,
                "http_404",
            ),
            (URLError(WEBHOOK + " private body"), False, "transport_error"),
        ]:
            with self.subTest(code=code):
                opener = Mock()
                opener.open.side_effect = error
                with patch(
                    "f.monitoring.notifications.build_opener",
                    return_value=opener,
                ):
                    result = deliver_notification(WEBHOOK, NOTICE)
                self.assertEqual(result["permanent_failure"], permanent)
                self.assertEqual(result["error_code"], code)
                self.assertNotIn("private", str(result))
                self.assertNotIn(WEBHOOK, str(result))

    def test_http_success_without_message_confirmation_is_not_delivery(
        self,
    ) -> None:
        opener = Mock()
        opener.open.return_value = io.BytesIO(b"{}")
        with patch(
            "f.monitoring.notifications.build_opener", return_value=opener
        ):
            result = deliver_notification(WEBHOOK, NOTICE)
        self.assertFalse(result["delivered"])
        self.assertEqual(result["error_code"], "unconfirmed_response")

    def test_grouped_backlog_notification_contains_safe_counts_age_and_source_link(
        self,
    ) -> None:
        from datetime import datetime, timezone
        from f.monitoring.health import incident_transition

        report = {
            "path": "f/monitoring/country_backlog",
            "status": "unhealthy",
            "causes": ["country_backlog_stalled"],
            "source_pipeline": "f/tmdb_web/tmdb_crawl_providers",
            "overdue_country_count": 12,
            "overdue_title_count": 4,
            "oldest_overdue_at": "2026-09-11T08:00:00+00:00",
            "age_basis": "due_timestamp",
            "raw_payload": "must-not-appear",
        }
        pending = incident_transition(
            None, report, datetime(2026, 9, 11, 12, tzinfo=timezone.utc)
        )["notification"]
        opener = Mock()
        opener.open.return_value = io.BytesIO(b'{"id":"998877"}')
        with patch(
            "f.monitoring.notifications.build_opener", return_value=opener
        ):
            result = deliver_notification(WEBHOOK, pending)
        self.assertTrue(result["delivered"])
        content = json.loads(opener.open.call_args.args[0].data)["content"]
        self.assertIn("Overdue countries: 12", content)
        self.assertIn("Overdue titles: 4", content)
        self.assertIn("2026-09-11T08:00:00+00:00", content)
        self.assertIn(
            "https://windmill.goodwatch.app/flows/get/f/tmdb_web/tmdb_crawl_providers?workspace=goodwatch",
            content,
        )
        self.assertNotIn("must-not-appear", content)


if __name__ == "__main__":
    unittest.main()
