# extra_requirements:
# qdrant-client==1.19.1

"""Write Qdrant points without deleting vectors that other writers own.

A plain upsert replaces the whole point, so it would delete every vector the
write leaves out. Writers instead combine two kinds of operations for the same
points in one batch request:

- `insert_points` creates missing points and leaves existing points untouched.
- `update_points` replaces only the writer's own vectors and the payload.

`write_with_retry` sends that batch and retries it while publication ownership
remains valid. Every operation is idempotent, so a retry repeats the whole batch.
"""

import json
import math
import random
import time
from collections import Counter
from typing import Callable

import grpc
import httpx
from qdrant_client.http.exceptions import (
    UnexpectedResponse,
    ResponseHandlingException,
)
from qdrant_client import QdrantClient, models as qm

REQUEST_TIMEOUT_SECONDS = 30
TOTAL_RETRY_BUDGET_SECONDS = 120
MAX_ATTEMPTS = 4


class PublicationFailure(RuntimeError):
    """Actionable failure with payload-free counters for job observability."""

    def __init__(self, summary: dict) -> None:
        self.summary = summary
        super().__init__(
            "Qdrant publication failed "
            f"({summary['classification'].replace('_', ' ')}): "
            f"{json.dumps(summary, sort_keys=True)}. "
            "Demand remains unacknowledged; replay publication using saved source results."
        )


def classify_error(error: Exception) -> tuple[str, bool]:
    if isinstance(error, ResponseHandlingException):
        return classify_error(error.source)
    if isinstance(error, httpx.TimeoutException):
        return "http_timeout", True
    if isinstance(error, httpx.ConnectError):
        return "http_connect", True
    if isinstance(error, grpc.RpcError):
        code = getattr(error, "code", None)
        status = code() if callable(code) else None
        if status == grpc.StatusCode.UNAVAILABLE:
            return "grpc_unavailable", True
        if status == grpc.StatusCode.DEADLINE_EXCEEDED:
            return "grpc_deadline_exceeded", True
        if status in (
            grpc.StatusCode.UNAUTHENTICATED,
            grpc.StatusCode.PERMISSION_DENIED,
        ):
            return "authentication", False
        if status in (
            grpc.StatusCode.INVALID_ARGUMENT,
            grpc.StatusCode.FAILED_PRECONDITION,
            grpc.StatusCode.OUT_OF_RANGE,
        ):
            return "invalid_data", False
    if isinstance(error, UnexpectedResponse):
        if error.status_code in (401, 403):
            return "authentication", False
        if error.status_code in (400, 422):
            return "invalid_data", False
        return f"http_{error.status_code}", error.status_code in (
            502,
            503,
            504,
        )
    if isinstance(error, (ValueError, TypeError)):
        return "invalid_data", False
    return "permanent_error", False


def insert_points(points: list[qm.PointStruct]) -> list:
    """Create the points that don't exist yet; existing points stay unchanged."""
    if not points:
        return []
    return [qm.UpsertOperation(upsert=qm.PointsList(
        points=points, update_mode=qm.UpdateMode.INSERT_ONLY,
    ))]


def update_points(points: list[qm.PointStruct]) -> list:
    """Replace the given vectors and, where set, the whole payload of existing points.

    Vectors that a point doesn't name stay as they are. A point with `payload=None`
    keeps its payload. Updating a point that doesn't exist fails with 404.
    """
    if not points:
        return []
    operations: list = [qm.UpdateVectorsOperation(update_vectors=qm.UpdateVectors(
        points=[qm.PointVectors(id=point.id, vector=point.vector) for point in points],
    ))]
    operations += [
        qm.OverwritePayloadOperation(overwrite_payload=qm.SetPayload(
            payload=point.payload, points=[point.id],
        ))
        for point in points if point.payload is not None
    ]
    return operations


def write_with_retry(
    client: QdrantClient,
    collection_name: str,
    operations: list,
    check_owned: Callable[[], None],
    *,
    request_timeout_seconds: float = REQUEST_TIMEOUT_SECONDS,
    total_budget_seconds: float = TOTAL_RETRY_BUDGET_SECONDS,
    max_attempts: int = MAX_ATTEMPTS,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
    jitter: Callable[[float, float], float] = random.uniform,
) -> dict:
    """Client transport timeout must match request_timeout_seconds.

    Sends `operations` (from `insert_points` and `update_points`) as one
    `batch_update_points` request. Admit an attempt only when its complete
    configured transport deadline fits the budget.
    """
    if (
        not math.isfinite(request_timeout_seconds)
        or request_timeout_seconds <= 0
        or not math.isfinite(total_budget_seconds)
        or total_budget_seconds < request_timeout_seconds
        or isinstance(max_attempts, bool)
        or not isinstance(max_attempts, int)
        or max_attempts < 1
    ):
        raise ValueError(
            "Invalid publication retry deadline, budget, or attempt limit"
        )
    started = clock()
    attempts = 0
    errors: Counter[str] = Counter()

    def summary(classification: str) -> dict:
        return {
            "classification": classification,
            "attempts": attempts,
            "retries": max(0, attempts - 1),
            "errors": dict(errors),
            "elapsed_seconds": round(clock() - started, 3),
            "request_timeout_seconds": request_timeout_seconds,
            "budget_seconds": total_budget_seconds,
        }

    def ensure_owned() -> None:
        try:
            check_owned()
        except Exception:
            errors["lease_lost"] += 1
            raise PublicationFailure(summary("lease_lost")) from None

    while True:
        ensure_owned()
        if clock() - started + request_timeout_seconds > total_budget_seconds:
            raise PublicationFailure(summary("budget_exhausted"))
        attempts += 1
        try:
            results = client.batch_update_points(
                collection_name=collection_name,
                update_operations=operations,
                wait=True,
            )
            ensure_owned()
            if clock() - started > total_budget_seconds:
                raise PublicationFailure(summary("budget_exhausted"))
            if any(result.status != qm.UpdateStatus.COMPLETED for result in results):
                errors["incomplete_status"] += 1
                raise PublicationFailure(summary("incomplete_status"))
            return summary("completed")
        except PublicationFailure:
            raise
        except Exception as error:
            classification, transient = classify_error(error)
            errors[classification] += 1
            if not transient:
                raise PublicationFailure(summary(classification)) from None
            if attempts >= max_attempts:
                raise PublicationFailure(
                    summary("attempts_exhausted")
                ) from None
            ensure_owned()
            delay_floor = min(4.0, 2.0 ** (attempts - 1))
            delay = jitter(delay_floor, delay_floor * 2)
            if (
                clock() - started + delay + request_timeout_seconds
                > total_budget_seconds
            ):
                raise PublicationFailure(summary("budget_exhausted")) from None
            sleep(delay)


def main() -> None:
    """Shared importable retry helper; no standalone publication input."""
