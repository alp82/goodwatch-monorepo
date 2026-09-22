# extra_requirements:
# qdrant-client==1.19.1

"""Retry only retained Qdrant upserts while publication ownership remains valid."""

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


def upsert_with_retry(
    client: QdrantClient,
    collection_name: str,
    points: list[qm.PointStruct],
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

    The pinned client's upsert does not support a per-call timeout keyword. Admit an
    attempt only when its complete configured transport deadline fits the budget.
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
            result = client.upsert(
                collection_name=collection_name, points=points, wait=True
            )
            ensure_owned()
            if clock() - started > total_budget_seconds:
                raise PublicationFailure(summary("budget_exhausted"))
            if result.status != qm.UpdateStatus.COMPLETED:
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
