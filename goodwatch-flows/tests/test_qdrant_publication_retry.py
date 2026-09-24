"""Public publication retry boundary: retained inputs, bounded time, fenced writes."""

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import grpc
import httpx
from qdrant_client.http.exceptions import (
    UnexpectedResponse,
    ResponseHandlingException,
)
from qdrant_client import models as qm

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy.qdrant_retry import (
    PublicationFailure, insert_points, update_points, write_with_retry,
)


class RpcFailure(grpc.RpcError):
    def __init__(self, status: grpc.StatusCode) -> None:
        self.status = status

    def code(self) -> grpc.StatusCode:
        return self.status


class Clock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class PointOperationTests(unittest.TestCase):
    def test_insert_creates_missing_points_only(self) -> None:
        points = [qm.PointStruct(id=84, vector={"a": [0.1]}, payload={"tmdb_id": 42})]
        [operation] = insert_points(points)
        self.assertEqual(operation.upsert.points, points)
        self.assertEqual(operation.upsert.update_mode, qm.UpdateMode.INSERT_ONLY)

    def test_update_names_only_given_vectors_and_replaces_payload(self) -> None:
        points = [
            qm.PointStruct(id=84, vector={"a": [0.1]}, payload={"tmdb_id": 42}),
            qm.PointStruct(id=85, vector={"a": [0.2]}, payload=None),
        ]
        vectors, payload = update_points(points)
        self.assertEqual(
            [(p.id, p.vector) for p in vectors.update_vectors.points],
            [(84, {"a": [0.1]}), (85, {"a": [0.2]})],
        )
        self.assertEqual(payload.overwrite_payload.payload, {"tmdb_id": 42})
        self.assertEqual(payload.overwrite_payload.points, [84])

    def test_no_points_means_no_operations(self) -> None:
        self.assertEqual(insert_points([]) + update_points([]), [])


class PublicationRetryTests(unittest.TestCase):
    def test_unavailable_recovers_using_same_retained_points(self) -> None:
        client = Mock()
        client.batch_update_points.side_effect = [
            RpcFailure(grpc.StatusCode.UNAVAILABLE),
            [SimpleNamespace(status=qm.UpdateStatus.COMPLETED)],
        ]
        points = [qm.PointStruct(id=84, vector=[0.1], payload={"tmdb_id": 42})]
        operations = insert_points(points) + update_points(points)
        clock = Clock()
        check_owned = Mock()
        result = write_with_retry(
            client,
            "media",
            operations,
            check_owned,
            clock=clock,
            sleep=clock.sleep,
            jitter=lambda low, high: high,
        )
        self.assertEqual(result["attempts"], 2)
        self.assertEqual(result["retries"], 1)
        self.assertEqual(result["errors"], {"grpc_unavailable": 1})
        self.assertEqual(clock.sleeps, [2.0])
        self.assertTrue(
            all(
                call.kwargs["update_operations"] is operations
                for call in client.batch_update_points.call_args_list
            )
        )
        self.assertTrue(
            all(call.kwargs["wait"] for call in client.batch_update_points.call_args_list)
        )
        self.assertNotIn("timeout", client.batch_update_points.call_args.kwargs)

    def test_authentication_and_invalid_data_fail_without_retry_or_payload_leak(
        self,
    ) -> None:
        cases = [
            (RpcFailure(grpc.StatusCode.UNAUTHENTICATED), "authentication"),
            (RpcFailure(grpc.StatusCode.INVALID_ARGUMENT), "invalid_data"),
            (
                UnexpectedResponse(
                    403, "Forbidden", b"private payload", httpx.Headers()
                ),
                "authentication",
            ),
            (
                UnexpectedResponse(
                    400, "Bad request", b"private payload", httpx.Headers()
                ),
                "invalid_data",
            ),
            (ValueError("private payload"), "invalid_data"),
        ]
        for error, classification in cases:
            with self.subTest(classification=classification):
                client = Mock()
                client.batch_update_points.side_effect = error
                clock = Clock()
                with self.assertRaises(PublicationFailure) as raised:
                    write_with_retry(
                        client,
                        "media",
                        [],
                        Mock(),
                        clock=clock,
                        sleep=clock.sleep,
                    )
                self.assertEqual(
                    raised.exception.summary["classification"], classification
                )
                self.assertEqual(raised.exception.summary["attempts"], 1)
                self.assertEqual(clock.sleeps, [])
                self.assertNotIn("private payload", str(raised.exception))

    def test_total_budget_admits_only_full_requests(self) -> None:
        clock = Clock()

        def timeout_request(**kwargs: object) -> None:
            clock.now += 30
            raise RpcFailure(grpc.StatusCode.DEADLINE_EXCEEDED)

        client = Mock()
        client.batch_update_points.side_effect = timeout_request
        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(
                client,
                "media",
                [],
                Mock(),
                clock=clock,
                sleep=clock.sleep,
                jitter=lambda low, high: high,
            )
        self.assertEqual(
            raised.exception.summary["classification"], "budget_exhausted"
        )
        self.assertEqual(raised.exception.summary["attempts"], 3)
        self.assertEqual(clock.sleeps, [2.0, 4.0])
        self.assertLessEqual(clock.now, 120)

    def test_completion_after_total_budget_is_not_success(self) -> None:
        clock = Clock()

        def late_write(**kwargs: object) -> SimpleNamespace:
            clock.now = 121
            return [SimpleNamespace(status=qm.UpdateStatus.COMPLETED)]

        client = Mock()
        client.batch_update_points.side_effect = late_write
        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(
                client, "media", [], Mock(), clock=clock, sleep=clock.sleep
            )
        self.assertEqual(
            raised.exception.summary["classification"], "budget_exhausted"
        )

    def test_ownership_loss_during_backoff_prevents_delayed_retry(
        self,
    ) -> None:
        client = Mock()
        client.batch_update_points.side_effect = RpcFailure(grpc.StatusCode.UNAVAILABLE)
        clock = Clock()

        def owned() -> None:
            if clock.sleeps:
                raise RuntimeError("replacement publisher owns the title")

        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(
                client, "media", [], owned, clock=clock, sleep=clock.sleep
            )
        self.assertEqual(
            raised.exception.summary["classification"], "lease_lost"
        )
        self.assertEqual(client.batch_update_points.call_count, 1)

    def test_ownership_loss_after_write_prevents_success(self) -> None:
        client = Mock()
        client.batch_update_points.return_value = [SimpleNamespace(status=qm.UpdateStatus.COMPLETED)]

        def owned() -> None:
            if client.batch_update_points.called:
                raise RuntimeError("replacement publisher owns the title")

        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(client, "media", [], owned)
        self.assertEqual(
            raised.exception.summary["classification"], "lease_lost"
        )
        self.assertEqual(client.batch_update_points.call_count, 1)

    def test_selected_http_transients_recover_but_other_statuses_do_not_retry(
        self,
    ) -> None:
        cases = [
            (
                UnexpectedResponse(
                    503, "Unavailable", b"secret", httpx.Headers()
                ),
                "http_503",
                True,
            ),
            (
                UnexpectedResponse(502, "Gateway", b"secret", httpx.Headers()),
                "http_502",
                True,
            ),
            (
                UnexpectedResponse(
                    504, "Deadline", b"secret", httpx.Headers()
                ),
                "http_504",
                True,
            ),
            (
                ResponseHandlingException(httpx.ConnectError("secret")),
                "http_connect",
                True,
            ),
            (
                ResponseHandlingException(httpx.ReadTimeout("secret")),
                "http_timeout",
                True,
            ),
            (
                UnexpectedResponse(
                    429, "Rate limited", b"secret", httpx.Headers()
                ),
                "http_429",
                False,
            ),
            (
                UnexpectedResponse(404, "Missing", b"secret", httpx.Headers()),
                "http_404",
                False,
            ),
        ]
        for error, classification, transient in cases:
            with self.subTest(classification=classification):
                client = Mock()
                client.batch_update_points.side_effect = [
                    error,
                    [SimpleNamespace(status=qm.UpdateStatus.COMPLETED)],
                ]
                clock = Clock()
                if transient:
                    result = write_with_retry(
                        client,
                        "media",
                        [],
                        Mock(),
                        clock=clock,
                        sleep=clock.sleep,
                    )
                    self.assertEqual(result["attempts"], 2)
                    self.assertEqual(result["errors"], {classification: 1})
                else:
                    with self.assertRaises(PublicationFailure) as raised:
                        write_with_retry(
                            client,
                            "media",
                            [],
                            Mock(),
                            clock=clock,
                            sleep=clock.sleep,
                        )
                    self.assertEqual(
                        raised.exception.summary["classification"],
                        classification,
                    )
                    self.assertEqual(client.batch_update_points.call_count, 1)

    def test_attempt_exhaustion_and_incomplete_status_are_actionable(
        self,
    ) -> None:
        client = Mock()
        client.batch_update_points.side_effect = RpcFailure(grpc.StatusCode.UNAVAILABLE)
        clock = Clock()
        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(
                client,
                "media",
                [],
                Mock(),
                clock=clock,
                sleep=clock.sleep,
                jitter=lambda low, high: high,
            )
        self.assertEqual(
            raised.exception.summary["classification"], "attempts_exhausted"
        )
        self.assertEqual(raised.exception.summary["attempts"], 4)
        self.assertEqual(
            raised.exception.summary["errors"], {"grpc_unavailable": 4}
        )
        self.assertEqual(clock.sleeps, [2.0, 4.0, 8.0])
        client = Mock()
        client.batch_update_points.return_value = [
            SimpleNamespace(status=qm.UpdateStatus.COMPLETED),
            SimpleNamespace(status=qm.UpdateStatus.ACKNOWLEDGED),
        ]
        with self.assertRaises(PublicationFailure) as raised:
            write_with_retry(client, "media", [], Mock())
        self.assertEqual(
            raised.exception.summary["classification"], "incomplete_status"
        )
        self.assertEqual(client.batch_update_points.call_count, 1)


if __name__ == "__main__":
    unittest.main()
